const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

function rep(label, old, novo) {
  if (!html.includes(old)) { console.error('✗ NOT FOUND: ' + label); return; }
  html = html.replace(old, novo);
  console.log('✓ ' + label);
}

// 1. Add new tab
rep('add impostos tab',
`        const tabs = [
          {k:"vt", l:"🚌 Vale Transporte"},
          {k:"folha", l:"💼 Folha de Pagamento"},
        ];`,
`        const tabs = [
          {k:"vt", l:"🚌 Vale Transporte"},
          {k:"folha", l:"💼 Folha de Pagamento"},
          {k:"impostos", l:"🧮 Regras de Cálculo"},
        ];`
);

// 2. Add SecaoImpostos before SecaoFolha
rep('add SecaoImpostos',
`        const SecaoFolha = () => (`,
`        const SecaoImpostos = () => (
          <div>
            <div style={{fontSize:15,fontWeight:800,color:C.pri,marginBottom:16}}>🧮 Regras e Cálculo de Impostos</div>

            <div style={{...s.card,marginBottom:14}}>
              <div style={s.cardTitle}>📐 INSS — Tabela Progressiva 2025</div>
              <p style={{fontSize:13,lineHeight:1.7,marginBottom:12}}>O INSS é calculado de forma <strong>progressiva</strong> sobre o salário bruto. Cada faixa incide apenas sobre a parcela do salário que se enquadra nela.</p>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,marginBottom:12}}>
                <thead>
                  <tr style={{background:C.pri,color:"#fff"}}>
                    <th style={{padding:"8px 12px",textAlign:"left",fontWeight:600}}>Faixa salarial</th>
                    <th style={{padding:"8px 12px",textAlign:"center",fontWeight:600}}>Alíquota</th>
                    <th style={{padding:"8px 12px",textAlign:"right",fontWeight:600}}>Máx. desta faixa</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {faixa:"Até R$ 1.518,00",aliq:"7,5%",max:"R$ 113,85"},
                    {faixa:"De R$ 1.518,01 a R$ 2.793,00",aliq:"9%",max:"R$ 114,75"},
                    {faixa:"De R$ 2.793,01 a R$ 4.189,50",aliq:"12%",max:"R$ 167,58"},
                    {faixa:"De R$ 4.189,51 a R$ 8.157,41",aliq:"14%",max:"R$ 555,51"},
                  ].map((r,i)=>(
                    <tr key={i} style={{borderBottom:"1px solid "+C.border,background:i%2===0?"#F9FAFB":"#fff"}}>
                      <td style={{padding:"8px 12px"}}>{r.faixa}</td>
                      <td style={{padding:"8px 12px",textAlign:"center",fontWeight:700,color:C.pri}}>{r.aliq}</td>
                      <td style={{padding:"8px 12px",textAlign:"right",color:C.muted}}>{r.max}</td>
                    </tr>
                  ))}
                  <tr style={{background:"#FEF9C3"}}>
                    <td style={{padding:"8px 12px",fontWeight:700}}>Teto (acima de R$ 8.157,41)</td>
                    <td style={{padding:"8px 12px",textAlign:"center",fontWeight:700,color:"#92400E"}}>Máx. R$ 951,69</td>
                    <td style={{padding:"8px 12px",textAlign:"right",color:C.muted}}>—</td>
                  </tr>
                </tbody>
              </table>
              <div style={{...s.infoBox}}>
                Exemplo: Salário R$ 3.000,00 → R$ 1.518,00 × 7,5% = R$ 113,85 + R$ 1.275,00 × 9% = R$ 114,75 + R$ 207,00 × 12% = R$ 24,84 = <strong>INSS total: R$ 253,44</strong>
              </div>
            </div>

            <div style={{...s.card,marginBottom:14}}>
              <div style={s.cardTitle}>📦 FGTS — Fundo de Garantia</div>
              <p style={{fontSize:13,lineHeight:1.7,marginBottom:8}}>Alíquota fixa de <strong>8%</strong> sobre o salário bruto, sem teto e sem progressividade. Depositado pela empresa na conta vinculada do trabalhador — não é descontado do salário.</p>
              <div style={{background:"#F0F9F4",border:"1px solid "+C.green,borderRadius:8,padding:"12px 16px",fontSize:13}}>
                Fórmula: FGTS = Salário Bruto × 8%
              </div>
            </div>

            <div style={{...s.card,marginBottom:14}}>
              <div style={s.cardTitle}>⚠️ Adicional de Periculosidade</div>
              <p style={{fontSize:13,lineHeight:1.7,marginBottom:8}}>Colaboradores expostos a condições perigosas têm direito ao adicional conforme <strong>CLT art. 193</strong>.</p>
              <div style={{background:"#FEF9C3",border:"1px solid #FCD34D",borderRadius:8,padding:"12px 16px",fontSize:13,marginBottom:10}}>
                Fórmula: Adicional de Periculosidade = Salário Base × 30%
              </div>
              <p style={{fontSize:12,color:C.muted,lineHeight:1.6}}>No cadastro do colaborador, ative o botão Periculosidade para que o app calcule e salve o adicional automaticamente.</p>
            </div>

            <div style={{...s.card,marginBottom:0}}>
              <div style={s.cardTitle}>📊 Como o app calcula</div>
              <ul style={{fontSize:13,lineHeight:2.2,paddingLeft:20,marginBottom:0}}>
                <li><strong>INSS e FGTS</strong> são calculados automaticamente a partir do salário cadastrado — nunca importados da planilha.</li>
                <li><strong>Periculosidade</strong> é ativada manualmente por colaborador; o app calcula 30% do salário base.</li>
                <li>Ao salvar ou sincronizar, os valores calculados são gravados no Supabase para rastreabilidade.</li>
              </ul>
            </div>
          </div>
        );

        const SecaoFolha = () => (`
);

// 3. Add render for new section
rep('render SecaoImpostos',
`{secao==="folha"&&<SecaoFolha/>}`,
`{secao==="folha"&&<SecaoFolha/>}
            {secao==="impostos"&&<SecaoImpostos/>}`
);

fs.writeFileSync('index.html', html);
console.log('Saved. Size:', html.length);
