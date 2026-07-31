// tools/asset-pipeline/gen-character.mjs
//
// Generates top-down character spritesheets.
//
// Neither supplied sheet contains a character, and the game previously drew the
// player with Phaser Graphics primitives (an ellipse body with a rectangle
// sword). A tilemap world needs a real four-direction sprite with a walk cycle,
// so one is drawn here procedurally.
//
// Layout: 4 columns (walk frames) x 4 rows (down, left, right, up).
// Frame index = direction * 4 + frame. Frame 0 of each row is the idle pose;
// frames 1 and 3 are the contact poses and frame 2 is the second passing pose,
// giving a 4-frame cycle that reads as left-step / right-step.
//
// Replace with real artwork by dropping in a PNG of the same frame size and
// layout — no code or map data changes are required.

import fs from 'node:fs';
import path from 'node:path';
import { writePng } from './lib/png.mjs';
import { createImage, fillRect, setPixel, addGrain, shade, mixColor } from './lib/image.mjs';
import { OUT } from './lib/config.mjs';

/**
 * Frame box. Wider and taller than the collision body on purpose: the body is
 * the character's feet (see PLAYER_BODY in src/game/shared/constants/player.ts)
 * so the head and shoulders can overlap trees and walls.
 */
export const FRAME_W = 48;
export const FRAME_H = 64;

const DIRECTIONS = ['down', 'left', 'right', 'up'];

/** Character colour schemes. Hugo leads the party, so he is the player sprite. */
const CHARACTERS = {
  hugo: {
    cloak: [58, 78, 168], cloakDark: [36, 50, 118], cloakLight: [92, 118, 208],
    trim: [226, 196, 84],
    skin: [232, 190, 150], skinShade: [196, 152, 116],
    hair: [88, 58, 34], hairLight: [126, 86, 50],
    boots: [76, 52, 34],
  },
  villager: {
    cloak: [126, 108, 84], cloakDark: [92, 78, 60], cloakLight: [162, 142, 112],
    trim: [196, 186, 160],
    skin: [226, 184, 146], skinShade: [188, 146, 112],
    hair: [58, 44, 32], hairLight: [92, 72, 52],
    boots: [70, 56, 42],
  },
  innkeeper: {
    cloak: [142, 66, 66], cloakDark: [104, 46, 48], cloakLight: [180, 96, 92],
    trim: [232, 214, 176],
    skin: [236, 198, 160], skinShade: [200, 158, 122],
    hair: [156, 138, 96], hairLight: [190, 172, 128],
    boots: [78, 58, 40],
  },
  elder: {
    cloak: [96, 92, 122], cloakDark: [66, 62, 88], cloakLight: [132, 128, 160],
    trim: [214, 210, 224],
    skin: [226, 194, 162], skinShade: [186, 154, 124],
    hair: [216, 214, 208], hairLight: [240, 240, 236],
    boots: [64, 58, 52],
  },
};

/**
 * Draws one frame.
 *
 * `swing` is the limb phase in -1..1. The whole torso also rises by one pixel
 * on the passing poses, which is what actually sells a walk cycle at this size.
 */
function drawFrame(pal, direction, swing) {
  const img = createImage(FRAME_W, FRAME_H);
  const cx = FRAME_W / 2;
  // Body parts overlap by design: each section is drawn over the top of the
  // one below it, so no gap can open up between head, torso, legs and boots.
  const FEET_Y = 60;   // soles rest here; matches the collision body's bottom
  const LEG_TOP = 42;
  const TORSO_TOP = 24;
  const TORSO_BOTTOM = 46;
  const HEAD_CY = 16;
  const HEAD_R = 10;

  const bob = Math.abs(swing) > 0.5 ? 0 : -1;
  const side = direction === 'left' || direction === 'right';
  const facing = direction === 'left' ? -1 : 1;

  // Contact shadow, always on the ground regardless of the body's bob.
  for (let y = -4; y <= 4; y++) {
    for (let x = -13; x <= 13; x++) {
      if ((x * x) / 169 + (y * y) / 16 <= 1) {
        setPixel(img, cx + x, FEET_Y - 2 + y, 26, 30, 22, 64);
      }
    }
  }

  const stride = Math.round(swing * 3);

  // ── Legs and boots ────────────────────────────────────────────────────────
  const drawLeg = (legX, offset) => {
    const top = LEG_TOP + bob;
    const bottom = FEET_Y - 4 + offset;
    fillRect(img, legX, top, 7, Math.max(2, bottom - top), pal.cloakDark);
    fillRect(img, legX - 1, bottom, 9, 4, pal.boots);
    fillRect(img, legX - 1, bottom, 9, 1, shade(pal.boots, 1.25));
  };
  if (side) {
    drawLeg(cx - 4 + stride, 0);
    drawLeg(cx - 4 - stride, -Math.abs(stride));
  } else {
    drawLeg(cx - 8, stride > 0 ? 0 : -Math.abs(stride));
    drawLeg(cx + 1, stride > 0 ? -Math.abs(stride) : 0);
  }

  // ── Torso / cloak: a trapezoid, narrow at the shoulders, flared at the hem ─
  const torsoH = TORSO_BOTTOM - TORSO_TOP;
  for (let y = 0; y < torsoH; y++) {
    const t = y / torsoH;
    const halfWidth = Math.round((side ? 7 : 9) + t * 4);
    const rowColor = mixColor(pal.cloakLight, pal.cloak, Math.min(1, t * 1.4));
    fillRect(img, cx - halfWidth, TORSO_TOP + y + bob, halfWidth * 2, 1, rowColor);
  }
  // Belt, then the hem drawn last so it caps the legs cleanly.
  fillRect(img, cx - 10, TORSO_TOP + 13 + bob, 20, 3, pal.trim);
  fillRect(img, cx - 13, TORSO_BOTTOM - 4 + bob, 26, 4, pal.cloakDark);

  // ── Arms, swinging opposite the legs ─────────────────────────────────────
  const armY = TORSO_TOP + 5 + bob;
  const handColor = pal.skinShade;
  if (side) {
    const armX = cx + facing * 3 - 2;
    const armSwing = Math.round(swing * 3);
    fillRect(img, armX, armY + armSwing, 5, 11, pal.cloak);
    fillRect(img, armX, armY + armSwing + 11, 5, 3, handColor);
  } else {
    fillRect(img, cx - 13, armY + stride, 5, 11, pal.cloak);
    fillRect(img, cx + 8, armY - stride, 5, 11, pal.cloak);
    fillRect(img, cx - 13, armY + stride + 11, 5, 3, handColor);
    fillRect(img, cx + 8, armY - stride + 11, 5, 3, handColor);
  }

  // ── Head ─────────────────────────────────────────────────────────────────
  const headCy = HEAD_CY + bob;
  // Facing sideways shifts the head slightly off-centre, which reads as a
  // profile far more cheaply than redrawing the silhouette.
  const headCx = cx + (side ? facing * 2 : 0);
  for (let y = -HEAD_R; y <= HEAD_R; y++) {
    for (let x = -HEAD_R; x <= HEAD_R; x++) {
      if (x * x + y * y > HEAD_R * HEAD_R) continue;
      const lit = x * facing < -4 ? pal.skinShade : pal.skin;
      setPixel(img, headCx + x, headCy + y, lit[0], lit[1], lit[2], 255);
    }
  }

  // Hair: a cap over the crown, extended round the back when facing away.
  for (let y = -HEAD_R; y <= HEAD_R; y++) {
    for (let x = -HEAD_R; x <= HEAD_R; x++) {
      if (x * x + y * y > HEAD_R * HEAD_R) continue;
      let isHair = y < -3;
      if (direction === 'up') isHair = y < 5;
      else if (side) isHair = y < -2 || x * facing < -3;
      if (!isHair) continue;
      const c = y < -6 ? pal.hairLight : pal.hair;
      setPixel(img, headCx + x, headCy + y, c[0], c[1], c[2], 255);
    }
  }

  // Eyes. Facing away deliberately has none — that absence is the cue.
  if (direction !== 'up') {
    const eyeY = headCy + 1;
    const eyes = direction === 'down' ? [-4, 2] : direction === 'left' ? [-6, -2] : [1, 5];
    for (const ex of eyes) fillRect(img, headCx + ex, eyeY, 2, 2, [38, 32, 30]);
  }

  addGrain(img, 4, 2, 17);
  return img;
}

export function generateCharacters({ log = console.log } = {}) {
  fs.mkdirSync(OUT.sprites, { recursive: true });
  const written = [];

  for (const [name, pal] of Object.entries(CHARACTERS)) {
    const sheet = createImage(FRAME_W * 4, FRAME_H * 4);
    // Swing phases: idle, contact, passing, opposite contact.
    const phases = [0, 1, 0, -1];

    DIRECTIONS.forEach((direction, row) => {
      phases.forEach((swing, col) => {
        const frame = drawFrame(pal, direction, swing);
        for (let y = 0; y < FRAME_H; y++) {
          for (let x = 0; x < FRAME_W; x++) {
            const s = (y * FRAME_W + x) * 4;
            if (frame.data[s + 3] === 0) continue;
            const d = ((row * FRAME_H + y) * sheet.width + (col * FRAME_W + x)) * 4;
            sheet.data[d] = frame.data[s];
            sheet.data[d + 1] = frame.data[s + 1];
            sheet.data[d + 2] = frame.data[s + 2];
            sheet.data[d + 3] = frame.data[s + 3];
          }
        }
      });
    });

    writePng(path.join(OUT.sprites, `${name}.png`), sheet.width, sheet.height, sheet.data);
    written.push(name);
  }

  const manifest = {
    generated: true,
    note: 'Procedurally generated: neither source sheet contains a character. Replace the PNGs keeping frameWidth/frameHeight and row order to swap in real art.',
    frameWidth: FRAME_W,
    frameHeight: FRAME_H,
    directions: DIRECTIONS,
    framesPerDirection: 4,
    idleFrame: 0,
    walkFrames: [0, 1, 2, 3],
    characters: written,
  };
  fs.writeFileSync(
    path.join(OUT.sprites, 'characters.manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  log(`  characters: ${written.length} sheets (${written.join(', ')}) at ${FRAME_W}x${FRAME_H} per frame`);
  return manifest;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  generateCharacters();
}
