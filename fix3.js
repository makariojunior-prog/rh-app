const fs = require('fs');
let html = fs.readFileSync('index.html','utf8');

function rep(label, old, novo) {
  if(!html.includes(old)) { console.error('✗ NOT FOUND:', label); return; }
  html = html.replace(old, novo);
  console.log('✓', label);
}

// ─────────────────────────────────────────────────────────────
// 1. GAS: adicionar _bool() antes de _lerColaboradores
// ─────────────────────────────────────────────────────────────
rep('GAS _bool helper',
`function _lerColaboradores(ss) {`,
`function _bool(v) {
  if (typeof v === 'boolean') return v;
  var s = String(v).trim().toUpperCase();
  return s === 'SIM' || s === 'TRUE' || s === '1' || s === 'X' || s === 'YES';
}

function _lerColaboradores(ss) {`
);

// 2. GAS: trocar !!linha[X] por _bool(linha[X]) nos termos
rep('GAS bool conversion fix',
`      contaSalario:           !!linha[24],                                // Y
      aditivoContrato:        !!linha[25],                                // Z
      usoArmario:             !!linha[26],                                // AA
      lgpd:                   !!linha[27],                                // AB
      imagem:                 !!linha[28],                                // AC
      camera:                 !!linha[29],                                // AD
      epiUniforme:            !!linha[30],                                // AE
      acompanhamentoProducao: !!linha[31],                                // AF
      usoCelular:             !!linha[32],                                // AG
      usoVeiculo:             !!linha[33],                                // AH
      termoConfidencialidade: !!linha[34],                                // AI
      termoAssiduidade:       !!linha[35],                                // AJ
      termoMudancaHorario:    !!linha[36]                                 // AK`,
`      contaSalario:           _bool(linha[24]),                          // Y
      aditivoContrato:        _bool(linha[25]),                          // Z
      usoArmario:             _bool(linha[26]),                          // AA
      lgpd:                   _bool(linha[27]),                          // AB
      imagem:                 _bool(linha[28]),                          // AC
      camera:                 _bool(linha[29]),                          // AD
      epiUniforme:            _bool(linha[30]),                          // AE
      acompanhamentoProducao: _bool(linha[31]),                          // AF
      usoCelular:             _bool(linha[32]),                          // AG
      usoVeiculo:             _bool(linha[33]),                          // AH
      termoConfidencialidade: _bool(linha[34]),                          // AI
      termoAssiduidade:       _bool(linha[35]),                          // AJ
      termoMudancaHorario:    _bool(linha[36])                           // AK`
);

// ─────────────────────────────────────────────────────────────
// 3. Estados: adicionar listaDesligados e mostrarDesligados
// ─────────────────────────────────────────────────────────────
rep('add listaDesligados state',
`      const [lista, setLista] = useState([]);
        const [loading, setLoading] = useState(true);`,
`      const [lista, setLista] = useState([]);
        const [listaDesligados, setListaDesligados] = useState([]);
        const [mostrarDesligados, setMostrarDesligados] = useState(false);
        const [loading, setLoading] = useState(true);`
);

// ─────────────────────────────────────────────────────────────
// 4. carregar() — buscar também inativos
// ─────────────────────────────────────────────────────────────
rep('carregar fetch desligados',
`            const {data,error} = await _supa.from('colaboradores').select('*').eq('empresa_id',empresaId).eq('ativo',true).order('nome');
            if(error) throw error;
            setLista(data||[]);`,
`            const {data,error} = await _supa.from('colaboradores').select('*').eq('empresa_id',empresaId).eq('ativo',true).order('nome');
            if(error) throw error;
            setLista(data||[]);
            const {data:dataD} = await _supa.from('colaboradores').select('*').eq('empresa_id',empresaId).eq('ativo',false).order('nome');
            setListaDesligados(dataD||[]);`
);

// ─────────────────────────────────────────────────────────────
// 5. sincronizarPlanilha — recarregar desligados também
// ─────────────────────────────────────────────────────────────
rep('sync reload desligados',
`            const {data:supaColab} = await _supa.from('colaboradores').select('*').eq('empresa_id',empresaId).eq('ativo',true).order('nome');
            setLista(supaColab||[]);`,
`            const {data:supaColab} = await _supa.from('colaboradores').select('*').eq('empresa_id',empresaId).eq('ativo',true).order('nome');
            setLista(supaColab||[]);
            const {data:supaD} = await _supa.from('colaboradores').select('*').eq('empresa_id',empresaId).eq('ativo',false).order('nome');
            setListaDesligados(supaD||[]);`
);

// ─────────────────────────────────────────────────────────────
// 6. desativar() — mover para listaDesligados
// ─────────────────────────────────────────────────────────────
rep('desativar move to listaDesligados',
`          if(!error){
            const novaLista = lista.filter(x=>x.id!==c.id);
            setLista(novaLista); setColabAPI(novaLista.map(mapearParaApp));
            setStatus({ok:true,msg:\`✅ \${c.nome} desativado.\`});
          } else { setStatus({ok:false,msg:"❌ Erro: "+error.message}); }`,
`          if(!error){
            const novaLista = lista.filter(x=>x.id!==c.id);
            setLista(novaLista); setColabAPI(novaLista.map(mapearParaApp));
            setListaDesligados(prev=>[...prev,{...c,ativo:false}].sort((a,b)=>a.nome.localeCompare(b.nome,'pt')));
            setStatus({ok:true,msg:\`✅ \${c.nome} desativado.\`});
          } else { setStatus({ok:false,msg:"❌ Erro: "+error.message}); }`
);

// ─────────────────────────────────────────────────────────────
// 7. Adicionar função reativar() antes de desativar()
// ─────────────────────────────────────────────────────────────
rep('add reativar function',
`        const desativar = async c => {`,
`        const reativar = async c => {
          if(!window.confirm('Reativar "'+c.nome+'"?')) return;
          setLoading(true);
          const {error} = await _supa.from('colaboradores').update({ativo:true,atualizado_em:new Date().toISOString()}).eq('id',c.id);
          if(!error){
            setListaDesligados(prev=>prev.filter(x=>x.id!==c.id));
            const novaLista = [...lista,{...c,ativo:true}].sort((a,b)=>a.nome.localeCompare(b.nome,'pt'));
            setLista(novaLista); setColabAPI(novaLista.map(mapearParaApp));
            setStatus({ok:true,msg:'✅ '+c.nome+' reativado.'});
          } else { setStatus({ok:false,msg:'❌ Erro: '+error.message}); }
          setLoading(false);
        };

        const desativar = async c => {`
);

// ─────────────────────────────────────────────────────────────
// 8. Badge de experiência na coluna Nome da tabela
// ─────────────────────────────────────────────────────────────
rep('experiencia badge in list',
`                          <td style={{...s.td,fontWeight:600}}>{c.nome}</td>`,
`                          <td style={{...s.td,fontWeight:600}}>
                            {c.nome}
                            {(function(){var h=new Date().toISOString().slice(0,10);return c.experiencia_90&&c.experiencia_90>=h?React.createElement('span',{style:{marginLeft:8,fontSize:10,background:"#EDE9FE",color:"#6D28D9",padding:"2px 7px",borderRadius:10,fontWeight:700,verticalAlign:"middle"}},"experiência"):null;})()}
                          </td>`
);

// ─────────────────────────────────────────────────────────────
// 9. Seção de desligados + contador atualizado
// ─────────────────────────────────────────────────────────────
rep('desligados section + updated counter',
`            <div style={{fontSize:12,color:C.muted,marginTop:4}}>{lista.length} colaborador{lista.length!==1?"es":""} ativo{lista.length!==1?"s":""}</div>`,
`            <div style={{fontSize:12,color:C.muted,marginTop:4}}>
              {lista.length} colaborador{lista.length!==1?"es":""} ativo{lista.length!==1?"s":""}
              {listaDesligados.length>0?" · "+listaDesligados.length+" desligado"+(listaDesligados.length!==1?"s":""):""}
            </div>

            {listaDesligados.length>0&&(
              <div style={{marginTop:16}}>
                <button onClick={()=>setMostrarDesligados(p=>!p)}
                  style={{background:"none",border:"1px solid "+C.border,borderRadius:6,padding:"6px 14px",fontSize:12,cursor:"pointer",color:C.muted,fontWeight:600,display:"flex",alignItems:"center",gap:6}}>
                  {mostrarDesligados?"▲ Ocultar":"▶ Ver"} desligados ({listaDesligados.length})
                </button>
                {mostrarDesligados&&(
                  <div style={{marginTop:8,border:"1px solid "+C.border,borderRadius:8,overflow:"hidden",opacity:0.85}}>
                    <table style={{width:"100%",borderCollapse:"collapse"}}>
                      <thead><tr style={{background:"#F9FAFB"}}>
                        <th style={s.th}>Nome</th><th style={s.th}>Função</th><th style={s.th}>Setor</th><th style={{...s.th,textAlign:"right"}}></th>
                      </tr></thead>
                      <tbody>
                        {listaDesligados.map(c=>(
                          <tr key={c.id} style={{background:"#fff",borderTop:"1px solid "+C.border}}>
                            <td style={{...s.td,fontWeight:600,color:C.muted}}>{c.nome}</td>
                            <td style={{...s.td,fontSize:12,color:C.muted}}>{c.funcao||"—"}</td>
                            <td style={{...s.td,fontSize:12,color:C.muted}}>{c.setor||"—"}</td>
                            <td style={{...s.td,textAlign:"right"}}>
                              <button onClick={()=>reativar(c)} style={{background:"none",border:"1px solid #86EFAC",color:"#16A34A",borderRadius:5,fontSize:11,padding:"4px 10px",cursor:"pointer"}}>↩ Reativar</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}`
);

fs.writeFileSync('index.html', html);
console.log('\nArquivo salvo. Tamanho:', html.length);
