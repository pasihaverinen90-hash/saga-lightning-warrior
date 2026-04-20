// src/game/data/dialogue/dialogue-data.ts
// All dialogue sequences for the first chapter slice.
// Each sequence is identified by a string id.
//
// onComplete effects are executed by dialogue/event-handler.ts after the
// final line is dismissed. Do not call state directly from here.

import type { DialogueSequence } from '../../dialogue/dialogue-types';
import { STORY_FLAGS } from '../story/story-events';

export const DIALOGUE: Record<string, DialogueSequence> = {

  // ── Town: Serelle first meeting (join event) ──────────────────────────────
  serelle_join_event: {
    id: 'serelle_join_event',
    onComplete: [
      { type: 'set_flag',              flagId:   STORY_FLAGS.SERELLE_JOINED },
      { type: 'activate_party_member', memberId: 'serelle_vaun' },
    ],
    lines: [
      {
        speaker: 'hugo',
        text: "Excuse me — are you heading north too? The road's looking pretty dangerous.",
      },
      {
        speaker: 'serelle_vaun',
        text: "...You noticed the soldiers? I've been tracking their movements for two days.",
      },
      {
        speaker: 'serelle_vaun',
        text: "Serelle Vaun. I'm an ice mage, and I have my own reasons to reach the North Pass.",
      },
      {
        speaker: 'hugo',
        text: "Hugo. I could use someone who actually knows what they're doing. Want to travel together?",
      },
      {
        speaker: 'serelle_vaun',
        text: "...Fine. But keep up. I don't slow down for stragglers.",
      },
    ],
  },

  // ── Town: Serelle after joining (post-join dialogue) ─────────────────────
  // Shown when the player talks to Serelle again after she has joined.
  serelle_travel_ready: {
    id: 'serelle_travel_ready',
    lines: [
      {
        speaker: 'serelle_vaun',
        text: "The North Pass won't investigate itself. Are you ready to move?",
      },
      {
        speaker: 'hugo',
        text: "Almost. I want to check in with the locals first.",
      },
      {
        speaker: 'serelle_vaun',
        text: "Fine. Don't take all day.",
      },
    ],
  },

  // ── Ashenveil: Kael first meeting (join event) ────────────────────────────
  kael_join_event: {
    id: 'kael_join_event',
    onComplete: [
      { type: 'set_flag',              flagId:   STORY_FLAGS.KAEL_JOINED },
      { type: 'activate_party_member', memberId: 'kael' },
    ],
    lines: [
      {
        speaker: 'kael',
        text: "Outsiders. You've got the look of people who've been moving through dangerous country. What brings you this far east?",
      },
      {
        speaker: 'hugo',
        text: "Braxtion's reach. We've been tracking his movements. What's your read on things here?",
      },
      {
        speaker: 'kael',
        text: "Bad. Patrol activity's been climbing for weeks. Ashenveil doesn't have the numbers to hold if they push east.",
      },
      {
        speaker: 'serelle_vaun',
        text: "You sound like someone who knows how to fight.",
      },
      {
        speaker: 'kael',
        text: "I know how to survive. Which is more than most people around here can say right now.",
      },
      {
        speaker: 'hugo',
        text: "Then travel with us. We're going to find out what Braxtion's actually planning.",
      },
      {
        speaker: 'kael',
        text: "...Alright. I was heading east anyway. Name's Kael.",
      },
    ],
  },

  // ── Ashenveil: Kael after joining (post-join dialogue) ────────────────────
  kael_travel_ready: {
    id: 'kael_travel_ready',
    lines: [
      {
        speaker: 'kael',
        text: "I'm ready when you are. Don't linger too long — patrols rotate at dusk.",
      },
    ],
  },

  // ── Town: Innkeeper greeting ──────────────────────────────────────────────
  innkeeper_greeting: {
    id: 'innkeeper_greeting',
    lines: [
      {
        speaker: 'innkeeper',
        text: "Welcome to the Hearthstone Inn. Rest your legs, traveler — the North Pass is no place to go tired.",
      },
    ],
  },

  // ── Town: Shopkeeper greeting ─────────────────────────────────────────────
  shopkeeper_greeting: {
    id: 'shopkeeper_greeting',
    lines: [
      {
        speaker: 'shopkeeper',
        text: "Stock up before you leave town. The soldiers have been rough on supply wagons lately.",
      },
    ],
  },

  // ── Lumen Town: post-boss-cleared reactions ───────────────────────────────
  // Gated by boss_veyr_defeated. Listed before Thornwood overrides in the
  // NPC dialogueOverrides array so they take priority once the boss is defeated.

  villager_rumor_boss_cleared: {
    id: 'villager_rumor_boss_cleared',
    lines: [
      {
        speaker: 'villager',
        text: "They're saying the North Pass is quiet again. Whatever was up there — it's gone.",
      },
      {
        speaker: 'villager',
        text: "First time in months I've slept without hearing soldiers on the road. I'd almost forgotten what that was like.",
      },
    ],
  },

  guard_patrol_boss_cleared: {
    id: 'guard_patrol_boss_cleared',
    lines: [
      {
        speaker: 'guard',
        text: "Pass is open. Council's sending a patrol up tomorrow to assess the damage.",
      },
      {
        speaker: 'guard',
        text: "Whatever you did up there — the town owes you. Don't let it go to your head.",
      },
    ],
  },

  // ── Lumen Town: post-Thornwood-cleared reactions ─────────────────────────
  // Gated by thornwood_cleared story flag via dialogueOverrides.

  villager_rumor_cleared: {
    id: 'villager_rumor_cleared',
    lines: [
      {
        speaker: 'villager',
        text: "You actually went into the Thornwood? And you're still here to tell it.",
      },
      {
        speaker: 'villager',
        text: "I heard something changed in there. The animals are quieter than they were. Maybe the forest remembers what it used to be.",
      },
    ],
  },

  guard_patrol_cleared: {
    id: 'guard_patrol_cleared',
    lines: [
      {
        speaker: 'guard',
        text: "Word came back from the scouts. Something broke in the Thornwood — the corruption's retreating.",
      },
      {
        speaker: 'guard',
        text: "Council's not ready to reopen the south road yet. But it's better than it was.",
      },
    ],
  },

  thornwood_warning_cleared: {
    id: 'thornwood_warning_cleared',
    lines: [
      {
        speaker: 'narrator',
        text: "THORNWOOD — STATUS UNDER REVIEW",
      },
      {
        speaker: 'narrator',
        text: "Lumen Town Watch: south forest passage remains restricted pending council inspection. Reduced creature activity reported.",
      },
    ],
  },

  // ── Ashenveil: post-Thornwood-cleared elder reaction ─────────────────────
  ashenveil_elder_cleared: {
    id: 'ashenveil_elder_cleared',
    lines: [
      {
        speaker: 'villager',
        text: "News reached us from Lumen Town. Someone cleared the Thornwood's heart.",
      },
      {
        speaker: 'villager',
        text: "It doesn't undo what Braxtion's done. But it's a sign the corruption isn't invincible.",
      },
    ],
  },

  // ── Town: Villager rumors ─────────────────────────────────────────────────
  villager_rumor: {
    id: 'villager_rumor',
    lines: [
      {
        speaker: 'villager',
        text: "Travelers have been disappearing on the North Pass. They say it's Braxtion's men.",
      },
      {
        speaker: 'villager',
        text: "And something's wrong with the Thornwood to the south. Used to be a quiet forest. Now you can hear things moving in there at night.",
      },
    ],
  },

  // ── Town: Guard near south exit ───────────────────────────────────────────
  guard_patrol: {
    id: 'guard_patrol',
    lines: [
      {
        speaker: 'guard',
        text: "The Thornwood is off-limits. Council closed it last week — three hunters went in, none came back.",
      },
      {
        speaker: 'guard',
        text: "Whatever's in there isn't natural. Stay on the main road if you're heading out.",
      },
    ],
  },

  // ── Lumen Town: Thornwood warning sign ───────────────────────────────────
  thornwood_warning_sign: {
    id: 'thornwood_warning_sign',
    lines: [
      {
        speaker: 'narrator',
        text: "DANGER — THORNWOOD CLOSED",
      },
      {
        speaker: 'narrator',
        text: "By order of the Lumen Town Watch: south forest passage restricted. Unnatural creature activity. Travelers proceed at own risk.",
      },
    ],
  },

  // ── Ashenveil: Notice board ────────────────────────────────────────────────
  ashenveil_notice_board: {
    id: 'ashenveil_notice_board',
    lines: [
      {
        speaker: 'narrator',
        text: "NOTICE — By order of the Ashenveil Council: East road patrols are suspended until further notice.",
      },
      {
        speaker: 'narrator',
        text: "Merchants and travelers are advised to report unusual sightings to the guard post before departing.",
      },
    ],
  },

  // ── Ashenveil: Innkeeper greeting ─────────────────────────────────────────
  ashenveil_innkeeper_greeting: {
    id: 'ashenveil_innkeeper_greeting',
    lines: [
      {
        speaker: 'innkeeper',
        text: "The Ember Road Inn. We don't get many travelers through Ashenveil these days — rest while you can.",
      },
    ],
  },

  // ── Ashenveil: Shopkeeper greeting ────────────────────────────────────────
  ashenveil_shopkeeper_greeting: {
    id: 'ashenveil_shopkeeper_greeting',
    lines: [
      {
        speaker: 'shopkeeper',
        text: "Better steel than you'll find back west. If you've been fighting through the Thornwood, it's time to upgrade.",
      },
    ],
  },

  // ── Ashenveil: Villager — unrest rumors ───────────────────────────────────
  ashenveil_villager_unrest: {
    id: 'ashenveil_villager_unrest',
    lines: [
      {
        speaker: 'villager',
        text: "Something's wrong in the hills east of here. Three merchant caravans went dark this month.",
      },
      {
        speaker: 'villager',
        text: "The militia sent scouts. None of them came back either.",
      },
    ],
  },

  // ── Ashenveil: Elder — town history ───────────────────────────────────────
  ashenveil_elder_history: {
    id: 'ashenveil_elder_history',
    lines: [
      {
        speaker: 'villager',
        text: "Ashenveil has stood for three hundred years. We've seen wars, famines, and worse.",
      },
      {
        speaker: 'villager',
        text: "But I've never seen the kind of darkness creeping out of those hills. Braxtion's reach is long.",
      },
    ],
  },

  // ── Ashenveil: Guard post warning ─────────────────────────────────────────
  ashenveil_guard_warning: {
    id: 'ashenveil_guard_warning',
    lines: [
      {
        speaker: 'guard',
        text: "Road east is closed by order of the council. Whatever you're looking for out there, it isn't worth it.",
      },
    ],
  },

  // ── Lumen City: City Hall official ───────────────────────────────────────
  lumen_mayor: {
    id: 'lumen_mayor',
    lines: [
      {
        speaker: 'villager',
        text: "The Council has been in emergency session since the north road closed. Braxtion's soldiers blocked the pass three weeks ago.",
      },
      {
        speaker: 'villager',
        text: "If you're heading that direction — be careful. We've sent two scouting parties. Neither returned.",
      },
    ],
  },

  // ── Thornwood: Grove Warden encounter ─────────────────────────────────────

  thornwood_warden_intro: {
    id: 'thornwood_warden_intro',
    lines: [
      {
        speaker: 'narrator',
        text: "At the center of the Thornwood, the trees thin into a scorched clearing. Something vast and wrong coils in the silence.",
      },
      {
        speaker: 'hugo',
        text: "That's not a regular creature. It's like the whole forest is... concentrated here.",
      },
      {
        speaker: 'serelle_vaun',
        text: "The corruption has a focal point. If we can break it, the forest might recover.",
      },
    ],
  },

  thornwood_warden_defeat: {
    id: 'thornwood_warden_defeat',
    onComplete: [
      { type: 'set_flag',  flagId:   STORY_FLAGS.THORNWOOD_CLEARED },
      { type: 'add_item',  itemId:   'healing_salve', quantity: 2 },
      { type: 'add_item',  itemId:   'ether_vial',    quantity: 1 },
      { type: 'add_gold',  amount:   80 },
    ],
    lines: [
      {
        speaker: 'narrator',
        text: "The corruption-spirit fractures and dissolves. The air in the clearing grows lighter.",
      },
      {
        speaker: 'hugo',
        text: "It's gone. The forest might actually heal from here.",
      },
      {
        speaker: 'hugo',
        text: "Found something at the edge of the clearing. Supplies — left by whoever was here before things went wrong.",
      },
    ],
  },

  // ── Boss: Shadecaster Veyr pre-battle ─────────────────────────────────────
  boss_veyr_intro: {
    id: 'boss_veyr_intro',
    lines: [
      {
        speaker: 'enemy_mage',
        text: "You've come a long way for children. Lord Braxtion's patience doesn't extend to interruptions.",
      },
      {
        speaker: 'hugo',
        text: "We're not leaving. Whatever you're doing out here ends now.",
      },
      {
        speaker: 'enemy_mage',
        text: "Bold words. Let's see if your sword matches them.",
      },
    ],
  },

  // ── Boss: Shadecaster Veyr defeated ───────────────────────────────────────
  boss_veyr_defeat: {
    id: 'boss_veyr_defeat',
    onComplete: [
      { type: 'set_flag', flagId: STORY_FLAGS.CHAPTER_1_COMPLETE },
      { type: 'set_flag', flagId: STORY_FLAGS.BOSS_VEYR_DEFEATED },
    ],
    lines: [
      {
        speaker: 'narrator',
        text: "The shadecaster falls. The North Pass grows quiet.",
      },
      {
        speaker: 'serelle_vaun',
        text: "He won't be the last. Braxtion will send more.",
      },
      {
        speaker: 'hugo',
        text: "Then we'll be ready.",
      },
    ],
  },
};
