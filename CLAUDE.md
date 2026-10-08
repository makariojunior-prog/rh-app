# CLAUDE.md

SPA de RH da **Cantina em Casa / Lumar Alimentos**, em um único arquivo: `index.html`
(~11.250 linhas, 798 KB). Interface e lógica em português (BR).

## ⚠️ Como trabalhar no index.html

**Nunca leia o arquivo inteiro** (passa de 200k tokens). Localize com Grep e leia com
`offset`/`limit`:

- Componente: `Grep "function NomePage"`.
- Linhas abaixo são aproximadas (o arquivo cresce) — confirme com Grep antes de ler.
- Edições: faça `Edit` pontual; não reescreva blocos grandes.

Mapa (linha aprox.): constantes/Supabase 1–125 · utilitários 184–440 (`fmtBRL`, `fmtDate`,
`maskCPF`, `validateCPF`, helpers de documentos/termos `enviarArquivoRH`/`preencherTermo` ~200–260,
`parseCSV` 266, `parsePontoDetalhado` 303, `upsertRegistrosPonto` 329, `calcINSS` 408, `calcFGTS`,
`calcPericulosidade`) · `DashboardPage` 481 · `AjudaPage` 1107 · `LoginPage` 1356 ·
`DocumentosColaborador` 1612 · `ColaboradoresPage` 1752 · `AcessosPage` 2717 · `AtestadosPage` 3060 ·
`FeriasPage` 3276 · `RecrutamentoPage` 3430 · `AdiantamentosPage` 4001 · `GratificacoesTab` 4489 ·
`RelatoriosPage` 4843 · `ComprasPage` 5230 · `FuncoesPage` 5538 · `NormasPage` 5905 ·
`ExamesPage` 6207 · `PontoPage` 7486 · `TermosPage` 7846 · `FolhaPage` 8106
(`calcularColab` ~8431) · `PainelColaborador` 9359 · `OrcamentoPage` 9501 ·
`ConfiguracoesPage` 9673 · `ComissoesPage` 9727 · `App()` 10184 (login, sidebar, roteamento, VT).

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

## Manutenção deste arquivo (lembrete ao usuário)

O mapa de linhas acima envelhece. **Ao terminar uma tarefa que criou uma nova `...Page`, ou que
adicionou/removeu mais de ~100 linhas no `index.html`, rode** `Grep "^\s*function [A-Z]\w+\("` em
`index.html`, compare com o mapa e, se alguma âncora estiver a mais de ~150 linhas do valor
registrado, **avise o usuário** (uma frase) e ofereça atualizar o mapa e o total de linhas.
Se este arquivo passar de ~80 linhas, avise também.
