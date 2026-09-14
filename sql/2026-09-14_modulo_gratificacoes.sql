-- =====================================================================
-- RH-App · Migração 2026-09-14 — Módulo de Gratificações por Nível
-- Catálogo de níveis de gratificação (valor incremental por nível; o
-- critério de cada nível ainda será definido pelo RH) e registro das
-- concessões por colaborador conforme cada um atinge os níveis. O valor
-- acumulado (ver exemplo de UI: Nível 1 = R$50, Nível 1+2 = R$150, ...)
-- é calculado somando os valores dos níveis concedidos — não é armazenado.
-- Aditiva e idempotente.
-- =====================================================================

create table if not exists public.gratificacao_niveis (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  ordem integer not null,
  nome text not null,
  criterio text,                     -- descrição da meta/critério do nível (a definir)
  valor numeric not null default 0,  -- valor incremental deste nível (não acumulado)
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  atualizado_em timestamptz
);
create unique index if not exists uq_gratificacao_nivel_ordem on public.gratificacao_niveis(empresa_id, ordem);
create index if not exists idx_gratificacao_niveis_empresa on public.gratificacao_niveis(empresa_id);

alter table public.gratificacao_niveis enable row level security;
do $pol$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='gratificacao_niveis') then
    create policy "authenticated full access gratificacao_niveis"
      on public.gratificacao_niveis for all to authenticated using (true) with check (true);
  end if;
end $pol$;

create table if not exists public.gratificacao_colaborador (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  colaborador_id uuid,
  colaborador_nome text not null,
  nivel_id uuid references public.gratificacao_niveis(id),
  nivel_ordem integer not null,      -- snapshot: sobrevive a alteração/remoção do nível
  nivel_nome text not null,          -- snapshot
  valor numeric not null,            -- snapshot do valor do nível na data da concessão
  data_conclusao date not null,
  status text not null default 'liberado',  -- 'liberado' | 'pago' | 'cancelado'
  obs text,
  created_at timestamptz not null default now()
);
create index if not exists idx_gratificacao_colab_empresa on public.gratificacao_colaborador(empresa_id);
create index if not exists idx_gratificacao_colab_nome on public.gratificacao_colaborador(empresa_id, colaborador_nome);

alter table public.gratificacao_colaborador enable row level security;
do $pol$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='gratificacao_colaborador') then
    create policy "authenticated full access gratificacao_colaborador"
      on public.gratificacao_colaborador for all to authenticated using (true) with check (true);
  end if;
end $pol$;
