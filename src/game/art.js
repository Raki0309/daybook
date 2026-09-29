// Placeholder art: the hero and item icons are layered shapes tinted by rarity color,
// until real assets exist. Pure functions that return SVG strings.
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

// equip maps slot -> {color, rarity} for what's worn.
export function avatarSvg({ look = DEFAULT_LOOK, equip = {}, size = 120, label = "" } = {}) {
  const L = { ...DEFAULT_LOOK, ...look };
  const broad = L.body === "broad"; const tx = broad ? 35 : 39, tw = broad ? 50 : 42;
  const armor = equip.armor ? equip.armor.color : "#5b6b9a";
  const pants = "#3b4256";
  const boots = equip.boots ? equip.boots.color : "#6b4a2e";
  let g = "";
  if (equip.aura) g += `<circle cx="60" cy="72" r="56" fill="${equip.aura.color}" opacity=".18"/><circle cx="60" cy="72" r="44" fill="${equip.aura.color}" opacity=".16"/>`
    + [[18, 40], [100, 34], [14, 96], [104, 100], [60, 10]].map(([x, y]) => `<path d="M${x} ${y - 5}l1.6 3.4 3.4 1.6-3.4 1.6-1.6 3.4-1.6-3.4-3.4-1.6 3.4-1.6z" fill="${equip.aura.color}"/>`).join("");
  if (equip.cape) g += `<path d="M${tx + 2} 54h${tw - 4}l12 72H${tx - 10}z" fill="${equip.cape.color}"/><path d="M${tx + 2} 54h${tw - 4}l12 72H${tx - 10}z" fill="${SHADE}"/>`;
  // legs and boots
  g += `<rect x="47" y="96" width="11" height="26" rx="3" fill="${pants}"/><rect x="62" y="96" width="11" height="26" rx="3" fill="${pants}"/>`;
  g += `<path d="M45 116h14v12H41a4 4 0 0 1 4-4z" fill="${boots}" stroke="${LINE}"/><path d="M61 116h14v8a4 4 0 0 1 4 4H61z" fill="${boots}" stroke="${LINE}"/>`;
  // arms, neck, torso
  g += `<rect x="${tx - 9}" y="56" width="10" height="36" rx="5" fill="${L.skin}"/><rect x="${tx + tw - 1}" y="56" width="10" height="36" rx="5" fill="${L.skin}"/>`;
  g += `<rect x="${tx - 9}" y="54" width="10" height="16" rx="5" fill="${armor}"/><rect x="${tx + tw - 1}" y="54" width="10" height="16" rx="5" fill="${armor}"/>`;
  g += `<rect x="55" y="46" width="10" height="10" fill="${L.skin}"/>`;
  g += `<rect x="${tx}" y="52" width="${tw}" height="48" rx="10" fill="${armor}" stroke="${LINE}"/>`;
  g += equip.armor ? `<path d="M${tx + 6} 64h${tw - 12}M60 56v40" stroke="${SHADE}" stroke-width="3"/>` : `<path d="M${tx} 90h${tw}" stroke="${SHADE}" stroke-width="4"/>`;
  // head, face, hair
  g += `<circle cx="60" cy="36" r="17" fill="${L.skin}"/>`;
  g += `<circle cx="54" cy="37" r="1.9" fill="#1c1f2a"/><circle cx="66" cy="37" r="1.9" fill="#1c1f2a"/><path d="M55 44q5 4 10 0" fill="none" stroke="#1c1f2a" stroke-width="1.6" stroke-linecap="round"/>`;
  g += hair(L.hairStyle, L.hair);
  if (equip.helm) g += `<path d="M41 34c0-12 8-20 19-20s19 8 19 20z" fill="${equip.helm.color}" stroke="${LINE}"/><rect x="40" y="31" width="40" height="6" rx="3" fill="${equip.helm.color}"/><rect x="40" y="31" width="40" height="6" rx="3" fill="${SHADE}"/>`;
  if (equip.weapon) g += `<path d="M${tx + tw + 12} 94l14-44 4 1-12 45z" fill="${equip.weapon.color}" stroke="${LINE}"/><rect x="${tx + tw + 6}" y="90" width="14" height="4" rx="2" fill="#6b4a2e"/>`;
  const aria = label ? `role="img" aria-label="${label.replace(/"/g, "&quot;")}"` : `aria-hidden="true"`;
  return `<svg class="avatar" width="${size}" height="${Math.round(size * 140 / 120)}" viewBox="0 0 120 140" ${aria}>${g}</svg>`;
}

const SLOT_ART = {
  helm: c => `<path d="M8 28c0-10 7-18 16-18s16 8 16 18z" fill="${c}"/><rect x="6" y="26" width="36" height="7" rx="3.5" fill="${c}"/><rect x="6" y="26" width="36" height="7" rx="3.5" fill="${SHADE}"/>`,
  armor: c => `<path d="M14 9l5 3h10l5-3 8 7-5 8-3-2v18H14V22l-3 2-5-8z" fill="${c}"/><path d="M24 12v28" stroke="${SHADE}" stroke-width="3"/>`,
  boots: c => `<path d="M12 8h12v20l12 4c3 1 5 3 5 6v2H8V12a4 4 0 0 1 4-4z" fill="${c}"/><path d="M8 34h33" stroke="${SHADE}" stroke-width="4"/>`,
  cape: c => `<path d="M14 8h20l8 34H6z" fill="${c}"/><path d="M14 8h20l-2 6H16z" fill="${SHADE}"/>`,
  aura: c => `<circle cx="24" cy="24" r="16" fill="${c}" opacity=".35"/><circle cx="24" cy="24" r="9" fill="${c}"/>` + [[24, 3], [24, 45], [3, 24], [45, 24]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.5" fill="${c}"/>`).join(""),
  weapon: c => `<path d="M34 6l6 2-2 6-20 20-4-4z" fill="${c}"/><path d="M10 30l8 8M8 40l6-6" stroke="#6b4a2e" stroke-width="4" stroke-linecap="round"/>`,
};
export function itemArt(item, color, size = 48) {
  const f = SLOT_ART[item.slot] || SLOT_ART.aura;
  return `<svg width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true">${f(color)}</svg>`;
}
