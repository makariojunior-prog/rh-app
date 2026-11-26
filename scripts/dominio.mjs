// Carrega para o Node o bloco DOMINIO do index.html — a exportação no leiaute
// "Importação Arquivo Texto | De Lançamentos" da Domínio Sistemas (Folha, solução 8813).
//
// O rh-app é um único index.html sem bundler, então não há como importar aquele código.
// Em vez de duplicar as funções aqui (duas versões que divergem com o tempo), este módulo
// recorta o bloco delimitado por DOMINIO:INICIO / DOMINIO:FIM e o avalia: os testes rodam
// exatamente sobre o código que vai ao ar. O bloco é puro de propósito — sem React, DOM ou
// Supabase — justamente para poder ser avaliado assim.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const INICIO = '// ===== DOMINIO:INICIO =====';
const FIM = '// ===== DOMINIO:FIM =====';

const NOMES = [
  'DOMINIO_TIPOS_PROCESSO', 'DOMINIO_RUBRICAS', 'DOMINIO_RUBRICA_FALTAS', 'DOMINIO_ORIGEM_LABEL',
  'dominioZeros', 'dominioCompetencia', 'dominioCentavos',
  'dominioRegistro10', 'dominioRegistro11', 'gerarArquivoDominio', 'dominioNomeArquivo',
];

export function extrairBlocoDominio(html) {
  const ini = html.indexOf(INICIO);
  const fim = html.indexOf(FIM);
  if (ini === -1 || fim === -1 || fim < ini) {
    throw new Error('Bloco DOMINIO:INICIO/DOMINIO:FIM não encontrado no index.html');
  }
  return html.slice(ini + INICIO.length, fim);
}

export function lerIndexHtml() {
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'index.html'), 'utf8');
}

export function carregarDominio(html = lerIndexHtml()) {
  const corpo = extrairBlocoDominio(html);
  return new Function(`${corpo}\nreturn { ${NOMES.join(', ')} };`)();
}
