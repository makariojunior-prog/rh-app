@echo off
REM ─────────────────────────────────────────────────────────────────────
REM  backup.bat — Executar pelo Windows Task Scheduler
REM  Salva os backups na pasta mapeada do NAS (ex: Z:\RH-App-Backup)
REM
REM  CONFIGURAR: ajuste as variáveis abaixo antes de usar
REM ─────────────────────────────────────────────────────────────────────

set SUPABASE_URL=https://SEU_PROJETO.supabase.co
set SUPABASE_KEY=SUA_ANON_KEY_AQUI
set EMPRESA_ID=cantina
set BACKUP_DIR=Z:\RH-App-Backup
set MANTER_DIAS=60

REM Caminho deste script
cd /d "%~dp0"

REM Executar o backup e gravar log
node backup.js >> "%BACKUP_DIR%\backup_log.txt" 2>&1

REM Opcional: exibir resultado no console (remova o 'REM' abaixo)
REM type "%BACKUP_DIR%\backup_log.txt"
