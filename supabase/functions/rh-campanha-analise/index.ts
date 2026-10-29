// deno-lint-ignore-file no-explicit-any
import { createClient } from 'jsr:@supabase/supabase-js@2'

/**
 * Edge Function: rh-campanha-analise
 *
 * Analisa o desempenho das campanhas de recrutamento publicadas pelo RH na Meta:
 *   1. junta o que a sincronização do Marketing já grava (mkt_insights_dia) com as candidaturas
 *      que chegaram pelas UTMs (candidatos.utm_id = id da campanha na Meta);
 *   2. aplica regras fixas (limites em LIMITES) e gera os "achados";
 *   3. pede à IA (Gemini) um resumo em português e até 4 ações, usando só os números calculados;
 *   4. grava em rh_campanha_analises.
 *
 * Ações (body.acao):
 *   - 'analisar'        -> { id } uma campanha; exige login de membro do RH com acesso a Recrutamento.
 *   - 'analisar_todas'  -> todas as campanhas ativas; só com o header x-cron-secret (cron diário).
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

// Limites das regras. São referências de mercado para anúncio de vaga local; ajuste conforme o histórico real.
const LIMITES = {
  min_impressoes: 1000,      // abaixo disso é cedo para julgar
  ctr_baixo: 0.8,            // % de cliques no link sobre impressões
  cpc_alto: 3.0,             // R$ por clique no link
  frequencia_alta: 2.5,      // impressões por pessoa/dia (média), só depois de 3 dias
  funil_min_cliques: 50,     // cliques mínimos para julgar a conversão do formulário
  funil_taxa_baixa: 5,       // % de cliques que viram candidatura
  pacing_baixo: 0.5,         // gasto / gasto esperado até hoje
  pacing_alto: 1.3,
  comparativo_razao: 2,      // um formato com CTR 2x o do outro
  comparativo_min_impressoes: 500,
}

const num = (v: unknown) => Number(v) || 0
const r2 = (v: number) => Math.round(v * 100) / 100

type Achado = { codigo: string; severidade: 'critico' | 'aviso' | 'info' | 'ok'; titulo: string; detalhe: string; sugestao?: string }

async function coletarMetricas(admin: any, camp: any) {
  const inicio = new Date(camp.data_inicio || camp.publicado_em)
  const fim = new Date(camp.data_fim)
  const agora = new Date()
  const diasTotal = Math.max(1, num(camp.dias_duracao))
  const diasDecorridos = Math.max(0, (Math.min(agora.getTime(), fim.getTime()) - inicio.getTime()) / 86400000)
  const inicioData = new Date(camp.publicado_em || camp.data_inicio).toISOString().slice(0, 10)

  const { data: mc } = await admin.from('mkt_campanhas').select('id, status_efetivo').eq('id_externo', camp.meta_campaign_id).maybeSingle()
  const { data: ads } = mc
    ? await admin.from('mkt_anuncios').select('id_externo, nome, status_efetivo').eq('campanha_id', mc.id)
    : { data: [] }
  const { data: diasCamp } = await admin.from('mkt_insights_dia')
    .select('data, impressoes, alcance, cliques, cliques_link, gasto')
    .eq('nivel', 'campanha').eq('id_externo', camp.meta_campaign_id).gte('data', inicioData).order('data')
  const adIds = (ads ?? []).map((a: any) => a.id_externo)
  const { data: diasAd } = adIds.length
    ? await admin.from('mkt_insights_dia').select('id_externo, impressoes, cliques, cliques_link, gasto').eq('nivel', 'anuncio').in('id_externo', adIds).gte('data', inicioData)
    : { data: [] }
  const { data: cands } = await admin.from('candidatos').select('id, utm_content').eq('utm_id', camp.meta_campaign_id)

  const soma = (rows: any[], k: string) => (rows ?? []).reduce((s, r) => s + num(r[k]), 0)
  const impressoes = soma(diasCamp, 'impressoes')
  const alcanceSomaDiaria = soma(diasCamp, 'alcance')
  const cliquesLink = soma(diasCamp, 'cliques_link') || soma(diasCamp, 'cliques')
  const gasto = soma(diasCamp, 'gasto')
  const candidatos = (cands ?? []).length
  const orcamento = num(camp.orcamento_total)
  const gastoEsperado = orcamento * Math.min(1, diasDecorridos / diasTotal)

  const formatos: Record<string, any> = {}
  for (const a of ads ?? []) {
    const f = /story/i.test(a.nome) ? 'story' : /feed/i.test(a.nome) ? 'feed' : a.nome
    const linhas = (diasAd ?? []).filter((d: any) => d.id_externo === a.id_externo)
    const imp = soma(linhas, 'impressoes')
    const cl = soma(linhas, 'cliques_link') || soma(linhas, 'cliques')
    formatos[f] = {
      status: a.status_efetivo,
      impressoes: imp,
      cliques_link: cl,
      gasto: r2(soma(linhas, 'gasto')),
      ctr: imp ? r2((cl / imp) * 100) : null,
      candidatos: (cands ?? []).filter((c: any) => c.utm_content === f).length,
    }
  }

  return {
    dias_decorridos: r2(diasDecorridos),
    dias_total: diasTotal,
    orcamento_total: orcamento,
    gasto: r2(gasto),
    gasto_esperado_ate_hoje: r2(gastoEsperado),
    impressoes,
    cliques_link: cliquesLink,
    ctr: impressoes ? r2((cliquesLink / impressoes) * 100) : null,
    cpc: cliquesLink ? r2(gasto / cliquesLink) : null,
    // média por pessoa/dia: a soma do alcance diário repete quem apareceu em mais de um dia
    frequencia_media_diaria: alcanceSomaDiaria ? r2(impressoes / alcanceSomaDiaria) : null,
    candidatos,
    taxa_candidatura: cliquesLink ? r2((candidatos / cliquesLink) * 100) : null,
    custo_por_candidato: candidatos ? r2(gasto / candidatos) : null,
    formatos,
    status_meta: mc?.status_efetivo ?? null,
    dias_com_dados: (diasCamp ?? []).length,
  }
}

function aplicarRegras(m: any): Achado[] {
  const L = LIMITES
  const achados: Achado[] = []

  if (m.impressoes < L.min_impressoes) {
    achados.push({
      codigo: 'dados_insuficientes', severidade: 'info',
      titulo: 'Ainda é cedo para julgar',
      detalhe: `Foram ${m.impressoes} impressões até agora; as regras só avaliam a partir de ${L.min_impressoes}. Os dados da Meta chegam com algumas horas de atraso.`,
    })
    return achados
  }

  if (m.gasto_esperado_ate_hoje > 0) {
    const ritmo = m.gasto / m.gasto_esperado_ate_hoje
    if (m.dias_decorridos >= 1 && ritmo < L.pacing_baixo) {
      achados.push({
        codigo: 'gasto_abaixo', severidade: 'aviso', titulo: 'Gastando bem menos que o previsto',
        detalhe: `Gasto de R$ ${m.gasto} contra R$ ${m.gasto_esperado_ate_hoje} esperados até hoje (${Math.round(ritmo * 100)}%).`,
        sugestao: 'Público muito restrito ou anúncio com pouca competitividade. Considere ampliar o raio de Goiânia ou revisar a arte.',
      })
    } else if (ritmo > L.pacing_alto) {
      achados.push({
        codigo: 'gasto_acima', severidade: 'info', titulo: 'Gastando acima do ritmo',
        detalhe: `Gasto de R$ ${m.gasto} contra R$ ${m.gasto_esperado_ate_hoje} esperados até hoje. A Meta pode gastar mais em dias bons, mas o total do período é limitado ao orçamento.`,
      })
    }
  }

  if (m.ctr !== null && m.ctr < L.ctr_baixo) {
    achados.push({
      codigo: 'ctr_baixo', severidade: 'aviso', titulo: 'Poucos cliques no anúncio',
      detalhe: `Taxa de cliques no link de ${m.ctr}% (referência: acima de ${L.ctr_baixo}%).`,
      sugestao: 'A arte ou o título não está chamando atenção. Teste outro título, destaque o salário na arte ou troque a foto da função.',
    })
  }

  if (m.cpc !== null && m.cpc > L.cpc_alto) {
    achados.push({
      codigo: 'cpc_alto', severidade: 'aviso', titulo: 'Clique mais caro que o esperado',
      detalhe: `Cada clique no link está custando R$ ${m.cpc} (referência: até R$ ${L.cpc_alto.toFixed(2)}).`,
      sugestao: 'Costuma melhorar com anúncio mais atrativo (mais cliques) e público mais amplo.',
    })
  }

  if (m.dias_decorridos >= 3 && m.frequencia_media_diaria !== null && m.frequencia_media_diaria > L.frequencia_alta) {
    achados.push({
      codigo: 'frequencia_alta', severidade: 'aviso', titulo: 'As mesmas pessoas estão vendo o anúncio demais',
      detalhe: `Cada pessoa viu o anúncio em média ${m.frequencia_media_diaria} vezes por dia.`,
      sugestao: 'Público pequeno para o orçamento. Amplie o raio ou troque a arte para renovar o interesse.',
    })
  }

  if (m.cliques_link >= L.funil_min_cliques && m.taxa_candidatura !== null && m.taxa_candidatura < L.funil_taxa_baixa) {
    achados.push({
      codigo: 'funil_fraco', severidade: m.candidatos === 0 ? 'critico' : 'aviso',
      titulo: m.candidatos === 0 ? 'Há cliques, mas nenhuma candidatura' : 'Poucos cliques viram candidatura',
      detalhe: `${m.cliques_link} cliques no link e ${m.candidatos} candidatura(s) com origem neste anúncio (${m.taxa_candidatura}%).`,
      sugestao: 'Confira se o formulário abre e envia bem no celular, e se a vaga certa vem selecionada. Só entram na conta as candidaturas feitas pelo link do anúncio.',
    })
  }

  const f = m.formatos ?? {}
  if (f.feed && f.story && f.feed.impressoes >= L.comparativo_min_impressoes && f.story.impressoes >= L.comparativo_min_impressoes && f.feed.ctr && f.story.ctr) {
    const [melhor, pior] = f.feed.ctr >= f.story.ctr ? ['Feed', 'Story'] : ['Story', 'Feed']
    const ctrM = Math.max(f.feed.ctr, f.story.ctr), ctrP = Math.min(f.feed.ctr, f.story.ctr)
    if (ctrM >= ctrP * L.comparativo_razao) {
      achados.push({
        codigo: 'formato_desigual', severidade: 'info', titulo: `${melhor} rende bem mais cliques que ${pior}`,
        detalhe: `Taxa de cliques de ${ctrM}% no ${melhor} contra ${ctrP}% no ${pior}.`,
        sugestao: `Vale refazer a arte do ${pior} (ou pausar esse anúncio) para concentrar o orçamento no ${melhor}.`,
      })
    }
  }

  if (achados.length === 0) {
    achados.push({ codigo: 'saudavel', severidade: 'ok', titulo: 'Sem pontos de atenção', detalhe: 'Os indicadores estão dentro das referências usadas.' })
  }
  return achados
}

async function resumirComIA(geminiKey: string, camp: any, metricas: any, achados: Achado[]) {
  const prompt = [
    `Você é analista de marketing de recrutamento da ${camp.conta_anuncio === 'lumar' ? 'Lumar Alimentos' : 'Cantina em Casa'}, em Goiânia.`,
    `A campanha divulga a vaga "${camp.vaga}" no Instagram/Facebook. O objetivo é gerar candidaturas pelo formulário do site de vagas (o orçamento é pequeno, em reais).`,
    `Escreva para a pessoa do RH, em português simples e sem jargão.`,
    ``,
    `MÉTRICAS (calculadas, não invente outros números): ${JSON.stringify(metricas)}`,
    `ACHADOS DAS REGRAS: ${JSON.stringify(achados)}`,
    ``,
    `Regras: use SOMENTE os números acima; se houver poucos dados, diga que é cedo e recomende esperar em vez de mexer;`,
    `não sugira aumentar o orçamento se não há candidaturas; no máximo 4 ações, da mais importante para a menos; cada ação deve ser algo que o RH consiga fazer na tela de campanhas ou no Gerenciador de Anúncios.`,
    `"resumo": 2 a 4 frases com o estado geral e o principal ponto.`,
  ].join('\n')
  const schema = {
    type: 'object',
    properties: {
      resumo: { type: 'string' },
      acoes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            titulo: { type: 'string' },
            motivo: { type: 'string' },
            prioridade: { type: 'string', enum: ['alta', 'media', 'baixa'] },
          },
          required: ['titulo', 'motivo', 'prioridade'],
        },
      },
    },
    required: ['resumo', 'acoes'],
  }
  const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
    body: JSON.stringify({
      model: 'gemini-3.8-flash',
      input: prompt,
      store: false,
      response_format: [{ type: 'text', mime_type: 'application/json', schema }],
    }),
  })
  if (!resp.ok) throw new Error(`IA indisponível (${resp.status})`)
  const data = await resp.json()
  let texto: string | null = typeof data?.output_text === 'string' ? data.output_text : null
  if (!texto) {
    for (const step of data?.steps ?? []) {
      if (step?.type === 'model_output') for (const c of step.content ?? []) if (c?.type === 'text') texto = (texto ?? '') + c.text
    }
  }
  if (!texto) throw new Error('IA sem resposta')
  const p = JSON.parse(texto)
  return {
    resumo: String(p.resumo ?? '').slice(0, 800),
    acoes: (Array.isArray(p.acoes) ? p.acoes : []).slice(0, 4).map((a: any) => ({
      titulo: String(a.titulo ?? '').slice(0, 140),
      motivo: String(a.motivo ?? '').slice(0, 400),
      prioridade: ['alta', 'media', 'baixa'].includes(a.prioridade) ? a.prioridade : 'media',
    })),
  }
}

async function analisarCampanha(admin: any, camp: any, origem: 'manual' | 'automatica', geminiKey: string) {
  const metricas = await coletarMetricas(admin, camp)
  const achados = aplicarRegras(metricas)

  let resumo: string | null = null
  let acoes: any[] = []
  let usouIA = false
  if (geminiKey) {
    try {
      const r = await resumirComIA(geminiKey, camp, metricas, achados)
      resumo = r.resumo; acoes = r.acoes; usouIA = true
    } catch (_e) { /* cai para o texto das regras */ }
  }
  if (!resumo) {
    const principais = achados.filter((a) => a.severidade !== 'ok')
    resumo = principais.length ? principais.map((a) => a.titulo).join('. ') + '.' : 'Os indicadores estão dentro das referências.'
    acoes = achados.filter((a) => a.sugestao).slice(0, 4).map((a) => ({ titulo: a.titulo, motivo: a.sugestao, prioridade: a.severidade === 'critico' ? 'alta' : 'media' }))
  }

  const { data: nova, error } = await admin.from('rh_campanha_analises')
    .insert({ campanha_id: camp.id, origem, metricas, achados, resumo, acoes, usou_ia: usouIA })
    .select('*').single()
  if (error) throw new Error('Falha ao gravar a análise: ' + error.message)

  // Mantém só as 10 mais recentes por campanha
  const { data: antigas } = await admin.from('rh_campanha_analises')
    .select('id').eq('campanha_id', camp.id).order('gerada_em', { ascending: false }).range(10, 200)
  if (antigas?.length) await admin.from('rh_campanha_analises').delete().in('id', antigas.map((a: any) => a.id))
  return nova
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const admin = createClient(supabaseUrl, serviceKey)

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return json({ error: 'Corpo inválido.' }, 400)
    const acao = String((body as any).acao ?? '')

    const geminiKey =
      Deno.env.get('RH_GEMINI_API_KEY') ?? Deno.env.get('GEMINI_API_KEY') ?? Deno.env.get('GOOGLE_API_KEY') ??
      Deno.env.get('COMPRAS_WA_GEMINI_API_KEY') ?? ''

    const segredoCron = (Deno.env.get('MKT_CRON_SECRET') ?? '').trim()
    const cronOk = Boolean(segredoCron) && (req.headers.get('x-cron-secret') ?? '').trim() === segredoCron

    // Análise de todas as campanhas ativas: só o cron
    if (acao === 'analisar_todas') {
      if (!cronOk) return json({ error: 'Não autorizado.' }, 401)
      const { data: ativas } = await admin.from('rh_campanhas_criadas')
        .select('*').eq('status', 'ativa').not('meta_campaign_id', 'is', null)
        .gt('data_fim', new Date(Date.now() - 86400000).toISOString())
      let feitas = 0
      for (const c of ativas ?? []) {
        try { await analisarCampanha(admin, c, 'automatica', geminiKey); feitas++ } catch (_e) { /* segue para a próxima */ }
      }
      return json({ ok: true, analisadas: feitas })
    }

    // Análise de uma campanha: membro do RH com acesso a Recrutamento
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Não autenticado.' }, 401)
    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user: caller } } = await callerClient.auth.getUser()
    if (!caller) return json({ error: 'Sessão inválida. Faça login novamente.' }, 401)
    const { data: isMember } = await callerClient.rpc('rh_is_member')
    if (!isMember) return json({ error: 'Apenas membros autorizados do RH podem analisar campanhas.' }, 403)
    const { data: perfil } = await callerClient.from('perfis').select('role, paginas').eq('id', caller.id).maybeSingle()
    const podeRecrutamento = perfil?.role === 'admin' || (Array.isArray(perfil?.paginas) && perfil.paginas.includes('recrutamento'))
    if (!podeRecrutamento) return json({ error: 'Seu acesso não inclui o módulo de Recrutamento.' }, 403)

    if (acao === 'analisar') {
      const id = String((body as any).id ?? '')
      if (!id) return json({ error: 'Informe o ID da campanha.' }, 400)
      const { data: camp } = await admin.from('rh_campanhas_criadas').select('*').eq('id', id).maybeSingle()
      if (!camp) return json({ error: 'Campanha não encontrada.' }, 404)
      if (!camp.meta_campaign_id) return json({ error: 'Esta campanha não foi publicada na Meta; não há o que analisar.' }, 400)
      const analise = await analisarCampanha(admin, camp, 'manual', geminiKey)
      return json({ ok: true, analise })
    }

    return json({ error: 'Ação inválida.' }, 400)
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})
