const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
let ok = 0, fail = 0;

function rep(label, old, novo) {
  if (!html.includes(old)) { console.error('✗ NOT FOUND: ' + label); fail++; return; }
  html = html.replace(old, novo);
  console.log('✓ ' + label); ok++;
}

// ══════════════════════════════════════════════════════════════════
// 1. Funções utilitárias: calcINSS, calcFGTS, calcPericulosidade
// ══════════════════════════════════════════════════════════════════
rep('add calc utility functions',
`    const C={`,
`    // INSS progressivo 2025
    function calcINSS(salario) {
      const s = Number(salario) || 0;
      if (s <= 0) return 0;
      const faixas = [
        { limite: 1518.00, aliq: 0.075 },
        { limite: 2793.00, aliq: 0.09  },
        { limite: 4189.50, aliq: 0.12  },
        { limite: 8157.41, aliq: 0.14  },
      ];
      let total = 0, base = 0;
      for (const f of faixas) {
        const topo = Math.min(s, f.limite);
        if (topo <= base) break;
        total += (topo - base) * f.aliq;
        base = f.limite;
        if (s <= f.limite) break;
      }
      return Math.round(total * 100) / 100;
    }
    function calcFGTS(salario) {
      return Math.round((Number(salario) || 0) * 0.08 * 100) / 100;
    }
    function calcPericulosidade(salario) {
      return Math.round((Number(salario) || 0) * 0.30 * 100) / 100;
    }

    const C={`
);

// ══════════════════════════════════════════════════════════════════
// 2. GAS: remover inss/fgts do retorno (serão calculados no app)
// ══════════════════════════════════════════════════════════════════
rep('GAS remove inss/fgts',
`      inss:                   linha[16] || 0,                             // Q
      fgts:                   linha[17] || 0,                             // R
      transporte:             linha[18] || 0,                             // S`,
`      transporte:             linha[18] || 0,                             // S`
);

// ══════════════════════════════════════════════════════════════════
// 3. FORM_VAZIO: remover inss/fgts, adicionar periculosidade
// ══════════════════════════════════════════════════════════════════
rep('FORM_VAZIO update',
`          salario:"", inss:"", fgts:"", transporte:"",`,
`          salario:"", transporte:"", periculosidade:false,`
);

// ══════════════════════════════════════════════════════════════════
// 4. mapearParaApp: calcular INSS/FGTS, adicionar periculosidade
// ══════════════════════════════════════════════════════════════════
rep('mapearParaApp compute INSS/FGTS',
`          salario:Number(c.salario)||0, inss:Number(c.inss)||0, fgts:Number(c.fgts)||0,
          transporte:Number(c.transporte)||0,`,
`          salario:Number(c.salario)||0, inss:calcINSS(c.salario), fgts:calcFGTS(c.salario),
          transporte:Number(c.transporte)||0, periculosidade:!!c.periculosidade,`
);

// ══════════════════════════════════════════════════════════════════
// 5. Estados adicionais no ColaboradoresPage
// ══════════════════════════════════════════════════════════════════
rep('add historico states',
`        const [mostrarDesligados, setMostrarDesligados] = useState(false);`,
`        const [mostrarDesligados, setMostrarDesligados] = useState(false);
        const [abaEditar, setAbaEditar] = useState('dados');
        const [historicoAtestados, setHistoricoAtestados] = useState([]);
        const [historicoFerias, setHistoricoFerias] = useState([]);
        const [loadingHistorico, setLoadingHistorico] = useState(false);`
);

// ══════════════════════════════════════════════════════════════════
// 6. Função carregarHistorico (antes de carregar())
// ══════════════════════════════════════════════════════════════════
rep('add carregarHistorico function',
`        const carregar = async () => {`,
`        const carregarHistorico = async (colab) => {
          setLoadingHistorico(true);
          const url = gasUrl || localStorage.getItem('rh_gas_url') || '';
          if (url) {
            try {
              const ini = new Date(new Date().getFullYear()-3, 0, 1).toISOString().slice(0,10);
              const fim = new Date().toISOString().slice(0,10);
              const res = await fetch(url+'?acao=atestados&ini='+ini+'&fim='+fim);
              const json = await res.json();
              if (json.ok) {
                const nome = (colab.nome||'').toLowerCase();
                setHistoricoAtestados((json.atestados||[]).filter(a=>(a.nome||'').toLowerCase().includes(nome)));
              }
            } catch(e) { setHistoricoAtestados([]); }
          }
          try {
            const {data} = await _supa.from('ferias').select('*').eq('empresa_id',empresaId).ilike('colaborador_nome','%'+colab.nome+'%').order('inicio',{ascending:false});
            setHistoricoFerias(data||[]);
          } catch(e) { setHistoricoFerias([]); }
          setLoadingHistorico(false);
        };

        const carregar = async () => {`
);

// ══════════════════════════════════════════════════════════════════
// 7. abrirNovo: reset abaEditar e histórico
// ══════════════════════════════════════════════════════════════════
rep('abrirNovo reset aba',
`        const abrirNovo = () => { setForm(FORM_VAZIO); setEditando({novo:true}); setStatus(null); };`,
`        const abrirNovo = () => { setForm(FORM_VAZIO); setEditando({novo:true}); setStatus(null); setAbaEditar('dados'); setHistoricoAtestados([]); setHistoricoFerias([]); };`
);

// ══════════════════════════════════════════════════════════════════
// 8. abrirEdicao: remover inss/fgts, adicionar periculosidade, reset aba
// ══════════════════════════════════════════════════════════════════
rep('abrirEdicao update fields',
`            salario:String(c.salario||''), inss:String(c.inss||''), fgts:String(c.fgts||''),
            transporte:String(c.transporte||''),`,
`            salario:String(c.salario||''), transporte:String(c.transporte||''),
            periculosidade:!!c.periculosidade,`
);

rep('abrirEdicao reset aba',
`          setEditando(c); setStatus(null);`,
`          setEditando(c); setStatus(null); setAbaEditar('dados'); setHistoricoAtestados([]); setHistoricoFerias([]);`
);

// ══════════════════════════════════════════════════════════════════
// 9. salvar(): computar INSS/FGTS, adicionar periculosidade
// ══════════════════════════════════════════════════════════════════
rep('salvar payload compute INSS/FGTS',
`              salario:parseFloat(String(form.salario).replace(",","."))||0,
              inss:parseFloat(String(form.inss).replace(",","."))||0,
              fgts:parseFloat(String(form.fgts).replace(",","."))||0,
              transporte:parseFloat(String(form.transporte).replace(",","."))||0,`,
`              salario:parseFloat(String(form.salario).replace(",","."))||0,
              inss:calcINSS(parseFloat(String(form.salario).replace(",","."))||0),
              fgts:calcFGTS(parseFloat(String(form.salario).replace(",","."))||0),
              transporte:parseFloat(String(form.transporte).replace(",","."))||0,
              periculosidade:!!form.periculosidade,
              periculosidade_valor:form.periculosidade?calcPericulosidade(parseFloat(String(form.salario).replace(",","."))||0):0,`
);

// ══════════════════════════════════════════════════════════════════
// 10. sincronizarPlanilha records: computar INSS/FGTS, adicionar periculosidade
// ══════════════════════════════════════════════════════════════════
rep('sync records compute INSS/FGTS',
`                salario: Number(c.salario)||0, inss: Number(c.inss)||0,
                fgts: Number(c.fgts)||0, transporte: Number(c.tr`,
`                salario: Number(c.salario)||0, inss: calcINSS(c.salario),
                fgts: calcFGTS(c.salario), transporte: Number(c.tr`
);

// Remove periculosidade from sync records (not in spreadsheet, default false)
rep('sync records add periculosidade',
`                ativo: true, atualizado_em: new Date().toISOString()`,
`                periculosidade: false, periculosidade_valor: 0,
                ativo: true, atualizado_em: new Date().toISOString()`
);

// ══════════════════════════════════════════════════════════════════
// 11. colabParaApp em sync: computar INSS/FGTS, adicionar periculosidade
// ══════════════════════════════════════════════════════════════════
rep('colabParaApp compute INSS/FGTS',
`          salario:Number(c.salario)||0, inss:Number(c.inss)||0, fgts:Number(c.fgts)||0,
          transporte:Number(c.transporte)||0,`,
`          salario:Number(c.salario)||0, inss:calcINSS(c.salario), fgts:calcFGTS(c.salario),
          transporte:Number(c.transporte)||0, periculosidade:false,`
);

// ══════════════════════════════════════════════════════════════════
// 12. App._carregarColab: computar INSS/FGTS, adicionar periculosidade
// ══════════════════════════════════════════════════════════════════
rep('App _carregarColab compute INSS/FGTS',
`              salario:Number(c.salario)||0, inss:Number(c.inss)||0, fgts:Number(c.fgts)||0,
              transporte:Number(c.transporte)||0,`,
`              salario:Number(c.salario)||0, inss:calcINSS(c.salario), fgts:calcFGTS(c.salario),
              transporte:Number(c.transporte)||0, periculosidade:!!c.periculosidade,`
);

// ══════════════════════════════════════════════════════════════════
// 13. Financeiro section: remover INSS/FGTS inputs, exibir calculados,
//     adicionar toggle de periculosidade
// ══════════════════════════════════════════════════════════════════
rep('Financeiro section redesign',
`            <div style={s.card}>
              <div style={{fontWeight:700,color:C.pri,marginBottom:14,fontSize:13,textTransform:"uppercase",letterSpacing:"0.05em"}}>Financeiro</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 20px"}}>
                <CampoForm label="Salário (R$)" campo="salario" placeholder="0,00" form={form} setForm={setForm}/>
                <CampoForm label="INSS (R$)" campo="inss" placeholder="0,00" form={form} setForm={setForm}/>
                <CampoForm label="FGTS (R$)" campo="fgts" placeholder="0,00" form={form} setForm={setForm}/>
                <CampoForm label="Vale Transporte (R$)" campo="transporte" placeholder="0,00" form={form} setForm={setForm}/>
              </div>
            </div>`,
`            <div style={s.card}>
              <div style={{fontWeight:700,color:C.pri,marginBottom:14,fontSize:13,textTransform:"uppercase",letterSpacing:"0.05em"}}>Financeiro</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 20px"}}>
                <CampoForm label="Salário Base (R$)" campo="salario" placeholder="0,00" form={form} setForm={setForm}/>
                <CampoForm label="Vale Transporte (R$)" campo="transporte" placeholder="0,00" form={form} setForm={setForm}/>
                <div style={{marginBottom:14}}>
                  <label style={s.label}>INSS (calculado)</label>
                  <div style={{...s.input,background:"#F9FAFB",color:C.muted,fontSize:13}}>{fmtBRL(calcINSS(parseFloat(String(form.salario).replace(",","."))||0))} <span style={{fontSize:11,marginLeft:4}}>— tabela progressiva 2025</span></div>
                </div>
                <div style={{marginBottom:14}}>
                  <label style={s.label}>FGTS (calculado)</label>
                  <div style={{...s.input,background:"#F9FAFB",color:C.muted,fontSize:13}}>{fmtBRL(calcFGTS(parseFloat(String(form.salario).replace(",","."))||0))} <span style={{fontSize:11,marginLeft:4}}>— 8% do salário</span></div>
                </div>
              </div>
              <div style={{marginTop:8,padding:"12px 14px",borderRadius:8,background:form.periculosidade?"#FEF9C3":"#F9FAFB",border:"1px solid "+(form.periculosidade?"#FCD34D":C.border)}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontWeight:600,fontSize:13}}>Adicional de Periculosidade</div>
                    {form.periculosidade&&<div style={{fontSize:12,color:"#92400E",marginTop:2}}>{fmtBRL(calcPericulosidade(parseFloat(String(form.salario).replace(",","."))||0))} — 30% do salário base</div>}
                  </div>
                  <button type="button" onClick={()=>setForm(p=>({...p,periculosidade:!p.periculosidade}))}
                    style={{padding:"4px 18px",borderRadius:20,fontSize:12,fontWeight:700,cursor:"pointer",border:"none",
                      background:form.periculosidade?"#F59E0B":"#E5E7EB",color:form.periculosidade?"#fff":"#6B7280"}}>
                    {form.periculosidade?"✓ SIM":"NÃO"}
                  </button>
                </div>
              </div>
            </div>`
);

// ══════════════════════════════════════════════════════════════════
// 14. Histórico accordion no fim do form de edição
// ══════════════════════════════════════════════════════════════════
rep('add historico accordion to edit form',
`            <div style={{display:"flex",gap:10,marginTop:4,marginBottom:24}}>
              <button onClick={salvar} style={s.btn} disabled={loading}>{loading?"Salvando...":"💾 Salvar"}</button>
              <button onClick={()=>setEditando(null)} style={s.btnOutline}>Cancelar</button>
            </div>
          </div>`,
`            <div style={{display:"flex",gap:10,marginTop:4,marginBottom:12}}>
              <button onClick={salvar} style={s.btn} disabled={loading}>{loading?"Salvando...":"💾 Salvar"}</button>
              <button onClick={()=>setEditando(null)} style={s.btnOutline}>Cancelar</button>
            </div>

            <div style={s.card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",userSelect:"none"}}
                onClick={()=>{ if(abaEditar!=='historico'&&!loadingHistorico&&historicoAtestados.length===0&&historicoFerias.length===0) carregarHistorico(editando); setAbaEditar(p=>p==='historico'?'dados':'historico'); }}>
                <div style={{fontWeight:700,fontSize:13,color:C.pri,textTransform:"uppercase",letterSpacing:"0.05em"}}>🗂️ Histórico do Colaborador</div>
                <span style={{color:C.muted,fontSize:12}}>{abaEditar==='historico'?"▲ Fechar":"▶ Abrir"}</span>
              </div>
              {abaEditar==='historico'&&(
                <div style={{marginTop:16}}>
                  {loadingHistorico?(
                    <div style={{textAlign:"center",padding:"24px",color:C.muted}}>Carregando histórico...</div>
                  ):(
                    <div>
                      <div style={{fontWeight:700,fontSize:12,color:C.muted,textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:8}}>🏥 Atestados</div>
                      {historicoAtestados.length===0?(
                        <div style={{color:C.muted,fontSize:13,paddingBottom:16}}>Nenhum atestado encontrado nos últimos 3 anos.</div>
                      ):(
                        <table style={{width:"100%",borderCollapse:"collapse",marginBottom:20}}>
                          <thead><tr style={{background:"#F9FAFB"}}>
                            <th style={s.th}>CID</th><th style={s.th}>Início</th><th style={s.th}>Fim</th>
                            <th style={{...s.th,textAlign:"center"}}>Dias</th><th style={s.th}>Observações</th>
                          </tr></thead>
                          <tbody>{historicoAtestados.map((a,i)=>{
                            const d1=new Date(a.inicio+'T12:00:00'),d2=new Date(a.fim+'T12:00:00');
                            const dias=Math.round((d2-d1)/86400000)+1;
                            return(<tr key={i} style={{borderTop:"1px solid "+C.border}}>
                              <td style={{...s.td,fontSize:12}}>{a.cid||"—"}</td>
                              <td style={{...s.td,fontSize:12}}>{d1.toLocaleDateString("pt-BR")}</td>
                              <td style={{...s.td,fontSize:12}}>{d2.toLocaleDateString("pt-BR")}</td>
                              <td style={{...s.td,textAlign:"center",fontWeight:700,color:dias>3?C.danger:C.text}}>{dias}</td>
                              <td style={{...s.td,fontSize:12,color:C.muted}}>{a.obs||"—"}</td>
                            </tr>);
                          })}</tbody>
                        </table>
                      )}
                      <div style={{fontWeight:700,fontSize:12,color:C.muted,textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:8}}>🏖️ Férias</div>
                      {historicoFerias.length===0?(
                        <div style={{color:C.muted,fontSize:13}}>Nenhuma férias registrada. Cadastre na aba Férias.</div>
                      ):(
                        <table style={{width:"100%",borderCollapse:"collapse"}}>
                          <thead><tr style={{background:"#F9FAFB"}}>
                            <th style={s.th}>Início</th><th style={s.th}>Fim</th>
                            <th style={{...s.th,textAlign:"center"}}>Dias</th><th style={{...s.th,textAlign:"center"}}>Status</th>
                          </tr></thead>
                          <tbody>{historicoFerias.map(f=>{
                            const cores={agendado:{bg:"#EFF6FF",c:"#1D4ED8"},em_gozo:{bg:"#FEF9C3",c:"#92400E"},concluido:{bg:"#DCFCE7",c:"#166534"},cancelado:{bg:"#FEE2E2",c:"#991B1B"}};
                            const cor=cores[f.status]||cores.agendado;
                            return(<tr key={f.id} style={{borderTop:"1px solid "+C.border}}>
                              <td style={{...s.td,fontSize:12}}>{f.inicio?new Date(f.inicio+'T12:00:00').toLocaleDateString("pt-BR"):"—"}</td>
                              <td style={{...s.td,fontSize:12}}>{f.fim?new Date(f.fim+'T12:00:00').toLocaleDateString("pt-BR"):"—"}</td>
                              <td style={{...s.td,textAlign:"center",fontWeight:700}}>{f.dias}</td>
                              <td style={{...s.td,textAlign:"center"}}><span style={{background:cor.bg,color:cor.c,padding:"2px 8px",borderRadius:10,fontSize:11,fontWeight:700}}>{f.status}</span></td>
                            </tr>);
                          })}</tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>`
);

// ══════════════════════════════════════════════════════════════════
// 15. AtestadosPage + FeriasPage (antes de PlaceholderPage)
// ══════════════════════════════════════════════════════════════════
rep('add AtestadosPage and FeriasPage components',
`      function PlaceholderPage({title,icon}){`,
`      function AtestadosPage({gasUrl, colabAPI}) {
        const hoje = new Date();
        const priDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0,10);
        const ultDia = new Date(hoje.getFullYear(), hoje.getMonth()+1, 0).toISOString().slice(0,10);
        const [ini, setIni] = React.useState(priDia);
        const [fim, setFim] = React.useState(ultDia);
        const [lista, setLista] = React.useState([]);
        const [loading, setLoading] = React.useState(false);
        const [status, setStatus] = React.useState(null);
        const [filtroColab, setFiltroColab] = React.useState('');

        const buscar = async () => {
          const url = gasUrl || localStorage.getItem('rh_gas_url') || '';
          if (!url) { setStatus({ok:false,msg:'URL do GAS não configurada em ⚙️ Configurações.'}); return; }
          setLoading(true); setStatus(null);
          try {
            const res = await fetch(url+'?acao=atestados&ini='+ini+'&fim='+fim);
            if(!res.ok) throw new Error('Servidor retornou '+res.status);
            const json = await res.json();
            if(!json.ok) throw new Error(json.msg||'Erro no GAS');
            setLista(json.atestados||[]);
            setStatus({ok:true, msg:(json.atestados||[]).length+' atestado(s) encontrado(s).'});
          } catch(e) { setStatus({ok:false,msg:'❌ '+e.message}); }
          setLoading(false);
        };

        React.useEffect(()=>{ buscar(); },[]);

        const filtrados = lista.filter(a=>!filtroColab||(a.nome||'').toLowerCase().includes(filtroColab.toLowerCase()));
        const totalDias = filtrados.reduce((acc,a)=>{
          const d1=new Date(a.inicio+'T12:00:00'), d2=new Date(a.fim+'T12:00:00');
          return acc+Math.max(0,Math.round((d2-d1)/86400000)+1);
        },0);
        const colaboradoresUnicos = new Set(filtrados.map(a=>a.nome)).size;

        return (
          <div>
            <div style={{fontSize:20,fontWeight:800,color:C.pri,marginBottom:4}}>🏥 Atestados</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:20}}>Atestados médicos dos colaboradores</div>
            <div style={{...s.card,display:"flex",gap:12,alignItems:"flex-end",flexWrap:"wrap",marginBottom:16}}>
              <div><label style={s.label}>De</label><input type="date" value={ini} onChange={e=>setIni(e.target.value)} style={s.input}/></div>
              <div><label style={s.label}>Até</label><input type="date" value={fim} onChange={e=>setFim(e.target.value)} style={s.input}/></div>
              <div style={{flex:1,minWidth:180}}>
                <label style={s.label}>Filtrar colaborador</label>
                <input type="text" value={filtroColab} onChange={e=>setFiltroColab(e.target.value)} placeholder="Nome..." style={s.input}/>
              </div>
              <button onClick={buscar} style={s.btn} disabled={loading}>{loading?'Buscando...':'🔍 Buscar'}</button>
            </div>
            {status&&<div style={{...s.card,background:status.ok?'#DCFCE7':'#FEE2E2',color:status.ok?'#166534':'#991B1B',marginBottom:16}}>{status.msg}</div>}
            {filtrados.length>0&&(
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}}>
                <div style={{...s.card,textAlign:"center",padding:"16px"}}>
                  <div style={{fontSize:28,fontWeight:800,color:C.pri}}>{filtrados.length}</div>
                  <div style={{fontSize:12,color:C.muted}}>Atestados</div>
                </div>
                <div style={{...s.card,textAlign:"center",padding:"16px"}}>
                  <div style={{fontSize:28,fontWeight:800,color:C.pri}}>{totalDias}</div>
                  <div style={{fontSize:12,color:C.muted}}>Dias afastados</div>
                </div>
                <div style={{...s.card,textAlign:"center",padding:"16px"}}>
                  <div style={{fontSize:28,fontWeight:800,color:C.pri}}>{colaboradoresUnicos}</div>
                  <div style={{fontSize:12,color:C.muted}}>Colaboradores</div>
                </div>
              </div>
            )}
            <div style={{...s.card,padding:0,overflow:"hidden"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{background:"#F9FAFB"}}>
                  <th style={s.th}>Colaborador</th><th style={s.th}>Setor</th><th style={s.th}>CID</th>
                  <th style={s.th}>Início</th><th style={s.th}>Fim</th>
                  <th style={{...s.th,textAlign:"center"}}>Dias</th><th style={s.th}>Observações</th>
                </tr></thead>
                <tbody>
                  {filtrados.length===0?(
                    <tr><td colSpan={7} style={{textAlign:"center",padding:"32px",color:C.muted}}>{loading?'Carregando...':'Nenhum atestado no período.'}</td></tr>
                  ):filtrados.map((a,i)=>{
                    const d1=new Date(a.inicio+'T12:00:00'), d2=new Date(a.fim+'T12:00:00');
                    const dias=Math.max(0,Math.round((d2-d1)/86400000)+1);
                    return(
                      <tr key={i} style={{borderTop:"1px solid "+C.border,background:"#fff"}}>
                        <td style={{...s.td,fontWeight:600}}>{a.nome}</td>
                        <td style={{...s.td,fontSize:12,color:C.muted}}>{a.setor||"—"}</td>
                        <td style={{...s.td,fontSize:12}}>{a.cid||"—"}</td>
                        <td style={{...s.td,fontSize:12}}>{d1.toLocaleDateString("pt-BR")}</td>
                        <td style={{...s.td,fontSize:12}}>{d2.toLocaleDateString("pt-BR")}</td>
                        <td style={{...s.td,textAlign:"center",fontWeight:700,color:dias>3?"#DC2626":C.text}}>{dias}</td>
                        <td style={{...s.td,fontSize:12,color:C.muted}}>{a.obs||"—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      }

      function FeriasPage({colabAPI, empresaId}) {
        const VAZIO = {colaboradorId:'',colaboradorNome:'',inicio:'',fim:'',status:'agendado',observacoes:''};
        const [lista, setLista] = React.useState([]);
        const [loading, setLoading] = React.useState(true);
        const [form, setForm] = React.useState(VAZIO);
        const [mostrarForm, setMostrarForm] = React.useState(false);
        const [status, setStatus] = React.useState(null);

        const calcDias = (ini,fim) => {
          if(!ini||!fim) return 0;
          return Math.max(0,Math.round((new Date(fim+'T12:00:00')-new Date(ini+'T12:00:00'))/86400000)+1);
        };

        const carregar = async () => {
          setLoading(true);
          const {data,error} = await _supa.from('ferias').select('*').eq('empresa_id',empresaId).order('inicio',{ascending:false});
          if(!error) setLista(data||[]);
          setLoading(false);
        };

        React.useEffect(()=>{ if(empresaId) carregar(); },[empresaId]);

        const salvar = async () => {
          if(!form.colaboradorNome||!form.inicio||!form.fim){ setStatus({ok:false,msg:'Preencha colaborador, início e fim.'}); return; }
          setLoading(true);
          const {error} = await _supa.from('ferias').insert({
            empresa_id:empresaId, colaborador_nome:form.colaboradorNome,
            inicio:form.inicio, fim:form.fim, dias:calcDias(form.inicio,form.fim),
            status:form.status, observacoes:form.observacoes||null
          });
          if(error){ setStatus({ok:false,msg:'❌ '+error.message}); }
          else { setStatus({ok:true,msg:'✅ Férias agendadas!'}); setMostrarForm(false); carregar(); }
          setLoading(false);
        };

        const alterarStatus = async (id, novoStatus) => {
          await _supa.from('ferias').update({status:novoStatus,atualizado_em:new Date().toISOString()}).eq('id',id);
          carregar();
        };

        const excluir = async (id, nome) => {
          if(!window.confirm('Excluir férias de '+nome+'?')) return;
          await _supa.from('ferias').delete().eq('id',id);
          carregar();
        };

        const CORES = {
          agendado: {bg:"#EFF6FF",c:"#1D4ED8",l:"Agendado"},
          em_gozo:  {bg:"#FEF9C3",c:"#92400E",l:"Em gozo"},
          concluido:{bg:"#DCFCE7",c:"#166534",l:"Concluído"},
          cancelado:{bg:"#FEE2E2",c:"#991B1B",l:"Cancelado"},
        };

        return (
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <div>
                <div style={{fontSize:20,fontWeight:800,color:C.pri}}>🏖️ Férias</div>
                <div style={{fontSize:13,color:C.muted}}>Agendamento e controle de férias</div>
              </div>
              <button onClick={()=>{setMostrarForm(true);setForm(VAZIO);setStatus(null);}} style={s.btn}>➕ Agendar Férias</button>
            </div>
            {status&&<div style={{...s.card,background:status.ok?'#DCFCE7':'#FEE2E2',color:status.ok?'#166534':'#991B1B',marginBottom:16}}>{status.msg}</div>}
            {mostrarForm&&(
              <div style={{...s.card,marginBottom:16}}>
                <div style={{fontSize:15,fontWeight:700,color:C.pri,marginBottom:16}}>Agendar Férias</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 20px"}}>
                  <div style={{marginBottom:14,gridColumn:"1/-1"}}>
                    <label style={s.label}>Colaborador *</label>
                    <select value={form.colaboradorNome} onChange={e=>setForm(p=>({...p,colaboradorNome:e.target.value}))} style={{...s.input,width:"100%"}}>
                      <option value="">Selecione...</option>
                      {[...colabAPI].sort((a,b)=>a.nome.localeCompare(b.nome,'pt')).map(c=>(<option key={c.nome} value={c.nome}>{c.nome}</option>))}
                    </select>
                  </div>
                  <div style={{marginBottom:14}}>
                    <label style={s.label}>Início *</label>
                    <input type="date" value={form.inicio} onChange={e=>setForm(p=>({...p,inicio:e.target.value}))} style={s.input}/>
                  </div>
                  <div style={{marginBottom:14}}>
                    <label style={s.label}>Fim *</label>
                    <input type="date" value={form.fim} onChange={e=>setForm(p=>({...p,fim:e.target.value}))} style={s.input}/>
                  </div>
                  <div style={{marginBottom:14}}>
                    <label style={s.label}>Duração</label>
                    <div style={{...s.input,background:"#F9FAFB",color:C.muted}}>{form.inicio&&form.fim?calcDias(form.inicio,form.fim)+' dias corridos':'—'}</div>
                  </div>
                  <div style={{marginBottom:14}}>
                    <label style={s.label}>Status</label>
                    <select value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value}))} style={s.input}>
                      <option value="agendado">Agendado</option>
                      <option value="em_gozo">Em gozo</option>
                      <option value="concluido">Concluído</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  </div>
                  <div style={{marginBottom:14,gridColumn:"1/-1"}}>
                    <label style={s.label}>Observações</label>
                    <input type="text" value={form.observacoes} onChange={e=>setForm(p=>({...p,observacoes:e.target.value}))} placeholder="Opcional" style={s.input}/>
                  </div>
                </div>
                <div style={{display:"flex",gap:10}}>
                  <button onClick={salvar} style={s.btn} disabled={loading}>{loading?'Salvando...':'💾 Salvar'}</button>
                  <button onClick={()=>setMostrarForm(false)} style={s.btnOutline}>Cancelar</button>
                </div>
              </div>
            )}
            <div style={{...s.card,padding:0,overflow:"hidden"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{background:"#F9FAFB"}}>
                  <th style={s.th}>Colaborador</th><th style={s.th}>Início</th><th style={s.th}>Fim</th>
                  <th style={{...s.th,textAlign:"center"}}>Dias</th><th style={{...s.th,textAlign:"center"}}>Status</th>
                  <th style={{...s.th,textAlign:"right"}}>Ações</th>
                </tr></thead>
                <tbody>
                  {lista.length===0?(
                    <tr><td colSpan={6} style={{textAlign:"center",padding:"32px",color:C.muted}}>
                      {loading?'Carregando...':'Nenhuma férias agendada. Clique em "Agendar Férias" para começar.'}
                    </td></tr>
                  ):lista.map(f=>{
                    const cor=CORES[f.status]||CORES.agendado;
                    return(
                      <tr key={f.id} style={{borderTop:"1px solid "+C.border,background:"#fff"}}>
                        <td style={{...s.td,fontWeight:600}}>{f.colaborador_nome}</td>
                        <td style={{...s.td,fontSize:12}}>{f.inicio?new Date(f.inicio+'T12:00:00').toLocaleDateString('pt-BR'):'—'}</td>
                        <td style={{...s.td,fontSize:12}}>{f.fim?new Date(f.fim+'T12:00:00').toLocaleDateString('pt-BR'):'—'}</td>
                        <td style={{...s.td,textAlign:"center",fontWeight:700}}>{f.dias}</td>
                        <td style={{...s.td,textAlign:"center"}}>
                          <span style={{background:cor.bg,color:cor.c,padding:"3px 10px",borderRadius:10,fontSize:11,fontWeight:700}}>{cor.l}</span>
                        </td>
                        <td style={{...s.td,textAlign:"right",whiteSpace:"nowrap"}}>
                          <select onChange={e=>alterarStatus(f.id,e.target.value)} value={f.status}
                            style={{fontSize:11,border:"1px solid "+C.border,borderRadius:4,padding:"3px 6px",marginRight:8,cursor:"pointer"}}>
                            <option value="agendado">Agendado</option>
                            <option value="em_gozo">Em gozo</option>
                            <option value="concluido">Concluído</option>
                            <option value="cancelado">Cancelado</option>
                          </select>
                          <button onClick={()=>excluir(f.id,f.colaborador_nome)}
                            style={{background:"none",border:"1px solid #FCA5A5",color:"#DC2626",borderRadius:4,fontSize:11,padding:"3px 8px",cursor:"pointer"}}>✕</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      }

      function PlaceholderPage({title,icon}){`
);

// ══════════════════════════════════════════════════════════════════
// 16. App(): substituir PlaceholderPages por FeriasPage e AtestadosPage
// ══════════════════════════════════════════════════════════════════
rep('App render FeriasPage',
`{page==="ferias"&&<PlaceholderPage title="Férias" icon="🏖️"/>}`,
`{page==="ferias"&&<FeriasPage colabAPI={colabAPI} empresaId={empresaId}/>}`
);

rep('App render AtestadosPage',
`{page==="atestados"&&<PlaceholderPage title="Atestados" icon="🏥"/>}`,
`{page==="atestados"&&<AtestadosPage gasUrl={gasUrl} colabAPI={colabAPI}/>}`
);

// ══════════════════════════════════════════════════════════════════
// Salvar
// ══════════════════════════════════════════════════════════════════
fs.writeFileSync('index.html', html);
console.log('\n✅ ' + ok + ' substituições OK | ✗ ' + fail + ' falhas');
console.log('Tamanho do arquivo:', html.length);
