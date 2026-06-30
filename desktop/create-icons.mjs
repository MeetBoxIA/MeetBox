/**
 * Generates desktop/build/icon.png from public/favicon.svg using sharp.
 * Run: node create-icons.mjs  (from the desktop/ directory)
 */
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const svgSrc = path.join(__dirname, '..', 'public', 'favicon.svg');
const outDir = path.join(__dirname, 'build');

// Try to use sharp (install if missing)
async function run() {
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    console.log('Installing sharp...');
    execSync('npm install --no-save sharp', { stdio: 'inherit', cwd: __dirname });
    sharp = (await import('sharp')).default;
  }

  const svgContent = fs.readFileSync(svgSrc);

  // 512x512 PNG on white background (standard app icon)
  const png512 = await sharp(svgContent, { density: 300 })
    .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toBuffer();

  fs.writeFileSync(path.join(outDir, 'icon.png'), png512);
  console.log('✓ icon.png (512x512)');

  // 256x256 for ICO (electron-builder accepts PNG named .ico on some versions,
  // but we generate a proper ICO below)
  const png256 = await sharp(svgContent, { density: 300 })
    .resize(256, 256, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toBuffer();

  // Wrap the 256x256 PNG inside a minimal ICO container
  const ico = buildIco(png256, 256, 256);
  fs.writeFileSync(path.join(outDir, 'icon.ico'), ico);
  console.log('✓ icon.ico (256x256)');

  console.log('\nDone! Icons saved to desktop/build/');
}

/**
 * Wraps a PNG buffer in a minimal ICO container.
 * Modern Windows (Vista+) supports PNG-inside-ICO.
 */
function buildIco(pngBuffer, w, h) {
  const HEADER_SIZE = 6;
  const DIR_ENTRY_SIZE = 16;
  const imageOffset = HEADER_SIZE + DIR_ENTRY_SIZE;

  const buf = Buffer.alloc(imageOffset + pngBuffer.length);

  // ICONDIR header
  buf.writeUInt16LE(0, 0);       // reserved
  buf.writeUInt16LE(1, 2);       // type: 1 = ICO
  buf.writeUInt16LE(1, 4);       // count: 1 image

  // ICONDIRENTRY
  buf.writeUInt8(w >= 256 ? 0 : w, 6);   // width  (0 = 256)
  buf.writeUInt8(h >= 256 ? 0 : h, 7);   // height (0 = 256)
  buf.writeUInt8(0, 8);                   // color count
  buf.writeUInt8(0, 9);                   // reserved
  buf.writeUInt16LE(1, 10);               // planes
  buf.writeUInt16LE(32, 12);              // bit count
  buf.writeUInt32LE(pngBuffer.length, 14); // size
  buf.writeUInt32LE(imageOffset, 18);      // offset

  pngBuffer.copy(buf, imageOffset);
  return buf;
}

run().catch((e) => { console.error(e); process.exit(1); });
