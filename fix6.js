const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

function rep(label, old, novo) {
  if (!html.includes(old)) { console.error('✗ NOT FOUND: ' + label); return false; }
  html = html.replace(old, novo);
  console.log('✓ ' + label); return true;
}

// ══════════════════════════════════════════════════════════════
// 1. Substituir AtestadosPage completa
// ══════════════════════════════════════════════════════════════
const OLD_ATESTADOS_START = `      function AtestadosPage({gasUrl, colabAPI}) {`;
const OLD_ATESTADOS_END   = `\n        );\n      }\n\n    ` + `function FeriasPage`;

if (!html.includes(OLD_ATESTADOS_START)) {
  console.error('AtestadosPage start NOT FOUND'); process.exit(1);
}
const startIdx = html.indexOf(OLD_ATESTADOS_START);
const endIdx   = html.indexOf('\n      function FeriasPage', startIdx);
if (endIdx < 0) { console.error('FeriasPage boundary NOT FOUND'); process.exit(1); }

const NOVA_ATESTADOS = `      function AtestadosPage({gasUrl, colabAPI, empresaId}) {
        function normStr(s) {
          return (s||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/[^A-Z0-9]/g,'').toUpperCase();
        }
        const calcDias = (ini,fim) => {
          if(!ini||!fim) return 1;
          return Math.max(1, Math.round((new Date(fim+'T12:00:00')-new Date(ini+'T12:00:00'))/86400000)+1);
        };
        const VAZIO = {colaboradorNome:'',setor:'',cid:'',inicio:'',fim:'',obs:''};
        const hoje = new Date();
        const priDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0,10);
        const ultDia = new Date(hoje.getFullYear(), hoje.getMonth()+1, 0).toISOString().slice(0,10);
        const [iniF, setIniF] = React.useState(priDia);
        const [fimF, setFimF] = React.useState(ultDia);
        const [lista, setLista] = React.useState([]);
        const [loading, setLoading] = React.useState(true);
        const [syncing, setSyncing] = React.useState(false);
        const [status, setStatus] = React.useState(null);
        const [filtroColab, setFiltroColab] = React.useState('');
        const [form, setForm] = React.useState(VAZIO);
        const [mostrarForm, setMostrarForm] = React.useState(false);

        const carregar = async () => {
          if(!empresaId) return;
          setLoading(true);
          const {data,error} = await _supa.from('atestados')
            .select('*').eq('empresa_id',empresaId)
            .gte('inicio',iniF).lte('inicio',fimF)
            .order('inicio',{ascending:false});
          if(!error) setLista(data||[]);
          setLoading(false);
        };

        React.useEffect(()=>{ carregar(); },[empresaId,iniF,fimF]);

        const sincronizar = async () => {
          const url = gasUrl || localStorage.getItem('rh_gas_url') || '';
          if(!url){ setStatus({ok:false,msg:'URL do GAS não configurada em ⚙️ Configurações.'}); return; }
          setSyncing(true); setStatus({ok:null,msg:'⏳ Buscando atestados na planilha...'});
          try {
            const ini5 = new Date(hoje.getFullYear()-5,0,1).toISOString().slice(0,10);
            const fim5 = new Date().toISOString().slice(0,10);
            const res = await fetch(url+'?acao=atestados&ini='+ini5+'&fim='+fim5);
            if(!res.ok) throw new Error('Servidor retornou '+res.status);
            const json = await res.json();
            if(!json.ok) throw new Error(json.msg||'Erro no GAS');
            const atestados = json.atestados||[];
            if(atestados.length===0){ setStatus({ok:true,msg:'Planilha sem atestados no período.'}); setSyncing(false); return; }
            setStatus({ok:null,msg:'⏳ Salvando '+atestados.length+' atestados no Supabase...'});
            const records = atestados.map(a=>({
              id: empresaId+'_'+normStr(a.nome)+'_'+(a.inicio||'').replace(/-/g,''),
              empresa_id: empresaId,
              colaborador_nome: (a.nome||'').trim(),
              setor: a.setor||null,
              cid: a.cid||null,
              inicio: a.inicio||null,
              fim: a.fim||a.inicio||null,
              dias: calcDias(a.inicio,a.fim||a.inicio),
              obs: a.obs||null,
              origem: 'planilha',
              atualizado_em: new Date().toISOString()
            })).filter(r=>r.inicio);
            const {error} = await _supa.from('atestados').upsert(records,{onConflict:'id'});
            if(error) throw error;
            setStatus({ok:true,msg:'✅ '+records.length+' atestados sincronizados!'});
            carregar();
          } catch(e){ setStatus({ok:false,msg:'❌ '+e.message}); }
          setSyncing(false);
        };

        const salvarNovo = async () => {
          if(!form.colaboradorNome||!form.inicio||!form.fim){
            setStatus({ok:false,msg:'Preencha colaborador, início e fim.'}); return;
          }
          setLoading(true);
          const dias = calcDias(form.inicio,form.fim);
          const {error} = await _supa.from('atestados').insert({
            empresa_id: empresaId,
            colaborador_nome: form.colaboradorNome.trim(),
            setor: form.setor||null, cid: form.cid||null,
            inicio: form.inicio, fim: form.fim, dias,
            obs: form.obs||null, origem: 'manual',
            atualizado_em: new Date().toISOString()
          });
          if(error){ setStatus({ok:false,msg:'❌ '+error.message}); }
          else { setStatus({ok:true,msg:'✅ Atestado incluído!'}); setMostrarForm(false); setForm(VAZIO); carregar(); }
          setLoading(false);
        };

        const excluir = async (id, nome) => {
          if(!window.confirm('Excluir atestado de '+nome+'?')) return;
          await _supa.from('atestados').delete().eq('id',id);
          carregar();
        };

        const filtrados = lista.filter(a=>!filtroColab||(a.colaborador_nome||'').toLowerCase().includes(filtroColab.toLowerCase()));
        const totalDias = filtrados.reduce((acc,a)=>acc+(a.dias||0),0);
        const colab = [...new Set(filtrados.map(a=>a.colaborador_nome))].length;

        return (
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <div>
                <div style={{fontSize:20,fontWeight:800,color:C.pri}}>🏥 Atestados</div>
                <div style={{fontSize:13,color:C.muted}}>Atestados médicos dos colaboradores</div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>{ setMostrarForm(true); setForm(VAZIO); setStatus(null); }} style={s.btn}>➕ Novo Atestado</button>
                <button onClick={sincronizar} style={s.btnOutline} disabled={syncing}>{syncing?'Sincronizando...':'🔄 Sincronizar Planilha'}</button>
              </div>
            </div>

            {status&&<div style={{...s.card,background:status.ok===true?'#DCFCE7':status.ok===false?'#FEE2E2':'#EFF6FF',color:status.ok===true?'#166534':status.ok===false?'#991B1B':'#1D4ED8',margin:"12px 0"}}>{status.msg}</div>}

            {mostrarForm&&(
              <div style={{...s.card,marginBottom:16}}>
                <div style={{fontSize:15,fontWeight:700,color:C.pri,marginBottom:16}}>Novo Atestado</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 20px"}}>
                  <div style={{marginBottom:14,gridColumn:"1/-1"}}>
                    <label style={s.label}>Colaborador *</label>
                    <select value={form.colaboradorNome}
                      onChange={e=>{ const c=colabAPI.find(x=>x.nome===e.target.value); setForm(p=>({...p,colaboradorNome:e.target.value,setor:c?c.setor||'':''})); }}
                      style={{...s.input,width:"100%"}}>
                      <option value="">Selecione ou digite abaixo...</option>
                      {[...colabAPI].sort((a,b)=>a.nome.localeCompare(b.nome,'pt')).map(c=>(<option key={c.nome} value={c.nome}>{c.nome}</option>))}
                    </select>
                    <input type="text" value={form.colaboradorNome} onChange={e=>setForm(p=>({...p,colaboradorNome:e.target.value}))} placeholder="Ou digite o nome manualmente..." style={{...s.input,marginTop:4}}/>
                  </div>
                  <div style={{marginBottom:14}}>
                    <label style={s.label}>Setor</label>
                    <input type="text" value={form.setor} onChange={e=>setForm(p=>({...p,setor:e.target.value}))} placeholder="Ex: Produção" style={s.input}/>
                  </div>
                  <div style={{marginBottom:14}}>
                    <label style={s.label}>CID</label>
                    <input type="text" value={form.cid} onChange={e=>setForm(p=>({...p,cid:e.target.value}))} placeholder="Ex: J00, M54..." style={s.input}/>
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
                    <div style={{...s.input,background:"#F9FAFB",color:C.muted}}>{form.inicio&&form.fim?calcDias(form.inicio,form.fim)+' dia(s)':'—'}</div>
                  </div>
                  <div style={{marginBottom:14,gridColumn:"1/-1"}}>
                    <label style={s.label}>Observações</label>
                    <input type="text" value={form.obs} onChange={e=>setForm(p=>({...p,obs:e.target.value}))} placeholder="Opcional" style={s.input}/>
                  </div>
                </div>
                <div style={{display:"flex",gap:10}}>
                  <button onClick={salvarNovo} style={s.btn} disabled={loading}>{loading?'Salvando...':'💾 Salvar'}</button>
                  <button onClick={()=>setMostrarForm(false)} style={s.btnOutline}>Cancelar</button>
                </div>
              </div>
            )}

            <div style={{...s.card,display:"flex",gap:12,alignItems:"flex-end",flexWrap:"wrap",marginBottom:16}}>
              <div><label style={s.label}>De</label><input type="date" value={iniF} onChange={e=>setIniF(e.target.value)} style={s.input}/></div>
              <div><label style={s.label}>Até</label><input type="date" value={fimF} onChange={e=>setFimF(e.target.value)} style={s.input}/></div>
              <div style={{flex:1,minWidth:180}}>
                <label style={s.label}>Filtrar colaborador</label>
                <input type="text" value={filtroColab} onChange={e=>setFiltroColab(e.target.value)} placeholder="Nome..." style={s.input}/>
              </div>
            </div>

            {filtrados.length>0&&(
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}}>
                <div style={{...s.card,textAlign:"center",padding:"16px"}}><div style={{fontSize:28,fontWeight:800,color:C.pri}}>{filtrados.length}</div><div style={{fontSize:12,color:C.muted}}>Atestados</div></div>
                <div style={{...s.card,textAlign:"center",padding:"16px"}}><div style={{fontSize:28,fontWeight:800,color:C.pri}}>{totalDias}</div><div style={{fontSize:12,color:C.muted}}>Dias afastados</div></div>
                <div style={{...s.card,textAlign:"center",padding:"16px"}}><div style={{fontSize:28,fontWeight:800,color:C.pri}}>{colab}</div><div style={{fontSize:12,color:C.muted}}>Colaboradores</div></div>
              </div>
            )}

            <div style={{...s.card,padding:0,overflow:"hidden"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{background:"#F9FAFB"}}>
                  <th style={s.th}>Colaborador</th><th style={s.th}>Setor</th><th style={s.th}>CID</th>
                  <th style={s.th}>Início</th><th style={s.th}>Fim</th>
                  <th style={{...s.th,textAlign:"center"}}>Dias</th>
                  <th style={s.th}>Obs.</th><th style={s.th}>Origem</th>
                  <th style={{...s.th,textAlign:"right"}}></th>
                </tr></thead>
                <tbody>
                  {loading?(
                    <tr><td colSpan={9} style={{textAlign:"center",padding:"32px",color:C.muted}}>Carregando...</td></tr>
                  ):filtrados.length===0?(
                    <tr><td colSpan={9} style={{textAlign:"center",padding:"32px",color:C.muted}}>
                      Nenhum atestado no período. Use "Sincronizar Planilha" para importar ou "Novo Atestado" para incluir.
                    </td></tr>
                  ):filtrados.map(a=>{
                    const d1=a.inicio?new Date(a.inicio+'T12:00:00'):null;
                    const d2=a.fim?new Date(a.fim+'T12:00:00'):null;
                    return(
                      <tr key={a.id} style={{borderTop:"1px solid "+C.border,background:"#fff"}}>
                        <td style={{...s.td,fontWeight:600}}>{a.colaborador_nome}</td>
                        <td style={{...s.td,fontSize:12,color:C.muted}}>{a.setor||"—"}</td>
                        <td style={{...s.td,fontSize:12}}>{a.cid||"—"}</td>
                        <td style={{...s.td,fontSize:12}}>{d1?d1.toLocaleDateString('pt-BR'):'—'}</td>
                        <td style={{...s.td,fontSize:12}}>{d2?d2.toLocaleDateString('pt-BR'):'—'}</td>
                        <td style={{...s.td,textAlign:"center",fontWeight:700,color:(a.dias||0)>3?"#DC2626":C.text}}>{a.dias||1}</td>
                        <td style={{...s.td,fontSize:12,color:C.muted,maxWidth:160}}>{a.obs||"—"}</td>
                        <td style={{...s.td,fontSize:11}}>
                          <span style={{background:a.origem==='manual'?"#EDE9FE":"#F0F9F4",color:a.origem==='manual'?"#6D28D9":"#166534",padding:"2px 7px",borderRadius:8,fontWeight:600}}>{a.origem==='manual'?'Manual':'Planilha'}</span>
                        </td>
                        <td style={{...s.td,textAlign:"right"}}>
                          <button onClick={()=>excluir(a.id,a.colaborador_nome)} style={{background:"none",border:"1px solid #FCA5A5",color:"#DC2626",borderRadius:4,fontSize:11,padding:"3px 8px",cursor:"pointer"}}>✕</button>
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

`;

html = html.substring(0, startIdx) + NOVA_ATESTADOS + html.substring(endIdx + 1);
console.log('✓ AtestadosPage replaced');

// ══════════════════════════════════════════════════════════════
// 2. Pass empresaId to AtestadosPage in App()
// ══════════════════════════════════════════════════════════════
rep('App pass empresaId to AtestadosPage',
  `<AtestadosPage gasUrl={gasUrl} colabAPI={colabAPI}/>`,
  `<AtestadosPage gasUrl={gasUrl} colabAPI={colabAPI} empresaId={empresaId}/>`
);

fs.writeFileSync('index.html', html);
console.log('Saved. Size:', html.length);
