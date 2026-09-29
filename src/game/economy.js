// Every tunable number in the game lives here. Feature code reads these values
// and never hardcodes its own. Names and items live in catalog.json.
export const ECONOMY = {
  version: 1,

  // XP to go from level L to L+1 is round(base × L^exp).
  xp: { base: 100, exp: 1.2, levelCap: 50 },
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

  rarities: {
    common: { color: "#9CA3AF", gold: 150, essence: 0, level: 0 },
    uncommon: { color: "#22C55E", gold: 450, essence: 0, level: 0 },
    rare: { color: "#3B82F6", gold: 1200, essence: 0, level: 8 },
    epic: { color: "#A855F7", gold: 2500, essence: 8, level: 15 },
    legendary: { color: "#F59E0B", gold: 5000, essence: 25, level: 20 },
    mythic: { color: "#EF4444", gold: null, essence: null, level: null },
  },
  rarityOrder: ["common", "uncommon", "rare", "epic", "legendary", "mythic"],
  slotMult: { armor: 1.5, weapon: 1.25, aura: 1.25, helm: 1, boots: 1, cape: 1 },

  // Phase 1 sells Common to Rare gear. Weapons wait for classes.
  armory: { maxRarity: "rare", sellsWeapons: false },

  tavern: { avgDays: 14, tiers: [["Snack", 50], ["Treat", 150], ["Night off", 400], ["Big purchase", 3000]], maxPrice: 1000000 },

  learning: { defaultGoalMin: 20, maxSessionMin: 600 },
  steps: { baselineDays: 14, baselineBump: 0.1, round: 500 },

  // How far back the first-day streak seed looks through your history.
  historyDays: 400,
};
