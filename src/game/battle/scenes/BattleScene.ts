// src/game/battle/scenes/BattleScene.ts
// Orchestrates the battle UI, input, and loop.
// All game rules live in battle/engine — this scene only renders and drives flow.
//
// Init data: BattleInitData (from battle-types.ts)
//   enemyIds[]         — which enemies to spawn
//   returnSceneKey     — where to go when battle ends
//   backgroundColorHex — battlefield bg colour
//
// Battle loop (state machine):
//   'start'          → build combatants, build first turn queue → 'player_command'
//   'player_command' → show command menu for current ally
//   'skill_select'   → show skill list for current ally; ESC returns to 'player_command'
//   'item_select'    → show item list for current ally; ESC returns to 'player_command'
//   'target_select'  → show target cursor; ESC returns to whichever menu opened it
//   'resolving'      → run action, show feedback, advance turn → repeat
//   'end'            → show victory/defeat panel, then transition out

import Phaser from 'phaser';
import { SCENE_KEYS } from '../../core/scene-keys';
import {
  GAME_WIDTH, GAME_HEIGHT,
  COLORS, COLOR_HEX, FONTS, FONT_SIZES,
} from '../../core/config';
import { drawPanel } from '../../ui/common/panel';

import type { Combatant, BattleCommand, BattleInitData } from '../engine/battle-types';
import { buildTurnOrder } from '../engine/turn-order';
import { resolveAction } from '../engine/battle-actions';
import { pickEnemyAction } from '../engine/enemy-ai';
import { checkOutcome, buildResult } from '../engine/battle-result';

import { ENEMIES } from '../../data/enemies/enemies';
import { SKILLS } from '../../data/skills/skills';
import { ITEMS } from '../../data/items/items';
import { DIALOGUE } from '../../data/dialogue/dialogue-data';
import { getActiveParty, getInventory } from '../../state/state-selectors';
import { addGold, updatePartyMemberHP, removeItem, applyBattleXp } from '../../state/state-actions';
import { resolveEffectiveStats } from '../../data/equipment/equipment-system';
import type { MemberXpResult } from '../engine/xp-system';
import { runEffects } from '../../dialogue/event-handler';
import type { DialogueSequence } from '../../dialogue/dialogue-types';

// ─── Layout ───────────────────────────────────────────────────────────────────

// Command panel — bottom-left
// Row height and panel width sized to display the custom button art cleanly.
// Button source art is 624×256; displayed at CMD_W × CMD_BTN_H (scaled, stretched).
const CMD_X      = 20;
const CMD_Y      = GAME_HEIGHT - 240;
const CMD_W      = 290;
const CMD_BTN_H  = 52;                                   // displayed button height
const CMD_H      = 4 * CMD_BTN_H + 20;                  // 4 buttons + top/bottom padding
const CMD_ROW_H  = CMD_BTN_H + 4;                        // button height + inter-button gap

// Status panel — bottom-right
const STATUS_X   = GAME_WIDTH - 340;
const STATUS_H   = 220;                        // fits 3 members at ~66px rows; expands toward 5
const STATUS_Y   = GAME_HEIGHT - STATUS_H;     // anchored to bottom
const STATUS_W   = 316;

// Feedback text — sits just above the status panel top
const FEEDBACK_Y = STATUS_Y - 8;

// Ally formation: lower-left (top-left of unit rect, 28×36 each)
// Slots 0–4 support up to 5 members; currently 3 are active.
// Formation staggers diagonally: front-right → mid-left → rear-left.
const ALLY_SLOTS = [
  { x: 224, y: 376 },  // slot 0 — front (Hugo)
  { x: 124, y: 284 },  // slot 1 — mid   (Serelle)
  { x:  44, y: 192 },  // slot 2 — rear  (Kael / third member)
  { x: 184, y: 460 },  // slot 3 — future fourth
  { x: 304, y: 444 },  // slot 4 — future fifth
];

// Enemy formation: upper-right, staggered
const ENEMY_SLOTS = [
  { x: 820, y: 296 },  // single enemy or front of group
  { x: 920, y: 224 },  // second enemy
  { x: 724, y: 200 },  // third enemy
  { x: 870, y: 164 },  // fourth (future)
  { x: 980, y: 300 },  // fifth (future)
];

const UNIT_W = 28;
const UNIT_H = 36;

// ─── Scene ────────────────────────────────────────────────────────────────────

type BattlePhase =
  | 'start'
  | 'player_command'
  | 'skill_select'
  | 'item_select'
  | 'target_select'
  | 'resolving'
  | 'end';

export class BattleScene extends Phaser.Scene {
  // ── Engine state ───────────────────────────────────────────────────────────
  private combatants:   Combatant[] = [];
  private turnQueue:    string[]    = [];
  private currentTurnId: string | null = null;
  private pendingCommand: Partial<BattleCommand> = {};
  private phase: BattlePhase = 'start';

  // ── Input ──────────────────────────────────────────────────────────────────
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyEnter!: Phaser.Input.Keyboard.Key;
  private keyEsc!:   Phaser.Input.Keyboard.Key;
  private keyW!:     Phaser.Input.Keyboard.Key;
  private keyS!:     Phaser.Input.Keyboard.Key;

  // ── Init data ──────────────────────────────────────────────────────────────
  private initData!: BattleInitData;

  // ── Menu state ─────────────────────────────────────────────────────────────
  private cmdSelectedIdx    = 0;
  private targetSelectedIdx = 0;
  /** Set by beginTargetSelect(); read by handleTargetInput() to avoid re-deriving from command type. */
  private pendingTargetSide: 'enemy' | 'ally' = 'enemy';
  /**
   * Tracks which phase opened target_select so ESC can return to the right panel.
   * Set by beginTargetSelect(); consumed by setPhaseBack().
   *   'player_command' — Attack opened target select directly
   *   'skill_select'   — Skill menu opened target select
   *   'item_select'    — Item menu opened target select
   */
  private targetReturnPhase: BattlePhase = 'player_command';

  // ── UI objects (rebuilt when refreshed) ───────────────────────────────────
  private unitGfxMap: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private cmdPanel!:  Phaser.GameObjects.Container;
  private skillPanel!: Phaser.GameObjects.Container;
  private itemPanel!:  Phaser.GameObjects.Container;
  private statusPanel!: Phaser.GameObjects.Container;
  private feedbackText!:  Phaser.GameObjects.Text;
  private targetArrow!:   Phaser.GameObjects.Text;
  private turnArrow!:     Phaser.GameObjects.Text;
  private turnIndicator!: Phaser.GameObjects.Text;
  private inputCooldown = false;

  // ── Skill-select and item-select state ────────────────────────────────────
  private skillSelectedIdx = 0;
  private itemSelectedIdx  = 0;

  constructor() {
    super({ key: SCENE_KEYS.BATTLE });
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  init(data: BattleInitData): void {
    this.initData           = data;
    this.combatants         = [];
    this.turnQueue          = [];
    this.currentTurnId      = null;
    this.pendingCommand     = {};
    this.pendingTargetSide  = 'enemy';
    this.targetReturnPhase  = 'player_command';
    this.phase              = 'start';
    this.cmdSelectedIdx     = 0;
    this.targetSelectedIdx  = 0;
    this.skillSelectedIdx   = 0;
    this.itemSelectedIdx    = 0;
    this.inputCooldown      = false;
    this.unitGfxMap.clear();
  }

  create(): void {
    this.cameras.main.setBackgroundColor(
      this.initData?.backgroundColorHex ?? '#1a0d2e',
    );
    this.cameras.main.fadeIn(300, 0, 0, 0);

    this.buildCombatants();
    this.drawBackground();
    this.drawUnits();
    this.createFeedback();
    this.createCommandPanel();
    this.createSkillPanel();
    this.createItemPanel();
    this.createStatusPanel();
    this.createTargetArrow();
    this.createTurnArrow();
    this.createTurnIndicator();
    this.setupInput();

    // Kick off the loop — play intro dialogue first if this is a boss encounter
    this.time.delayedCall(400, () => {
      const introId = this.initData?.introDialogueId;
      const intro   = introId ? DIALOGUE[introId] : null;
      if (intro) {
        this.playDialogue(intro, () => this.startRound());
      } else {
        this.startRound();
      }
    });
  }

  update(): void {
    if (this.inputCooldown) return;
    if (this.phase === 'player_command') this.handleCommandInput();
    if (this.phase === 'skill_select')   this.handleSkillSelectInput();
    if (this.phase === 'item_select')    this.handleItemSelectInput();
    if (this.phase === 'target_select')  this.handleTargetInput();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Combatant construction
  // ─────────────────────────────────────────────────────────────────────────

  private buildCombatants(): void {
    // ── Allies from active party ─────────────────────────────────────────────
    const party = getActiveParty();
    party.forEach(member => {
      // Resolve base stats + equipment bonuses into a single effective stats object.
      // damage.ts uses Combatant.attack and .defense — no changes there needed.
      const eff = resolveEffectiveStats(member);
      this.combatants.push({
        id:          member.id,
        name:        member.name,
        side:        'ally',
        sourceDefId: '',
        level:       member.level,
        maxHP:       eff.maxHP,
        currentHP:   eff.currentHP,
        maxMP:       eff.maxMP,
        currentMP:   eff.currentMP,
        attack:      eff.attack,
        magic:       eff.magic,
        defense:     eff.defense,
        speed:       eff.speed,
        skillIds:    member.skillIds,
        isDefending: false,
        isDefeated:  eff.currentHP <= 0,
        colorHex:    member.colorHex,
      });
    });

    // ── Enemies from init data ───────────────────────────────────────────────
    (this.initData?.enemyIds ?? ['braxtion_soldier']).forEach((defId, idx) => {
      const def = ENEMIES[defId];
      if (!def) return;
      this.combatants.push({
        id:          `enemy_${idx}`,
        name:        def.name,
        side:        'enemy',
        sourceDefId: defId,
        level:       1,             // enemies have no level progression
        maxHP:       def.maxHP,
        currentHP:   def.maxHP,
        maxMP:       def.maxMP,
        currentMP:   def.maxMP,
        attack:      def.attack,
        magic:       def.magic,
        defense:     def.defense,
        speed:       def.speed,
        skillIds:    def.skillIds,
        isDefending: false,
        isDefeated:  false,
        colorHex:    def.colorHex,
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Background
  // ─────────────────────────────────────────────────────────────────────────

  private drawBackground(): void {
    const gfx = this.add.graphics();

    // Sky gradient
    gfx.fillStyle(0x0d1a2e, 1); gfx.fillRect(0, 0, GAME_WIDTH, 340);
    gfx.fillStyle(0x1a2e40, 1); gfx.fillRect(0, 200, GAME_WIDTH, 140);

    // Ground
    gfx.fillStyle(0x2a3820, 1); gfx.fillRect(0, 340, GAME_WIDTH, GAME_HEIGHT - 340);

    // Horizon line
    gfx.fillStyle(0x3a4a28, 1); gfx.fillRect(0, 336, GAME_WIDTH, 10);

    // Distant rocky shapes on the right (enemy side atmosphere)
    gfx.fillStyle(0x1a1428, 0.8);
    gfx.fillTriangle(700, 340, 820, 180, 940, 340);
    gfx.fillTriangle(860, 340, 980, 160, 1100, 340);
    gfx.fillTriangle(1000, 340, 1140, 200, 1280, 340);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Unit sprites (placeholder shapes)
  // ─────────────────────────────────────────────────────────────────────────

  private drawUnits(): void {
    const allies  = this.combatants.filter(c => c.side === 'ally');
    const enemies = this.combatants.filter(c => c.side === 'enemy');

    allies.forEach((c, i) => {
      const slot = ALLY_SLOTS[i] ?? ALLY_SLOTS[ALLY_SLOTS.length - 1];
      this.drawUnit(c, slot.x, slot.y);
    });

    enemies.forEach((c, i) => {
      const slot = ENEMY_SLOTS[i] ?? ENEMY_SLOTS[ENEMY_SLOTS.length - 1];
      this.drawUnit(c, slot.x, slot.y);
    });
  }

  private drawUnit(combatant: Combatant, x: number, y: number): void {
    const gfx = this.add.graphics();
    gfx.setPosition(x, y).setDepth(10);
    this.renderUnitGfx(gfx, combatant);
    this.unitGfxMap.set(combatant.id, gfx);
  }

  private renderUnitGfx(gfx: Phaser.GameObjects.Graphics, c: Combatant): void {
    gfx.clear();
    if (c.isDefeated) {
      // Defeated — draw faded X
      gfx.lineStyle(2, 0x666666, 0.5);
      gfx.beginPath();
      gfx.moveTo(0, 0); gfx.lineTo(UNIT_W, UNIT_H);
      gfx.moveTo(UNIT_W, 0); gfx.lineTo(0, UNIT_H);
      gfx.strokePath();
      return;
    }

    // Shadow
    gfx.fillStyle(0x000000, 0.3);
    gfx.fillEllipse(UNIT_W / 2 + 2, UNIT_H - 2, UNIT_W - 4, 8);

    // Body
    gfx.fillStyle(c.colorHex, 1);
    gfx.fillRect(4, 8, UNIT_W - 8, UNIT_H - 12);

    // Head
    gfx.fillStyle(c.side === 'ally' ? 0xf0d080 : 0xd0a080, 1);
    gfx.fillRect(6, 0, UNIT_W - 12, 12);

    // Side accent (cape for allies, shoulder for enemies)
    gfx.fillStyle(
      c.side === 'ally'
        ? Phaser.Display.Color.IntegerToColor(c.colorHex).darken(30).color
        : Phaser.Display.Color.IntegerToColor(c.colorHex).darken(20).color,
      1,
    );
    gfx.fillRect(0, 10, 5, UNIT_H - 18);
    gfx.fillRect(UNIT_W - 5, 10, 5, UNIT_H - 18);

    // Defend indicator
    if (c.isDefending) {
      gfx.lineStyle(2, COLORS.iceBlue, 0.9);
      gfx.strokeRect(-2, -2, UNIT_W + 4, UNIT_H + 4);
    }
  }

  private refreshUnitGfx(id: string): void {
    const c   = this.getCombatant(id);
    const gfx = this.unitGfxMap.get(id);
    if (!c || !gfx) return;
    this.renderUnitGfx(gfx, c);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Feedback text
  // ─────────────────────────────────────────────────────────────────────────

  private createFeedback(): void {
    this.feedbackText = this.add.text(
      GAME_WIDTH / 2, FEEDBACK_Y,
      '',
      {
        fontFamily: FONTS.ui,
        fontSize: `${FONT_SIZES.battleCommand}px`,
        color: COLOR_HEX.parchment,
        stroke: '#000000',
        strokeThickness: 3,
        align: 'center',
      },
    ).setOrigin(0.5, 1).setDepth(50);
  }

  private setFeedback(text: string, color: string = COLOR_HEX.parchment): void {
    this.feedbackText.setText(text).setColor(color);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Turn indicator
  // ─────────────────────────────────────────────────────────────────────────

  private createTurnIndicator(): void {
    drawPanel(this, { x: CMD_X, y: CMD_Y - 38, width: CMD_W, height: 30 });
    this.turnIndicator = this.add.text(CMD_X + 14, CMD_Y - 23, '', {
      fontFamily: FONTS.ui,
      fontSize: '15px',
      color: COLOR_HEX.goldAccent,
      fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(51);
  }

  private setTurnIndicator(name: string): void {
    this.turnIndicator.setText(`▶ ${name}'s turn`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Command panel
  // ─────────────────────────────────────────────────────────────────────────

  private createCommandPanel(): void {
    this.cmdPanel = this.add.container(0, 0).setDepth(50).setVisible(false);
  }

  private readonly COMMANDS = ['Attack', 'Skill', 'Item', 'Defend'] as const;

  private refreshCommandPanel(): void {
    this.cmdPanel.removeAll(true);
    this.cmdPanel.setVisible(true);

    this.COMMANDS.forEach((label, i) => {
      const btnY = CMD_Y + 10 + i * CMD_ROW_H;

      // ── Determine button state ──────────────────────────────────────────────
      const isDimmed = (label === 'Item'  && this.getUsableItems().length === 0)
                    || (label === 'Skill' && !this.currentActorHasAffordableSkill());
      const isSelected = i === this.cmdSelectedIdx;

      const textureKey = isDimmed    ? 'btn-disabled'
                       : isSelected  ? 'btn-selected'
                       :               'btn-normal';

      // ── Button background image ─────────────────────────────────────────────
      // The source art is 624×256; displayed at CMD_W × CMD_BTN_H via setDisplaySize.
      // setDisplaySize stretches the image non-uniformly — acceptable for banner-style
      // button art; the gold corners remain readable as accent pieces.
      const btn = this.add.image(CMD_X, btnY, textureKey)
        .setOrigin(0, 0)
        .setDisplaySize(CMD_W, CMD_BTN_H)
        .setDepth(50)
        .setAlpha(isDimmed ? 0.65 : 1);
      this.cmdPanel.add(btn);

      // ── Label text centered on the button ───────────────────────────────────
      // Normal/pressed: dark navy for contrast against parchment fill.
      // Selected: bright parchment against the blue fill.
      // Disabled: uses the dimmed button art; label in disabled color.
      const labelColor = isDimmed   ? COLOR_HEX.textDisabled
                       : isSelected ? COLOR_HEX.parchment
                       :              '#2a1a06';          // dark ink on parchment

      const txt = this.add.text(
        CMD_X + CMD_W / 2,
        btnY + CMD_BTN_H / 2,
        label,
        {
          fontFamily: FONTS.ui,
          fontSize:   `${FONT_SIZES.battleCommand}px`,
          fontStyle:  'bold',
          color:      labelColor,
          stroke:     isSelected ? '#0a1a3a' : '#e8d4a0',
          strokeThickness: 2,
        },
      ).setOrigin(0.5, 0.5).setDepth(51);
      this.cmdPanel.add(txt);
    });
  }

  private hideCommandPanel(): void {
    this.cmdPanel.setVisible(false);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Skill selection panel
  // Appears when the player chooses "Skill" from the command menu.
  // Position: same footprint as the command panel (bottom-left).
  // ─────────────────────────────────────────────────────────────────────────

  private createSkillPanel(): void {
    this.skillPanel = this.add.container(0, 0).setDepth(50).setVisible(false);
  }

  private refreshSkillPanel(actor: Combatant): void {
    this.skillPanel.removeAll(true);
    this.skillPanel.setVisible(true);

    const skills = actor.skillIds
      .map(id => SKILLS[id])
      .filter((s): s is NonNullable<typeof s> => !!s);

    const rowH  = 56;                             // taller row — fits name + description line
    const panH  = 32 + skills.length * rowH;
    const panY  = CMD_Y + CMD_H - panH;

    // Add panel background to the container so removeAll(true) destroys it correctly.
    const bg = drawPanel(this, { x: CMD_X, y: panY, width: CMD_W, height: panH });
    this.skillPanel.add(bg);

    // Header
    const hdr = this.add.text(CMD_X + 14, panY + 10, 'Skills  (ESC to cancel)', {
      fontFamily: FONTS.ui, fontSize: '13px',
      color: COLOR_HEX.textSecondary, fontStyle: 'italic',
    }).setDepth(51);
    this.skillPanel.add(hdr);

    skills.forEach((skill, i) => {
      const rowY       = panY + 28 + i * rowH;
      const isSelected = i === this.skillSelectedIdx;
      const canAfford  = actor.currentMP >= skill.mpCost;

      if (isSelected) {
        const sel = this.add.graphics();
        sel.fillStyle(COLORS.selectionFill, 1);
        sel.fillRoundedRect(CMD_X + 6, rowY, CMD_W - 12, rowH - 4, 4);
        sel.lineStyle(2, COLORS.selectionBorder, 1);
        sel.strokeRoundedRect(CMD_X + 6, rowY, CMD_W - 12, rowH - 4, 4);
        this.skillPanel.add(sel);
      }

      const nameColor = canAfford ? COLOR_HEX.parchment : COLOR_HEX.textDisabled;
      const nameTxt = this.add.text(
        CMD_X + 20, rowY + 8,
        skill.name,
        { fontFamily: FONTS.ui, fontSize: '20px', fontStyle: 'bold', color: nameColor },
      ).setDepth(51);

      const mpColor = canAfford ? COLOR_HEX.iceBlue : COLOR_HEX.textDisabled;
      const mpTxt = this.add.text(
        CMD_X + CMD_W - 16, rowY + 8,
        `${skill.mpCost} MP`,
        { fontFamily: FONTS.ui, fontSize: '14px', color: mpColor },
      ).setOrigin(1, 0).setDepth(51);

      this.skillPanel.add(nameTxt);
      this.skillPanel.add(mpTxt);

      // Description line — shown for all skills; dimmed when not affordable.
      // Provides context for skill choice without needing a separate info pane.
      const descColor = canAfford ? COLOR_HEX.textSecondary : COLOR_HEX.textDisabled;
      const descTxt = this.add.text(
        CMD_X + 20, rowY + 32,
        skill.description,
        { fontFamily: FONTS.ui, fontSize: '11px', fontStyle: 'italic', color: descColor,
          wordWrap: { width: CMD_W - 36 } },
      ).setDepth(51);
      this.skillPanel.add(descTxt);
    });
  }

  private hideSkillPanel(): void {
    this.skillPanel.setVisible(false);
  }

  private handleSkillSelectInput(): void {
    const up      = Phaser.Input.Keyboard.JustDown(this.cursors.up)   || Phaser.Input.Keyboard.JustDown(this.keyW);
    const down    = Phaser.Input.Keyboard.JustDown(this.cursors.down) || Phaser.Input.Keyboard.JustDown(this.keyS);
    const confirm = Phaser.Input.Keyboard.JustDown(this.keyEnter) ||
                    Phaser.Input.Keyboard.JustDown(this.cursors.space);
    const cancel  = Phaser.Input.Keyboard.JustDown(this.keyEsc);

    const actor = this.getCombatant(this.currentTurnId!);
    if (!actor) return;

    const skills = actor.skillIds
      .map(id => SKILLS[id])
      .filter((s): s is NonNullable<typeof s> => !!s);

    if (up || down) {
      this.skillSelectedIdx = (this.skillSelectedIdx + (up ? -1 : 1) + skills.length) % skills.length;
      this.refreshSkillPanel(actor);
    } else if (confirm) {
      const skill = skills[this.skillSelectedIdx];
      if (!skill) return;
      if (actor.currentMP < skill.mpCost) {
        this.setFeedback('Not enough MP.', '#A84747');
        return;
      }
      this.hideSkillPanel();
      this.pendingCommand = { type: 'skill', actorId: actor.id, skillId: skill.id, targetId: '' };
      this.beginTargetSelect(skill.targetType.includes('enemy') ? 'enemy' : 'ally');
    } else if (cancel) {
      this.hideSkillPanel();
      this.phase = 'player_command';
      this.refreshCommandPanel();
      this.setFeedback('');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Item selection panel
  // Appears when the player chooses "Item" from the command menu.
  // Position: same footprint as the skill panel (bottom-left, anchored to CMD_Y+CMD_H).
  // Each row shows: item name + quantity on the left, effect summary on the right.
  // ─────────────────────────────────────────────────────────────────────────

  private createItemPanel(): void {
    this.itemPanel = this.add.container(0, 0).setDepth(50).setVisible(false);
  }

  /** Returns a compact effect string with a type glyph: "♥ +60 HP" or "✦ +25 MP". */
  private itemEffectLabel(def: import('../../data/items/items').ItemDef): string {
    const parts: string[] = [];
    if (def.effect.restoreHP) parts.push(`♥ +${def.effect.restoreHP} HP`);
    if (def.effect.restoreMP) parts.push(`✦ +${def.effect.restoreMP} MP`);
    return parts.length > 0 ? parts.join('  ') : '—';
  }

  private refreshItemPanel(): void {
    this.itemPanel.removeAll(true);
    this.itemPanel.setVisible(true);

    const items = this.getUsableItems();
    const rowH  = 44;
    const rows  = Math.max(items.length, 1);
    const panH  = 32 + rows * rowH;
    const panY  = CMD_Y + CMD_H - panH;

    // Add panel background to the container so removeAll(true) destroys it correctly.
    const bg = drawPanel(this, { x: CMD_X, y: panY, width: CMD_W, height: panH });
    this.itemPanel.add(bg);

    // Header
    const hdr = this.add.text(CMD_X + 14, panY + 10, 'Items  (ESC to cancel)', {
      fontFamily: FONTS.ui, fontSize: '13px',
      color: COLOR_HEX.textSecondary, fontStyle: 'italic',
    }).setDepth(51);
    this.itemPanel.add(hdr);

    if (items.length === 0) {
      const emptyTxt = this.add.text(
        CMD_X + 20, panY + 28 + rowH / 2,
        'No usable items',
        { fontFamily: FONTS.ui, fontSize: '20px', color: COLOR_HEX.textDisabled },
      ).setOrigin(0, 0.5).setDepth(51);
      this.itemPanel.add(emptyTxt);
      return;
    }

    items.forEach((entry, i) => {
      const def        = ITEMS[entry.itemId];
      if (!def) return;
      const rowY       = panY + 28 + i * rowH;
      const isSelected = i === this.itemSelectedIdx;

      if (isSelected) {
        const sel = this.add.graphics();
        sel.fillStyle(COLORS.selectionFill, 1);
        sel.fillRoundedRect(CMD_X + 6, rowY, CMD_W - 12, rowH - 4, 4);
        sel.lineStyle(2, COLORS.selectionBorder, 1);
        sel.strokeRoundedRect(CMD_X + 6, rowY, CMD_W - 12, rowH - 4, 4);
        this.itemPanel.add(sel);
      }

      const nameTxt = this.add.text(
        CMD_X + 20, rowY + 8,
        def.name,
        { fontFamily: FONTS.ui, fontSize: '20px', fontStyle: 'bold', color: COLOR_HEX.parchment },
      ).setDepth(51);
      this.itemPanel.add(nameTxt);

      const qtyTxt = this.add.text(
        CMD_X + CMD_W - 14, rowY + 8,
        `×${entry.quantity}`,
        { fontFamily: FONTS.ui, fontSize: '16px', color: COLOR_HEX.goldAccent },
      ).setOrigin(1, 0).setDepth(51);
      this.itemPanel.add(qtyTxt);

      // Effect line: glyph prefix makes type scannable at a glance without
      // relying on color alone. ♥ = HP restore, ✦ = MP restore.
      const effectStr   = this.itemEffectLabel(def);
      const effectColor = def.effect.restoreHP && !def.effect.restoreMP
        ? COLOR_HEX.successGreen
        : def.effect.restoreMP && !def.effect.restoreHP
          ? COLOR_HEX.iceBlue
          : COLOR_HEX.parchment;

      const effectTxt = this.add.text(
        CMD_X + 20, rowY + 28,
        effectStr,
        { fontFamily: FONTS.ui, fontSize: '13px', color: effectColor },
      ).setDepth(51);
      this.itemPanel.add(effectTxt);
    });
  }

  private hideItemPanel(): void {
    this.itemPanel.setVisible(false);
  }

  private handleItemSelectInput(): void {
    const up      = Phaser.Input.Keyboard.JustDown(this.cursors.up)   || Phaser.Input.Keyboard.JustDown(this.keyW);
    const down    = Phaser.Input.Keyboard.JustDown(this.cursors.down) || Phaser.Input.Keyboard.JustDown(this.keyS);
    const confirm = Phaser.Input.Keyboard.JustDown(this.keyEnter) ||
                    Phaser.Input.Keyboard.JustDown(this.cursors.space);
    const cancel  = Phaser.Input.Keyboard.JustDown(this.keyEsc);

    const actor = this.getCombatant(this.currentTurnId!);
    if (!actor) return;

    const items = this.getUsableItems();

    // Cancel always works regardless of item count
    if (cancel) {
      this.hideItemPanel();
      this.phase = 'player_command';
      this.refreshCommandPanel();
      this.setFeedback('');
      return;
    }

    // If no items, only cancel does something
    if (items.length === 0) return;

    if (up || down) {
      this.itemSelectedIdx = (this.itemSelectedIdx + (up ? -1 : 1) + items.length) % items.length;
      this.refreshItemPanel();
    } else if (confirm) {
      const entry = items[this.itemSelectedIdx];
      const def   = entry ? ITEMS[entry.itemId] : null;
      if (!entry || !def) return;

      this.hideItemPanel();
      this.pendingCommand = { type: 'item', actorId: actor.id, itemId: entry.itemId, targetId: '' };

      if (def.targetType === 'all_allies') {
        // All-ally items skip target selection — find a dummy target (self) and submit
        const anyAlly = this.combatants.find(c => c.side === 'ally' && !c.isDefeated);
        if (!anyAlly) return;
        (this.pendingCommand as BattleCommand & { targetId: string }).targetId = anyAlly.id;
        this.submitCommand(this.pendingCommand as BattleCommand);
      } else {
        // single_ally — open target select on ally side
        this.beginTargetSelect('ally');
      }
    }
  }

  private createStatusPanel(): void {
    this.statusPanel = this.add.container(0, 0).setDepth(50);
    this.refreshStatusPanel();
  }

  private refreshStatusPanel(): void {
    this.statusPanel.removeAll(true);

    // Add background to the container so removeAll(true) destroys it on the next refresh.
    const bg = drawPanel(this, { x: STATUS_X, y: STATUS_Y, width: STATUS_W, height: STATUS_H });
    this.statusPanel.add(bg);

    const allies = this.combatants.filter(c => c.side === 'ally');
    // Row height scales to fit all members; capped at 68px for readability.
    const rowH = Math.min(68, Math.floor((STATUS_H - 20) / Math.max(allies.length, 1)));

    allies.forEach((c, i) => {
      const rowY = STATUS_Y + 10 + i * rowH;

      // Derive name color from the combatant's color identity — no ID hardcoding.
      const nameColorHex = '#' + c.colorHex.toString(16).padStart(6, '0');
      const nameTxt = this.add.text(STATUS_X + 14, rowY, c.name, {
        fontFamily: FONTS.ui,
        fontSize: '18px',
        fontStyle: 'bold',
        color: c.isDefeated ? COLOR_HEX.textDisabled : nameColorHex,
      });
      this.statusPanel.add(nameTxt);

      // Level display — top-right of the row (omitted for defeated members)
      if (!c.isDefeated) {
        const lvTxt = this.add.text(STATUS_X + STATUS_W - 14, rowY, `Lv ${c.level}`, {
          fontFamily: FONTS.ui,
          fontSize: '13px',
          color: COLOR_HEX.textSecondary,
        }).setOrigin(1, 0);
        this.statusPanel.add(lvTxt);
      }

      if (c.isDefeated) {
        const dtxt = this.add.text(STATUS_X + 14, rowY + 22, 'Defeated', {
          fontFamily: FONTS.ui, fontSize: '16px', color: '#A84747',
        });
        this.statusPanel.add(dtxt);
        return;
      }

      // HP bar
      const barW = STATUS_W - 28;
      const hpFrac = c.currentHP / c.maxHP;
      const barGfx = this.add.graphics();
      barGfx.fillStyle(0x222222, 1); barGfx.fillRect(STATUS_X + 14, rowY + 22, barW, 8);
      const hpColor = hpFrac > 0.5 ? COLORS.successGreen : hpFrac > 0.25 ? COLORS.goldAccent : COLORS.dangerCrimson;
      barGfx.fillStyle(hpColor, 1); barGfx.fillRect(STATUS_X + 14, rowY + 22, Math.round(barW * hpFrac), 8);
      this.statusPanel.add(barGfx);

      // HP/MP numbers
      const hpTxt = this.add.text(STATUS_X + 14, rowY + 34, `HP ${c.currentHP}/${c.maxHP}  MP ${c.currentMP}/${c.maxMP}`, {
        fontFamily: FONTS.ui, fontSize: '13px', color: COLOR_HEX.textSecondary,
      });
      this.statusPanel.add(hpTxt);

      if (c.isDefending) {
        const defTxt = this.add.text(STATUS_X + STATUS_W - 18, rowY, '🛡', {
          fontFamily: FONTS.ui, fontSize: '14px', color: COLOR_HEX.iceBlue,
        }).setOrigin(1, 0);
        this.statusPanel.add(defTxt);
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Target selection arrow
  // ─────────────────────────────────────────────────────────────────────────

  private createTargetArrow(): void {
    this.targetArrow = this.add.text(0, 0, '▶', {
      fontFamily: FONTS.ui, fontSize: '20px', color: COLOR_HEX.lightningYellow,
    }).setOrigin(0.5, 1).setDepth(60).setVisible(false);
  }

  private showTargetArrow(targetId: string): void {
    const pos = this.getUnitPosition(targetId);
    if (!pos) return;
    this.targetArrow.setPosition(pos.x + UNIT_W / 2, pos.y - 6).setVisible(true);
  }

  private hideTargetArrow(): void {
    this.targetArrow.setVisible(false);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Active-turn arrow  (above the unit whose turn it is)
  // Visually distinct from the target arrow: ▼ glyph, ice-blue color, sits
  // higher above the unit so both arrows can be on-screen without overlapping.
  // ─────────────────────────────────────────────────────────────────────────

  private createTurnArrow(): void {
    this.turnArrow = this.add.text(0, 0, '▼', {
      fontFamily: FONTS.ui, fontSize: '16px', color: COLOR_HEX.iceBlue,
    }).setOrigin(0.5, 1).setDepth(60).setVisible(false);
  }

  private showTurnArrow(unitId: string): void {
    const pos = this.getUnitPosition(unitId);
    if (!pos) return;
    // 22px above the unit top so it clears the target arrow (pos.y − 6) when both visible
    this.turnArrow.setPosition(pos.x + UNIT_W / 2, pos.y - 22).setVisible(true);
  }

  private hideTurnArrow(): void {
    this.turnArrow.setVisible(false);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Battle loop
  // ─────────────────────────────────────────────────────────────────────────

  private startRound(): void {
    // Rebuild turn order each round from living combatants
    this.turnQueue = buildTurnOrder(this.combatants);
    this.advanceTurn();
  }

  private advanceTurn(): void {
    // Pop the next living combatant from the queue
    this.currentTurnId = this.turnQueue.shift() ?? null;

    if (!this.currentTurnId) {
      // Queue exhausted — start a new round
      this.startRound();
      return;
    }

    const c = this.getCombatant(this.currentTurnId);
    if (!c || c.isDefeated) {
      this.advanceTurn();
      return;
    }

    this.setTurnIndicator(c.name);
    this.showTurnArrow(c.id);

    if (c.side === 'ally') {
      this.beginPlayerTurn(c);
    } else {
      this.runEnemyTurn(c);
    }
  }

  // ─── Player turn ────────────────────────────────────────────────────────

  private beginPlayerTurn(actor: Combatant): void {
    this.pendingCommand = { actorId: actor.id };
    this.cmdSelectedIdx = 0;
    this.phase = 'player_command';
    this.setFeedback('');
    this.refreshCommandPanel();
    this.refreshStatusPanel();
  }

  // ─── Enemy turn ──────────────────────────────────────────────────────────

  private runEnemyTurn(actor: Combatant): void {
    this.phase = 'resolving';
    this.hideCommandPanel();

    const allies = this.combatants.filter(c => c.side === 'ally');
    const command = pickEnemyAction(actor, allies);

    // Short delay so the player can see whose turn it is
    this.time.delayedCall(500, () => {
      this.executeCommand(command);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Command input
  // ─────────────────────────────────────────────────────────────────────────

  private handleCommandInput(): void {
    const up    = Phaser.Input.Keyboard.JustDown(this.cursors.up)   || Phaser.Input.Keyboard.JustDown(this.keyW);
    const down  = Phaser.Input.Keyboard.JustDown(this.cursors.down) || Phaser.Input.Keyboard.JustDown(this.keyS);
    const confirm = Phaser.Input.Keyboard.JustDown(this.keyEnter) ||
                    Phaser.Input.Keyboard.JustDown(this.cursors.space);

    if (up) {
      this.cmdSelectedIdx = (this.cmdSelectedIdx - 1 + 4) % 4;
      this.refreshCommandPanel();
    } else if (down) {
      this.cmdSelectedIdx = (this.cmdSelectedIdx + 1) % 4;
      this.refreshCommandPanel();
    } else if (confirm) {
      this.confirmCommand();
    }
  }

  private confirmCommand(): void {
    const cmdName = this.COMMANDS[this.cmdSelectedIdx];
    const actor = this.getCombatant(this.currentTurnId!);
    if (!actor) return;

    switch (cmdName) {
      case 'Attack':
        this.pendingCommand = { type: 'attack', actorId: actor.id, targetId: '' };
        this.beginTargetSelect('enemy');
        break;

      case 'Skill': {
        const actor2 = this.getCombatant(this.currentTurnId!);
        if (!actor2) return;
        const affordableSkills = actor2.skillIds
          .map(id => SKILLS[id])
          .filter((s): s is NonNullable<typeof s> => !!s && actor2.currentMP >= s.mpCost);
        if (affordableSkills.length === 0) {
          this.setFeedback('Not enough MP.', '#A84747');
          return;
        }
        this.skillSelectedIdx = 0;
        this.phase = 'skill_select';
        this.hideCommandPanel();
        this.refreshSkillPanel(actor2);
        break;
      }

      case 'Item': {
        const items = this.getUsableItems();
        if (items.length === 0) {
          // Still open the panel so the player sees a clear "No items" message
          this.itemSelectedIdx = 0;
          this.phase = 'item_select';
          this.hideCommandPanel();
          this.refreshItemPanel();
          return;
        }
        this.itemSelectedIdx = 0;
        this.phase = 'item_select';
        this.hideCommandPanel();
        this.refreshItemPanel();
        break;
      }

      case 'Defend':
        this.pendingCommand = { type: 'defend', actorId: actor.id };
        this.submitCommand(this.pendingCommand as BattleCommand);
        break;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Target selection
  // ─────────────────────────────────────────────────────────────────────────

  private beginTargetSelect(side: 'enemy' | 'ally'): void {
    // Record which phase opened us so ESC can return to the right panel.
    this.targetReturnPhase  = this.phase;
    this.phase              = 'target_select';
    this.pendingTargetSide  = side;
    this.targetSelectedIdx  = 0;
    const targets = this.getSelectableTargets(side);
    if (targets.length === 0) { this.setPhaseBack(); return; }
    this.hideCommandPanel();
    this.setFeedback('Choose target  ·  ESC to go back');
    this.showTargetArrow(targets[this.targetSelectedIdx].id);
  }

  private handleTargetInput(): void {
    const up    = Phaser.Input.Keyboard.JustDown(this.cursors.up)   || Phaser.Input.Keyboard.JustDown(this.keyW);
    const down  = Phaser.Input.Keyboard.JustDown(this.cursors.down) || Phaser.Input.Keyboard.JustDown(this.keyS);
    const confirm = Phaser.Input.Keyboard.JustDown(this.keyEnter) ||
                    Phaser.Input.Keyboard.JustDown(this.cursors.space);
    const cancel  = Phaser.Input.Keyboard.JustDown(this.keyEsc);

    const targets = this.getSelectableTargets(this.pendingTargetSide);

    if (up || down) {
      this.targetSelectedIdx = (this.targetSelectedIdx + (up ? -1 : 1) + targets.length) % targets.length;
      this.showTargetArrow(targets[this.targetSelectedIdx].id);
    } else if (confirm && targets.length > 0) {
      this.hideTargetArrow();
      const cmd = { ...this.pendingCommand, targetId: targets[this.targetSelectedIdx].id } as BattleCommand;
      this.submitCommand(cmd);
    } else if (cancel) {
      this.setPhaseBack();
    }
  }

  private setPhaseBack(): void {
    this.hideTargetArrow();
    this.setFeedback('');

    // Return to whichever menu opened target_select, not always to player_command.
    if (this.targetReturnPhase === 'skill_select') {
      const actor = this.getCombatant(this.currentTurnId!);
      if (actor) {
        this.phase = 'skill_select';
        this.refreshSkillPanel(actor);
        return;
      }
    }

    if (this.targetReturnPhase === 'item_select') {
      this.phase = 'item_select';
      this.refreshItemPanel();
      return;
    }

    // Default: back to the top command menu
    this.phase = 'player_command';
    this.refreshCommandPanel();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Execute
  // ─────────────────────────────────────────────────────────────────────────

  private submitCommand(command: BattleCommand): void {
    this.phase = 'resolving';
    this.hideCommandPanel();
    this.hideTargetArrow();

    // Item consumption: remove from global inventory before resolving
    if (command.type === 'item') {
      removeItem(command.itemId, 1);
    }

    this.time.delayedCall(100, () => this.executeCommand(command));
  }

  private executeCommand(command: BattleCommand): void {
    const events = resolveAction(command, this.combatants);

    // Feedback shows the action only — damage amounts appear as floating numbers.
    const feedback = this.describeAction(command);
    this.setFeedback(feedback);

    // Refresh all affected unit visuals and spawn floating numbers
    const affectedIds = new Set<string>();
    affectedIds.add(command.actorId);
    if ('targetId' in command && command.targetId) affectedIds.add(command.targetId);
    for (const ev of events) {
      if ('targetId' in ev) affectedIds.add(ev.targetId);
      if ('actorId'  in ev) affectedIds.add(ev.actorId);
    }
    affectedIds.forEach(id => this.refreshUnitGfx(id));
    this.refreshStatusPanel();

    // Spawn floating numbers for each damage/heal event.
    // Slot formula: ((floatIdx+1) % 3 - 1) * 40 → slot 0 = 0px (centred), 1 = +40, 2 = −40.
    // Single-hit actions always land centred; multi-hit spreads cleanly without overlapping.
    let floatIdx = 0;
    for (const ev of events) {
      if (ev.kind === 'damage') {
        const xOff = ((floatIdx + 1) % 3 - 1) * 40;
        this.spawnFloatingDamage(ev.targetId, ev.amount, xOff);
        floatIdx++;
      } else if (ev.kind === 'heal') {
        const xOff = ((floatIdx + 1) % 3 - 1) * 40;
        if (ev.hpRestored > 0) { this.spawnFloatingHeal(ev.targetId, ev.hpRestored, xOff); floatIdx++; }
        if (ev.mpRestored > 0) {
          const mpXOff = ((floatIdx + 1) % 3 - 1) * 40;
          this.spawnFloatingLabel(ev.targetId, `+${ev.mpRestored} MP`, COLOR_HEX.iceBlue, mpXOff);
          floatIdx++;
        }
      } else if (ev.kind === 'defeated') {
        this.setFeedback(`${this.getCombatant(ev.targetId)?.name ?? ''} is defeated!`, COLOR_HEX.dangerCrimson);
      }
    }

    // Sync HP/MP back to global state for allies
    this.combatants.filter(c => c.side === 'ally').forEach(c => {
      updatePartyMemberHP(c.id, c.currentHP, c.currentMP);
    });

    // Victory/defeat check
    const outcome = checkOutcome(this.combatants);
    if (outcome !== 'ongoing') {
      this.time.delayedCall(1200, () => this.endBattle(outcome));
      return;
    }

    // Continue to next turn after delay
    this.time.delayedCall(1000, () => this.advanceTurn());
  }

  /**
   * Returns a short action description for the feedback bar.
   * Damage amounts are shown as floating numbers above targets instead.
   */
  private describeAction(command: BattleCommand): string {
    const actorName = this.getCombatant(command.actorId)?.name ?? '???';
    switch (command.type) {
      case 'attack': return `${actorName} attacks!`;
      case 'skill': {
        const skill = SKILLS[(command as { skillId: string }).skillId];
        return `${actorName} uses ${skill?.name ?? 'a skill'}!`;
      }
      case 'item': {
        const item = ITEMS[(command as { itemId: string }).itemId];
        return `${actorName} uses ${item?.name ?? 'an item'}!`;
      }
      case 'defend': return `${actorName} defends!`;
      default:       return '';
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Floating popups
  // ─────────────────────────────────────────────────────────────────────────

  private spawnFloatingDamage(unitId: string, amount: number, xOffset = 0): void {
    this.spawnFloatingLabel(unitId, `-${amount}`, '#ff3333', xOffset);
  }

  private spawnFloatingHeal(unitId: string, amount: number, xOffset = 0): void {
    this.spawnFloatingLabel(unitId, `+${amount}`, '#33dd55', xOffset);
  }

  private spawnFloatingLabel(unitId: string, label: string, color: string, xOffset = 0): void {
    const pos = this.getUnitPosition(unitId);
    if (!pos) return;

    const startX = pos.x + UNIT_W / 2 + xOffset;
    const startY = pos.y - 8;

    const txt = this.add.text(startX, startY, label, {
      fontFamily: FONTS.ui,
      fontSize:   '30px',
      fontStyle:  'bold',
      color,
      stroke:          '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5, 1).setDepth(80).setAlpha(1);

    this.tweens.add({
      targets:  txt,
      y:        startY - 72,
      alpha:    0,
      duration: 1400,
      ease:     'Quad.easeOut',
      onComplete: () => txt.destroy(),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // End battle
  // ─────────────────────────────────────────────────────────────────────────

  private endBattle(outcome: 'victory' | 'defeat'): void {
    this.phase = 'end';
    this.hideTurnArrow();
    this.hideTargetArrow();
    const result = buildResult(this.combatants, outcome);

    // Apply rewards to global state before drawing the result panel
    if (outcome === 'victory') {
      if (result.goldEarned > 0) addGold(result.goldEarned);
    }
    // XP is applied here; levelUpResults drives what we display
    const levelUpResults: MemberXpResult[] = outcome === 'victory'
      ? applyBattleXp(result.xpEarned)
      : [];

    // ── Result panel ─────────────────────────────────────────────────────────
    const isVictory = outcome === 'victory';

    // The result panel uses custom art displayed at a fixed size.
    // All text is rendered by code on top; the art provides the visual background.
    //
    // Panel display dimensions (preserving source aspect ratio 1536:1024):
    //   displayW=920, displayH=613 — centred in 1280×720 game
    //
    // Key zones within the art (panel-local coordinates):
    //   Navy frame + title zone:  y ≈ 0–191  → title text sits here, ~y=160
    //   Inner parchment:          x=128–820, y=191–407  → gold/XP block
    //   Horizontal gold divider:  y ≈ 420–425
    //   Lower prompt band:        y ≈ 425–469  → continue prompt here

    const PANEL_W   = 920;
    const PANEL_H   = 613;
    const panelX    = GAME_WIDTH  / 2 - PANEL_W / 2;   // 180
    const panelY    = GAME_HEIGHT / 2 - PANEL_H / 2;   // 53

    // Centre x of the inner parchment content zone (panel-local 128–820 → absolute)
    const INNER_CX  = panelX + 474;
    // Left / right edges of the inner text zone for left/right-aligned text
    const INNER_L   = panelX + 136;
    const INNER_R   = panelX + 812;

    // ── Panel background image ────────────────────────────────────────────────
    // The art is 1536×1024 source; setDisplaySize scales it to PANEL_W×PANEL_H.
    this.add.image(panelX, panelY, 'result-panel')
      .setOrigin(0, 0)
      .setDisplaySize(PANEL_W, PANEL_H)
      .setDepth(195);

    // ── Title ─────────────────────────────────────────────────────────────────
    // Placed in the navy frame zone above the parchment, centred horizontally.
    // Gold for victory, rose-red for defeat — both read against the dark frame.
    this.add.text(INNER_CX, panelY + 160,
      isVictory ? (this.initData?.isBoss ? 'Enemy Defeated!' : 'Victory!') : 'Defeated',
      {
        fontFamily: FONTS.title,
        fontSize:   '38px',
        fontStyle:  'bold',
        color:      isVictory ? COLOR_HEX.goldAccent : '#D97A7A',
        stroke:     '#0a0a14',
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(200);

    // ── Gold line ─────────────────────────────────────────────────────────────
    // Inside the parchment zone — uses dark ink so it reads against warm background.
    const goldText  = isVictory && result.goldEarned > 0
      ? `Gold: +${result.goldEarned}`
      : isVictory ? 'Onwards!' : 'The party has fallen...';
    const goldColor = isVictory && result.goldEarned > 0
      ? '#8a5a00'                 // dark gold, readable on parchment
      : '#2c1a06';                // dark ink

    this.add.text(INNER_CX, panelY + 226, goldText, {
      fontFamily: FONTS.ui, fontSize: '20px', fontStyle: 'bold', color: goldColor,
    }).setOrigin(0.5).setDepth(200);

    // ── XP section ────────────────────────────────────────────────────────────
    // Per-member XP rows, each split from the total earned pool.
    // Format: name left-aligned, "+N XP  →  Lv X" right-aligned (level-up),
    //         or "+N XP" right-aligned (no level-up).
    const xpRows: Array<{ memberId: string; xpGained: number; levelsGained: number; newLevel: number }> =
      isVictory && result.xpEarned > 0 ? levelUpResults : [];
    const hasXp = xpRows.length > 0;

    let nextLineY = panelY + 258;

    if (hasXp) {
      // Thin separator — drawn manually so it sits over the art without a full panel bg
      const div = this.add.graphics();
      div.lineStyle(1, 0xaa8820, 0.55);
      div.beginPath();
      div.moveTo(INNER_L,  nextLineY - 2);
      div.lineTo(INNER_R,  nextLineY - 2);
      div.strokePath();
      div.setDepth(200);

      // XP pool header — italic, subdued ink
      this.add.text(INNER_L, nextLineY + 2,
        `XP earned: +${result.xpEarned}`, {
          fontFamily: FONTS.ui,
          fontSize:   '14px',
          fontStyle:  'italic',
          color:      '#1a3a6a',    // dark navy — readable on parchment
        }).setDepth(200);
      nextLineY += 22;

      // One row per active member
      for (const r of xpRows) {
        const combatant = this.getCombatant(r.memberId);
        const name      = combatant?.name ?? r.memberId;
        // Member colour kept but darkened for parchment legibility
        const nameHex   = combatant
          ? '#' + Math.max(0, combatant.colorHex - 0x404040)
              .toString(16).padStart(6, '0')
          : '#2c1a06';

        this.add.text(INNER_L + 8, nextLineY,
          name,
          { fontFamily: FONTS.ui, fontSize: '16px', fontStyle: 'bold', color: nameHex },
        ).setDepth(200);

        const levelTag   = r.levelsGained > 0
          ? `+${r.xpGained} XP  →  Lv ${r.newLevel}`
          : `+${r.xpGained} XP`;
        const levelColor = r.levelsGained > 0 ? '#7a4e00' : '#3a2a10';

        this.add.text(INNER_R - 28, nextLineY,
          levelTag,
          { fontFamily: FONTS.ui, fontSize: '16px', color: levelColor },
        ).setOrigin(1, 0).setDepth(200);

        nextLineY += 22;
      }
    }

    // ── Continue prompt ───────────────────────────────────────────────────────
    // Placed in the lower parchment band (below the gold divider in the art).
    this.add.text(INNER_CX, panelY + 447, 'Space / Enter  —  continue', {
      fontFamily: FONTS.ui, fontSize: '15px',
      fontStyle: 'italic', color: '#4a3010',
    }).setOrigin(0.5).setDepth(200);

    // Accept Space or Enter. The guard ensures only the first keypress fires.
    let dismissed = false;
    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      const outroId = isVictory ? this.initData?.outroDialogueId : undefined;
      const outro   = outroId ? DIALOGUE[outroId] : null;

      const doTransition = () => {
        this.cameras.main.fadeOut(400, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
          const returnKey = this.initData?.returnSceneKey ?? SCENE_KEYS.WORLD_MAP;
          if (outcome === 'defeat') {
            this.scene.start(SCENE_KEYS.TITLE);
          } else {
            const worldReturn: import('../../world/types/world-types').WorldMapInitData = {
              returnX: this.initData?.returnX,
              returnY: this.initData?.returnY,
            };
            this.scene.start(returnKey, worldReturn);
          }
        });
      };

      if (outro) {
        this.playDialogue(outro, doTransition);
      } else {
        doTransition();
      }
    };
    this.input.keyboard!.once('keydown-ENTER', dismiss);
    this.input.keyboard!.once('keydown-SPACE',  dismiss);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Input setup
  // ─────────────────────────────────────────────────────────────────────────

  private setupInput(): void {
    this.cursors  = this.input.keyboard!.createCursorKeys();
    this.keyEnter = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.keyEsc   = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.keyW     = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyS     = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Dialogue  (reuses the same DialogueOverlay pattern as TownScene)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Launches DialogueOverlay as a parallel scene.
   * Runs effects from sequence.onComplete, then calls onComplete callback.
   */
  private playDialogue(sequence: DialogueSequence, onComplete: () => void): void {
    if (this.scene.isActive(SCENE_KEYS.DIALOGUE_OVERLAY)) {
      this.scene.stop(SCENE_KEYS.DIALOGUE_OVERLAY);
    }

    this.scene.get(SCENE_KEYS.DIALOGUE_OVERLAY).events.once(
      'complete',
      (seq: DialogueSequence) => {
        runEffects(seq.onComplete);
        onComplete();
      },
    );

    this.scene.launch(SCENE_KEYS.DIALOGUE_OVERLAY, { sequence });
    this.scene.bringToTop(SCENE_KEYS.DIALOGUE_OVERLAY);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private getCombatant(id: string | null): Combatant | undefined {
    if (!id) return undefined;
    return this.combatants.find(c => c.id === id);
  }

  private getSelectableTargets(side: 'enemy' | 'ally'): Combatant[] {
    return this.combatants.filter(c => c.side === side && !c.isDefeated);
  }

  private getUnitPosition(id: string): { x: number; y: number } | null {
    const gfx = this.unitGfxMap.get(id);
    if (!gfx) return null;
    return { x: gfx.x, y: gfx.y };
  }

  private getFirstAffordableSkill(actor: Combatant): (typeof SKILLS)[string] | null {
    for (const sid of actor.skillIds) {
      const skill = SKILLS[sid];
      if (skill && actor.currentMP >= skill.mpCost) return skill;
    }
    return null;
  }

  private currentActorHasAffordableSkill(): boolean {
    const actor = this.getCombatant(this.currentTurnId);
    if (!actor) return false;
    return this.getFirstAffordableSkill(actor) !== null;
  }

  private getUsableItems(): { itemId: string; quantity: number }[] {
    return getInventory().filter(e => {
      const def = ITEMS[e.itemId];
      return def && e.quantity > 0;
    }) as { itemId: string; quantity: number }[];
  }
}
