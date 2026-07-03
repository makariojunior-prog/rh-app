# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Single-file React SPA for HR management at **Cantina em Casa / Lumar Alimentos** (Brazilian food company). Modules: Dashboard, Colaboradores, Vale Transporte (VT), Folha de Pagamento (payroll), Banco de Ponto, Férias, Atestados, Adiantamentos/Antecipações, Compras, Recrutamento, Relatórios, Orçamento, Comissões, Termos de Assinatura, Acessos e Configurações. All UI and logic is in Portuguese (Brazilian).

## Running the App

No build step — open `index.html` directly in a browser (`file://` works) or serve statically. React 18, ReactDOM, Babel (in-browser transpile), jsPDF and the Supabase JS client are loaded from CDN. `package.json` exists but only pins helper deps; the app runs without `npm install`.

## Architecture

The whole app is one large file: `index.html` (~7,100 lines). Structure inside the `<script type="text/babel">`:

- **Utility functions** (top) — `parseCSV()`, `parsePontoDetalhado()`, `upsertRegistrosPonto()`, `calcINSS()`, `calcFGTS()`, `calcPericulosidade()`, `calcularFeriadosBR()`, `fmtBRL()`, `fmtDate()`, `maskCPF()`, `validateCPF()`.
- **`App()`** — root component: auth gate, sidebar, per-page routing, VT module, and most shared state.
- **Page components** — `DashboardPage`, `ColaboradoresPage`, `FolhaPage` (+ `PainelColaborador`), `PontoPage`, `FeriasPage`, `AtestadosPage`, `AdiantamentosPage`, `ComprasPage`, `RecrutamentoPage`, `RelatoriosPage`, `OrcamentoPage`, `ComissoesPage`, `TermosPage`, `AcessosPage`, `ConfiguracoesPage`, `AjudaPage`, `LoginPage`, `NovaSenhaPage`.
- A separate public jobs form lives in `vagas/index.html` (candidates insert into `candidatos` + upload résumés to the `curriculos` storage bucket, as anon).

## Backend — Supabase

The app uses **Supabase** (Postgres + Auth + Storage) as its backend, not Google Sheets. Client is created at the top of `index.html` with `SUPA_URL` + the public `anon` key. Auth is email/password via `_supa.auth`. After login, `perfis` holds the user's `role` (admin/usuario), `empresa_id`, allowed `paginas`, and `dark_mode`.

- **Multi-tenant** via `empresa_id` (values `cantina` / `lumar`). The same Supabase project also hosts a separate CRM app (`crm_*`, `varejo_*`, `atacado_*`, `deals`, `visits`, …) — do not change those tables/policies when working on RH.
- **Security note:** page-level permissions (admin vs usuario, `paginas`) are enforced only in the React client. Real isolation must come from Row Level Security. RH tables are restricted to the `authenticated` role; per-`empresa_id` isolation is a recommended follow-up.

## State & Persistence

Primary data lives in Supabase. `localStorage` (`rh_` prefixed keys) is used for UI/session cache and for a few client-only settings — notably feriados (`rh_feriados`), folha marcações/ajustes (`rh_folha_marc`, `rh_folha_ajustes`), and a colaborador cache (`rh_colab_api`).

## Data Flow (Folha / Ponto)

1. User imports the punch-clock CSV (columns: Cracha, Nome, Data, Entrada/Saída, batidas, Hora Extra) in **Banco de Ponto** or VT.
2. `parsePontoDetalhado()` maps batidas per employee/day; `upsertRegistrosPonto()` persists to `registros_ponto`.
3. **Folha de Pagamento** reads `registros_ponto` for the period (26th of prev month → 25th of ref month). Statuses can be adjusted: trabalhou / falta / atestado / atestado_meio / férias / folga / abono.
4. Brazilian public holidays auto-calculated via Meeus/Jones/Butcher Easter algorithm (`calcularFeriadosBR`).
5. `calcularColab()` computes payroll metrics: DSR loss, CAJU days, extra hours, assiduidade, descontos.
6. Export: CSV (semicolon-delimited for Excel) and PDF (jsPDF / browser print). Folha can be saved to `folha_mensal`.

## Key Constants

- Company name / VT passage value / DSR value are stored in `App` state and editable in ⚙️ Configurações (VT default `R$ 4,30`, DSR default `R$ 7,20`).
