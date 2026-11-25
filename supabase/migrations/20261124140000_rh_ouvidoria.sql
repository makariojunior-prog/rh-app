-- Canal de Ouvidoria e Denúncias (NR-1 / Portaria MTE 1.419/2024 — riscos psicossociais e PGR;
-- Lei 14.457/2022 e NR-5 — CIPA, combate ao assédio e à violência, anonimato e acompanhamento).
--
-- Formulário público (/ouvidoria):
--   - ouvidoria_enviar(...)      -> envia manifestação e devolve protocolo único (anon/authenticated)
--   - ouvidoria_consultar(prot)  -> consulta andamento e retornos públicos pelo protocolo, sem expor relato/PII
--   - ouvidoria_complementar(...) -> permite ao denunciante anônimo enviar complemento ao protocolo aberto
--   - bucket privado 'ouvidoria-anexos' -> anon só envia JPEG com nome validado; só o RH lê.
--
-- Auditoria e guarda legal (NR-1 / PGR — 20 anos):
--   - Usuários autenticados (RH/Comitê) NÃO têm permissão de DELETE em manifestações nem tratativas;
--     ouvidoria_tratativas é somente inserção (append-only), preservando a trilha de apuração para o MTE.
--
-- Nada de IP, user-agent ou cookie é gravado. Identificação é opcional e vem só se a pessoa escrever.
-- NÃO aplicar em produção sem confirmação do Makário.

create extension if not exists pgcrypto;

create table if not exists public.ouvidoria_manifestacoes (
  id uuid primary key default gen_random_uuid(),
  protocolo text not null unique,
  empresa_id text not null check (empresa_id in ('cantina','lumar')),
  tipo text not null check (tipo in ('denuncia','sugestao','reclamacao','elogio')),
  categoria text not null default 'sugestao_melhoria' check (categoria in (
    'assedio_moral',
    'assedio_sexual',
    'discriminacao_violencia',
    'risco_psicossocial',
    'seguranca_saude',
    'conduta_etica',
    'sugestao_melhoria'
  )),
  gravidade text not null default 'media' check (gravidade in ('baixa','media','alta','critica')),
  risco_psicossocial boolean not null default false,
  encaminhado_cipa boolean not null default false,
  responsavel_apuracao text check (responsavel_apuracao is null or char_length(responsavel_apuracao) <= 120),
  plano_acao_pgr text check (plano_acao_pgr is null or char_length(plano_acao_pgr) <= 3000),
  setor text not null,
  descricao text not null check (char_length(descricao) between 10 and 5000),
  identificacao text check (identificacao is null or char_length(identificacao) <= 200),
  anexos jsonb not null default '[]'::jsonb,
  status text not null default 'nova' check (status in ('nova','em_analise','tratada','arquivada')),
  prazo_resposta timestamptz not null default (now() + interval '30 days'),
  lida_em timestamptz,
  lida_por text,
  concluida_em timestamptz,
  created_at timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists idx_ouvidoria_manif_empresa on public.ouvidoria_manifestacoes(empresa_id, created_at desc);

create table if not exists public.ouvidoria_tratativas (
  id uuid primary key default gen_random_uuid(),
  manifestacao_id uuid not null references public.ouvidoria_manifestacoes(id) on delete cascade,
  empresa_id text not null,
  tipo text not null check (tipo in ('leitura','status','nota','retorno','complemento','plano_acao')),
  texto text not null check (char_length(texto) between 1 and 3000),
  visivel_denunciante boolean not null default false,
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

-- Guarda legal NR-1 / PGR: sem DELETE para authenticated; tratativas são somente inserção (append-only).
revoke all on public.ouvidoria_manifestacoes from public, anon, authenticated;
revoke all on public.ouvidoria_tratativas from public, anon, authenticated;
grant select, insert, update on public.ouvidoria_manifestacoes to authenticated;
grant select, insert on public.ouvidoria_tratativas to authenticated;
grant all on public.ouvidoria_manifestacoes to service_role;
grant all on public.ouvidoria_tratativas to service_role;

-- Envio público: valida tudo no servidor, classifica risco psicossocial NR-1 e devolve só o protocolo.
create or replace function public.ouvidoria_enviar(
  p_empresa_id text,
  p_tipo text,
  p_setor text,
  p_descricao text,
  p_identificacao text default null,
  p_anexos jsonb default '[]'::jsonb,
  p_categoria text default 'sugestao_melhoria'
) returns text
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  v_desc text := btrim(coalesce(p_descricao, ''));
  v_ident text := nullif(btrim(coalesce(p_identificacao, '')), '');
  v_cat text := coalesce(nullif(btrim(p_categoria), ''), 'sugestao_melhoria');
  v_psico boolean;
  v_grav text;
  v_protocolo text;
  v_path text;
begin
  if p_empresa_id is null or p_empresa_id not in ('cantina','lumar') then raise exception 'empresa invalida'; end if;
  if p_tipo is null or p_tipo not in ('denuncia','sugestao','reclamacao','elogio') then raise exception 'tipo invalido'; end if;
  if v_cat not in ('assedio_moral','assedio_sexual','discriminacao_violencia','risco_psicossocial','seguranca_saude','conduta_etica','sugestao_melhoria') then
    raise exception 'categoria invalida';
  end if;
  if p_setor is null or p_setor not in ('Produção / Fábrica','Expedição / Logística','Loja / Vendas','Administrativo','Geral / Outro') then
    raise exception 'setor invalido';
  end if;
  if char_length(v_desc) < 10 or char_length(v_desc) > 5000 then raise exception 'descricao invalida'; end if;
  if v_ident is not null and char_length(v_ident) > 200 then raise exception 'identificacao invalida'; end if;
  if p_anexos is null or jsonb_typeof(p_anexos) <> 'array' or jsonb_array_length(p_anexos) > 3 then raise exception 'anexos invalidos'; end if;
  for v_path in select jsonb_array_elements_text(p_anexos) loop
    if v_path !~ '^[0-9a-f-]{36}/[0-2]\.jpg$' then raise exception 'anexo invalido'; end if;
  end loop;

  v_psico := v_cat in ('assedio_moral','assedio_sexual','discriminacao_violencia','risco_psicossocial');
  v_grav := case
    when v_cat in ('assedio_sexual','discriminacao_violencia') then 'critica'
    when v_cat in ('assedio_moral','risco_psicossocial','seguranca_saude') then 'alta'
    when p_tipo = 'denuncia' then 'media'
    else 'baixa'
  end;

  v_protocolo := 'OUV-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 10));
  insert into public.ouvidoria_manifestacoes (
    protocolo, empresa_id, tipo, categoria, gravidade, risco_psicossocial,
    encaminhado_cipa, setor, descricao, identificacao, anexos
  ) values (
    v_protocolo, p_empresa_id, p_tipo, v_cat, v_grav, v_psico,
    v_cat in ('assedio_moral','assedio_sexual','discriminacao_violencia','seguranca_saude'),
    p_setor, v_desc, v_ident, p_anexos
  );
  return v_protocolo;
end
$fn$;

revoke all on function public.ouvidoria_enviar(text, text, text, text, text, jsonb, text) from public;
grant execute on function public.ouvidoria_enviar(text, text, text, text, text, jsonb, text) to anon, authenticated;

-- Consulta anônima pelo protocolo (Lei 14.457/2022 e NR-1): retorna apenas status, prazo e
-- mensagens marcadas como visíveis ao denunciante. Nunca devolve descrição, anexos ou notas internas.
create or replace function public.ouvidoria_consultar(p_protocolo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_prot text := upper(btrim(coalesce(p_protocolo, '')));
  v_m record;
  v_msgs jsonb;
begin
  if v_prot !~ '^OUV-[A-Z0-9]{8,12}$' then
    return null;
  end if;

  select id, protocolo, tipo, categoria, status, created_at, prazo_resposta, atualizado_em, concluida_em
    into v_m
    from public.ouvidoria_manifestacoes
   where protocolo = v_prot;

  if not found then
    return null;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'tipo', t.tipo,
      'texto', t.texto,
      'created_at', t.created_at
    ) order by t.created_at asc
  ), '[]'::jsonb)
    into v_msgs
    from public.ouvidoria_tratativas t
   where t.manifestacao_id = v_m.id
     and t.visivel_denunciante = true;

  return jsonb_build_object(
    'protocolo', v_m.protocolo,
    'tipo', v_m.tipo,
    'categoria', v_m.categoria,
    'status', v_m.status,
    'created_at', v_m.created_at,
    'prazo_resposta', v_m.prazo_resposta,
    'atualizado_em', v_m.atualizado_em,
    'concluida_em', v_m.concluida_em,
    'mensagens', v_msgs
  );
end
$fn$;

revoke all on function public.ouvidoria_consultar(text) from public;
grant execute on function public.ouvidoria_consultar(text) to anon, authenticated;

-- Complemento anônimo pelo protocolo: permite ao denunciante responder dúvidas do comitê
-- ou acrescentar informações enquanto a manifestação não estiver arquivada.
create or replace function public.ouvidoria_complementar(
  p_protocolo text,
  p_texto text
) returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_prot text := upper(btrim(coalesce(p_protocolo, '')));
  v_txt text := btrim(coalesce(p_texto, ''));
  v_m record;
  v_qtd int;
begin
  if v_prot !~ '^OUV-[A-Z0-9]{8,12}$' then raise exception 'protocolo invalido'; end if;
  if char_length(v_txt) < 5 or char_length(v_txt) > 2000 then raise exception 'texto invalido'; end if;

  select id, empresa_id, status into v_m
    from public.ouvidoria_manifestacoes
   where protocolo = v_prot;

  if not found then raise exception 'protocolo nao encontrado'; end if;
  if v_m.status = 'arquivada' then raise exception 'manifestacao arquivada'; end if;

  select count(*) into v_qtd
    from public.ouvidoria_tratativas
   where manifestacao_id = v_m.id and tipo = 'complemento';
  if v_qtd >= 10 then raise exception 'limite de complementos atingido'; end if;

  insert into public.ouvidoria_tratativas (manifestacao_id, empresa_id, tipo, texto, visivel_denunciante, autor)
  values (v_m.id, v_m.empresa_id, 'complemento', v_txt, true, 'Denunciante (anônimo)');

  update public.ouvidoria_manifestacoes
     set atualizado_em = now()
   where id = v_m.id;

  return true;
end
$fn$;

revoke all on function public.ouvidoria_complementar(text, text) from public;
grant execute on function public.ouvidoria_complementar(text, text) to anon, authenticated;

-- Anexos (fotos): bucket privado, só JPEG até 3 MB; anon só envia (INSERT), RH lê (sem DELETE para preservar evidências).
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
