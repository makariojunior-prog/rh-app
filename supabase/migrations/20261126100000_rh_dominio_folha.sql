-- Exportação da Folha para a Domínio Sistemas ("Importação Arquivo Texto | De Lançamentos",
-- solução 8813). Guarda o código do empregado na Domínio em cada colaborador e, por empresa,
-- o código da empresa + o De-Para das rubricas do rh-app para os códigos de rubrica da Domínio.

-- Código do empregado na Domínio (opcional; sem ele o colaborador não entra no arquivo).
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS codigo_dominio text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.colaboradores'::regclass
       AND conname = 'colaboradores_codigo_dominio_check'
  ) THEN
    ALTER TABLE public.colaboradores
      ADD CONSTRAINT colaboradores_codigo_dominio_check
      CHECK (codigo_dominio IS NULL OR codigo_dominio ~ '^[0-9]{1,10}$');
  END IF;
END $$;

COMMENT ON COLUMN public.colaboradores.codigo_dominio
  IS 'Código do empregado na Domínio Sistemas (posições 003-012 do registro 10).';

-- Configuração da exportação, uma linha por empresa.
CREATE TABLE IF NOT EXISTS public.dominio_config (
  empresa_id           text PRIMARY KEY CHECK (empresa_id IN ('cantina', 'lumar')),
  codigo_empresa       text CHECK (codigo_empresa IS NULL OR codigo_empresa ~ '^[0-9]{1,10}$'),
  tipo_processo_padrao text NOT NULL DEFAULT '11'
                         CHECK (tipo_processo_padrao IN ('11', '41', '42', '51', '52')),
  incluir_dias_falta   boolean NOT NULL DEFAULT true,
  rubricas             jsonb NOT NULL DEFAULT '{}'::jsonb,  -- chave_interna -> codigo_rubrica_dominio
  atualizado_em        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.dominio_config
  IS 'Exportação da Folha para a Domínio Sistemas: código da empresa e De-Para das rubricas.';
COMMENT ON COLUMN public.dominio_config.rubricas
  IS 'Mapa chave da rubrica no rh-app (ex.: horas_extras) -> código da rubrica na Domínio.';
COMMENT ON COLUMN public.dominio_config.incluir_dias_falta
  IS 'Emitir o registro 11 (datas de falta e de DSR) sob a rubrica de faltas.';

ALTER TABLE public.dominio_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rh_member_all ON public.dominio_config;
CREATE POLICY rh_member_all ON public.dominio_config
  FOR ALL TO authenticated
  USING ((SELECT public.rh_is_member())) WITH CHECK ((SELECT public.rh_is_member()));

-- GRANT explícito: desde 30/10/2026 o Supabase não concede acesso à API de Dados
-- automaticamente no schema public (sem isto a API devolve "permission denied").
REVOKE ALL ON public.dominio_config FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dominio_config TO authenticated, service_role;
