// tools/asset-pipeline/lib/png.mjs
//
// Dependency-free PNG decode/encode for the asset pipeline.
//
// Decodes 8-bit non-interlaced PNGs (grayscale, RGB, grayscale+alpha, RGBA,
// and palette) into a flat RGBA8 buffer, and encodes RGBA8 back to PNG.
// The pipeline runs offline via `npm run assets`, so raw zlib + manual
// unfiltering is fast enough and keeps the project at zero build dependencies.

import fs from 'node:fs';
import zlib from 'node:zlib';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Paeth predictor from the PNG spec (filter type 4). */
function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

const CHANNELS_BY_COLOR_TYPE = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

/**
 * Decodes a PNG file into `{ width, height, data }` where `data` is RGBA8.
 * Throws on interlaced or non-8-bit images — neither appears in this project,
 * and failing loudly beats silently producing garbage tiles.
 */
export function readPng(filePath) {
  const buf = fs.readFileSync(filePath);
  if (!buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error(`${filePath}: not a PNG (bad signature)`);
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let palette = null;
  let paletteAlpha = null;
  const idatChunks = [];

  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + length);

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data.readUInt8(8);
      colorType = data.readUInt8(9);
      if (data.readUInt8(12) !== 0) throw new Error(`${filePath}: interlaced PNGs unsupported`);
    } else if (type === 'PLTE') {
      palette = Buffer.from(data);
    } else if (type === 'tRNS') {
      paletteAlpha = Buffer.from(data);
    } else if (type === 'IDAT') {
      idatChunks.push(Buffer.from(data));
    } else if (type === 'IEND') {
      break;
    }

    offset += length + 12; // length + type + data + CRC
  }

  if (bitDepth !== 8) throw new Error(`${filePath}: bit depth ${bitDepth} unsupported (need 8)`);
  const srcChannels = CHANNELS_BY_COLOR_TYPE[colorType];
  if (!srcChannels) throw new Error(`${filePath}: colour type ${colorType} unsupported`);

  const raw = zlib.inflateSync(Buffer.concat(idatChunks));
  const stride = width * srcChannels;
  const flat = Buffer.alloc(height * stride);

  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filterType = raw[pos++];
    const row = y * stride;
    const prevRow = (y - 1) * stride;
    for (let x = 0; x < stride; x++) {
      const rawByte = raw[pos + x];
      const a = x >= srcChannels ? flat[row + x - srcChannels] : 0;
      const b = y > 0 ? flat[prevRow + x] : 0;
      const c = y > 0 && x >= srcChannels ? flat[prevRow + x - srcChannels] : 0;
      let value;
      switch (filterType) {
        case 0: value = rawByte; break;
        case 1: value = rawByte + a; break;
        case 2: value = rawByte + b; break;
        case 3: value = rawByte + ((a + b) >> 1); break;
        case 4: value = rawByte + paeth(a, b, c); break;
        default: throw new Error(`${filePath}: bad filter type ${filterType} on row ${y}`);
      }
      flat[row + x] = value & 0xff;
    }
    pos += stride;
  }

  // Expand whatever we decoded into straight RGBA8.
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0, n = width * height; i < n; i++) {
    const s = i * srcChannels;
    const d = i * 4;
    switch (colorType) {
      case 0: {
        const g = flat[s];
        rgba[d] = g; rgba[d + 1] = g; rgba[d + 2] = g; rgba[d + 3] = 255;
        break;
      }
      case 2:
        rgba[d] = flat[s]; rgba[d + 1] = flat[s + 1]; rgba[d + 2] = flat[s + 2]; rgba[d + 3] = 255;
        break;
      case 3: {
        const index = flat[s];
        const p = index * 3;
        rgba[d] = palette[p]; rgba[d + 1] = palette[p + 1]; rgba[d + 2] = palette[p + 2];
        rgba[d + 3] = paletteAlpha && index < paletteAlpha.length ? paletteAlpha[index] : 255;
        break;
      }
      case 4: {
        const g = flat[s];
        rgba[d] = g; rgba[d + 1] = g; rgba[d + 2] = g; rgba[d + 3] = flat[s + 1];
        break;
      }
      case 6:
        rgba[d] = flat[s]; rgba[d + 1] = flat[s + 1]; rgba[d + 2] = flat[s + 2]; rgba[d + 3] = flat[s + 3];
        break;
    }
  }

  return { width, height, data: rgba };
}

// ─── Encoding ─────────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

/**
 * Encodes an RGBA8 image to a PNG file.
 *
 * Uses per-row filter selection (none/sub/up/average/paeth chosen by minimum
 * absolute-sum heuristic), which typically cuts output size 40-60% versus
 * always writing filter 0 — worth it since tilesets are committed to the repo.
 */
export function writePng(filePath, width, height, rgba) {
  const stride = width * 4;
  const filtered = Buffer.alloc(height * (stride + 1));
  const candidate = Buffer.alloc(stride);

  for (let y = 0; y < height; y++) {
    const row = y * stride;
    const prevRow = (y - 1) * stride;
    let bestType = 0;
    let bestScore = Infinity;
    let bestBytes = null;

    for (let type = 0; type <= 4; type++) {
      let score = 0;
      for (let x = 0; x < stride; x++) {
        const value = rgba[row + x];
        const a = x >= 4 ? rgba[row + x - 4] : 0;
        const b = y > 0 ? rgba[prevRow + x] : 0;
        const c = y > 0 && x >= 4 ? rgba[prevRow + x - 4] : 0;
        let out;
        switch (type) {
          case 0: out = value; break;
          case 1: out = value - a; break;
          case 2: out = value - b; break;
          case 3: out = value - ((a + b) >> 1); break;
          default: out = value - paeth(a, b, c); break;
        }
        out &= 0xff;
        candidate[x] = out;
        score += out < 128 ? out : 256 - out;
      }
      if (score < bestScore) {
        bestScore = score;
        bestType = type;
        bestBytes = Buffer.from(candidate);
      }
    }

    filtered[y * (stride + 1)] = bestType;
    bestBytes.copy(filtered, y * (stride + 1) + 1);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // colour type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const png = Buffer.concat([
    PNG_SIGNATURE,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', zlib.deflateSync(filtered, { level: 9 })),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);

  fs.writeFileSync(filePath, png);
  return png.length;
}
