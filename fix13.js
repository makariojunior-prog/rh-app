const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
let ok = 0, fail = 0;

function rep(label, old, novo) {
  if (!html.includes(old)) { console.error('✗ NOT FOUND: ' + label); fail++; return; }
  html = html.replace(old, novo);
  console.log('✓ ' + label); ok++;
}

// ══════════════════════════════════════════════════════════════
// 1. GAS doPost: add 'backup' type handler before unknown-type fallback
// ══════════════════════════════════════════════════════════════
rep('GAS doPost add backup handler',
`    return _resp({ok:false, msg:'Tipo desconhecido: ' + tipo});
  } catch (err) {
    return _resp({ok:false, msg:err.message});
  }
}\``,
`    if (tipo === 'backup') {
      var tabelas = dados.tabelas || {};
      var nomeTabelas = Object.keys(tabelas);
      nomeTabelas.forEach(function(nomeTabela) {
        var rows = tabelas[nomeTabela] || [];
        var nomAba = 'BKP_' + nomeTabela.toUpperCase();
        var aba = ss.getSheetByName(nomAba);
        if (!aba) {
          aba = ss.insertSheet(nomAba);
        } else {
          aba.clearContents();
        }
        if (rows.length === 0) {
          aba.getRange(1,1).setValue('(sem registros — ' + agora + ')');
          return;
        }
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
      });
      // Log do backup
      var logAba = ss.getSheetByName('BKP_LOG');
      if (!logAba) {
        logAba = ss.insertSheet('BKP_LOG');
        logAba.appendRow(['Data/Hora','Usuário','Tabelas exportadas','Total registros','Status']);
        logAba.getRange(1,1,1,5).setBackground('#1e3a5f').setFontColor('#ffffff').setFontWeight('bold');
      }
      var totalRecs = nomeTabelas.reduce(function(acc, t){ return acc + (tabelas[t]?tabelas[t].length:0); }, 0);
      logAba.appendRow([agora, dados.usuario||'sistema', nomeTabelas.join(', '), totalRecs, 'OK']);
      return _resp({ok:true, msg:'Backup realizado em ' + agora + ' (' + totalRecs + ' registros em ' + nomeTabelas.length + ' tabelas)'});
    }

    return _resp({ok:false, msg:'Tipo desconhecido: ' + tipo});
  } catch (err) {
    return _resp({ok:false, msg:err.message});
  }
}\``
);

// ══════════════════════════════════════════════════════════════
// 2. ConfiguracoesPage: add empresaId prop + backup state + function
// ══════════════════════════════════════════════════════════════
rep('ConfiguracoesPage add backup state and function',
`      function ConfiguracoesPage({ gasUrl, setGasUrl, empresa, setEmpresa, responsavel, setResponsavel, passagemStr, setPassagemStr, copiedScript, setCopiedScript }) {
        return (`,
`      function ConfiguracoesPage({ gasUrl, setGasUrl, empresa, setEmpresa, responsavel, setResponsavel, passagemStr, setPassagemStr, copiedScript, setCopiedScript, empresaId }) {
        const [statusBkp, setStatusBkp] = React.useState(null);
        const [loadingBkp, setLoadingBkp] = React.useState(false);
        const realizarBackupSheets = async () => {
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
        };
        return (`
);

// ══════════════════════════════════════════════════════════════
// 3. ConfiguracoesPage JSX: add backup card before Empresa card
// ══════════════════════════════════════════════════════════════
rep('ConfiguracoesPage add backup card JSX',
`            <div style={s.card}>
              <div style={s.cardTitle}>🏢 Empresa</div>`,
`            <div style={s.card}>
              <div style={s.cardTitle}>📤 Backup para Google Sheets</div>
              <div style={s.infoBox}>
                Exporta <strong>todos os dados</strong> do banco (colaboradores, atestados, férias, adiantamentos, histórico salarial, candidatos, entrevistas e log de auditoria) para abas <strong>BKP_*</strong> na sua planilha do Google Sheets.
                Execute após salvar o GAS atualizado.
              </div>
              <div style={{display:'flex',alignItems:'center',gap:12,marginTop:14}}>
                <button
                  onClick={realizarBackupSheets}
                  disabled={loadingBkp}
                  style={{...s.btnAcc,opacity:loadingBkp?0.6:1}}
                >
                  {loadingBkp?'⏳ Exportando...':'📤 Exportar agora para Sheets'}
                </button>
              </div>
              {statusBkp&&(
                <div style={{marginTop:10,padding:'9px 14px',borderRadius:6,fontSize:13,
                  background:statusBkp.ok===true?'#D1FAE5':statusBkp.ok===false?'#FEE2E2':'#FEF3C7',
                  color:statusBkp.ok===true?'#065F46':statusBkp.ok===false?'#991B1B':'#92400E'}}>
                  {statusBkp.msg}
                </div>
              )}
            </div>

            <div style={s.card}>
              <div style={s.cardTitle}>🏢 Empresa</div>`
);

// ══════════════════════════════════════════════════════════════
// 4. App routing: pass empresaId to ConfiguracoesPage
// ══════════════════════════════════════════════════════════════
rep('App routing pass empresaId to ConfiguracoesPage',
`{page==="config"&&isAdmin&&<ConfiguracoesPage gasUrl={gasUrl} setGasUrl={setGasUrl} empresa={empresa} setEmpresa={setEmpresa} responsavel={responsavel} setResponsavel={setResponsavel} passagemStr={passagemStr} setPassagemStr={setPassagemStr} copiedScript={copiedScript} setCopiedScript={setCopiedScript}/>}`,
`{page==="config"&&isAdmin&&<ConfiguracoesPage gasUrl={gasUrl} setGasUrl={setGasUrl} empresa={empresa} setEmpresa={setEmpresa} responsavel={responsavel} setResponsavel={setResponsavel} passagemStr={passagemStr} setPassagemStr={setPassagemStr} copiedScript={copiedScript} setCopiedScript={setCopiedScript} empresaId={empresaId}/>}`
);

fs.writeFileSync('index.html', html);
console.log('\n' + ok + ' OK | ' + fail + ' falhas | Tamanho: ' + html.length);
