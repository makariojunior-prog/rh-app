const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
let ok = 0, fail = 0;

function rep(label, old, novo) {
  if (!html.includes(old)) { console.error('✗ NOT FOUND: ' + label); fail++; return; }
  html = html.replace(old, novo);
  console.log('✓ ' + label); ok++;
}

// ══════════════════════════════════════════════════════════════
// 1. Add historicoSalario state
// ══════════════════════════════════════════════════════════════
rep('add historicoSalario state',
`        const [historicoAtestados, setHistoricoAtestados] = useState([]);
        const [historicoFerias, setHistoricoFerias] = useState([]);
        const [loadingHistorico, setLoadingHistorico] = useState(false);`,
`        const [historicoAtestados, setHistoricoAtestados] = useState([]);
        const [historicoFerias, setHistoricoFerias] = useState([]);
        const [historicoSalario, setHistoricoSalario] = useState([]);
        const [loadingHistorico, setLoadingHistorico] = useState(false);`
);

// ══════════════════════════════════════════════════════════════
// 2. carregarHistorico: add salary history fetch
// ══════════════════════════════════════════════════════════════
rep('carregarHistorico add salary fetch',
`          try {
            const {data} = await _supa.from('ferias').select('*').eq('empresa_id',empresaId).ilike('colaborador_nome','%'+colab.nome+'%').order('inicio',{ascending:false});
            setHistoricoFerias(data||[]);
          } catch(e) { setHistoricoFerias([]); }
          setLoadingHistorico(false);
        };`,
`          try {
            const {data} = await _supa.from('ferias').select('*').eq('empresa_id',empresaId).ilike('colaborador_nome','%'+colab.nome+'%').order('inicio',{ascending:false});
            setHistoricoFerias(data||[]);
          } catch(e) { setHistoricoFerias([]); }
          try {
            const {data:dataSal} = await _supa.from('historico_salario').select('*').eq('empresa_id',empresaId).ilike('colaborador_nome','%'+colab.nome+'%').order('data_vigencia',{ascending:false});
            setHistoricoSalario(dataSal||[]);
          } catch(e) { setHistoricoSalario([]); }
          setLoadingHistorico(false);
        };`
);

// ══════════════════════════════════════════════════════════════
// 3. abrirNovo: reset historicoSalario
// ══════════════════════════════════════════════════════════════
rep('abrirNovo reset historicoSalario',
`        const abrirNovo = () => { setForm(FORM_VAZIO); setEditando({novo:true}); setStatus(null); setAbaEditar('dados'); setHistoricoAtestados([]); setHistoricoFerias([]); };`,
`        const abrirNovo = () => { setForm(FORM_VAZIO); setEditando({novo:true}); setStatus(null); setAbaEditar('dados'); setHistoricoAtestados([]); setHistoricoFerias([]); setHistoricoSalario([]); };`
);

// ══════════════════════════════════════════════════════════════
// 4. abrirEdicao: reset historicoSalario
// ══════════════════════════════════════════════════════════════
rep('abrirEdicao reset historicoSalario',
`          setEditando(c); setStatus(null); setAbaEditar('dados'); setHistoricoAtestados([]); setHistoricoFerias([]);
        };`,
`          setEditando(c); setStatus(null); setAbaEditar('dados'); setHistoricoAtestados([]); setHistoricoFerias([]); setHistoricoSalario([]);
        };`
);

// ══════════════════════════════════════════════════════════════
// 5. salvar: detect salary change and insert historico_salario
// ══════════════════════════════════════════════════════════════
rep('salvar detect salary change',
`            if(error) throw error;
            const novaLista = editando.novo
              ? [...lista, data].sort((a,b)=>a.nome.localeCompare(b.nome,'pt'))
              : lista.map(x=>x.id===editando.id?data:x);
            setLista(novaLista);
            setColabAPI(novaLista.map(mapearParaApp));
            setStatus({ok:true, msg:editando.novo?"✅ Colaborador adicionado.":"✅ Alterações salvas."});
            setEditando(null);`,
`            if(error) throw error;
            if(!editando.novo){
              const salAnterior = Number(editando.salario)||0;
              const salNovo = parseFloat(String(form.salario).replace(",","."))||0;
              if(salAnterior>0 && Math.abs(salNovo-salAnterior)>0.01){
                const perc = ((salNovo-salAnterior)/salAnterior*100).toFixed(2);
                await _supa.from('historico_salario').insert({
                  empresa_id:empresaId,
                  colaborador_id:editando.id,
                  colaborador_nome:form.nome.trim(),
                  salario_anterior:salAnterior,
                  salario_novo:salNovo,
                  percentual:parseFloat(perc),
                  data_vigencia:new Date().toISOString().slice(0,10)
                });
              }
            }
            const novaLista = editando.novo
              ? [...lista, data].sort((a,b)=>a.nome.localeCompare(b.nome,'pt'))
              : lista.map(x=>x.id===editando.id?data:x);
            setLista(novaLista);
            setColabAPI(novaLista.map(mapearParaApp));
            setStatus({ok:true, msg:editando.novo?"✅ Colaborador adicionado.":"✅ Alterações salvas."});
            setEditando(null);`
);

// ══════════════════════════════════════════════════════════════
// 6. Accordion trigger: also check historicoSalario
// ══════════════════════════════════════════════════════════════
rep('accordion trigger check historicoSalario',
`onClick={()=>{ if(abaEditar!=='historico'&&!loadingHistorico&&historicoAtestados.length===0&&historicoFerias.length===0) carregarHistorico(editando); setAbaEditar(p=>p==='historico'?'dados':'historico'); }}>`,
`onClick={()=>{ if(abaEditar!=='historico'&&!loadingHistorico&&historicoAtestados.length===0&&historicoFerias.length===0&&historicoSalario.length===0) carregarHistorico(editando); setAbaEditar(p=>p==='historico'?'dados':'historico'); }}>`
);

// ══════════════════════════════════════════════════════════════
// 7. Add "💰 Histórico Salarial" section before férias in accordion
// ══════════════════════════════════════════════════════════════
rep('add historico salarial section in accordion',
`                      <div style={{fontWeight:700,fontSize:12,color:C.muted,textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:8}}>🏖️ Férias</div>`,
`                      <div style={{fontWeight:700,fontSize:12,color:C.muted,textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:8,marginTop:16}}>💰 Histórico Salarial</div>
                      {historicoSalario.length===0?(
                        <div style={{color:C.muted,fontSize:13,paddingBottom:16}}>Nenhum reajuste registrado ainda.</div>
                      ):(
                        <table style={{width:"100%",borderCollapse:"collapse",marginBottom:20}}>
                          <thead><tr style={{background:"#F9FAFB"}}>
                            <th style={s.th}>Data</th><th style={s.th}>Salário Anterior</th>
                            <th style={s.th}>Salário Novo</th><th style={{...s.th,textAlign:"center"}}>Reajuste</th>
                          </tr></thead>
                          <tbody>{historicoSalario.map((h,i)=>(
                            <tr key={i} style={{borderTop:"1px solid "+C.border}}>
                              <td style={{...s.td,fontSize:12}}>{h.data_vigencia?new Date(h.data_vigencia+'T12:00:00').toLocaleDateString('pt-BR'):'—'}</td>
                              <td style={{...s.td,fontSize:12}}>{h.salario_anterior!=null?'R$ '+Number(h.salario_anterior).toLocaleString('pt-BR',{minimumFractionDigits:2}):'—'}</td>
                              <td style={{...s.td,fontSize:12,fontWeight:700}}>{h.salario_novo!=null?'R$ '+Number(h.salario_novo).toLocaleString('pt-BR',{minimumFractionDigits:2}):'—'}</td>
                              <td style={{...s.td,textAlign:"center"}}>
                                <span style={{fontSize:12,fontWeight:700,color:h.percentual>=0?"#166534":"#991B1B"}}>{h.percentual>=0?"+":""}{Number(h.percentual).toFixed(2).replace(".",",")}%</span>
                              </td>
                            </tr>
                          ))}</tbody>
                        </table>
                      )}
                      <div style={{fontWeight:700,fontSize:12,color:C.muted,textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:8}}>🏖️ Férias</div>`
);

fs.writeFileSync('index.html', html);
console.log('\n' + ok + ' OK | ' + fail + ' falhas | Tamanho: ' + html.length);
