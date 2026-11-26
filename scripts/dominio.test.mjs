// Testes do leiaute "Importação Arquivo Texto | De Lançamentos" da Domínio Sistemas
// (Folha, solução 8813), rodando sobre o código real do index.html (ver scripts/dominio.mjs).
//
//   REGISTRO 10 (48 chars): "10" + empregado(10) + AAAAMM(6) + rubrica(9) + processo(2)
//                           + valor(9, 2 decimais implícitas) + empresa(10)
//   REGISTRO 11 (11 chars): "11" + AAAAMMDD(8) + tipo(1: 1=normal, 2=DSR)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarDominio } from './dominio.mjs';

const D = carregarDominio();

const CFG = {
  codigoEmpresa: '7',
  tipoProcesso: '11',
  rubricas: { horas_extras: '1', faltas_dias: '320', adiantamento: '9999' },
};

// ANA: 10h30 de extra, 2 faltas, R$ 150,50 de adiantamento e um Caju sem rubrica mapeada.
// BRUNO: tem lançamento mas está sem Cód. Domínio. CARLA: só valores zerados/negativos.
const LANCAMENTOS = [
  {
    nome: 'ANA PAULA',
    codigoDominio: '123',
    valores: { horas_extras: 10.5, faltas_dias: 2, adiantamento: 150.5, caju100: 80 },
    diasFaltas: [{ data: '2026-11-03', tipo: 1 }, { data: '2026-11-08', tipo: 2 }],
  },
  { nome: 'BRUNO LIMA', codigoDominio: '', valores: { horas_extras: 3 } },
  { nome: 'CARLA DIAS', codigoDominio: '0000000456', valores: { horas_extras: 0, faltas_dias: -1, adiantamento: 0 } },
];

const gerar = (over = {}) => D.gerarArquivoDominio({
  lancamentos: LANCAMENTOS, competencia: '11/2026', ...over,
  cfg: { ...CFG, ...(over.cfg || {}) },
});

test('registro 10 tem exatamente 48 caracteres', () => {
  const r = gerar();
  const reg10 = r.linhas.filter(l => l.startsWith('10'));
  assert.equal(reg10.length, 3); // horas extras, faltas e adiantamento da ANA
  for (const l of reg10) assert.equal(l.length, 48, `linha com ${l.length} chars: ${l}`);
});

test('campos com zeros à esquerda: empregado 10, rubrica 9, valor 9 e empresa 10', () => {
  const r = gerar();
  const he = r.linhas[0];
  assert.equal(he.slice(0, 2), '10');            // 001-002 fixo
  assert.equal(he.slice(2, 12), '0000000123');   // 003-012 empregado (10)
  assert.equal(he.slice(12, 18), '202611');      // 013-018 competência AAAAMM
  assert.equal(he.slice(18, 27), '000000001');   // 019-027 rubrica (9)
  assert.equal(he.slice(27, 29), '11');          // 028-029 tipo do processo
  assert.equal(he.slice(29, 38), '000001050');   // 030-038 10,50 h (2 decimais implícitas)
  assert.equal(he.slice(38, 48), '0000000007');  // 039-048 empresa (10)
  assert.equal(he, '10' + '0000000123' + '202611' + '000000001' + '11' + '000001050' + '0000000007');
  // R$ 150,50 -> 000015050 (sem ponto nem vírgula)
  const adiant = r.linhas.find(l => l.startsWith('10') && l.slice(18, 27) === '000009999');
  assert.equal(adiant.slice(29, 38), '000015050');
  assert.match(r.texto.replace(/\r\n/g, ''), /^[0-9]+$/); // só dígitos no arquivo todo
});

test('quebra de linha é CRLF e o arquivo termina com CRLF', () => {
  const r = gerar();
  assert.ok(r.texto.endsWith('\r\n'));
  assert.equal(r.texto.split('\r\n').filter(Boolean).length, r.linhas.length);
  assert.equal(r.texto.replace(/\r\n/g, '').indexOf('\n'), -1); // nenhum LF solto
  assert.equal(r.texto.replace(/\r\n/g, '').indexOf('\r'), -1); // nenhum CR solto
});

test('valor zerado ou negativo não vira lançamento', () => {
  const r = gerar();
  assert.deepEqual(r.colaboradores, ['ANA PAULA']); // CARLA só tem 0 e -1
  assert.ok(!r.pendencias.colabSemCodigo.includes('CARLA DIAS')); // nem entra como pendência
  const semValor = D.gerarArquivoDominio({
    competencia: '11/2026', cfg: CFG,
    lancamentos: [{ nome: 'X', codigoDominio: '1', valores: { horas_extras: 0, adiantamento: -5 } }],
  });
  assert.equal(semValor.registros10, 0);
  assert.equal(semValor.texto, '');
});

test('registro 11 sai logo depois do registro 10 de faltas, com 11 chars e AAAAMMDD + tipo', () => {
  const r = gerar();
  const iFaltas = r.linhas.findIndex(l => l.startsWith('10') && l.slice(18, 27) === '000000320');
  assert.ok(iFaltas >= 0);
  const falta = r.linhas[iFaltas + 1];
  const dsr = r.linhas[iFaltas + 2];
  assert.equal(falta, '11' + '20261103' + '1'); // falta normal
  assert.equal(dsr,   '11' + '20261108' + '2'); // DSR
  assert.equal(falta.length, 11);
  assert.equal(dsr.length, 11);
  assert.equal(r.registros11, 2);
  // o lançamento seguinte volta a ser registro 10
  assert.equal(r.linhas[iFaltas + 3].slice(0, 2), '10');
});

test('registro 11 só sai quando a opção está ligada', () => {
  const r = gerar({ cfg: { incluirDiasFalta: false } });
  assert.equal(r.registros11, 0);
  assert.ok(r.linhas.every(l => l.startsWith('10')));
});

test('sem rubrica de faltas mapeada não há registro 11', () => {
  const r = gerar({ cfg: { rubricas: { horas_extras: '1' } } });
  assert.equal(r.registros11, 0);
  assert.equal(r.registros10, 1);
});

test('pendências: empresa sem código, colaborador sem código e rubrica sem código', () => {
  const r = gerar();
  assert.equal(r.pendencias.semCodigoEmpresa, false);
  assert.equal(r.pendencias.semRubricas, false);
  assert.deepEqual(r.pendencias.colabSemCodigo, ['BRUNO LIMA']);
  assert.deepEqual(r.pendencias.rubricasSemCodigo, ['caju100']);

  const semEmpresa = gerar({ cfg: { codigoEmpresa: '' } });
  assert.equal(semEmpresa.pendencias.semCodigoEmpresa, true);
  assert.equal(semEmpresa.linhas[0].slice(38, 48), '0000000000'); // ainda gera, zerado

  const semRubricas = gerar({ cfg: { rubricas: {} } });
  assert.equal(semRubricas.pendencias.semRubricas, true);
  assert.equal(semRubricas.registros10, 0);
  assert.equal(semRubricas.pendencias.rubricasSemCodigo.length, 4); // HE, faltas, adiant., caju100
});

test('código de rubrica inválido conta como não mapeado', () => {
  const r = gerar({ cfg: { rubricas: { horas_extras: 'abc', faltas_dias: '1234567890', adiantamento: ' 12 ' } } });
  assert.equal(r.rubricasMapeadas.join(), 'adiantamento'); // 10 dígitos e letras não passam
  assert.ok(r.pendencias.rubricasSemCodigo.includes('horas_extras'));
  assert.ok(r.pendencias.rubricasSemCodigo.includes('faltas_dias'));
});

test('resumo por rubrica e contagens', () => {
  const r = gerar();
  assert.equal(r.registros10, 3);
  assert.equal(r.competencia, '202611');
  assert.equal(r.tipoProcesso, '11');
  const he = r.porRubrica.find(x => x.chave === 'horas_extras');
  assert.deepEqual({ qtd: he.qtd, total: he.total, codigo: he.codigo, origem: he.origem },
    { qtd: 1, total: 10.5, codigo: '1', origem: 'horas' });
});

test('tipo do processo é respeitado e cai no padrão 11', () => {
  assert.equal(gerar({ cfg: { tipoProcesso: '42' } }).linhas[0].slice(27, 29), '42');
  assert.equal(gerar({ cfg: { tipoProcesso: '' } }).linhas[0].slice(27, 29), '11');
});

test('dominioZeros: só dígitos, zeros à esquerda e tamanho fixo', () => {
  assert.equal(D.dominioZeros('123', 10), '0000000123');
  assert.equal(D.dominioZeros(null, 9), '000000000');
  assert.equal(D.dominioZeros('12-34', 6), '001234');
  assert.equal(D.dominioZeros('12345678901234', 10).length, 10); // nunca estoura o campo
});

test('dominioCompetencia aceita MM/AAAA, AAAA-MM e AAAAMM', () => {
  assert.equal(D.dominioCompetencia('11/2026'), '202611');
  assert.equal(D.dominioCompetencia('1/2026'), '202601');
  assert.equal(D.dominioCompetencia('2026-07'), '202607');
  assert.equal(D.dominioCompetencia('202611'), '202611');
  assert.equal(D.dominioCompetencia(''), '000000');
});

test('dominioCentavos ignora zero, negativo e não-número', () => {
  assert.equal(D.dominioCentavos(150.5), 15050);
  assert.equal(D.dominioCentavos(0.005), 1); // arredonda para o centavo
  assert.equal(D.dominioCentavos(0), 0);
  assert.equal(D.dominioCentavos(-3), 0);
  assert.equal(D.dominioCentavos('abc'), 0);
  assert.equal(D.dominioCentavos(undefined), 0);
});

test('dominioRegistro11 normaliza a data e o tipo', () => {
  assert.equal(D.dominioRegistro11('2026-11-03', 1), '11202611031');
  assert.equal(D.dominioRegistro11('20261103', '2'), '11202611032');
  assert.equal(D.dominioRegistro11('2026-11-03', 9), '11202611031'); // tipo inválido = normal
});

test('nome do arquivo segue dominio_lancamentos_<empresa>_<AAAAMM>.txt', () => {
  assert.equal(D.dominioNomeArquivo('cantina', '11/2026'), 'dominio_lancamentos_cantina_202611.txt');
});

test('catálogo de rubricas e tipos de processo estão coerentes', () => {
  assert.deepEqual(D.DOMINIO_TIPOS_PROCESSO.map(t => t.v), ['11', '41', '42', '51', '52']);
  assert.ok(D.DOMINIO_RUBRICAS.some(r => r.chave === D.DOMINIO_RUBRICA_FALTAS));
  const chaves = D.DOMINIO_RUBRICAS.map(r => r.chave);
  assert.equal(new Set(chaves).size, chaves.length, 'chave de rubrica duplicada');
  for (const r of D.DOMINIO_RUBRICAS) {
    assert.ok(['valor', 'horas', 'dias'].includes(r.origem), `origem inválida em ${r.chave}`);
    assert.ok(r.label && r.desc, `rubrica ${r.chave} sem label/descrição`);
  }
});
