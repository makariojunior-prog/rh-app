const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
let ok = 0, fail = 0;

function rep(label, old, novo) {
  if (!html.includes(old)) { console.error('✗ NOT FOUND: ' + label); fail++; return; }
  html = html.replace(old, novo);
  console.log('✓ ' + label); ok++;
}

// ══════════════════════════════════════════════════════════════
// 1. GAS _lerCandidatos: add cnh_tipo and experiencia_tipo fields
// ══════════════════════════════════════════════════════════════
rep('GAS add cnh_tipo and experiencia_tipo',
`      tem_experiencia: _bool(l[7]),                             // H
      descricao_experiencia: String(l[8]||'').trim(),           // I
      possui_cnh:     _bool(l[9]),                              // J`,
`      tem_experiencia: _bool(l[7]),                             // H
      experiencia_tipo: String(l[7]||'').trim(),                // H texto completo
      descricao_experiencia: String(l[8]||'').trim(),           // I
      possui_cnh:     _bool(l[9]),                              // J
      cnh_tipo:       String(l[9]||'').trim(),                  // J texto completo`
);

// ══════════════════════════════════════════════════════════════
// 2. React sync: include cnh_tipo and experiencia_tipo in upsert
// ══════════════════════════════════════════════════════════════
rep('sync add cnh_tipo experiencia_tipo',
`              tem_experiencia: c.tem_experiencia,
              descricao_experiencia: c.descricao_experiencia||null,
              possui_cnh: c.possui_cnh,`,
`              tem_experiencia: c.tem_experiencia,
              experiencia_tipo: c.experiencia_tipo||null,
              descricao_experiencia: c.descricao_experiencia||null,
              possui_cnh: c.possui_cnh,
              cnh_tipo: c.cnh_tipo||null,`
);

// ══════════════════════════════════════════════════════════════
// 3. Display: show experiencia_tipo and cnh_tipo with detail
// ══════════════════════════════════════════════════════════════
rep('display experiencia and cnh with detail',
`                                    React.createElement('div',null,React.createElement('span',{style:{color:C.muted,fontSize:11}},'Experiência na área'),React.createElement('br'),React.createElement('strong',null,c.tem_experiencia?'Sim':'Não')),
                                    React.createElement('div',null,React.createElement('span',{style:{color:C.muted,fontSize:11}},'Possui CNH'),React.createElement('br'),React.createElement('strong',null,c.possui_cnh?'Sim':'Não')),`,
`                                    React.createElement('div',null,React.createElement('span',{style:{color:C.muted,fontSize:11}},'Experiência na área'),React.createElement('br'),React.createElement('strong',null,(function(){var t=c.experiencia_tipo||'';return t.indexOf('diretamente')!==-1?'Sim (direta)':t.indexOf('outras')!==-1?'Sim (indireta)':t.indexOf('disposição')!==-1||t.indexOf('Não')!==-1?'Não':c.tem_experiencia?'Sim':'Não';})())),
                                    React.createElement('div',null,React.createElement('span',{style:{color:C.muted,fontSize:11}},'CNH'),React.createElement('br'),React.createElement('strong',null,(function(){var t=c.cnh_tipo||'';if(!t)return c.possui_cnh?'Sim':'Não';if(t==='Não possuo'||t==='Não possui')return 'Não';return t;})())),`
);

fs.writeFileSync('index.html', html);
console.log('\n' + ok + ' OK | ' + fail + ' falhas | Tamanho: ' + html.length);
