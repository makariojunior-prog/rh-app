-- Canal de Ouvidoria (denúncias, sugestões, reclamações e elogios anônimos).
-- Formulário público (/ouvidoria) -> RPC ouvidoria_enviar (anon só executa a função; não lê nada)
-- + bucket privado 'ouvidoria-anexos' (anon só envia JPEG com nome validado; só o RH lê).
-- Nada de IP, user-agent ou cookie é gravado. A identificação é opcional e vem só se a pessoa escrever.
-- NÃO aplicar em produção sem confirmação do Makário.

create table if not exists public.ouvidoria_manifestacoes (
  id uuid primary key default gen_random_uuid(),
  protocolo text not null unique,
  empresa_id text not null check (empresa_id in ('cantina','lumar')),
  tipo text not null check (tipo in ('denuncia','sugestao','reclamacao','elogio')),
  setor text not null,
  descricao text not null check (char_length(descricao) between 10 and 5000),
  identificacao text check (identificacao is null or char_length(identificacao) <= 200),
  anexos jsonb not null default '[]'::jsonb,
  status text not null default 'nova' check (status in ('nova','em_analise','tratada','arquivada')),
  lida_em timestamptz,
  lida_por text,
  created_at timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists idx_ouvidoria_manif_empresa on public.ouvidoria_manifestacoes(empresa_id, created_at desc);

create table if not exists public.ouvidoria_tratativas (
  id uuid primary key default gen_random_uuid(),
  manifestacao_id uuid not null references public.ouvidoria_manifestacoes(id) on delete cascade,
  empresa_id text not null,
  tipo text not null check (tipo in ('leitura','status','nota')),
  texto text not null,
  autor text,
  created_at timestamptz not null default now()
);
create index if not exists idx_ouvidoria_trat_manif on public.ouvidoria_tratativas(manifestacao_id, created_at);

alter table public.ouvidoria_manifestacoes enable row level security;
alter table public.ouvidoria_tratativas enable row level security;

do $pol$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ouvidoria_manifestacoes') then
    create policy rh_member_all on public.ouvidoria_manifestacoes for all to authenticated
      using ((select public.rh_is_member())) with check ((select public.rh_is_member()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ouvidoria_tratativas') then
    create policy rh_member_all on public.ouvidoria_tratativas for all to authenticated
      using ((select public.rh_is_member())) with check ((select public.rh_is_member()));
  end if;
end $pol$;

revoke all on public.ouvidoria_manifestacoes from public, anon;
revoke all on public.ouvidoria_tratativas from public, anon;
grant select, insert, update, delete on public.ouvidoria_manifestacoes to authenticated, service_role;
grant select, insert, update, delete on public.ouvidoria_tratativas to authenticated, service_role;

-- Envio público: valida tudo no servidor e devolve só o protocolo.
create or replace function public.ouvidoria_enviar(
  p_empresa_id text,
  p_tipo text,
  p_setor text,
  p_descricao text,
  p_identificacao text default null,
  p_anexos jsonb default '[]'::jsonb
) returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_desc text := btrim(coalesce(p_descricao, ''));
  v_ident text := nullif(btrim(coalesce(p_identificacao, '')), '');
  v_protocolo text;
  v_path text;
begin
  if p_empresa_id is null or p_empresa_id not in ('cantina','lumar') then raise exception 'empresa invalida'; end if;
  if p_tipo is null or p_tipo not in ('denuncia','sugestao','reclamacao','elogio') then raise exception 'tipo invalido'; end if;
  if p_setor is null or p_setor not in ('Produção / Fábrica','Expedição / Logística','Loja / Vendas','Administrativo','Geral / Outro') then
    raise exception 'setor invalido';
  end if;
  if char_length(v_desc) < 10 or char_length(v_desc) > 5000 then raise exception 'descricao invalida'; end if;
  if v_ident is not null and char_length(v_ident) > 200 then raise exception 'identificacao invalida'; end if;
  if p_anexos is null or jsonb_typeof(p_anexos) <> 'array' or jsonb_array_length(p_anexos) > 3 then raise exception 'anexos invalidos'; end if;
  for v_path in select jsonb_array_elements_text(p_anexos) loop
    if v_path !~ '^[0-9a-f-]{36}/[0-2]\.jpg$' then raise exception 'anexo invalido'; end if;
  end loop;

  v_protocolo := 'OUV-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  insert into public.ouvidoria_manifestacoes (protocolo, empresa_id, tipo, setor, descricao, identificacao, anexos)
  values (v_protocolo, p_empresa_id, p_tipo, p_setor, v_desc, v_ident, p_anexos);
  return v_protocolo;
end
$fn$;

revoke all on function public.ouvidoria_enviar(text, text, text, text, text, jsonb) from public;
grant execute on function public.ouvidoria_enviar(text, text, text, text, text, jsonb) to anon, authenticated;

-- Anexos (fotos): bucket privado, só JPEG até 3 MB; anon só envia (INSERT), RH lê/apaga.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ouvidoria-anexos', 'ouvidoria-anexos', false, 3145728, array['image/jpeg'])
on conflict (id) do nothing;

drop policy if exists ouvidoria_anon_upload on storage.objects;
create policy ouvidoria_anon_upload on storage.objects for insert to anon
  with check (bucket_id = 'ouvidoria-anexos' and name ~ '^[0-9a-f-]{36}/[0-2]\.jpg$');

drop policy if exists ouvidoria_rh_read on storage.objects;
create policy ouvidoria_rh_read on storage.objects for select to authenticated
  using (bucket_id = 'ouvidoria-anexos' and (select public.rh_is_member()));

drop policy if exists ouvidoria_rh_delete on storage.objects;
create policy ouvidoria_rh_delete on storage.objects for delete to authenticated
  using (bucket_id = 'ouvidoria-anexos' and (select public.rh_is_member()));
