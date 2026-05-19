'use strict';

/**
 * generate-icons.js
 * Generates assets/icon.ico (Windows), assets/icon.icns (macOS), assets/icon.png (Linux)
 * from an SVG definition using sharp.
 *
 * Usage: node scripts/generate-icons.js
 */

const fs   = require('fs');
const path = require('path');
const sharp = require('sharp');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');

// ─── NameForge SVG icon ───────────────────────────────────────────────────────
// Design: geometric "N" lettermark (3 equal-weight strokes) on dark background.
// Accent square (top-left) mirrors the UI header detail.
// Primary: #76b900 (NVIDIA-inspired green from design system)

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <!-- Background — near-black, soft rounded corners -->
  <rect width="512" height="512" rx="76" fill="#0d0d0d"/>

  <!-- Left vertical bar of N -->
  <rect x="96" y="72" width="80" height="368" fill="#76b900"/>

  <!-- Diagonal stroke of N (parallelogram connecting top-inner-left to bottom-inner-right) -->
  <polygon points="176,72 256,72 336,440 256,440" fill="#76b900"/>

  <!-- Right vertical bar of N -->
  <rect x="336" y="72" width="80" height="368" fill="#76b900"/>

  <!-- Small accent square — brand signature, mirrors UI header dot -->
  <rect x="56" y="428" width="28" height="28" fill="#76b900" opacity="0.55"/>
</svg>`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function svgToPng(size) {
  return sharp(Buffer.from(SVG))
    .resize(size, size)
    .png()
    .toBuffer();
}

// ─── ICO assembler ────────────────────────────────────────────────────────────
// PNG-based ICO (Vista+). Supports multiple sizes in one file.
// Format: ICONDIR (6 bytes) + N × ICONDIRENTRY (16 bytes) + N × PNG data

async function buildIco(sizes) {
  const images = await Promise.all(sizes.map(svgToPng));

  const entrySize   = 16;
  const dataOffset  = 6 + sizes.length * entrySize;

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);              // reserved
  header.writeUInt16LE(1, 2);              // type: 1 = ICO
  header.writeUInt16LE(sizes.length, 4);   // image count

  const entries = [];
  const chunks  = [];
  let offset    = dataOffset;

  for (let i = 0; i < sizes.length; i++) {
    const s    = sizes[i];
    const data = images[i];

    const entry = Buffer.alloc(entrySize);
    // Width/height: 0 means 256 in ICO spec
    entry.writeUInt8(s >= 256 ? 0 : s, 0);
    entry.writeUInt8(s >= 256 ? 0 : s, 1);
    entry.writeUInt8(0,  2);               // color count (0 = full color)
    entry.writeUInt8(0,  3);               // reserved
    entry.writeUInt16LE(1,  4);            // color planes
    entry.writeUInt16LE(32, 6);            // bits per pixel
    entry.writeUInt32LE(data.length, 8);   // bytes in resource
    entry.writeUInt32LE(offset, 12);       // offset to data

    entries.push(entry);
    chunks.push(data);
    offset += data.length;
  }

  return Buffer.concat([header, ...entries, ...chunks]);
}

// ─── ICNS assembler ───────────────────────────────────────────────────────────
// PNG-based ICNS (macOS 10.7+).
// Format: magic "icns" + file_length(4 BE) + chunks[type(4) + chunk_len(4 BE) + PNG]

const ICNS_OSTYPE = {
  128:  'ic07',  // 128×128   macOS 10.7+
  256:  'ic08',  // 256×256   macOS 10.5+
  512:  'ic09',  // 512×512   macOS 10.5+
  1024: 'ic10',  // 1024×1024 macOS 10.7+ Retina
};

async function buildIcns(sizes) {
  const images = await Promise.all(sizes.map(svgToPng));

  const chunks = sizes.map((s, i) => {
    const type    = Buffer.from(ICNS_OSTYPE[s], 'ascii');
    const data    = images[i];
    const lenBuf  = Buffer.alloc(4);
    // chunk length includes the 4-byte type + 4-byte length fields
    lenBuf.writeUInt32BE(8 + data.length, 0);
    return Buffer.concat([type, lenBuf, data]);
  });

  const body      = Buffer.concat(chunks);
  const magic     = Buffer.from('icns', 'ascii');
  const fileLen   = Buffer.alloc(4);
  // file length includes the 4-byte magic + 4-byte file_length fields
  fileLen.writeUInt32BE(8 + body.length, 0);

  return Buffer.concat([magic, fileLen, body]);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });

  console.log('NameForge — icon generation\n');

  // PNG 512×512 (Linux AppImage + source reference)
  const png512 = await svgToPng(512);
  fs.writeFileSync(path.join(ASSETS_DIR, 'icon.png'), png512);
  console.log('  ✓ assets/icon.png      (512×512, Linux / reference)');

  // ICO — Windows multi-size (16, 32, 48, 64, 128, 256)
  const icoData = await buildIco([16, 32, 48, 64, 128, 256]);
  fs.writeFileSync(path.join(ASSETS_DIR, 'icon.ico'), icoData);
  console.log('  ✓ assets/icon.ico      (16, 32, 48, 64, 128, 256px — Windows)');

  // ICNS — macOS multi-size (128, 256, 512, 1024)
  const icnsData = await buildIcns([128, 256, 512, 1024]);
  fs.writeFileSync(path.join(ASSETS_DIR, 'icon.icns'), icnsData);
  console.log('  ✓ assets/icon.icns     (128, 256, 512, 1024px — macOS Retina)');

  console.log('\nDone. Run "npm run dist:win" to build the installer.\n');
}

main().catch((err) => {
  console.error('\nIcon generation failed:', err.message);
  process.exit(1);
});
