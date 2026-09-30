// Hero and item art from the art thread, keyed by catalog item ID. Worn gear has a layer in hero-data.json;
// talismans, pouches, consumables, companions, Torrent, bosses and the Golden Seed are icons in items-data.json.
// Anything not drawn yet falls back to the placeholder shapes below.
import HERO from "./hero-data.json";
import ICONS from "./items-data.json";
import { heroGrid, gearGrid, spriteSvg, lookPalette, fitScale, crop } from "./sprite.js";

const SHADE = "rgb(0 0 0 / .16)";

export const DEFAULT_LOOK = { skin: "#eab896", hair: "#4a2f1f", hairStyle: "short", body: "slim" };

// equip maps slot -> catalog item ID (or {id}). The 64px frame is drawn at the largest whole scale that fits size.
export function avatarSvg({ look = DEFAULT_LOOK, equip = {}, size = 128, label = "" } = {}) {
  const L = { ...DEFAULT_LOOK, ...look };
  const ids = Object.fromEntries(Object.entries(equip).map(([slot, v]) => [slot, typeof v === "string" ? v : v && v.id]));
  const grid = heroGrid(HERO, { equip: ids, look: L });
  return spriteSvg(grid, lookPalette(HERO.palette, L), { scale: Math.max(1, Math.floor(size / 64)), label, cls: "avatar px-sprite" });
}

// True when the art thread has drawn this item.
export const hasSprite = id => !!(HERO.gear[id] || ICONS.items[id]);

const ICON_GRID = {};
const iconGrid = id => ICONS.items[id] ? (ICON_GRID[id] || (ICON_GRID[id] = crop(ICONS.items[id].rows))) : null;

// Whole scales keep pixels square. A sprite bigger than the box (a 64px companion in a 30px slot) is shrunk to fit.
function fit(rows, pal, size) {
  const n = Math.max(rows.length, rows[0].length);
  if (n <= size) return spriteSvg(rows, pal, { scale: fitScale(rows, size) });
  const k = size / n, w = Math.round(rows[0].length * k), h = Math.round(rows.length * k);
  return spriteSvg(rows, pal, { scale: 1 }).replace(/width="\d+" height="\d+"/, `width="${w}" height="${h}"`);
}

const SLOT_ART = {
  head: c => `<path d="M8 28c0-10 7-18 16-18s16 8 16 18z" fill="${c}"/><rect x="6" y="26" width="36" height="7" rx="3.5" fill="${c}"/><rect x="6" y="26" width="36" height="7" rx="3.5" fill="${SHADE}"/>`,
  chest: c => `<path d="M14 9l5 3h10l5-3 8 7-5 8-3-2v18H14V22l-3 2-5-8z" fill="${c}"/><path d="M24 12v28" stroke="${SHADE}" stroke-width="3"/>`,
  arms: c => `<path d="M10 14h12v16l6 4v8H10z" fill="${c}"/><path d="M26 14h12v28H26v-8l6-4z" fill="${c}"/><path d="M10 20h12M26 20h12" stroke="${SHADE}" stroke-width="3"/>`,
  legs: c => `<path d="M12 6h10v22l2 12H10l2-12zM26 6h10v22l2 12H24l2-12z" fill="${c}"/><path d="M10 36h14M24 36h14" stroke="${SHADE}" stroke-width="4"/>`,
  talisman: c => `<circle cx="24" cy="26" r="13" fill="${c}"/><circle cx="24" cy="26" r="7" fill="${SHADE}"/><circle cx="24" cy="26" r="3.5" fill="${c}"/><path d="M18 8h12l-3 6h-6z" fill="${c}"/>`,
  ash: c => `<path d="M24 6c6 8 12 12 12 22a12 12 0 0 1-24 0c0-6 3-9 6-12 0 4 2 6 4 6-2-6 0-11 2-16z" fill="${c}" opacity=".85"/><circle cx="20" cy="30" r="2" fill="#fff" opacity=".8"/><circle cx="28" cy="30" r="2" fill="#fff" opacity=".8"/>`,
  npc: c => `<path d="M10 44c0-10 6-16 14-16s14 6 14 16z" fill="${c}"/><path d="M12 22c0-9 5-16 12-16s12 7 12 16c0 6-5 10-12 10s-12-4-12-10z" fill="${c}"/><path d="M16 22c0-5 4-9 8-9s8 4 8 9c0 3-4 5-8 5s-8-2-8-5z" fill="${SHADE}"/><circle cx="21" cy="21" r="1.6" fill="#fff"/><circle cx="27" cy="21" r="1.6" fill="#fff"/>`,
  mount: c => `<path d="M14 42l2-14c-4-2-6-6-4-10l6-8 4 4 10-6c6 0 10 6 8 12l-6 4-2 18h-6l1-14-6 2-1 12z" fill="${c}"/><circle cx="33" cy="15" r="1.6" fill="#1c1f2a"/><path d="M18 10l-4-6M22 12l2-6" stroke="${c}" stroke-width="3" stroke-linecap="round"/>`,
  scroll: c => `<rect x="12" y="10" width="24" height="28" rx="3" fill="#efe3c2"/><rect x="9" y="7" width="30" height="6" rx="3" fill="${c}"/><rect x="9" y="35" width="30" height="6" rx="3" fill="${c}"/><path d="M17 20h14M17 25h14M17 30h9" stroke="${SHADE}" stroke-width="2"/>`,
  flask: c => `<path d="M20 6h8v8l8 10v14a6 6 0 0 1-6 6H18a6 6 0 0 1-6-6V24l8-10z" fill="#d4dae6"/><path d="M13 27h22v11a5 5 0 0 1-5 5H18a5 5 0 0 1-5-5z" fill="#d23b3b"/><rect x="18" y="3" width="12" height="5" rx="2" fill="#8a5a2b"/>`,
  stone: c => `<path d="M24 5l14 10-4 22-10 6-10-6-4-22z" fill="${c}"/><path d="M24 5v38M10 15l14 8 14-8" stroke="${SHADE}" stroke-width="2" fill="none"/>`,
  boss: c => `<path d="M10 20l5-12 5 7 4-9 4 9 5-7 5 12z" fill="${c}"/><path d="M12 22h24v8c0 8-5 13-12 13s-12-5-12-13z" fill="${c}"/><path d="M16 29h6M26 29h6" stroke="#1c1f2a" stroke-width="3"/><path d="M12 22h24" stroke="${SHADE}" stroke-width="3"/>`,
  pouch: c => `<path d="M14 16h20l4 22a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4z" fill="${c}"/><path d="M12 12h24v6H12z" fill="${c}"/><path d="M12 18h24" stroke="${SHADE}" stroke-width="3"/><circle cx="24" cy="29" r="4" fill="${SHADE}"/>`,
};
const WEAPON_ICON = {
  sword: c => `<path d="M36 6l6 2-2 6-20 20-4-4z" fill="${c}"/><path d="M10 30l8 8M8 40l6-6" stroke="#6b4a2e" stroke-width="4" stroke-linecap="round"/>`,
  katana: c => `<path d="M40 5c2 12-6 24-20 30l-3-3c12-6 19-16 20-27z" fill="${c}"/><path d="M11 34l6 6M8 43l6-6" stroke="#2b2230" stroke-width="4" stroke-linecap="round"/>`,
  greatsword: c => `<path d="M34 4l10 2-2 10-22 22-8-8z" fill="${c}"/><path d="M8 32l10 10M6 44l7-7" stroke="#6b4a2e" stroke-width="5" stroke-linecap="round"/>`,
  curved: c => `<path d="M40 6c4 14-4 26-20 30l-2-4c13-4 20-13 18-25z" fill="${c}"/><path d="M11 35l6 6M8 43l6-6" stroke="#6b4a2e" stroke-width="4" stroke-linecap="round"/>`,
  dagger: c => `<path d="M34 12l4 2-2 4-12 12-3-3z" fill="${c}"/><path d="M16 30l6 6M12 38l6-6" stroke="#6b4a2e" stroke-width="4" stroke-linecap="round"/>`,
  club: c => `<path d="M34 6c6 0 9 5 7 10L18 40l-6-6L30 10c1-2 2-4 4-4z" fill="${c}"/>`,
  staff: c => `<path d="M12 42L36 14" stroke="#6b4a2e" stroke-width="4" stroke-linecap="round"/><circle cx="37" cy="11" r="7" fill="${c}"/>`,
  polearm: c => `<path d="M8 44L38 10" stroke="#6b4a2e" stroke-width="4" stroke-linecap="round"/><path d="M34 6l10 2-6 10-6-2z" fill="${c}"/>`,
  thrust: c => `<path d="M10 40L42 6" stroke="${c}" stroke-width="3" stroke-linecap="round"/><path d="M10 32l6 6M8 42l6-6" stroke="#6b4a2e" stroke-width="4" stroke-linecap="round"/>`,
  bow: c => `<path d="M12 6q34 18 0 36" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round"/><path d="M12 6v36" stroke="${SHADE}" stroke-width="1.5"/>`,
  seal: c => `<rect x="14" y="20" width="20" height="22" rx="6" fill="${c}"/><path d="M18 20V8M24 20V5M30 20V9" stroke="${c}" stroke-width="4" stroke-linecap="round"/>`,
};
// item is a catalog entry ({id, slot, type, kind}); bosses and currency art pass just {id}.
export function itemArt(item, color, size = 48) {
  const g = item && gearGrid(HERO, item.id);
  if (g && g.length) return fit(g, lookPalette(HERO.palette), size);
  const ic = iconGrid(item.id);
  if (ic && ic.length) return fit(ic, ICONS.items[item.id].pal, size);
  const f = item.slot === "weapon" ? WEAPON_ICON[item.kind] || WEAPON_ICON.sword : SLOT_ART[item.kind] || SLOT_ART[item.type] || SLOT_ART[item.slot] || SLOT_ART[item.id.split(".")[0]] || SLOT_ART.talisman;
  return `<svg width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true">${f(color)}</svg>`;
}
