-- =====================================================================
-- RH-App · Migração 2026-09-14 — Forma de desconto dos Adiantamentos Avulsos
-- Hoje todo adiantamento "pendente" é incluído e marcado como descontado
-- automaticamente ao salvar a Folha do mês de referência, mesmo quando a
-- observação registrada diz o contrário (ex.: "descontar no 13º salário",
-- "descontar na rescisão"). Adiciona uma forma_desconto explícita para tirar
-- esses casos do desconto automático mensal, mantendo-os visíveis como
-- pendência até serem baixados manualmente. Aditiva e idempotente.
-- =====================================================================

alter table public.adiantamentos
  add column if not exists forma_desconto text not null default 'folha_mensal';

do $ck$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'adiantamentos_forma_desconto_check'
  ) then
    alter table public.adiantamentos
      add constraint adiantamentos_forma_desconto_check
      check (forma_desconto in ('folha_mensal','13_salario','rescisao','outro'));
  end if;
end $ck$;

-- Reclassifica registros existentes cuja observação já indicava desconto
-- especial, para que deixem de ser descontados automaticamente na folha
-- mensal a partir de agora.
update public.adiantamentos
set forma_desconto = '13_salario'
where forma_desconto = 'folha_mensal'
  and obs is not null
  and (obs ilike '%13%sal%' or obs ilike '%decimo%terc%' or obs ilike '%décimo%terc%');

update public.adiantamentos
set forma_desconto = 'rescisao'
where forma_desconto = 'folha_mensal'
  and obs is not null
  and obs ilike '%rescis%';
