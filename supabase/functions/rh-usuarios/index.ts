import { createClient } from 'jsr:@supabase/supabase-js@2'

// Gerencia acessos do app de RH (tabela `perfis` + contas em auth.users).
// Só administradores autenticados podem chamar.
//
// Ações (body.acao):
//   'criar'   -> cria OU vincula a conta de login pelo email, (re)define a senha
//                informada e faz upsert do perfil. Resolve o caso "email já existe
//                no Auth mas foi removido de perfis".
//   'remover' -> apaga o perfil e, quando a conta não é usada pelo CRM, apaga
//                também a conta de login (evita contas órfãs).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Não autenticado.' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!

    // 1. Identifica o chamador e confirma que é admin
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: caller } } = await callerClient.auth.getUser()
    if (!caller) return json({ error: 'Sessão inválida.' }, 401)

    const { data: callerPerfil } = await callerClient
      .from('perfis').select('role, empresa_id').eq('id', caller.id).single()
    if (!callerPerfil || callerPerfil.role !== 'admin') {
      return json({ error: 'Apenas administradores podem gerenciar acessos.' }, 403)
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return json({ error: 'Corpo inválido.' }, 400)
    const acao = (body as Record<string, unknown>).acao

    const admin = createClient(supabaseUrl, serviceKey)

    // Localiza um usuário do Auth pelo email (varredura paginada — a base é pequena)
    const acharPorEmail = async (email: string): Promise<string | null> => {
      const perPage = 200
      for (let page = 1; page <= 50; page++) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
        if (error) throw new Error('Falha ao consultar usuários: ' + error.message)
        const users = data?.users ?? []
        const achado = users.find((u) => (u.email ?? '').toLowerCase() === email)
        if (achado) return achado.id
        if (users.length < perPage) return null
      }
      return null
    }

    // ---- CRIAR / VINCULAR ACESSO ----
    if (acao === 'criar') {
      const b = body as Record<string, unknown>
      const nome  = String(b.nome ?? '').trim()
      const email = String(b.email ?? '').trim().toLowerCase()
      const senha = String(b.senha ?? '')
      const role  = b.role === 'admin' ? 'admin' : 'usuario'
      const paginas = Array.isArray(b.paginas) && b.paginas.length ? b.paginas : ['dashboard']
      const empresa_id = String(b.empresa_id ?? callerPerfil.empresa_id ?? '')

      if (!nome || !email) return json({ error: 'Informe nome e email.' }, 400)
      if (!senha || senha.length < 6) return json({ error: 'A senha deve ter ao menos 6 caracteres.' }, 400)
      if (!empresa_id) return json({ error: 'Empresa não definida para este acesso.' }, 400)

      let userId: string | null = null
      let vinculado = false

      const { data: criado, error: criarErr } = await admin.auth.admin.createUser({
        email, password: senha, email_confirm: true,
      })

      if (criado?.user) {
        userId = criado.user.id
      } else {
        // Email provavelmente já existe no Auth — localiza e redefine a senha informada
        userId = await acharPorEmail(email)
        if (!userId) {
          return json({ error: 'Não foi possível criar nem localizar o usuário: ' + (criarErr?.message ?? 'erro desconhecido') }, 400)
        }
        vinculado = true
        const { error: senhaErr } = await admin.auth.admin.updateUserById(userId, { password: senha })
        if (senhaErr) return json({ error: 'Usuário localizado, mas falhou ao definir a senha: ' + senhaErr.message }, 400)
      }

      const { error: perfilErr } = await admin.from('perfis').upsert({
        id: userId, nome, email, empresa_id, role, paginas,
      }, { onConflict: 'id' })
      if (perfilErr) return json({ error: 'Conta pronta, mas falhou ao salvar o perfil: ' + perfilErr.message }, 400)

      return json({ ok: true, id: userId, vinculado })
    }

    // ---- REMOVER ACESSO ----
    if (acao === 'remover') {
      const id = String((body as Record<string, unknown>).id ?? '')
      if (!id) return json({ error: 'Informe o id do acesso.' }, 400)
      if (id === caller.id) return json({ error: 'Você não pode remover o seu próprio acesso.' }, 400)

      await admin.from('perfis').delete().eq('id', id)

      // Não apaga a conta de login se ela também for usada pelo app de CRM
      const { data: temCrm, error: crmErr } = await admin
        .from('crm_users').select('id').eq('id', id).maybeSingle()
      if (temCrm || crmErr) {
        return json({ ok: true, obs: 'Perfil removido. A conta de login foi mantida (também usada em outro sistema).' })
      }

      const { error: delErr } = await admin.auth.admin.deleteUser(id)
      if (delErr) {
        return json({ ok: true, obs: 'Perfil removido. A conta de login não pôde ser excluída: ' + delErr.message })
      }
      return json({ ok: true })
    }

    return json({ error: 'Ação inválida.' }, 400)
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})
