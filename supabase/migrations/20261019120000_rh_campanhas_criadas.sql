-- =====================================================================
-- RH-App · Migração 2026-10-19 — Cadastro e publicação de campanhas de
-- recrutamento com prévia de IA e envio para Meta Ads (Cantina / Lumar).
-- Idempotente e aditiva; respeita RLS de membro do RH (rh_is_member).
-- =====================================================================

create table if not exists public.rh_campanhas_criadas (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null default 'cantina', -- empresa no RH
  conta_anuncio text not null check (conta_anuncio in ('cantina', 'lumar')), -- conta Meta Ads escolhida
  conta_id_externo text not null, -- ex.: '338176501855182' (Cantina) ou '462816038169791' (Lumar)
  pagina_id_externo text not null, -- ex.: '111645087198984' (Cantina) ou '106182958374926' (Lumar)
  nome_campanha text not null, -- ex.: '[TRAFEGO] [FORMS] Vaga de Emprego — Auxiliar de Cozinha'
  vaga text not null,
  funcao_id uuid references public.funcoes(id) on delete set null,
  divulgar_salario boolean not null default false,
  salario_texto text,
  divulgar_beneficios boolean not null default true,
  beneficios text[] not null default '{}'::text[],
  divulgar_horario boolean not null default false,
  horario_texto text,
  divulgar_local boolean not null default true,
  local_texto text,
  requisitos_texto text,
  observacoes_ia text,
  dias_duracao integer not null check (dias_duracao >= 1 and dias_duracao <= 90),
  orcamento_total numeric(12, 2) not null check (orcamento_total > 0),
  data_inicio timestamptz not null default now(),
  data_fim timestamptz not null,
  url_destino text not null default 'https://vagas.cantinaemcasa.com',
  -- Conteúdo gerado pela IA / editado pelo RH para o anúncio
  ia_copy jsonb not null default '{}'::jsonb, -- { cargo_banner, requisitos_bullets, remuneracao_bullets, beneficios_bullets, horario_texto, whatsapp_contato, instagram_handle, legenda, titulo_link, prompt_foto_funcao }
  imagem_fundo_url text, -- URL ou caminho da foto da função gerada pela IA
  criativo_url text, -- caminho no bucket 'rh-documentos' da imagem final aprovada Feed (1080x1080 PNG)
  criativo_story_url text, -- caminho no bucket 'rh-documentos' da imagem final aprovada Story (1080x1920 PNG)
  -- Status do fluxo no RH e vínculo com a Meta / mkt_comandos
  status text not null default 'rascunho' check (status in (
    'rascunho', 'previa_pronta', 'publicando', 'ativa', 'pausada', 'encerrada', 'erro'
  )),
  meta_campaign_id text,
  meta_adset_id text,
  meta_creative_id text,
  meta_ad_id text,
  meta_image_hash text,
  meta_image_hash_story text,
  mkt_comando_id uuid,
  erro_detalhe text,
  criado_por uuid references auth.users(id) on delete set null,
  criado_por_email text,
  aprovado_em timestamptz,
  publicado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_rh_campanhas_criadas_status on public.rh_campanhas_criadas (status, criado_em desc);
create index if not exists idx_rh_campanhas_criadas_conta on public.rh_campanhas_criadas (conta_anuncio, criado_em desc);

alter table public.rh_campanhas_criadas enable row level security;

drop policy if exists rh_member_all on public.rh_campanhas_criadas;
create policy rh_member_all on public.rh_campanhas_criadas for all to authenticated
  using ((select public.rh_is_member()))
  with check ((select public.rh_is_member()));

revoke all on public.rh_campanhas_criadas from anon;
revoke truncate, trigger, references on public.rh_campanhas_criadas from authenticated;
grant select, insert, update, delete on public.rh_campanhas_criadas to authenticated;

-- Expande rh_campanhas_recrutamento para trazer também empresa_id, conta_nome e orcamento,
-- mantendo compatibilidade com os campos já lidos pelo DashboardPage.
drop function if exists public.rh_campanhas_recrutamento(text);
create or replace function public.rh_campanhas_recrutamento(p_empresa text default null)
returns table(
  id uuid,
  nome text,
  plataforma text,
  inicio timestamptz,
  fim timestamptz,
  dias_restantes integer,
  alcance numeric,
  empresa_id text,
  conta_nome text,
  orcamento_total numeric,
  orcamento_diario numeric,
  status text,
  status_efetivo text,
  id_externo text
)
language sql stable security definer set search_path = public as $$
  select
    c.id,
    c.nome,
    ct.plataforma,
    c.inicio,
    c.fim,
    case when c.fim is null then null
         else ((c.fim at time zone 'America/Sao_Paulo')::date
               - (now() at time zone 'America/Sao_Paulo')::date)
    end as dias_restantes,
    nullif(c.resumo_30d->>'alcance','')::numeric as alcance,
    ct.empresa_id,
    ct.nome as conta_nome,
    c.orcamento_total,
    c.orcamento_diario,
    c.status,
    c.status_efetivo,
    c.id_externo
  from public.mkt_campanhas c
  join public.mkt_contas ct on ct.id = c.conta_id
  where public.rh_is_member()
    and (p_empresa is null or ct.empresa_id = p_empresa)
    and c.status_efetivo = 'ACTIVE'
    and (c.fim is null or c.fim >= now())
    and c.nome ~* '(vaga|emprego|recrut|curr[ií]culo|contrata|candidat)'
  order by c.fim nulls last, c.nome;
$$;

revoke all on function public.rh_campanhas_recrutamento(text) from public, anon;
grant execute on function public.rh_campanhas_recrutamento(text) to authenticated;

-- Campos opcionais para observações e data de inclusão no Banco de Currículos (Talentos)
alter table public.candidatos add column if not exists banco_obs text;
alter table public.candidatos add column if not exists banco_em timestamptz;
