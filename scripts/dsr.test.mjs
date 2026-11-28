import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'index.html'), 'utf8');

function carregarDSR() {
  const INICIO = '// ===== DSR:INICIO =====';
  const FIM = '// ===== DSR:FIM =====';
  const ini = html.indexOf(INICIO);
  const fim = html.indexOf(FIM);
  assert.ok(ini !== -1 && fim > ini, 'Bloco DSR:INICIO/DSR:FIM não encontrado no index.html');
  const corpo = html.slice(ini + INICIO.length, fim);
  return new Function(`${corpo}\nreturn { calcularDSRPerdidos };`)();
}

function periodo(iniISO, fimISO) {
  const out = [];
  const d = new Date(iniISO + 'T12:00:00');
  const end = new Date(fimISO + 'T12:00:00');
  while (d <= end) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    d.setDate(d.getDate() + 1);
  }
  return out;
}

const { calcularDSRPerdidos } = carregarDSR();

test('caso real Felipe Fernandes de Paula (nov/2026) resulta em 4 DSR (3+1f = R$ 28,80)', () => {
  const datas = periodo('2026-10-26', '2026-11-25');
  const faltas = [
    '2026-11-05', '2026-11-07',
    '2026-11-09', '2026-11-10', '2026-11-12', '2026-11-13', '2026-11-14',
    '2026-11-17',
  ];
  const feriados = ['2026-11-02', '2026-11-15', '2026-11-20'];
  const r = calcularDSRPerdidos(datas, faltas, feriados);

  assert.equal(r.dsrPerdidos, 3);
  assert.equal(r.feriadosPerdidos, 1);
  assert.equal(r.totalDSR, 4);
  assert.equal(Math.round(r.totalDSR * 7.20 * 100) / 100, 28.80);
  assert.deepEqual(r.diasDSRISO.slice().sort(), ['2026-11-08', '2026-11-15', '2026-11-20', '2026-11-22']);
});

test('feriado anterior à falta na mesma semana (Seg->Dom) não conta como DSR adicional', () => {
  const datas = periodo('2026-11-02', '2026-11-08'); // Seg 02/11 (Finados) a Dom 08/11
  const r = calcularDSRPerdidos(datas, ['2026-11-05'], ['2026-11-02']);
  assert.equal(r.dsrPerdidos, 1);
  assert.equal(r.feriadosPerdidos, 0);
  assert.equal(r.totalDSR, 1);
});

test('feriado no domingo não duplica a perda de DSR', () => {
  const datas = periodo('2026-11-09', '2026-11-15'); // Seg 09/11 a Dom 15/11 (Proclamação)
  const r = calcularDSRPerdidos(datas, ['2026-11-10'], ['2026-11-15']);
  assert.equal(r.dsrPerdidos, 1);
  assert.equal(r.feriadosPerdidos, 0);
  assert.equal(r.totalDSR, 1);
  assert.deepEqual(r.diasDSRISO, ['2026-11-15']);
});

test('feriado em dia útil após a falta na mesma semana soma +1 DSR', () => {
  const datas = periodo('2026-11-16', '2026-11-22'); // Seg 16/11 a Dom 22/11; Sex 20/11 feriado
  const r = calcularDSRPerdidos(datas, ['2026-11-17'], ['2026-11-20']);
  assert.equal(r.dsrPerdidos, 1);
  assert.equal(r.feriadosPerdidos, 1);
  assert.equal(r.totalDSR, 2);
  assert.deepEqual(r.diasDSRISO.slice().sort(), ['2026-11-20', '2026-11-22']);
});

test('sem faltas na semana não há perda de DSR', () => {
  const datas = periodo('2026-10-26', '2026-11-25');
  const r = calcularDSRPerdidos(datas, [], ['2026-11-02', '2026-11-15', '2026-11-20']);
  assert.equal(r.totalDSR, 0);
  assert.deepEqual(r.diasDSRISO, []);
});

test('consulta de registros_ponto na FolhaPage usa paginação por range', () => {
  const folhaIdx = html.indexOf('function FolhaPage(');
  assert.ok(folhaIdx !== -1, 'FolhaPage não encontrada');
  const idx = html.indexOf("from('registros_ponto').select('*')", folhaIdx);
  assert.ok(idx !== -1, 'consulta de registros_ponto na FolhaPage não encontrada');
  const trecho = html.slice(idx, idx + 300);
  assert.match(trecho, /\.range\(from,\s*from\+PAGE-1\)/);
});
