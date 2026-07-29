-- =====================================================================
-- RH-App · Migração 2026-07-22 (parte B) — Módulo de Cargos/Funções
-- Centraliza o cadastro de funções (hoje texto livre e inconsistente em
-- colaboradores.funcao). Aditiva e idempotente.
-- =====================================================================

create table if not exists public.funcoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  nome text not null,
  setor_padrao text,
  cbo_codigo text,
  cbo_titulo text,
  nivel text,                      -- 'operacional' | 'tecnico' | 'supervisao' | 'gerencia'
  descricao text,                  -- missão/resumo do cargo
  atribuicoes text,                -- uma atribuição por linha
  requisitos text,                 -- formação/experiência exigida
  faixa_salarial_min numeric,
  faixa_salarial_max numeric,
  periculosidade_padrao boolean not null default false,
  ativo boolean not null default true,
  ordem integer,
  created_at timestamptz not null default now(),
  atualizado_em timestamptz
);
create unique index if not exists uq_funcao_nome on public.funcoes(empresa_id, nome);
create index if not exists idx_funcoes_empresa on public.funcoes(empresa_id);

alter table public.funcoes enable row level security;
do $pol$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='funcoes') then
    create policy "authenticated full access funcoes"
      on public.funcoes for all to authenticated using (true) with check (true);
  end if;
end $pol$;

-- ── Normaliza o único duplicado exato encontrado hoje (mesma função, grafias
--    diferentes): "Atendente de Balcão" -> "ATENDENTE DE BALCÃO" (convenção
--    já dominante nos dados). Não mescla nomes apenas PARECIDOS (ex.:
--    "AUXILIAR DE PRODUÇÃO" vs "AUXILIAR DE PRODUÇÃO II") — podem ser cargos
--    distintos; use a ferramenta de mesclar do módulo se forem de fato iguais.
update public.colaboradores
set funcao = 'ATENDENTE DE BALCÃO'
where empresa_id='cantina' and funcao = 'Atendente de Balcão';

-- ── Semeia o catálogo com todas as funções já usadas hoje pelos colaboradores
--    (ativos e desligados, para não perder histórico), uma linha por nome
--    distinto e por empresa.
insert into public.funcoes (empresa_id, nome, ativo, ordem)
select empresa_id, funcao, true, row_number() over (partition by empresa_id order by funcao)
from (
  select distinct empresa_id, trim(funcao) as funcao
  from public.colaboradores
  where funcao is not null and trim(funcao) <> ''
) d
where not exists (
  select 1 from public.funcoes f where f.empresa_id = d.empresa_id and f.nome = d.funcao
);
