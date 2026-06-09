const fs = require('fs');
const fp = 'C:/Users/Makário Orozimbo/OneDrive/Github/rh-app/index.html';
let c = fs.readFileSync(fp, 'utf-8');

function rep(label, old, neo) {
  if (!c.includes(old)) { console.error('✗ ' + label + ' — marker not found'); return; }
  c = c.replace(old, neo);
  console.log('✓ ' + label);
}

// ════════════════════════════════════════════════════════════════
// 1. GAS: atualizar _lerColaboradores (lê C/D/E e Y-AK)
// ════════════════════════════════════════════════════════════════
rep('GAS _lerColaboradores',
`  var dados = aba.getRange(2, 1, ultimaLinha - 1, 20).getValues();
  var lista = [];
  for (var i = 0; i < dados.length; i++) {
    var linha = dados[i];
    var nome = linha[1];         // col B - NOME
    var encerramento = linha[6]; // col G - ENCERRAMENTO
    if (!nome || String(nome).trim() === '') continue;
    if (encerramento && String(encerramento).trim() !== '') continue; // pula desligados

    lista.push({
      nome:          String(nome).trim(),
      admissao:      _fmtDate(linha[5]),                              // F
      experiencia30: _fmtDate(linha[7]),                              // H
      experiencia90: _fmtDate(linha[8]),                              // I
      setor:         linha[9]  ? String(linha[9]).trim()  : '',       // J
      funcao:        linha[10] ? String(linha[10]).trim() : '',       // K
      cpf:           linha[12] || '',                                 // M
      nascimento:    _fmtDate(linha[13]),                             // N ← DATA NASCIMENTO
      salario:       linha[14] || 0,                                  // O
      inss:          linha[16] || 0,                                  // Q
      fgts:          linha[17] || 0,                                  // R
      transporte:    linha[18] || 0,                                  // S
      cafeManha:     linha[19] || 0                                   // T
    });
  }
  return lista;`,
`  var dados = aba.getRange(2, 1, ultimaLinha - 1, 37).getValues();
  var lista = [];
  for (var i = 0; i < dados.length; i++) {
    var linha = dados[i];
    var nome = linha[1];         // col B - NOME
    var encerramento = linha[6]; // col G - ENCERRAMENTO
    if (!nome || String(nome).trim() === '') continue;
    if (encerramento && String(encerramento).trim() !== '') continue; // pula desligados

    lista.push({
      nome:                   String(nome).trim(),
      telefone:               linha[2]  ? String(linha[2]).trim()  : '',  // C
      chavePix:               linha[3]  ? String(linha[3]).trim()  : '',  // D
      email:                  linha[4]  ? String(linha[4]).trim()  : '',  // E
      admissao:               _fmtDate(linha[5]),                         // F
      experiencia30:          _fmtDate(linha[7]),                         // H
      experiencia90:          _fmtDate(linha[8]),                         // I
      setor:                  linha[9]  ? String(linha[9]).trim()  : '',  // J
      funcao:                 linha[10] ? String(linha[10]).trim() : '',  // K
      cpf:                    linha[12] ? String(linha[12]).trim() : '',  // M
      nascimento:             _fmtDate(linha[13]),                        // N
      salario:                linha[14] || 0,                             // O
      inss:                   linha[16] || 0,                             // Q
      fgts:                   linha[17] || 0,                             // R
      transporte:             linha[18] || 0,                             // S
      contaSalario:           !!linha[24],                                // Y
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
      termoMudancaHorario:    !!linha[36]                                 // AK
    });
  }
  return lista;`
);

// ════════════════════════════════════════════════════════════════
// 2. Adicionar CampoForm fora de ColaboradoresPage (fix foco)
// ════════════════════════════════════════════════════════════════
rep('CampoForm component',
`      // ============================================================
      // MÓDULO COLABORADORES
      // ============================================================
      function ColaboradoresPage({ empresaId, setColabAPI, gasUrl }) {`,
`      // ============================================================
      // MÓDULO COLABORADORES
      // ============================================================
      function CampoForm({label, campo, type, placeholder, form, setForm}) {
        return (
          <div style={{marginBottom:14}}>
            <label style={s.label}>{label}</label>
            <input type={type||"text"} style={s.input} placeholder={placeholder||""}
              value={form[campo]!=null?form[campo]:''}
              onChange={e=>setForm(p=>({...p,[campo]:e.target.value}))}
            />
          </div>
        );
      }

      function ColaboradoresPage({ empresaId, setColabAPI, gasUrl }) {`
);

// ════════════════════════════════════════════════════════════════
// 3. FORM_VAZIO — adicionar novos campos, remover cafeManha
// ════════════════════════════════════════════════════════════════
rep('FORM_VAZIO',
`        const FORM_VAZIO = { nome:"", funcao:"", setor:"", cpf:"", nascimento:"", admissao:"",
          experiencia30:"", experiencia90:"", salario:"", inss:"", fgts:"", transporte:"", cafeManha:"" };`,
`        const FORM_VAZIO = {
          nome:"", funcao:"", setor:"", cpf:"", telefone:"", chavePix:"", email:"",
          nascimento:"", admissao:"", experiencia30:"", experiencia90:"",
          salario:"", inss:"", fgts:"", transporte:"",
          contaSalario:false, aditivoContrato:false, usoArmario:false,
          lgpd:false, imagem:false, camera:false, epiUniforme:false,
          acompanhamentoProducao:false, usoCelular:false, usoVeiculo:false,
          termoConfidencialidade:false, termoAssiduidade:false, termoMudancaHorario:false
        };`
);

// ════════════════════════════════════════════════════════════════
// 4. mapearParaApp — novos campos, remove cafeManha
// ════════════════════════════════════════════════════════════════
rep('mapearParaApp (ColaboradoresPage)',
`        const mapearParaApp = c => ({
          nome:c.nome, admissao:c.admissao||'', experiencia30:c.experiencia_30||'',
          experiencia90:c.experiencia_90||'', setor:c.setor||'', funcao:c.funcao||'',
          cpf:c.cpf||'', nascimento:c.nascimento||'',
          salario:Number(c.salario)||0, inss:Number(c.inss)||0, fgts:Number(c.fgts)||0,
          transporte:Number(c.transporte)||0, cafeManha:Number(c.cafe_manha)||0, id_supa:c.id
        });`,
`        const mapearParaApp = c => ({
          nome:c.nome, setor:c.setor||'', funcao:c.funcao||'', cpf:c.cpf||'',
          telefone:c.telefone||'', chavePix:c.chave_pix||'', email:c.email||'',
          nascimento:c.nascimento||'', admissao:c.admissao||'',
          experiencia30:c.experiencia_30||'', experiencia90:c.experiencia_90||'',
          salario:Number(c.salario)||0, inss:Number(c.inss)||0, fgts:Number(c.fgts)||0,
          transporte:Number(c.transporte)||0,
          contaSalario:!!c.conta_salario, aditivoContrato:!!c.aditivo_contrato,
          usoArmario:!!c.uso_armario, lgpd:!!c.lgpd, imagem:!!c.imagem,
          camera:!!c.camera, epiUniforme:!!c.epi_uniforme,
          acompanhamentoProducao:!!c.acompanhamento_producao,
          usoCelular:!!c.uso_celular, usoVeiculo:!!c.uso_veiculo,
          termoConfidencialidade:!!c.termo_confidencialidade,
          termoAssiduidade:!!c.termo_assiduidade,
          termoMudancaHorario:!!c.termo_mudanca_horario, id_supa:c.id
        });`
);

// ════════════════════════════════════════════════════════════════
// 5. sincronizarPlanilha — adicionar campos novos nos records
// ════════════════════════════════════════════════════════════════
rep('sincronizarPlanilha records',
`                funcao: c.funcao||null, setor: c.setor||null, cpf: c.cpf||null,
                nascimento: parseDateBR(c.nascimento),
                admissao: parseDateBR(c.admissao),
                experiencia_30: parseDateBR(c.experiencia30),
                experiencia_90: parseDateBR(c.experiencia90),
                salario: Number(c.salario)||0, inss: Number(c.inss)||0,
                fgts: Number(c.fgts)||0, transporte: Number(c.transporte)||0,
                cafe_manha: Number(c.cafeManha)||0,
                ativo: true, atualizado_em: new Date().toISOString()`,
`                funcao: c.funcao||null, setor: c.setor||null, cpf: c.cpf||null,
                telefone: c.telefone||null, chave_pix: c.chavePix||null, email: c.email||null,
                nascimento: parseDateBR(c.nascimento),
                admissao: parseDateBR(c.admissao),
                experiencia_30: parseDateBR(c.experiencia30),
                experiencia_90: parseDateBR(c.experiencia90),
                salario: Number(c.salario)||0, inss: Number(c.inss)||0,
                fgts: Number(c.fgts)||0, transporte: Number(c.transporte)||0,
                conta_salario: !!c.contaSalario, aditivo_contrato: !!c.aditivoContrato,
                uso_armario: !!c.usoArmario, lgpd: !!c.lgpd, imagem: !!c.imagem,
                camera: !!c.camera, epi_uniforme: !!c.epiUniforme,
                acompanhamento_producao: !!c.acompanhamentoProducao,
                uso_celular: !!c.usoCelular, uso_veiculo: !!c.usoVeiculo,
                termo_confidencialidade: !!c.termoConfidencialidade,
                termo_assiduidade: !!c.termoAssiduidade,
                termo_mudanca_horario: !!c.termoMudancaHorario,
                ativo: true, atualizado_em: new Date().toISOString()`
);

// colabParaApp também
rep('sincronizarPlanilha colabParaApp',
`            const colabParaApp = colab.map(c=>({
              nome:(c.nome||c.NOME||"").trim(), funcao:c.funcao||'', setor:c.setor||'',
              cpf:c.cpf||'', nascimento:c.nascimento||'', admissao:c.admissao||'',
              experiencia30:c.experiencia30||'', experiencia90:c.experiencia90||'',
              salario:Number(c.salario)||0, inss:Number(c.inss)||0,
              fgts:Number(c.fgts)||0, transporte:Number(c.transporte)||0, cafeManha:Number(c.cafeManha)||0
            }));`,
`            const colabParaApp = colab.map(c=>({
              nome:(c.nome||c.NOME||"").trim(), funcao:c.funcao||'', setor:c.setor||'',
              cpf:c.cpf||'', nascimento:c.nascimento||'', admissao:c.admissao||'',
              telefone:c.telefone||'', chavePix:c.chavePix||'', email:c.email||'',
              experiencia30:c.experiencia30||'', experiencia90:c.experiencia90||'',
              salario:Number(c.salario)||0, inss:Number(c.inss)||0,
              fgts:Number(c.fgts)||0, transporte:Number(c.transporte)||0,
              contaSalario:!!c.contaSalario, aditivoContrato:!!c.aditivoContrato,
              usoArmario:!!c.usoArmario, lgpd:!!c.lgpd, imagem:!!c.imagem,
              camera:!!c.camera, epiUniforme:!!c.epiUniforme,
              acompanhamentoProducao:!!c.acompanhamentoProducao,
              usoCelular:!!c.usoCelular, usoVeiculo:!!c.usoVeiculo,
              termoConfidencialidade:!!c.termoConfidencialidade,
              termoAssiduidade:!!c.termoAssiduidade,
              termoMudancaHorario:!!c.termoMudancaHorario
            }));`
);

// ════════════════════════════════════════════════════════════════
// 6. abrirEdicao — adicionar novos campos, remover cafeManha
// ════════════════════════════════════════════════════════════════
rep('abrirEdicao',
`        const abrirEdicao = c => {
          setForm({
            nome:c.nome||'', funcao:c.funcao||'', setor:c.setor||'', cpf:c.cpf||'',
            nascimento:c.nascimento||'', admissao:c.admissao||'',
            experiencia30:c.experiencia_30||'', experiencia90:c.experiencia_90||'',
            salario:String(c.salario||''), inss:String(c.inss||''), fgts:String(c.fgts||''),
            transporte:String(c.transporte||''), cafeManha:String(c.cafe_manha||'')
          });
          setEditando(c); setStatus(null);
        };`,
`        const abrirEdicao = c => {
          setForm({
            nome:c.nome||'', funcao:c.funcao||'', setor:c.setor||'', cpf:c.cpf||'',
            telefone:c.telefone||'', chavePix:c.chave_pix||'', email:c.email||'',
            nascimento:c.nascimento||'', admissao:c.admissao||'',
            experiencia30:c.experiencia_30||'', experiencia90:c.experiencia_90||'',
            salario:String(c.salario||''), inss:String(c.inss||''), fgts:String(c.fgts||''),
            transporte:String(c.transporte||''),
            contaSalario:!!c.conta_salario, aditivoContrato:!!c.aditivo_contrato,
            usoArmario:!!c.uso_armario, lgpd:!!c.lgpd, imagem:!!c.imagem,
            camera:!!c.camera, epiUniforme:!!c.epi_uniforme,
            acompanhamentoProducao:!!c.acompanhamento_producao,
            usoCelular:!!c.uso_celular, usoVeiculo:!!c.uso_veiculo,
            termoConfidencialidade:!!c.termo_confidencialidade,
            termoAssiduidade:!!c.termo_assiduidade,
            termoMudancaHorario:!!c.termo_mudanca_horario
          });
          setEditando(c); setStatus(null);
        };`
);

// ════════════════════════════════════════════════════════════════
// 7. salvar() payload — adicionar novos campos, remover cafeManha
// ════════════════════════════════════════════════════════════════
rep('salvar payload',
`            const payload = {
              empresa_id:empresaId,
              nome:form.nome.trim(),
              nome_key:normNome(form.nome.trim()),
              funcao:form.funcao.trim()||null, setor:form.setor.trim()||null,
              cpf:form.cpf.trim()||null,
              nascimento: form.nascimento||null,
              admissao: form.admissao||null,
              experiencia_30: form.experiencia30||null,
              experiencia_90: form.experiencia90||null,
              salario:parseFloat(String(form.salario).replace(",","."))||0,
              inss:parseFloat(String(form.inss).replace(",","."))||0,
              fgts:parseFloat(String(form.fgts).replace(",","."))||0,
              transporte:parseFloat(String(form.transporte).replace(",","."))||0,
              cafe_manha:parseFloat(String(form.cafeManha).replace(",","."))||0,
              ativo:true, atualizado_em:new Date().toISOString()
            };`,
`            const payload = {
              empresa_id:empresaId,
              nome:form.nome.trim(),
              nome_key:normNome(form.nome.trim()),
              funcao:form.funcao.trim()||null, setor:form.setor.trim()||null,
              cpf:form.cpf.trim()||null,
              telefone:form.telefone?.trim()||null, chave_pix:form.chavePix?.trim()||null,
              email:form.email?.trim()||null,
              nascimento:form.nascimento||null, admissao:form.admissao||null,
              experiencia_30:form.experiencia30||null, experiencia_90:form.experiencia90||null,
              salario:parseFloat(String(form.salario).replace(",","."))||0,
              inss:parseFloat(String(form.inss).replace(",","."))||0,
              fgts:parseFloat(String(form.fgts).replace(",","."))||0,
              transporte:parseFloat(String(form.transporte).replace(",","."))||0,
              conta_salario:!!form.contaSalario, aditivo_contrato:!!form.aditivoContrato,
              uso_armario:!!form.usoArmario, lgpd:!!form.lgpd, imagem:!!form.imagem,
              camera:!!form.camera, epi_uniforme:!!form.epiUniforme,
              acompanhamento_producao:!!form.acompanhamentoProducao,
              uso_celular:!!form.usoCelular, uso_veiculo:!!form.usoVeiculo,
              termo_confidencialidade:!!form.termoConfidencialidade,
              termo_assiduidade:!!form.termoAssiduidade,
              termo_mudanca_horario:!!form.termoMudancaHorario,
              ativo:true, atualizado_em:new Date().toISOString()
            };`
);

// ════════════════════════════════════════════════════════════════
// 8. Substituir formulário JSX (F → CampoForm, novos campos, Termos)
// ════════════════════════════════════════════════════════════════
const OLD_FORM = `        const F = ({label,campo,type="text",placeholder=""}) => (
          <div style={{marginBottom:14}}>
            <label style={s.label}>{label}</label>
            <input type={type} style={s.input} placeholder={placeholder}
              value={form[campo]||''}
              onChange={e=>setForm(p=>({...p,[campo]:e.target.value}))}
            />
          </div>
        );

        const filtrados = lista.filter(c=>!busca||(c.nome||'').toLowerCase().includes(busca.toLowerCase())||(c.funcao||'').toLowerCase().includes(busca.toLowerCase()));

        if(editando) return (
          <div>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
              <button onClick={()=>setEditando(null)} style={s.btnOutline}>← Voltar</button>
              <div style={{fontSize:18,fontWeight:800,color:C.pri}}>{editando.novo?"➕ Novo Colaborador":"✏️ Editar: "+editando.nome}</div>
            </div>
            {status&&<div style={{padding:"10px 14px",borderRadius:6,marginBottom:14,background:status.ok?"#DCFCE7":"#FEE2E2",color:status.ok?"#166534":"#991B1B",fontSize:13}}>{status.msg}</div>}
            <div style={s.card}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 20px"}}>
                <F label="Nome *" campo="nome" placeholder="Nome completo"/>
                <F label="CPF" campo="cpf" placeholder="000.000.000-00"/>
                <F label="Função" campo="funcao" placeholder="Ex: Auxiliar de Cozinha"/>
                <F label="Setor" campo="setor" placeholder="Ex: Produção"/>
                <F label="Data de Nascimento" campo="nascimento" type="date"/>
                <F label="Data de Admissão" campo="admissao" type="date"/>
                <F label="Fim Experiência 30d" campo="experiencia30" type="date"/>
                <F label="Fim Experiência 90d" campo="experiencia90" type="date"/>
                <F label="Salário (R$)" campo="salario" placeholder="0,00"/>
                <F label="INSS (R$)" campo="inss" placeholder="0,00"/>
                <F label="FGTS (R$)" campo="fgts" placeholder="0,00"/>
                <F label="Vale Transporte (R$)" campo="transporte" placeholder="0,00"/>
                <F label="Café da Manhã (R$)" campo="cafeManha" placeholder="0,00"/>
              </div>
              <div style={{display:"flex",gap:10,marginTop:8}}>
                <button onClick={salvar} style={s.btn} disabled={loading}>{loading?"Salvando...":"💾 Salvar"}</button>
                <button onClick={()=>setEditando(null)} style={s.btnOutline}>Cancelar</button>
              </div>
            </div>
          </div>
        );`;

const NEW_FORM = `        const TERMOS = [
          {campo:"contaSalario",          label:"Conta Salário Aberta"},
          {campo:"aditivoContrato",        label:"Aditivo do Contrato"},
          {campo:"usoArmario",             label:"Uso do Armário"},
          {campo:"lgpd",                   label:"LGPD"},
          {campo:"imagem",                 label:"Autorização de Imagem"},
          {campo:"camera",                 label:"Câmera"},
          {campo:"epiUniforme",            label:"EPI / Uniforme"},
          {campo:"acompanhamentoProducao", label:"Acompanhamento de Produção"},
          {campo:"usoCelular",             label:"Uso do Celular"},
          {campo:"usoVeiculo",             label:"Uso de Veículo"},
          {campo:"termoConfidencialidade", label:"Termo de Confidencialidade"},
          {campo:"termoAssiduidade",       label:"Termo de Adesão à Assiduidade"},
          {campo:"termoMudancaHorario",    label:"Termo de Mudança de Horário"},
        ];

        const filtrados = lista.filter(c=>!busca||(c.nome||'').toLowerCase().includes(busca.toLowerCase())||(c.funcao||'').toLowerCase().includes(busca.toLowerCase()));

        if(editando) return (
          <div>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
              <button onClick={()=>setEditando(null)} style={s.btnOutline}>← Voltar</button>
              <div style={{fontSize:18,fontWeight:800,color:C.pri}}>{editando.novo?"➕ Novo Colaborador":"✏️ Editar: "+editando.nome}</div>
            </div>
            {status&&<div style={{padding:"10px 14px",borderRadius:6,marginBottom:14,background:status.ok?"#DCFCE7":"#FEE2E2",color:status.ok?"#166534":"#991B1B",fontSize:13}}>{status.msg}</div>}

            <div style={s.card}>
              <div style={{fontWeight:700,color:C.pri,marginBottom:14,fontSize:13,textTransform:"uppercase",letterSpacing:"0.05em"}}>Dados Pessoais</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 20px"}}>
                <CampoForm label="Nome *" campo="nome" placeholder="Nome completo" form={form} setForm={setForm}/>
                <CampoForm label="CPF" campo="cpf" placeholder="000.000.000-00" form={form} setForm={setForm}/>
                <CampoForm label="Telefone" campo="telefone" placeholder="(00) 00000-0000" form={form} setForm={setForm}/>
                <CampoForm label="E-mail" campo="email" type="email" placeholder="email@exemplo.com" form={form} setForm={setForm}/>
                <CampoForm label="Chave PIX" campo="chavePix" placeholder="CPF, e-mail ou telefone" form={form} setForm={setForm}/>
                <CampoForm label="Data de Nascimento" campo="nascimento" type="date" form={form} setForm={setForm}/>
              </div>
            </div>

            <div style={s.card}>
              <div style={{fontWeight:700,color:C.pri,marginBottom:14,fontSize:13,textTransform:"uppercase",letterSpacing:"0.05em"}}>Cargo e Período</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 20px"}}>
                <CampoForm label="Função" campo="funcao" placeholder="Ex: Auxiliar de Cozinha" form={form} setForm={setForm}/>
                <CampoForm label="Setor" campo="setor" placeholder="Ex: Produção" form={form} setForm={setForm}/>
                <CampoForm label="Data de Admissão" campo="admissao" type="date" form={form} setForm={setForm}/>
                <div/>
                <CampoForm label="Fim Experiência 30d" campo="experiencia30" type="date" form={form} setForm={setForm}/>
                <CampoForm label="Fim Experiência 90d" campo="experiencia90" type="date" form={form} setForm={setForm}/>
              </div>
            </div>

            <div style={s.card}>
              <div style={{fontWeight:700,color:C.pri,marginBottom:14,fontSize:13,textTransform:"uppercase",letterSpacing:"0.05em"}}>Financeiro</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 20px"}}>
                <CampoForm label="Salário (R$)" campo="salario" placeholder="0,00" form={form} setForm={setForm}/>
                <CampoForm label="INSS (R$)" campo="inss" placeholder="0,00" form={form} setForm={setForm}/>
                <CampoForm label="FGTS (R$)" campo="fgts" placeholder="0,00" form={form} setForm={setForm}/>
                <CampoForm label="Vale Transporte (R$)" campo="transporte" placeholder="0,00" form={form} setForm={setForm}/>
              </div>
            </div>

            <div style={s.card}>
              <div style={{fontWeight:700,color:C.pri,marginBottom:16,fontSize:13,textTransform:"uppercase",letterSpacing:"0.05em"}}>📝 Assinatura de Termos</div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {TERMOS.map(({campo,label})=>(
                  <div key={campo} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 12px",borderRadius:7,background:form[campo]?"#F0FDF4":"#F9FAFB",border:"1px solid "+(form[campo]?C.green:C.border)}}>
                    <span style={{fontSize:13,color:"#374151",fontWeight:500}}>{label}</span>
                    <button type="button" onClick={()=>setForm(p=>({...p,[campo]:!p[campo]}))}
                      style={{padding:"3px 16px",borderRadius:20,fontSize:12,fontWeight:700,cursor:"pointer",border:"none",minWidth:52,
                        background:form[campo]?C.green:"#E5E7EB",color:form[campo]?"#fff":"#6B7280"}}>
                      {form[campo]?"✓ SIM":"NÃO"}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div style={{display:"flex",gap:10,marginTop:4,marginBottom:24}}>
              <button onClick={salvar} style={s.btn} disabled={loading}>{loading?"Salvando...":"💾 Salvar"}</button>
              <button onClick={()=>setEditando(null)} style={s.btnOutline}>Cancelar</button>
            </div>
          </div>
        );`;

rep('form JSX (F→CampoForm, novos campos, Termos)', OLD_FORM, NEW_FORM);

// ════════════════════════════════════════════════════════════════
// 9. App._carregarColab — remover cafeManha
// ════════════════════════════════════════════════════════════════
rep('App _carregarColab mapear',
`            setColabAPI(data.map(c=>({
              nome:c.nome, admissao:c.admissao||'', experiencia30:c.experiencia_30||'',
              experiencia90:c.experiencia_90||'', setor:c.setor||'', funcao:c.funcao||'',
              cpf:c.cpf||'', nascimento:c.nascimento||'',
              salario:Number(c.salario)||0, inss:Number(c.inss)||0, fgts:Number(c.fgts)||0,
              transporte:Number(c.transporte)||0, cafeManha:Number(c.cafe_manha)||0, id_supa:c.id
            })));`,
`            setColabAPI(data.map(c=>({
              nome:c.nome, setor:c.setor||'', funcao:c.funcao||'', cpf:c.cpf||'',
              telefone:c.telefone||'', chavePix:c.chave_pix||'', email:c.email||'',
              nascimento:c.nascimento||'', admissao:c.admissao||'',
              experiencia30:c.experiencia_30||'', experiencia90:c.experiencia_90||'',
              salario:Number(c.salario)||0, inss:Number(c.inss)||0, fgts:Number(c.fgts)||0,
              transporte:Number(c.transporte)||0,
              contaSalario:!!c.conta_salario, aditivoContrato:!!c.aditivo_contrato,
              usoArmario:!!c.uso_armario, lgpd:!!c.lgpd, imagem:!!c.imagem,
              camera:!!c.camera, epiUniforme:!!c.epi_uniforme,
              acompanhamentoProducao:!!c.acompanhamento_producao,
              usoCelular:!!c.uso_celular, usoVeiculo:!!c.uso_veiculo,
              termoConfidencialidade:!!c.termo_confidencialidade,
              termoAssiduidade:!!c.termo_assiduidade,
              termoMudancaHorario:!!c.termo_mudanca_horario, id_supa:c.id
            })));`
);

// ════════════════════════════════════════════════════════════════
// WRITE
// ════════════════════════════════════════════════════════════════
fs.writeFileSync(fp, c, 'utf-8');
console.log('\nFile written. Length:', c.length);
