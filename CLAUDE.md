# CLAUDE.md

SPA de RH da **Cantina em Casa / Lumar Alimentos**, em um único arquivo: `index.html`
(~13.660 linhas, 944 KB). Interface e lógica em português (BR).

## ⚠️ Como trabalhar no index.html

**Nunca leia o arquivo inteiro** (passa de 200k tokens). Localize com Grep e leia com
`offset`/`limit`:

- Componente: `Grep "function NomePage"`.
- Linhas abaixo são aproximadas (o arquivo cresce) — confirme com Grep antes de ler.
- Edições: faça `Edit` pontual; não reescreva blocos grandes.

Mapa (linha aprox.): constantes/Supabase 1–125 · utilitários 214–535 (`fmtBRL` 233, `fmtDate`,
`maskCPF`, `validateCPF`, helpers de documentos/termos `enviarArquivoRH` 269/`preencherTermo` 294,
`parseCSV` 333, `parsePontoDetalhado` 370, `upsertRegistrosPonto` 396, `calcINSS` 475, `calcFGTS` 494,
`calcPericulosidade` 497) · `DashboardPage` 548 · `AjudaPage` 1178 · `LoginPage` 1427 ·
`DocumentosColaborador` 1683 · `ColaboradoresPage` 1856 · `AcessosPage` 2822 · `AtestadosPage` 3165 ·
`FeriasPage` 3381 · `RecrutamentoPage` 3535 (`CampanhasRecrutamentoTab` 4390: publicar/pausar/excluir,
ajuste da arte pela IA, alertas e análise de desempenho) ·
`AdiantamentosPage` 6191 · `GratificacoesTab` 6679 · `RelatoriosPage` 7033 · `ComprasPage` 7420 ·
`FuncoesPage` 7728 · `DocumentosLegaisEmpresa` 8101 · `NormasPage` 8218 · `ExamesPage` 8522 ·
`PontoPage` 9801 · `TermosPage` 10161 · `FolhaPage` 10421 (`calcularColab` ~10746) ·
`PainelColaborador` 11674 · `OrcamentoPage` 11816 · `ConfiguracoesPage` 11988 ·
`ComissoesPage` 12042 · `App()` 12573 (login, sidebar, roteamento, VT).

Vagas públicas: `vagas/index.html` é cópia — o site oficial (GitHub Pages) está no repo `vagas-cantina` (candidatos anônimos → tabela `candidatos` + bucket
`curriculos`). Migrations SQL do RH em `sql/`; edge functions em `supabase/functions` (`rh-usuarios`, `rh-campanha-ia`, `rh-campanha-analise`).
Backup do Supabase: scripts em `backup/`, documentação em `docs/backup/`.

## Executar

Dev sem build: abra `index.html` (ou `python3 -m http.server 4599`) — o Babel do CDN transpila
o JSX no navegador. Produção: a Vercel roda `npm run build` (`scripts/build.mjs`), que
pré-compila o `<script type="text/babel">` com as mesmas opções do Babel do navegador e publica
só `dist/` (index sem Babel + `app.<hash>.js` com cache imutável, `vagas/`, ícones). Testes do
build: `npm test`. jsPDF é carregado sob demanda (`carregarJsPDF`). Cabeçalhos em `vercel.json`.

## Backend — Supabase compartilhado

Projeto `taicaxtjtikdajmhtsxc`, também usado pelo CRM (`crm_*`, `varejo_*`, `atacado_*`, `deals`,
`visits`…) e pelo Compras (`compras_*`) — **não altere tabelas/políticas desses domínios**.
(`compras` e `compras_alertas` são do RH: compras de funcionários descontadas em folha.)

- Auth e-mail/senha (`_supa.auth`). `perfis` guarda `role` (admin/usuario), `empresa_id`
  (`cantina`/`lumar`), `paginas` permitidas e `dark_mode`.
- RLS: tabelas do RH exigem `rh_is_member()` (perfil com role admin ou `paginas` não vazio);
  `perfis` só o próprio (sem mudar papel/páginas — gatilho `rh_perfis_guard`) ou `rh_is_admin()`.
  Permissão por página ainda é só no cliente; isolamento por `empresa_id` é pendência.
- Buckets privados: `exames-aso`, `rh-documentos`, `curriculos` (abrir com `abrirCurriculo`).
  Migrations novas em `supabase/migrations/`.
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

## Supabase: GRANT explícito em tabelas novas (desde 30/10/2026)

O Supabase deixou de conceder acesso à API de Dados (supabase-js, PostgREST, GraphQL) automaticamente a tabelas novas em `public`. Sem GRANT a API devolve "permission denied". Tabelas anteriores a essa data não mudam. Vale também para migrations que recriam o schema (projeto novo, branch de preview, `supabase db reset`).

**Regra:** toda migration que cria tabela ou view em `public` traz os GRANTs na mesma migration.

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.minha_tabela TO authenticated, service_role;
-- view: GRANT SELECT ON public.minha_view TO authenticated, service_role;
-- só backend: REVOKE ALL ON public.minha_tabela FROM PUBLIC, anon, authenticated;
--             GRANT ALL ON public.minha_tabela TO service_role;
```

- Não conceder nada a `anon`, a menos que a leitura pública seja intencional (a RLS continua sendo a proteção de linha).
- Funções: `REVOKE ALL ... FROM PUBLIC` e `GRANT EXECUTE` só a quem precisa.
- Se a migration antiga foi escrita sem GRANT e o schema for recriado, rode um GRANT em lote nas tabelas existentes.
