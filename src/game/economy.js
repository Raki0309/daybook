// Every tunable number in the game lives here. Feature code reads these values
// and never hardcodes its own. Names and items live in catalog.json.
export const ECONOMY = {
  version: 2,

  // XP to go from level L to L+1 is round(base × L^exp). With every daily done (4 dailies
  // plus the all-clear), level 10 takes about 3 weeks and level 50 about a year.
  xp: { base: 85, exp: 0.8, levelCap: 99 },
  levelUp: { gold: 100, fullHeal: true },

  // Rewards per completed quest, before the verified and streak multipliers.
  earn: {
    daily: { xp: 20, gold: 20 },
    allClear: { xp: 30, gold: 20 },
    periodic: { xp: 20, gold: 20 }, // weekly and monthly tasks, times-per-week habits
    tutorial: { xp: 50, gold: 50 },
    verifiedMult: 1.25,
  },
  streakBonus: { perDay: 0.02, cap: 0.3 },

  hp: { base: 50, perLevel: 2, missDamage: 10, dailyDamageCap: 20, healPerDaily: 2 },
  downed: { goldLossPct: 0.1 },

  // Only this many scheduled dailies pay rewards each day; the rest still count for streaks and HP.
  slots: { start: 5, max: 8 },
  // Self-reported completions older than this many days before today pay nothing.
  backdateDays: 1,
  dayEnd: { default: "00:00", choices: ["00:00", "01:00", "02:00", "03:00", "04:00", "05:00"] },

  // Step sources that count as verified. Typed-in steps are self-reported.
  verifiedStepSources: ["health", "shortcut", "export"],

  // Gear is cosmetic: no rarity gives stats. Only talismans carry small perks (see talismans).
  rarities: {
    starter: { color: "#8C8577", gold: null, level: 0 },
    common: { color: "#9CA3AF", gold: 150, level: 0 },
    uncommon: { color: "#22C55E", gold: 450, level: 0 },
    rare: { color: "#3B82F6", gold: 1200, level: 8 },
    epic: { color: "#A855F7", gold: 2500, level: 15 },
    legendary: { color: "#F59E0B", gold: 5000, level: 20 },
    // About 6 months of quest Gold for a mythic weapon (20,000 × 1.25).
    mythic: { color: "#EF4444", gold: 20000, level: 30 },
  },
  rarityOrder: ["common", "uncommon", "rare", "epic", "legendary", "mythic"],
  slotMult: { chest: 1.5, weapon: 1.25, head: 1, legs: 1, arms: 0.75, talisman: 1 },

  armory: { maxRarity: "mythic", sellsWeapons: true },

  // Talisman perks add up per kind, then stop at these caps.
  talismans: {
    slotsStart: 1, slotsMax: 4,
    caps: { goldPct: 5, xpPct: 5, dmgPct: 50, maxHp: 60, heal: 4, streakRate: 1 },
    pouch: { gold: 5000, level: 20 }, // the one pouch the Armory sells; the rest drop from bosses
  },

  // Spirit Ashes (bought, then awakened by completing quests), NPC companions (unlocked by a
  // long streak of one quest type) and Torrent. Ashes cost their rarity's Gold price.
  stable: {
    awakenQuests: { common: 10, uncommon: 20, rare: 35, epic: 50, legendary: 75 },
    // Bond: points per completed daily while summoned, plus a bonus on all-clear days.
    // levels[i] is the total needed for +(i+1); +10 takes about two months of full days.
    bond: { perQuest: 1, allClear: 3, levels: [10, 25, 45, 70, 100, 140, 190, 250, 320, 400] },
    npcs: {
      "npc.alexander": { streak: "steps", days: 100 },
      "npc.sellen": { streak: "learning", days: 60 },
      "npc.millicent": { streak: "discipline", days: 100 },
      "npc.blaidd": { streak: "workouts", days: 60 },
    },
    torrent: { level: 10 },
  },

  // Boss fights come in a later phase; their level gates live here now so the Armory can say
  // where each drop comes from.
  bosses: {
    "boss.radahn": { level: 50 },
    "boss.rykard": { level: 60 },
    "boss.malenia": { level: 70 },
  },

  tavern: { avgDays: 14, tiers: [["Snack", 50], ["Treat", 150], ["Night off", 400], ["Big purchase", 3000]], maxPrice: 1000000 },

  learning: { defaultGoalMin: 20, maxSessionMin: 600 },
  steps: { baselineDays: 14, baselineBump: 0.1, round: 500 },

  // How far back the first-day streak seed looks through your history.
  historyDays: 400,
};
