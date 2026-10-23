-- Documentos legais/SST da empresa (PGR, PCMSO, LTCAT, licenças ambientais, relatórios
-- de clínica — psicossocial, AEP etc.). Arquivo fica no bucket privado 'rh-documentos'
-- (<empresa_id>/legais/<timestamp>_<nome>), já gated por rh_is_member() desde a migration
-- 20261016120000_rh_hardening_rls.sql. Pode opcionalmente se ligar a uma norma (ex: PGR → NR-01).

create table if not exists public.documentos_legais_empresa (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  categoria text not null,          -- PGR, PCMSO, LTCAT, Licença Ambiental, Relatório Psicossocial, AEP, Outro...
  titulo text not null,
  norma_codigo text,                -- opcional: NR-01, NR-07, NR-09... (vínculo solto, sem FK)
  arquivo_path text not null,
  arquivo_nome text,
  validade date,                    -- data de validade/renovação, quando houver
  observacoes text,
  created_at timestamptz not null default now(),
  created_by text
);
create index if not exists idx_documentos_legais_empresa on public.documentos_legais_empresa(empresa_id);

alter table public.documentos_legais_empresa enable row level security;
do $pol$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='documentos_legais_empresa') then
    create policy rh_member_all on public.documentos_legais_empresa for all to authenticated
      using ((select public.rh_is_member())) with check ((select public.rh_is_member()));
  end if;
end $pol$;

revoke truncate, trigger, references on public.documentos_legais_empresa from anon, authenticated;
revoke all on public.documentos_legais_empresa from anon;
grant select, insert, update, delete on public.documentos_legais_empresa to authenticated, service_role;
