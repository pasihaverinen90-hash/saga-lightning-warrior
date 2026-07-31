// tools/asset-pipeline/mapdefs/dawnkeep.mjs
//
// Dawnkeep, authored as an editable GRID. 40 x 30 tiles.
//
// Every square of the town is one character in the grids below. Edit the
// characters to move a street, add a house or drop a barrel; re-run
// `npm run assets` and the map regenerates.
//
//   base  — what the ground is:  . grass   r road   p path
//   over  — what stands on it:   T tree    B bush   k rock   f fence
//                                A hall    I inn    S shop
//                                H house   C cottage  W wide house  L tall house
//                                s inn sign   $ shop sign
//   marks — gameplay:            1 spawn from world   2 spawn from inn
//                                X exit to world      D inn door
//                                n/e/c NPCs           b notice board
//
// Buildings are anchored by the square holding their BOTTOM CENTRE — the tile
// where the door sits. Their collision covers the whole building, so the
// entrance trigger goes on the square directly BELOW the anchor.
//
// To use your own artwork, change the names in LEGEND (or ship a tileset/atlas
// that reuses these names). No grid edit is needed.

const TREES = Array.from({ length: 21 }, (_, i) => `tree_${String(i + 1).padStart(2, '0')}`);
const BUSHES = Array.from({ length: 14 }, (_, i) => `bush_${String(i + 1).padStart(2, '0')}`);
const ROCKS = Array.from({ length: 38 }, (_, i) => `rock_${String(i + 1).padStart(2, '0')}`);
const FENCES = Array.from({ length: 16 }, (_, i) => `fence_${String(i + 1).padStart(2, '0')}`);

const OBJ = 'overworld-objects';
const STRUCT = 'structures';

export const DAWNKEEP_BLUEPRINT = {
  id: 'dawnkeep',
  kind: 'town',
  displayName: 'Dawnkeep',
  walkSpeed: 175,
  groundFill: ['grass', 'grass_v1', 'grass_v2', 'grass_v3', 'grass_alt'],

  legend: {
    base: {
      r: { material: 'road', layer: 'Paths' },
      p: { material: 'path', layer: 'Paths' },
      g: { tiles: ['tallgrass', 'tallgrass_b', 'tallgrass_c'], layer: 'Terrain' },
    },
    over: {
      T: { atlas: OBJ, frames: TREES },
      B: { atlas: OBJ, frames: BUSHES },
      k: { atlas: OBJ, frames: ROCKS },
      f: { atlas: OBJ, frames: FENCES },
      A: { atlas: STRUCT, frame: 'town_hall', size: { width: 6, height: 5 } },
      I: { atlas: STRUCT, frame: 'inn', size: { width: 5, height: 4 } },
      S: { atlas: STRUCT, frame: 'shop', size: { width: 4, height: 4 } },
      H: { atlas: STRUCT, frame: 'house_small', size: { width: 3, height: 3 } },
      C: { atlas: STRUCT, frame: 'cottage', size: { width: 3, height: 3 } },
      W: { atlas: STRUCT, frame: 'house_wide', size: { width: 4, height: 3 } },
      L: { atlas: STRUCT, frame: 'house_tall', size: { width: 3, height: 4 } },
      s: { atlas: STRUCT, frame: 'sign_inn' },
      $: { atlas: STRUCT, frame: 'sign_shop' },
    },
    marks: {
      1: { type: 'spawn', name: 'from_world', facing: 'up' },
      2: { type: 'spawn', name: 'from_inn', facing: 'down' },
      X: {
        type: 'trigger', name: 'to_world',
        properties: {
          kind: 'map', activation: 'contact',
          targetMap: 'elerion_west', targetSpawn: 'from_dawnkeep',
        },
      },
      D: {
        type: 'trigger', name: 'to_inn',
        properties: {
          kind: 'map', activation: 'confirm',
          targetMap: 'dawnkeep_inn', targetSpawn: 'from_town',
          prompt: 'Enter the Inn',
        },
      },
      b: {
        type: 'trigger', name: 'dawnkeep_notice',
        properties: {
          kind: 'sign', activation: 'confirm',
          prompt: 'Read the notice board', dialogueId: 'dawnkeep_notice',
        },
      },
      n: {
        type: 'npc', name: 'dawnkeep_villager', sprite: 'villager',
        facing: 'down', label: 'Villager', dialogueId: 'dawnkeep_villager',
      },
      e: {
        type: 'npc', name: 'dawnkeep_elder', sprite: 'elder',
        facing: 'down', label: 'Elder Maren', dialogueId: 'dawnkeep_elder',
      },
      c: {
        type: 'npc', name: 'dawnkeep_child', sprite: 'villager',
        facing: 'left', label: 'Child', dialogueId: 'dawnkeep_child',
      },
      z: {
        type: 'zone', name: 'dawnkeep_safe', zoneId: 'dawnkeep_safe',
        displayName: 'Dawnkeep', zoneType: 'safe',
      },
    },
  },

  //        0         1         2         3
  //        0123456789012345678901234567890123456789
  base: [
    /*  0 */ '........................................',
    /*  1 */ '........................................',
    /*  2 */ '........................................',
    /*  3 */ '........................................',
    /*  4 */ '........................................',
    /*  5 */ '..................rrr...................',
    /*  6 */ '..................rrr...................',
    /*  7 */ '..................rrr...................',
    /*  8 */ '..................rrr...................',
    /*  9 */ '..................rrr...................',
    /* 10 */ '..................rrr...................',
    /* 11 */ '..................rrr...................',
    /* 12 */ '...........ppppppprrrppppppp............',
    /* 13 */ '...........p......rrr......p............',
    /* 14 */ '...........p......rrr......p............',
    /* 15 */ '...........p......rrr......p............',
    /* 16 */ '..................rrr...................',
    /* 17 */ '....rrrrrrrrrrrrrrrrrrrrrrrrrrrrrr......',
    /* 18 */ '....rrrrrrrrrrrrrrrrrrrrrrrrrrrrrr......',
    /* 19 */ '....rrrrrrrrrrrrrrrrrrrrrrrrrrrrrr......',
    /* 20 */ '..................rrr...................',
    /* 21 */ '..................rrr...................',
    /* 22 */ '..................rrr...................',
    /* 23 */ '..................rrr...................',
    /* 24 */ '........pppppppppprrrppppppppppp........',
    /* 25 */ '..................rrr...................',
    /* 26 */ '..................rrr...................',
    /* 27 */ '..................rrr...................',
    /* 28 */ '..................rrr...................',
    /* 29 */ '..................rrr...................',
  ],

  over: [
    /*  0 */ 'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    /*  1 */ 'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    /*  2 */ 'TT..................................TTTT',
    /*  3 */ 'TT..B............................B..TTTT',
    /*  4 */ 'TT..............................k...TTTT',
    /*  5 */ 'TT..................................TTTT',
    /*  6 */ 'TT..................................TTTT',
    /*  7 */ 'TT..................................TTTT',
    /*  8 */ 'TT........A...........I.....S.......TTTT',
    /*  9 */ 'TT........B.......k.......s..$..k...TTTT',
    /* 10 */ 'TT..................................TTTT',
    /* 11 */ 'TT.k.............................B..TTTT',
    /* 12 */ 'TT..................................TTTT',
    /* 13 */ 'TT.B................................TTTT',
    /* 14 */ 'TTffff.........................fffffTTTT',
    /* 15 */ 'TT.........k..................k.....TTTT',
    /* 16 */ 'TT..................................TTTT',
    /* 17 */ 'TT..................................TTTT',
    /* 18 */ 'TT..................................TTTT',
    /* 19 */ 'TT..................................TTTT',
    /* 20 */ 'TT...B.........................B....TTTT',
    /* 21 */ 'TT..................................TTTT',
    /* 22 */ 'TT..............................k...TTTT',
    /* 23 */ 'TT..................................TTTT',
    /* 24 */ 'TT..................................TTTT',
    /* 25 */ 'TT.....H.....C.........W......L.....TTTT',
    /* 26 */ 'TT..k....................B..........TTTT',
    /* 27 */ 'TT.B...........................k....TTTT',
    /* 28 */ 'TTTTTTTTTTTTTTTTTT...TTTTTTTTTTTTTTTTTTT',
    /* 29 */ 'TTTTTTTTTTTTTTTTTT...TTTTTTTTTTTTTTTTTTT',
  ],

  marks: [
    /*  0 */ 'z.......................................',
    /*  1 */ '........................................',
    /*  2 */ '........................................',
    /*  3 */ '........................................',
    /*  4 */ '........................................',
    /*  5 */ '........................................',
    /*  6 */ '........................................',
    /*  7 */ '........................................',
    /*  8 */ '........................................',
    /*  9 */ '........................................',
    /* 10 */ '......................D.................',
    /* 11 */ '......................2.................',
    /* 12 */ '........................................',
    /* 13 */ '........................................',
    /* 14 */ '........................................',
    /* 15 */ '..............c.........................',
    /* 16 */ '.....................b..................',
    /* 17 */ '........................................',
    /* 18 */ '........................................',
    /* 19 */ '........................................',
    /* 20 */ '........................................',
    /* 21 */ '................n.......e...............',
    /* 22 */ '........................................',
    /* 23 */ '........................................',
    /* 24 */ '........................................',
    /* 25 */ '........................................',
    /* 26 */ '........................................',
    /* 27 */ '...................1....................',
    /* 28 */ '........................................',
    /* 29 */ '..................XXX..................z',
  ],
};

// The 'z' safe-zone marker appears at the top-left and bottom-right only: a
// zone is built from the BOUNDING BOX of every square carrying its character,
// so two opposite corners are enough to cover the whole town. Filling all 1200
// squares with 'z' would say the same thing and bury the rest of the grid.
