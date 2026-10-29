-- RH-App · IDs legados dos colaboradores e acesso restrito a membros do RH.
-- Os IDs existentes em colaboradores podem ser textos como "cantina_NOME"; armazená-los
-- como UUID faz filtros PostgREST falharem antes de executar a RLS.
-- Conversão UUID -> text preserva os valores atuais (incluindo UUIDs já gravados).

create table if not exists public.tipos_documento_colab (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  nome text not null,
  obrigatorio boolean not null default true,
  condicao text,
  ordem integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.colaborador_documentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  colaborador_id text not null,
  tipo_id uuid references public.tipos_documento_colab(id) on delete set null,
  tipo_nome text not null,
  arquivo_path text not null,
  arquivo_nome text,
  obs text,
  created_at timestamptz not null default now()
);

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

-- Corrige bancos onde as versões antigas criaram essas colunas como UUID.
do $migration$
declare
  tabela text;
begin
  foreach tabela in array array['colaborador_documentos', 'colaborador_documentos_dispensas'] loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = tabela
        and column_name = 'colaborador_id'
        and udt_name = 'uuid'
    ) then
      execute format(
        'alter table public.%I alter column colaborador_id type text using colaborador_id::text',
        tabela
      );
    end if;
  end loop;
end
$migration$;

create index if not exists idx_tipos_doc_colab_empresa
  on public.tipos_documento_colab(empresa_id);
create index if not exists idx_colab_docs_colab
  on public.colaborador_documentos(colaborador_id);
create index if not exists idx_colab_doc_dispensas_colab
  on public.colaborador_documentos_dispensas(colaborador_id);

alter table public.tipos_documento_colab enable row level security;
alter table public.colaborador_documentos enable row level security;
alter table public.colaborador_documentos_dispensas enable row level security;

drop policy if exists "authenticated full access tipos_documento_colab" on public.tipos_documento_colab;
drop policy if exists rh_member_all on public.tipos_documento_colab;
create policy rh_member_all on public.tipos_documento_colab for all to authenticated
  using ((select public.rh_is_member()))
  with check ((select public.rh_is_member()));

drop policy if exists "authenticated full access colaborador_documentos" on public.colaborador_documentos;
drop policy if exists rh_member_all on public.colaborador_documentos;
create policy rh_member_all on public.colaborador_documentos for all to authenticated
  using ((select public.rh_is_member()))
  with check ((select public.rh_is_member()));

drop policy if exists rh_member_all on public.colaborador_documentos_dispensas;
create policy rh_member_all on public.colaborador_documentos_dispensas for all to authenticated
  using ((select public.rh_is_member()))
  with check ((select public.rh_is_member()));

insert into storage.buckets (id, name, public)
values ('rh-documentos', 'rh-documentos', false)
on conflict (id) do nothing;

drop policy if exists rhdoc_authenticated_read on storage.objects;
drop policy if exists rhdoc_authenticated_write on storage.objects;
drop policy if exists rhdoc_authenticated_update on storage.objects;
drop policy if exists rhdoc_authenticated_delete on storage.objects;
create policy rhdoc_authenticated_read on storage.objects for select to authenticated
  using (bucket_id = 'rh-documentos' and (select public.rh_is_member()));
create policy rhdoc_authenticated_write on storage.objects for insert to authenticated
  with check (bucket_id = 'rh-documentos' and (select public.rh_is_member()));
create policy rhdoc_authenticated_update on storage.objects for update to authenticated
  using (bucket_id = 'rh-documentos' and (select public.rh_is_member()))
  with check (bucket_id = 'rh-documentos' and (select public.rh_is_member()));
create policy rhdoc_authenticated_delete on storage.objects for delete to authenticated
  using (bucket_id = 'rh-documentos' and (select public.rh_is_member()));

revoke all on public.tipos_documento_colab,
  public.colaborador_documentos,
  public.colaborador_documentos_dispensas from anon;
revoke truncate, trigger, references on public.tipos_documento_colab,
  public.colaborador_documentos,
  public.colaborador_documentos_dispensas from anon, authenticated;
grant select, insert, update, delete on public.tipos_documento_colab,
  public.colaborador_documentos,
  public.colaborador_documentos_dispensas to authenticated, service_role;
