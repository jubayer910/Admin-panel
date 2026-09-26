// Draws the demo's artwork as SVG: project covers (dashboards, apps, web
// pages, brand boards, motion frames), studio "photos", client wordmarks,
// avatars, award ribbons and plan icons. Everything is made up and drawn
// here, so the repo carries no one else's images.
//
//   node scripts/make-art.mjs            → scripts/art/*.svg + scripts/art/manifest.json
//   node scripts/render-art.mjs          → public/media/demo/* (covers, photos and
//                                          avatars rendered to WebP; the rest stay SVG)

import { mkdirSync, rmSync, writeFileSync } from "node:fs";

const OUT = "scripts/art";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

/* a small seeded random, so the art is the same on every run */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (s) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

const PALETTES = [
  ["#0f172a", "#6366f1", "#a5b4fc", "#eef2ff"],
  ["#052e16", "#16a34a", "#86efac", "#f0fdf4"],
  ["#431407", "#ea580c", "#fdba74", "#fff7ed"],
  ["#1e1b4b", "#8b5cf6", "#c4b5fd", "#f5f3ff"],
  ["#082f49", "#0ea5e9", "#7dd3fc", "#f0f9ff"],
  ["#4c0519", "#e11d48", "#fda4af", "#fff1f2"],
  ["#1c1917", "#d6a24a", "#f3dfb2", "#fbf7ef"],
  ["#042f2e", "#14b8a6", "#99f6e4", "#f0fdfa"],
  ["#18181b", "#f43f5e", "#fecdd3", "#fafafa"],
  ["#172554", "#3b82f6", "#bfdbfe", "#eff6ff"],
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const FONT = "font-family=\"Inter, 'Helvetica Neue', Arial, sans-serif\"";

const manifest = [];
function save(key, svg, meta) {
  writeFileSync(`${OUT}/${key.replace(/\//g, "__")}.svg`, svg);
  manifest.push({ key, ...meta });
}

/* ---------------------------------------------------------------- covers */

function lines(r, x, y, w, count, gap, color, h = 10) {
  let out = "";
  for (let i = 0; i < count; i++) {
    const lw = w * (0.45 + r() * 0.55);
    out += `<rect x="${x}" y="${y + i * gap}" width="${lw.toFixed(0)}" height="${h}" rx="${h / 2}" fill="${color}"/>`;
  }
  return out;
}

function chart(r, x, y, w, h, color, fill) {
  const n = 14;
  let pts = [];
  let v = 0.5;
  for (let i = 0; i < n; i++) {
    v = Math.min(0.95, Math.max(0.1, v + (r() - 0.42) * 0.25));
    pts.push([x + (w / (n - 1)) * i, y + h - v * h]);
  }
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const area = `${d} L${x + w} ${y + h} L${x} ${y + h} Z`;
  return `<path d="${area}" fill="${fill}"/><path d="${d}" fill="none" stroke="${color}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>`;
}

function bars(r, x, y, w, h, color, n = 9) {
  const bw = w / n - 14;
  let out = "";
  for (let i = 0; i < n; i++) {
    const bh = h * (0.25 + r() * 0.75);
    out += `<rect x="${(x + i * (bw + 14)).toFixed(0)}" y="${(y + h - bh).toFixed(0)}" width="${bw.toFixed(0)}" height="${bh.toFixed(0)}" rx="6" fill="${color}" opacity="${(0.55 + r() * 0.45).toFixed(2)}"/>`;
  }
  return out;
}

function dashboard(r, [dark, accent, soft, pale], title) {
  let s = `<rect width="1600" height="1200" fill="${pale}"/>`;
  s += `<rect x="120" y="110" width="1360" height="980" rx="28" fill="#ffffff" stroke="#e5e7eb" stroke-width="2"/>`;
  s += `<rect x="120" y="110" width="260" height="980" rx="28" fill="${dark}"/><rect x="352" y="110" width="28" height="980" fill="${dark}"/>`;
  s += `<circle cx="178" cy="176" r="22" fill="${accent}"/>`;
  s += lines(r, 160, 250, 170, 8, 56, "rgba(255,255,255,0.22)", 14);
  s += `<rect x="150" y="${250 + Math.floor(r() * 5) * 56 - 18}" width="200" height="50" rx="12" fill="rgba(255,255,255,0.10)"/>`;
  s += `<text x="430" y="190" ${FONT} font-size="40" font-weight="600" fill="${dark}">${esc(title)}</text>`;
  s += lines(r, 430, 222, 380, 1, 0, "#e5e7eb", 14);
  for (let i = 0; i < 4; i++) {
    const x = 430 + i * 262;
    s += `<rect x="${x}" y="280" width="238" height="150" rx="18" fill="${i === 0 ? accent : "#f8fafc"}" stroke="#eef0f3" stroke-width="2"/>`;
    s += `<rect x="${x + 24}" y="310" width="90" height="12" rx="6" fill="${i === 0 ? "rgba(255,255,255,0.6)" : "#cbd5e1"}"/>`;
    s += `<text x="${x + 24}" y="385" ${FONT} font-size="44" font-weight="700" fill="${i === 0 ? "#ffffff" : dark}">${Math.round(r() * 900 + 40)}${i === 3 ? "%" : "k"}</text>`;
  }
  s += `<rect x="430" y="460" width="660" height="330" rx="18" fill="#f8fafc" stroke="#eef0f3" stroke-width="2"/>`;
  s += chart(r, 470, 520, 580, 230, accent, soft + "66");
  s += `<rect x="1116" y="460" width="310" height="330" rx="18" fill="#f8fafc" stroke="#eef0f3" stroke-width="2"/>`;
  s += bars(r, 1146, 520, 260, 230, accent, 6);
  for (let i = 0; i < 4; i++) {
    const y = 820 + i * 62;
    s += `<rect x="430" y="${y}" width="996" height="48" rx="10" fill="${i % 2 ? "#ffffff" : "#f8fafc"}"/>`;
    s += `<circle cx="462" cy="${y + 24}" r="12" fill="${soft}"/>`;
    s += lines(r, 492, y + 18, 260, 1, 0, "#cbd5e1", 12);
    s += `<rect x="1290" y="${y + 12}" width="100" height="24" rx="12" fill="${soft}"/>`;
  }
  return s;
}

function phone(r, x, y, [dark, accent, soft], scale = 1, tilt = 0) {
  const w = 300 * scale;
  const h = 620 * scale;
  let s = `<g transform="rotate(${tilt} ${x + w / 2} ${y + h / 2})">`;
  s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${46 * scale}" fill="${dark}"/>`;
  s += `<rect x="${x + 12 * scale}" y="${y + 12 * scale}" width="${w - 24 * scale}" height="${h - 24 * scale}" rx="${36 * scale}" fill="#ffffff"/>`;
  s += `<rect x="${x + w / 2 - 44 * scale}" y="${y + 26 * scale}" width="${88 * scale}" height="${22 * scale}" rx="${11 * scale}" fill="${dark}"/>`;
  s += `<rect x="${x + 36 * scale}" y="${y + 90 * scale}" width="${w - 72 * scale}" height="${150 * scale}" rx="${22 * scale}" fill="${accent}"/>`;
  s += `<circle cx="${x + 80 * scale}" cy="${y + 150 * scale}" r="${24 * scale}" fill="rgba(255,255,255,0.35)"/>`;
  s += lines(r, x + 36 * scale, y + 270 * scale, w - 72 * scale, 3, 34 * scale, "#e2e8f0", 14 * scale);
  for (let i = 0; i < 3; i++) {
    const yy = y + (390 + i * 66) * scale;
    s += `<rect x="${x + 36 * scale}" y="${yy}" width="${w - 72 * scale}" height="${52 * scale}" rx="${14 * scale}" fill="#f8fafc"/>`;
    s += `<rect x="${x + 50 * scale}" y="${yy + 12 * scale}" width="${28 * scale}" height="${28 * scale}" rx="${8 * scale}" fill="${soft}"/>`;
  }
  return s + "</g>";
}

function mobile(r, pal) {
  const [dark, accent, soft, pale] = pal;
  let s = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${soft}"/><stop offset="1" stop-color="${pale}"/></linearGradient></defs>`;
  s += `<rect width="1600" height="1200" fill="url(#g)"/>`;
  s += `<circle cx="${300 + r() * 300}" cy="${260 + r() * 200}" r="260" fill="${accent}" opacity="0.18"/>`;
  s += phone(r, 250, 330, pal, 1.05, -8);
  s += phone(r, 640, 220, pal, 1.2, 0);
  s += phone(r, 1090, 330, pal, 1.05, 8);
  s += `<rect x="0" y="1120" width="1600" height="80" fill="${dark}" opacity="0.06"/>`;
  return s;
}

function web(r, [dark, accent, soft, pale], title) {
  let s = `<rect width="1600" height="1200" fill="${dark}"/>`;
  s += `<rect x="140" y="120" width="1320" height="960" rx="24" fill="${pale}"/>`;
  s += `<rect x="140" y="120" width="1320" height="64" rx="24" fill="#ffffff"/><rect x="140" y="160" width="1320" height="24" fill="#ffffff"/>`;
  for (let i = 0; i < 3; i++) s += `<circle cx="${184 + i * 30}" cy="152" r="9" fill="${["#f87171", "#fbbf24", "#34d399"][i]}"/>`;
  s += `<rect x="560" y="138" width="480" height="28" rx="14" fill="#f1f5f9"/>`;
  s += `<rect x="220" y="230" width="44" height="44" rx="12" fill="${accent}"/>`;
  for (let i = 0; i < 4; i++) s += `<rect x="${900 + i * 110}" y="244" width="80" height="14" rx="7" fill="#cbd5e1"/>`;
  s += `<rect x="1230" y="232" width="150" height="40" rx="20" fill="${dark}"/>`;
  s += `<text x="220" y="430" ${FONT} font-size="78" font-weight="700" fill="${dark}" letter-spacing="-2">${esc(title.split(" ")[0])}</text>`;
  s += `<text x="220" y="515" ${FONT} font-size="78" font-weight="700" fill="${accent}" letter-spacing="-2">made simple.</text>`;
  s += lines(r, 220, 570, 520, 3, 34, "#cbd5e1", 16);
  s += `<rect x="220" y="700" width="220" height="64" rx="32" fill="${dark}"/><rect x="460" y="700" width="180" height="64" rx="32" fill="none" stroke="${dark}" stroke-width="3"/>`;
  s += `<rect x="860" y="340" width="520" height="460" rx="28" fill="${soft}"/>`;
  s += `<circle cx="1120" cy="560" r="150" fill="${accent}" opacity="0.8"/><rect x="930" y="690" width="380" height="70" rx="18" fill="#ffffff" opacity="0.9"/>`;
  for (let i = 0; i < 3; i++) {
    const x = 220 + i * 390;
    s += `<rect x="${x}" y="850" width="360" height="190" rx="20" fill="#ffffff"/><rect x="${x + 28}" y="880" width="44" height="44" rx="12" fill="${soft}"/>`;
    s += lines(r, x + 28, 950, 280, 2, 30, "#e2e8f0", 14);
  }
  return s;
}

function brand(r, [dark, accent, soft, pale], title) {
  const word = title.split(" ")[0];
  let s = `<rect width="1600" height="1200" fill="${pale}"/>`;
  const cells = [
    [60, 60, 900, 640, dark],
    [980, 60, 560, 310, accent],
    [980, 390, 560, 310, soft],
    [60, 720, 440, 420, accent],
    [520, 720, 440, 420, "#ffffff"],
    [980, 720, 560, 420, dark],
  ];
  for (const [x, y, w, h, c] of cells) s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" fill="${c}"/>`;
  // the mark and the wordmark
  s += `<circle cx="300" cy="380" r="120" fill="${accent}"/><circle cx="300" cy="380" r="56" fill="${dark}"/>`;
  s += `<text x="460" y="408" ${FONT} font-size="96" font-weight="700" fill="#ffffff" letter-spacing="-3">${esc(word)}</text>`;
  s += `<text x="1030" y="300" ${FONT} font-size="150" font-weight="600" fill="${pale}">Aa</text>`;
  // swatches
  [dark, accent, soft, pale].forEach((c, i) => {
    s += `<rect x="${1020 + i * 124}" y="440" width="100" height="220" rx="14" fill="${c}" stroke="rgba(0,0,0,0.08)"/>`;
  });
  // pattern
  for (let i = 0; i < 6; i++)
    for (let j = 0; j < 6; j++)
      s += `<circle cx="${110 + i * 68}" cy="${770 + j * 64}" r="${(8 + r() * 16).toFixed(0)}" fill="${pale}" opacity="0.85"/>`;
  // a business card
  s += `<rect x="580" y="820" width="320" height="200" rx="14" fill="${pale}" stroke="#e5e7eb" stroke-width="2" transform="rotate(-6 740 920)"/>`;
  s += `<circle cx="640" cy="880" r="22" fill="${accent}" transform="rotate(-6 740 920)"/>`;
  s += `<text x="1040" y="960" ${FONT} font-size="64" font-weight="700" fill="${pale}">${esc(word.toLowerCase())}.</text>`;
  return s;
}

function motion(r, [dark, accent, soft, pale]) {
  let s = `<defs><radialGradient id="m" cx="0.3" cy="0.3" r="0.9"><stop offset="0" stop-color="${accent}"/><stop offset="1" stop-color="${dark}"/></radialGradient></defs>`;
  s += `<rect width="1600" height="1200" fill="${dark}"/>`;
  for (let i = 0; i < 7; i++) {
    const cx = 200 + r() * 1200;
    const cy = 150 + r() * 900;
    const rr = 80 + r() * 260;
    s += `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${rr.toFixed(0)}" fill="${i % 2 ? soft : accent}" opacity="${(0.15 + r() * 0.5).toFixed(2)}"/>`;
  }
  s += `<circle cx="800" cy="600" r="300" fill="url(#m)"/>`;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    s += `<path d="M${(800 + Math.cos(a) * 340).toFixed(0)} ${(600 + Math.sin(a) * 340).toFixed(0)} A 340 340 0 0 1 ${(800 + Math.cos(a + 0.35) * 340).toFixed(0)} ${(600 + Math.sin(a + 0.35) * 340).toFixed(0)}" stroke="${pale}" stroke-width="6" fill="none" opacity="0.5" stroke-linecap="round"/>`;
  }
  s += `<rect x="620" y="1040" width="360" height="10" rx="5" fill="${pale}" opacity="0.25"/><rect x="620" y="1040" width="${(100 + r() * 240).toFixed(0)}" height="10" rx="5" fill="${pale}"/>`;
  return s;
}

export const PROJECTS = [
  ["Northwind Analytics", "product", "dashboard"],
  ["Lumen Banking app", "mobile", "mobile"],
  ["Tidal Brand identity", "branding", "brand"],
  ["Orbit Travel planner", "web", "web"],
  ["Pulse Health dashboard", "product", "dashboard"],
  ["Kite Commerce", "web", "web"],
  ["Ferro Logistics", "product", "dashboard"],
  ["Aurora Energy rebrand", "branding", "brand"],
  ["Cobalt CRM", "product", "dashboard"],
  ["Maple Learning app", "mobile", "mobile"],
  ["Quill Notes", "mobile", "mobile"],
  ["Harbor Real estate", "web", "web"],
  ["Nimbus Cloud console", "product", "dashboard"],
  ["Sable Fashion store", "web", "web"],
  ["Echo Podcast app", "mobile", "mobile"],
  ["Vertex AI assistant", "product", "dashboard"],
  ["Juniper Coffee", "branding", "brand"],
  ["Atlas Maps launch film", "motion", "motion"],
  ["Prism Design system", "product", "dashboard"],
  ["Relay Messaging", "mobile", "mobile"],
  ["Bloom Florist", "branding", "brand"],
  ["Summit Outdoor", "web", "web"],
  ["Onyx Security", "product", "dashboard"],
  ["Waypoint Fleet", "product", "dashboard"],
  ["Crest Insurance", "web", "web"],
  ["Fable Kids books", "branding", "brand"],
  ["Glide Payments", "mobile", "mobile"],
  ["Mosaic Museum", "motion", "motion"],
  ["Tandem HR", "product", "dashboard"],
  ["Verve Fitness", "mobile", "mobile"],
  ["Lattice Fintech", "branding", "brand"],
  ["Beacon Nonprofit", "motion", "motion"],
];

PROJECTS.forEach(([title, , kind], i) => {
  const r = rng(hash(title));
  const pal = PALETTES[i % PALETTES.length];
  const body =
    kind === "dashboard" ? dashboard(r, pal, title.split(" ")[0]) : kind === "mobile" ? mobile(r, pal) : kind === "web" ? web(r, pal, title) : kind === "brand" ? brand(r, pal, title) : motion(r, pal);
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  save(`demo/covers/${slug}`, `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200" viewBox="0 0 1600 1200">${body}</svg>`, {
    kind: "cover",
    raster: true,
    width: 1600,
    height: 1200,
    filename: `${slug}-cover.png`,
  });
});

/* ---------------------------------------------------------------- photos */

const PHOTOS = [
  "Morning light over the studio desks",
  "Sketching flows on the whiteboard",
  "The team at the Friday review",
  "Coffee and a critique",
  "Printing the brand boards",
  "Workshop with a client",
  "Late-night launch",
  "Plants by the window",
  "Moodboards on the wall",
  "Offsite in the hills",
  "Sticky notes, everywhere",
  "Demo day",
];

PHOTOS.forEach((alt, i) => {
  const r = rng(hash(alt));
  const [dark, accent, soft, pale] = PALETTES[(i * 3) % PALETTES.length];
  let s = `<defs><linearGradient id="p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${pale}"/><stop offset="1" stop-color="${soft}"/></linearGradient>
    <filter id="b"><feGaussianBlur stdDeviation="${18 + r() * 20}"/></filter></defs>`;
  s += `<rect width="1200" height="1500" fill="url(#p)"/>`;
  s += `<g filter="url(#b)">`;
  for (let k = 0; k < 6; k++)
    s += `<circle cx="${(r() * 1200).toFixed(0)}" cy="${(r() * 900).toFixed(0)}" r="${(120 + r() * 260).toFixed(0)}" fill="${k % 2 ? accent : "#ffffff"}" opacity="${(0.25 + r() * 0.4).toFixed(2)}"/>`;
  s += `</g>`;
  // a table, a lamp, a plant: shapes, softly lit
  s += `<rect x="0" y="1020" width="1200" height="480" fill="${dark}" opacity="0.85"/>`;
  s += `<rect x="${120 + r() * 200}" y="880" width="${360 + r() * 200}" height="150" rx="16" fill="${pale}" opacity="0.9"/>`;
  s += `<rect x="${700 + r() * 120}" y="760" width="16" height="260" fill="${dark}"/><path d="M${640 + r() * 120} 760 h140 l-40 -90 h-60 z" fill="${accent}"/>`;
  s += `<ellipse cx="${250 + r() * 700}" cy="1180" rx="${200 + r() * 160}" ry="40" fill="#000000" opacity="0.18"/>`;
  s += `<path d="M1030 1020 q-40 -160 20 -260 q30 120 -20 260z M1050 1020 q60 -140 110 -200 q-20 150 -110 200z" fill="#3f6212" opacity="0.8"/>`;
  s += `<rect x="1010" y="1000" width="90" height="100" rx="10" fill="${soft}"/>`;
  const slug = alt.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 36);
  save(`demo/photos/${slug}`, `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500" viewBox="0 0 1200 1500">${s}</svg>`, {
    kind: "photo",
    raster: true,
    width: 1200,
    height: 1500,
    filename: `${slug}.jpg`,
    alt,
  });
});

/* ---------------------------------------------------------------- logos */

export const CLIENTS = [
  "Northwind", "Lumen", "Orbit", "Tidal", "Pulse", "Kite", "Ferro", "Aurora",
  "Cobalt", "Maple", "Harbor", "Nimbus", "Vertex", "Juniper", "Prism", "Summit",
];

CLIENTS.forEach((name, i) => {
  const r = rng(hash(name));
  const shape = i % 4;
  const mark =
    shape === 0
      ? `<circle cx="28" cy="40" r="18" fill="#111"/><circle cx="28" cy="40" r="8" fill="#fff"/>`
      : shape === 1
        ? `<rect x="10" y="22" width="36" height="36" rx="9" fill="#111"/><rect x="20" y="32" width="16" height="16" rx="3" fill="#fff"/>`
        : shape === 2
          ? `<path d="M10 58 L28 22 L46 58 Z" fill="#111"/>`
          : `<path d="M10 40 a18 18 0 1 1 36 0 a18 18 0 1 1 -36 0 M28 22 v36" stroke="#111" stroke-width="6" fill="none"/>`;
  const w = 60 + name.length * 19;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="80" viewBox="0 0 ${w} 80">${mark}<text x="58" y="52" ${FONT} font-size="${30 + Math.round(r() * 4)}" font-weight="${[600, 700, 500][i % 3]}" letter-spacing="${i % 2 ? -1 : 0.5}" fill="#111">${esc(i % 5 === 3 ? name.toUpperCase() : name)}</text></svg>`;
  save(`demo/logos/${name.toLowerCase()}`, svg, { kind: "logo", raster: false, width: w, height: 80, filename: `${name.toLowerCase()}-logo.svg` });
});

/* ---------------------------------------------------------------- avatars */

export const PEOPLE = [
  "Ayesha Rahman", "Daniel Okafor", "Sofia Marquez", "Kenji Watanabe", "Emily Carter",
  "Omar Haddad", "Priya Nair", "Lea Schmidt", "Marco Rossi", "Hannah Lee",
];

PEOPLE.forEach((name, i) => {
  const [dark, accent, soft] = PALETTES[(i * 7) % PALETTES.length];
  const initials = name.split(" ").map((p) => p[0]).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${soft}"/><stop offset="1" stop-color="${accent}"/></linearGradient></defs><rect width="256" height="256" fill="url(#a)"/><circle cx="128" cy="104" r="46" fill="${dark}" opacity="0.2"/><path d="M40 256 q88 -120 176 0z" fill="${dark}" opacity="0.2"/><text x="128" y="150" text-anchor="middle" ${FONT} font-size="84" font-weight="600" fill="#ffffff">${initials}</text></svg>`;
  const slug = name.toLowerCase().replace(/ /g, "-");
  save(`demo/avatars/${slug}`, svg, { kind: "avatar", raster: true, width: 256, height: 256, filename: `${slug}.jpg` });
});

/* ---------------------------------------------------------------- awards */

export const AWARDS = [
  ["UI/UX", "#b8923a"],
  ["Branding", "#9b7b30"],
  ["Interaction", "#5b2a86"],
  ["Web design", "#1d4ed8"],
];

AWARDS.forEach(([name, color]) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="62" height="114" viewBox="0 0 62 114"><path d="M0 0h62v114l-31-18L0 114z" fill="${color}"/><path d="M8 8h46v88l-23-13L8 96z" fill="none" stroke="#ffffff" stroke-opacity="0.35"/><text x="31" y="52" text-anchor="middle" ${FONT} font-size="20" font-weight="700" fill="#ffffff">${esc(name.slice(0, 2))}</text></svg>`;
  const slug = name.toLowerCase().replace(/[^a-z]+/g, "-");
  save(`demo/awards/${slug}`, svg, { kind: "award", raster: false, width: 62, height: 114, filename: `${slug}-ribbon.svg` });
});

/* ---------------------------------------------------------------- plan icons */

const ICONS = {
  starter: `<path d="M20 60 L48 20 L76 60 L48 76 Z" fill="none" stroke="#111" stroke-width="4" stroke-linejoin="round"/><path d="M20 60 L48 44 L76 60" fill="none" stroke="#111" stroke-width="4" stroke-linejoin="round"/>`,
  growth: `<path d="M18 70 L40 46 L54 58 L78 28" fill="none" stroke="#111" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M62 28 h16 v16" fill="none" stroke="#111" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
  custom: `<circle cx="48" cy="48" r="26" fill="none" stroke="#111" stroke-width="4"/><path d="M48 14v10M48 72v10M14 48h10M72 48h10" stroke="#111" stroke-width="4" stroke-linecap="round"/><circle cx="48" cy="48" r="8" fill="#111"/>`,
};
for (const [name, body] of Object.entries(ICONS)) {
  save(`demo/icons/plan-${name}`, `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">${body}</svg>`, {
    kind: "icon",
    raster: false,
    width: 96,
    height: 96,
    filename: `plan-icon-${name}.svg`,
  });
}

writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 1));
console.log(`${manifest.length} pieces of art in ${OUT}/`);
