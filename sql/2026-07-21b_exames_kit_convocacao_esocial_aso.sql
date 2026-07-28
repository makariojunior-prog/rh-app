-- =====================================================================
-- RH-App · Migração 2026-07-21 (parte B) — melhorias de benchmark do módulo Exames
--   (1) Kit de exames por função (GHE)
--   (2) Convocação / agendamento
--   (3) Conciliação eSocial S-2220
--   (4) Anexo do ASO em PDF (bucket privado — dado de saúde)
-- Aditiva: não altera nem apaga nenhum dado existente.
-- Rode DEPOIS do arquivo 2026-07-21_exames_tipos_aso_e_normas.sql.
-- =====================================================================

-- ── 1) Kit de exames exigido por função ─────────────────────────────
create table if not exists public.exames_kit_funcao (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  funcao text not null,
  tipo_exame_id text not null,
  tipo_exame_nome text,
  created_at timestamptz not null default now()
);
create unique index if not exists uq_kit_funcao on public.exames_kit_funcao(empresa_id, funcao, tipo_exame_id);
create index if not exists idx_kit_funcao_emp on public.exames_kit_funcao(empresa_id);

-- ── 2) Convocação / agendamento de exames ───────────────────────────
create table if not exists public.exames_agendamentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  colaborador_nome text not null,
  tipo_exame_id text not null,
  tipo_exame_nome text,
  data_agendada date,
  prestador text,
  status text not null default 'agendado',   -- 'agendado' | 'realizado' | 'cancelado'
  obs text,
  criado_por text,
  created_at timestamptz not null default now()
);
create index if not exists idx_agend_emp on public.exames_agendamentos(empresa_id);
create index if not exists idx_agend_colab on public.exames_agendamentos(colaborador_nome);

-- ── 3) Conciliação eSocial (evento S-2220) ──────────────────────────
alter table public.colaborador_exames add column if not exists esocial_enviado boolean not null default false;
alter table public.colaborador_exames add column if not exists esocial_data_envio date;
alter table public.colaborador_exames add column if not exists esocial_recibo text;

-- ── 4) Anexo do ASO ─────────────────────────────────────────────────
alter table public.colaborador_exames add column if not exists anexo_path text;

-- ── RLS ─────────────────────────────────────────────────────────────
alter table public.exames_kit_funcao enable row level security;
alter table public.exames_agendamentos enable row level security;
do $pol$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='exames_kit_funcao') then
    create policy "authenticated full access exames_kit_funcao"
      on public.exames_kit_funcao for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='exames_agendamentos') then
    create policy "authenticated full access exames_agendamentos"
      on public.exames_agendamentos for all to authenticated using (true) with check (true);
  end if;
end $pol$;

-- ── Bucket do ASO ───────────────────────────────────────────────────
-- PRIVADO: o ASO é dado de saúde (LGPD art. 11). O app acessa via URL
-- assinada de curta duração; nunca por link público.
insert into storage.buckets (id, name, public)
values ('exames-aso', 'exames-aso', false)
on conflict (id) do nothing;

do $pol$
begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='aso_authenticated_read') then
    create policy "aso_authenticated_read" on storage.objects
      for select to authenticated using (bucket_id = 'exames-aso');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='aso_authenticated_write') then
    create policy "aso_authenticated_write" on storage.objects
      for insert to authenticated with check (bucket_id = 'exames-aso');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='aso_authenticated_update') then
    create policy "aso_authenticated_update" on storage.objects
      for update to authenticated using (bucket_id = 'exames-aso');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='aso_authenticated_delete') then
    create policy "aso_authenticated_delete" on storage.objects
      for delete to authenticated using (bucket_id = 'exames-aso');
  end if;
end $pol$;
