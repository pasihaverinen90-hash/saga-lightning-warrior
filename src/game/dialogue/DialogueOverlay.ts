// src/game/dialogue/DialogueOverlay.ts
// A Phaser scene that runs in parallel with any gameplay scene to display
// a dialogue sequence. The host scene launches it with scene.launch() and
// listens for the 'complete' event on this scene's EventEmitter.
//
// Layout uses custom art 'dialogue-box' (1536×1024 source, displayed at 1200×521).
// The art contains:
//   • An oval portrait frame on the left  (~panel-local x=80–345, y=60–480)
//   • A rectangular text area on the right (~panel-local x=339–1160, y=100–416)
// All text and portrait placeholder art is rendered by code at depth 200+.
//
// Usage:
//   this.scene.launch(SCENE_KEYS.DIALOGUE_OVERLAY, { sequence });
//   this.scene.bringToTop(SCENE_KEYS.DIALOGUE_OVERLAY);
//   this.scene.get(SCENE_KEYS.DIALOGUE_OVERLAY).events.once('complete', callback);

import Phaser from 'phaser';
import { SCENE_KEYS } from '../core/scene-keys';
import { GAME_WIDTH, GAME_HEIGHT, FONTS, FONT_SIZES } from '../core/config';
import type { DialogueSequence, SpeakerId } from './dialogue-types';

// ─── Layout ───────────────────────────────────────────────────────────────────
//
// Panel: 1200×521, anchored bottom-centre with an 8px bottom margin.
// Source art is 1536×1024; setDisplaySize scales it to PANEL_W×PANEL_H.
//
// All coordinates below are PANEL-LOCAL (origin = panel top-left).
// Add PANEL_X / PANEL_Y to convert to absolute game coords.

const PANEL_W = 1200;
const PANEL_H = 521;
const PANEL_X = (GAME_WIDTH - PANEL_W) / 2;        // 40
const PANEL_Y = GAME_HEIGHT - PANEL_H - 8;          // 191

// Portrait oval frame (panel-local centre of the oval in the art).
// We render a placeholder ellipse + initial letter inside this area.
const OVL_CX  = 228;   // oval centre x (panel-local)
const OVL_CY  = 286;   // oval centre y (panel-local)
const OVL_RX  =  80;   // portrait fill radius x
const OVL_RY  = 102;   // portrait fill radius y

// Text zone (panel-local) — inside the right rectangular parchment area.
const TXT_L   = 372;   // left edge of text zone
const TXT_R   = 1088;  // right edge — clear margin before the frame border
const TXT_W   = TXT_R - TXT_L - 20;  // word-wrap width (right margin preserved)
const NAME_Y  = 154;   // speaker name baseline (panel-local)
const BODY_Y  = 208;   // body text top (panel-local) — comfortable below name
const PROMPT_X = TXT_R - 8;   // continue prompt right-anchor (panel-local)
const PROMPT_Y = 426;          // continue prompt baseline (panel-local)

// ─── Speaker appearance ───────────────────────────────────────────────────────
//
// Colors are chosen for readability on the warm parchment background.
// They maintain colour identity (Hugo=gold, Serelle=blue, villains=red)
// while being dark enough to read against #f0e6cc.

interface SpeakerAppearance {
  nameColor:    string;   // readable-on-parchment version of character colour
  portraitFill: number;   // fill color for the placeholder oval
  portraitBorder: number; // border colour for the placeholder oval
  initial:      string;   // single letter shown in portrait placeholder
}

function getSpeakerAppearance(speakerId: SpeakerId): SpeakerAppearance {
  switch (speakerId) {
    case 'hugo':
      return { nameColor: '#7a4e00', portraitFill: 0x5a3a08, portraitBorder: 0xd9b35b, initial: 'H' };
    case 'serelle_vaun':
      return { nameColor: '#0a3070', portraitFill: 0x0a2040, portraitBorder: 0x5a9ade, initial: 'S' };
    case 'kael':
      return { nameColor: '#6a2c0a', portraitFill: 0x4a1c06, portraitBorder: 0xd4724a, initial: 'K' };
    case 'narrator':
      return { nameColor: '#50505a', portraitFill: 0x1a1a2a, portraitBorder: 0x606080, initial: '…' };
    case 'enemy_mage':
      return { nameColor: '#6a0a0a', portraitFill: 0x2a040a, portraitBorder: 0xa84747, initial: '?' };
    case 'innkeeper':
      return { nameColor: '#3a2a06', portraitFill: 0x2a1a04, portraitBorder: 0x9a7a30, initial: 'I' };
    case 'shopkeeper':
      return { nameColor: '#3a2a06', portraitFill: 0x041820, portraitBorder: 0x40809a, initial: 'M' };
    case 'villager':
      return { nameColor: '#3a2a06', portraitFill: 0x1e1408, portraitBorder: 0x807050, initial: 'V' };
    case 'guard':
      return { nameColor: '#1a2a1a', portraitFill: 0x101a10, portraitBorder: 0x508050, initial: 'G' };
    default:
      return { nameColor: '#2c1a06', portraitFill: 0x1a1010, portraitBorder: 0x806050, initial: '?' };
  }
}

function formatSpeakerName(speakerId: SpeakerId): string {
  const nameMap: Record<string, string> = {
    hugo:         'Hugo',
    serelle_vaun: 'Serelle',
    kael:         'Kael',
    narrator:     '',
    innkeeper:    'Innkeeper',
    shopkeeper:   'Merchant',
    villager:     'Villager',
    guard:        'Guard',
    enemy_mage:   '???',
  };
  return nameMap[speakerId] ?? speakerId;
}

// ─── Scene ────────────────────────────────────────────────────────────────────

export class DialogueOverlay extends Phaser.Scene {
  private sequence!:       DialogueSequence;
  private lineIndex = 0;

  // Rendered objects — portrait and text are rebuilt per line via renderLine()
  private portraitBg!:     Phaser.GameObjects.Graphics;
  private portraitLetter!: Phaser.GameObjects.Text;
  private speakerName!:    Phaser.GameObjects.Text;
  private bodyText!:       Phaser.GameObjects.Text;
  private continuePrompt!: Phaser.GameObjects.Text;

  private keyEnter!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;
  private inputCooldown = false;

  constructor() {
    super({ key: SCENE_KEYS.DIALOGUE_OVERLAY });
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  init(data: { sequence: DialogueSequence }): void {
    this.sequence      = data.sequence;
    this.lineIndex     = 0;
    this.inputCooldown = false;
  }

  create(): void {
    this.buildStaticUI();
    this.setupInput();
    this.renderLine(this.lineIndex);
    this.cameras.main.fadeIn(120, 0, 0, 0);
  }

  update(): void {
    if (this.inputCooldown) return;
    const advance =
      Phaser.Input.Keyboard.JustDown(this.keyEnter) ||
      Phaser.Input.Keyboard.JustDown(this.keySpace);
    if (advance) this.advanceLine();
  }

  // ─── UI construction ───────────────────────────────────────────────────────

  private buildStaticUI(): void {
    // Light full-screen dim so the dialogue reads against the game scene below.
    this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH, GAME_HEIGHT,
      0x000000, 0.35,
    ).setDepth(190);

    // ── Dialogue box background art ───────────────────────────────────────────
    // The source is 1536×1024; setDisplaySize scales it to PANEL_W×PANEL_H.
    // Transparent padding in the source art is handled automatically by Phaser.
    this.add.image(PANEL_X, PANEL_Y, 'dialogue-box')
      .setOrigin(0, 0)
      .setDisplaySize(PANEL_W, PANEL_H)
      .setDepth(195);

    // ── Portrait placeholder (updated per-line in renderLine) ─────────────────
    // Drawn as an ellipse that matches the oval frame in the art.
    // When real portrait sprites are added, replace this with an image at the same anchor.
    this.portraitBg = this.add.graphics().setDepth(200);

    // Portrait initial letter
    this.portraitLetter = this.add.text(
      PANEL_X + OVL_CX,
      PANEL_Y + OVL_CY,
      '',
      {
        fontFamily: FONTS.title,
        fontSize:   '48px',
        fontStyle:  'bold',
        color:      '#f0e4c8',
      },
    ).setOrigin(0.5).setDepth(201);

    // ── Speaker name ──────────────────────────────────────────────────────────
    this.speakerName = this.add.text(
      PANEL_X + TXT_L,
      PANEL_Y + NAME_Y,
      '',
      {
        fontFamily: FONTS.ui,
        fontSize:   `${FONT_SIZES.dialogueSpeaker}px`,
        fontStyle:  'bold',
        color:      '#2c1a06',
      },
    ).setDepth(201);

    // ── Body text ─────────────────────────────────────────────────────────────
    this.bodyText = this.add.text(
      PANEL_X + TXT_L,
      PANEL_Y + BODY_Y,
      '',
      {
        fontFamily:  FONTS.ui,
        fontSize:    `${FONT_SIZES.dialogueBody}px`,
        color:       '#1e1408',          // dark ink — readable on parchment
        wordWrap:    { width: TXT_W, useAdvancedWrap: true },
        lineSpacing: 5,
      },
    ).setDepth(201);

    // ── Continue prompt ───────────────────────────────────────────────────────
    this.continuePrompt = this.add.text(
      PANEL_X + PROMPT_X,
      PANEL_Y + PROMPT_Y,
      '',    // set per-line by renderLine()
      {
        fontFamily: FONTS.ui,
        fontSize:   '16px',
        color:      '#5a3a10',           // warm sepia — readable on parchment
      },
    ).setOrigin(1, 1).setDepth(201);

    // Pulse the continue prompt
    this.tweens.add({
      targets:  this.continuePrompt,
      alpha:    { from: 1, to: 0.35 },
      duration: 700,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    });
  }

  // ─── Per-line rendering ────────────────────────────────────────────────────

  private renderLine(index: number): void {
    const line       = this.sequence.lines[index];
    const appearance = getSpeakerAppearance(line.speaker);
    const name       = formatSpeakerName(line.speaker);
    const isLast     = index === this.sequence.lines.length - 1;
    const isNarrator = line.speaker === 'narrator';

    // ── Portrait placeholder ───────────────────────────────────────────────
    // For narrator, leave the oval empty (art shows the empty frame).
    // For all others, fill the oval with a tinted background + initial.
    this.portraitBg.clear();
    if (!isNarrator) {
      // Fill ellipse to match the oval frame in the art
      this.portraitBg.fillStyle(appearance.portraitFill, 1);
      this.portraitBg.fillEllipse(
        PANEL_X + OVL_CX, PANEL_Y + OVL_CY,
        OVL_RX * 2, OVL_RY * 2,
      );
      // Thin accent ring
      this.portraitBg.lineStyle(2, appearance.portraitBorder, 0.7);
      this.portraitBg.strokeEllipse(
        PANEL_X + OVL_CX, PANEL_Y + OVL_CY,
        OVL_RX * 2, OVL_RY * 2,
      );
    }
    this.portraitLetter.setText(isNarrator ? '' : appearance.initial);

    // ── Speaker name ───────────────────────────────────────────────────────
    this.speakerName.setText(name);
    this.speakerName.setColor(appearance.nameColor);

    // Body text starts right after the name for narrator (no name shown)
    const bodyOffsetY = isNarrator ? NAME_Y : BODY_Y;
    this.bodyText.setY(PANEL_Y + bodyOffsetY);
    this.bodyText.setText(line.text);

    // ── Continue prompt ────────────────────────────────────────────────────
    this.continuePrompt.setText(isLast ? 'Space ▸  Close' : 'Space ▸');
  }

  // ─── Advance ───────────────────────────────────────────────────────────────

  private advanceLine(): void {
    this.inputCooldown = true;
    this.time.delayedCall(120, () => { this.inputCooldown = false; });

    const nextIndex = this.lineIndex + 1;
    if (nextIndex < this.sequence.lines.length) {
      this.lineIndex = nextIndex;
      this.renderLine(this.lineIndex);
    } else {
      this.events.emit('complete', this.sequence);
      this.scene.stop();
    }
  }

  // ─── Input ─────────────────────────────────────────────────────────────────

  private setupInput(): void {
    this.keyEnter = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.keySpace = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  }
}
