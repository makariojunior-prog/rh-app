# 📝 TEMPLATE DOS 4 ARQUIVOS DE BACKUP

Use este arquivo como referência. Substitua todos os `[PLACEHOLDER]` pelos seus valores.

---

## ARQUIVO 1: backup.js

```javascript
/**
 * backup.js — Backup diário do [SEU_PROJETO] para o NAS
 *
 * Uso:
 *   node backup.js
 *
 * Configuração: edite as constantes abaixo ou defina variáveis de ambiente.
 * Execute diariamente via Windows Task Scheduler (veja backup.bat) ou
 * Docker no NAS Ugreen (veja docker-compose.yml).
 */
'use strict';
const https = require('https');
const fs    = require('fs');
const path  = require('path');

// ─── CONFIGURAÇÃO ────────────────────────────────────────────────────────────
const SUPABASE_URL  = process.env.SUPABASE_URL  || 'https://[SEU_PROJETO].supabase.co';
const SUPABASE_KEY  = process.env.SUPABASE_KEY  || '[SUA_CHAVE_ANON]';
const EMPRESA_ID    = process.env.EMPRESA_ID    || '[SUA_EMPRESA_ID]';
// Pasta de destino: caminho local ou drive mapeado do NAS (ex: Z:\Seu-Backup)
const BACKUP_DIR    = process.env.BACKUP_DIR    || path.join(__dirname, 'dados');
// Quantos dias de histórico manter (mais antigos são removidos)
const MANTER_DIAS   = parseInt(process.env.MANTER_DIAS || '60');
// ─────────────────────────────────────────────────────────────────────────────

// ADAPTE ESTA LISTA COM AS TABELAS DO SEU PROJETO
// nome: tabela no Supabase
// order: coluna usada para ordenar (garantir ordem determinística no JSON)
// limit: máximo de registros (tabelas grandes usam limit: 50000)
const TABELAS = [
  // ▼▼▼ COLOQUE AQUI AS TABELAS DO SEU PROJETO ▼▼▼
  { nome: '[TABELA_1]', order: 'id', limit: 10000 },
  { nome: '[TABELA_2]', order: 'id', limit: 10000 },
  { nome: '[TABELA_3]', order: 'data', limit: 50000 },
  // ▲▲▲ Adicione todas as tabelas ▲▲▲
];

function fetchTable({ nome: tabela, order = 'id', limit = 10000 }) {
  return new Promise((resolve, reject) => {
    const host  = SUPABASE_URL.replace('https://', '');
    const query = `empresa_id=eq.${encodeURIComponent(EMPRESA_ID)}&limit=${limit}&order=${order}`;
    const options = {
      hostname: host,
      path: `/rest/v1/${tabela}?select=*&${query}`,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Accept': 'application/json',
      },
    };
    https.get(options, (res) => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          try { resolve(JSON.parse(raw)); }
          catch (e) { reject(new Error(`Parse error em ${tabela}: ${raw.slice(0, 300)}`)); }
        } else {
          reject(new Error(`HTTP ${res.statusCode} em ${tabela}: ${raw.slice(0, 200)}`));
        }
      });
    }).on('error', reject);
  });
}

function rmDir(dir) {
  if (fs.rmSync) {
    fs.rmSync(dir, { recursive: true, force: true });
  } else {
    const entries = fs.readdirSync(dir);
    for (const e of entries) {
      const p = path.join(dir, e);
      if (fs.lstatSync(p).isDirectory()) rmDir(p);
      else fs.unlinkSync(p);
    }
    fs.rmdirSync(dir);
  }
}

async function main() {
  const now     = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-');
  const destDir = path.join(BACKUP_DIR, dateStr);

  fs.mkdirSync(destDir, { recursive: true });

  console.log(`\n╔══════════════════════════════════════════════════╗`);
  console.log(`║  [SEU_PROJETO] Backup  —  ${dateStr} ${timeStr}  ║`);
  console.log(`╚══════════════════════════════════════════════════╝`);
  console.log(`   Destino : ${destDir}`);
  console.log(`   Empresa : ${EMPRESA_ID}\n`);

  const resumo = { data: dateStr, hora: timeStr, empresa: EMPRESA_ID, tabelas: {}, erro: null };
  const completo = {};
  let totalRecs = 0;

  for (const tbl of TABELAS) {
    const { nome } = tbl;
    try {
      const dados = await fetchTable(tbl);
      const arquivo = path.join(destDir, `${nome}.json`);
      fs.writeFileSync(arquivo, JSON.stringify(dados, null, 2), 'utf8');
      resumo.tabelas[nome] = dados.length;
      completo[nome] = dados;
      totalRecs += dados.length;
      console.log(`  ✓  ${nome.padEnd(22)} ${String(dados.length).padStart(5)} registros`);
    } catch (e) {
      resumo.tabelas[nome] = `ERRO: ${e.message}`;
      console.error(`  ✗  ${nome.padEnd(22)} ${e.message}`);
    }
  }

  fs.writeFileSync(path.join(destDir, '_backup_completo.json'), JSON.stringify(completo, null, 2), 'utf8');
  fs.writeFileSync(path.join(destDir, '_resumo.json'), JSON.stringify(resumo, null, 2), 'utf8');

  console.log(`\n  Total: ${totalRecs} registros em ${TABELAS.length} tabelas`);

  if (resumo.erro === null && Object.values(resumo.tabelas).some(v => String(v).startsWith('ERRO'))) {
    resumo.erro = 'Uma ou mais tabelas falharam — verifique _resumo.json';
  }

  const pastasDia = fs.readdirSync(BACKUP_DIR)
    .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();

  if (pastasDia.length > MANTER_DIAS) {
    const aRemover = pastasDia.slice(0, pastasDia.length - MANTER_DIAS);
    console.log(`\n  Removendo ${aRemover.length} backup(s) antigo(s):`);
    for (const d of aRemover) {
      try {
        rmDir(path.join(BACKUP_DIR, d));
        console.log(`    🗑  ${d}`);
      } catch (e) {
        console.error(`    ✗  Falha ao remover ${d}: ${e.message}`);
      }
    }
  }

  console.log(`\n✅ Backup concluído com sucesso!\n`);
}

main().catch(e => {
  console.error('\n❌ ERRO FATAL:', e.message);
  process.exit(1);
});
```

---

## ARQUIVO 2: scheduler.js

```javascript
'use strict';
const { spawnSync } = require('child_process');

function runBackup() {
  console.log('\n[' + new Date().toLocaleString('pt-BR') + '] Iniciando backup...');
  const r = spawnSync('node', ['/app/backup.js'], { stdio: 'inherit' });
  if (r.error) console.error('Erro ao executar backup:', r.error.message);
}

function msAte2h() {
  const agora = new Date();
  const prox  = new Date();
  // [TROCAR] se quiser outro horário: setHours(HH, 0, 0, 0)
  prox.setHours(2, 0, 0, 0);
  if (prox <= agora) prox.setDate(prox.getDate() + 1);
  return prox - agora;
}

function agendarProximo() {
  const ms = msAte2h();
  const h  = Math.floor(ms / 3_600_000);
  const m  = Math.floor((ms % 3_600_000) / 60_000);
  console.log('[Scheduler] Próximo backup em ' + h + 'h ' + m + 'min (02:00 horário de Brasília)');
  setTimeout(() => { runBackup(); agendarProximo(); }, ms);
}

console.log('====================================================');
console.log(' [SEU_PROJETO] Backup Scheduler');
console.log(' Backup diário agendado para 02:00 (America/Sao_Paulo)');
console.log('====================================================');

console.log('[Scheduler] Executando backup inicial de verificação...');
runBackup();

agendarProximo();
```

---

## ARQUIVO 3: Dockerfile

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY backup.js .
COPY scheduler.js .
CMD ["node", "/app/scheduler.js"]
```

---

## ARQUIVO 4: docker-compose.yml

```yaml
version: '3.8'

services:
  # [TROCAR] nome do serviço (ex: seu-projeto-backup)
  seu-projeto-backup:
    build: .
    # [TROCAR] nome do container
    container_name: seu-projeto-backup
    restart: always
    environment:
      # [TROCAR] URL e chave do seu Supabase
      SUPABASE_URL: "https://[SEU_PROJETO].supabase.co"
      SUPABASE_KEY: "[SUA_CHAVE_ANON]"
      # [TROCAR] ID da empresa no seu banco
      EMPRESA_ID: "[SUA_EMPRESA_ID]"
      # Quantos dias de histórico manter
      MANTER_DIAS: "60"
      # Timezone para horário de 02:00
      TZ: "America/Sao_Paulo"
      # Pasta dentro do container (não trocar)
      BACKUP_DIR: "/backups"
    volumes:
      # [TROCAR] caminho do NAS para sua pasta
      - /volume1/[SUA_PASTA]/dados:/backups
```

---

## INSTRUÇÕES DE USO

### 1. Copiadores de placeholders (PROCURE E TROQUE TODOS):
```
[SEU_PROJETO]        → seu-novo-projeto
[SUA_CHAVE_ANON]     → eyJhbGciOiJS... (de Project Settings → API)
[SUA_EMPRESA_ID]     → valor que filtra os dados
[TABELA_1]           → nome_da_tabela_1
[TABELA_2]           → nome_da_tabela_2
[SUA_PASTA]          → seu-novo-projeto (na linha /volume1/...)
```

### 2. Testar localmente (antes do NAS):
```bash
mkdir backup
# Copiar os 4 arquivos acima para pasta backup/
cd backup
node backup.js  # deve funcionar sem erros
```

### 3. Se tudo ok, fazer deploy:
```bash
# Copiar pasta backup/ para NAS
docker-compose up -d

# Ver logs
docker logs -f seu-projeto-backup
```

---

**FIM DO TEMPLATE**
