# CLAUDE.md

SPA de RH da **Cantina em Casa / Lumar Alimentos**, em um único arquivo: `index.html`
(~10.900 linhas, 780 KB). Interface e lógica em português (BR).

## ⚠️ Como trabalhar no index.html

**Nunca leia o arquivo inteiro** (passa de 200k tokens). Localize com Grep e leia com
`offset`/`limit`:

- Componente: `Grep "function NomePage"`.
- Linhas abaixo são aproximadas (o arquivo cresce) — confirme com Grep antes de ler.
- Edições: faça `Edit` pontual; não reescreva blocos grandes.

Mapa (linha aprox.): constantes/Supabase 1–125 · utilitários 184–380 (`fmtBRL`, `fmtDate`,
`maskCPF`, `validateCPF`, `parseCSV` 211, `parsePontoDetalhado` 248, `upsertRegistrosPonto` 274,
`calcINSS` 353, `calcFGTS`, `calcPericulosidade`) · `DashboardPage` 426 · `AjudaPage` 1015 ·
`LoginPage` 1264 · `ColaboradoresPage` 1519 · `AcessosPage` 2432 · `AtestadosPage` 2775 ·
`FeriasPage` 2991 · `RecrutamentoPage` 3145 · `AdiantamentosPage` 3716 · `GratificacoesTab` 4204 ·
`RelatoriosPage` 4558 · `ComprasPage` 4945 · `FuncoesPage` 5253 · `NormasPage` 5620 ·
`ExamesPage` 5922 · `PontoPage` 7201 · `TermosPage` 7561 · `FolhaPage` 7741
(`calcularColab` ~8066) · `PainelColaborador` 8994 · `OrcamentoPage` 9136 ·
`ConfiguracoesPage` 9308 · `ComissoesPage` 9362 · `App()` 9819 (login, sidebar, roteamento, VT).

Vagas públicas: `vagas/index.html` (candidatos anônimos → tabela `candidatos` + bucket
`curriculos`). Migrations SQL do RH em `sql/`; edge function em `supabase/functions/rh-usuarios`.
Backup do Supabase: scripts em `backup/`, documentação em `docs/backup/`.

## Executar

Sem build: abra `index.html` (ou `python3 -m http.server 4599`). React 18, ReactDOM, Babel
(transpila no navegador), jsPDF e supabase-js vêm de CDN. O `package.json` só fixa
`@supabase/supabase-js` para as scripts de backup — `node_modules` não é versionado.

## Backend — Supabase compartilhado

Projeto `taicaxtjtikdajmhtsxc`, também usado pelo CRM (`crm_*`, `varejo_*`, `atacado_*`, `deals`,
`visits`…) e pelo Compras (`compras_*`) — **não altere tabelas/políticas desses domínios**.
(`compras` e `compras_alertas` são do RH: compras de funcionários descontadas em folha.)

- Auth e-mail/senha (`_supa.auth`). `perfis` guarda `role` (admin/usuario), `empresa_id`
  (`cantina`/`lumar`), `paginas` permitidas e `dark_mode`.
- Permissão por página é só no cliente; o isolamento real deve vir de RLS. Tabelas do RH estão
  restritas ao role `authenticated`; isolamento por `empresa_id` é pendência.
- `localStorage` (`rh_*`) só para cache/UI: `rh_feriados`, `rh_folha_marc`, `rh_folha_ajustes`,
  `rh_colab_api`.

## Fluxo Ponto → Folha

1. CSV do relógio de ponto (Cracha, Nome, Data, batidas, Hora Extra) importado em Banco de Ponto
   ou VT → `parsePontoDetalhado()` → `upsertRegistrosPonto()` grava em `registros_ponto`.
2. `FolhaPage` lê o período (dia 26 do mês anterior a 25 do mês de referência). Status por dia:
   trabalhou / falta / atestado / atestado_meio / férias / folga / abono.
3. Feriados BR via `calcularFeriadosBR` (Páscoa por Meeus/Jones/Butcher).
4. `calcularColab()` calcula perda de DSR, dias CAJU, horas extras, assiduidade e descontos.
5. Exporta CSV (`;`, para Excel) e PDF; a folha pode ser salva em `folha_mensal`.

Padrões (editáveis em ⚙️ Configurações): passagem VT `R$ 4,30`, DSR `R$ 7,20`.
