// Generates design-direction preview boards (static mockups, not the app).
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, '..');
const ICONS = require('../src/icons.json');
const ic = (n, s = 28) => `<svg width="${s}" height="${s}" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">${ICONS[n]}</svg>`;
const font = (pkg, file) => 'file://' + path.join(ROOT, 'node_modules/@fontsource', pkg, 'files', file);

const DIRS = {
  a: {
    name: 'A · Sunday Kitchen', blurb: '70s cookbook warmth. Tomato, mustard and avocado on cream. Chunky retro headline, clean round body text.',
    fonts: `@font-face{font-family:H;src:url(${font('shrikhand','shrikhand-latin-400-normal.woff2')})}@font-face{font-family:B;font-weight:400;src:url(${font('outfit','outfit-latin-400-normal.woff2')})}@font-face{font-family:B;font-weight:600;src:url(${font('outfit','outfit-latin-600-normal.woff2')})}@font-face{font-family:B;font-weight:800;src:url(${font('outfit','outfit-latin-800-normal.woff2')})}`,
    c: { bg: '#fbf1de', ink: '#3b2416', mut: '#6d5443', c1: '#d9472b', c2: '#e9a93a', c3: '#6e7b2e', c4: '#c9713d', s1: '#f7d9c9', s2: '#f8e3b5', s3: '#e3e6c6', s4: '#f1d3bd' },
    head: 'H', headSize: 1, motif: 'stripes',
  },
  b: {
    name: 'B · Diner Modern', blurb: 'Mid-century diner. Teal, cherry and butter yellow. Elegant display serif, bold modern sans, a starburst and checkerboard here and there.',
    fonts: `@font-face{font-family:H;src:url(${font('dm-serif-display','dm-serif-display-latin-400-normal.woff2')})}@font-face{font-family:B;font-weight:400;src:url(${font('bricolage-grotesque','bricolage-grotesque-latin-400-normal.woff2')})}@font-face{font-family:B;font-weight:600;src:url(${font('bricolage-grotesque','bricolage-grotesque-latin-600-normal.woff2')})}@font-face{font-family:B;font-weight:800;src:url(${font('bricolage-grotesque','bricolage-grotesque-latin-800-normal.woff2')})}`,
    c: { bg: '#f6eedd', ink: '#1d2b2a', mut: '#4d5b59', c1: '#c23b32', c2: '#f2c14e', c3: '#1e7a78', c4: '#e48a5c', s1: '#f5d6cf', s2: '#fbe9b8', s3: '#cfe5e2', s4: '#f8dccb' },
    head: 'H', headSize: 1.08, motif: 'diner',
  },
  c: {
    name: 'C · Golden Hour', blurb: 'Retro sunset. Terracotta, rose and plum on peach. Soft serif headlines and stacked sun-stripe arches.',
    fonts: `@font-face{font-family:H;src:url(${font('young-serif','young-serif-latin-400-normal.woff2')})}@font-face{font-family:B;font-weight:400;src:url(${font('outfit','outfit-latin-400-normal.woff2')})}@font-face{font-family:B;font-weight:600;src:url(${font('outfit','outfit-latin-600-normal.woff2')})}@font-face{font-family:B;font-weight:800;src:url(${font('outfit','outfit-latin-800-normal.woff2')})}`,
    c: { bg: '#fdeadb', ink: '#3a1d33', mut: '#6b4a5f', c1: '#c4532d', c2: '#f4a259', c3: '#4a2340', c4: '#e58fa0', s1: '#f6d0c0', s2: '#fde0bd', s3: '#e7d3df', s4: '#f9d6dc' },
    head: 'H', headSize: 1, motif: 'sun',
  },
};

function motif(d) {
  const { c1, c2, c3, c4 } = d.c;
  if (d.motif === 'stripes') return `<svg class="motif" viewBox="0 0 400 220"><g fill="none" stroke-width="26">
    <path d="M30 220 A170 170 0 0 1 370 220" stroke="${c1}"/><path d="M58 220 A142 142 0 0 1 342 220" stroke="${c4}"/><path d="M86 220 A114 114 0 0 1 314 220" stroke="${c2}"/><path d="M114 220 A86 86 0 0 1 286 220" stroke="${c3}"/></g></svg>`;
  if (d.motif === 'diner') return `<svg class="motif" viewBox="0 0 400 220"><g transform="translate(300 90)">${Array.from({ length: 12 }, (_, i) => `<path d="M0 0 L8 -70 L-8 -70Z" fill="${c2}" transform="rotate(${i * 30})"/>`).join('')}<circle r="22" fill="${c1}"/></g>
    <ellipse cx="120" cy="150" rx="95" ry="38" fill="${c3}" transform="rotate(-14 120 150)"/><g>${Array.from({ length: 10 }, (_, i) => `<rect x="${20 + i * 36}" y="196" width="18" height="12" fill="${i % 2 ? c1 : 'transparent'}"/><rect x="${38 + i * 36}" y="208" width="18" height="12" fill="${i % 2 ? c1 : 'transparent'}"/>`).join('')}</g></svg>`;
  return `<svg class="motif" viewBox="0 0 400 220"><circle cx="200" cy="220" r="150" fill="${c2}"/><g fill="${d.c.bg}">${[0, 1, 2, 3].map(i => `<rect x="40" y="${120 + i * 24}" width="320" height="${6 + i * 3}"/>`).join('')}</g><path d="M0 220 Q100 150 200 190 T400 170 V220Z" fill="${c1}"/><path d="M0 220 Q120 190 230 205 T400 200 V220Z" fill="${c3}"/></svg>`;
}

function plateSvg(d) {
  const { c1, c2, c3 } = d.c;
  return `<svg viewBox="0 0 200 200" class="plate"><circle cx="100" cy="100" r="96" fill="#fff" stroke="${d.c.ink}" stroke-width="3"/><circle cx="100" cy="100" r="78" fill="none" stroke="${d.c.ink}" stroke-opacity=".15" stroke-width="2"/>
    <path d="M100 100 L100 26 A74 74 0 0 1 100 174Z" fill="${c3}"/><path d="M100 100 L100 174 A74 74 0 0 1 26 100Z" fill="${c1}"/><path d="M100 100 L26 100 A74 74 0 0 1 100 26Z" fill="${c2}"/>
    <text x="137" y="104" font-family="B" font-weight="800" font-size="13" fill="#fff" text-anchor="middle">VEG</text><text x="70" y="140" font-family="B" font-weight="800" font-size="11" fill="#fff" text-anchor="middle">PROTEIN</text><text x="68" y="72" font-family="B" font-weight="800" font-size="11" fill="${d.c.ink}" text-anchor="middle">CARBS</text></svg>`;
}

function board(key) {
  const d = DIRS[key]; const C = d.c;
  const tiles = [['tag', 'Scan a label', 'Is it a good pick?', C.c1, C.s1], ['camera', 'Check my plate', 'Balance it fast', C.c3, C.s3], ['calendar-blank', 'Plan my week', '7 days of meals', C.c2, C.s2], ['book-open', 'Learn', '4 short reads', C.c4, C.s4]];
  const ring = (label, val, max, col, unit = 'g') => { const p = Math.min(1, val / max); const L = 2 * Math.PI * 30;
    return `<div class="ring"><svg viewBox="0 0 72 72"><circle cx="36" cy="36" r="30" fill="none" stroke="${C.ink}" stroke-opacity=".12" stroke-width="8"/><circle cx="36" cy="36" r="30" fill="none" stroke="${col}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${p * L} ${L}" transform="rotate(-90 36 36)"/></svg><b>${val}${unit}</b><span>${label}</span></div>`; };
  return `<!doctype html><html><head><meta charset="utf-8"><style>${d.fonts}
  *{box-sizing:border-box}body{margin:0;background:${C.bg};color:${C.ink};font:400 18px/1.5 B,sans-serif;width:1440px}
  .top{display:flex;justify-content:space-between;align-items:end;padding:36px 56px 0}.top h1{font:400 20px B;font-weight:800;letter-spacing:.14em;text-transform:uppercase;margin:0}.top p{margin:0;max-width:620px;color:${C.mut};font-size:17px;text-align:right}
  .grid{display:grid;grid-template-columns:1.05fr .95fr;gap:40px;padding:28px 56px 56px;align-items:start}
  .hero{background:#fff;border:3px solid ${C.ink};border-radius:28px;padding:36px 40px 0;overflow:hidden;position:relative;box-shadow:8px 8px 0 ${C.ink}}
  .nav{display:flex;align-items:center;gap:18px;font-weight:600;font-size:15px;margin-bottom:34px;white-space:nowrap}.logo{font:400 ${26 * d.headSize}px H;margin-right:auto}.btn{background:${C.c1};color:#fff;border-radius:999px;padding:12px 22px;font-weight:800;border:3px solid ${C.ink};display:inline-flex;gap:8px;align-items:center}.ghost{background:#fff;color:${C.ink}}
  .eyebrow{display:inline-block;background:${C.c2};border:2px solid ${C.ink};border-radius:999px;padding:4px 14px;font-weight:800;font-size:14px;letter-spacing:.08em;text-transform:uppercase}
  .hero h2{font:400 ${60 * d.headSize}px/1.02 H;margin:16px 0 14px;letter-spacing:-.01em}.hero h2 em{font-style:normal;color:${C.c1}}.hero p.lead{font-size:20px;color:${C.mut};max-width:520px;margin:0 0 22px}
  .ctas{display:flex;gap:12px;margin-bottom:24px}.motif{display:block;width:100%;height:auto;margin-top:6px}
  .icons{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:6px 0 22px}.mini{border:2px solid ${C.ink};border-radius:18px;padding:12px;text-align:center;font-weight:800;font-size:14px;line-height:1.2}.mini div{width:48px;height:48px;border-radius:50%;display:grid;place-items:center;margin:0 auto 6px;color:#fff;border:2px solid ${C.ink}}
  .phones{display:flex;gap:28px;justify-content:center}
  .phone{width:330px;background:${C.ink};border-radius:46px;padding:11px;box-shadow:10px 10px 0 ${C.c2}}.scr{background:${C.bg};border-radius:36px;height:690px;overflow:hidden;display:flex;flex-direction:column;padding:26px 18px 0;gap:14px}
  .hi{display:flex;justify-content:space-between;align-items:center}.hi b{font:400 ${30 * d.headSize}px H}.hi span{font-weight:600;color:${C.mut};font-size:15px}
  .rings{display:grid;grid-template-columns:repeat(3,1fr);background:#fff;border:3px solid ${C.ink};border-radius:22px;padding:14px 6px}.ring{position:relative;text-align:center}.ring svg{width:72px;height:72px}.ring b{position:absolute;top:22px;left:0;right:0;font-weight:800;font-size:17px}.ring span{display:block;font-weight:600;font-size:14px}
  .tiles{display:grid;grid-template-columns:1fr 1fr;gap:12px}.tile{border:3px solid ${C.ink};border-radius:22px;padding:14px;min-height:132px;display:flex;flex-direction:column;justify-content:space-between}.tile .ib{width:52px;height:52px;border-radius:50%;display:grid;place-items:center;color:#fff;border:2px solid ${C.ink}}.tile b{font-weight:800;font-size:18px;line-height:1.15}.tile small{display:block;font-size:14px;color:${C.mut};font-weight:600}
  .habit{background:${C.c3};color:#fff;border-radius:20px;padding:14px 16px;display:flex;gap:12px;align-items:center;border:3px solid ${C.ink}}.habit b{font-size:17px}.habit small{display:block;opacity:.9;font-size:14px}
  .tabs{margin-top:auto;display:flex;justify-content:space-around;background:#fff;border-top:3px solid ${C.ink};margin-left:-18px;margin-right:-18px;padding:10px 6px 16px}.tabs div{display:grid;justify-items:center;font-weight:800;font-size:12px;gap:2px;color:${C.mut}}.tabs .on{color:${C.c1}}
  .plate{width:180px;display:block;margin:0 auto}
  .macros{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.mac{border:2px solid ${C.ink};border-radius:16px;padding:8px;text-align:center;background:#fff}.mac b{display:block;font:400 26px H}.mac span{font-weight:800;font-size:12px;letter-spacing:.06em;text-transform:uppercase}
  .tip{display:flex;gap:12px;align-items:flex-start;background:#fff;border:2px solid ${C.ink};border-radius:18px;padding:12px}.tip .ib{width:42px;height:42px;flex:none;border-radius:50%;display:grid;place-items:center;color:#fff;border:2px solid ${C.ink}}.tip b{font-size:17px;display:block;line-height:1.2}.tip small{font-size:14px;color:${C.mut}}.chip{display:inline-block;margin-top:4px;font-size:12px;font-weight:800;border:2px solid currentColor;border-radius:999px;padding:0 8px;color:${C.c1}}
  .cap{font-weight:800;font-size:14px;text-transform:uppercase;letter-spacing:.12em;color:${C.mut};margin:0 0 10px;text-align:center}
  </style></head><body>
  <div class="top"><h1>${d.name}</h1><p>${d.blurb}</p></div>
  <div class="grid">
    <div><p class="cap">Landing page</p><div class="hero">
      <div class="nav"><span class="logo">Better Plate</span><span>The app</span><span>The habits</span><span>Log in</span><span class="btn">Get started</span></div>
      <span class="eyebrow">For women with PCOS</span>
      <h2>Know what’s on your plate. <em>And what to add.</em></h2>
      <p class="lead">Score a label, balance your plate, plan your week. No calorie counting.</p>
      <div class="ctas"><span class="btn">Create free account ${ic('arrow-right', 20)}</span><span class="btn ghost">Try it now</span></div>
      <div class="icons">${tiles.map(t => `<div class="mini"><div style="background:${t[3]}">${ic(t[0], 26)}</div>${t[1]}</div>`).join('')}</div>
      ${motif(d)}
    </div></div>
    <div><p class="cap">App: home and plate check</p><div class="phones">
      <div class="phone"><div class="scr">
        <div class="hi"><b>Hi, Maya</b><span>Wed, Nov 12</span></div>
        <div class="rings">${ring('Protein', 64, 90, C.c1)}${ring('Fiber', 17, 25, C.c3)}${ring('Sugar', 12, 25, C.c2)}</div>
        <div class="tiles">${tiles.map(t => `<div class="tile" style="background:${t[4]}"><div class="ib" style="background:${t[3]}">${ic(t[0], 28)}</div><div><b>${t[1]}</b><small>${t[2]}</small></div></div>`).join('')}</div>
        <div class="habit">${ic('list-numbers', 30)}<div><b>Today: eat in order</b><small>Veggies, protein, then carbs</small></div></div>
        <div class="tabs"><div class="on">${ic('house', 26)}Home</div><div>${ic('tag', 26)}Scan</div><div>${ic('fork-knife', 26)}Plate</div><div>${ic('calendar-blank', 26)}Plan</div><div>${ic('book-open', 26)}Learn</div></div>
      </div></div>
      <div class="phone"><div class="scr">
        <div class="hi"><b>My plate</b><span>Lunch</span></div>
        ${plateSvg(d)}
        <div class="macros"><div class="mac"><b>49g</b><span>Protein</span></div><div class="mac"><b>8g</b><span>Fiber</span></div><div class="mac"><b>80g</b><span>Carbs</span></div></div>
        <div class="tip"><div class="ib" style="background:${C.c3}">${ic('leaf', 22)}</div><div><b>Start with veggies</b><small>A few bites of greens first.</small><br><span class="chip">Early evidence</span></div></div>
        <div class="tip"><div class="ib" style="background:${C.c1}">${ic('arrows-clockwise', 22)}</div><div><b>Swap white pasta</b><small>Try chickpea pasta or half veggies.</small><br><span class="chip" style="color:${C.c3}">Guideline</span></div></div>
        <div class="tip"><div class="ib" style="background:${C.c2};color:${C.ink}">${ic('person-simple-walk', 22)}</div><div><b>Walk 10 minutes after</b><small>Biggest effect after dinner.</small><br><span class="chip" style="color:${C.c4}">Moderate evidence</span></div></div>
      </div></div>
    </div></div>
  </div></body></html>`;
}
for (const k of Object.keys(DIRS)) fs.writeFileSync(path.join(__dirname, `preview-${k}.html`), board(k));
console.log('ok');
