const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
let ok = 0, fail = 0;

function rep(label, old, novo) {
  if (!html.includes(old)) { console.error('✗ NOT FOUND: ' + label); fail++; return; }
  html = html.replace(old, novo);
  console.log('✓ ' + label); ok++;
}

// ══════════════════════════════════════════════════════════════
// 1. GAS: add SUPABASE_URL and SUPABASE_KEY constants
// ══════════════════════════════════════════════════════════════
rep('GAS add Supabase constants',
`var SPREADSHEET_ID = '1I_dQgjotKP4s-y_8z9gPAT8gTZlwEcNLBBv23dsSBDU';`,
`var SPREADSHEET_ID = '1I_dQgjotKP4s-y_8z9gPAT8gTZlwEcNLBBv23dsSBDU';
var SUPABASE_URL   = 'https://taicaxtjtikdajmhtsxc.supabase.co';
var SUPABASE_KEY   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhaWNheHRqdGlrZGFqbWh0c3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MjgwNzcsImV4cCI6MjA5MzAwNDA3N30.G923g-1cmjrQZi7EoOcZcP1PieO9AKmk4mMMUgT4hbE';`
);

// ══════════════════════════════════════════════════════════════
// 2. GAS doGet: add ?acao=backup handler (GAS pulls from Supabase, writes to Sheets)
// ══════════════════════════════════════════════════════════════
rep('GAS doGet add backup handler',
`    return _resp({ ok: false, msg: 'Ação desconhecida: ' + acao });
  } catch (err) {
    return _resp({ ok: false, msg: err.message });
  }
}`,
`    if (acao === 'backup') {
      var empresaIdBkp = e.parameter.empresa_id || 'cantina';
      var agora = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm');
      var TABELAS_BKP = ['colaboradores','atestados','ferias','adiantamentos','historico_salario','candidatos','entrevistas','logs'];
      var totalRecs = 0;
      var erros = [];

      TABELAS_BKP.forEach(function(tabela) {
        try {
          var url = SUPABASE_URL + '/rest/v1/' + tabela
            + '?select=*&empresa_id=eq.' + encodeURIComponent(empresaIdBkp) + '&limit=10000';
          var respSupa = UrlFetchApp.fetch(url, {
            method: 'GET',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': 'Bearer ' + SUPABASE_KEY,
              'Accept': 'application/json'
            },
            muteHttpExceptions: true
          });
          var rows = JSON.parse(respSupa.getContentText());
          if (!Array.isArray(rows)) rows = [];

          var nomAba = 'BKP_' + tabela.toUpperCase();
          var aba = ss.getSheetByName(nomAba);
          if (!aba) {
            aba = ss.insertSheet(nomAba);
          } else {
            aba.clearContents();
          }

          if (rows.length > 0) {
            var headers = Object.keys(rows[0]);
            var matrix = [headers].concat(rows.map(function(r) {
              return headers.map(function(h) {
                var v = r[h];
                if (v === null || v === undefined) return '';
                if (typeof v === 'object') return JSON.stringify(v);
                return String(v);
              });
            }));
            aba.getRange(1, 1, matrix.length, headers.length).setValues(matrix);
            aba.getRange(1, 1, 1, headers.length)
              .setBackground('#1e3a5f').setFontColor('#ffffff').setFontWeight('bold');
          } else {
            aba.getRange(1,1).setValue('(sem registros — ' + agora + ')');
          }
          totalRecs += rows.length;
        } catch(errTabela) {
          erros.push(tabela + ': ' + errTabela.message);
        }
      });

      // Log do backup
      var logAba = ss.getSheetByName('BKP_LOG');
      if (!logAba) {
        logAba = ss.insertSheet('BKP_LOG');
        logAba.appendRow(['Data/Hora','Empresa','Total registros','Erros','Status']);
        logAba.getRange(1,1,1,5).setBackground('#1e3a5f').setFontColor('#ffffff').setFontWeight('bold');
      }
      logAba.appendRow([agora, empresaIdBkp, totalRecs, erros.join('; ') || '—', erros.length===0?'OK':'PARCIAL']);

      var msg = 'Backup realizado em ' + agora + ' (' + totalRecs + ' registros em ' + TABELAS_BKP.length + ' tabelas)';
      if (erros.length > 0) msg += ' — erros: ' + erros.join(', ');
      return _resp({ ok: erros.length === 0, msg: msg, total: totalRecs });
    }

    return _resp({ ok: false, msg: 'Ação desconhecida: ' + acao });
  } catch (err) {
    return _resp({ ok: false, msg: err.message });
  }
}`
);

// ══════════════════════════════════════════════════════════════
// 3. React: replace realizarBackupSheets with simple GET (GAS now pulls from Supabase itself)
// ══════════════════════════════════════════════════════════════
rep('React realizarBackupSheets use GET',
`        const realizarBackupSheets = async () => {
          if (!gasUrl) { setStatusBkp({ok:false,msg:'Configure a URL do GAS primeiro.'}); return; }
          setLoadingBkp(true); setStatusBkp({ok:null,msg:'⏳ Lendo dados do banco...'});
          try {
            const TABELAS = ['colaboradores','atestados','ferias','adiantamentos','historico_salario','candidatos','entrevistas','logs'];
            const tabelas = {};
            for (const t of TABELAS) {
              try {
                const {data} = await _supa.from(t).select('*').eq('empresa_id', empresaId).limit(5000);
                tabelas[t] = data || [];
              } catch(e) { tabelas[t] = []; }
            }
            const {data:sess} = await _supa.auth.getSession();
            const usuario = sess?.session?.user?.email || 'admin';
            setStatusBkp({ok:null,msg:'⏳ Enviando para Google Sheets...'});
            await fetch(gasUrl, {method:'POST', mode:'no-cors', body:JSON.stringify({tipo:'backup', tabelas, usuario})});
            const total = Object.values(tabelas).reduce((a,b)=>a+b.length,0);
            setStatusBkp({ok:true,msg:'✅ Backup enviado! ' + total + ' registros exportados. Verifique as abas BKP_* na planilha.'});
          } catch(e) { setStatusBkp({ok:false,msg:'❌ Erro: '+e.message}); }
          setLoadingBkp(false);
        };`,
`        const realizarBackupSheets = async () => {
          if (!gasUrl) { setStatusBkp({ok:false,msg:'Configure a URL do GAS primeiro.'}); return; }
          setLoadingBkp(true); setStatusBkp({ok:null,msg:'⏳ Solicitando backup ao GAS (pode levar ~30s)...'});
          try {
            const resp = await fetch(gasUrl + '?acao=backup&empresa_id=' + encodeURIComponent(empresaId));
            const json = await resp.json();
            setStatusBkp(json.ok
              ? {ok:true, msg:'✅ ' + json.msg}
              : {ok:false, msg:'❌ ' + json.msg});
          } catch(e) { setStatusBkp({ok:false,msg:'❌ Erro: '+e.message}); }
          setLoadingBkp(false);
        };`
);

fs.writeFileSync('index.html', html);
console.log('\n' + ok + ' OK | ' + fail + ' falhas | Tamanho: ' + html.length);
