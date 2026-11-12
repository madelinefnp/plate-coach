// Preview E: straight grid, no oxblood, clear "what it does" messaging. Static mockup only.
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, '..');
const duo = n => fs.readFileSync(path.join(ROOT, 'node_modules/@phosphor-icons/core/assets/duotone', n + '-duotone.svg'), 'utf8').replace(/<svg[^>]*>/, '').replace('</svg>', '');
const ic = (n, s = 28) => `<svg width="${s}" height="${s}" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">${duo(n)}</svg>`;
const font = (pkg, file) => 'file://' + path.join(ROOT, 'node_modules/@fontsource', pkg, 'files', file);
const C = { ink: '#1c2240', peri: '#88a5d3', periSoft: '#dfe7f5', cream: '#f7f3ee', org: '#fe5f1b', orgSoft: '#ffe1d3', pink: '#f7a8ec', pinkSoft: '#fbe3f7', green: '#b6cf3d', greenSoft: '#e6efc6', greenInk: '#4f5c12', white: '#fff' };
const css = `
@font-face{font-family:Anton;src:url(${font('anton','anton-latin-400-normal.woff2')})}
${[400, 500, 600, 700, 800].map(w => `@font-face{font-family:Fig;font-weight:${w};src:url(${font('figtree', `figtree-latin-${w}-normal.woff2`)})}`).join('')}
*{box-sizing:border-box}body{margin:0;width:2000px;background:${C.cream};color:${C.ink};font:500 17px/1.45 Fig,sans-serif}
.board{padding:40px 50px 56px}.bh{display:flex;justify-content:space-between;align-items:end;margin-bottom:26px}
.bh h1{font:400 42px/1 Anton;letter-spacing:.02em;margin:0;text-transform:uppercase}.bh p{max-width:720px;margin:0;font-size:16px}
.phones{display:flex;gap:36px;justify-content:center;align-items:flex-start}
.cap{text-align:center;font:400 18px Anton;letter-spacing:.12em;text-transform:uppercase;margin:0 0 12px}
.phone{width:380px;border-radius:52px;background:${C.ink};padding:12px;box-shadow:0 30px 60px -24px rgba(28,34,64,.45)}
.scr{position:relative;background:${C.cream};border-radius:41px;height:800px;overflow:hidden;display:flex;flex-direction:column}
.top{flex:none;padding:26px 22px 12px;display:flex;justify-content:space-between;align-items:center}
.logo{font:400 22px Anton;letter-spacing:.06em}.logo span{color:${C.org}}.who{font-size:14px;font-weight:700;color:${C.ink};opacity:.7}
.pad{padding:6px 20px 16px}
.q{font-size:13px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:${C.org};margin:0 0 4px}
.h{font:400 36px/1 Anton;text-transform:uppercase;margin:0}
.sub{font-size:16px;margin:8px 0 0;font-weight:500}
.panel{border-radius:22px;padding:16px}
.stats{background:${C.peri};display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}
.stat b{display:block;font:400 32px/1 Anton;color:${C.white}}.stat span{font-weight:800;font-size:12.5px;letter-spacing:.08em;text-transform:uppercase}.stat em{display:block;font-style:normal;font-size:12.5px;font-weight:600}
.track{height:6px;border-radius:9px;background:rgba(28,34,64,.18);margin-top:6px}.track i{display:block;height:100%;border-radius:9px;background:${C.ink}}
.list{display:grid;gap:10px;margin-top:14px}
.row{display:flex;align-items:center;gap:14px;border-radius:20px;padding:11px 14px;background:${C.white}}
.row .ib{width:48px;height:48px;border-radius:16px;display:grid;place-items:center;flex:none}
.row b{display:block;font:400 19px/1.05 Anton;text-transform:uppercase}.row small{display:block;font-size:14.5px;line-height:1.35;margin-top:2px}
.row .go{margin-left:auto;font:400 22px Anton;opacity:.5}
.tabs{flex:none;margin-top:auto;background:${C.white};border-top:1px solid #e6e0d8;display:flex;justify-content:space-around;padding:10px 6px 24px}.tabs div{display:grid;justify-items:center;gap:2px;font:400 12px Anton;letter-spacing:.08em;color:#8a8ea3}.tabs .on{color:${C.org}}
.ticker{flex:none;background:${C.ink};color:${C.cream};white-space:nowrap;overflow:hidden;font:400 16px Anton;letter-spacing:.06em;padding:8px 0}.ticker span{display:inline-block;transform:translateX(-20px)}
.score{display:flex;align-items:center;gap:16px;margin:12px 0 4px}.big{width:108px;height:108px;border-radius:50%;background:${C.org};color:${C.white};display:grid;place-items:center;font:400 54px/1 Anton;flex:none}
.reasons{list-style:none;padding:0;margin:10px 0 0;display:grid;gap:8px}.reasons li{display:flex;gap:10px;align-items:center;font-weight:600;font-size:15.5px;background:${C.white};border-radius:14px;padding:10px 12px}
.mk{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;flex:none;font:400 14px Anton;color:${C.white}}.bad .mk{background:${C.org}}.good .mk{background:${C.green};color:${C.ink}}
.swap{background:${C.greenSoft};border-radius:20px;padding:14px 16px;margin-top:12px}.swap .q{color:${C.ink}}.swap b{font:400 21px Anton;text-transform:uppercase;display:block}
.cta{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:${C.org};color:${C.white};border-radius:999px;padding:14px 22px;font:400 18px Anton;letter-spacing:.06em;text-transform:uppercase}
.macros{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}.mac{background:${C.white};border-radius:16px;padding:10px;text-align:center}.mac b{display:block;font:400 30px/1 Anton}.mac span{font-weight:800;font-size:12px;letter-spacing:.08em;text-transform:uppercase}
.tip{display:flex;gap:12px;align-items:flex-start;background:${C.white};border-radius:18px;padding:10px 14px;margin-top:8px}.tip .ib{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;flex:none}
.tip b{display:block;font:400 18px/1.05 Anton;text-transform:uppercase}.tip small{font-size:14px;line-height:1.35;display:block;margin-top:2px}
.pill{display:inline-block;margin-top:5px;font-weight:800;font-size:11px;letter-spacing:.08em;text-transform:uppercase;border-radius:999px;padding:2px 9px}
.steps{display:grid;gap:10px;margin-top:16px}.step{display:flex;gap:14px;align-items:center;background:${C.white};border-radius:18px;padding:12px 14px}.step .n{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;font:400 20px Anton;flex:none;color:${C.white}}
.step b{display:block;font:400 19px/1.1 Anton;text-transform:uppercase}.step small{font-size:14px}
`;
const tabs = on => `<div class="tabs">${[['house', 'HOME'], ['barcode', 'SCAN'], ['fork-knife', 'PLATE'], ['calendar-blank', 'PLAN'], ['book-open', 'LEARN']].map(([i, l]) => `<div class="${l === on ? 'on' : ''}">${ic(i, 26)}${l}</div>`).join('')}</div>`;
const top = (who = 'Hi, Maya') => `<div class="top"><span class="logo">BETTER <span>PLATE</span></span><span class="who">${who}</span></div>`;

const welcome = `<div class="scr" style="background:${C.peri}">
  <div class="top"><span class="logo" style="color:${C.ink}">BETTER <span>PLATE</span></span></div>
  <div class="pad">
    <p class="q" style="color:${C.ink}">For women with PCOS</p>
    <h2 class="h" style="font-size:44px;color:${C.white}">Eat for steadier blood sugar. Without a diet.</h2>
    <p class="sub" style="color:${C.ink}">Better Plate shows you, in seconds, whether a food or meal supports your blood sugar, and the one change that makes it better.</p>
    <div class="steps">
      <div class="step"><span class="n" style="background:${C.org}">1</span><div><b>Scan a food label</b><small>Get a 0 to 100 score and a better swap.</small></div></div>
      <div class="step"><span class="n" style="background:${C.green};color:${C.ink}">2</span><div><b>Check your plate</b><small>See protein, fiber and carbs, plus what to add.</small></div></div>
      <div class="step"><span class="n" style="background:${C.ink}">3</span><div><b>Plan your week</b><small>Balanced meals with daily totals.</small></div></div>
    </div>
    <div style="margin-top:18px;display:grid;gap:8px"><span class="cta">Get started</span><span style="text-align:center;font-weight:700;font-size:14px">No calorie counting. Every tip shows its research.</span></div>
  </div>
</div>`;

const home = `<div class="scr">
  ${top()}
  <div class="pad">
    <p class="q">Your day so far</p>
    <h2 class="h">Today</h2>
    <div class="panel stats">
      <div class="stat"><b>64g</b><span>Protein</span><em>of 90g goal</em><div class="track"><i style="width:71%;background:${C.pink}"></i></div></div>
      <div class="stat"><b>17g</b><span>Fiber</span><em>of 25g goal</em><div class="track"><i style="width:68%;background:${C.green}"></i></div></div>
      <div class="stat"><b>12g</b><span>Sugar</span><em>under 25g</em><div class="track"><i style="width:48%;background:${C.org}"></i></div></div>
    </div>
    <p class="q" style="margin-top:18px">What do you want to do?</p>
    <div class="list" style="margin-top:6px">
      <div class="row"><span class="ib" style="background:${C.org};color:${C.white}">${ic('barcode', 32)}</span><div><b>Is this food a good pick?</b><small>Scan a label, get a score + a swap</small></div><span class="go">›</span></div>
      <div class="row"><span class="ib" style="background:${C.green};color:${C.ink}">${ic('fork-knife', 32)}</span><div><b>Is my plate balanced?</b><small>Tap your foods, get tips</small></div><span class="go">›</span></div>
      <div class="row"><span class="ib" style="background:${C.peri};color:${C.ink}">${ic('calendar-blank', 32)}</span><div><b>What should I eat this week?</b><small>Plan balanced meals</small></div><span class="go">›</span></div>
      <div class="row"><span class="ib" style="background:${C.pink};color:${C.ink}">${ic('book-open', 32)}</span><div><b>Why does this work?</b><small>4 short lessons</small></div><span class="go">›</span></div>
    </div>
  </div>
  ${tabs('HOME')}
</div>`;

const scan = `<div class="scr">
  ${top()}
  <div class="pad">
    <p class="q">Is this food a good pick?</p>
    <h2 class="h">Honey Oat Clusters</h2>
    <div class="score"><div class="big">20</div><div><b style="font:400 26px Anton;text-transform:uppercase;color:${C.org}">Worth swapping</b><div style="font-size:14px;font-weight:600">Score out of 100, per 1 cup</div></div></div>
    <ul class="reasons">
      <li class="bad"><span class="mk">!</span>14g added sugar, over half a day’s limit</li>
      <li class="bad"><span class="mk">!</span>Sugar is ingredient #2</li>
      <li class="bad"><span class="mk">!</span>Refined wheat flour</li>
      <li class="good"><span class="mk">✓</span>Good source of protein (5g)</li>
    </ul>
    <div class="swap"><p class="q">A better swap</p><b>Go protein-forward</b>Eggs and greens, or Greek yogurt with nuts and berries.</div>
    <div style="display:flex;gap:12px;align-items:center;margin-top:14px"><span class="cta">${ic('plus', 18)} Log a serving</span><span style="font-weight:700;text-decoration:underline;font-size:15px">How scores work</span></div>
  </div>
  ${tabs('SCAN')}
</div>`;

const plateSvg = `<svg viewBox="0 0 220 220" width="150" height="150"><circle cx="110" cy="110" r="104" fill="${C.white}" stroke="${C.ink}" stroke-width="3"/>
  <path d="M110 110 L110 26 A84 84 0 0 1 110 194Z" fill="${C.green}"/><path d="M110 110 L110 194 A84 84 0 0 1 26 110Z" fill="${C.org}"/><path d="M110 110 L26 110 A84 84 0 0 1 110 26Z" fill="${C.pink}"/>
  <text x="153" y="116" font-family="Anton" font-size="17" fill="${C.ink}" text-anchor="middle">VEG</text><text x="75" y="152" font-family="Anton" font-size="13" fill="#fff" text-anchor="middle">PROTEIN</text><text x="73" y="80" font-family="Anton" font-size="13" fill="${C.ink}" text-anchor="middle">CARBS</text></svg>`;
const plate = `<div class="scr">
  ${top()}
  <div class="pad" style="padding-bottom:10px">
    <p class="q">Is my plate balanced?</p>
    <h2 class="h">Lunch: pasta + chicken</h2>
    <div style="display:flex;gap:14px;align-items:center;margin-top:10px">${plateSvg}
      <div class="macros" style="grid-template-columns:1fr;flex:1;margin:0"><div class="mac" style="display:flex;justify-content:space-between;align-items:baseline"><span>Protein</span><b style="font-size:24px">49g</b></div><div class="mac" style="display:flex;justify-content:space-between;align-items:baseline"><span>Fiber</span><b style="font-size:24px">8g</b></div><div class="mac" style="display:flex;justify-content:space-between;align-items:baseline"><span>Carbs</span><b style="font-size:24px">80g</b></div></div></div>
  </div>
  <div class="ticker"><span>${'EAT IN THIS ORDER: VEGGIES → PROTEIN → CARBS • '.repeat(4)}</span></div>
  <div class="pad" style="padding-top:8px">
    <p class="q" style="margin-top:6px">3 ways to balance it</p>
    <div class="tip"><div class="ib" style="background:${C.green};color:${C.ink}">${ic('leaf', 28)}</div><div><b>Start with veggies</b><small>A few bites of greens before the pasta.</small><span class="pill" style="background:${C.orgSoft};color:#b8400f">Early evidence</span></div></div>
    <div class="tip"><div class="ib" style="background:${C.org};color:${C.white}">${ic('arrows-clockwise', 28)}</div><div><b>Swap white pasta</b><small>Chickpea pasta, or go half veggies.</small><span class="pill" style="background:${C.greenSoft};color:${C.greenInk}">Guideline</span></div></div>
    <div class="tip"><div class="ib" style="background:${C.pink};color:${C.ink}">${ic('person-simple-walk', 28)}</div><div><b>Walk 10 minutes after</b><small>Biggest effect after dinner.</small><span class="pill" style="background:${C.periSoft};color:#3d5f99">Moderate evidence</span></div></div>
  </div>
  ${tabs('PLATE')}
</div>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div class="board">
<div class="bh"><h1>Preview E · Clear + retro</h1><p>More of the reference palette: periwinkle, hot orange, bubblegum pink and lime/pistachio green, with midnight blue for text, on cream. Everything sits straight. A welcome screen says exactly what the app does, and every screen opens with the question it answers.</p></div>
<div class="phones">${[['Welcome', welcome], ['Home', home], ['Label score', scan], ['Plate check', plate]].map(([c, s]) => `<div><p class="cap">${c}</p><div class="phone">${s}</div></div>`).join('')}</div>
</div></body></html>`;
fs.writeFileSync(path.join(__dirname, 'preview-e.html'), html);
console.log('ok');
