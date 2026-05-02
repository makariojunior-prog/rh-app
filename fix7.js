const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
let ok = 0, fail = 0;

function rep(label, old, novo) {
  if (!html.includes(old)) { console.error('✗ NOT FOUND: ' + label); fail++; return; }
  html = html.replace(old, novo);
  console.log('✓ ' + label); ok++;
}

// ══════════════════════════════════════════════════════════════
// 1. AtestadosPage: setor vira read-only, preenchido do colabAPI
// ══════════════════════════════════════════════════════════════
rep('atestados form: setor auto from colabAPI',
`                  <div style={{marginBottom:14}}>
                    <label style={s.label}>Setor</label>
                    <input type="text" value={form.setor} onChange={e=>setForm(p=>({...p,setor:e.target.value}))} placeholder="Ex: Produção" style={s.input}/>
                  </div>`,
`                  {form.setor&&(
                    <div style={{marginBottom:14}}>
                      <label style={s.label}>Setor (do cadastro)</label>
                      <div style={{...s.input,background:"#F9FAFB",color:C.muted,fontSize:13}}>{form.setor}</div>
                    </div>
                  )}`
);

// ══════════════════════════════════════════════════════════════
// 2. DashboardPage: adicionar empresaId à assinatura e busca
// ══════════════════════════════════════════════════════════════
rep('DashboardPage add empresaId prop',
`function DashboardPage({ onNavegar, gasUrl, colabAPI, setColabAPI }) {`,
`function DashboardPage({ onNavegar, gasUrl, colabAPI, setColabAPI, empresaId }) {`
);

// Adicionar estado e fetch de ausências logo após a definição de "const hoje"
rep('DashboardPage add ausencias state',
`        const lerStorage = () => ({`,
`        const [ausencias, setAusencias] = React.useState({atestados:[],ferias:[]});

        React.useEffect(()=>{
          if(!empresaId) return;
          const today = new Date().toISOString().slice(0,10);
          Promise.all([
            _supa.from('atestados').select('colaborador_nome,setor,cid,fim').eq('empresa_id',empresaId).lte('inicio',today).gte('fim',today),
            _supa.from('ferias').select('colaborador_nome,inicio,fim,status').eq('empresa_id',empresaId).lte('inicio',today).gte('fim',today).in('status',['agendado','em_gozo'])
          ]).then(([atRes,fRes])=>{
            const atestados = (atRes.data||[]).map(a=>({
              nome:a.colaborador_nome,
              setor:a.setor||(colabAPI.find(c=>c.nome===a.colaborador_nome)||{}).setor||'Não informado',
              cid:a.cid||'',
              fim:a.fim||''
            }));
            const ferias = (fRes.data||[]).map(f=>({
              nome:f.colaborador_nome,
              setor:(colabAPI.find(c=>c.nome===f.colaborador_nome)||{}).setor||'Não informado',
              fim:f.fim||''
            }));
            setAusencias({atestados,ferias});
          });
        },[empresaId]);

        const lerStorage = () => ({`
);

// ══════════════════════════════════════════════════════════════
// 3. DashboardPage: inserir card de ausências por setor antes do fechamento do JSX
// ══════════════════════════════════════════════════════════════
rep('DashboardPage add ausencias card in JSX',
`            </div>
          </div>
        );
      }

      // ============================================================
      // PÁGINA DE AJUDA`,
`            </div>

            {(ausencias.atestados.length>0||ausencias.ferias.length>0)&&(
              <div style={s.card}>
                <div style={{fontWeight:700,color:C.pri,marginBottom:16,fontSize:13,textTransform:"uppercase",letterSpacing:"0.05em"}}>
                  🚨 Ausências Hoje
                  <span style={{marginLeft:10,fontSize:12,fontWeight:400,color:C.muted}}>
                    {ausencias.atestados.length} atestado{ausencias.atestados.length!==1?"s":""} · {ausencias.ferias.length} férias
                  </span>
                </div>
                {(()=>{
                  const todos = [
                    ...ausencias.atestados.map(a=>({...a,tipo:'atestado'})),
                    ...ausencias.ferias.map(f=>({...f,tipo:'ferias'}))
                  ];
                  const porSetor = {};
                  todos.forEach(a=>{ const s=a.setor||'Não informado'; if(!porSetor[s]) porSetor[s]=[]; porSetor[s].push(a); });
                  return Object.entries(porSetor).sort((a,b)=>a[0].localeCompare(b[0],'pt')).map(([setor,pessoas])=>(
                    <div key={setor} style={{marginBottom:14}}>
                      <div style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:6}}>
                        {setor} <span style={{fontWeight:400}}>({pessoas.length})</span>
                      </div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                        {pessoas.map((p,i)=>(
                          <div key={i} style={{
                            display:"flex",alignItems:"center",gap:8,padding:"6px 12px",borderRadius:8,
                            background:p.tipo==='atestado'?"#FFF7ED":"#EFF6FF",
                            border:"1px solid "+(p.tipo==='atestado'?"#FED7AA":"#BFDBFE")
                          }}>
                            <span style={{fontSize:11,fontWeight:700,color:p.tipo==='atestado'?"#C2410C":"#1D4ED8"}}>
                              {p.tipo==='atestado'?"🏥 ATT":"🏖️ FER"}
                            </span>
                            <span style={{fontSize:13,fontWeight:600,color:C.text}}>{p.nome}</span>
                            {p.cid&&<span style={{fontSize:11,color:C.muted}}>({p.cid})</span>}
                            {p.fim&&<span style={{fontSize:11,color:C.muted}}>até {new Date(p.fim+'T12:00:00').toLocaleDateString('pt-BR')}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        );
      }

      // ============================================================
      // PÁGINA DE AJUDA`
);

// ══════════════════════════════════════════════════════════════
// 4. App(): passar empresaId para DashboardPage
// ══════════════════════════════════════════════════════════════
rep('App pass empresaId to DashboardPage',
`<DashboardPage onNavegar={setPage} gasUrl={gasUrl} colabAPI={colabAPI} setColabAPI={setColabAPI}/>`,
`<DashboardPage onNavegar={setPage} gasUrl={gasUrl} colabAPI={colabAPI} setColabAPI={setColabAPI} empresaId={empresaId}/>`
);

fs.writeFileSync('index.html', html);
console.log('\n' + ok + ' OK | ' + fail + ' falhas | Tamanho: ' + html.length);
