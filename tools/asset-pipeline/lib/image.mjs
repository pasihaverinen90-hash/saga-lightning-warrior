// tools/asset-pipeline/lib/image.mjs
//
// Small RGBA8 image toolkit used by every pipeline stage.
// An "image" here is always `{ width, height, data }` where `data` is a Buffer
// of straight (non-premultiplied) RGBA8, matching what lib/png.mjs produces.

export function createImage(width, height, fill = [0, 0, 0, 0]) {
  const data = Buffer.alloc(width * height * 4);
  if (fill[3] !== 0 || fill[0] || fill[1] || fill[2]) {
    for (let i = 0; i < width * height; i++) {
      data[i * 4] = fill[0];
      data[i * 4 + 1] = fill[1];
      data[i * 4 + 2] = fill[2];
      data[i * 4 + 3] = fill[3];
    }
  }
  return { width, height, data };
}

export function getPixel(img, x, y) {
  const i = (y * img.width + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]];
}

export function setPixel(img, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const i = (y * img.width + x) * 4;
  img.data[i] = clamp255(r);
  img.data[i + 1] = clamp255(g);
  img.data[i + 2] = clamp255(b);
  img.data[i + 3] = clamp255(a);
}

export function clamp255(v) {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

/** Extracts a sub-rectangle as a new image. Out-of-bounds reads clamp to edge. */
export function crop(img, x, y, width, height) {
  const out = createImage(width, height);
  for (let dy = 0; dy < height; dy++) {
    const sy = Math.min(img.height - 1, Math.max(0, y + dy));
    for (let dx = 0; dx < width; dx++) {
      const sx = Math.min(img.width - 1, Math.max(0, x + dx));
      const s = (sy * img.width + sx) * 4;
      const d = (dy * width + dx) * 4;
      out.data[d] = img.data[s];
      out.data[d + 1] = img.data[s + 1];
      out.data[d + 2] = img.data[s + 2];
      out.data[d + 3] = img.data[s + 3];
    }
  }
  return out;
}

/**
 * Area-average (box filter) resample. Correct for the downscales this pipeline
 * performs (83px source cells → 64px tiles) and avoids the aliasing that
 * nearest-neighbour would introduce into painterly source art.
 *
 * Averages in premultiplied space so transparent pixels don't drag colour in.
 */
export function resample(img, targetW, targetH) {
  const out = createImage(targetW, targetH);
  const scaleX = img.width / targetW;
  const scaleY = img.height / targetH;

  for (let ty = 0; ty < targetH; ty++) {
    const y0 = ty * scaleY;
    const y1 = (ty + 1) * scaleY;
    const iy0 = Math.floor(y0);
    const iy1 = Math.min(img.height, Math.ceil(y1));

    for (let tx = 0; tx < targetW; tx++) {
      const x0 = tx * scaleX;
      const x1 = (tx + 1) * scaleX;
      const ix0 = Math.floor(x0);
      const ix1 = Math.min(img.width, Math.ceil(x1));

      let r = 0, g = 0, b = 0, a = 0, weightSum = 0;

      for (let sy = iy0; sy < iy1; sy++) {
        const wy = Math.min(y1, sy + 1) - Math.max(y0, sy);
        if (wy <= 0) continue;
        for (let sx = ix0; sx < ix1; sx++) {
          const wx = Math.min(x1, sx + 1) - Math.max(x0, sx);
          if (wx <= 0) continue;
          const w = wx * wy;
          const s = (sy * img.width + sx) * 4;
          const alpha = img.data[s + 3] / 255;
          r += img.data[s] * alpha * w;
          g += img.data[s + 1] * alpha * w;
          b += img.data[s + 2] * alpha * w;
          a += img.data[s + 3] * w;
          weightSum += w;
        }
      }

      const d = (ty * targetW + tx) * 4;
      if (weightSum > 0) {
        const outA = a / weightSum;
        const unpremul = outA > 0 ? 255 / outA : 0;
        out.data[d] = clamp255((r / weightSum) * unpremul);
        out.data[d + 1] = clamp255((g / weightSum) * unpremul);
        out.data[d + 2] = clamp255((b / weightSum) * unpremul);
        out.data[d + 3] = clamp255(outA);
      }
    }
  }
  return out;
}

/**
 * Makes a texture tile seamlessly by cross-fading each edge band with the
 * opposite edge.
 *
 * For a band of `margin` pixels, column i is blended with column (W-1-i) using
 * weight t = 0.5·(1 − i/margin). At i=0 both edges converge on the same 50/50
 * mix, so left==right exactly; at i=margin the weight is 0 and the interior is
 * untouched. Same treatment vertically.
 *
 * Measured on the supplied grass tiles this removes a ~22-unit per-channel
 * vertical edge discontinuity that would otherwise read as visible grid banding
 * across a large field.
 */
export function makeSeamless(img, margin = 10) {
  const { width: w, height: h } = img;
  const m = Math.min(margin, Math.floor(w / 2) - 1, Math.floor(h / 2) - 1);
  if (m <= 0) return img;

  const out = { width: w, height: h, data: Buffer.from(img.data) };

  // Horizontal: blend left band with right band.
  for (let y = 0; y < h; y++) {
    for (let i = 0; i < m; i++) {
      const t = 0.5 * (1 - i / m);
      const li = (y * w + i) * 4;
      const ri = (y * w + (w - 1 - i)) * 4;
      for (let c = 0; c < 4; c++) {
        const L = img.data[li + c];
        const R = img.data[ri + c];
        out.data[li + c] = clamp255(L * (1 - t) + R * t);
        out.data[ri + c] = clamp255(R * (1 - t) + L * t);
      }
    }
  }

  // Vertical: blend top band with bottom band, reading from the horizontally
  // corrected buffer so corners stay consistent in both directions.
  const horizontal = Buffer.from(out.data);
  for (let x = 0; x < w; x++) {
    for (let i = 0; i < m; i++) {
      const t = 0.5 * (1 - i / m);
      const ti = (i * w + x) * 4;
      const bi = ((h - 1 - i) * w + x) * 4;
      for (let c = 0; c < 4; c++) {
        const T = horizontal[ti + c];
        const B = horizontal[bi + c];
        out.data[ti + c] = clamp255(T * (1 - t) + B * t);
        out.data[bi + c] = clamp255(B * (1 - t) + T * t);
      }
    }
  }

  return out;
}

/**
 * Blends a tile's outer band toward a reference tile's outer band.
 *
 * Every grass-backed tile (flowers, tufts, pebbles, bushes) is conformed to the
 * one seamless grass base, so all of them end up sharing an identical border
 * ring. Any two can then sit next to each other in any order with no visible
 * seam, while their centres keep the variation that stops a field looking
 * tiled. Weight is 1 at the border and falls to 0 at `margin` pixels deep, so
 * centred decoration is untouched.
 */
export function conformEdges(img, reference, margin = 8) {
  const { width: w, height: h } = img;
  const out = { width: w, height: h, data: Buffer.from(img.data) };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const depth = Math.min(x, y, w - 1 - x, h - 1 - y);
      if (depth >= margin) continue;
      const t = 1 - depth / margin;
      const i = (y * w + x) * 4;
      for (let c = 0; c < 4; c++) {
        out.data[i + c] = clamp255(img.data[i + c] * (1 - t) + reference.data[i + c] * t);
      }
    }
  }
  return out;
}

/** Measures mean per-channel mismatch between opposite edges. 0 = perfect tile. */
export function seamError(img) {
  const { width: w, height: h } = img;
  let horizontal = 0;
  for (let y = 0; y < h; y++) {
    const l = (y * w) * 4;
    const r = (y * w + w - 1) * 4;
    horizontal += Math.abs(img.data[l] - img.data[r])
      + Math.abs(img.data[l + 1] - img.data[r + 1])
      + Math.abs(img.data[l + 2] - img.data[r + 2]);
  }
  let vertical = 0;
  for (let x = 0; x < w; x++) {
    const t = x * 4;
    const b = ((h - 1) * w + x) * 4;
    vertical += Math.abs(img.data[t] - img.data[b])
      + Math.abs(img.data[t + 1] - img.data[b + 1])
      + Math.abs(img.data[t + 2] - img.data[b + 2]);
  }
  return {
    h: +(horizontal / (h * 3)).toFixed(2),
    v: +(vertical / (w * 3)).toFixed(2),
  };
}

/** Source-over composite of `src` onto `dst` at (dx, dy). */
export function blit(dst, src, dx, dy, alphaScale = 1) {
  for (let y = 0; y < src.height; y++) {
    const ty = dy + y;
    if (ty < 0 || ty >= dst.height) continue;
    for (let x = 0; x < src.width; x++) {
      const tx = dx + x;
      if (tx < 0 || tx >= dst.width) continue;
      const s = (y * src.width + x) * 4;
      const d = (ty * dst.width + tx) * 4;
      const sa = (src.data[s + 3] / 255) * alphaScale;
      if (sa <= 0) continue;
      const da = dst.data[d + 3] / 255;
      const outA = sa + da * (1 - sa);
      if (outA <= 0) continue;
      for (let c = 0; c < 3; c++) {
        dst.data[d + c] = clamp255(
          (src.data[s + c] * sa + dst.data[d + c] * da * (1 - sa)) / outA,
        );
      }
      dst.data[d + 3] = clamp255(outA * 255);
    }
  }
}

/**
 * Composites `over` onto `base` using a per-pixel coverage mask
 * (Float32Array, 0..1, same dimensions). Used by the autotile generator.
 */
export function blitMasked(base, over, mask) {
  const out = { width: base.width, height: base.height, data: Buffer.from(base.data) };
  for (let i = 0; i < base.width * base.height; i++) {
    const m = mask[i];
    if (m <= 0) continue;
    const sa = (over.data[i * 4 + 3] / 255) * Math.min(1, m);
    if (sa <= 0) continue;
    for (let c = 0; c < 3; c++) {
      out.data[i * 4 + c] = clamp255(over.data[i * 4 + c] * sa + base.data[i * 4 + c] * (1 - sa));
    }
    out.data[i * 4 + 3] = clamp255(
      over.data[i * 4 + 3] * Math.min(1, m) + base.data[i * 4 + 3] * (1 - Math.min(1, m)),
    );
  }
  return out;
}

/** Tight bounding box of pixels with alpha >= threshold, or null if none. */
export function alphaBounds(img, threshold = 8) {
  let minX = img.width, minY = img.height, maxX = -1, maxY = -1;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (img.data[(y * img.width + x) * 4 + 3] >= threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/**
 * Mirrors an image horizontally and/or vertically.
 *
 * Safe to use for tile variants: if a tile is already seamless then its left
 * and right edge columns are identical, so mirroring reproduces the same edge
 * and the flipped tile still butts against the original invisibly. Free
 * variation with no extra source art.
 */
export function mirror(img, { horizontal = false, vertical = false } = {}) {
  const out = createImage(img.width, img.height);
  for (let y = 0; y < img.height; y++) {
    const sy = vertical ? img.height - 1 - y : y;
    for (let x = 0; x < img.width; x++) {
      const sx = horizontal ? img.width - 1 - x : x;
      const s = (sy * img.width + sx) * 4;
      const d = (y * img.width + x) * 4;
      out.data[d] = img.data[s];
      out.data[d + 1] = img.data[s + 1];
      out.data[d + 2] = img.data[s + 2];
      out.data[d + 3] = img.data[s + 3];
    }
  }
  return out;
}

/**
 * Replaces every pixel matching `isBad` by repeatedly averaging its clean
 * neighbours, growing inward from the edges of each bad region.
 *
 * Used to clean the road-surface sample. The sheet draws roads as narrow dirt
 * bands with grass on both sides, so even the least-green window that can be
 * found still contains foliage — and because every generated road tile is
 * composited from that one sample, the leftover grass repeated as a green blob
 * in the middle of every road tile on every map. Inpainting removes it while
 * keeping the surrounding dirt texture.
 */
export function inpaint(img, isBad, maxIterations = 24) {
  const out = { width: img.width, height: img.height, data: Buffer.from(img.data) };
  const bad = new Uint8Array(img.width * img.height);
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const i = y * img.width + x;
      bad[i] = isBad(out.data[i * 4], out.data[i * 4 + 1], out.data[i * 4 + 2]) ? 1 : 0;
    }
  }

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const filled = [];
    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < img.width; x++) {
        const i = y * img.width + x;
        if (!bad[i]) continue;
        let r = 0, g = 0, b = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= img.height) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            if (nx < 0 || nx >= img.width) continue;
            const ni = ny * img.width + nx;
            if (bad[ni]) continue;
            r += out.data[ni * 4]; g += out.data[ni * 4 + 1]; b += out.data[ni * 4 + 2]; n++;
          }
        }
        if (n === 0) continue;
        filled.push([i, Math.round(r / n), Math.round(g / n), Math.round(b / n)]);
      }
    }
    if (filled.length === 0) break;
    for (const [i, r, g, b] of filled) {
      out.data[i * 4] = r; out.data[i * 4 + 1] = g; out.data[i * 4 + 2] = b;
      bad[i] = 0;
    }
  }
  return out;
}

/**
 * Shifts an image's mean colour onto `target` while preserving its texture.
 *
 * Preferred over synthesising a noise texture from scratch: the result still
 * carries the source artwork's real brush detail, so a derived material sits
 * beside the sheet's own tiles without looking computer-generated.
 */
export function tintToward(img, target, strength = 1) {
  const mean = averageColor(img, 1);
  const out = { width: img.width, height: img.height, data: Buffer.from(img.data) };
  const delta = [
    (target[0] - mean[0]) * strength,
    (target[1] - mean[1]) * strength,
    (target[2] - mean[2]) * strength,
  ];
  for (let i = 0; i < img.width * img.height; i++) {
    for (let c = 0; c < 3; c++) {
      out.data[i * 4 + c] = clamp255(img.data[i * 4 + c] + delta[c]);
    }
  }
  return out;
}

/** Average colour of pixels with alpha >= threshold. Used for palette sampling. */
export function averageColor(img, threshold = 200) {
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < img.width * img.height; i++) {
    if (img.data[i * 4 + 3] < threshold) continue;
    r += img.data[i * 4];
    g += img.data[i * 4 + 1];
    b += img.data[i * 4 + 2];
    n++;
  }
  if (!n) return [0, 0, 0];
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}

// ─── Deterministic noise ──────────────────────────────────────────────────────
// Every generator uses these so `npm run assets` is byte-reproducible.
// Math.random() is deliberately never used in this pipeline.

export function hash2(x, y, seed = 0) {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (seed | 0) * 1274126177;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

/** Value noise sampled on a lattice of `cell` pixels, bilinear + smoothstep. */
export function valueNoise(x, y, cell, seed = 0) {
  const gx = Math.floor(x / cell);
  const gy = Math.floor(y / cell);
  const fx = smoothstep((x - gx * cell) / cell);
  const fy = smoothstep((y - gy * cell) / cell);
  const n00 = hash2(gx, gy, seed);
  const n10 = hash2(gx + 1, gy, seed);
  const n01 = hash2(gx, gy + 1, seed);
  const n11 = hash2(gx + 1, gy + 1, seed);
  const nx0 = n00 + (n10 - n00) * fx;
  const nx1 = n01 + (n11 - n01) * fx;
  return nx0 + (nx1 - nx0) * fy;
}

/** Two-octave fractal noise in 0..1. */
export function fractalNoise(x, y, cell, seed = 0) {
  return valueNoise(x, y, cell, seed) * 0.65 + valueNoise(x, y, cell / 2, seed + 91) * 0.35;
}

// ─── Simple shape helpers used by the structure/character generators ─────────

export function fillRect(img, x, y, w, h, [r, g, b, a = 255]) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) setPixel(img, x + dx, y + dy, r, g, b, a);
  }
}

export function strokeRect(img, x, y, w, h, color, thickness = 1) {
  for (let t = 0; t < thickness; t++) {
    fillRect(img, x + t, y + t, w - t * 2, 1, color);
    fillRect(img, x + t, y + h - 1 - t, w - t * 2, 1, color);
    fillRect(img, x + t, y + t, 1, h - t * 2, color);
    fillRect(img, x + w - 1 - t, y + t, 1, h - t * 2, color);
  }
}

/** Adds deterministic per-pixel luminance grain, skipping transparent pixels. */
export function addGrain(img, amount, cell = 3, seed = 7) {
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      if (img.data[i + 3] === 0) continue;
      const n = (fractalNoise(x, y, cell, seed) - 0.5) * 2 * amount;
      img.data[i] = clamp255(img.data[i] + n);
      img.data[i + 1] = clamp255(img.data[i + 1] + n);
      img.data[i + 2] = clamp255(img.data[i + 2] + n);
    }
  }
  return img;
}

export function shade(color, factor) {
  return [clamp255(color[0] * factor), clamp255(color[1] * factor), clamp255(color[2] * factor), color[3] ?? 255];
}

export function mixColor(a, b, t) {
  return [
    clamp255(a[0] + (b[0] - a[0]) * t),
    clamp255(a[1] + (b[1] - a[1]) * t),
    clamp255(a[2] + (b[2] - a[2]) * t),
    clamp255((a[3] ?? 255) + ((b[3] ?? 255) - (a[3] ?? 255)) * t),
  ];
}
