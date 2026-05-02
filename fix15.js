const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
let ok = 0, fail = 0;

function rep(label, old, novo) {
  if (!html.includes(old)) { console.error('✗ NOT FOUND: ' + label); fail++; return; }
  html = html.replace(old, novo);
  console.log('✓ ' + label); ok++;
}

// ══════════════════════════════════════════════════════════════
// 1. Adicionar periculosidade no mapa colaboradoresUnificados
// ══════════════════════════════════════════════════════════════
rep('add periculosidade to colabUnificados mapa',
`              salario: c.salario || c["SALÁRIO"] || c.SALARIO || 0,
              transporte: c.transporte || 0,
              experiencia30: c.experiencia30 || "",`,
`              salario: c.salario || c["SALÁRIO"] || c.SALARIO || 0,
              transporte: c.transporte || 0,
              periculosidade: !!c.periculosidade,
              experiencia30: c.experiencia30 || "",`
);

// ══════════════════════════════════════════════════════════════
// 2. Adicionar estados historicoFolha e loadingHistFolha
// ══════════════════════════════════════════════════════════════
rep('FolhaPage add historico states',
`        const [loadingAPI, setLoadingAPI] = useState(false);
        const [showRegras, setShowRegras] = useState(false);`,
`        const [loadingAPI, setLoadingAPI] = useState(false);
        const [showRegras, setShowRegras] = useState(false);
        const [historicoFolha, setHistoricoFolha] = useState([]);
        const [loadingHistFolha, setLoadingHistFolha] = useState(false);`
);

// ══════════════════════════════════════════════════════════════
// 3. Adicionar carregarHistoricoFolha + salvarFolhaBanco antes de salvarFolha
// ══════════════════════════════════════════════════════════════
rep('FolhaPage add carregarHistorico and salvarFolhaBanco',
`        const salvarFolha = async () => {
          if (resultados.length === 0) { setSaveStatus({ok:false,msg:"Nenhum colaborador carregado."}); return; }`,
`        const carregarHistoricoFolha = async () => {
          if (!empresaId) return;
          setLoadingHistFolha(true);
          try {
            const {data} = await _supa.from('folha_mensal')
              .select('periodo,colaborador_nome,setor,salario_bruto,salario_liquido')
              .eq('empresa_id',empresaId).order('periodo',{ascending:false}).limit(500);
            setHistoricoFolha(data||[]);
          } catch(e){ setHistoricoFolha([]); }
          setLoadingHistFolha(false);
        };

        const salvarFolhaBanco = async () => {
          if (!resultados.length || !empresaId) return;
          try {
            const rows = resultados.map(r => {
              const sal       = Number(r.salario)||0;
              const diasUt    = r.calc.diasUteisPrevistos||22;
              const prop      = diasUt>0 ? sal*(r.calc.diasTrabalhados/diasUt) : sal;
              const pericVal  = r.periculosidade ? prop*0.30 : 0;
              const heVal     = (sal/220)*1.5*((r.calc.horasExtrasMin||0)/60);
              const dsrVal    = (sal/30)*(r.calc.dsrPerdidos||0);
              const bruto     = Math.max(0, prop - dsrVal + pericVal + heVal + (r.calc.cajuValor||0));
              const inss      = calcINSS(bruto);
              const vtVal     = r.calc.descontarVT ? (Number(r.transporte)||0) : 0;
              const liquido   = Math.max(0, bruto - inss - (r.calc.adiantamento||0) - (r.calc.produtos||0) - vtVal);
              return {
                empresa_id: empresaId, periodo: mesAno,
                colaborador_nome: r.nome, funcao: r.funcao||'', setor: r.setor||'',
                salario_base: sal, periculosidade: !!r.periculosidade,
                dias_trabalhados: r.calc.diasTrabalhados||0, dias_uteis_previstos: diasUt,
                faltas: r.calc.faltas||0, atestados: r.calc.atestados||0,
                caju_dias: r.calc.cajuDias||0, caju_valor: r.calc.cajuValor||0,
                horas_extras_min: r.calc.horasExtrasMin||0, dsr_perdidos: r.calc.dsrPerdidos||0,
                premio_assiduidade: !!r.calc.premioAssiduidade,
                adiantamento: r.calc.adiantamento||0, produtos: r.calc.produtos||0,
                descontar_vt: !!r.calc.descontarVT, vt_valor: Math.round(vtVal*100)/100,
                inss_desconto: Math.round(inss*100)/100,
                salario_bruto: Math.round(bruto*100)/100,
                salario_liquido: Math.round(liquido*100)/100,
              };
            });
            const {error} = await _supa.from('folha_mensal').upsert(rows,{onConflict:'empresa_id,periodo,colaborador_nome'});
            if(error) throw error;
            await carregarHistoricoFolha();
          } catch(e){ console.error('Folha banco erro:',e); }
        };

        useEffect(()=>{ carregarHistoricoFolha(); },[empresaId]);

        const salvarFolha = async () => {
          if (resultados.length === 0) { setSaveStatus({ok:false,msg:"Nenhum colaborador carregado."}); return; }`
);

// ══════════════════════════════════════════════════════════════
// 4. Chamar salvarFolhaBanco dentro de salvarFolha após adiantamento update
// ══════════════════════════════════════════════════════════════
rep('salvarFolha also call salvarFolhaBanco',
`            if(idsDescontar.length>0){
              await _supa.from('adiantamentos').update({status:'descontado'}).in('id',idsDescontar);
              setAdiantSupa({});
            }
          } catch(err) {
            setSaveStatus({ok:false, msg:"Erro: " + err.message});
          }
        };`,
`            if(idsDescontar.length>0){
              await _supa.from('adiantamentos').update({status:'descontado'}).in('id',idsDescontar);
              setAdiantSupa({});
            }
            await salvarFolhaBanco();
          } catch(err) {
            setSaveStatus({ok:false, msg:"Erro: " + err.message});
          }
        };`
);

// ══════════════════════════════════════════════════════════════
// 5. Adicionar card de Histórico Mensal no final do FolhaPage
// ══════════════════════════════════════════════════════════════
rep('FolhaPage add historico mensal card',
`                analisarDia={(iso,diaDados)=>analisarDia(colabSelecionado,iso,diaDados)}
              />
            )}
          </div>
        );
      }

      function PainelColaborador({colab, datasPeriodo, marcacoes, feriados, ajustes, onMarcar, onAjustar, onClose, analisarDia}) {`,
`                analisarDia={(iso,diaDados)=>analisarDia(colabSelecionado,iso,diaDados)}
              />
            )}

            <div style={s.card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div style={s.cardTitle}>📋 Histórico de Folhas — Banco de Dados</div>
                <button onClick={carregarHistoricoFolha} disabled={loadingHistFolha} style={{...s.btn,fontSize:11,padding:"5px 12px",gap:4}}>
                  {loadingHistFolha?"⏳":"🔄"} Atualizar
                </button>
              </div>
              {loadingHistFolha&&<div style={s.infoBox}>⏳ Carregando histórico...</div>}
              {!loadingHistFolha&&historicoFolha.length===0&&(
                <div style={{color:C.muted,fontSize:13,padding:"10px 0"}}>Nenhuma folha salva ainda. Após fechar o mês, clique em <strong>💾 Salvar na planilha</strong> para registrar automaticamente.</div>
              )}
              {!loadingHistFolha&&historicoFolha.length>0&&(()=>{
                const grupos={};
                historicoFolha.forEach(r=>{
                  if(!grupos[r.periodo]) grupos[r.periodo]={periodo:r.periodo,n:0,bruto:0,liquido:0};
                  grupos[r.periodo].n++;
                  grupos[r.periodo].bruto+=(r.salario_bruto||0);
                  grupos[r.periodo].liquido+=(r.salario_liquido||0);
                });
                const lista=Object.values(grupos).sort((a,b)=>{
                  const ka=a.periodo.split('/').reverse().join('');
                  const kb=b.periodo.split('/').reverse().join('');
                  return kb.localeCompare(ka);
                });
                return(
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead><tr style={{background:"#F9FAFB"}}>
                      <th style={s.th}>Período</th>
                      <th style={{...s.th,textAlign:"center"}}>Colab.</th>
                      <th style={{...s.th,textAlign:"right"}}>Total Bruto</th>
                      <th style={{...s.th,textAlign:"right"}}>Total Líquido</th>
                      <th style={{...s.th,textAlign:"right",color:C.danger}}>Custo c/ FGTS 8%</th>
                    </tr></thead>
                    <tbody>{lista.map((g,i)=>(
                      <tr key={i} style={{borderTop:\`1px solid \${C.border}\`,background:g.periodo===mesAno?"#F0F9FF":"transparent"}}>
                        <td style={{...s.td,fontWeight:700,color:g.periodo===mesAno?C.pri:"inherit"}}>
                          {g.periodo}{g.periodo===mesAno&&<span style={{marginLeft:6,fontSize:10,padding:"2px 6px",background:C.acc,color:"#fff",borderRadius:10}}>atual</span>}
                        </td>
                        <td style={s.tdC}>{g.n}</td>
                        <td style={{...s.td,textAlign:"right",fontWeight:600}}>{fmtBRL(g.bruto)}</td>
                        <td style={{...s.td,textAlign:"right"}}>{fmtBRL(g.liquido)}</td>
                        <td style={{...s.td,textAlign:"right",fontWeight:700,color:C.danger}}>{fmtBRL(g.bruto*1.08)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                );
              })()}
            </div>
          </div>
        );
      }

      function PainelColaborador({colab, datasPeriodo, marcacoes, feriados, ajustes, onMarcar, onAjustar, onClose, analisarDia}) {`
);

// ══════════════════════════════════════════════════════════════
// 6. Novo componente OrcamentoPage (antes de ConfiguracoesPage)
// ══════════════════════════════════════════════════════════════
rep('add OrcamentoPage component',
`      // ============================================================
      // MÓDULO CONFIGURAÇÕES (admin only)
      // ============================================================
      function ConfiguracoesPage({`,
`      // ============================================================
      // ORÇAMENTO DE FOLHA
      // ============================================================
      function OrcamentoPage({ colabAPI, empresaId }) {
        const [dadosFolha, setDadosFolha] = useState([]);
        const [periodoSel, setPeriodoSel] = useState('');
        const [encargos, setEncargos] = useState(8);
        const [loading, setLoading] = useState(true);

        useEffect(()=>{
          if(!empresaId) return;
          async function carregar(){
            setLoading(true);
            try {
              const {data} = await _supa.from('folha_mensal').select('*').eq('empresa_id',empresaId).order('periodo',{ascending:false}).limit(1000);
              const d = data||[];
              setDadosFolha(d);
              if(d.length>0 && !periodoSel){
                const pSorted=[...new Set(d.map(x=>x.periodo))].sort((a,b)=>{
                  const ka=a.split('/').reverse().join('');
                  const kb=b.split('/').reverse().join('');
                  return kb.localeCompare(ka);
                });
                setPeriodoSel(pSorted[0]);
              }
            } catch(e){ setDadosFolha([]); }
            setLoading(false);
          }
          carregar();
        },[empresaId]);

        const periodos=[...new Set(dadosFolha.map(x=>x.periodo))].sort((a,b)=>{
          const ka=a.split('/').reverse().join('');
          const kb=b.split('/').reverse().join('');
          return kb.localeCompare(ka);
        });

        const dp = dadosFolha.filter(r=>r.periodo===periodoSel);
        const totalBruto   = dp.reduce((a,r)=>a+(r.salario_bruto||0),0);
        const totalLiquido = dp.reduce((a,r)=>a+(r.salario_liquido||0),0);
        const custoEmp     = totalBruto*(1+encargos/100);
        const orcado       = colabAPI.reduce((a,c)=>a+(Number(c.salario)||0),0);

        // Por setor
        const setoresMap={};
        dp.forEach(r=>{
          const st=r.setor||'Sem setor';
          if(!setoresMap[st]) setoresMap[st]={setor:st,n:0,bruto:0,liquido:0};
          setoresMap[st].n++;
          setoresMap[st].bruto+=(r.salario_bruto||0);
          setoresMap[st].liquido+=(r.salario_liquido||0);
        });
        const setores=Object.values(setoresMap).sort((a,b)=>b.bruto-a.bruto);

        // Evolução mensal (últimos 12 meses ordenados cronológico)
        const resumoMensal=periodos.slice(0,12).map(p=>{
          const rows=dadosFolha.filter(r=>r.periodo===p);
          return {periodo:p, bruto:rows.reduce((a,r)=>a+(r.salario_bruto||0),0), n:rows.length};
        }).reverse();
        const maxBar=Math.max(...resumoMensal.map(m=>m.bruto),1);

        return(
          <div>
            <div style={{fontSize:20,fontWeight:800,color:C.pri,marginBottom:20}}>📊 Orçamento de Folha</div>

            {loading&&<div style={s.infoBox}>⏳ Carregando dados...</div>}
            {!loading&&dadosFolha.length===0&&(
              <div style={s.warnBox}>Nenhuma folha registrada ainda. Salve a folha em <strong>💼 Folha de Pagto</strong> para começar a rastrear o orçamento.</div>
            )}

            {!loading&&dadosFolha.length>0&&(
              <>
                {/* Seletor de período + encargos */}
                <div style={{display:"flex",gap:16,alignItems:"flex-end",marginBottom:20,flexWrap:"wrap"}}>
                  <div>
                    <label style={s.label}>Período</label>
                    <select style={s.input} value={periodoSel} onChange={e=>setPeriodoSel(e.target.value)}>
                      {periodos.map(p=><option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={s.label}>% Encargos patronais</label>
                    <input type="number" min="0" max="50" step="0.5" style={{...s.input,width:90}}
                      value={encargos} onChange={e=>setEncargos(Number(e.target.value)||0)}/>
                    <div style={{fontSize:11,color:C.muted,marginTop:3}}>FGTS=8% · adicione INSS patronal se aplicável</div>
                  </div>
                </div>

                {/* Cards resumo */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))",gap:12,marginBottom:20}}>
                  {[
                    {l:"Orçado (cadastro)",v:fmtBRL(orcado),sub:colabAPI.length+" colab. ativos",c:C.pri},
                    {l:"Realizado bruto",v:fmtBRL(totalBruto),sub:dp.length+" colab. no período",c:C.green},
                    {l:"Realizado líquido",v:fmtBRL(totalLiquido),sub:"após descontos",c:C.acc},
                    {l:\`Custo empresa (+\${encargos}%)\`,v:fmtBRL(custoEmp),sub:"bruto + encargos",c:C.danger},
                  ].map((card,i)=>(
                    <div key={i} style={{...s.card,margin:0}}>
                      <div style={{fontSize:11,color:C.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.04em"}}>{card.l}</div>
                      <div style={{fontSize:22,fontWeight:800,color:card.c,margin:"6px 0 2px"}}>{card.v}</div>
                      <div style={{fontSize:11,color:C.muted}}>{card.sub}</div>
                    </div>
                  ))}
                </div>

                {/* Variação orçado vs realizado */}
                {orcado>0&&dp.length>0&&(
                  <div style={{...s.card,background:totalBruto>orcado?"#FEF2F2":"#F0FDF4",border:\`1px solid \${totalBruto>orcado?"#FCA5A5":"#86EFAC"}\`,marginBottom:12}}>
                    <span style={{fontSize:13,fontWeight:600,color:totalBruto>orcado?C.danger:"#166534"}}>
                      {totalBruto>orcado?"⚠️ Folha acima do orçado em ":"✅ Folha dentro do orçado — economia de "}
                      {fmtBRL(Math.abs(totalBruto-orcado))}
                      {" ("+(Math.abs((totalBruto-orcado)/orcado)*100).toFixed(1)+"%)"}
                    </span>
                  </div>
                )}

                {/* Por setor */}
                {setores.length>0&&(
                  <div style={s.card}>
                    <div style={s.cardTitle}>Por setor — {periodoSel}</div>
                    <table style={{width:"100%",borderCollapse:"collapse"}}>
                      <thead><tr style={{background:"#F9FAFB"}}>
                        <th style={s.th}>Setor</th>
                        <th style={{...s.th,textAlign:"center"}}>Colab.</th>
                        <th style={{...s.th,textAlign:"right"}}>Bruto</th>
                        <th style={{...s.th,textAlign:"right"}}>Líquido</th>
                        <th style={{...s.th,textAlign:"right",color:C.danger}}>Custo empresa</th>
                        <th style={{...s.th,textAlign:"right"}}>% do total</th>
                      </tr></thead>
                      <tbody>{setores.map((st,i)=>(
                        <tr key={i} style={{borderTop:\`1px solid \${C.border}\`}}>
                          <td style={{...s.td,fontWeight:600}}>{st.setor}</td>
                          <td style={s.tdC}>{st.n}</td>
                          <td style={{...s.td,textAlign:"right"}}>{fmtBRL(st.bruto)}</td>
                          <td style={{...s.td,textAlign:"right"}}>{fmtBRL(st.liquido)}</td>
                          <td style={{...s.td,textAlign:"right",fontWeight:700,color:C.danger}}>{fmtBRL(st.bruto*(1+encargos/100))}</td>
                          <td style={{...s.td,textAlign:"right",color:C.muted}}>{totalBruto>0?(st.bruto/totalBruto*100).toFixed(1)+"%":"—"}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}

                {/* Evolução mensal */}
                {resumoMensal.length>1&&(
                  <div style={s.card}>
                    <div style={s.cardTitle}>📈 Evolução mensal — últimos {resumoMensal.length} meses</div>
                    <div style={{display:"flex",alignItems:"flex-end",gap:6,height:190,padding:"16px 0 0"}}>
                      {resumoMensal.map((m,i)=>{
                        const h=Math.max(Math.round((m.bruto/maxBar)*140),4);
                        const sel=m.periodo===periodoSel;
                        return(
                          <div key={i} onClick={()=>setPeriodoSel(m.periodo)}
                            style={{display:"flex",flexDirection:"column",alignItems:"center",flex:1,cursor:"pointer"}}>
                            <div style={{fontSize:10,color:sel?C.pri:C.muted,fontWeight:600,marginBottom:4,textAlign:"center"}}>
                              {fmtBRL(m.bruto).replace("R$ ","").replace("R$ ","")}
                            </div>
                            <div style={{width:"100%",height:h,background:sel?C.pri:C.acc,borderRadius:"4px 4px 0 0",opacity:sel?1:0.65,transition:"all 0.2s"}}/>
                            <div style={{fontSize:10,marginTop:6,color:sel?C.pri:C.muted,fontWeight:sel?700:400,textAlign:"center"}}>{m.periodo}</div>
                            <div style={{fontSize:9,color:C.muted,textAlign:"center"}}>{m.n} colab.</div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{fontSize:11,color:C.muted,marginTop:8}}>Clique em uma barra para ver o detalhamento do período.</div>
                  </div>
                )}
              </>
            )}
          </div>
        );
      }

      // ============================================================
      // MÓDULO CONFIGURAÇÕES (admin only)
      // ============================================================
      function ConfiguracoesPage({`
);

// ══════════════════════════════════════════════════════════════
// 7. TODAS_PAGINAS: adicionar orcamento
// ══════════════════════════════════════════════════════════════
rep('TODAS_PAGINAS add orcamento',
`          {k:'adiantamentos', l:'💵 Adiantamentos'},
          {k:'recrutamento',  l:'🧑‍💼 Recrutamento'},
        ];`,
`          {k:'adiantamentos', l:'💵 Adiantamentos'},
          {k:'recrutamento',  l:'🧑‍💼 Recrutamento'},
          {k:'orcamento',     l:'📊 Orçamento Folha'},
        ];`
);

// ══════════════════════════════════════════════════════════════
// 8. paginasPermitidas: adicionar orcamento para admin
// ══════════════════════════════════════════════════════════════
rep('paginasPermitidas add orcamento',
`        ? ['dashboard','colaboradores','vt','folha','ferias','atestados','ponto_hist','adiantamentos','recrutamento','acessos','ajuda','config']`,
`        ? ['dashboard','colaboradores','vt','folha','ferias','atestados','ponto_hist','adiantamentos','recrutamento','orcamento','acessos','ajuda','config']`
);

// ══════════════════════════════════════════════════════════════
// 9. navItems: adicionar orcamento após folha
// ══════════════════════════════════════════════════════════════
rep('navItems add orcamento',
`        {k:'folha',l:'💼 Folha de Pagto'},
        {k:'ferias',l:'🏖️ Férias'},`,
`        {k:'folha',l:'💼 Folha de Pagto'},
        {k:'orcamento',l:'📊 Orçamento Folha'},
        {k:'ferias',l:'🏖️ Férias'},`
);

// ══════════════════════════════════════════════════════════════
// 10. Routing: adicionar OrcamentoPage
// ══════════════════════════════════════════════════════════════
rep('routing add OrcamentoPage',
`              {page==="folha"&&<FolhaPage colabAPI={colabAPI} setColabAPI={setColabAPI} gasUrl={gasUrl} empresaId={empresaId}/>}`,
`              {page==="folha"&&<FolhaPage colabAPI={colabAPI} setColabAPI={setColabAPI} gasUrl={gasUrl} empresaId={empresaId}/>}
              {page==="orcamento"&&<OrcamentoPage colabAPI={colabAPI} empresaId={empresaId}/>}`
);

fs.writeFileSync('index.html', html);
console.log('\n' + ok + ' OK | ' + fail + ' falhas | Tamanho: ' + html.length);
