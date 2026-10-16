import { test } from 'node:test';
import assert from 'node:assert/strict';
import { separarScriptBabel, compilar, montarHtml } from './build.mjs';

const CDN = '<script src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.2/babel.min.js"></script>';
const html = (corpo) => `<head>\n  ${CDN}\n  <script>var a=1;</script></head><body><div id="root"></div><script type="text/babel">${corpo}</script></body>`;

test('separa o corpo do script babel', () => {
  const r = separarScriptBabel(html('const x = <b/>;'));
  assert.equal(r.codigo, 'const x = <b/>;');
  assert.ok(r.antes.endsWith('<div id="root"></div>'));
  assert.equal(r.depois, '</body>');
});

test('para no primeiro </script>, como o navegador', () => {
  const r = separarScriptBabel(html('const s = "a";</script><p>x</p>'));
  assert.equal(r.codigo, 'const s = "a";');
});

test('recusa zero ou dois scripts babel', () => {
  assert.throws(() => separarScriptBabel('<script>x</script>'), /exatamente um/);
  assert.throws(() => separarScriptBabel(html('a') + '<script type="text/babel">b</script>'), /exatamente um/);
});

test('compila JSX e spread para ES5', () => {
  const js = compilar('const {a, ...r} = o; const e = <div className="x">{a}</div>;');
  assert.match(js, /React\.createElement\("div"/);
  assert.doesNotMatch(js, /<div/);
  assert.doesNotMatch(js, /\bconst\b/);
});

test('monta o html sem babel-standalone e com o js em defer', () => {
  const out = montarHtml(html('x'), 'app.abc.js');
  assert.ok(!out.includes('babel-standalone'));
  assert.ok(!out.includes('text/babel'));
  assert.ok(out.includes('<script defer src="/app.abc.js"></script></body>'));
  assert.ok(out.includes('<script>var a=1;</script>'));
});

test('falha se a tag do CDN do babel sumir', () => {
  assert.throws(() => montarHtml('<script type="text/babel">x</script>', 'a.js'), /babel-standalone/);
});
