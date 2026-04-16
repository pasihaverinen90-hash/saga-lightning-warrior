// src/game/town/systems/npc-system.ts
// Pure TypeScript. No Phaser or state imports.
// Determines which dialogue sequence an NPC should use given the current story flags.
// Scenes pass in the flags rather than importing state directly — keeps this testable.

import type { DialogueOverride } from '../types/town-types';
import type { StoryFlags } from '../../state/game-state-types';

/**
 * Resolves the correct dialogue sequence ID for an NPC.
 *
 * Checks each override in order; the first override whose requiredFlag is true
 * in storyFlags wins. Falls back to defaultDialogueId if none match.
 *
 * @param defaultDialogueId  The sequence to use if no overrides match
 * @param storyFlags         Current game story flags
 * @param overrides          Optional priority-ordered list of flag → dialogue mappings
 */
export function resolveNpcDialogueId(
  defaultDialogueId: string,
  storyFlags: StoryFlags,
  overrides?: DialogueOverride[],
): string {
  if (overrides) {
    for (const override of overrides) {
      if (storyFlags[override.requiredFlag]) {
        return override.dialogueId;
      }
    }
  }
  return defaultDialogueId;
}
