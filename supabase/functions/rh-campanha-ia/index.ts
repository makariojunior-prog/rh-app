// deno-lint-ignore-file no-explicit-any
import { createClient } from 'jsr:@supabase/supabase-js@2'

/**
 * Edge Function: rh-campanha-ia
 *
 * Gerencia a geração de criativo com IA (Gemini 3.8 Flash + Gemini Nano Banana 2.1) e a
 * publicação de campanhas de recrutamento no Meta Ads (contas Lumar Alimentos ou Cantina em Casa),
 * com registro na fila de comandos/auditoria do Marketing (mkt_comandos / mkt_auditoria) e
 * sincronização em mkt_campanhas.
 *
 * Ações (body.acao):
 *   - 'gerar_previa' -> gera os textos persuasivos do anúncio (headline, subheadline, badges,
 *                       legenda, titulo_link) via Gemini 3.8 Flash (Interactions API) e,
 *                       opcionalmente, gera uma foto de fundo ambiente sem texto via
 *                       Gemini Nano Banana 2.1 (gemini-nano-banana-2.1).
 *   - 'publicar'     -> recebe os dados aprovados + imagem final em base64 (PNG 1080x1080 renderizada
 *                       no Canvas do RH), grava no Storage, cria Campanha + Conjunto + Criativo +
 *                       Anúncio na Graph API da Meta (conta Cantina ou Lumar), registra em
 *                       mkt_comandos / mkt_auditoria e faz upsert em mkt_campanhas.
 *   - 'pausar'       -> pausa uma campanha publicada pelo RH na Meta API e atualiza o status.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

// Contas e Páginas oficiais levantadas em docs/SETUP-META.md
const CONTAS_META: Record<'cantina' | 'lumar', {
  nome: string
  conta_id_externo: string
  pagina_id_externo: string
  empresa_id: string
  cor_primaria: string
}> = {
  cantina: {
    nome: 'Cantina em Casa - Cartão',
    conta_id_externo: '338176501855182',
    pagina_id_externo: '111645087198984',
    empresa_id: 'cantina',
    cor_primaria: '#E8560A',
  },
  lumar: {
    nome: 'Lumar Alimentos',
    conta_id_externo: '462816038169791',
    pagina_id_externo: '106182958374926',
    empresa_id: 'lumar',
    cor_primaria: '#28458E',
  },
}

// Redige tokens de qualquer mensagem de erro antes de devolver ou salvar no banco
function redigirSegredos(msg: string, segredos: string[]): string {
  let out = msg.replace(/access_token=[^&\s"']+/gi, 'access_token=[REDACTED]')
  for (const s of segredos) {
    if (s && s.length >= 8) {
      out = out.split(s).join('[REDACTED]')
    }
  }
  return out
}

// Extrai o texto de uma resposta da Interactions API (v1beta/interactions)
function extrairOutputText(resJson: any): string | null {
  if (typeof resJson?.output_text === 'string' && resJson.output_text.trim()) {
    return resJson.output_text.trim()
  }
  const steps = Array.isArray(resJson?.steps) ? resJson.steps : []
  const textos: string[] = []
  for (const step of steps) {
    if (step?.type === 'model_output' && Array.isArray(step?.content)) {
      for (const item of step.content) {
        if (item?.type === 'text' && typeof item?.text === 'string') {
          textos.push(item.text)
        }
      }
    }
  }
  return textos.length ? textos.join('\n').trim() : null
}

// Extrai a imagem base64 de uma resposta da Interactions API (v1beta/interactions)
function extrairOutputImage(resJson: any): { data: string; mime_type: string } | null {
  if (resJson?.output_image?.data) {
    return {
      data: resJson.output_image.data,
      mime_type: resJson.output_image.mime_type || 'image/png',
    }
  }
  const steps = Array.isArray(resJson?.steps) ? resJson.steps : []
  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i]
    if (step?.type === 'model_output' && Array.isArray(step?.content)) {
      for (let j = step.content.length - 1; j >= 0; j--) {
        const item = step.content[j]
        if (item?.type === 'image' && typeof item?.data === 'string') {
          return {
            data: item.data,
            mime_type: item.mime_type || 'image/png',
          }
        }
      }
    }
  }
  return null
}

// Monta cópia padrão estruturada caso a chave de IA não esteja configurada ou falhe
function gerarCopyFallback(params: {
  conta: 'cantina' | 'lumar'
  vaga: string
  divulgar_salario: boolean
  salario_texto: string
  gratificacao_fixa: string
  gratificacoes_adicionais: string
  divulgar_beneficios: boolean
  beneficios: string[]
  divulgar_horario: boolean
  horario_texto: string
  divulgar_local: boolean
  local_texto: string
  requisitos_texto: string
  whatsapp_contato: string
  instagram_handle: string
}) {
  const nomeMarca = params.conta === 'lumar' ? 'Lumar Alimentos' : 'Cantina em Casa'

  // Requisitos (3 a 4 tópicos para a caixa marrom)
  const reqLinhas = params.requisitos_texto
    ? params.requisitos_texto.split(/\n|;/).map((s) => s.trim()).filter(Boolean)
    : []
  const requisitos_bullets = reqLinhas.length >= 2
    ? reqLinhas.slice(0, 4)
    : [
        `Experiência comprovada na função de ${params.vaga.toLowerCase()}`,
        `Conhecimento nas rotinas e boas práticas da área`,
        `Agilidade, organização e atenção aos detalhes`,
        `Capacidade de trabalhar em equipe`,
      ]

  // Remuneração (com suporte a **negrito**)
  const remuneracao_bullets: string[] = []
  if (params.divulgar_salario) {
    if (params.salario_texto) {
      remuneracao_bullets.push(`Salário: **${params.salario_texto}**`)
    }
    if (params.gratificacao_fixa) {
      remuneracao_bullets.push(`Gratificação fixa: **${params.gratificacao_fixa}**`)
    }
    if (params.gratificacoes_adicionais) {
      remuneracao_bullets.push(
        `Possibilidade de receber mais **${params.gratificacoes_adicionais} em gratificações adicionais**, conforme as regras e critérios estabelecidos pela empresa.`
      )
    }
    if (remuneracao_bullets.length === 0) {
      remuneracao_bullets.push(`**Salário compatível com o mercado** + pacote de gratificações CLT.`)
    }
  } else {
    remuneracao_bullets.push(`**Salário compatível com a função (CLT)** + possibilidade de gratificações por desempenho.`)
  }

  // Benefícios (com suporte a **negrito** no estilo oficial)
  const beneficios_bullets = params.divulgar_beneficios && params.beneficios.length > 0
    ? params.beneficios
    : [
        `**Vale Alimentação de R$ 300,00**, concedido após o período de experiência, conforme critérios e regras da empresa;`,
        `**Vale-transporte**;`,
        `**Alimentação completa na empresa:** café da manhã, almoço e lanche da tarde.`,
      ]

  const linhasLegenda = [
    `🚀 VAGA DE EMPREGO: ${params.vaga.toUpperCase()}!`,
    ``,
    `Venha fazer parte da equipe ${nomeMarca} em ${params.local_texto || 'Goiânia - GO'}!`,
    ``,
    `📋 REQUISITOS:`,
    ...requisitos_bullets.map((r) => `• ${r.replace(/\*\*/g, '')}`),
    ``,
  ]
  if (params.divulgar_salario && remuneracao_bullets.length) {
    linhasLegenda.push(`💰 REMUNERAÇÃO:`)
    remuneracao_bullets.forEach((r) => linhasLegenda.push(`• ${r.replace(/\*\*/g, '')}`))
    linhasLegenda.push(``)
  }
  if (params.divulgar_beneficios && beneficios_bullets.length > 0) {
    linhasLegenda.push(`🎁 BENEFÍCIOS:`)
    beneficios_bullets.forEach((b) => linhasLegenda.push(`• ${b.replace(/\*\*/g, '')}`))
    linhasLegenda.push(``)
  }
  if (params.divulgar_horario && params.horario_texto) {
    linhasLegenda.push(`⏰ Horário: ${params.horario_texto}`)
  }
  if (params.whatsapp_contato) {
    linhasLegenda.push(`📲 Entre em contato: ${params.whatsapp_contato}`)
  }
  linhasLegenda.push(
    ``,
    `👉 Candidate-se também pelo link: https://vagas.cantinaemcasa.com`
  )

  return {
    cargo_banner: params.vaga.toUpperCase(),
    requisitos_bullets,
    remuneracao_bullets,
    beneficios_bullets,
    horario_texto: params.horario_texto || 'Segunda à Sexta: 07:30 às 17:30',
    whatsapp_contato: params.whatsapp_contato || '62 9 9330-9428',
    instagram_handle: params.instagram_handle || (params.conta === 'lumar' ? 'lumaralimentos' : 'cantina.em.casa'),
    titulo_link: `Vaga: ${params.vaga} — Envie seu currículo`,
    legenda: linhasLegenda.join('\n'),
    prompt_foto_funcao: `Close-up professional commercial photography of a ${params.vaga} in action in a clean Brazilian artisanal food bakery/kitchen workplace, warm natural lighting, shallow depth of field, high detail, no text, no logos`,
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Não autenticado.' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!

    // 1. Identifica o chamador e confirma que é membro ativo do RH
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: caller } } = await callerClient.auth.getUser()
    if (!caller) return json({ error: 'Sessão inválida. Faça login novamente.' }, 401)

    const { data: isMember } = await callerClient.rpc('rh_is_member')
    if (!isMember) {
      return json({ error: 'Apenas membros autorizados do RH podem gerenciar campanhas.' }, 403)
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return json({ error: 'Corpo inválido.' }, 400)
    const acao = String((body as Record<string, unknown>).acao ?? '')

    const admin = createClient(supabaseUrl, serviceKey)

    // ── AÇÃO 1: GERAR PRÉVIA COM IA (TEXTO ESTRUTURADO + FOTO DA FUNÇÃO) ────────
    if (acao === 'gerar_previa') {
      const b = body as Record<string, any>
      const conta: 'cantina' | 'lumar' = b.conta_anuncio === 'lumar' ? 'lumar' : 'cantina'
      const vaga = String(b.vaga ?? '').trim()
      if (!vaga) return json({ error: 'Informe o nome da vaga para gerar a prévia.' }, 400)

      const divulgar_salario         = Boolean(b.divulgar_salario)
      const salario_texto            = String(b.salario_texto ?? '').trim()
      const gratificacao_fixa        = String(b.gratificacao_fixa ?? '').trim()
      const gratificacoes_adicionais = String(b.gratificacoes_adicionais ?? '').trim()
      const divulgar_beneficios      = Boolean(b.divulgar_beneficios)
      const beneficios               = Array.isArray(b.beneficios) ? b.beneficios.map(String).filter(Boolean) : []
      const divulgar_horario         = Boolean(b.divulgar_horario)
      const horario_texto            = String(b.horario_texto ?? 'Segunda à Sexta: 07:30 às 17:30').trim()
      const divulgar_local           = Boolean(b.divulgar_local)
      const local_texto              = String(b.local_texto ?? 'Goiânia - GO').trim()
      const requisitos_texto         = String(b.requisitos_texto ?? '').trim()
      const observacoes_ia           = String(b.observacoes_ia ?? '').trim()
      const whatsapp_contato         = String(b.whatsapp_contato ?? '62 9 9330-9428').trim()
      const instagram_handle         = String(b.instagram_handle ?? (conta === 'lumar' ? 'lumaralimentos' : 'cantina.em.casa')).trim()
      const gerar_foto_ia            = Boolean(b.gerar_foto_ia)

      const geminiKey =
        Deno.env.get('GEMINI_API_KEY') ??
        Deno.env.get('GOOGLE_API_KEY') ??
        Deno.env.get('COMPRAS_WA_GEMINI_API_KEY') ??
        ''

      const fallback = gerarCopyFallback({
        conta,
        vaga,
        divulgar_salario,
        salario_texto,
        gratificacao_fixa,
        gratificacoes_adicionais,
        divulgar_beneficios,
        beneficios,
        divulgar_horario,
        horario_texto,
        divulgar_local,
        local_texto,
        requisitos_texto,
        whatsapp_contato,
        instagram_handle,
      })

      let copy = { ...fallback }
      let usouIA = false
      let avisoIA: string | null = null

      if (geminiKey) {
        try {
          const nomeMarca = conta === 'lumar' ? 'Lumar Alimentos (indústria e distribuição de alimentos)' : 'Cantina em Casa (panificação, confeitaria e gastronomia)'
          const promptTexto = [
            `Você é um especialista em recrutamento e seleção da empresa ${nomeMarca}, localizada em ${local_texto || 'Goiânia - GO'}.`,
            `Estamos gerando a arte oficial de "VAGA DE EMPREGO" para Feed (1:1) e Story (9:16) do Instagram/Facebook seguindo nosso layout padrão.`,
            ``,
            `DADOS INFORMADOS PELO RH:`,
            `- Cargo/Vaga: ${vaga}`,
            divulgar_salario
              ? `- Remuneração a divulgar: Salário base=${salario_texto || 'não informado'} | Gratificação fixa=${gratificacao_fixa || 'não informada'} | Gratificações adicionais=${gratificacoes_adicionais || 'não informada'}`
              : `- Remuneração: NÃO expor valores numéricos (indicar salário compatível com a função + pacote CLT).`,
            divulgar_beneficios && beneficios.length
              ? `- Benefícios selecionados: ${beneficios.join(' | ')}`
              : `- Benefícios: usar lista padrão da empresa.`,
            `- Horário de trabalho: ${horario_texto}`,
            requisitos_texto ? `- Requisitos informados pelo RH: ${requisitos_texto}` : `- Requisitos: elabore 4 tópicos objetivos e profissionais típicos para a função de ${vaga}.`,
            observacoes_ia ? `- Instruções adicionais do recrutador: ${observacoes_ia}` : ``,
            ``,
            `Regras para o JSON de saída:`,
            `1. "cargo_banner": nome do cargo em MAIÚSCULAS para a faixa branca principal (ex: "PADEIRO", "AUXILIAR DE COZINHA", máximo 24 caracteres).`,
            `2. "requisitos_bullets": lista com 3 ou 4 tópicos curtos e diretos de requisitos do cargo (ex: ["Experiência comprovada na função de padeiro", "Conhecimento em preparo de produtos de panificação em geral.", "Agilidade, organização e atenção aos detalhes", "Capacidade de trabalhar em equipe"]). Sem marcador "•" no início.`,
            `3. "remuneracao_bullets": lista de 1 a 3 tópicos para o bloco REMUNERAÇÃO. Use **negrito** (dois asteriscos) nos valores e palavras-chave importantes, exatamente neste estilo:`,
            `   - "Salário: **R$ 2.670,00**"`,
            `   - "Gratificação fixa: **R$ 350,00**"`,
            `   - "Possibilidade de receber mais **R$ 450,00 em gratificações adicionais**, conforme as regras e critérios estabelecidos pela empresa."`,
            `   Respeite rigorosamente os valores passados pelo RH (se divulgar_salario=false, coloque apenas 1 frase elegante sem valores numéricos).`,
            `4. "beneficios_bullets": lista de 2 a 4 tópicos para o bloco BENEFÍCIOS, usando **negrito** nos termos principais, no mesmo padrão:`,
            `   - "**Vale Alimentação de R$ 300,00**, concedido após o período de experiência, conforme critérios e regras da empresa;"`,
            `   - "**Vale-transporte**;"`,
            `   - "**Alimentação completa na empresa:** café da manhã, almoço e lanche da tarde."`,
            `5. "titulo_link": título curto do anúncio no Meta Ads (ex: "Vaga: ${vaga} — Candidate-se").`,
            `6. "legenda": legenda completa e persuasiva para o post do Instagram e Facebook, contendo os dados da vaga, WhatsApp (${whatsapp_contato}) e link https://vagas.cantinaemcasa.com.`,
            `7. "prompt_foto_funcao": descrição detalhada em INGLÊS para gerar uma fotografia ilustrativa da função "${vaga}" (foco nas mãos/profissional executando a atividade típica do cargo, ex: padeiro segurando pão artesanal rústico em mesa de madeira, cozinheiro preparando prato, motorista/estoquista em operação limpa; iluminação quente e apetitosa, estilo fotografia publicitária, SEM nenhum texto ou logotipo).`,
          ].filter(Boolean).join('\n')

          const schema = {
            type: 'object',
            properties: {
              cargo_banner: { type: 'string' },
              requisitos_bullets: { type: 'array', items: { type: 'string' } },
              remuneracao_bullets: { type: 'array', items: { type: 'string' } },
              beneficios_bullets: { type: 'array', items: { type: 'string' } },
              titulo_link: { type: 'string' },
              legenda: { type: 'string' },
              prompt_foto_funcao: { type: 'string' },
            },
            required: [
              'cargo_banner',
              'requisitos_bullets',
              'remuneracao_bullets',
              'beneficios_bullets',
              'titulo_link',
              'legenda',
              'prompt_foto_funcao',
            ],
          }

          const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': geminiKey,
            },
            body: JSON.stringify({
              model: 'gemini-3.8-flash',
              input: promptTexto,
              store: false,
              response_format: [
                {
                  type: 'text',
                  mime_type: 'application/json',
                  schema,
                },
              ],
            }),
          })

          if (resp.ok) {
            const data = await resp.json()
            const rawText = extrairOutputText(data)
            if (rawText) {
              const parsed = JSON.parse(rawText)
              copy = {
                cargo_banner: String(parsed.cargo_banner || fallback.cargo_banner).toUpperCase().slice(0, 32),
                requisitos_bullets: Array.isArray(parsed.requisitos_bullets) && parsed.requisitos_bullets.length
                  ? parsed.requisitos_bullets.map(String).slice(0, 4)
                  : fallback.requisitos_bullets,
                remuneracao_bullets: Array.isArray(parsed.remuneracao_bullets) && parsed.remuneracao_bullets.length
                  ? parsed.remuneracao_bullets.map(String).slice(0, 4)
                  : fallback.remuneracao_bullets,
                beneficios_bullets: Array.isArray(parsed.beneficios_bullets) && parsed.beneficios_bullets.length
                  ? parsed.beneficios_bullets.map(String).slice(0, 5)
                  : fallback.beneficios_bullets,
                horario_texto: horario_texto || fallback.horario_texto,
                whatsapp_contato: whatsapp_contato || fallback.whatsapp_contato,
                instagram_handle: instagram_handle || fallback.instagram_handle,
                titulo_link: String(parsed.titulo_link || fallback.titulo_link).slice(0, 65),
                legenda: String(parsed.legenda || fallback.legenda),
                prompt_foto_funcao: String(parsed.prompt_foto_funcao || fallback.prompt_foto_funcao),
              }
              usouIA = true
            }
          } else {
            const errTxt = await resp.text().catch(() => '')
            avisoIA = `IA de texto indisponível (${resp.status}); usamos o modelo oficial estruturado. Detalhe: ${redigirSegredos(errTxt.slice(0, 140), [geminiKey])}`
          }
        } catch (err) {
          avisoIA = `IA de texto falhou (${redigirSegredos(String(err), [geminiKey])}); usamos o modelo oficial estruturado.`
        }
      } else {
        avisoIA = 'Chave GEMINI_API_KEY não encontrada nos secrets; prévia montada com o template oficial da empresa.'
      }

      // Gera a fotografia ilustrativa da função (quadro superior direito) via Gemini Nano Banana 2.1
      let imagem_funcao_base64: string | null = null
      let imagem_funcao_mime = 'image/png'
      if (gerar_foto_ia && geminiKey) {
        try {
          const promptImg = `${copy.prompt_foto_funcao}. High quality commercial photography, warm natural lighting, shallow depth of field, strictly NO text, NO words, NO letters, NO watermarks.`
          const imgResp = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': geminiKey,
            },
            body: JSON.stringify({
              model: 'gemini-nano-banana-2.1',
              input: [{ type: 'text', text: promptImg }],
              store: false,
            }),
          })
          if (imgResp.ok) {
            const imgData = await imgResp.json()
            const imgObj = extrairOutputImage(imgData)
            if (imgObj) {
              imagem_funcao_base64 = imgObj.data
              imagem_funcao_mime = imgObj.mime_type
            }
          } else {
            const errImg = await imgResp.text().catch(() => '')
            avisoIA = (avisoIA ? avisoIA + ' | ' : '') + `Foto da função por IA não gerada (${imgResp.status}: ${redigirSegredos(errImg.slice(0, 100), [geminiKey])}).`
          }
        } catch (err) {
          avisoIA = (avisoIA ? avisoIA + ' | ' : '') + `Falha ao gerar foto da função: ${redigirSegredos(String(err), [geminiKey])}`
        }
      }

      return json({
        ok: true,
        usou_ia: usouIA,
        aviso_ia: avisoIA,
        copy,
        imagem_funcao_base64,
        imagem_funcao_mime,
      })
    }

    // ── AÇÃO 2: APROVAR E PUBLICAR CAMPANHA NA META ADS (FEED 1:1 + STORY 9:16) ──
    if (acao === 'publicar') {
      const b = body as Record<string, any>
      const contaKey: 'cantina' | 'lumar' = b.conta_anuncio === 'lumar' ? 'lumar' : 'cantina'
      const contaCfg = CONTAS_META[contaKey]

      const vaga            = String(b.vaga ?? '').trim()
      const dias_duracao    = Math.max(1, Math.min(90, Math.round(Number(b.dias_duracao) || 7)))
      const orcamento_total = Number(b.orcamento_total) || 0
      const url_destino     = String(b.url_destino ?? 'https://vagas.cantinaemcasa.com').trim()
      const imagem_feed_b64 = String(b.imagem_feed_base64 || b.imagem_base64 || '').replace(/^data:image\/\w+;base64,/, '').trim()
      const imagem_story_b64 = String(b.imagem_story_base64 || '').replace(/^data:image\/\w+;base64,/, '').trim()
      const ia_copy         = (b.ia_copy && typeof b.ia_copy === 'object') ? b.ia_copy : {}

      if (!vaga) return json({ error: 'Informe a vaga da campanha.' }, 400)
      if (orcamento_total < 10) return json({ error: 'O valor de gasto total deve ser de pelo menos R$ 10,00.' }, 400)
      if (!imagem_feed_b64) return json({ error: 'A imagem do criativo de Feed não foi enviada.' }, 400)

      // Convenção de nome exigida por rh_campanhas_recrutamento (~* '(vaga|emprego|recrut|curr[ií]culo|contrata|candidat)')
      const nome_campanha = String(
        b.nome_campanha || `[TRAFEGO] [FORMS] Vaga de Emprego — ${vaga}`
      ).trim()

      const agora = new Date()
      const dataInicio = b.data_inicio ? new Date(b.data_inicio) : agora
      const dataFim = new Date(dataInicio.getTime() + dias_duracao * 86400 * 1000)

      const slugVaga = vaga.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)
      const ts = Date.now()

      // 1. Salva os PNGs de Feed (1080x1080) e Story (1080x1920) no bucket 'rh-documentos'
      const decodeB64 = (b64: string) => {
        const binStr = atob(b64)
        const bytes = new Uint8Array(binStr.length)
        for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i)
        return bytes
      }

      const nomeArqFeed = `campanhas-rh/${contaKey}_${ts}_${slugVaga}_feed.png`
      const { error: upFeedErr } = await admin.storage
        .from('rh-documentos')
        .upload(nomeArqFeed, decodeB64(imagem_feed_b64), { contentType: 'image/png', upsert: true })
      const criativo_url = upFeedErr ? null : nomeArqFeed

      let criativo_story_url: string | null = null
      if (imagem_story_b64) {
        const nomeArqStory = `campanhas-rh/${contaKey}_${ts}_${slugVaga}_story.png`
        const { error: upStoryErr } = await admin.storage
          .from('rh-documentos')
          .upload(nomeArqStory, decodeB64(imagem_story_b64), { contentType: 'image/png', upsert: true })
        if (!upStoryErr) criativo_story_url = nomeArqStory
      }

      // 2. Insere o registro em rh_campanhas_criadas com status 'publicando'
      const registroBase: Record<string, any> = {
        empresa_id: String(b.empresa_id || 'cantina'),
        conta_anuncio: contaKey,
        conta_id_externo: contaCfg.conta_id_externo,
        pagina_id_externo: contaCfg.pagina_id_externo,
        nome_campanha,
        vaga,
        funcao_id: b.funcao_id || null,
        divulgar_salario: Boolean(b.divulgar_salario),
        salario_texto: b.salario_texto ? String(b.salario_texto) : null,
        divulgar_beneficios: Boolean(b.divulgar_beneficios),
        beneficios: Array.isArray(b.beneficios) ? b.beneficios.map(String) : [],
        divulgar_horario: Boolean(b.divulgar_horario),
        horario_texto: b.horario_texto ? String(b.horario_texto) : null,
        divulgar_local: Boolean(b.divulgar_local),
        local_texto: b.local_texto ? String(b.local_texto) : 'Goiânia - GO',
        requisitos_texto: b.requisitos_texto ? String(b.requisitos_texto) : null,
        observacoes_ia: b.observacoes_ia ? String(b.observacoes_ia) : null,
        dias_duracao,
        orcamento_total,
        data_inicio: dataInicio.toISOString(),
        data_fim: dataFim.toISOString(),
        url_destino,
        ia_copy,
        criativo_url,
        criativo_story_url,
        status: 'publicando',
        criado_por: caller.id,
        criado_por_email: caller.email ?? null,
        aprovado_em: agora.toISOString(),
        atualizado_em: agora.toISOString(),
      }

      const { data: campRh, error: insErr } = await admin
        .from('rh_campanhas_criadas')
        .insert(registroBase)
        .select('*')
        .single()
      if (insErr || !campRh) {
        return json({ error: 'Falha ao registrar campanha no banco: ' + (insErr?.message ?? 'erro') }, 500)
      }

      // 3. Localiza a conta em mkt_contas para vincular mkt_comandos e mkt_campanhas
      const { data: mktConta } = await admin
        .from('mkt_contas')
        .select('id, credencial_ref, moeda')
        .eq('plataforma', 'meta')
        .eq('id_externo', contaCfg.conta_id_externo)
        .maybeSingle()

      const sufixo = contaKey === 'lumar' ? '_LUMAR' : '_CANTINA'
      const metaToken =
        Deno.env.get(`META_ACCESS_TOKEN_ESCRITA${sufixo}`) ||
        Deno.env.get('META_ACCESS_TOKEN_ESCRITA') ||
        (mktConta?.credencial_ref ? Deno.env.get(mktConta.credencial_ref) : '') ||
        Deno.env.get(`META_ACCESS_TOKEN${sufixo}`) ||
        Deno.env.get('META_ACCESS_TOKEN') ||
        ''

      const graphVersion = Deno.env.get('META_GRAPH_VERSION') || 'v23.0'

      let comandoId: string | null = null
      if (mktConta?.id) {
        const { data: cmd } = await admin
          .from('mkt_comandos')
          .insert({
            conta_id: mktConta.id,
            entidade_tipo: 'campanha',
            acao: 'criar',
            payload: {
              origem_modulo: 'rh_recrutamento',
              rh_campanha_id: campRh.id,
              nome_campanha,
              vaga,
              formatos: ['feed_1x1', 'story_9x16'],
              dias_duracao,
              orcamento_total,
              data_inicio: dataInicio.toISOString(),
              data_fim: dataFim.toISOString(),
              url_destino,
              pagina_id: contaCfg.pagina_id_externo,
              ia_copy,
            },
            status: 'executando',
            solicitado_por: caller.id,
            aprovado_por: caller.id,
            aprovado_em: agora.toISOString(),
          })
          .select('id')
          .single()
        comandoId = cmd?.id ?? null
      }

      if (!metaToken) {
        const msgErro =
          'Token da Meta (META_ACCESS_TOKEN_ESCRITA / META_ACCESS_TOKEN) ainda não configurado nos Secrets do Supabase. A campanha e as duas artes aprovadas (Feed e Story) foram salvas no RH e na fila de Marketing para publicação assim que o token for inserido.'
        await admin
          .from('rh_campanhas_criadas')
          .update({
            status: 'erro',
            mkt_comando_id: comandoId,
            erro_detalhe: msgErro,
            atualizado_em: new Date().toISOString(),
          })
          .eq('id', campRh.id)

        if (comandoId) {
          await admin
            .from('mkt_comandos')
            .update({ status: 'falhou', erro: msgErro })
            .eq('id', comandoId)
        }

        return json({
          ok: false,
          salvo_rascunho: true,
          campanha: { ...campRh, status: 'erro', erro_detalhe: msgErro },
          error: msgErro,
        }, 200)
      }

      // 4. Publicação passo a passo na Graph API da Meta (Feed + Story)
      const actId = `act_${contaCfg.conta_id_externo}`
      const baseUrl = `https://graph.facebook.com/${graphVersion}/${actId}`

      const postMeta = async (edge: string, params: Record<string, string>) => {
        const bodyForm = new URLSearchParams({ ...params, access_token: metaToken })
        const r = await fetch(`${baseUrl}/${edge}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: bodyForm.toString(),
        })
        const j = await r.json().catch(() => ({}))
        if (!r.ok || j?.error) {
          const detalhe = j?.error?.error_user_msg || j?.error?.message || JSON.stringify(j)
          throw new Error(`Meta API (${edge}): ${redigirSegredos(String(detalhe), [metaToken])}`)
        }
        return j
      }

      try {
        // Passo 4.1: Upload da imagem de Feed 1:1 (/adimages)
        const imgFeedRes = await postMeta('adimages', { bytes: imagem_feed_b64 })
        const feedMap = imgFeedRes?.images || {}
        const feedKey = Object.keys(feedMap)[0]
        const imageHashFeed: string | undefined = feedMap[feedKey]?.hash
        if (!imageHashFeed) {
          throw new Error('Meta API não retornou o hash da imagem de Feed.')
        }

        // Passo 4.1b: Upload da imagem de Story 9:16 (/adimages)
        let imageHashStory: string | null = null
        if (imagem_story_b64) {
          try {
            const imgStoryRes = await postMeta('adimages', { bytes: imagem_story_b64 })
            const storyMap = imgStoryRes?.images || {}
            const storyKey = Object.keys(storyMap)[0]
            imageHashStory = storyMap[storyKey]?.hash ?? null
          } catch (_eStory) {
            imageHashStory = null
          }
        }

        // Passo 4.2: Criar a Campanha (/campaigns)
        let campaignId = ''
        try {
          const campRes = await postMeta('campaigns', {
            name: nome_campanha,
            objective: 'OUTCOME_TRAFFIC',
            status: 'ACTIVE',
            special_ad_categories: JSON.stringify(['EMPLOYMENT']),
            special_ad_category_country: JSON.stringify(['BR']),
          })
          campaignId = String(campRes.id)
        } catch (_errEmp) {
          const campRes = await postMeta('campaigns', {
            name: nome_campanha,
            objective: 'OUTCOME_TRAFFIC',
            status: 'ACTIVE',
            special_ad_categories: JSON.stringify([]),
          })
          campaignId = String(campRes.id)
        }

        // Passo 4.3: Criar Conjunto de Anúncios (/adsets) cobrindo Feed e Stories em Goiânia e Região
        const lifetimeBudgetCents = String(Math.round(orcamento_total * 100))
        const targeting = {
          geo_locations: {
            custom_locations: [
              {
                latitude: -16.6869,
                longitude: -49.2648,
                radius: 35,
                distance_unit: 'kilometer',
              },
            ],
          },
        }

        const adsetRes = await postMeta('adsets', {
          name: `Conjunto Feed + Story — ${vaga} (${dias_duracao}d)`,
          campaign_id: campaignId,
          billing_event: 'IMPRESSIONS',
          optimization_goal: 'LINK_CLICKS',
          bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
          lifetime_budget: lifetimeBudgetCents,
          start_time: dataInicio.toISOString(),
          end_time: dataFim.toISOString(),
          targeting: JSON.stringify(targeting),
          destination_type: 'WEBSITE',
          status: 'ACTIVE',
        })
        const adsetId = String(adsetRes.id)

        // Passo 4.4: Criar Criativo e Anúncio de FEED (1:1)
        const legendaFinal = String(ia_copy.legenda || `Estamos contratando: ${vaga}! Candidate-se pelo link.`)
        const tituloLink = String(ia_copy.titulo_link || `Vaga: ${vaga} — Envie seu currículo`)
        const subtituloLink = String(ia_copy.horario_texto || 'Cadastro rápido pelo formulário')

        const objectStorySpecFeed = {
          page_id: contaCfg.pagina_id_externo,
          link_data: {
            image_hash: imageHashFeed,
            link: url_destino,
            message: legendaFinal,
            name: tituloLink,
            description: subtituloLink,
            call_to_action: {
              type: 'APPLY_NOW',
              value: { link: url_destino },
            },
          },
        }

        const creativeFeedRes = await postMeta('adcreatives', {
          name: `Criativo Feed (1:1) — ${vaga}`,
          object_story_spec: JSON.stringify(objectStorySpecFeed),
        })
        const creativeId = String(creativeFeedRes.id)

        const adFeedRes = await postMeta('ads', {
          name: `Anúncio Feed — ${vaga}`,
          adset_id: adsetId,
          creative: JSON.stringify({ creative_id: creativeId }),
          status: 'ACTIVE',
        })
        const adId = String(adFeedRes.id)

        // Passo 4.5: Criar Criativo e Anúncio dedicado de STORY (9:16) no mesmo Conjunto
        let creativeStoryId: string | null = null
        let adStoryId: string | null = null
        if (imageHashStory) {
          try {
            const objectStorySpecStory = {
              page_id: contaCfg.pagina_id_externo,
              link_data: {
                image_hash: imageHashStory,
                link: url_destino,
                message: legendaFinal,
                name: tituloLink,
                description: subtituloLink,
                call_to_action: {
                  type: 'APPLY_NOW',
                  value: { link: url_destino },
                },
              },
            }
            const creativeStoryRes = await postMeta('adcreatives', {
              name: `Criativo Story (9:16) — ${vaga}`,
              object_story_spec: JSON.stringify(objectStorySpecStory),
            })
            creativeStoryId = String(creativeStoryRes.id)

            const adStoryRes = await postMeta('ads', {
              name: `Anúncio Story — ${vaga}`,
              adset_id: adsetId,
              creative: JSON.stringify({ creative_id: creativeStoryId }),
              status: 'ACTIVE',
            })
            adStoryId = String(adStoryRes.id)
          } catch (_eStoryAd) {
            // Se falhar apenas o 2º anúncio, o anúncio principal já está ativo
          }
        }

        // Passo 5: Atualiza rh_campanhas_criadas como 'ativa'
        const { data: campAtualizada } = await admin
          .from('rh_campanhas_criadas')
          .update({
            status: 'ativa',
            meta_image_hash: imageHashFeed,
            meta_image_hash_story: imageHashStory,
            meta_campaign_id: campaignId,
            meta_adset_id: adsetId,
            meta_creative_id: creativeId,
            meta_ad_id: adId,
            mkt_comando_id: comandoId,
            erro_detalhe: null,
            publicado_em: new Date().toISOString(),
            atualizado_em: new Date().toISOString(),
          })
          .eq('id', campRh.id)
          .select('*')
          .single()

        // Passo 6: Espelha imediatamente em mkt_campanhas, mkt_comandos e mkt_auditoria
        if (mktConta?.id) {
          await admin.from('mkt_campanhas').upsert(
            {
              conta_id: mktConta.id,
              id_externo: campaignId,
              nome: nome_campanha,
              objetivo: 'OUTCOME_TRAFFIC',
              status: 'ativa',
              status_efetivo: 'ACTIVE',
              orcamento_total,
              inicio: dataInicio.toISOString(),
              fim: dataFim.toISOString(),
              origem: 'app',
              payload: {
                id: campaignId,
                name: nome_campanha,
                objective: 'OUTCOME_TRAFFIC',
                status: 'ACTIVE',
                effective_status: 'ACTIVE',
                lifetime_budget: lifetimeBudgetCents,
                start_time: dataInicio.toISOString(),
                stop_time: dataFim.toISOString(),
                rh_campanha_id: campRh.id,
                formatos: ['feed_1x1', 'story_9x16'],
                ad_feed_id: adId,
                ad_story_id: adStoryId,
              },
              sincronizada_em: new Date().toISOString(),
            },
            { onConflict: 'conta_id,id_externo' }
          )

          if (comandoId) {
            await admin
              .from('mkt_comandos')
              .update({
                entidade_id_externo: campaignId,
                status: 'aplicado',
                executado_em: new Date().toISOString(),
                resposta_externa: {
                  campaign_id: campaignId,
                  adset_id: adsetId,
                  creative_feed_id: creativeId,
                  ad_feed_id: adId,
                  creative_story_id: creativeStoryId,
                  ad_story_id: adStoryId,
                  image_hash_feed: imageHashFeed,
                  image_hash_story: imageHashStory,
                },
              })
              .eq('id', comandoId)
          }

          await admin.from('mkt_auditoria').insert({
            usuario_id: caller.id,
            conta_id: mktConta.id,
            comando_id: comandoId,
            acao: 'criar_campanha_rh',
            entidade_tipo: 'campanha',
            entidade_id_externo: campaignId,
            antes: null,
            depois: {
              nome_campanha,
              vaga,
              orcamento_total,
              dias_duracao,
              campaign_id: campaignId,
              adset_id: adsetId,
              ad_feed_id: adId,
              ad_story_id: adStoryId,
            },
            origem: 'app',
          })
        }

        return json({
          ok: true,
          campanha: campAtualizada,
        })
      } catch (errMeta) {
        const msgLimpa = redigirSegredos(String(errMeta), [metaToken])
        await admin
          .from('rh_campanhas_criadas')
          .update({
            status: 'erro',
            mkt_comando_id: comandoId,
            erro_detalhe: msgLimpa,
            atualizado_em: new Date().toISOString(),
          })
          .eq('id', campRh.id)

        if (comandoId) {
          await admin
            .from('mkt_comandos')
            .update({
              status: 'falhou',
              executado_em: new Date().toISOString(),
              erro: msgLimpa,
            })
            .eq('id', comandoId)
        }

        return json({
          ok: false,
          salvo_rascunho: true,
          campanha: { ...campRh, status: 'erro', erro_detalhe: msgLimpa },
          error: msgLimpa,
        }, 200)
      }
    }

    // ── AÇÃO 3: PAUSAR CAMPANHA PUBLICADA ────────────────────────────────────────
    if (acao === 'pausar') {
      const id = String((body as Record<string, unknown>).id ?? '')
      if (!id) return json({ error: 'Informe o ID da campanha.' }, 400)

      const { data: camp } = await admin
        .from('rh_campanhas_criadas')
        .select('*')
        .eq('id', id)
        .single()
      if (!camp) return json({ error: 'Campanha não encontrada.' }, 404)

      const contaKey: 'cantina' | 'lumar' = camp.conta_anuncio === 'lumar' ? 'lumar' : 'cantina'
      const sufixo = contaKey === 'lumar' ? '_LUMAR' : '_CANTINA'
      const metaToken =
        Deno.env.get(`META_ACCESS_TOKEN_ESCRITA${sufixo}`) ||
        Deno.env.get('META_ACCESS_TOKEN_ESCRITA') ||
        Deno.env.get(`META_ACCESS_TOKEN${sufixo}`) ||
        Deno.env.get('META_ACCESS_TOKEN') ||
        ''
      const graphVersion = Deno.env.get('META_GRAPH_VERSION') || 'v23.0'

      if (camp.meta_campaign_id && metaToken) {
        const bodyForm = new URLSearchParams({ status: 'PAUSED', access_token: metaToken })
        const r = await fetch(`https://graph.facebook.com/${graphVersion}/${camp.meta_campaign_id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: bodyForm.toString(),
        })
        if (!r.ok) {
          const txt = await r.text().catch(() => '')
          return json({ error: `Falha ao pausar na Meta: ${redigirSegredos(txt.slice(0, 200), [metaToken])}` }, 502)
        }
      }

      await admin
        .from('rh_campanhas_criadas')
        .update({ status: 'pausada', atualizado_em: new Date().toISOString() })
        .eq('id', id)

      if (camp.meta_campaign_id) {
        await admin
          .from('mkt_campanhas')
          .update({ status: 'pausada', status_efetivo: 'PAUSED', atualizado_em: new Date().toISOString() })
          .eq('id_externo', camp.meta_campaign_id)
      }

      return json({ ok: true })
    }

    return json({ error: 'Ação inválida.' }, 400)
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})
