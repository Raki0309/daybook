// Pixel sprite helpers for the app. Plain ES module, no dependencies.
// Sprites are arrays of strings, one char per pixel ('.' = clear); chars index a palette of hex colors.
// Hero layers come from hero-data.json, keyed by catalog item ID.

const hex2rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const shade = (h, k) => "#" + hex2rgb(h).map(v => Math.round(v * (1 - k)).toString(16).padStart(2, "0")).join("");

// Palette for one hero's look: skin (f) and hair (h) colors, with their shadows (F, H) derived.
export function lookPalette(palette, { skin = "#d9a47c", hair = "#4a2f1f" } = {}) {
  return { ...palette, f: skin, F: shade(skin, 0.24), h: hair, H: shade(hair, 0.38) };
}

// Broad build: from row 24 down, torso columns are duplicated so arms and legs sit n pixels further out.
export function widen(rows, n, fromRow = 24) {
  if (!n) return rows;
  return rows.map((row, y) => {
    if (y < fromRow) return row;
    const left = row.slice(0, 32), right = row.slice(32);
    return left.slice(n, 25) + left[25].repeat(n) + left.slice(25) + right.slice(0, 7) + right[6].repeat(n) + right.slice(7, 32 - n);
  });
}
const shiftX = (rows, dx) => rows.map(r => dx < 0 ? r.slice(-dx) + ".".repeat(-dx) : ".".repeat(dx) + r.slice(0, r.length - dx));

export function stack(layers) {
  const out = layers[0].map(r => r.split(""));
  for (const L of layers.slice(1)) L.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] !== ".") out[y][x] = r[x]; });
  return out.map(r => r.join(""));
}

const ORDER = ["legs", "arms", "chest", "weapon", "head"];
// equip: { head, chest, arms, legs, weapon } -> catalog item IDs. look: { hairStyle, body } as in catalog.looks.
// Items without a layer yet are skipped, so the hero never breaks on new catalog entries.
export function heroGrid(data, { equip = {}, look = {} } = {}) {
  const n = look.body === "broad" ? 2 : 0;
  const hair = equip.head && data.gear[equip.head] ? "none" : look.hairStyle || "short";
  const layers = [widen(data.body, n), data.hair[hair] || data.hair.none];
  for (const slot of ORDER) {
    const g = equip[slot] && data.gear[equip[slot]];
    if (g) layers.push(slot === "weapon" ? shiftX(g, -n) : widen(g, n));
  }
  return stack(layers);
}

// Trim clear rows and columns.
export function crop(rows) {
  let x0 = Infinity, x1 = -1, y0 = Infinity, y1 = -1;
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] !== ".") { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } });
  return y1 < 0 ? [] : rows.slice(y0, y1 + 1).map(r => r.slice(x0, x1 + 1));
}

// Shop and inventory icon for a gear piece: the layer cropped; arms and legs show one side only.
export function gearGrid(data, id) {
  const g = data.gear[id];
  if (!g) return null;
  return crop(/\.(arms|legs)\./.test(id) ? g.map(r => r.slice(0, 32)) : g);
}

// SVG string with horizontal runs merged. Scale must be a whole number so pixels stay square.
export function spriteSvg(rows, pal, { scale = 2, label = "", cls = "px-sprite" } = {}) {
  const h = rows.length, w = h ? rows[0].length : 0;
  let rects = "";
  rows.forEach((row, y) => {
    for (let x = 0; x < w;) {
      const ch = row[x]; if (ch === ".") { x++; continue; }
      let e = x; while (e + 1 < w && row[e + 1] === ch) e++;
      rects += `<rect x="${x}" y="${y}" width="${e - x + 1}" height="1" fill="${pal[ch]}"/>`;
      x = e + 1;
    }
  });
  const aria = label ? `role="img" aria-label="${label.replace(/"/g, "&quot;")}"` : `aria-hidden="true"`;
  return `<svg class="${cls}" width="${w * scale}" height="${h * scale}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" ${aria}>${rects}</svg>`;
}

// Largest whole scale that fits a box.
export const fitScale = (rows, box, max = 4) => Math.max(1, Math.min(max, Math.floor(box / Math.max(rows.length, rows[0]?.length || 1))));
