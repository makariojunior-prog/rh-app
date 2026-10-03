-- =====================================================================
-- RH-App · Migração 2026-10-02 — Campanhas de recrutamento no Dashboard
-- O app de Marketing sincroniza as campanhas da Meta em public.mkt_campanhas,
-- mas a RLS dessas tabelas só libera quem é membro ativo de mkt_users.
-- Esta função (SECURITY DEFINER) expõe ao RH SOMENTE as campanhas ativas de
-- recrutamento (de todas as empresas, ou só da pedida), com campos mínimos, sem abrir as tabelas
-- de marketing. Aditiva e idempotente; não altera tabelas/policies do Marketing.
--
-- Identificação: campanha ativa (status_efetivo = ACTIVE), não encerrada, cujo
-- nome contenha vaga / emprego / recrut / currículo / contrata / candidat.
-- Convenção: nomear campanhas de RH como "[TRAFEGO] [FORMS] Vaga de Emprego".
-- =====================================================================

-- p_empresa é opcional: o recrutamento é centralizado (os candidatos do formulário
-- de vagas caem todos na empresa 'cantina'), mas a campanha pode estar na conta de
-- anúncios de qualquer empresa (ex.: Lumar). Sem p_empresa, traz todas.
create or replace function public.rh_campanhas_recrutamento(p_empresa text default null)
returns table (
  id uuid,
  nome text,
  plataforma text,
  inicio timestamptz,
  fim timestamptz,
  dias_restantes integer,
  alcance numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.nome,
    ct.plataforma,
    c.inicio,
    c.fim,
    case when c.fim is null then null
         else ((c.fim at time zone 'America/Sao_Paulo')::date
               - (now() at time zone 'America/Sao_Paulo')::date)
    end as dias_restantes,
    nullif(c.resumo_30d->>'alcance','')::numeric as alcance
  from public.mkt_campanhas c
  join public.mkt_contas ct on ct.id = c.conta_id
  where exists (select 1 from public.perfis p where p.id = auth.uid())
    and (p_empresa is null or ct.empresa_id = p_empresa)
    and c.status_efetivo = 'ACTIVE'
    and (c.fim is null or c.fim >= now())
    and c.nome ~* '(vaga|emprego|recrut|curr[ií]culo|contrata|candidat)'
  order by c.fim nulls last, c.nome;
$$;

revoke all on function public.rh_campanhas_recrutamento(text) from public, anon;
grant execute on function public.rh_campanhas_recrutamento(text) to authenticated;
