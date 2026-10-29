// Build de produção (rodado pela Vercel): pré-compila o <script type="text/babel"> do
// index.html com as MESMAS opções que o Babel do navegador usa e gera dist/ sem o
// babel-standalone (~390 KB gzip a menos e sem transpilar ~800 KB a cada abertura).
// O index.html da raiz continua sendo a fonte e abrindo direto no navegador (dev).
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const Babel = require('@babel/standalone');

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(raiz, 'dist');

const BABEL_CDN = /\s*<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/babel-standalone\/[^"]+"><\/script>/;
const BABEL_TAG = '<script type="text/babel">';

export function separarScriptBabel(html) {
  const ini = html.indexOf(BABEL_TAG);
  if (ini === -1 || html.indexOf(BABEL_TAG, ini + 1) !== -1) {
    throw new Error('Esperava exatamente um <script type="text/babel"> no index.html');
  }
  const corpoIni = ini + BABEL_TAG.length;
  const fim = html.indexOf('</script>', corpoIni);
  if (fim === -1) throw new Error('<script type="text/babel"> sem </script>');
  return { antes: html.slice(0, ini), codigo: html.slice(corpoIni, fim), depois: html.slice(fim + '</script>'.length) };
}

// Mesmas opções de buildBabelOptions() do @babel/standalone para <script type="text/babel">
// sem data-presets/data-plugins (ver node_modules/@babel/standalone/babel.js).
export function compilar(codigo) {
  return Babel.transform(codigo, {
    filename: 'Inline Babel script',
    presets: ['react', 'env'],
    plugins: ['transform-class-properties', 'transform-object-rest-spread', 'transform-flow-strip-types'],
  }).code;
}

export function montarHtml(html, nomeJs) {
  if (!BABEL_CDN.test(html)) throw new Error('Tag do babel-standalone não encontrada no index.html');
  const { antes, depois } = separarScriptBabel(html);
  // defer: roda depois do parse, antes do DOMContentLoaded — mesmo ponto em que o Babel
  // do navegador executava o código (depois de todos os scripts síncronos).
  return (antes + `<script defer src="/${nomeJs}"></script>` + depois).replace(BABEL_CDN, '');
}

function main() {
  const html = readFileSync(join(raiz, 'index.html'), 'utf8');
  const js = compilar(separarScriptBabel(html).codigo);
  const nomeJs = `app.${createHash('sha256').update(js).digest('hex').slice(0, 12)}.js`;

  rmSync(dist, { recursive: true, force: true });
  mkdirSync(dist, { recursive: true });
  writeFileSync(join(dist, nomeJs), js);
  writeFileSync(join(dist, 'index.html'), montarHtml(html, nomeJs));
  for (const f of ['favicon.ico', 'favicon-32.png', 'apple-touch-icon.png']) {
    copyFileSync(join(raiz, f), join(dist, f));
  }
  console.log(`dist/ pronto: ${nomeJs} (${Math.round(js.length / 1024)} KB)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
