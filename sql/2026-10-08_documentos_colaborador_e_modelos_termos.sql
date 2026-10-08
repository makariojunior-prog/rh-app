-- =====================================================================
-- RH-App · Migração 2026-10-08 — Documentos pessoais do colaborador,
-- check-list de admissão e modelos de termos.
--  • tipos_documento_colab: catálogo editável de documentos exigidos na admissão
--  • colaborador_documentos: arquivos anexados por colaborador (bucket privado)
--  • termos_assinatura: modelo (arquivo anexo + texto com campos {{...}} preenchidos
--    automaticamente a partir do cadastro do colaborador)
--  • colaborador_termos: cópia digitalizada do termo assinado
--  • colaboradores: RG e endereço (usados no preenchimento automático dos termos)
-- Aditiva e idempotente.
-- =====================================================================

alter table public.colaboradores add column if not exists rg text;
alter table public.colaboradores add column if not exists endereco text;

alter table public.termos_assinatura add column if not exists modelo_path text;
alter table public.termos_assinatura add column if not exists modelo_nome text;
alter table public.termos_assinatura add column if not exists modelo_texto text;

alter table public.colaborador_termos add column if not exists arquivo_path text;
alter table public.colaborador_termos add column if not exists arquivo_nome text;

create table if not exists public.tipos_documento_colab (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  nome text not null,
  obrigatorio boolean not null default true,
  condicao text,                    -- texto livre: "Homens", "Se tiver filhos menores de 14 anos"...
  ordem integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_tipos_doc_colab_empresa on public.tipos_documento_colab(empresa_id);

create table if not exists public.colaborador_documentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  colaborador_id uuid not null,
  tipo_id uuid references public.tipos_documento_colab(id) on delete set null,
  tipo_nome text not null,          -- snapshot: sobrevive a renomear/remover o tipo
  arquivo_path text not null,
  arquivo_nome text,
  obs text,
  created_at timestamptz not null default now()
);
create index if not exists idx_colab_docs_colab on public.colaborador_documentos(colaborador_id);

alter table public.tipos_documento_colab enable row level security;
alter table public.colaborador_documentos enable row level security;
do $pol$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='tipos_documento_colab') then
    create policy "authenticated full access tipos_documento_colab"
      on public.tipos_documento_colab for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='colaborador_documentos') then
    create policy "authenticated full access colaborador_documentos"
      on public.colaborador_documentos for all to authenticated using (true) with check (true);
  end if;
end $pol$;

-- Bucket PRIVADO (documentos pessoais): <empresa>/docs/..., <empresa>/modelos/..., <empresa>/assinados/...
insert into storage.buckets (id, name, public)
values ('rh-documentos', 'rh-documentos', false)
on conflict (id) do nothing;

do $pol$
begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='rhdoc_authenticated_read') then
    create policy "rhdoc_authenticated_read" on storage.objects
      for select to authenticated using (bucket_id = 'rh-documentos');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='rhdoc_authenticated_write') then
    create policy "rhdoc_authenticated_write" on storage.objects
      for insert to authenticated with check (bucket_id = 'rh-documentos');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='rhdoc_authenticated_update') then
    create policy "rhdoc_authenticated_update" on storage.objects
      for update to authenticated using (bucket_id = 'rh-documentos');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='rhdoc_authenticated_delete') then
    create policy "rhdoc_authenticated_delete" on storage.objects
      for delete to authenticated using (bucket_id = 'rh-documentos');
  end if;
end $pol$;

-- Check-list de admissão padrão (para cada empresa que ainda não tem catálogo)
insert into public.tipos_documento_colab (empresa_id, nome, obrigatorio, condicao, ordem)
select e.empresa_id, d.nome, d.obrig, d.cond, d.ordem
from (select distinct empresa_id from public.colaboradores) e
cross join (values
  ('RG', true, null, 1),
  ('Carteira de Trabalho', true, null, 2),
  ('Comprovante de endereço atualizado', true, null, 3),
  ('Título de Eleitor', true, null, 4),
  ('Foto 3x4', true, null, 5),
  ('Certificado de Reservista', false, 'Homens', 6),
  ('Certidão de nascimento dos filhos', false, 'Se tiver filhos menores de 14 anos', 7),
  ('Cartão de vacinação dos filhos', false, 'Se tiver filhos menores de 14 anos', 8),
  ('Declaração escolar / comprovante de matrícula', false, 'Se tiver filhos menores de 14 anos ou estiver estudando', 9)
) as d(nome, obrig, cond, ordem)
where not exists (select 1 from public.tipos_documento_colab t where t.empresa_id = e.empresa_id);
