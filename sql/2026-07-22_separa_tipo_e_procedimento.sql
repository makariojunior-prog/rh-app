-- =====================================================================
-- RH-App · Migração 2026-07-22
-- Separa de verdade "Tipo de Exame" (ASO — Admissional, Periódico, Retorno
-- ao Trabalho, Mudança de Risco Ocupacional, Demissional) de "Procedimento"
-- (Glicose, ECG, Raio-X...). Cria associação N:N entre eles (um procedimento
-- pode compor vários tipos; um tipo tem vários procedimentos).
-- Aditiva e idempotente: pode rodar mais de uma vez com segurança.
-- =====================================================================

-- 1) Procedimento passa a ser um catálogo reutilizável — não pertence mais
--    a um único tipo. Relaxa a coluna antiga (deixa de ser obrigatória).
alter table public.procedimentos_exame alter column tipo_exame_id drop not null;

-- 2) Tabela de associação N:N entre tipos_exame e procedimentos_exame.
create table if not exists public.tipo_exame_procedimentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  tipo_exame_id text not null,
  procedimento_id text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists uq_tipo_procedimento on public.tipo_exame_procedimentos(tipo_exame_id, procedimento_id);
create index if not exists idx_tp_tipo on public.tipo_exame_procedimentos(tipo_exame_id);
create index if not exists idx_tp_proc on public.tipo_exame_procedimentos(procedimento_id);

alter table public.tipo_exame_procedimentos enable row level security;
do $pol$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='tipo_exame_procedimentos') then
    create policy "authenticated full access tipo_exame_procedimentos"
      on public.tipo_exame_procedimentos for all to authenticated using (true) with check (true);
  end if;
end $pol$;

-- 3) Migra os registros que hoje estão (errados) em tipos_exame, mas são na
--    verdade procedimentos, para o catálogo de procedimentos — preservando o
--    mesmo id (nada referencia esses ids ainda, então a troca é segura).
--    Os 5 nomes abaixo são os ÚNICOS tipos verdadeiros (NR-7).
insert into public.procedimentos_exame (id, empresa_id, nome, valor_estimado, ativo, ordem, created_at)
select t.id, t.empresa_id, t.nome, t.valor_estimado, true, t.ordem, t.created_at
from public.tipos_exame t
where t.nome not in ('Admissional','Periódico','Retorno ao Trabalho','Mudança de Risco Ocupacional','Demissional')
  and not exists (select 1 from public.procedimentos_exame p where p.id = t.id);

-- 4) Remove esses mesmos registros de tipos_exame (não são tipos).
delete from public.tipos_exame
where nome not in ('Admissional','Periódico','Retorno ao Trabalho','Mudança de Risco Ocupacional','Demissional');
