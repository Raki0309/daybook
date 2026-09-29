// Placeholder art: the hero and item icons are layered shapes tinted by rarity color,
// until the pixel sprites from the art thread replace them (keyed by catalog item ID). Pure functions that return SVG strings.
const SHADE = "rgb(0 0 0 / .16)";
const LINE = "rgb(0 0 0 / .22)";

export const DEFAULT_LOOK = { skin: "#eab896", hair: "#4a2f1f", hairStyle: "short", body: "slim" };

function hair(style, c) {
  if (style === "none") return "";
  const cap = `<path d="M42 36c0-12 8-20 18-20s18 8 18 20c-3-6-9-9-18-9s-15 3-18 9z" fill="${c}"/>`;
  if (style === "long") return `<path d="M41 38c0-14 8-22 19-22s19 8 19 22v18c-3 2-6 2-8 0V38H49v18c-2 2-5 2-8 0z" fill="${c}"/>`;
  if (style === "bun") return cap + `<circle cx="60" cy="14" r="7" fill="${c}"/>`;
  return cap;
}

// Weapon silhouettes by kind, held in the right hand. (x, y) is the grip.
const WEAPON = {
  sword: (x, c) => `<path d="M${x + 1} 92l3-46h4l3 46z" fill="${c}" stroke="${LINE}"/><rect x="${x - 4}" y="90" width="18" height="4" rx="2" fill="#6b4a2e"/>`,
  katana: (x, c) => `<path d="M${x + 3} 92c-2-16 1-32 8-48l3 1c-6 16-8 31-7 47z" fill="${c}" stroke="${LINE}"/><rect x="${x}" y="90" width="12" height="4" rx="2" fill="#2b2230"/>`,
  greatsword: (x, c) => `<path d="M${x - 1} 94l2-60h10l2 60z" fill="${c}" stroke="${LINE}"/><rect x="${x - 7}" y="92" width="26" height="5" rx="2" fill="#6b4a2e"/>`,
  curved: (x, c) => `<path d="M${x + 3} 92c10-12 14-28 10-44l4-1c5 17 0 34-11 46z" fill="${c}" stroke="${LINE}"/><rect x="${x - 2}" y="90" width="14" height="4" rx="2" fill="#6b4a2e"/>`,
  dagger: (x, c) => `<path d="M${x + 3} 92l2-18h3l2 18z" fill="${c}" stroke="${LINE}"/><rect x="${x}" y="90" width="12" height="3" rx="1.5" fill="#6b4a2e"/>`,
  club: (x, c) => `<path d="M${x + 3} 94l-1-40c0-5 10-5 10 0l-2 40z" fill="${c}" stroke="${LINE}"/>`,
  staff: (x, c) => `<rect x="${x + 4}" y="40" width="4" height="62" rx="2" fill="#6b4a2e"/><circle cx="${x + 6}" cy="38" r="6" fill="${c}" stroke="${LINE}"/>`,
  polearm: (x, c) => `<rect x="${x + 4}" y="34" width="4" height="70" rx="2" fill="#6b4a2e"/><path d="M${x + 8} 36l10 6-10 10z" fill="${c}" stroke="${LINE}"/><path d="M${x + 6} 24l3 10h-6z" fill="${c}"/>`,
  thrust: (x, c) => `<path d="M${x + 5} 92l1-52 1 52z" fill="${c}" stroke="${c}" stroke-width="2.4"/><rect x="${x - 2}" y="90" width="16" height="4" rx="2" fill="#6b4a2e"/>`,
  bow: (x, c) => `<path d="M${x + 2} 46q14 26 0 52" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round"/><path d="M${x + 2} 46v52" stroke="${LINE}" stroke-width="1"/>`,
  seal: (x, c) => `<rect x="${x + 1}" y="74" width="12" height="18" rx="4" fill="${c}" stroke="${LINE}"/><path d="M${x + 4} 74v-8M${x + 8} 74v-10M${x + 12} 74v-7" stroke="${c}" stroke-width="3" stroke-linecap="round"/>`,
};

// equip maps slot (head, chest, arms, legs, weapon) -> {color, rarity, kind} for what's worn.
export function avatarSvg({ look = DEFAULT_LOOK, equip = {}, size = 120, label = "" } = {}) {
  const L = { ...DEFAULT_LOOK, ...look };
  const broad = L.body === "broad"; const tx = broad ? 35 : 39, tw = broad ? 50 : 42;
  const chest = equip.chest ? equip.chest.color : "#8a7f6e";
  const legs = equip.legs ? equip.legs.color : "#4a4236";
  const arms = equip.arms ? equip.arms.color : null;
  let g = "";
  if (equip.chest && equip.chest.rarity !== "common") g += `<path d="M${tx + 2} 54h${tw - 4}l10 64H${tx - 8}z" fill="${chest}"/><path d="M${tx + 2} 54h${tw - 4}l10 64H${tx - 8}z" fill="${SHADE}"/>`;
  // legs and greaves
  g += `<rect x="47" y="96" width="11" height="26" rx="3" fill="${legs}"/><rect x="62" y="96" width="11" height="26" rx="3" fill="${legs}"/>`;
  g += `<path d="M45 116h14v12H41a4 4 0 0 1 4-4z" fill="${equip.legs ? legs : "#3a2f24"}" stroke="${LINE}"/><path d="M61 116h14v8a4 4 0 0 1 4 4H61z" fill="${equip.legs ? legs : "#3a2f24"}" stroke="${LINE}"/>`;
  // arms (gauntlets over the forearm), neck, torso
  g += `<rect x="${tx - 9}" y="56" width="10" height="36" rx="5" fill="${L.skin}"/><rect x="${tx + tw - 1}" y="56" width="10" height="36" rx="5" fill="${L.skin}"/>`;
  g += `<rect x="${tx - 9}" y="54" width="10" height="16" rx="5" fill="${chest}"/><rect x="${tx + tw - 1}" y="54" width="10" height="16" rx="5" fill="${chest}"/>`;
  if (arms) g += `<rect x="${tx - 10}" y="72" width="12" height="20" rx="4" fill="${arms}" stroke="${LINE}"/><rect x="${tx + tw - 2}" y="72" width="12" height="20" rx="4" fill="${arms}" stroke="${LINE}"/>`;
  g += `<rect x="55" y="46" width="10" height="10" fill="${L.skin}"/>`;
  g += `<rect x="${tx}" y="52" width="${tw}" height="48" rx="10" fill="${chest}" stroke="${LINE}"/>`;
  g += equip.chest ? `<path d="M${tx + 6} 64h${tw - 12}M60 56v40" stroke="${SHADE}" stroke-width="3"/>` : `<path d="M${tx} 90h${tw}" stroke="${SHADE}" stroke-width="4"/>`;
  // head, face, hair, helm
  g += `<circle cx="60" cy="36" r="17" fill="${L.skin}"/>`;
  g += `<circle cx="54" cy="37" r="1.9" fill="#1c1f2a"/><circle cx="66" cy="37" r="1.9" fill="#1c1f2a"/><path d="M55 44q5 4 10 0" fill="none" stroke="#1c1f2a" stroke-width="1.6" stroke-linecap="round"/>`;
  g += hair(L.hairStyle, L.hair);
  if (equip.head) g += `<path d="M41 34c0-12 8-20 19-20s19 8 19 20z" fill="${equip.head.color}" stroke="${LINE}"/><rect x="40" y="31" width="40" height="6" rx="3" fill="${equip.head.color}"/><rect x="40" y="31" width="40" height="6" rx="3" fill="${SHADE}"/>`;
  if (equip.weapon) g += (WEAPON[equip.weapon.kind] || WEAPON.sword)(tx + tw + 4, equip.weapon.color);
  const aria = label ? `role="img" aria-label="${label.replace(/"/g, "&quot;")}"` : `aria-hidden="true"`;
  return `<svg class="avatar" width="${size}" height="${Math.round(size * 140 / 120)}" viewBox="0 0 120 140" ${aria}>${g}</svg>`;
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
export function itemArt(item, color, size = 48) {
  const f = item.slot === "weapon" ? WEAPON_ICON[item.kind] || WEAPON_ICON.sword : SLOT_ART[item.kind] || SLOT_ART[item.type] || SLOT_ART[item.slot] || SLOT_ART.talisman;
  return `<svg width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true">${f(color)}</svg>`;
}
