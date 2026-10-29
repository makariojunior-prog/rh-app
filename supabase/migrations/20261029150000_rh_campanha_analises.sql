-- Análises das campanhas de recrutamento do RH (métricas + achados por regras + resumo/ações da IA).
-- Gravadas pela edge function rh-campanha-analise (manual, pelo botão, ou diária, pelo cron).

CREATE TABLE IF NOT EXISTS public.rh_campanha_analises (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id uuid NOT NULL REFERENCES public.rh_campanhas_criadas(id) ON DELETE CASCADE,
  gerada_em   timestamptz NOT NULL DEFAULT now(),
  origem      text NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual', 'automatica')),
  metricas    jsonb NOT NULL DEFAULT '{}'::jsonb,
  achados     jsonb NOT NULL DEFAULT '[]'::jsonb,
  resumo      text,
  acoes       jsonb NOT NULL DEFAULT '[]'::jsonb,
  usou_ia     boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS rh_campanha_analises_campanha
  ON public.rh_campanha_analises (campanha_id, gerada_em DESC);

ALTER TABLE public.rh_campanha_analises ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rh_member_select ON public.rh_campanha_analises;
CREATE POLICY rh_member_select ON public.rh_campanha_analises
  FOR SELECT TO authenticated USING ((SELECT rh_is_member()));

GRANT SELECT ON public.rh_campanha_analises TO authenticated;
GRANT ALL ON public.rh_campanha_analises TO service_role;

-- Análise automática diária (12:30 UTC = 9:30 em Brasília), depois da sincronização das 12:00.
-- Chama a edge function com o mesmo segredo de cron do Marketing.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'rh-analise-campanhas';
    PERFORM cron.schedule('rh-analise-campanhas', '30 12 * * *', $cron$
      select net.http_post(
        url     := 'https://taicaxtjtikdajmhtsxc.supabase.co/functions/v1/rh-campanha-analise',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'mkt_cron_secret')
        ),
        body    := '{"acao":"analisar_todas"}'::jsonb,
        timeout_milliseconds := 10000
      );
    $cron$);
  END IF;
END $$;
