-- Origem do candidato: UTMs do link pelo qual chegou ao site de vagas
-- (as campanhas do RH na Meta mandam utm_source=meta, utm_campaign=rh-<conta>-<vaga>,
-- utm_content=feed|story e utm_id=<id da campanha>). Sem UTM = acesso direto/orgânico.
-- Tabela já existente: o GRANT de INSERT do anon (site de vagas) é por tabela e cobre as colunas novas.

ALTER TABLE public.candidatos
  ADD COLUMN IF NOT EXISTS utm_source   text,
  ADD COLUMN IF NOT EXISTS utm_medium   text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_content  text,
  ADD COLUMN IF NOT EXISTS utm_id       text;

-- O insert vem de anônimos: limita o tamanho para ninguém gravar texto arbitrário grande
ALTER TABLE public.candidatos
  DROP CONSTRAINT IF EXISTS candidatos_utm_tamanho;
ALTER TABLE public.candidatos
  ADD CONSTRAINT candidatos_utm_tamanho CHECK (
    coalesce(length(utm_source), 0)   <= 100 AND
    coalesce(length(utm_medium), 0)   <= 100 AND
    coalesce(length(utm_campaign), 0) <= 200 AND
    coalesce(length(utm_content), 0)  <= 100 AND
    coalesce(length(utm_id), 0)       <= 100
  );

COMMENT ON COLUMN public.candidatos.utm_source   IS 'Origem do acesso ao site de vagas (ex.: meta)';
COMMENT ON COLUMN public.candidatos.utm_campaign IS 'Campanha de origem (ex.: rh-cantina-padeiro)';
COMMENT ON COLUMN public.candidatos.utm_content  IS 'Formato do anúncio (feed | story)';
COMMENT ON COLUMN public.candidatos.utm_id       IS 'ID da campanha na Meta (casa com rh_campanhas_criadas.meta_campaign_id)';
