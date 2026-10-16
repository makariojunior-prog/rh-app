-- Auditoria 2026-10-16 — endurecimento de RLS/grants do RH. Idempotente; só objetos do RH.
--
-- Corrige:
--  1. Tabelas do RH com política `true` para qualquer `authenticated` — no Supabase
--     compartilhado isso inclui usuários do CRM, Compras, Loja, Financeiro etc.
--  2. `perfis`: qualquer membro do RH podia alterar o próprio papel/páginas (virar admin)
--     e o perfil dos outros.
--  3. Acesso revogado no Portal (role='usuario' + paginas=[]) continuava valendo no banco,
--     porque rh_is_member() só checava a existência da linha em perfis.
--  4. Buckets exames-aso (ASO) e rh-documentos legíveis por qualquer `authenticated`.
--  5. TRUNCATE/TRIGGER/REFERENCES para anon/authenticated (TRUNCATE ignora RLS) e
--     grants de escrita para anon além do que o site de vagas usa.

-- ── Funções auxiliares ──────────────────────────────────────────────────────
create or replace function public.rh_is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.perfis
     where id = (select auth.uid())
       and (role = 'admin' or coalesce(cardinality(paginas), 0) > 0)
  );
$$;

create or replace function public.rh_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis where id = (select auth.uid()) and role = 'admin');
$$;

revoke execute on function public.rh_is_member() from public, anon;
revoke execute on function public.rh_is_admin()  from public, anon;
grant  execute on function public.rh_is_member() to authenticated;
grant  execute on function public.rh_is_admin()  to authenticated;

-- Campanhas: mesma regra de membro (perfil revogado deixa de ver).
create or replace function public.rh_campanhas_recrutamento(p_empresa text default null)
returns table(id uuid, nome text, plataforma text, inicio timestamptz, fim timestamptz, dias_restantes integer, alcance numeric)
language sql stable security definer set search_path = public as $$
  select
    c.id, c.nome, ct.plataforma, c.inicio, c.fim,
    case when c.fim is null then null
         else ((c.fim at time zone 'America/Sao_Paulo')::date
               - (now() at time zone 'America/Sao_Paulo')::date)
    end as dias_restantes,
    nullif(c.resumo_30d->>'alcance','')::numeric as alcance
  from public.mkt_campanhas c
  join public.mkt_contas ct on ct.id = c.conta_id
  where public.rh_is_member()
    and (p_empresa is null or ct.empresa_id = p_empresa)
    and c.status_efetivo = 'ACTIVE'
    and (c.fim is null or c.fim >= now())
    and c.nome ~* '(vaga|emprego|recrut|curr[ií]culo|contrata|candidat)'
  order by c.fim nulls last, c.nome;
$$;

-- ── perfis: cada um lê/edita o próprio (sem mexer em papel/páginas); admin gerencia ──
drop policy if exists acesso_total_autenticado on public.perfis;
drop policy if exists perfis_select on public.perfis;
drop policy if exists perfis_update on public.perfis;
drop policy if exists perfis_insert on public.perfis;
drop policy if exists perfis_delete on public.perfis;
create policy perfis_select on public.perfis for select to authenticated
  using (id = (select auth.uid()) or (select public.rh_is_admin()));
create policy perfis_update on public.perfis for update to authenticated
  using (id = (select auth.uid()) or (select public.rh_is_admin()))
  with check (id = (select auth.uid()) or (select public.rh_is_admin()));
create policy perfis_insert on public.perfis for insert to authenticated
  with check ((select public.rh_is_admin()));
create policy perfis_delete on public.perfis for delete to authenticated
  using ((select public.rh_is_admin()));

create or replace function public.rh_perfis_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- service_role / Portal / SQL direto não têm auth.uid(): passam.
  if (select auth.uid()) is null or (select auth.role()) = 'service_role' or public.rh_is_admin() then
    return new;
  end if;
  if (new.id, new.role, new.paginas, new.empresa_id, new.email)
     is distinct from (old.id, old.role, old.paginas, old.empresa_id, old.email) then
    raise exception 'Somente administradores do RH podem alterar papel, páginas, empresa ou email';
  end if;
  return new;
end $$;
revoke execute on function public.rh_perfis_guard() from public, anon, authenticated;
drop trigger if exists rh_perfis_guard on public.perfis;
create trigger rh_perfis_guard before update on public.perfis
  for each row execute function public.rh_perfis_guard();

-- ── Tabelas com `true`: passam a exigir membro do RH ───────────────────────
drop policy if exists acesso_empresa on public.adiantamentos;
drop policy if exists rh_member_all on public.adiantamentos;
create policy rh_member_all on public.adiantamentos for all to authenticated
  using ((select public.rh_is_member())) with check ((select public.rh_is_member()));

drop policy if exists "Allow all adiantamentos_fixos" on public.adiantamentos_fixos;
drop policy if exists rh_member_all on public.adiantamentos_fixos;
create policy rh_member_all on public.adiantamentos_fixos for all to authenticated
  using ((select public.rh_is_member())) with check ((select public.rh_is_member()));

drop policy if exists acesso_empresa on public.candidatos;
drop policy if exists rh_member_all on public.candidatos;
create policy rh_member_all on public.candidatos for all to authenticated
  using ((select public.rh_is_member())) with check ((select public.rh_is_member()));
-- vagas_anon_insert (anon INSERT) é mantida: site público de vagas.

drop policy if exists "authenticated full access colaborador_documentos" on public.colaborador_documentos;
drop policy if exists rh_member_all on public.colaborador_documentos;
create policy rh_member_all on public.colaborador_documentos for all to authenticated
  using ((select public.rh_is_member())) with check ((select public.rh_is_member()));

drop policy if exists compras_all on public.compras;
drop policy if exists rh_member_all on public.compras;
create policy rh_member_all on public.compras for all to authenticated
  using ((select public.rh_is_member())) with check ((select public.rh_is_member()));

drop policy if exists "authenticated full access compras_alertas" on public.compras_alertas;
drop policy if exists rh_member_all on public.compras_alertas;
create policy rh_member_all on public.compras_alertas for all to authenticated
  using ((select public.rh_is_member())) with check ((select public.rh_is_member()));

drop policy if exists acesso_empresa on public.entrevistas;
drop policy if exists rh_member_all on public.entrevistas;
create policy rh_member_all on public.entrevistas for all to authenticated
  using ((select public.rh_is_member())) with check ((select public.rh_is_member()));

drop policy if exists "authenticated full access tipos_documento_colab" on public.tipos_documento_colab;
drop policy if exists rh_member_all on public.tipos_documento_colab;
create policy rh_member_all on public.tipos_documento_colab for all to authenticated
  using ((select public.rh_is_member())) with check ((select public.rh_is_member()));

drop policy if exists auth_all_formulario_config on public.formulario_config;
drop policy if exists rh_member_all on public.formulario_config;
create policy rh_member_all on public.formulario_config for all to authenticated
  using ((select public.rh_is_member())) with check ((select public.rh_is_member()));
-- anon_select_formulario_config (anon SELECT) é mantida: site público de vagas.

-- colaboradores/ferias: FOR ALL sem WITH CHECK explícito (herda o USING) — explicita.
drop policy if exists acesso_total_colaboradores on public.colaboradores;
drop policy if exists rh_member_all on public.colaboradores;
create policy rh_member_all on public.colaboradores for all to authenticated
  using ((select public.rh_is_member())) with check ((select public.rh_is_member()));
drop policy if exists acesso_total_ferias on public.ferias;
drop policy if exists rh_member_all on public.ferias;
create policy rh_member_all on public.ferias for all to authenticated
  using ((select public.rh_is_member())) with check ((select public.rh_is_member()));

-- ── Storage: ASO e documentos do RH só para membros do RH ─────────────────
drop policy if exists aso_authenticated_read   on storage.objects;
drop policy if exists aso_authenticated_write  on storage.objects;
drop policy if exists aso_authenticated_update on storage.objects;
drop policy if exists aso_authenticated_delete on storage.objects;
create policy aso_authenticated_read on storage.objects for select to authenticated
  using (bucket_id = 'exames-aso' and (select public.rh_is_member()));
create policy aso_authenticated_write on storage.objects for insert to authenticated
  with check (bucket_id = 'exames-aso' and (select public.rh_is_member()));
create policy aso_authenticated_update on storage.objects for update to authenticated
  using (bucket_id = 'exames-aso' and (select public.rh_is_member()));
create policy aso_authenticated_delete on storage.objects for delete to authenticated
  using (bucket_id = 'exames-aso' and (select public.rh_is_member()));

drop policy if exists rhdoc_authenticated_read   on storage.objects;
drop policy if exists rhdoc_authenticated_write  on storage.objects;
drop policy if exists rhdoc_authenticated_update on storage.objects;
drop policy if exists rhdoc_authenticated_delete on storage.objects;
create policy rhdoc_authenticated_read on storage.objects for select to authenticated
  using (bucket_id = 'rh-documentos' and (select public.rh_is_member()));
create policy rhdoc_authenticated_write on storage.objects for insert to authenticated
  with check (bucket_id = 'rh-documentos' and (select public.rh_is_member()));
create policy rhdoc_authenticated_update on storage.objects for update to authenticated
  using (bucket_id = 'rh-documentos' and (select public.rh_is_member()));
create policy rhdoc_authenticated_delete on storage.objects for delete to authenticated
  using (bucket_id = 'rh-documentos' and (select public.rh_is_member()));

-- ── Grants ─────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'adiantamentos','adiantamentos_fixos','atestados','candidatos','colaborador_documentos',
    'colaborador_exames','colaborador_termos','colaborador_termos_historico','colaboradores',
    'comissoes_mensais','compras','compras_alertas','entrevistas','exames_agendamentos',
    'exames_kit_funcao','ferias','folha_mensal','formulario_config','funcoes',
    'gratificacao_colaborador','gratificacao_niveis','historico_salario','logs',
    'normas_destaques','normas_sst','perfis','procedimentos_exame','registros_ponto',
    'termos_assinatura','tipo_exame_procedimentos','tipos_documento_colab','tipos_exame']
  loop
    execute format('revoke truncate, trigger, references on public.%I from anon, authenticated', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;
-- Únicos acessos sem login: site de vagas (lê a config e grava a inscrição).
grant select on public.formulario_config to anon;
grant insert on public.candidatos to anon;
