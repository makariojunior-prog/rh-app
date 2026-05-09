/**
 * backup.js — Backup diário do RH-App para o NAS
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
const SUPABASE_URL  = process.env.SUPABASE_URL  || 'https://SEU_PROJETO.supabase.co';
const SUPABASE_KEY  = process.env.SUPABASE_KEY  || 'SUA_ANON_KEY';
const EMPRESA_ID    = process.env.EMPRESA_ID    || 'cantina';
// Pasta de destino: caminho local ou drive mapeado do NAS (ex: Z:\RH-App-Backup)
const BACKUP_DIR    = process.env.BACKUP_DIR    || path.join(__dirname, 'dados');
// Quantos dias de histórico manter (mais antigos são removidos)
const MANTER_DIAS   = parseInt(process.env.MANTER_DIAS || '60');
// ─────────────────────────────────────────────────────────────────────────────

// nome: tabela no Supabase
// order: coluna usada para ordenar (garantir ordem determinística no JSON)
// limit: máximo de registros (registros_ponto e folha_mensal podem ser grandes)
const TABELAS = [
  { nome: 'colaboradores',    order: 'id',       limit: 10000 },
  { nome: 'atestados',        order: 'id',       limit: 10000 },
  { nome: 'ferias',           order: 'id',       limit: 10000 },
  { nome: 'adiantamentos',    order: 'id',       limit: 10000 },
  { nome: 'historico_salario',order: 'id',       limit: 10000 },
  { nome: 'candidatos',       order: 'id',       limit: 10000 },
  { nome: 'entrevistas',      order: 'id',       limit: 10000 },
  { nome: 'logs',             order: 'id',       limit: 10000 },
  // ── tabelas adicionadas após mai/2026 ─────────────────────
  { nome: 'perfis',           order: 'id',       limit: 10000 },
  { nome: 'compras',          order: 'id',       limit: 10000 },
  { nome: 'folha_mensal',     order: 'periodo',  limit: 50000 },
  { nome: 'registros_ponto',  order: 'data',     limit: 50000 },
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
  // Node 14+ supports fs.rmSync recursive
  if (fs.rmSync) {
    fs.rmSync(dir, { recursive: true, force: true });
  } else {
    // Fallback para versões mais antigas
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
  const dateStr = now.toISOString().slice(0, 10);                       // 2026-05-02
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-');    // 02-30-00
  const destDir = path.join(BACKUP_DIR, dateStr);

  // Criar diretórios
  fs.mkdirSync(destDir, { recursive: true });

  console.log(`\n╔══════════════════════════════════════════════════╗`);
  console.log(`║  RH-App Backup  —  ${dateStr} ${timeStr}  ║`);
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

  // Arquivo único com tudo (útil para restauração)
  fs.writeFileSync(path.join(destDir, '_backup_completo.json'), JSON.stringify(completo, null, 2), 'utf8');
  // Resumo do backup
  fs.writeFileSync(path.join(destDir, '_resumo.json'), JSON.stringify(resumo, null, 2), 'utf8');

  console.log(`\n  Total: ${totalRecs} registros em ${TABELAS.length} tabelas`);

  if (resumo.erro === null && Object.values(resumo.tabelas).some(v => String(v).startsWith('ERRO'))) {
    resumo.erro = 'Uma ou mais tabelas falharam — verifique _resumo.json';
  }

  // ── Rotação: remover backups mais antigos que MANTER_DIAS ────────────────
  const pastasDia = fs.readdirSync(BACKUP_DIR)
    .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();                                     // ordem crescente (mais antigo primeiro)

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
