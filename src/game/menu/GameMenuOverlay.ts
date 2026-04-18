// src/game/menu/GameMenuOverlay.ts
// In-game menu overlay — opened with M from world map and town scenes.
// Runs as a parallel Phaser scene (same launch pattern as DialogueOverlay).
// Emits 'close' on the scene's EventEmitter before stopping so host scenes
// can clear their menuActive flag.
//
// Tabs: Party · Inventory · Quests · Save · Close
// Input: ↑↓ / W·S navigate tabs, Enter/Space confirm, Esc/M close.

import Phaser from 'phaser';
import { SCENE_KEYS } from '../core/scene-keys';
import {
  GAME_WIDTH, GAME_HEIGHT,
  COLORS, COLOR_HEX, FONTS,
} from '../core/config';
import { drawPanel } from '../ui/common/panel';
import { getActiveParty, getInventory, getGold, getStoryFlag } from '../state/state-selectors';
import { saveGame, getSaveMeta } from '../save/save-service';
import { ITEMS } from '../data/items/items';
import { EQUIPMENT } from '../data/equipment/equipment';
import { resolveEffectiveStats } from '../data/equipment/equipment-system';
import { STORY_FLAGS } from '../data/story/story-events';

// ─── Layout ───────────────────────────────────────────────────────────────────
//
// Overall panel: 1120×600 centered in 1280×720 with 80px left / 60px top margin.
// Left nav column (196px) + 8px gap + right content area (916px).

const MENU_X  = 80;
const MENU_Y  = 60;
const MENU_W  = 1120;
const MENU_H  = 600;
const NAV_W   = 196;
const NAV_GAP = 8;
const CONT_X  = MENU_X + NAV_W + NAV_GAP;  // 284
const CONT_W  = MENU_W - NAV_W - NAV_GAP;  // 916

// Navigation tab rows — title takes top 52px, then 5 rows of 68px each
const TAB_TOP   = MENU_Y + 52;
const TAB_ROW_H = 68;

// Horizontal padding inside the content panel
const P = 20;

// ─── Tab definitions ──────────────────────────────────────────────────────────

type TabId = 'party' | 'inventory' | 'quests' | 'save' | 'close';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'party',     label: 'Party'     },
  { id: 'inventory', label: 'Inventory' },
  { id: 'quests',    label: 'Quests'    },
  { id: 'save',      label: 'Save'      },
  { id: 'close',     label: 'Close'     },
];

// ─── Objectives list ──────────────────────────────────────────────────────────
// Ordered by story progression. The first entry whose flag is NOT set is the
// current active objective. Future objectives are hidden (no spoilers).

const OBJECTIVES: Array<{ text: string; flag: string }> = [
  { text: 'Find Serelle in Lumen Town.',         flag: STORY_FLAGS.SERELLE_JOINED     },
  { text: 'Travel to Ashenveil. Recruit Kael.',  flag: STORY_FLAGS.KAEL_JOINED        },
  { text: 'Cleanse the shadows of Thornwood.',   flag: STORY_FLAGS.THORNWOOD_CLEARED  },
  { text: 'Defeat Veyr, the Corrupted Mage.',    flag: STORY_FLAGS.BOSS_VEYR_DEFEATED },
];

// ─── Scene ────────────────────────────────────────────────────────────────────

export class GameMenuOverlay extends Phaser.Scene {
  private selectedTab   = 0;
  private saveMsg       = '';
  private inputCooldown = false;

  // Containers cleared and rebuilt on every tab change
  private navContainer!:     Phaser.GameObjects.Container;
  private contentContainer!: Phaser.GameObjects.Container;

  private keyUp!:    Phaser.Input.Keyboard.Key;
  private keyDown!:  Phaser.Input.Keyboard.Key;
  private keyEnter!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;
  private keyEsc!:   Phaser.Input.Keyboard.Key;
  private keyW!:     Phaser.Input.Keyboard.Key;
  private keyS!:     Phaser.Input.Keyboard.Key;
  private keyM!:     Phaser.Input.Keyboard.Key;

  constructor() {
    super({ key: SCENE_KEYS.GAME_MENU });
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  init(): void {
    this.selectedTab   = 0;
    this.saveMsg       = '';
    this.inputCooldown = false;
  }

  create(): void {
    // Full-screen dim so the background scene is still legible but clearly paused
    this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH, GAME_HEIGHT,
      0x000000, 0.55,
    ).setDepth(200);

    this.navContainer     = this.add.container(0, 0).setDepth(210);
    this.contentContainer = this.add.container(0, 0).setDepth(210);

    this.setupInput();
    this.render();
    this.cameras.main.fadeIn(80, 0, 0, 0);
  }

  update(): void {
    if (this.inputCooldown) return;

    const up      = Phaser.Input.Keyboard.JustDown(this.keyUp)    || Phaser.Input.Keyboard.JustDown(this.keyW);
    const down    = Phaser.Input.Keyboard.JustDown(this.keyDown)  || Phaser.Input.Keyboard.JustDown(this.keyS);
    const confirm = Phaser.Input.Keyboard.JustDown(this.keyEnter) || Phaser.Input.Keyboard.JustDown(this.keySpace);
    const cancel  = Phaser.Input.Keyboard.JustDown(this.keyEsc)   || Phaser.Input.Keyboard.JustDown(this.keyM);

    if (up || down) {
      this.selectedTab = (this.selectedTab + (up ? -1 : 1) + TABS.length) % TABS.length;
      this.saveMsg = '';
      this.render();
    } else if (confirm) {
      const id = TABS[this.selectedTab].id;
      if (id === 'close') {
        this.closeMenu();
      } else if (id === 'save') {
        this.performSave();
      }
    } else if (cancel) {
      this.closeMenu();
    }
  }

  // ─── Actions ───────────────────────────────────────────────────────────────

  private closeMenu(): void {
    this.events.emit('close');
    this.scene.stop();
  }

  private performSave(): void {
    this.inputCooldown = true;
    const ok = saveGame();
    this.saveMsg = ok ? 'Progress saved!' : 'Save failed.';
    this.render();
    this.time.delayedCall(300, () => { this.inputCooldown = false; });
  }

  // ─── Top-level render ──────────────────────────────────────────────────────

  private render(): void {
    this.renderNav();
    this.renderContent();
  }

  // ─── Nav panel ─────────────────────────────────────────────────────────────

  private renderNav(): void {
    this.navContainer.removeAll(true);

    const bg = drawPanel(this, { x: MENU_X, y: MENU_Y, width: NAV_W, height: MENU_H });
    this.navContainer.add(bg);

    // "MENU" heading
    const title = this.add.text(
      MENU_X + NAV_W / 2, MENU_Y + 14,
      'MENU',
      { fontFamily: FONTS.title, fontSize: '20px', fontStyle: 'bold', color: COLOR_HEX.goldAccent },
    ).setOrigin(0.5, 0).setDepth(211);
    this.navContainer.add(title);

    // Thin divider below heading
    const divGfx = this.add.graphics().setDepth(211);
    divGfx.lineStyle(1, COLORS.panelBorder, 0.6);
    divGfx.beginPath();
    divGfx.moveTo(MENU_X + 12, MENU_Y + 44);
    divGfx.lineTo(MENU_X + NAV_W - 12, MENU_Y + 44);
    divGfx.strokePath();
    this.navContainer.add(divGfx);

    // Tab rows
    TABS.forEach((tab, i) => {
      const rowY      = TAB_TOP + i * TAB_ROW_H;
      const isSelected = i === this.selectedTab;

      if (isSelected) {
        const sel = this.add.graphics().setDepth(211);
        sel.fillStyle(COLORS.selectionFill, 1);
        sel.fillRoundedRect(MENU_X + 8, rowY, NAV_W - 16, TAB_ROW_H - 8, 4);
        sel.lineStyle(2, COLORS.selectionBorder, 1);
        sel.strokeRoundedRect(MENU_X + 8, rowY, NAV_W - 16, TAB_ROW_H - 8, 4);
        this.navContainer.add(sel);
      }

      const labelTxt = this.add.text(
        MENU_X + NAV_W / 2,
        rowY + (TAB_ROW_H - 8) / 2,
        tab.label,
        {
          fontFamily: FONTS.ui,
          fontSize:   '22px',
          fontStyle:  isSelected ? 'bold' : 'normal',
          color:      isSelected ? COLOR_HEX.parchment : COLOR_HEX.textSecondary,
        },
      ).setOrigin(0.5, 0.5).setDepth(212);
      this.navContainer.add(labelTxt);
    });

    // Footer hint
    const hint = this.add.text(
      MENU_X + NAV_W / 2, MENU_Y + MENU_H - 12,
      'Esc / M  —  close',
      { fontFamily: FONTS.ui, fontSize: '11px', color: COLOR_HEX.textDisabled },
    ).setOrigin(0.5, 1).setDepth(211);
    this.navContainer.add(hint);
  }

  // ─── Content panel dispatcher ──────────────────────────────────────────────

  private renderContent(): void {
    this.contentContainer.removeAll(true);

    const bg = drawPanel(this, { x: CONT_X, y: MENU_Y, width: CONT_W, height: MENU_H });
    this.contentContainer.add(bg);

    switch (TABS[this.selectedTab].id) {
      case 'party':     this.renderParty();     break;
      case 'inventory': this.renderInventory(); break;
      case 'quests':    this.renderQuests();    break;
      case 'save':      this.renderSave();      break;
      case 'close':     this.renderClose();     break;
    }
  }

  // ─── Party panel ───────────────────────────────────────────────────────────
  //
  // One block per active party member. Stats come from resolveEffectiveStats()
  // so equipment bonuses are reflected (matching what the player sees in battle).

  private renderParty(): void {
    const cy = MENU_Y;

    this.ctxt(CONT_X + P, cy + P, 'Party', FONTS.title, '22px', COLOR_HEX.goldAccent, 'bold');

    const party    = getActiveParty();
    const blockH   = 164;
    const blockGap = 8;

    party.forEach((member, i) => {
      const bx = CONT_X + P;
      const by = cy + 56 + i * (blockH + blockGap);
      const bw = CONT_W - P * 2;

      // Block background
      const blockBg = this.add.graphics().setDepth(211);
      blockBg.fillStyle(0x0a1824, 0.65);
      blockBg.fillRoundedRect(bx, by, bw, blockH, 4);
      blockBg.lineStyle(1, COLORS.panelBorder, 0.45);
      blockBg.strokeRoundedRect(bx, by, bw, blockH, 4);
      this.contentContainer.add(blockBg);

      const s       = resolveEffectiveStats(member);
      const nameHex = '#' + member.colorHex.toString(16).padStart(6, '0');

      // ── Name + Level ──────────────────────────────────────────────────────
      this.ctxt(bx + 14, by + 10, member.name, FONTS.ui, '22px', nameHex, 'bold');
      this.ctxt(bx + bw - 14, by + 12, `Lv ${member.level}`,
        FONTS.ui, '15px', COLOR_HEX.textSecondary, 'normal', 1, 0);

      // ── HP bar ────────────────────────────────────────────────────────────
      const barW   = 340;
      const hpFrac = s.maxHP > 0 ? Math.min(1, s.currentHP / s.maxHP) : 0;
      const hpColor = hpFrac > 0.5 ? COLORS.successGreen
                    : hpFrac > 0.25 ? COLORS.goldAccent
                    : COLORS.dangerCrimson;
      this.ctxt(bx + 14, by + 38, 'HP', FONTS.ui, '13px', COLOR_HEX.textSecondary);
      this.hbar(bx + 44, by + 40, barW, 8, hpColor, hpFrac);
      this.ctxt(bx + 44 + barW + 8, by + 37, `${s.currentHP} / ${s.maxHP}`,
        FONTS.ui, '13px', COLOR_HEX.textSecondary);

      // ── MP bar ────────────────────────────────────────────────────────────
      const mpFrac = s.maxMP > 0 ? Math.min(1, s.currentMP / s.maxMP) : 0;
      this.ctxt(bx + 14, by + 58, 'MP', FONTS.ui, '13px', COLOR_HEX.iceBlue);
      this.hbar(bx + 44, by + 60, barW, 8, COLORS.iceBlue, mpFrac);
      this.ctxt(bx + 44 + barW + 8, by + 57, `${s.currentMP} / ${s.maxMP}`,
        FONTS.ui, '13px', COLOR_HEX.textSecondary);

      // ── Core stats ────────────────────────────────────────────────────────
      const statsLine = `ATK  ${s.attack}     MAG  ${s.magic}     DEF  ${s.defense}     SPD  ${s.speed}`;
      this.ctxt(bx + 14, by + 82, statsLine, FONTS.ui, '16px', COLOR_HEX.parchment);

      // ── Equipment ─────────────────────────────────────────────────────────
      const wpn = member.equipment.weapon
        ? (EQUIPMENT[member.equipment.weapon]?.name ?? member.equipment.weapon) : '—';
      const arm = member.equipment.armor
        ? (EQUIPMENT[member.equipment.armor]?.name ?? member.equipment.armor)   : '—';
      this.ctxt(bx + 14, by + 108, `Weapon:  ${wpn}`, FONTS.ui, '14px', COLOR_HEX.textSecondary);
      this.ctxt(bx + 14, by + 128, `Armor:   ${arm}`, FONTS.ui, '14px', COLOR_HEX.textSecondary);
    });
  }

  // ─── Inventory panel ───────────────────────────────────────────────────────

  private renderInventory(): void {
    const cy = MENU_Y;
    const cx = CONT_X;

    this.ctxt(cx + P, cy + P, 'Inventory', FONTS.title, '22px', COLOR_HEX.goldAccent, 'bold');

    // Gold — top-right corner
    this.ctxt(cx + CONT_W - P, cy + P + 4,
      `Gold:  ${getGold()} g`,
      FONTS.ui, '18px', COLOR_HEX.goldAccent, 'bold', 1, 0);

    const inv = getInventory().filter(e => e.quantity > 0);

    if (inv.length === 0) {
      this.ctxt(cx + P, cy + 72, 'No items in inventory.',
        FONTS.ui, '18px', COLOR_HEX.textDisabled, 'italic');
      return;
    }

    // Column headers
    const hdrY = cy + 60;
    this.ctxt(cx + P + 8,   hdrY, 'Item',   FONTS.ui, '13px', COLOR_HEX.textDisabled);
    this.ctxt(cx + P + 440, hdrY, 'Effect', FONTS.ui, '13px', COLOR_HEX.textDisabled);
    this.ctxt(cx + CONT_W - P - 8, hdrY, 'Qty',
      FONTS.ui, '13px', COLOR_HEX.textDisabled, 'normal', 1, 0);

    // Divider
    const div = this.add.graphics().setDepth(212);
    div.lineStyle(1, COLORS.panelBorder, 0.5);
    div.beginPath();
    div.moveTo(cx + P, cy + 78); div.lineTo(cx + CONT_W - P, cy + 78);
    div.strokePath();
    this.contentContainer.add(div);

    const rowH = 44;
    inv.forEach((entry, i) => {
      const def  = ITEMS[entry.itemId];
      if (!def) return;
      const rowY = cy + 84 + i * rowH;

      // Alternating row stripe
      if (i % 2 === 0) {
        const stripe = this.add.graphics().setDepth(211);
        stripe.fillStyle(0x0a1824, 0.35);
        stripe.fillRect(cx + P, rowY, CONT_W - P * 2, rowH - 2);
        this.contentContainer.add(stripe);
      }

      this.ctxt(cx + P + 8, rowY + 11, def.name,
        FONTS.ui, '18px', COLOR_HEX.parchment, 'bold');

      const parts: string[] = [];
      if (def.effect.restoreHP) parts.push(`♥ +${def.effect.restoreHP} HP`);
      if (def.effect.restoreMP) parts.push(`✦ +${def.effect.restoreMP} MP`);
      this.ctxt(cx + P + 440, rowY + 13, parts.join('  ') || '—',
        FONTS.ui, '15px', COLOR_HEX.successGreen);

      this.ctxt(cx + CONT_W - P - 8, rowY + 13, `×${entry.quantity}`,
        FONTS.ui, '16px', COLOR_HEX.goldAccent, 'bold', 1, 0);
    });
  }

  // ─── Quests panel ──────────────────────────────────────────────────────────
  //
  // Derived from STORY_FLAGS — no separate quest data structure needed.
  // Completed objectives are shown with a check; the current one is highlighted;
  // future objectives are hidden to avoid spoilers.

  private renderQuests(): void {
    const cy = MENU_Y;
    const cx = CONT_X;

    this.ctxt(cx + P, cy + P, 'Quests', FONTS.title, '22px', COLOR_HEX.goldAccent, 'bold');
    this.ctxt(cx + P, cy + 52, "The Lightning Warrior's Journey",
      FONTS.title, '15px', COLOR_HEX.textSecondary, 'italic');

    let lineY       = cy + 90;
    let currentFound = false;

    OBJECTIVES.forEach((obj) => {
      const done      = getStoryFlag(obj.flag);
      const isCurrent = !done && !currentFound;
      if (isCurrent) currentFound = true;

      if (done) {
        this.ctxt(cx + P, lineY, `✓  ${obj.text}`,
          FONTS.ui, '15px', COLOR_HEX.textDisabled);
        lineY += 30;
      } else if (isCurrent) {
        // Highlight row behind the current objective
        const hi = this.add.graphics().setDepth(211);
        hi.fillStyle(COLORS.selectionFill, 0.45);
        hi.fillRoundedRect(cx + P - 6, lineY - 4, CONT_W - P * 2, 40, 4);
        this.contentContainer.add(hi);
        this.ctxt(cx + P + 4, lineY + 4, `▶  ${obj.text}`,
          FONTS.ui, '18px', COLOR_HEX.parchment, 'bold');
        lineY += 52;
      }
      // Future objectives: not shown — no spoilers
    });

    if (!currentFound) {
      this.ctxt(cx + P, lineY + 14,
        'All known objectives complete.',
        FONTS.ui, '16px', COLOR_HEX.successGreen, 'italic');
    }

    // Chapter footer
    this.ctxt(cx + P, MENU_Y + MENU_H - 24,
      'Chapter 1  —  The Lightning Warrior',
      FONTS.ui, '12px', COLOR_HEX.textDisabled, 'italic');
  }

  // ─── Save panel ────────────────────────────────────────────────────────────
  //
  // Save goes through save-service.ts (the sole persistence point) so calling
  // saveGame() here is architecturally correct — same path as inn / save crystal.

  private renderSave(): void {
    const cy = MENU_Y;
    const cx = CONT_X;

    this.ctxt(cx + P, cy + P, 'Save', FONTS.title, '22px', COLOR_HEX.goldAccent, 'bold');

    // Last save metadata
    const meta = getSaveMeta();
    if (meta) {
      this.ctxt(cx + P, cy + 62, 'Last save:', FONTS.ui, '14px', COLOR_HEX.textSecondary);
      this.ctxt(cx + P, cy + 82,
        new Date(meta.timestamp).toLocaleString(),
        FONTS.ui, '14px', COLOR_HEX.textDisabled);
      this.ctxt(cx + P, cy + 100,
        `Location:  ${meta.locationId.replace(/_/g, ' ')}`,
        FONTS.ui, '13px', COLOR_HEX.textDisabled);
    } else {
      this.ctxt(cx + P, cy + 62, 'No previous save found.',
        FONTS.ui, '14px', COLOR_HEX.textDisabled);
    }

    // Save button
    const btnY = cy + 148;
    const btnBg = this.add.graphics().setDepth(212);
    btnBg.fillStyle(COLORS.selectionFill, 0.95);
    btnBg.fillRoundedRect(cx + P, btnY, 280, 52, 6);
    btnBg.lineStyle(2, COLORS.selectionBorder, 1);
    btnBg.strokeRoundedRect(cx + P, btnY, 280, 52, 6);
    this.contentContainer.add(btnBg);

    this.ctxt(cx + P + 140, btnY + 26, 'Save Progress',
      FONTS.ui, '20px', COLOR_HEX.parchment, 'bold', 0.5, 0.5);
    this.ctxt(cx + P, btnY + 62,
      'Press Enter / Space to confirm',
      FONTS.ui, '13px', COLOR_HEX.textDisabled, 'italic');

    // Result message from last save attempt
    if (this.saveMsg) {
      const color = this.saveMsg.startsWith('Progress')
        ? COLOR_HEX.successGreen : '#A84747';
      this.ctxt(cx + P, btnY + 86, this.saveMsg,
        FONTS.ui, '18px', color, 'bold');
    }
  }

  // ─── Close tab ─────────────────────────────────────────────────────────────

  private renderClose(): void {
    this.ctxt(
      CONT_X + CONT_W / 2,
      MENU_Y + MENU_H / 2,
      'Press Enter or Space to close the menu.',
      FONTS.ui, '18px', COLOR_HEX.textSecondary, 'italic',
      0.5, 0.5,
    );
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /** Creates a text object at depth 212 and adds it to the content container. */
  private ctxt(
    x: number, y: number, text: string,
    fontFamily: string, fontSize: string, color: string,
    fontStyle = 'normal', originX = 0, originY = 0,
  ): Phaser.GameObjects.Text {
    const t = this.add.text(x, y, text, { fontFamily, fontSize, fontStyle, color })
      .setOrigin(originX, originY).setDepth(212);
    this.contentContainer.add(t);
    return t;
  }

  /** Draws a two-layer bar (dark bg + coloured fill) into the content container. */
  private hbar(
    x: number, y: number, w: number, h: number,
    fillColor: number, fraction: number,
  ): void {
    const gfx = this.add.graphics().setDepth(212);
    gfx.fillStyle(0x111111, 1);
    gfx.fillRoundedRect(x, y, w, h, 3);
    const filled = Math.max(0, Math.round(w * Math.min(1, fraction)));
    if (filled > 0) {
      gfx.fillStyle(fillColor, 1);
      gfx.fillRoundedRect(x, y, filled, h, 3);
    }
    this.contentContainer.add(gfx);
  }

  private setupInput(): void {
    const kbd = this.input.keyboard!;
    this.keyUp    = kbd.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.keyDown  = kbd.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.keyEnter = kbd.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.keySpace = kbd.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keyEsc   = kbd.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.keyW     = kbd.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyS     = kbd.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyM     = kbd.addKey(Phaser.Input.Keyboard.KeyCodes.M);
  }
}
