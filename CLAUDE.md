# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Single-file React SPA for HR management at **Cantina em Casa / Lumar Alimentos** (Brazilian food company). Handles Vale Transporte (transportation vouchers), Folha de Pagamento (payroll), and employee attendance tracking. All UI and logic is in Portuguese (Brazilian).

## Running the App

No build step — open `index.html` directly in a browser (`file://` protocol works). React 18, ReactDOM, and Babel are loaded from CDN. No package.json or dependencies to install.

## Architecture

Everything lives in `index.html` (~1,800 lines). Structure:

- **Utility functions** (top of `<script>`) — `parseCSV()`, `parseCSVFolha()`, `calcularColab()`, `analisarDia()`, `fmtBRL()`, `fmtDate()`
- **`App()`** — root component, holds all state, renders sidebar + active page
- **`FolhaPage()`** — payroll module (collaborator list, day marking, adjustments)
- **`PainelColaborador()`** — employee detail panel (day-by-day attendance, totals)
- **`PlaceholderPage()`** — stub for unimplemented pages (Férias, Atestados, Histórico)

## State & Persistence

All data is persisted to `localStorage` with `rh_` prefixed keys. React `useEffect` hooks sync state to/from localStorage on mount and on change. No backend — the app is fully offline-capable.

## Data Flow

1. User uploads CSV from electronic punch clock (columns: Cracha, Nome, Data, Entrada1, Saída1, etc.)
2. `parseCSV()` / `parseCSVFolha()` normalize names and map attendance per employee per day
3. User manually adjusts statuses: worked / absent / sick / vacation / holiday
4. Brazilian public holidays auto-calculated via Meeus/Jones/Butcher Easter algorithm
5. `calcularColab()` computes payroll metrics: DSR loss, CAJU days, extra hours, absences
6. Export: CSV (semicolon-delimited for Excel), PDF via browser print, or POST to Google Sheets via Google Apps Script Web App

## Key Constants (hardcoded in `App` state)

- Company name: `"Cantina em Casa / Lumar Alimentos"`
- VT value per passage: `R$ 4,30`
- GAS endpoint and Google Sheet ID are stored in component state and can be changed via the UI settings tab

## Google Sheets Integration

Uses a Google Apps Script Web App (GAS) deployed as a POST endpoint. The URL is stored in `gasUrl` state. The `GAS_SCRIPT` constant (near top of file) contains the Apps Script source that should be deployed on the Google side.
