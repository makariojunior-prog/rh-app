-- Permite marcar um tipo de documento do check-list de admissão como "não se aplica" para
-- um colaborador específico (ex.: documento de salário-família para quem não tem direito),
-- sem precisar anexar arquivo nenhum. Usado por DocumentosColaborador e pelo alerta
-- "Documentos de admissão pendentes" do Dashboard.

create table if not exists public.colaborador_documentos_dispensas (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  colaborador_id text not null,
  tipo_id uuid not null references public.tipos_documento_colab(id) on delete cascade,
  motivo text,
  created_at timestamptz not null default now(),
  created_by text,
  unique (colaborador_id, tipo_id)
);
create index if not exists idx_colab_doc_dispensas_colab on public.colaborador_documentos_dispensas(colaborador_id);

alter table public.colaborador_documentos_dispensas enable row level security;
do $pol$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='colaborador_documentos_dispensas') then
    create policy rh_member_all on public.colaborador_documentos_dispensas for all to authenticated
      using ((select public.rh_is_member())) with check ((select public.rh_is_member()));
  end if;
end $pol$;

revoke truncate, trigger, references on public.colaborador_documentos_dispensas from anon, authenticated;
revoke all on public.colaborador_documentos_dispensas from anon;
grant select, insert, update, delete on public.colaborador_documentos_dispensas to authenticated, service_role;
