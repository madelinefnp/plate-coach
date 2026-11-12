// Preview D: retro-chic app screens inspired by the user's reference (palette, type mood). Static mockup only.
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, '..');
const duo = n => fs.readFileSync(path.join(ROOT, 'node_modules/@phosphor-icons/core/assets/duotone', n + '-duotone.svg'), 'utf8').replace(/<svg[^>]*>/, '').replace('</svg>', '');
const ic = (n, s = 28, cls = '') => `<svg class="${cls}" width="${s}" height="${s}" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">${duo(n)}</svg>`;
const font = (pkg, file) => 'file://' + path.join(ROOT, 'node_modules/@fontsource', pkg, 'files', file);
const C = { ox: '#6c1d14', peri: '#88a5d3', cream: '#f6f2ee', org: '#fe5f1b', pink: '#fa99f0', olive: '#8c8a1f', ink: '#3d0f0a' };
const noise = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .12 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;
const ticker = t => `<div class="ticker"><span>${(t + ' • ').repeat(6)}</span></div>`;
const sticker = (txt, inner, bg = C.org, fg = C.ox) => `<svg class="sticker" viewBox="0 0 120 120"><defs><path id="c${txt.length}" d="M60 60 m-44 0 a44 44 0 1 1 88 0 a44 44 0 1 1 -88 0"/></defs><circle cx="60" cy="60" r="58" fill="${bg}"/><text font-family="Anton" font-size="12.5" letter-spacing="2.2" fill="${fg}"><textPath href="#c${txt.length}">${txt}</textPath></text><g transform="translate(36 36)" color="${fg}">${inner}</g></svg>`;

const css = `
@font-face{font-family:Anton;src:url(${font('anton','anton-latin-400-normal.woff2')})}
@font-face{font-family:Caveat;font-weight:600;src:url(${font('caveat','caveat-latin-600-normal.woff2')})}
${[400, 500, 600, 700, 800].map(w => `@font-face{font-family:Fig;font-weight:${w};src:url(${font('figtree', `figtree-latin-${w}-normal.woff2`)})}`).join('')}
*{box-sizing:border-box}body{margin:0;width:1560px;background:${C.cream};color:${C.ox};font:500 17px/1.45 Fig,sans-serif}
.board{padding:40px 56px 60px}.bh{display:flex;justify-content:space-between;align-items:end;margin-bottom:28px}
.bh h1{font:400 44px/1 Anton;letter-spacing:.02em;margin:0;text-transform:uppercase}.bh h1 span{font:600 34px Caveat;color:${C.peri};text-transform:none;margin-left:10px}
.bh p{max-width:640px;margin:0;font-size:16px;color:${C.ox}}
.phones{display:flex;gap:44px;justify-content:center;align-items:flex-start}
.phone{width:380px;border-radius:52px;background:${C.ox};padding:12px;box-shadow:0 30px 60px -20px rgba(108,29,20,.45)}
.scr{position:relative;background:${C.cream};border-radius:41px;height:800px;overflow:hidden;display:flex;flex-direction:column}
.tex{background-color:${C.peri};background-image:${noise}}
.bar{flex:none;background:${C.ox};color:${C.cream};padding:26px 22px 14px;display:flex;align-items:baseline;gap:8px}
.bar b{font:400 22px Anton;letter-spacing:.06em}.bar i{font:600 20px Caveat;font-style:normal;color:${C.pink}}
.pad{padding:18px 20px}
.h{font:400 38px/.98 Anton;text-transform:uppercase;letter-spacing:.01em;margin:0}
.script{font:600 22px/1.1 Caveat;color:${C.peri}}
.stats{border-radius:22px;padding:16px 16px 14px;color:${C.cream};display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}
.stat b{display:block;font:400 34px/1 Anton}.stat span{font-weight:700;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:${C.ox}}
.track{height:6px;border-radius:9px;background:rgba(108,29,20,.18);margin-top:6px}.track i{display:block;height:100%;border-radius:9px;background:${C.ox}}
.tiles{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px}
.tile{border-radius:24px;padding:16px;min-height:150px;display:flex;flex-direction:column;justify-content:space-between}
.tile b{font:400 25px/1 Anton;text-transform:uppercase}.tile small{display:block;font-size:14px;font-weight:600;margin-top:4px}
.t1{background:${C.org};color:${C.cream};transform:rotate(-2deg)}.t2{color:${C.ox};transform:rotate(1.5deg)}.t3{background:${C.pink};color:${C.ox};transform:rotate(1.5deg)}.t4{background:${C.ox};color:${C.cream};transform:rotate(-2deg)}
.tabs{flex:none;margin-top:auto;background:${C.ox};color:${C.cream};display:flex;justify-content:space-around;padding:12px 6px 24px}.tabs div{display:grid;justify-items:center;gap:2px;font:400 12px Anton;letter-spacing:.08em;opacity:.65}.tabs .on{opacity:1;color:${C.pink}}
.sticker{position:absolute;width:112px;height:112px}
.ticker{flex:none;background:${C.ox};color:${C.cream};white-space:nowrap;overflow:hidden;font:400 17px Anton;letter-spacing:.06em;padding:8px 0}.ticker span{display:inline-block;transform:translateX(-30px)}
.score{display:flex;align-items:center;gap:16px;margin:10px 0 6px}.big{font:400 96px/.9 Anton;color:${C.org}}
.reasons{list-style:none;padding:0;margin:8px 0 0;display:grid;gap:8px}.reasons li{display:flex;gap:10px;align-items:center;font-weight:600;font-size:16px;background:#fff;border-radius:14px;padding:10px 12px}
.mk{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;flex:none;font:400 14px Anton;color:${C.cream}}.bad .mk{background:${C.org}}.good .mk{background:${C.olive}}
.swap{background:${C.pink};border-radius:22px;padding:16px 18px;margin-top:16px;transform:rotate(-1.5deg);position:relative}.swap b{font:400 22px Anton;text-transform:uppercase;display:block}
.cta{display:inline-flex;align-items:center;gap:8px;background:${C.ox};color:${C.cream};border-radius:999px;padding:12px 20px;font:400 17px Anton;letter-spacing:.06em;text-transform:uppercase}
.macros{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}.mac{background:#fff;border-radius:16px;padding:10px;text-align:center}.mac b{display:block;font:400 32px/1 Anton}.mac span{font-weight:700;font-size:12px;letter-spacing:.08em;text-transform:uppercase}
.tip{display:flex;gap:12px;align-items:flex-start;background:#fff;border-radius:18px;padding:10px 14px;margin-top:8px}.tip .ib{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;flex:none}
.tip b{display:block;font:400 19px/1.05 Anton;text-transform:uppercase}.tip small{font-size:14.5px;line-height:1.35;display:block;margin-top:2px}
.pill{display:inline-block;margin-top:6px;font-weight:800;font-size:11px;letter-spacing:.08em;text-transform:uppercase;border-radius:999px;padding:2px 9px}
.cap{text-align:center;font:400 18px Anton;letter-spacing:.12em;text-transform:uppercase;margin:0 0 14px}
`;

const home = `<div class="scr">
  <div class="bar"><b>BETTER PLATE</b><i>by Root Cause</i></div>
  <div class="pad" style="position:relative">
    <h2 class="h" style="max-width:240px">Good morning,<br>Maya</h2>
    <div class="script" style="margin-top:4px">one small swap at a time →</div>
    ${sticker('HABIT OF THE DAY • EAT IN ORDER • ', ic('list-numbers', 48), C.org, C.ox).replace('class="sticker"', 'class="sticker" style="right:14px;top:8px;transform:rotate(12deg);width:96px;height:96px"')}
    <div class="stats tex" style="margin-top:26px">
      <div class="stat"><b>64g</b><span>Protein</span><div class="track"><i style="width:71%"></i></div></div>
      <div class="stat"><b>17g</b><span>Fiber</span><div class="track"><i style="width:68%"></i></div></div>
      <div class="stat"><b>12g</b><span>Sugar</span><div class="track"><i style="width:48%;background:${C.org}"></i></div></div>
    </div>
    <div class="tiles">
      <div class="tile t1">${ic('barcode', 44)}<div><b>Scan a label</b><small>Is it a good pick?</small></div></div>
      <div class="tile t2 tex">${ic('fork-knife', 44)}<div><b>Check my plate</b><small>Balance it in seconds</small></div></div>
      <div class="tile t3">${ic('calendar-blank', 44)}<div><b>Plan my week</b><small>7 days, done</small></div></div>
      <div class="tile t4">${ic('book-open', 44)}<div><b>Learn</b><small>4 short reads</small></div></div>
    </div>
  </div>
  <div class="tabs"><div class="on">${ic('house', 26)}HOME</div><div>${ic('barcode', 26)}SCAN</div><div>${ic('fork-knife', 26)}PLATE</div><div>${ic('calendar-blank', 26)}PLAN</div><div>${ic('book-open', 26)}LEARN</div></div>
</div>`;

const scan = `<div class="scr">
  <div class="bar"><b>LABEL SCORE</b></div>
  ${ticker('READ THE LABEL, NOT THE FRONT OF THE BOX')}
  <div class="pad">
    <div class="script">cereal aisle, 9:14am</div>
    <h2 class="h" style="font-size:34px">Honey Oat Clusters</h2>
    <div class="score"><div class="big">20</div><div><b style="font:400 24px Anton;text-transform:uppercase;color:${C.org}">Worth swapping</b><div style="font-size:14px;font-weight:600">out of 100 · per 1 cup</div></div></div>
    <ul class="reasons">
      <li class="bad"><span class="mk">!</span>14g added sugar, over half a day\u2019s limit</li>
      <li class="bad"><span class="mk">!</span>Sugar is ingredient #2</li>
      <li class="bad"><span class="mk">!</span>Refined wheat flour</li>
      <li class="good"><span class="mk">✓</span>Good source of protein (5g)</li>
    </ul>
    <div class="swap"><span class="script" style="color:${C.ox};position:absolute;right:16px;top:-22px;transform:rotate(4deg)">try this instead!</span><b>Go protein-forward</b>Eggs and greens, or Greek yogurt with nuts and berries.</div>
    <div style="display:flex;gap:10px;align-items:center;margin-top:18px"><span class="cta">${ic('plus', 18)} Log a serving</span><span style="font-weight:700;text-decoration:underline">How scores work</span></div>
  </div>
  <div class="tabs"><div>${ic('house', 26)}HOME</div><div class="on">${ic('barcode', 26)}SCAN</div><div>${ic('fork-knife', 26)}PLATE</div><div>${ic('calendar-blank', 26)}PLAN</div><div>${ic('book-open', 26)}LEARN</div></div>
</div>`;

const plateSvg = `<svg viewBox="0 0 220 220" width="160" height="160"><circle cx="110" cy="110" r="104" fill="${C.cream}" stroke="${C.ox}" stroke-width="3"/><circle cx="110" cy="110" r="86" fill="none" stroke="${C.ox}" stroke-width="1.5" stroke-dasharray="3 5"/>
  <path d="M110 110 L110 30 A80 80 0 0 1 110 190Z" fill="${C.olive}"/><path d="M110 110 L110 190 A80 80 0 0 1 30 110Z" fill="${C.org}"/><path d="M110 110 L30 110 A80 80 0 0 1 110 30Z" fill="${C.pink}"/>
  <text x="152" y="116" font-family="Anton" font-size="17" fill="${C.cream}" text-anchor="middle">VEG</text><text x="76" y="152" font-family="Anton" font-size="13" fill="${C.cream}" text-anchor="middle">PROTEIN</text><text x="74" y="80" font-family="Anton" font-size="13" fill="${C.ox}" text-anchor="middle">CARBS</text></svg>`;
const plate = `<div class="scr">
  <div class="bar"><b>MY PLATE</b><i>lunch</i></div>
  <div class="tex" style="flex:none;padding:14px 20px;display:flex;align-items:center;gap:10px;position:relative">
    ${plateSvg}
    <div><div class="script" style="color:${C.ox}">pasta night,<br>but make it balanced</div></div>
  </div>
  ${ticker('VEGGIES FIRST • PROTEIN NEXT • CARBS LAST')}
  <div class="pad" style="padding-top:12px">
    <div class="macros"><div class="mac"><b>49g</b><span>Protein</span></div><div class="mac"><b>8g</b><span>Fiber</span></div><div class="mac"><b>80g</b><span>Carbs</span></div></div>
    <div class="tip"><div class="ib" style="background:${C.olive};color:${C.cream}">${ic('leaf', 30)}</div><div><b>Start with veggies</b><small>A few bites of greens before the pasta.</small><span class="pill" style="background:#fde2d6;color:${C.org}">Early evidence</span></div></div>
    <div class="tip"><div class="ib" style="background:${C.org};color:${C.cream}">${ic('arrows-clockwise', 30)}</div><div><b>Swap white pasta</b><small>Chickpea pasta, or go half veggies.</small><span class="pill" style="background:#e3e2c4;color:${C.olive}">Guideline</span></div></div>
    <div class="tip"><div class="ib" style="background:${C.pink};color:${C.ox}">${ic('person-simple-walk', 30)}</div><div><b>Walk 10 minutes after</b><small>Biggest effect after dinner.</small><span class="pill" style="background:#e1e8f4;color:#3c5f99">Moderate evidence</span></div></div>
  </div>
  <div class="tabs"><div>${ic('house', 26)}HOME</div><div>${ic('barcode', 26)}SCAN</div><div class="on">${ic('fork-knife', 26)}PLATE</div><div>${ic('calendar-blank', 26)}PLAN</div><div>${ic('book-open', 26)}LEARN</div></div>
</div>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div class="board">
<div class="bh"><h1>Preview D · Retro chic<span>app screens</span></h1><p>Oxblood, periwinkle linen, hot orange, pink and olive on cream. Tall all-caps headlines, easy-read body text, a handwritten note here and there, tilted color tiles, a sticker and a ticker. No people photos.</p></div>
<div class="phones"><div><p class="cap">Home</p><div class="phone">${home}</div></div><div><p class="cap">Label score</p><div class="phone">${scan}</div></div><div><p class="cap">Plate check</p><div class="phone">${plate}</div></div></div>
</div></body></html>`;
fs.writeFileSync(path.join(__dirname, 'preview-d.html'), html);
console.log('ok');
