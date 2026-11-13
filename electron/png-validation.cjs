/**
 * Validação estrutural de PNG no processo principal (Electron).
 *
 * Este arquivo é uma casca fina: a implementação vive em `shared/qa/png.mjs`,
 * que é a fonte única de verdade compartilhada com o Studio, os adapters e os
 * testes. Manter duas cópias da mesma regra era exatamente o tipo de sistema
 * paralelo que a arquitetura proíbe — por isso a lógica foi movida, não
 * duplicada, e a API pública (`validatePngBuffer`) e as mensagens de erro
 * continuam idênticas para os 4 consumidores existentes:
 *   - electron/blender-adapter.cjs
 *   - electron/main.cjs
 *   - electron/workflow-runner.cjs
 *   - scripts/comfyui-client.mjs
 *
 * `require()` de módulo ES síncrono exige Node >= 22.12, que já é o mínimo
 * declarado pelo launcher (`spriteforge_launcher.py`, MIN_NODE_VERSION).
 */

let validatePngStructure;
try {
  ({ validatePngStructure } = require('../shared/qa/png.mjs'));
} catch (error) {
  // `require()` de ESM existe a partir do Node 22.12 — exatamente o mínimo que
  // este pacote declara em `engines.node` e que o launcher confere. Se falhar,
  // o motivo precisa ser legível em vez de aparecer como "módulo não encontrado".
  throw new Error(
    `electron/png-validation.cjs não conseguiu carregar shared/qa/png.mjs (${error?.code ?? error?.message}). `
    + 'Requer Node >= 22.12 (require de módulo ES); verifique a versão usada pelo Electron.',
  );
}

/**
 * Valida a estrutura de um PNG (assinatura, chunks, CRC, IHDR, IDAT, IEND).
 *
 * @param {Buffer|Uint8Array} buffer bytes do PNG
 * @param {{requireRgba8?: boolean}} [options] `requireRgba8` exige color type 6 e 8 bits
 * @returns {{width: number, height: number, bitDepth: number, colorType: number, hasAlpha: boolean}}
 * @throws {Error} com a mesma mensagem de antes da delegação
 */
function validatePngBuffer(buffer, { requireRgba8 = false } = {}) {
  // O comportamento publicado para entrada que não é binária é uma mensagem de
  // estrutura inválida (não um TypeError), e os testes conferem isso.
  if (!(buffer instanceof Uint8Array)) {
    throw new Error('O output não tem uma estrutura PNG completa.');
  }
  const info = validatePngStructure(buffer, { requireRgba8 });
  return {
    width: info.width,
    height: info.height,
    bitDepth: info.bitDepth,
    colorType: info.colorType,
    hasAlpha: info.hasAlpha,
    interlaced: info.interlaced,
    paletteEntries: info.paletteEntries,
    idatChunks: info.idatChunks,
    bytes: info.bytes,
  };
}

module.exports = { validatePngBuffer };
