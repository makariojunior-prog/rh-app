const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
let ok = 0, fail = 0;

function rep(label, old, novo) {
  if (!html.includes(old)) { console.error('✗ NOT FOUND: ' + label); fail++; return; }
  html = html.replace(old, novo);
  console.log('✓ ' + label); ok++;
}

// ══════════════════════════════════════════════════════════════
// 1. GAS: update header comment to include candidatos
// ══════════════════════════════════════════════════════════════
rep('GAS header add candidatos',
`//   GET ?acao=folha_dados      → combina colaboradores + atestados em 1 chamada`,
`//   GET ?acao=folha_dados      → combina colaboradores + atestados em 1 chamada
//   GET ?acao=candidatos       → candidatos da aba RECRUTAMENTO`
);

// ══════════════════════════════════════════════════════════════
// 2. GAS doGet: add candidatos route
// ══════════════════════════════════════════════════════════════
rep('GAS doGet add candidatos route',
`    return _resp({ ok: false, msg: 'Ação desconhecida: ' + acao });`,
`    if (acao === 'candidatos') {
      return _resp({ ok: true, candidatos: _lerCandidatos(ss) });
    }

    return _resp({ ok: false, msg: 'Ação desconhecida: ' + acao });`
);

// ══════════════════════════════════════════════════════════════
// 3. GAS: add _lerCandidatos function after _lerAtestados
// ══════════════════════════════════════════════════════════════
rep('GAS add _lerCandidatos function',
`// ---------------------------------------------------------------
// POST
// ---------------------------------------------------------------
function doPost(e) {`,
`// ---------------------------------------------------------------
// Leitura de RECRUTAMENTO
// ---------------------------------------------------------------
function _lerCandidatos(ss) {
  var aba = ss.getSheetByName('RECRUTAMENTO');
  if (!aba) return [];
  var ultimaLinha = aba.getLastRow();
  if (ultimaLinha < 2) return [];

  var dados = aba.getRange(2, 1, ultimaLinha - 1, 21).getValues();
  var lista = [];
  for (var i = 0; i < dados.length; i++) {
    var l = dados[i];
    var ts = l[0]; // A - Carimbo de data/hora
    if (!ts) continue;
    var tsStr = ts instanceof Date
      ? Utilities.formatDate(ts, 'America/Sao_Paulo', 'yyyyMMddHHmmss')
      : String(ts).replace(/[^0-9]/g, '');
    var tsIso = ts instanceof Date
      ? Utilities.formatDate(ts, 'America/Sao_Paulo', 'yyyy-MM-dd HH:mm:ss')
      : String(ts);
    lista.push({
      timestamp:      tsIso,
      ts_key:         tsStr,
      nome:           String(l[1]||'').trim(),                  // B
      whatsapp:       String(l[2]||'').trim(),                  // C
      mora_goiania:   _bool(l[3]),                              // D
      vaga:           String(l[4]||'').trim(),                  // E
      disponibilidade_turno: _bool(l[5]),                       // F
      pode_comecar:   String(l[6]||'').trim(),                  // G
      tem_experiencia: _bool(l[7]),                             // H
      descricao_experiencia: String(l[8]||'').trim(),           // I
      possui_cnh:     _bool(l[9]),                              // J
      motivacao:      String(l[10]||'').trim(),                 // K
      curriculo_url:  String(l[11]||'').trim(),                 // L
      area_desejada:  String(l[12]||'').trim(),                 // M (manual)
      outra_area:     String(l[13]||'').trim(),                 // N (manual)
      diferencial:    String(l[14]||'').trim(),                 // O (manual)
      status_planilha: String(l[15]||'').trim().toLowerCase(),  // P (manual)
      data_entrevista_plan: l[16] instanceof Date
        ? Utilities.formatDate(l[16], 'America/Sao_Paulo', 'yyyy-MM-dd')
        : String(l[16]||'').trim(),                             // Q (manual)
      hora_entrevista_plan: String(l[17]||'').trim(),           // R (manual)
      avaliacao_plan: l[18] ? parseInt(String(l[18])) || null : null, // S (manual)
      obs_plan:       String(l[19]||'').trim(),                 // T (manual)
      contratado:     _bool(l[20])                              // U (manual)
    });
  }
  return lista;
}

// ---------------------------------------------------------------
// POST
// ---------------------------------------------------------------
function doPost(e) {`
);

// ══════════════════════════════════════════════════════════════
// 4. AcessosPage TODAS_PAGINAS: add recrutamento
// ══════════════════════════════════════════════════════════════
rep('TODAS_PAGINAS add recrutamento',
`          {k:'adiantamentos', l:'💵 Adiantamentos'},
        ];`,
`          {k:'adiantamentos', l:'💵 Adiantamentos'},
          {k:'recrutamento',  l:'🧑‍💼 Recrutamento'},
        ];`
);

// ══════════════════════════════════════════════════════════════
// 5. App paginasPermitidas: add recrutamento
// ══════════════════════════════════════════════════════════════
rep('paginasPermitidas add recrutamento',
`        ? ['dashboard','colaboradores','vt','folha','ferias','atestados','ponto_hist','adiantamentos','acessos','ajuda','config']`,
`        ? ['dashboard','colaboradores','vt','folha','ferias','atestados','ponto_hist','adiantamentos','recrutamento','acessos','ajuda','config']`
);

// ══════════════════════════════════════════════════════════════
// 6. navItems: add recrutamento
// ══════════════════════════════════════════════════════════════
rep('navItems add recrutamento',
`        {k:'adiantamentos',l:'💵 Adiantamentos'},
        {k:'ponto_hist',l:'📊 Histórico Ponto'},`,
`        {k:'adiantamentos',l:'💵 Adiantamentos'},
        {k:'recrutamento',l:'🧑‍💼 Recrutamento'},
        {k:'ponto_hist',l:'📊 Histórico Ponto'},`
);

// ══════════════════════════════════════════════════════════════
// 7. App routing: add recrutamento
// ══════════════════════════════════════════════════════════════
rep('App routing add recrutamento',
`              {page==="adiantamentos"&&<AdiantamentosPage colabAPI={colabAPI} empresaId={empresaId}/>}`,
`              {page==="adiantamentos"&&<AdiantamentosPage colabAPI={colabAPI} empresaId={empresaId}/>}
              {page==="recrutamento"&&<RecrutamentoPage gasUrl={gasUrl} empresaId={empresaId}/>}`
);

// ══════════════════════════════════════════════════════════════
// 8. Insert RecrutamentoPage component before AdiantamentosPage
// ══════════════════════════════════════════════════════════════
rep('insert RecrutamentoPage component',
`      // ============================================================
      // MÓDULO ADIANTAMENTOS
      // ============================================================
      function AdiantamentosPage(`,
`      // ============================================================
      // MÓDULO RECRUTAMENTO
      // ============================================================
      function RecrutamentoPage({ gasUrl, empresaId }) {
        function normStr(s){ return (s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^A-Z0-9]/g,'').toUpperCase(); }

        const STATUS_C=[
          {k:'novo',      l:'Novo',       bg:'#DBEAFE',c:'#1D4ED8'},
          {k:'triagem',   l:'Triagem',    bg:'#FEF9C3',c:'#92400E'},
          {k:'entrevista',l:'Entrevista', bg:'#EDE9FE',c:'#6D28D9'},
          {k:'aprovado',  l:'Aprovado',   bg:'#DCFCE7',c:'#166534'},
          {k:'reprovado', l:'Reprovado',  bg:'#FEE2E2',c:'#991B1B'},
          {k:'banco',     l:'Banco',      bg:'#F3F4F6',c:'#374151'},
        ];
        const STATUS_E=[
          {k:'agendada', l:'Agendada', bg:'#EDE9FE',c:'#6D28D9'},
          {k:'realizada',l:'Realizada',bg:'#DCFCE7',c:'#166534'},
          {k:'cancelada',l:'Cancelada',bg:'#FEE2E2',c:'#991B1B'},
        ];
        const corC=(st)=>STATUS_C.find(x=>x.k===st)||STATUS_C[0];
        const corE=(st)=>STATUS_E.find(x=>x.k===st)||STATUS_E[0];

        const [aba, setAba]               = React.useState('curriculos');
        const [candidatos, setCandidatos] = React.useState([]);
        const [loadingC, setLoadingC]     = React.useState(true);
        const [syncing, setSyncing]       = React.useState(false);
        const [statusMsg, setStatusMsg]   = React.useState(null);
        const [filtroVaga, setFiltroVaga] = React.useState('');
        const [filtroSt, setFiltroSt]     = React.useState('');
        const [busca, setBusca]           = React.useState('');
        const [expandido, setExpandido]   = React.useState(null);
        const [entrevistas, setEntrevistas] = React.useState([]);
        const [loadingE, setLoadingE]     = React.useState(false);
        const VAZIO_E = {candidatoNome:'',vaga:'',dataEntrevista:'',horaEntrevista:'',entrevistador:'',localEntrevista:'',obs:''};
        const [mostrarFormE, setMostrarFormE] = React.useState(false);
        const [formE, setFormE]           = React.useState(VAZIO_E);
        const [editandoE, setEditandoE]   = React.useState(null);
        const [resultado, setResultado]   = React.useState(null);

        const carregarCandidatos = async () => {
          if(!empresaId) return;
          setLoadingC(true);
          const {data} = await _supa.from('candidatos').select('*').eq('empresa_id',empresaId).order('data_inscricao',{ascending:false});
          setCandidatos(data||[]);
          setLoadingC(false);
        };
        const carregarEntrevistas = async () => {
          if(!empresaId) return;
          setLoadingE(true);
          const {data} = await _supa.from('entrevistas').select('*').eq('empresa_id',empresaId).order('data_entrevista',{ascending:true});
          setEntrevistas(data||[]);
          setLoadingE(false);
        };
        React.useEffect(()=>{ carregarCandidatos(); carregarEntrevistas(); },[empresaId]);

        const sincronizar = async () => {
          const url = gasUrl || localStorage.getItem('rh_gas_url') || '';
          if(!url){ setStatusMsg({ok:false,msg:'URL do GAS não configurada em ⚙️ Configurações.'}); return; }
          setSyncing(true); setStatusMsg({ok:null,msg:'⏳ Buscando candidatos na planilha...'});
          try {
            const res = await fetch(url+'?acao=candidatos');
            if(!res.ok) throw new Error('Servidor retornou '+res.status);
            const json = await res.json();
            if(!json.ok) throw new Error(json.msg||'Erro no GAS');
            const lista = (json.candidatos||[]).filter(c=>c.nome);
            if(!lista.length){ setStatusMsg({ok:true,msg:'Nenhum candidato na planilha.'}); setSyncing(false); return; }
            setStatusMsg({ok:null,msg:'⏳ Salvando '+lista.length+' candidatos...'});
            const MAP_ST = {aprovado:'aprovado',reprovado:'reprovado',entrevista:'entrevista',triagem:'triagem',banco:'banco',contratado:'aprovado'};
            const records = lista.map(c=>({
              id: empresaId+'_'+normStr(c.nome)+'_'+c.ts_key,
              empresa_id: empresaId,
              nome: c.nome,
              whatsapp: c.whatsapp||null,
              mora_goiania: c.mora_goiania,
              vaga: c.vaga||null,
              disponibilidade_turno: c.disponibilidade_turno,
              pode_comecar: c.pode_comecar||null,
              tem_experiencia: c.tem_experiencia,
              descricao_experiencia: c.descricao_experiencia||null,
              possui_cnh: c.possui_cnh,
              motivacao: c.motivacao||null,
              curriculo_url: c.curriculo_url||null,
              area_desejada: c.area_desejada||null,
              outra_area: c.outra_area||null,
              diferencial: c.diferencial||null,
              data_inscricao: c.timestamp?c.timestamp.slice(0,10):null,
              status: MAP_ST[c.status_planilha]||'novo'
            }));
            const {error} = await _supa.from('candidatos').upsert(records,{onConflict:'id'});
            if(error) throw error;
            setStatusMsg({ok:true,msg:'✅ '+records.length+' candidatos sincronizados!'});
            carregarCandidatos();
          } catch(e){ setStatusMsg({ok:false,msg:'❌ '+e.message}); }
          setSyncing(false);
        };

        const atualizarStatusC = async (id, novoSt) => {
          await _supa.from('candidatos').update({status:novoSt}).eq('id',id);
          setCandidatos(prev=>prev.map(c=>c.id===id?{...c,status:novoSt}:c));
        };

        const agendarEntrevista = (c) => {
          setFormE({...VAZIO_E,candidatoNome:c.nome,vaga:c.vaga||''});
          setEditandoE(null); setMostrarFormE(true); setAba('entrevistas');
        };

        const salvarEntrevista = async () => {
          if(!formE.candidatoNome||!formE.dataEntrevista){ setStatusMsg({ok:false,msg:'Preencha candidato e data.'}); return; }
          setLoadingE(true);
          if(editandoE){
            const {error} = await _supa.from('entrevistas').update({
              candidato_nome:formE.candidatoNome, vaga:formE.vaga||null,
              data_entrevista:formE.dataEntrevista, hora_entrevista:formE.horaEntrevista||null,
              entrevistador:formE.entrevistador||null, local_entrevista:formE.localEntrevista||null,
              obs:formE.obs||null
            }).eq('id',editandoE);
            if(!error){ setMostrarFormE(false); setEditandoE(null); setFormE(VAZIO_E); carregarEntrevistas(); }
            else setStatusMsg({ok:false,msg:'❌ '+error.message});
          } else {
            const {error} = await _supa.from('entrevistas').insert({
              empresa_id:empresaId, candidato_nome:formE.candidatoNome,
              vaga:formE.vaga||null, data_entrevista:formE.dataEntrevista,
              hora_entrevista:formE.horaEntrevista||null, entrevistador:formE.entrevistador||null,
              local_entrevista:formE.localEntrevista||null, status:'agendada', obs:formE.obs||null
            });
            if(!error){
              const cand = candidatos.find(c=>c.nome===formE.candidatoNome);
              if(cand) atualizarStatusC(cand.id,'entrevista');
              setMostrarFormE(false); setFormE(VAZIO_E); carregarEntrevistas();
              setStatusMsg({ok:true,msg:'✅ Entrevista agendada!'});
            } else setStatusMsg({ok:false,msg:'❌ '+error.message});
          }
          setLoadingE(false);
        };

        const salvarResultado = async () => {
          if(!resultado) return;
          await _supa.from('entrevistas').update({
            status:resultado.status, avaliacao:resultado.avaliacao||null, obs:resultado.obs||null
          }).eq('id',resultado.id);
          if(resultado.status==='realizada'&&resultado.avaliacao){
            const entrev = entrevistas.find(x=>x.id===resultado.id);
            if(entrev){
              const cand = candidatos.find(c=>c.nome===entrev.candidato_nome);
              if(cand) atualizarStatusC(cand.id, resultado.avaliacao>=4?'aprovado':'reprovado');
            }
          }
          setResultado(null); carregarEntrevistas();
        };

        const vagas = [...new Set(candidatos.map(c=>c.vaga).filter(Boolean))].sort();
        const filtrados = candidatos.filter(c=>{
          if(filtroVaga&&c.vaga!==filtroVaga) return false;
          if(filtroSt&&c.status!==filtroSt) return false;
          if(busca&&!(c.nome||'').toLowerCase().includes(busca.toLowerCase())) return false;
          return true;
        });

        const tabSt = (k) => ({
          padding:'8px 18px',borderRadius:6,fontSize:13,fontWeight:700,cursor:'pointer',border:'none',
          background:aba===k?C.pri:'transparent',color:aba===k?'#fff':C.muted
        });

        return (
          <div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
              <div style={{fontSize:20,fontWeight:800,color:C.pri}}>🧑‍💼 Recrutamento</div>
              <div style={{display:'flex',gap:4,background:'#F3F4F6',borderRadius:8,padding:4}}>
                <button style={tabSt('curriculos')} onClick={()=>setAba('curriculos')}>📋 Currículos</button>
                <button style={tabSt('entrevistas')} onClick={()=>setAba('entrevistas')}>📅 Entrevistas</button>
              </div>
            </div>

            {statusMsg&&<div style={{padding:'10px 14px',borderRadius:6,marginBottom:14,fontSize:13,background:statusMsg.ok===true?'#DCFCE7':statusMsg.ok===false?'#FEE2E2':'#FEF9C3',color:statusMsg.ok===true?'#166534':statusMsg.ok===false?'#991B1B':'#92400E'}}>{statusMsg.msg}</div>}

            {aba==='curriculos'&&(
              <div>
                <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
                  <input style={{...s.input,width:200,marginBottom:0}} placeholder="Buscar por nome..." value={busca} onChange={e=>setBusca(e.target.value)}/>
                  <select style={{...s.input,width:170,marginBottom:0}} value={filtroVaga} onChange={e=>setFiltroVaga(e.target.value)}>
                    <option value="">Todas as vagas</option>
                    {vagas.map(v=>(<option key={v} value={v}>{v}</option>))}
                  </select>
                  <select style={{...s.input,width:140,marginBottom:0}} value={filtroSt} onChange={e=>setFiltroSt(e.target.value)}>
                    <option value="">Todos os status</option>
                    {STATUS_C.map(sc=>(<option key={sc.k} value={sc.k}>{sc.l}</option>))}
                  </select>
                  <div style={{flex:1}}/>
                  <button onClick={sincronizar} disabled={syncing} style={{...s.btnOutline,color:'#166534',borderColor:'#16A34A'}}>{syncing?'⏳ Sincronizando...':'📥 Sincronizar Planilha'}</button>
                </div>
                <div style={{fontSize:12,color:C.muted,marginBottom:10}}>{filtrados.length} candidato{filtrados.length!==1?'s':''}</div>
                {loadingC?<div style={{textAlign:'center',padding:'32px',color:C.muted}}>Carregando...</div>
                :filtrados.length===0?(
                  <div style={{...s.card,textAlign:'center',padding:'48px 20px',color:C.muted}}>
                    <div style={{fontSize:32,marginBottom:8}}>📋</div>
                    <div style={{fontWeight:700,marginBottom:4}}>Nenhum candidato encontrado</div>
                    <div style={{fontSize:12}}>Sincronize a planilha ou ajuste os filtros.</div>
                  </div>
                ):(
                  <div style={s.card}>
                    <table style={{width:'100%',borderCollapse:'collapse'}}>
                      <thead><tr style={{background:'#F9FAFB'}}>
                        <th style={s.th}>Nome</th><th style={s.th}>WhatsApp</th>
                        <th style={s.th}>Vaga</th><th style={s.th}>Inscrição</th>
                        <th style={{...s.th,textAlign:'center'}}>Status</th>
                        <th style={{...s.th,textAlign:'right'}}></th>
                      </tr></thead>
                      <tbody>
                        {filtrados.map(c=>{
                          const cor=corC(c.status); const ab=expandido===c.id;
                          return (
                            React.createElement(React.Fragment,{key:c.id},
                              React.createElement('tr',{style:{borderTop:'1px solid '+C.border,cursor:'pointer'},onClick:()=>setExpandido(ab?null:c.id)},
                                React.createElement('td',{style:{...s.td,fontWeight:600}},c.nome),
                                React.createElement('td',{style:{...s.td,fontSize:12}},c.whatsapp||'—'),
                                React.createElement('td',{style:{...s.td,fontSize:12}},c.vaga||'—'),
                                React.createElement('td',{style:{...s.td,fontSize:12}},c.data_inscricao?new Date(c.data_inscricao+'T12:00:00').toLocaleDateString('pt-BR'):'—'),
                                React.createElement('td',{style:{...s.td,textAlign:'center'}},
                                  React.createElement('select',{value:c.status||'novo',onClick:e=>e.stopPropagation(),onChange:e=>{e.stopPropagation();atualizarStatusC(c.id,e.target.value);},style:{background:cor.bg,color:cor.c,border:'none',borderRadius:10,padding:'2px 8px',fontSize:11,fontWeight:700,cursor:'pointer'}},
                                    STATUS_C.map(sc=>React.createElement('option',{key:sc.k,value:sc.k},sc.l))
                                  )
                                ),
                                React.createElement('td',{style:{...s.td,textAlign:'right'}},
                                  React.createElement('button',{onClick:e=>{e.stopPropagation();agendarEntrevista(c);},style:{background:'none',border:'1px solid '+C.pri,color:C.pri,borderRadius:5,fontSize:11,padding:'3px 8px',cursor:'pointer',marginRight:4}},'📅 Entrevistar'),
                                  React.createElement('span',{style:{fontSize:12,color:C.muted}},ab?'▲':'▼')
                                )
                              ),
                              ab&&React.createElement('tr',{style:{background:'#F9FAFB'}},
                                React.createElement('td',{colSpan:6,style:{padding:'16px 20px'}},
                                  React.createElement('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px 20px',fontSize:13}},
                                    React.createElement('div',null,React.createElement('span',{style:{color:C.muted,fontSize:11}},'Mora em Goiânia'),React.createElement('br'),React.createElement('strong',null,c.mora_goiania?'Sim':'Não')),
                                    React.createElement('div',null,React.createElement('span',{style:{color:C.muted,fontSize:11}},'Disponibilidade turno'),React.createElement('br'),React.createElement('strong',null,c.disponibilidade_turno?'Sim':'Não')),
                                    React.createElement('div',null,React.createElement('span',{style:{color:C.muted,fontSize:11}},'Pode começar'),React.createElement('br'),React.createElement('strong',null,c.pode_comecar||'—')),
                                    React.createElement('div',null,React.createElement('span',{style:{color:C.muted,fontSize:11}},'Experiência na área'),React.createElement('br'),React.createElement('strong',null,c.tem_experiencia?'Sim':'Não')),
                                    React.createElement('div',null,React.createElement('span',{style:{color:C.muted,fontSize:11}},'Possui CNH'),React.createElement('br'),React.createElement('strong',null,c.possui_cnh?'Sim':'Não')),
                                    React.createElement('div',null,React.createElement('span',{style:{color:C.muted,fontSize:11}},'Área desejada'),React.createElement('br'),React.createElement('strong',null,c.area_desejada||(c.outra_area?'Outra: '+c.outra_area:'—')))
                                  ),
                                  c.descricao_experiencia&&React.createElement('div',{style:{marginTop:10,fontSize:13}},React.createElement('span',{style:{color:C.muted,fontSize:11,display:'block'}},'Experiência profissional'),c.descricao_experiencia),
                                  c.motivacao&&React.createElement('div',{style:{marginTop:8,fontSize:13}},React.createElement('span',{style:{color:C.muted,fontSize:11,display:'block'}},'Motivação'),c.motivacao),
                                  c.diferencial&&React.createElement('div',{style:{marginTop:8,fontSize:13}},React.createElement('span',{style:{color:C.muted,fontSize:11,display:'block'}},'Diferencial'),c.diferencial),
                                  c.curriculo_url&&React.createElement('div',{style:{marginTop:8}},React.createElement('a',{href:c.curriculo_url,target:'_blank',rel:'noreferrer',style:{fontSize:12,color:C.pri,textDecoration:'underline'}},'📎 Ver currículo'))
                                )
                              )
                            )
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {aba==='entrevistas'&&(
              <div>
                {!mostrarFormE&&<button onClick={()=>{setFormE(VAZIO_E);setEditandoE(null);setMostrarFormE(true);}} style={{...s.btn,marginBottom:14}}>+ Nova Entrevista</button>}

                {mostrarFormE&&(
                  <div style={{...s.card,marginBottom:14,border:'1px solid '+C.pri}}>
                    <div style={{fontWeight:700,color:C.pri,marginBottom:14,fontSize:13,textTransform:'uppercase',letterSpacing:'0.05em'}}>{editandoE?'Editar Entrevista':'Agendar Entrevista'}</div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 20px'}}>
                      <div style={{marginBottom:14}}>
                        <label style={s.label}>Candidato *</label>
                        <input type="text" list="lista-cands" value={formE.candidatoNome} onChange={e=>setFormE(p=>({...p,candidatoNome:e.target.value}))} placeholder="Nome do candidato" style={s.input}/>
                        <datalist id="lista-cands">{candidatos.map(c=>(<option key={c.id} value={c.nome}/>))}</datalist>
                      </div>
                      <div style={{marginBottom:14}}>
                        <label style={s.label}>Vaga</label>
                        <input type="text" value={formE.vaga} onChange={e=>setFormE(p=>({...p,vaga:e.target.value}))} placeholder="Ex: Auxiliar de Cozinha" style={s.input}/>
                      </div>
                      <div style={{marginBottom:14}}>
                        <label style={s.label}>Data *</label>
                        <input type="date" value={formE.dataEntrevista} onChange={e=>setFormE(p=>({...p,dataEntrevista:e.target.value}))} style={s.input}/>
                      </div>
                      <div style={{marginBottom:14}}>
                        <label style={s.label}>Horário</label>
                        <input type="time" value={formE.horaEntrevista} onChange={e=>setFormE(p=>({...p,horaEntrevista:e.target.value}))} style={s.input}/>
                      </div>
                      <div style={{marginBottom:14}}>
                        <label style={s.label}>Entrevistador</label>
                        <input type="text" value={formE.entrevistador} onChange={e=>setFormE(p=>({...p,entrevistador:e.target.value}))} placeholder="Nome do responsável" style={s.input}/>
                      </div>
                      <div style={{marginBottom:14}}>
                        <label style={s.label}>Local</label>
                        <input type="text" value={formE.localEntrevista} onChange={e=>setFormE(p=>({...p,localEntrevista:e.target.value}))} placeholder="Sala, presencial, online..." style={s.input}/>
                      </div>
                      <div style={{marginBottom:14,gridColumn:'1/-1'}}>
                        <label style={s.label}>Observações</label>
                        <input type="text" value={formE.obs} onChange={e=>setFormE(p=>({...p,obs:e.target.value}))} placeholder="Trazer documentos, etc." style={s.input}/>
                      </div>
                    </div>
                    <div style={{display:'flex',gap:10}}>
                      <button onClick={salvarEntrevista} style={s.btn}>💾 Salvar</button>
                      <button onClick={()=>{setMostrarFormE(false);setEditandoE(null);setFormE(VAZIO_E);}} style={s.btnOutline}>Cancelar</button>
                    </div>
                  </div>
                )}

                {resultado&&(
                  <div style={{...s.card,marginBottom:14,border:'1px solid #A78BFA'}}>
                    <div style={{fontWeight:700,color:'#6D28D9',marginBottom:14,fontSize:13,textTransform:'uppercase'}}>📝 Registrar Resultado</div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 20px'}}>
                      <div style={{marginBottom:14}}>
                        <label style={s.label}>Status</label>
                        <select value={resultado.status} onChange={e=>setResultado(p=>({...p,status:e.target.value}))} style={s.input}>
                          {STATUS_E.map(se=>(<option key={se.k} value={se.k}>{se.l}</option>))}
                        </select>
                      </div>
                      <div style={{marginBottom:14}}>
                        <label style={s.label}>Avaliação</label>
                        <div style={{display:'flex',gap:6,paddingTop:8}}>
                          {[1,2,3,4,5].map(n=>(
                            <span key={n} onClick={()=>setResultado(p=>({...p,avaliacao:n}))} style={{fontSize:26,cursor:'pointer',color:n<=(resultado.avaliacao||0)?'#F59E0B':'#D1D5DB',lineHeight:1}}>★</span>
                          ))}
                        </div>
                      </div>
                      <div style={{marginBottom:14,gridColumn:'1/-1'}}>
                        <label style={s.label}>Observações do resultado</label>
                        <input type="text" value={resultado.obs||''} onChange={e=>setResultado(p=>({...p,obs:e.target.value}))} style={s.input}/>
                      </div>
                    </div>
                    <div style={{display:'flex',gap:10}}>
                      <button onClick={salvarResultado} style={s.btn}>💾 Salvar Resultado</button>
                      <button onClick={()=>setResultado(null)} style={s.btnOutline}>Cancelar</button>
                    </div>
                  </div>
                )}

                {loadingE?<div style={{textAlign:'center',padding:'32px',color:C.muted}}>Carregando...</div>
                :entrevistas.length===0?(
                  <div style={{...s.card,textAlign:'center',padding:'48px 20px',color:C.muted}}>
                    <div style={{fontSize:32,marginBottom:8}}>📅</div>
                    <div style={{fontWeight:700,marginBottom:4}}>Nenhuma entrevista agendada</div>
                    <div style={{fontSize:12}}>Use "+ Nova Entrevista" ou "📅 Entrevistar" na lista de currículos.</div>
                  </div>
                ):(
                  <div style={s.card}>
                    <table style={{width:'100%',borderCollapse:'collapse'}}>
                      <thead><tr style={{background:'#F9FAFB'}}>
                        <th style={s.th}>Candidato</th><th style={s.th}>Vaga</th>
                        <th style={s.th}>Data</th><th style={s.th}>Hora</th>
                        <th style={s.th}>Entrevistador</th>
                        <th style={{...s.th,textAlign:'center'}}>Status</th>
                        <th style={{...s.th,textAlign:'center'}}>Aval.</th>
                        <th style={{...s.th,textAlign:'right'}}></th>
                      </tr></thead>
                      <tbody>
                        {entrevistas.map(e=>{
                          const cor=corE(e.status);
                          return(
                            <tr key={e.id} style={{borderTop:'1px solid '+C.border}}>
                              <td style={{...s.td,fontWeight:600}}>{e.candidato_nome}</td>
                              <td style={{...s.td,fontSize:12}}>{e.vaga||'—'}</td>
                              <td style={{...s.td,fontSize:12}}>{e.data_entrevista?new Date(e.data_entrevista+'T12:00:00').toLocaleDateString('pt-BR'):'—'}</td>
                              <td style={{...s.td,fontSize:12}}>{e.hora_entrevista||'—'}</td>
                              <td style={{...s.td,fontSize:12}}>{e.entrevistador||'—'}</td>
                              <td style={{...s.td,textAlign:'center'}}><span style={{background:cor.bg,color:cor.c,padding:'2px 8px',borderRadius:10,fontSize:11,fontWeight:700}}>{cor.l}</span></td>
                              <td style={{...s.td,textAlign:'center'}}>
                                {e.avaliacao?[1,2,3,4,5].map(n=>(<span key={n} style={{color:n<=e.avaliacao?'#F59E0B':'#D1D5DB',fontSize:13}}>★</span>)):'—'}
                              </td>
                              <td style={{...s.td,textAlign:'right',whiteSpace:'nowrap'}}>
                                {e.status==='agendada'&&(
                                  <span>
                                    <button onClick={()=>{setFormE({candidatoNome:e.candidato_nome,vaga:e.vaga||'',dataEntrevista:e.data_entrevista||'',horaEntrevista:e.hora_entrevista||'',entrevistador:e.entrevistador||'',localEntrevista:e.local_entrevista||'',obs:e.obs||''});setEditandoE(e.id);setMostrarFormE(true);}} style={{background:'none',border:'1px solid '+C.border,borderRadius:5,fontSize:11,padding:'3px 8px',cursor:'pointer',marginRight:4}}>✏️</button>
                                    <button onClick={()=>setResultado({id:e.id,status:'realizada',avaliacao:0,obs:''})} style={{background:'none',border:'1px solid #A78BFA',color:'#6D28D9',borderRadius:5,fontSize:11,padding:'3px 8px',cursor:'pointer'}}>📝 Resultado</button>
                                  </span>
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
            )}
          </div>
        );
      }

      // ============================================================
      // MÓDULO ADIANTAMENTOS
      // ============================================================
      function AdiantamentosPage(`
);

fs.writeFileSync('index.html', html);
console.log('\n' + ok + ' OK | ' + fail + ' falhas | Tamanho: ' + html.length);
