/**
 * Substitutos de teste para ferramentas externas.
 *
 * Nenhum destes arquivos é Blender, ComfyUI ou qualquer ferramenta real: são
 * executáveis de teste que recebem exatamente os mesmos argumentos e gravam os
 * mesmos artefatos que o contrato exige, para que o caminho de código do produto
 * (spawn, args, leitura de saída, validação, cancelamento) seja exercitado de
 * verdade neste ambiente — onde nenhuma ferramenta externa está instalada.
 *
 * Cada smoke que os usa diz explicitamente, no resultado impresso, que são
 * substitutos de teste.
 */

/** Módulo único que exporta createImage + encodePngRgba para os stubs. */
export const codecShimSource = ({ imagingUrl, pngCodecUrl }) => `export { createImage } from ${JSON.stringify(imagingUrl)};
export { encodePngRgba } from ${JSON.stringify(pngCodecUrl)};
`;

export const rendererStub = (codecUrl) => `#!/usr/bin/env node
// SUBSTITUTO DE TESTE — não é o Blender. Gerado por tests/host-integration-smoke.mjs.
import fs from 'node:fs/promises';
import path from 'node:path';
const { encodePngRgba, createImage } = await import(${JSON.stringify(codecUrl)});

const args = process.argv.slice(2);
const value = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
const script = value('--python');
const input = value('--input');
const outputDirectory = value('--output-dir');
const assetName = value('--asset-name');
const assetType = value('--asset-type');
const frameWidth = Number(value('--frame-width'));
const frameHeight = Number(value('--frame-height'));
const animations = JSON.parse(value('--animations-json') || '[]');

const exists = async (candidate) => { try { await fs.access(candidate); return true; } catch { return false; } };
if (!script || !(await exists(script))) { console.error('script Blender não encontrado: ' + script); process.exit(2); }
if (!input || !(await exists(input))) { console.error('modelo de entrada não encontrado: ' + input); process.exit(3); }
if (!outputDirectory || !Number.isInteger(frameWidth) || !Number.isInteger(frameHeight)) { console.error('argumentos incompletos'); process.exit(4); }

const columns = 8;
const rows = Math.max(1, animations.length);
const sheetWidth = columns * frameWidth;
const sheetHeight = rows * frameHeight;
const image = createImage(sheetWidth, sheetHeight);
const frames = [];
for (let row = 0; row < rows; row += 1) {
  for (let column = 0; column < columns; column += 1) {
    const offsetX = column * frameWidth;
    const offsetY = row * frameHeight;
    const inset = Math.max(2, Math.round(frameWidth * 0.18));
    for (let y = offsetY + inset; y < offsetY + frameHeight - inset; y += 1) {
      for (let x = offsetX + inset; x < offsetX + frameWidth - inset; x += 1) {
        image.rgba.set([230 - row * 30, 90 + column * 12, 200, 255], (y * sheetWidth + x) * 4);
      }
    }
    frames.push({
      filename: \`\${assetName}-\${animations[row] ?? 'frame'}-\${String(column).padStart(2, '0')}\`,
      animation: animations[row] ?? 'frame',
      frame: column,
      sourceFrame: assetType === 'item' ? null : column + 1,
      durationMs: 100,
      pivot: { x: Math.round(frameWidth / 2), y: assetType === 'item' ? Math.round(frameHeight / 2) : frameHeight - 1 },
      x: offsetX,
      y: offsetY,
      width: frameWidth,
      height: frameHeight,
    });
    console.log(\`Frame \${frames.length}/\${columns * rows} · \${animations[row] ?? 'frame'} #\${column}\`);
  }
}

await fs.mkdir(outputDirectory, { recursive: true });
await fs.writeFile(path.join(outputDirectory, 'spritesheet.png'), encodePngRgba(image.rgba, image.width, image.height), { flag: 'wx' });
const metadata = {
  schemaVersion: 1,
  generator: 'substituto-de-teste (não é o Blender)',
  asset: assetName,
  assetType,
  frameWidth,
  frameHeight,
  sheetWidth,
  sheetHeight,
  columns,
  rows,
  origin: 'top-left',
  anchor: assetType === 'item' ? 'center' : 'feet',
  animations,
  frames,
};
await fs.writeFile(path.join(outputDirectory, 'spritesheet.json'), JSON.stringify(metadata, null, 2), { flag: 'wx' });
console.log('Spritesheet gravada: ' + sheetWidth + 'x' + sheetHeight + ' (' + frames.length + ' frames)');
`;

/**
 * Executável que nunca termina sozinho: serve para provar o cancelamento.
 * Grava o próprio PID para o teste conferir que o processo foi encerrado de
 * verdade, e trata SIGTERM/SIGINT saindo em seguida — como um processo bem
 * comportado faria.
 */
export const slowToolStub = (pidFile) => `#!/usr/bin/env node
// SUBSTITUTO DE TESTE — não é o Blender. Gerado por tests/tool-stubs.mjs.
import fs from 'node:fs/promises';
await fs.writeFile(${JSON.stringify(pidFile)}, String(process.pid), 'utf8');
console.log('renderizando (substituto de teste lento)…');
const stop = (signal) => { console.log('recebi ' + signal + '; encerrando sem gravar artefato'); process.exit(143); };
process.on('SIGTERM', () => stop('SIGTERM'));
process.on('SIGINT', () => stop('SIGINT'));
setInterval(() => console.log('ainda renderizando…'), 250);
`;

/** Executável que falha no meio: serve para provar falha intermediária. */
export const failingToolStub = () => `#!/usr/bin/env node
// SUBSTITUTO DE TESTE — não é o Blender. Gerado por tests/tool-stubs.mjs.
console.log('iniciando render (substituto de teste que falha)');
console.error('falha simulada no meio da execução: dispositivo de render ausente');
process.exit(3);
`;
