// Every tunable number in the game lives here. Feature code reads these values
// and never hardcodes its own. Names and items live in catalog.json.
export const ECONOMY = {
  version: 2,

  // XP to go from level L to L+1 is round(base × L^exp). With every daily done (4 dailies
  // plus the all-clear) and both weekly bounties, level 10 takes about 3 weeks and level 50
  // about a year.
  xp: { base: 100, exp: 0.8, levelCap: 99 },
  levelUp: { gold: 100, fullHeal: true, essenceEvery: 5 }, // +1 Golden Seed every 5 levels

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
    // About 6 months of full-effort Gold for a mythic weapon (28,000 × 1.25).
    mythic: { color: "#EF4444", gold: 28000, level: 30 },
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

  // Consumables and upgrades from the Armory's Items section, bought with Gold.
  items: {
    "item.scroll-of-grace": { gold: 300, hold: 2 }, // a rest day: no HP lost and no streak broken
    "item.flask-of-crimson-tears": { gold: 100, hold: 3, hp: 25 },
    "item.memory-stone": { gold: 1500, hold: 3 }, // +1 reward-earning daily slot, for good
  },
  // Rekindle a streak broken in the last 2 days, for Golden Seeds (Essence), once a month.
  rekindle: { essence: 15, withinDays: 2, cooldownDays: 30 },
  // Two weekly bounties, picked from the ones your quests make possible and scaled to them.
  bounties: {
    perWeek: 2, reward: { xp: 100, gold: 150, essence: 1 },
    steps: { ofGoalWeek: 0.9, round: 5000 }, // 90% of a week at your step goal
    learning: { days: 5 },
    allclear: { days: 5 },
    quests: { ofScheduled: 0.8 },
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

  // Achievements (trophies): each pays once, the first time its metric reaches n, and stays earned.
  // metric: streak (overall best), streak.<type> (best quest-type streak), level, quests, steps, workouts,
  // learnHours, talismans, ashes. Lifetime counts start at the game's first day.
  achievements: {
    "ach.streak-3": { metric: "streak", n: 3, gold: 50 },
    "ach.streak-7": { metric: "streak", n: 7, gold: 150 },
    "ach.streak-14": { metric: "streak", n: 14, gold: 300 },
    "ach.streak-30": { metric: "streak", n: 30, essence: 5 },
    "ach.streak-60": { metric: "streak", n: 60, essence: 8 },
    "ach.streak-100": { metric: "streak", n: 100, essence: 15 },
    "ach.streak-180": { metric: "streak", n: 180, essence: 25 },
    "ach.streak-365": { metric: "streak", n: 365, essence: 50 },
    "ach.streak-730": { metric: "streak", n: 730, essence: 100 },
    "ach.steps-streak-7": { metric: "streak.steps", n: 7, gold: 150 },
    "ach.steps-streak-30": { metric: "streak.steps", n: 30, gold: 400 },
    "ach.steps-streak-100": { metric: "streak.steps", n: 100, essence: 5 },
    "ach.steps-streak-365": { metric: "streak.steps", n: 365, essence: 15 },
    "ach.workouts-streak-12": { metric: "streak.workouts", n: 12, gold: 150 },
    "ach.workouts-streak-36": { metric: "streak.workouts", n: 36, gold: 400 },
    "ach.workouts-streak-78": { metric: "streak.workouts", n: 78, essence: 5 },
    "ach.workouts-streak-156": { metric: "streak.workouts", n: 156, essence: 15 },
    "ach.learning-streak-7": { metric: "streak.learning", n: 7, gold: 150 },
    "ach.learning-streak-30": { metric: "streak.learning", n: 30, gold: 400 },
    "ach.learning-streak-100": { metric: "streak.learning", n: 100, essence: 5 },
    "ach.learning-streak-365": { metric: "streak.learning", n: 365, essence: 15 },
    "ach.discipline-streak-7": { metric: "streak.discipline", n: 7, gold: 150 },
    "ach.discipline-streak-30": { metric: "streak.discipline", n: 30, gold: 400 },
    "ach.discipline-streak-100": { metric: "streak.discipline", n: 100, essence: 5 },
    "ach.discipline-streak-365": { metric: "streak.discipline", n: 365, essence: 15 },
    "ach.first-quest": { metric: "quests", n: 1, gold: 25 },
    "ach.level-10": { metric: "level", n: 10, gold: 200 },
    "ach.level-25": { metric: "level", n: 25, essence: 5 },
    "ach.level-50": { metric: "level", n: 50, essence: 25 },
    "ach.quests-100": { metric: "quests", n: 100, gold: 200 },
    "ach.quests-1000": { metric: "quests", n: 1000, essence: 5 },
    "ach.quests-5000": { metric: "quests", n: 5000, essence: 25 },
    "ach.steps-100k": { metric: "steps", n: 100000, gold: 200 },
    "ach.steps-1m": { metric: "steps", n: 1000000, essence: 5 },
    "ach.steps-10m": { metric: "steps", n: 10000000, essence: 25 },
    "ach.workouts-50": { metric: "workouts", n: 50, gold: 200 },
    "ach.workouts-250": { metric: "workouts", n: 250, essence: 5 },
    "ach.workouts-1000": { metric: "workouts", n: 1000, essence: 25 },
    "ach.learning-10": { metric: "learnHours", n: 10, gold: 200 },
    "ach.learning-100": { metric: "learnHours", n: 100, essence: 5 },
    "ach.learning-500": { metric: "learnHours", n: 500, essence: 25 },
    "ach.talismans-5": { metric: "talismans", n: 5, essence: 5 },
    "ach.ashes-3": { metric: "ashes", n: 3, essence: 5 },
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
