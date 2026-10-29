-- Alertas das campanhas de recrutamento do RH na Meta.
-- Lê o que a sincronização do Marketing já grava (mkt_anuncios, mkt_campanhas, mkt_insights_dia,
-- mkt_contas) e mantém uma lista de alertas abertos por campanha/conta. Só LÊ as tabelas mkt_*.
-- Roda 20 min depois de cada sincronização (pg_cron) e a pedido, por rh_verificar_campanhas().

CREATE TABLE IF NOT EXISTS public.rh_campanha_alertas (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave            text NOT NULL,                       -- <campanha_id>:<tipo> ou conta:<id_externo>:<tipo>
  campanha_id      uuid REFERENCES public.rh_campanhas_criadas(id) ON DELETE CASCADE,
  conta_id_externo text,
  tipo             text NOT NULL,
  severidade       text NOT NULL CHECK (severidade IN ('critico', 'aviso', 'info')),
  mensagem         text NOT NULL,
  detalhe          jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em        timestamptz NOT NULL DEFAULT now(),
  atualizado_em    timestamptz NOT NULL DEFAULT now(),
  resolvido_em     timestamptz,                         -- a condição deixou de existir
  dispensado_em    timestamptz,                         -- o RH marcou como visto
  dispensado_por   uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Um único alerta aberto por chave
CREATE UNIQUE INDEX IF NOT EXISTS rh_campanha_alertas_chave_aberto
  ON public.rh_campanha_alertas (chave) WHERE resolvido_em IS NULL;
CREATE INDEX IF NOT EXISTS rh_campanha_alertas_campanha ON public.rh_campanha_alertas (campanha_id);

ALTER TABLE public.rh_campanha_alertas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rh_member_all ON public.rh_campanha_alertas;
CREATE POLICY rh_member_all ON public.rh_campanha_alertas
  FOR ALL TO authenticated
  USING ((SELECT rh_is_member())) WITH CHECK ((SELECT rh_is_member()));

-- O cliente só lê e dispensa; quem cria/resolve é a função abaixo
GRANT SELECT, UPDATE ON public.rh_campanha_alertas TO authenticated;
GRANT ALL ON public.rh_campanha_alertas TO service_role;

CREATE OR REPLACE FUNCTION public.rh_verificar_campanhas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  abertos integer;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _rh_alertas_calc (
    chave text, campanha_id uuid, conta_id_externo text,
    tipo text, severidade text, mensagem text, detalhe jsonb
  ) ON COMMIT DROP;
  TRUNCATE _rh_alertas_calc;

  -- Campanhas do RH que estão no ar (ou terminaram há menos de 1 dia) e existem no Marketing
  CREATE TEMP TABLE IF NOT EXISTS _rh_camp (
    rh_id uuid, nome text, conta_ext text, publicado_em timestamptz,
    mkt_id uuid, mkt_status text, mkt_ext text
  ) ON COMMIT DROP;
  TRUNCATE _rh_camp;
  INSERT INTO _rh_camp
  SELECT r.id, r.nome_campanha, r.conta_id_externo, r.publicado_em, c.id, c.status_efetivo, c.id_externo
    FROM rh_campanhas_criadas r
    JOIN mkt_campanhas c ON c.id_externo = r.meta_campaign_id
   WHERE r.status = 'ativa'
     AND r.meta_campaign_id IS NOT NULL
     AND (r.data_fim IS NULL OR r.data_fim > now() - interval '1 day');

  -- Anúncio reprovado
  INSERT INTO _rh_alertas_calc
  SELECT k.rh_id || ':anuncio_reprovado', k.rh_id, k.conta_ext, 'anuncio_reprovado', 'critico',
         'Anúncio reprovado pela Meta: a campanha não está sendo entregue. Veja o motivo no Gerenciador de Anúncios e ajuste a arte ou o texto.',
         jsonb_build_object('anuncios', count(*))
    FROM _rh_camp k JOIN mkt_anuncios a ON a.campanha_id = k.mkt_id
   WHERE a.status_efetivo = 'DISAPPROVED'
   GROUP BY k.rh_id, k.conta_ext;

  -- Anúncio com problemas
  INSERT INTO _rh_alertas_calc
  SELECT k.rh_id || ':anuncio_com_problemas', k.rh_id, k.conta_ext, 'anuncio_com_problemas', 'aviso',
         'Anúncio com problemas apontados pela Meta (política, página ou criativo). Abra o Gerenciador de Anúncios para ver o que corrigir.',
         jsonb_build_object('anuncios', count(*))
    FROM _rh_camp k JOIN mkt_anuncios a ON a.campanha_id = k.mkt_id
   WHERE a.status_efetivo = 'WITH_ISSUES'
   GROUP BY k.rh_id, k.conta_ext;

  -- Pagamento pendente
  INSERT INTO _rh_alertas_calc
  SELECT k.rh_id || ':pagamento_pendente', k.rh_id, k.conta_ext, 'pagamento_pendente', 'critico',
         'A Meta não está entregando por pendência de pagamento na conta de anúncios. Regularize a forma de pagamento.',
         jsonb_build_object('anuncios', count(*))
    FROM _rh_camp k JOIN mkt_anuncios a ON a.campanha_id = k.mkt_id
   WHERE a.status_efetivo = 'PENDING_BILLING_INFO'
   GROUP BY k.rh_id, k.conta_ext;

  -- Em análise há mais de 24 h
  INSERT INTO _rh_alertas_calc
  SELECT k.rh_id || ':analise_demorada', k.rh_id, k.conta_ext, 'analise_demorada', 'aviso',
         'Anúncio em análise na Meta há mais de 24 horas. Anúncios de emprego podem demorar; se passar de 48 h, peça nova análise no Gerenciador.',
         jsonb_build_object('anuncios', count(*), 'publicado_em', max(k.publicado_em))
    FROM _rh_camp k JOIN mkt_anuncios a ON a.campanha_id = k.mkt_id
   WHERE a.status_efetivo IN ('PENDING_REVIEW', 'IN_PROCESS')
     AND k.publicado_em < now() - interval '24 hours'
   GROUP BY k.rh_id, k.conta_ext;

  -- Campanha pausada, arquivada ou excluída direto na Meta (fora do RH)
  INSERT INTO _rh_alertas_calc
  SELECT k.rh_id || ':pausada_na_meta', k.rh_id, k.conta_ext, 'pausada_na_meta', 'aviso',
         CASE k.mkt_status
           WHEN 'DELETED' THEN 'A campanha foi excluída direto na Meta, mas continua como ativa no RH.'
           WHEN 'ARCHIVED' THEN 'A campanha foi arquivada direto na Meta, mas continua como ativa no RH.'
           ELSE 'A campanha está pausada na Meta, mas continua como ativa no RH.'
         END,
         jsonb_build_object('status_meta', k.mkt_status)
    FROM _rh_camp k
   WHERE k.mkt_status IN ('PAUSED', 'DELETED', 'ARCHIVED');

  -- No ar há mais de 4 h e nenhuma impressão (sem estar em análise)
  INSERT INTO _rh_alertas_calc
  SELECT k.rh_id || ':sem_entrega', k.rh_id, k.conta_ext, 'sem_entrega', 'aviso',
         'Campanha ativa há mais de 4 horas e ainda sem nenhuma impressão. Confira público, orçamento e o estado dos anúncios no Gerenciador.',
         jsonb_build_object('publicado_em', k.publicado_em)
    FROM _rh_camp k
   WHERE k.mkt_status = 'ACTIVE'
     AND k.publicado_em < now() - interval '4 hours'
     AND EXISTS (SELECT 1 FROM mkt_anuncios a WHERE a.campanha_id = k.mkt_id)
     AND NOT EXISTS (SELECT 1 FROM mkt_anuncios a WHERE a.campanha_id = k.mkt_id
                        AND a.status_efetivo IN ('PENDING_REVIEW', 'IN_PROCESS', 'DISAPPROVED', 'WITH_ISSUES', 'PENDING_BILLING_INFO'))
     AND COALESCE((SELECT sum(i.impressoes) FROM mkt_insights_dia i
                    WHERE i.nivel = 'campanha' AND i.id_externo = k.mkt_ext), 0) = 0;

  -- Conta de anúncios (afeta todas as campanhas dela): restrita, sincronização falhando ou parada
  INSERT INTO _rh_alertas_calc
  SELECT 'conta:' || ct.id_externo || ':restrita', NULL, ct.id_externo, 'conta_restrita', 'critico',
         'A conta de anúncios não está ativa na Meta (status ' || coalesce(ct.status_externo, 'desconhecido') || '). As campanhas podem estar paradas.',
         jsonb_build_object('status_externo', ct.status_externo)
    FROM mkt_contas ct
   WHERE ct.plataforma = 'meta' AND ct.status_externo IS DISTINCT FROM 'ACTIVE'
     AND ct.id_externo IN (SELECT conta_ext FROM _rh_camp);

  INSERT INTO _rh_alertas_calc
  SELECT 'conta:' || ct.id_externo || ':sync_falhando', NULL, ct.id_externo, 'sync_falhando', 'critico',
         'A sincronização com a Meta está falhando (o token pode ter expirado ou perdido permissão); os números e alertas ficam desatualizados. '
           || coalesce(left(ct.ultimo_erro, 200), ''),
         jsonb_build_object('ultima_sync_em', ct.ultima_sync_em, 'status', ct.ultima_sync_status)
    FROM mkt_contas ct
   WHERE ct.plataforma = 'meta'
     AND (ct.ultima_sync_status IS DISTINCT FROM 'ok' OR ct.ultimo_erro IS NOT NULL)
     AND ct.id_externo IN (SELECT conta_ext FROM _rh_camp);

  INSERT INTO _rh_alertas_calc
  SELECT 'conta:' || ct.id_externo || ':sync_parada', NULL, ct.id_externo, 'sync_parada', 'aviso',
         'A sincronização com a Meta não roda há mais de 8 horas; os dados das campanhas podem estar desatualizados.',
         jsonb_build_object('ultima_sync_em', ct.ultima_sync_em)
    FROM mkt_contas ct
   WHERE ct.plataforma = 'meta'
     AND (ct.ultima_sync_em IS NULL OR ct.ultima_sync_em < now() - interval '8 hours')
     AND ct.id_externo IN (SELECT conta_ext FROM _rh_camp);

  -- Abre ou atualiza (mantém o "dispensado" enquanto a condição persistir)
  INSERT INTO rh_campanha_alertas (chave, campanha_id, conta_id_externo, tipo, severidade, mensagem, detalhe)
  SELECT chave, campanha_id, conta_id_externo, tipo, severidade, mensagem, detalhe FROM _rh_alertas_calc
  ON CONFLICT (chave) WHERE resolvido_em IS NULL
  DO UPDATE SET severidade = EXCLUDED.severidade, mensagem = EXCLUDED.mensagem,
                detalhe = EXCLUDED.detalhe, atualizado_em = now();

  -- Fecha o que deixou de valer
  UPDATE rh_campanha_alertas a
     SET resolvido_em = now(), atualizado_em = now()
   WHERE a.resolvido_em IS NULL
     AND NOT EXISTS (SELECT 1 FROM _rh_alertas_calc c WHERE c.chave = a.chave);

  SELECT count(*) INTO abertos FROM rh_campanha_alertas WHERE resolvido_em IS NULL;
  RETURN abertos;
END;
$$;

REVOKE ALL ON FUNCTION public.rh_verificar_campanhas() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rh_verificar_campanhas() TO service_role;

-- Agenda: 20 min depois de cada sincronização do Marketing (0-2h, 6h e 9-23h UTC)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'rh-verificar-campanhas';
    PERFORM cron.schedule('rh-verificar-campanhas', '20 0-2,6,9-23 * * *', 'select public.rh_verificar_campanhas()');
  END IF;
END $$;
