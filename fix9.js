const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
let ok = 0, fail = 0;

function rep(label, old, novo) {
  if (!html.includes(old)) { console.error('✗ NOT FOUND: ' + label); fail++; return; }
  html = html.replace(old, novo);
  console.log('✓ ' + label); ok++;
}

// ══════════════════════════════════════════════════════════════
// 1. AcessosPage: add adiantamentos to TODAS_PAGINAS
// ══════════════════════════════════════════════════════════════
rep('TODAS_PAGINAS add adiantamentos',
`          {k:'ponto_hist', l:'📊 Histórico Ponto'},
        ];`,
`          {k:'ponto_hist', l:'📊 Histórico Ponto'},
          {k:'adiantamentos', l:'💵 Adiantamentos'},
        ];`
);

// ══════════════════════════════════════════════════════════════
// 2. App: paginasPermitidas add adiantamentos
// ══════════════════════════════════════════════════════════════
rep('paginasPermitidas add adiantamentos',
`        ? ['dashboard','colaboradores','vt','folha','ferias','atestados','ponto_hist','acessos','ajuda','config']`,
`        ? ['dashboard','colaboradores','vt','folha','ferias','atestados','ponto_hist','adiantamentos','acessos','ajuda','config']`
);

// ══════════════════════════════════════════════════════════════
// 3. ColaboradoresPage: add historicoAdiantamentos state
// ══════════════════════════════════════════════════════════════
rep('add historicoAdiantamentos state',
`        const [historicoSalario, setHistoricoSalario] = useState([]);
        const [loadingHistorico, setLoadingHistorico] = useState(false);`,
`        const [historicoSalario, setHistoricoSalario] = useState([]);
        const [historicoAdiantamentos, setHistoricoAdiantamentos] = useState([]);
        const [loadingHistorico, setLoadingHistorico] = useState(false);`
);

// ══════════════════════════════════════════════════════════════
// 4. carregarHistorico: add adiantamentos fetch
// ══════════════════════════════════════════════════════════════
rep('carregarHistorico add adiantamentos fetch',
`          try {
            const {data:dataSal} = await _supa.from('historico_salario').select('*').eq('empresa_id',empresaId).ilike('colaborador_nome','%'+colab.nome+'%').order('data_vigencia',{ascending:false});
            setHistoricoSalario(dataSal||[]);
          } catch(e) { setHistoricoSalario([]); }
          setLoadingHistorico(false);
        };`,
`          try {
            const {data:dataSal} = await _supa.from('historico_salario').select('*').eq('empresa_id',empresaId).ilike('colaborador_nome','%'+colab.nome+'%').order('data_vigencia',{ascending:false});
            setHistoricoSalario(dataSal||[]);
          } catch(e) { setHistoricoSalario([]); }
          try {
            const {data:dataAdt} = await _supa.from('adiantamentos').select('*').eq('empresa_id',empresaId).ilike('colaborador_nome','%'+colab.nome+'%').order('data_concessao',{ascending:false});
            setHistoricoAdiantamentos(dataAdt||[]);
          } catch(e) { setHistoricoAdiantamentos([]); }
          setLoadingHistorico(false);
        };`
);

// ══════════════════════════════════════════════════════════════
// 5. abrirNovo: reset historicoAdiantamentos
// ══════════════════════════════════════════════════════════════
rep('abrirNovo reset historicoAdiantamentos',
`        const abrirNovo = () => { setForm(FORM_VAZIO); setEditando({novo:true}); setStatus(null); setAbaEditar('dados'); setHistoricoAtestados([]); setHistoricoFerias([]); setHistoricoSalario([]); };`,
`        const abrirNovo = () => { setForm(FORM_VAZIO); setEditando({novo:true}); setStatus(null); setAbaEditar('dados'); setHistoricoAtestados([]); setHistoricoFerias([]); setHistoricoSalario([]); setHistoricoAdiantamentos([]); };`
);

// ══════════════════════════════════════════════════════════════
// 6. abrirEdicao: reset historicoAdiantamentos
// ══════════════════════════════════════════════════════════════
rep('abrirEdicao reset historicoAdiantamentos',
`          setEditando(c); setStatus(null); setAbaEditar('dados'); setHistoricoAtestados([]); setHistoricoFerias([]); setHistoricoSalario([]);
        };`,
`          setEditando(c); setStatus(null); setAbaEditar('dados'); setHistoricoAtestados([]); setHistoricoFerias([]); setHistoricoSalario([]); setHistoricoAdiantamentos([]);
        };`
);

// ══════════════════════════════════════════════════════════════
// 7. Accordion trigger: add historicoAdiantamentos check
// ══════════════════════════════════════════════════════════════
rep('accordion trigger add historicoAdiantamentos',
`onClick={()=>{ if(abaEditar!=='historico'&&!loadingHistorico&&historicoAtestados.length===0&&historicoFerias.length===0&&historicoSalario.length===0) carregarHistorico(editando); setAbaEditar(p=>p==='historico'?'dados':'historico'); }}>`,
`onClick={()=>{ if(abaEditar!=='historico'&&!loadingHistorico&&historicoAtestados.length===0&&historicoFerias.length===0&&historicoSalario.length===0&&historicoAdiantamentos.length===0) carregarHistorico(editando); setAbaEditar(p=>p==='historico'?'dados':'historico'); }}>`
);

// ══════════════════════════════════════════════════════════════
// 8. Accordion JSX: add adiantamentos section (before férias)
// ══════════════════════════════════════════════════════════════
rep('add adiantamentos section in accordion',
`                      <div style={{fontWeight:700,fontSize:12,color:C.muted,textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:8}}>🏖️ Férias</div>`,
`                      <div style={{fontWeight:700,fontSize:12,color:C.muted,textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:8,marginTop:16}}>💵 Adiantamentos</div>
                      {historicoAdiantamentos.length===0?(
                        <div style={{color:C.muted,fontSize:13,paddingBottom:16}}>Nenhum adiantamento registrado.</div>
                      ):(
                        <table style={{width:"100%",borderCollapse:"collapse",marginBottom:20}}>
                          <thead><tr style={{background:"#F9FAFB"}}>
                            <th style={s.th}>Data</th><th style={s.th}>Valor</th>
                            <th style={s.th}>Mês Ref.</th><th style={{...s.th,textAlign:"center"}}>Status</th><th style={s.th}>Obs</th>
                          </tr></thead>
                          <tbody>{historicoAdiantamentos.map((a,i)=>{
                            const corA={pendente:{bg:"#FEF9C3",c:"#92400E"},descontado:{bg:"#DCFCE7",c:"#166534"},cancelado:{bg:"#FEE2E2",c:"#991B1B"}};
                            const cA=corA[a.status]||corA.pendente;
                            return(<tr key={i} style={{borderTop:"1px solid "+C.border}}>
                              <td style={{...s.td,fontSize:12}}>{a.data_concessao?new Date(a.data_concessao+'T12:00:00').toLocaleDateString('pt-BR'):'—'}</td>
                              <td style={{...s.td,fontSize:12,fontWeight:700,color:C.pri}}>R$ {Number(a.valor).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
                              <td style={{...s.td,fontSize:12}}>{a.mes_referencia?a.mes_referencia.split('-').reverse().join('/'):'—'}</td>
                              <td style={{...s.td,textAlign:"center"}}><span style={{background:cA.bg,color:cA.c,padding:"2px 8px",borderRadius:10,fontSize:11,fontWeight:700}}>{a.status}</span></td>
                              <td style={{...s.td,fontSize:12,color:C.muted}}>{a.obs||'—'}</td>
                            </tr>);
                          })}</tbody>
                        </table>
                      )}
                      <div style={{fontWeight:700,fontSize:12,color:C.muted,textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:8}}>🏖️ Férias</div>`
);

// ══════════════════════════════════════════════════════════════
// 9. Insert AdiantamentosPage component before PlaceholderPage
// ══════════════════════════════════════════════════════════════
rep('insert AdiantamentosPage component',
`      function PlaceholderPage({title,icon}){`,
`      // ============================================================
      // MÓDULO ADIANTAMENTOS
      // ============================================================
      function AdiantamentosPage({ colabAPI, empresaId }) {
        const hoje = new Date().toISOString().slice(0,10);
        const mesAtual = hoje.slice(0,7);
        const [mesRef, setMesRef] = React.useState(mesAtual);
        const [lista, setLista] = React.useState([]);
        const [loading, setLoading] = React.useState(true);
        const [status, setStatus] = React.useState(null);
        const [mostrarForm, setMostrarForm] = React.useState(false);
        const VAZIO = {colaboradorNome:'',valor:'',dataConcessao:hoje,obs:''};
        const [form, setForm] = React.useState(VAZIO);

        const carregar = async () => {
          if(!empresaId) return;
          setLoading(true);
          const {data,error} = await _supa.from('adiantamentos')
            .select('*').eq('empresa_id',empresaId)
            .eq('mes_referencia',mesRef)
            .order('data_concessao',{ascending:false});
          if(!error) setLista(data||[]);
          setLoading(false);
        };

        React.useEffect(()=>{ carregar(); },[empresaId,mesRef]);

        const salvar = async () => {
          if(!form.colaboradorNome||!form.valor||!form.dataConcessao){
            setStatus({ok:false,msg:'Preencha colaborador, valor e data.'}); return;
          }
          const val = parseFloat(String(form.valor).replace(',','.'));
          if(isNaN(val)||val<=0){ setStatus({ok:false,msg:'Valor inválido.'}); return; }
          const mesR = form.dataConcessao.slice(0,7);
          setLoading(true);
          const colab = colabAPI.find(c=>c.nome===form.colaboradorNome);
          const {error} = await _supa.from('adiantamentos').insert({
            empresa_id:empresaId,
            colaborador_id:colab?.id||null,
            colaborador_nome:form.colaboradorNome.trim(),
            valor:val,
            data_concessao:form.dataConcessao,
            mes_referencia:mesR,
            status:'pendente',
            obs:form.obs||null
          });
          if(error){ setStatus({ok:false,msg:'❌ '+error.message}); }
          else{ setStatus({ok:true,msg:'✅ Adiantamento registrado!'}); setMostrarForm(false); setForm(VAZIO); carregar(); }
          setLoading(false);
        };

        const cancelarAdt = async (id) => {
          if(!window.confirm('Cancelar este adiantamento?')) return;
          await _supa.from('adiantamentos').update({status:'cancelado'}).eq('id',id);
          carregar();
        };

        const totalPendente = lista.filter(a=>a.status==='pendente').reduce((s,a)=>s+Number(a.valor),0);
        const corSt = {pendente:{bg:"#FEF9C3",c:"#92400E"},descontado:{bg:"#DCFCE7",c:"#166534"},cancelado:{bg:"#FEE2E2",c:"#991B1B"}};
        const porColab = {};
        lista.filter(a=>a.status==='pendente').forEach(a=>{
          if(!porColab[a.colaborador_nome]) porColab[a.colaborador_nome]=0;
          porColab[a.colaborador_nome]+=Number(a.valor);
        });

        return (
          <div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
              <div style={{fontSize:20,fontWeight:800,color:C.pri}}>💵 Adiantamentos</div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <input type="month" value={mesRef} onChange={e=>setMesRef(e.target.value)} style={{...s.input,width:150,marginBottom:0}}/>
                <button onClick={()=>{setMostrarForm(true);setStatus(null);setForm(VAZIO);}} style={s.btn}>+ Novo</button>
              </div>
            </div>

            {status&&<div style={{padding:"10px 14px",borderRadius:6,marginBottom:14,background:status.ok?"#DCFCE7":"#FEE2E2",color:status.ok?"#166534":"#991B1B",fontSize:13}}>{status.msg}</div>}

            {mostrarForm&&(
              <div style={{...s.card,marginBottom:16,border:"1px solid "+C.pri}}>
                <div style={{fontWeight:700,color:C.pri,marginBottom:14,fontSize:13,textTransform:"uppercase",letterSpacing:"0.05em"}}>Registrar Adiantamento</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 20px"}}>
                  <div style={{marginBottom:14}}>
                    <label style={s.label}>Colaborador *</label>
                    <select value={form.colaboradorNome} onChange={e=>setForm(p=>({...p,colaboradorNome:e.target.value}))} style={s.input}>
                      <option value="">Selecione...</option>
                      {[...colabAPI].sort((a,b)=>(a.nome||'').localeCompare(b.nome||'','pt')).map(c=>(
                        <option key={c.nome} value={c.nome}>{c.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{marginBottom:14}}>
                    <label style={s.label}>Valor (R$) *</label>
                    <input type="number" step="0.01" min="0" value={form.valor} onChange={e=>setForm(p=>({...p,valor:e.target.value}))} placeholder="0,00" style={s.input}/>
                  </div>
                  <div style={{marginBottom:14}}>
                    <label style={s.label}>Data da Concessão *</label>
                    <input type="date" value={form.dataConcessao} onChange={e=>setForm(p=>({...p,dataConcessao:e.target.value}))} style={s.input}/>
                  </div>
                  <div style={{marginBottom:14}}>
                    <label style={s.label}>Observações</label>
                    <input type="text" value={form.obs} onChange={e=>setForm(p=>({...p,obs:e.target.value}))} placeholder="Motivo, etc." style={s.input}/>
                  </div>
                </div>
                <div style={{display:"flex",gap:10}}>
                  <button onClick={salvar} style={s.btn} disabled={loading}>💾 Salvar</button>
                  <button onClick={()=>{setMostrarForm(false);setStatus(null);}} style={s.btnOutline}>Cancelar</button>
                </div>
              </div>
            )}

            {Object.keys(porColab).length>0&&(
              <div style={{...s.card,marginBottom:14,background:"#FFFBEB",border:"1px solid #FCD34D"}}>
                <div style={{fontWeight:700,fontSize:13,color:"#92400E",marginBottom:8}}>
                  ⚠️ Pendentes para desconto na Folha de {mesRef.split('-').reverse().join('/')}
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:8,alignItems:"center"}}>
                  {Object.entries(porColab).map(([nome,val])=>(
                    <span key={nome} style={{background:"#FEF9C3",border:"1px solid #FCD34D",borderRadius:8,padding:"4px 12px",fontSize:12,fontWeight:600}}>
                      {nome}: <span style={{color:"#92400E"}}>R$ {val.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
                    </span>
                  ))}
                  <span style={{background:C.pri,color:"#fff",borderRadius:8,padding:"4px 12px",fontSize:12,fontWeight:700}}>
                    Total pendente: R$ {totalPendente.toLocaleString('pt-BR',{minimumFractionDigits:2})}
                  </span>
                </div>
              </div>
            )}

            {loading?(
              <div style={{textAlign:"center",padding:"32px",color:C.muted}}>Carregando...</div>
            ):lista.length===0?(
              <div style={{...s.card,textAlign:"center",padding:"48px 20px",color:C.muted}}>
                <div style={{fontSize:32,marginBottom:8}}>💵</div>
                <div style={{fontWeight:700,marginBottom:4}}>Nenhum adiantamento em {mesRef.split('-').reverse().join('/')}</div>
                <div style={{fontSize:12}}>Clique em "+ Novo" para registrar.</div>
              </div>
            ):(
              <div style={s.card}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead>
                    <tr style={{background:"#F9FAFB"}}>
                      <th style={s.th}>Colaborador</th><th style={s.th}>Valor</th>
                      <th style={s.th}>Data</th><th style={s.th}>Mês Ref.</th>
                      <th style={{...s.th,textAlign:"center"}}>Status</th>
                      <th style={s.th}>Obs</th><th style={{...s.th,textAlign:"right"}}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map(a=>{
                      const cor=corSt[a.status]||corSt.pendente;
                      return(
                        <tr key={a.id} style={{borderTop:"1px solid "+C.border}}>
                          <td style={{...s.td,fontWeight:600}}>{a.colaborador_nome}</td>
                          <td style={{...s.td,fontWeight:700,color:C.pri}}>R$ {Number(a.valor).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
                          <td style={{...s.td,fontSize:12}}>{a.data_concessao?new Date(a.data_concessao+'T12:00:00').toLocaleDateString('pt-BR'):'—'}</td>
                          <td style={{...s.td,fontSize:12}}>{a.mes_referencia?a.mes_referencia.split('-').reverse().join('/'):'—'}</td>
                          <td style={{...s.td,textAlign:"center"}}>
                            <span style={{background:cor.bg,color:cor.c,padding:"2px 8px",borderRadius:10,fontSize:11,fontWeight:700}}>{a.status}</span>
                          </td>
                          <td style={{...s.td,fontSize:12,color:C.muted}}>{a.obs||'—'}</td>
                          <td style={{...s.td,textAlign:"right"}}>
                            {a.status==='pendente'&&(
                              <button onClick={()=>cancelarAdt(a.id)} style={{background:"none",border:"1px solid #FCA5A5",color:"#DC2626",borderRadius:5,fontSize:11,padding:"4px 10px",cursor:"pointer"}}>Cancelar</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      }

      function PlaceholderPage({title,icon}){`
);

// ══════════════════════════════════════════════════════════════
// 10. FolhaPage: add empresaId to props
// ══════════════════════════════════════════════════════════════
rep('FolhaPage add empresaId prop',
`      function FolhaPage({ colabAPI, setColabAPI, gasUrl }) {`,
`      function FolhaPage({ colabAPI, setColabAPI, gasUrl, empresaId }) {`
);

// ══════════════════════════════════════════════════════════════
// 11. FolhaPage: add adiantSupa state after saveStatus
// ══════════════════════════════════════════════════════════════
rep('FolhaPage add adiantSupa state',
`        const [saveStatus, setSaveStatus] = useState(null);
        const [drag, setDrag] = useState(false);`,
`        const [saveStatus, setSaveStatus] = useState(null);
        const [adiantSupa, setAdiantSupa] = useState({});
        const [drag, setDrag] = useState(false);`
);

// ══════════════════════════════════════════════════════════════
// 12. FolhaPage: useEffect to fetch advances when mesAno changes
// ══════════════════════════════════════════════════════════════
rep('FolhaPage useEffect fetch advances',
`        useEffect(()=>{localStorage.setItem("rh_folha_ajustes",JSON.stringify(ajustes));},[ajustes]);`,
`        useEffect(()=>{localStorage.setItem("rh_folha_ajustes",JSON.stringify(ajustes));},[ajustes]);

        useEffect(()=>{
          if(!empresaId) return;
          const mesR = mesAno.split('/').reverse().join('-');
          const norm = (n)=>String(n||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
          _supa.from('adiantamentos').select('id,colaborador_nome,valor').eq('empresa_id',empresaId).eq('mes_referencia',mesR).eq('status','pendente').then(({data})=>{
            const mapa = {};
            (data||[]).forEach(a=>{
              const k = norm(a.colaborador_nome);
              if(!mapa[k]) mapa[k]={valor:0,ids:[]};
              mapa[k].valor += Number(a.valor);
              mapa[k].ids.push(a.id);
            });
            setAdiantSupa(mapa);
          });
        },[empresaId,mesAno]);`
);

// ══════════════════════════════════════════════════════════════
// 13. FolhaPage: adiantamento calc uses Supabase fallback
// ══════════════════════════════════════════════════════════════
rep('FolhaPage adiantamento calc fallback',
`          const adiantamento = parseFloat(String(aj.adiantamento||"").replace(",","."))||0;`,
`          const adiantamento = parseFloat(String(aj.adiantamento||"").replace(",","."))||(adiantSupa[nomeKey]?.valor||0);`
);

// ══════════════════════════════════════════════════════════════
// 14. FolhaPage: adiantamento input shows Supabase value as placeholder
// ══════════════════════════════════════════════════════════════
rep('FolhaPage adiantamento input placeholder',
`                                     value={ajustes[r.nomeKey]?.adiantamento||""}
                                     onChange={e=>setAjuste(r.nomeKey,"adiantamento",e.target.value)}
                                     placeholder="0,00"/>`,
`                                     value={ajustes[r.nomeKey]?.adiantamento||""}
                                     onChange={e=>setAjuste(r.nomeKey,"adiantamento",e.target.value)}
                                     placeholder={adiantSupa[r.nomeKey]?.valor>0?String(adiantSupa[r.nomeKey].valor.toFixed(2)).replace(".",","):"0,00"}
                                     style={{...s.inputSm,width:62,textAlign:"right",background:adiantSupa[r.nomeKey]?.valor>0&&!ajustes[r.nomeKey]?.adiantamento?"#FFFBEB":"#fff"}}
                                     />`
);

// ══════════════════════════════════════════════════════════════
// 15. FolhaPage: salvarFolha marks advances as descontado
// ══════════════════════════════════════════════════════════════
rep('FolhaPage salvarFolha mark descontado',
`            setSaveStatus({ok:true, msg:\`✅ Folha \${mesAno} enviada! Verifique a aba FOLHA\${ano} na planilha.\`});`,
`            setSaveStatus({ok:true, msg:\`✅ Folha \${mesAno} enviada! Verifique a aba FOLHA\${ano} na planilha.\`});
            const idsDescontar = Object.values(adiantSupa).flatMap(a=>a.ids||[]).filter(Boolean);
            if(idsDescontar.length>0){
              await _supa.from('adiantamentos').update({status:'descontado'}).in('id',idsDescontar);
              setAdiantSupa({});
            }`
);

// ══════════════════════════════════════════════════════════════
// 16. App navItems: add adiantamentos
// ══════════════════════════════════════════════════════════════
rep('navItems add adiantamentos',
`        {k:'ponto_hist',l:'📊 Histórico Ponto'},`,
`        {k:'adiantamentos',l:'💵 Adiantamentos'},
        {k:'ponto_hist',l:'📊 Histórico Ponto'},`
);

// ══════════════════════════════════════════════════════════════
// 17. App routing: add adiantamentos page
// ══════════════════════════════════════════════════════════════
rep('App routing add adiantamentos',
`              {page==="ponto_hist"&&<PlaceholderPage title="Histórico de Ponto" icon="📊"/>}`,
`              {page==="adiantamentos"&&<AdiantamentosPage colabAPI={colabAPI} empresaId={empresaId}/>}
              {page==="ponto_hist"&&<PlaceholderPage title="Histórico de Ponto" icon="📊"/>}`
);

// ══════════════════════════════════════════════════════════════
// 18. App: pass empresaId to FolhaPage
// ══════════════════════════════════════════════════════════════
rep('App pass empresaId to FolhaPage',
`              {page==="folha"&&<FolhaPage colabAPI={colabAPI} setColabAPI={setColabAPI} gasUrl={gasUrl}/>}`,
`              {page==="folha"&&<FolhaPage colabAPI={colabAPI} setColabAPI={setColabAPI} gasUrl={gasUrl} empresaId={empresaId}/>}`
);

fs.writeFileSync('index.html', html);
console.log('\n' + ok + ' OK | ' + fail + ' falhas | Tamanho: ' + html.length);
