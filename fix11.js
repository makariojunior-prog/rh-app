const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
let ok = 0, fail = 0;

function rep(label, old, novo) {
  if (!html.includes(old)) { console.error('✗ NOT FOUND: ' + label); fail++; return; }
  html = html.replace(old, novo);
  console.log('✓ ' + label); ok++;
}

// ══════════════════════════════════════════════════════════════
// 1. GAS _bool(): handle "Sim, ..." Google Forms full-text responses
// ══════════════════════════════════════════════════════════════
rep('GAS _bool fix for Google Forms text',
`function _bool(v) {
  if (typeof v === 'boolean') return v;
  var s = String(v).trim().toUpperCase();
  return s === 'SIM' || s === 'TRUE' || s === '1' || s === 'X' || s === 'YES';
}`,
`function _bool(v) {
  if (typeof v === 'boolean') return v;
  var s = String(v).trim().toUpperCase();
  if (!s) return false;
  // Negative patterns (Portuguese Google Forms responses start with Não/Nao)
  if (s === 'NÃO' || s === 'NAO' || s === 'FALSE' || s === '0' || s === 'NO' || s === 'N') return false;
  if (s.indexOf('NÃO,') === 0 || s.indexOf('NÃO ') === 0 || s.indexOf('NAO,') === 0 || s.indexOf('NAO ') === 0) return false;
  // Any non-empty, non-negative value = true (covers "Sim, ...", "Cat. A+B", etc.)
  return true;
}`
);

// ══════════════════════════════════════════════════════════════
// 2. RecrutamentoPage: add logs state
// ══════════════════════════════════════════════════════════════
rep('RecrutamentoPage add logs state',
`        const [resultado, setResultado]   = React.useState(null);`,
`        const [resultado, setResultado]   = React.useState(null);
        const [logs, setLogs]             = React.useState([]);`
);

// ══════════════════════════════════════════════════════════════
// 3. RecrutamentoPage: update useEffect to load logs
// ══════════════════════════════════════════════════════════════
rep('RecrutamentoPage useEffect add carregarLogs',
`        React.useEffect(()=>{ carregarCandidatos(); carregarEntrevistas(); },[empresaId]);`,
`        React.useEffect(()=>{ carregarCandidatos(); carregarEntrevistas(); carregarLogs(); },[empresaId]);`
);

// ══════════════════════════════════════════════════════════════
// 4. RecrutamentoPage: add log functions + excluirEntrevista after salvarResultado
// ══════════════════════════════════════════════════════════════
rep('RecrutamentoPage add log functions',
`        const vagas = [...new Set(candidatos.map(c=>c.vaga).filter(Boolean))].sort();`,
`        const carregarLogs = async () => {
          if(!empresaId) return;
          const {data} = await _supa.from('logs').select('*').eq('empresa_id',empresaId).order('criado_em',{ascending:false}).limit(100);
          setLogs(data||[]);
        };
        const registrarLog = async (acao,tabela,id,antes,depois,user) => {
          try {
            await _supa.from('logs').insert({empresa_id:empresaId,usuario:user,acao,tabela,registro_id:String(id),dados_antes:antes||null,dados_depois:depois||null});
          } catch(e){}
        };
        const excluirEntrevista = async (entrev) => {
          if(!window.confirm('Excluir a entrevista de "'+entrev.candidato_nome+'"? Um log de auditoria será criado.')) return;
          const {data:{session}} = await _supa.auth.getSession();
          await registrarLog('exclusão_entrevista','entrevistas',entrev.id,entrev,null,session?.user?.email||'Desconhecido');
          await _supa.from('entrevistas').delete().eq('id',entrev.id);
          carregarEntrevistas(); carregarLogs();
        };

        const vagas = [...new Set(candidatos.map(c=>c.vaga).filter(Boolean))].sort();`
);

// ══════════════════════════════════════════════════════════════
// 5. RecrutamentoPage salvarEntrevista: add logging on edit
// ══════════════════════════════════════════════════════════════
rep('salvarEntrevista add edit logging',
`          if(editandoE){
            const {error} = await _supa.from('entrevistas').update({
              candidato_nome:formE.candidatoNome, vaga:formE.vaga||null,
              data_entrevista:formE.dataEntrevista, hora_entrevista:formE.horaEntrevista||null,
              entrevistador:formE.entrevistador||null, local_entrevista:formE.localEntrevista||null,
              obs:formE.obs||null
            }).eq('id',editandoE);
            if(!error){ setMostrarFormE(false); setEditandoE(null); setFormE(VAZIO_E); carregarEntrevistas(); }
            else setStatusMsg({ok:false,msg:'❌ '+error.message});
          } else {`,
`          if(editandoE){
            const dadosAntes = entrevistas.find(x=>x.id===editandoE);
            const novoDados = {candidato_nome:formE.candidatoNome,vaga:formE.vaga||null,data_entrevista:formE.dataEntrevista,hora_entrevista:formE.horaEntrevista||null,entrevistador:formE.entrevistador||null,local_entrevista:formE.localEntrevista||null,obs:formE.obs||null};
            const {error} = await _supa.from('entrevistas').update(novoDados).eq('id',editandoE);
            if(!error){
              const {data:{session}} = await _supa.auth.getSession();
              await registrarLog('edição_entrevista','entrevistas',editandoE,dadosAntes,novoDados,session?.user?.email||'Desconhecido');
              setMostrarFormE(false); setEditandoE(null); setFormE(VAZIO_E); carregarEntrevistas(); carregarLogs();
            } else setStatusMsg({ok:false,msg:'❌ '+error.message});
          } else {`
);

// ══════════════════════════════════════════════════════════════
// 6. RecrutamentoPage: add Log tab button
// ══════════════════════════════════════════════════════════════
rep('RecrutamentoPage add log tab button',
`                <button style={tabSt('curriculos')} onClick={()=>setAba('curriculos')}>📋 Currículos</button>
                <button style={tabSt('entrevistas')} onClick={()=>setAba('entrevistas')}>📅 Entrevistas</button>`,
`                <button style={tabSt('curriculos')} onClick={()=>setAba('curriculos')}>📋 Currículos</button>
                <button style={tabSt('entrevistas')} onClick={()=>setAba('entrevistas')}>📅 Entrevistas</button>
                <button style={tabSt('log')} onClick={()=>{setAba('log');carregarLogs();}}>🔍 Log</button>`
);

// ══════════════════════════════════════════════════════════════
// 7. RecrutamentoPage: remove agendada restriction + add delete button
// ══════════════════════════════════════════════════════════════
rep('entrevistas actions remove agendada restriction',
`                                {e.status==='agendada'&&(
                                  <span>
                                    <button onClick={()=>{setFormE({candidatoNome:e.candidato_nome,vaga:e.vaga||'',dataEntrevista:e.data_entrevista||'',horaEntrevista:e.hora_entrevista||'',entrevistador:e.entrevistador||'',localEntrevista:e.local_entrevista||'',obs:e.obs||''});setEditandoE(e.id);setMostrarFormE(true);}} style={{background:'none',border:'1px solid '+C.border,borderRadius:5,fontSize:11,padding:'3px 8px',cursor:'pointer',marginRight:4}}>✏️</button>
                                    <button onClick={()=>setResultado({id:e.id,status:'realizada',avaliacao:0,obs:''})} style={{background:'none',border:'1px solid #A78BFA',color:'#6D28D9',borderRadius:5,fontSize:11,padding:'3px 8px',cursor:'pointer'}}>📝 Resultado</button>
                                  </span>
                                )}`,
`                                <span style={{display:'flex',gap:4,justifyContent:'flex-end',flexWrap:'nowrap'}}>
                                  <button onClick={()=>{setFormE({candidatoNome:e.candidato_nome,vaga:e.vaga||'',dataEntrevista:e.data_entrevista||'',horaEntrevista:e.hora_entrevista||'',entrevistador:e.entrevistador||'',localEntrevista:e.local_entrevista||'',obs:e.obs||''});setEditandoE(e.id);setMostrarFormE(true);}} style={{background:'none',border:'1px solid '+C.border,borderRadius:5,fontSize:11,padding:'3px 8px',cursor:'pointer'}}>✏️</button>
                                  {e.status==='agendada'&&<button onClick={()=>setResultado({id:e.id,status:'realizada',avaliacao:0,obs:''})} style={{background:'none',border:'1px solid #A78BFA',color:'#6D28D9',borderRadius:5,fontSize:11,padding:'3px 8px',cursor:'pointer'}}>📝 Resultado</button>}
                                  <button onClick={()=>excluirEntrevista(e)} style={{background:'none',border:'1px solid #FCA5A5',color:'#DC2626',borderRadius:5,fontSize:11,padding:'3px 8px',cursor:'pointer'}}>🗑️</button>
                                </span>`
);

// ══════════════════════════════════════════════════════════════
// 8. RecrutamentoPage: add Log tab JSX before closing
// ══════════════════════════════════════════════════════════════
rep('RecrutamentoPage add log tab JSX',
`            )}
          </div>
        );
      }

      // ============================================================
      // MÓDULO ADIANTAMENTOS
      // ============================================================
      function AdiantamentosPage(`,
`            )}

            {aba==='log'&&(
              <div>
                <div style={{fontWeight:700,color:C.pri,marginBottom:14,fontSize:13,textTransform:'uppercase',letterSpacing:'0.05em'}}>🔍 Log de Auditoria — Entrevistas</div>
                {logs.length===0?(
                  <div style={{...s.card,textAlign:'center',padding:'48px 20px',color:C.muted}}>
                    <div style={{fontSize:32,marginBottom:8}}>🔍</div>
                    <div style={{fontWeight:700}}>Nenhum registro de auditoria ainda</div>
                    <div style={{fontSize:12,marginTop:4}}>Edições e exclusões de entrevistas aparecerão aqui.</div>
                  </div>
                ):(
                  <div style={s.card}>
                    <table style={{width:'100%',borderCollapse:'collapse'}}>
                      <thead><tr style={{background:'#F9FAFB'}}>
                        <th style={s.th}>Data/Hora</th><th style={s.th}>Ação</th>
                        <th style={s.th}>Candidato</th><th style={s.th}>Usuário</th>
                        <th style={s.th}>Alterações</th>
                      </tr></thead>
                      <tbody>
                        {logs.map(l=>{
                          const isEx=l.acao&&l.acao.includes('exclusão');
                          return(
                            <tr key={l.id} style={{borderTop:'1px solid '+C.border}}>
                              <td style={{...s.td,fontSize:11,whiteSpace:'nowrap'}}>{l.criado_em?new Date(l.criado_em).toLocaleString('pt-BR'):'—'}</td>
                              <td style={{...s.td}}>
                                <span style={{background:isEx?'#FEE2E2':'#EFF6FF',color:isEx?'#991B1B':'#1D4ED8',padding:'2px 8px',borderRadius:10,fontSize:11,fontWeight:700}}>{l.acao||'—'}</span>
                              </td>
                              <td style={{...s.td,fontSize:12,fontWeight:600}}>{(l.dados_antes&&l.dados_antes.candidato_nome)||l.registro_id||'—'}</td>
                              <td style={{...s.td,fontSize:12}}>{l.usuario||'—'}</td>
                              <td style={{...s.td,fontSize:11,color:C.muted}}>
                                {l.dados_antes&&<div><strong>Antes:</strong> {[l.dados_antes.data_entrevista,l.dados_antes.hora_entrevista,l.dados_antes.entrevistador].filter(Boolean).join(' · ')||'—'}</div>}
                                {l.dados_depois&&<div><strong>Depois:</strong> {[l.dados_depois.data_entrevista,l.dados_depois.hora_entrevista,l.dados_depois.entrevistador].filter(Boolean).join(' · ')||'—'}</div>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      }

      // ============================================================
      // MÓDULO ADIANTAMENTOS
      // ============================================================
      function AdiantamentosPage(`
);

// ══════════════════════════════════════════════════════════════
// 9. DashboardPage: add recrutInfo state after ausencias
// ══════════════════════════════════════════════════════════════
rep('DashboardPage add recrutInfo state',
`        const [ausencias, setAusencias] = React.useState({atestados:[],ferias:[]});`,
`        const [ausencias, setAusencias] = React.useState({atestados:[],ferias:[]});
        const [recrutInfo, setRecrutInfo] = React.useState({novos:0,entrevistas:[]});`
);

// ══════════════════════════════════════════════════════════════
// 10. DashboardPage: add recrutamento fetch after ausencias useEffect
// ══════════════════════════════════════════════════════════════
rep('DashboardPage add recrutamento fetch useEffect',
`        },[empresaId]);

        const lerStorage = () => ({`,
`        },[empresaId]);

        React.useEffect(()=>{
          if(!empresaId) return;
          const hoje = new Date().toISOString().slice(0,10);
          const em7dias = new Date(Date.now()+7*86400000).toISOString().slice(0,10);
          Promise.all([
            _supa.from('candidatos').select('*',{count:'exact',head:true}).eq('empresa_id',empresaId).eq('status','novo'),
            _supa.from('entrevistas').select('candidato_nome,vaga,data_entrevista,hora_entrevista').eq('empresa_id',empresaId).eq('status','agendada').gte('data_entrevista',hoje).lte('data_entrevista',em7dias).order('data_entrevista',{ascending:true})
          ]).then(([novRes,entRes])=>{
            setRecrutInfo({novos:novRes.count||0,entrevistas:entRes.data||[]});
          });
        },[empresaId]);

        const lerStorage = () => ({`
);

// ══════════════════════════════════════════════════════════════
// 11. DashboardPage JSX: add recrutamento card before closing
// ══════════════════════════════════════════════════════════════
rep('DashboardPage add recrutamento card',
`          </div>
        );
      }

      // ============================================================
      // PÁGINA DE AJUDA`,
`
            <div style={s.card}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                <div style={{fontWeight:700,color:C.pri,fontSize:13,textTransform:'uppercase',letterSpacing:'0.05em'}}>🧑‍💼 Recrutamento</div>
                <button onClick={()=>onNavegar('recrutamento')} style={{background:'none',border:'none',color:C.pri,fontSize:12,cursor:'pointer',fontWeight:600}}>Ver tudo →</button>
              </div>
              {recrutInfo.novos>0&&(
                <div style={{background:'#EFF6FF',border:'1px solid #BFDBFE',borderRadius:8,padding:'10px 14px',marginBottom:10,display:'flex',alignItems:'center',gap:10}}>
                  <span style={{fontSize:20}}>📋</span>
                  <div>
                    <div style={{fontWeight:700,fontSize:13,color:'#1D4ED8'}}>{recrutInfo.novos} currículo{recrutInfo.novos!==1?'s':''} novo{recrutInfo.novos!==1?'s':''}</div>
                    <div style={{fontSize:12,color:'#3B82F6'}}>Aguardando triagem</div>
                  </div>
                </div>
              )}
              {recrutInfo.entrevistas.length>0&&(
                <div>
                  <div style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:8}}>📅 Próximas entrevistas (7 dias)</div>
                  <div style={{display:'flex',flexDirection:'column',gap:6}}>
                    {recrutInfo.entrevistas.map((e,i)=>(
                      <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'6px 10px',background:'#F9FAFB',borderRadius:6,fontSize:13}}>
                        <span style={{fontWeight:700,color:C.pri,minWidth:80,fontSize:12}}>{new Date(e.data_entrevista+'T12:00:00').toLocaleDateString('pt-BR')}</span>
                        {e.hora_entrevista&&<span style={{color:C.muted,fontSize:12,minWidth:40}}>{e.hora_entrevista}</span>}
                        <span style={{fontWeight:600}}>{e.candidato_nome}</span>
                        {e.vaga&&<span style={{color:C.muted,fontSize:12}}>— {e.vaga}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {recrutInfo.novos===0&&recrutInfo.entrevistas.length===0&&(
                <div style={{color:C.muted,fontSize:13}}>Nenhum currículo novo ou entrevista nos próximos 7 dias.</div>
              )}
            </div>
          </div>
        );
      }

      // ============================================================
      // PÁGINA DE AJUDA`
);

fs.writeFileSync('index.html', html);
console.log('\n' + ok + ' OK | ' + fail + ' falhas | Tamanho: ' + html.length);
