// Server-rendered public pages. Copy is written for women with PCOS, in Root Cause NP's voice.
const CFG = require('./config');
const ICONS = require('./icons.json');
const { RECIPES } = require('./nutrition');
const LESSONS = require('./lessons');
const EV = require('./evidence');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic = (n, cls = '') => ICONS[n] ? `<svg class="i ${cls}" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true" focusable="false">${ICONS[n]}</svg>` : '';
const mark = `<svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14.5" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M16 16 L16 1.5 A14.5 14.5 0 0 1 30.5 16 Z" fill="var(--sage)"/><path d="M16 16 L30.5 16 A14.5 14.5 0 0 1 16 30.5 Z" fill="var(--clay)"/><circle cx="16" cy="16" r="5" fill="var(--bg)"/></svg>`;

const brandWord = () => { const w = esc(CFG.APP_NAME).split(' '); const last = w.pop(); return `<span class="brand-word">${w.join(' ')} <b>${last}</b></span>`; };

// Visible only while SHOW_OWNER_FLAGS=1 (default in development). Turn off before launch.
const flag = text => CFG.SHOW_OWNER_FLAGS ? `<div class="owner-flag" role="note"><strong>Owner to confirm:</strong> ${text}</div>` : '';

function layout({ title, description = '', body, user, bodyClass = '' }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="icon" href="/img/icon.svg" type="image/svg+xml">
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#88a5d3">
<link rel="apple-touch-icon" href="/img/icon-180.png">

<link rel="stylesheet" href="/css/site.css">
<script src="/js/consent.js" defer></script>
<script src="/js/http.js" defer></script>
<!-- Non-essential scripts go here as type="text/plain" with data-consent. They only run after consent. -->
<script type="text/plain" data-consent="analytics" data-src="/js/analytics-placeholder.js"></script>
</head>
<body class="${bodyClass}">
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap header-row">
    <a class="brand" href="/" aria-label="${esc(CFG.APP_NAME)} home">${brandWord()}</a>
    <nav class="site-nav" aria-label="Main">
      <a href="/#features">What it does</a>
      <a href="/#why">Why it works</a>
      <a href="/salespage">What’s included</a>
      ${user ? `<a class="btn btn-small" href="/app">Open app</a>` : `<a href="/login">Log in</a><a class="btn btn-small" href="/signup">Get started</a>`}
    </nav>
  </div>
</header>
<main id="main">${body}</main>
${footer()}
</body>
</html>`;
}

function footer() {
  return `<footer class="site-footer">
  <div class="wrap footer-grid">
    <div>
      <a class="brand" href="/">${brandWord()}</a>
      <p class="muted small footer-note">Food education and meal planning for women with PCOS. Not medical advice. Talk with your own clinician about your care.</p>
    </div>
    <nav aria-label="Legal" class="footer-links">
      <a href="/privacy">Privacy Policy</a>
      <a href="/terms">Terms of Use</a>
      <a href="/refunds">Cancellation &amp; Refunds</a>
      <a href="/cookies">Cookie Policy</a>
      <a href="/privacy-request">Privacy request</a>
      <a href="/evidence">Evidence &amp; methods</a>
      <button type="button" class="linklike" data-open-cookie-settings>Cookie settings</button>
    </nav>
  </div>
  <div class="wrap footer-base small muted"><span>© ${new Date().getFullYear()} ${esc(CFG.BRAND_NAME)}</span><span>We never sell or share your personal information.</span></div>
</footer>`;
}

// ---------- Product preview (phone mockup built in HTML, not a picture) ----------
const phonePreview = `
<div class="phone" role="img" aria-label="Preview of the app: a food label scored 20 out of 100, worth swapping, with a better swap suggested">
  <div class="phone-screen">
    <div class="pv-top"><span class="pv-kicker">Label score</span><span class="pv-dot"></span></div>
    <div class="pv-name">Honey Oat Clusters<span>Per 1 cup</span></div>
    <div class="pv-score"><div class="score-ring swap" style="--pct:20"><span>20</span></div><div><b>Worth swapping</b><span>out of 100</span></div></div>
    <ul class="pv-reasons">
      <li class="bad">High added sugar <em>14g</em></li>
      <li class="bad">Sugar in the first 3 ingredients</li>
      <li class="good">Some protein <em>5g</em></li>
    </ul>
    <div class="pv-proc"><span class="pv-kicker" style="width:100%">What\u2019s been done to it?</span><b>Ultra-processed signs</b> natural flavor, soy lecithin</div>
    <div class="pv-swap"><span class="pv-kicker">One better swap</span>Go protein-forward: eggs and greens, or Greek yogurt with nuts.</div>
    <div class="pv-tabs">${ic('house')}${ic('magnifying-glass', 'on')}${ic('fork-knife')}${ic('calendar-blank')}${ic('book-open')}</div>
  </div>
</div>`;

const HABITS = [
  ['leaf', 'Veggies first', 'A few bites of something green before the rest of the meal.'],
  ['list-numbers', 'Eat in order', 'Fiber, then protein and fat. The starchy or sweet part last.'],
  ['sun-horizon', 'Protein-forward breakfast', 'Start the day with real protein, like eggs and greens.'],
  ['egg', 'Pair your carbs', 'Don\u2019t eat carbs on their own. Add protein, fat or fiber.'],
  ['cookie', 'Sweets after a meal', 'Have it as dessert, not as an empty-stomach snack.'],
  ['person-simple-walk', 'Move after eating', 'Ten easy minutes. A walk counts. So do the dishes.'],
];

function landing({ user }) {
  const cta = user ? `<a class="btn btn-big" href="/app">Open your app</a>` : `<a class="btn btn-big" href="/signup">Create your free account</a>`;
  const body = `
<section class="hero">
  <div class="wrap hero-grid">
    <div class="hero-copy">
      <p class="eyebrow">For women with PCOS, insulin resistance or prediabetes</p>
      <h1>Eat for steadier blood sugar. <em>Without a diet.</em></h1>
      <p class="lead">Better Plate tells you in seconds whether a food or meal supports your blood sugar, and the one change that makes it better. Then it helps you plan the week, build the grocery list and stock your kitchen. Every tip is grounded in the international PCOS guideline and the research behind it.</p>
      <div class="cta-row">${cta}<a class="btn btn-ghost" href="#demo">Try the label score</a></div>
      ${flag('Is the app free, or will it be paid? The page currently says "free account". No price has been supplied.')}
      <ul class="hero-points">
        <li>${ic('device-mobile')} Made for your phone</li><li>${ic('scales')} No calorie counting</li><li>${ic('lock-simple')} Your data is never sold</li>
      </ul>
    </div>
    <div class="hero-art">
      <div class="arch" aria-hidden="true"></div>
      ${phonePreview}
      <div class="float-card" aria-hidden="true">${ic('list-numbers')}<div><b>Eat it in this order</b><span>Veggies, protein, then carbs</span></div></div>
    </div>
  </div>
</section>
<div class="ticker-band" aria-hidden="true"><span>Veggies first \u2022 <b>Protein next</b> \u2022 Carbs last \u2022 <b>Read the label, not the box</b> \u2022 Add before you subtract \u2022 <b>Move 10 minutes after meals</b> \u2022 Veggies first \u2022 <b>Protein next</b> \u2022 Carbs last \u2022</span></div>

<section class="band band-quiet">
  <div class="wrap narrow center">
    <p class="eyebrow">Sound familiar?</p>
    <div class="quotes">
      <blockquote>“I’m reading the label in the grocery aisle and I still don’t know if it’s a good pick.”</blockquote>
      <blockquote>“Lunch looked healthy. Then the 3pm crash hit anyway.”</blockquote>
      <blockquote>“I was told to just lose weight, with zero help on what to actually eat.”</blockquote>
    </div>
    <p class="lead">You don’t need more willpower. You need a clearer picture of what’s on your plate. That’s what this is for.</p>
  </div>
</section>

<section id="features" class="band">
  <div class="wrap">
    <div class="section-head"><p class="eyebrow">What the app does</p><h2>Answers the questions you actually have.</h2></div>
    <ol class="feature-list">
      <li><span class="fl-icon">${ic('barcode')}</span><div><h3>Is this food a good pick?</h3><p>Score any label. See what\u2019s in it (added sugar, fiber, protein) and what\u2019s been done to it (signs of ultra-processing), plus one better swap.</p></div></li>
      <li><span class="fl-icon">${ic('fork-knife')}</span><div><h3>Is my plate balanced?</h3><p>Tap what\u2019s on your plate. See protein, fiber and carbs, and what to add, swap or eat first.</p></div></li>
      <li><span class="fl-icon">${ic('target')}</span><div><h3>Am I on track today?</h3><p>Protein and fiber goals and an added-sugar limit, in big numbers you can read at a glance.</p></div></li>
      <li><span class="fl-icon">${ic('calendar-blank')}</span><div><h3>What should I eat this week?</h3><p>${RECIPES.length} balanced meals and snacks. Fill your week in one tap and the grocery list writes itself, grouped by aisle.</p></div></li>
      <li><span class="fl-icon">${ic('basket')}</span><div><h3>Is my kitchen set up?</h3><p>Fridge, freezer and pantry staples with a label check for each, snack ideas, and a pantry list sorted into keep and swap when it runs out.</p></div></li>
      <li><span class="fl-icon">${ic('user-focus')}</span><div><h3>How am I actually doing?</h3><p>A 20-second daily check-in for energy, mood, cravings, sleep, your period and symptoms. See your cycle length, your patterns, and wins that aren\u2019t the scale.</p></div></li>
      <li><span class="fl-icon">${ic('clipboard-text')}</span><div><h3>Ready for my appointment?</h3><p>Add your labs to see them next to official prediabetes and metabolic syndrome ranges. Then print a one-page summary of your cycles, symptoms, habits and labs, plus the tests and questions to bring up.</p></div></li>
      <li><span class="fl-icon">${ic('book-open')}</span><div><h3>Why does this work?</h3><p>${LESSONS.length} short lessons on insulin resistance, real food vs. ultra-processed, planning and more, each linked to its research.</p></div></li>
    </ol>
  </div>
</section>

<section id="why" class="band band-peri">
  <div class="wrap">
    <div class="section-head"><p class="eyebrow" style="color:var(--ink)">Why it works for insulin resistance</p><h2>Built on the guideline, not a trend.</h2>
      <p class="lead" style="color:var(--ink)">Insulin resistance is common in PCOS, including in lean women, and it can drive symptoms like irregular cycles, acne and energy crashes. The good news: the first step the 2023 international PCOS guideline recommends is something you control every day.</p></div>
    <div class="habit-grid">
      <div class="habit">${ic('seal-check')}<h3>Lifestyle first</h3><p>Healthy eating and movement are recommended for every woman with PCOS, and help even without weight loss. No single diet is best, so you choose what fits.</p></div>
      <div class="habit">${ic('leaf')}<h3>Fiber, 25g+ a day</h3><p>People eating 25 to 29g of fiber a day have lower risk of type 2 diabetes and heart disease. Most women fall short, so there\u2019s room to add.</p></div>
      <div class="habit">${ic('egg')}<h3>Protein at meals</h3><p>In a 6-month trial in women with PCOS, more protein in place of some carbs improved glucose measures.</p></div>
      <div class="habit">${ic('person-simple-walk')}<h3>Muscles soak up sugar</h3><p>150 minutes of activity a week plus strength work twice a week. A 10-minute walk after meals is an easy start.</p></div>
      <div class="habit">${ic('flask')}<h3>More real food</h3><p>On an ultra-processed diet, people ate about 500 more calories a day without feeling fuller. Whole foods are a low-risk, high-reward swap.</p></div>
      <div class="habit">${ic('heart')}<h3>Progress, not perfection</h3><p>No food is off-limits. Add before you subtract, swap one pantry item at a time, and keep a 2-minute version for hard days.</p></div>
    </div>
    <p style="margin-top:20px"><a class="text-link" href="/evidence">See every source and how strong the evidence is ${ic('arrow-right')}</a></p>
  </div>
</section>

<section id="habits" class="band band-sage">
  <div class="wrap">
    <div class="section-head"><p class="eyebrow">Built on how your body handles food</p><h2>Same food. <em>Steadier blood sugar.</em></h2>
      <p class="lead">The order and pairing of your food can change how your body handles it. Every plate you check comes with these habits built into the tips, and each one shows how strong the evidence is behind it.</p>
      <p><a class="text-link" href="/evidence">See the research behind every tip ${ic('arrow-right')}</a></p></div>
    <div class="habit-grid">
      ${HABITS.map(([i, t, d]) => `<div class="habit">${ic(i)}<h3>${t}</h3><p>${d}</p></div>`).join('')}
    </div>
  </div>
</section>

<section id="demo" class="band">
  <div class="wrap demo-grid">
    <div>
      <p class="eyebrow">Try it now</p>
      <h2>Grab something from your pantry.</h2>
      <p class="lead">Type in the numbers from one serving. No account needed for this demo, and nothing you type here is saved.</p>
      <form id="demo-form" class="card form" novalidate>
        <label>Food name<input name="name" required maxlength="120" placeholder="e.g. Honey Oat Clusters" value="Honey Oat Clusters"></label>
        <div class="grid-2">
          <label>Added sugar (g)<input name="added_sugar" inputmode="decimal" required value="14"></label>
          <label>Fiber (g)<input name="fiber" inputmode="decimal" required value="2"></label>
          <label>Protein (g)<input name="protein" inputmode="decimal" required value="5"></label>
          <label>Total carbs (g)<input name="total_carbs" inputmode="decimal" required value="40"></label>
        </div>
        <label>Ingredients (optional, checks processing)<textarea name="ingredients" rows="2">Whole grain oats, sugar, enriched wheat flour, honey, canola oil, salt, soy lecithin, natural flavor</textarea></label>
        <button class="btn" type="submit">Score it</button>
        <p class="form-error" role="alert" hidden></p>
      </form>
    </div>
    <div id="demo-result" class="card result-card" aria-live="polite"><p class="muted">Your score shows up here.</p></div>
  </div>
</section>

<section class="band band-quiet">
  <div class="wrap narrow center">
    <p class="eyebrow">Who made this</p>
    <h2>From a nurse practitioner led PCOS practice.</h2>
    <p class="lead">${esc(CFG.APP_NAME)} comes from ${esc(CFG.BRAND_NAME)}. It’s built around one idea: add, don’t restrict. At every meal, ask where you can add more support.</p>
    ${flag('Add an approved founder bio/photo here if you want one. No testimonials or results are shown because none were supplied.')}
  </div>
</section>

<section class="band">
  <div class="wrap narrow">
    <div class="section-head center"><p class="eyebrow">Questions</p><h2>Before you sign up</h2></div>
    <div class="faq">
      <details><summary>Is this a diet?</summary><p>No. There are no calorie counts and no foods you’re told you can never eat. The app helps you add protein and fiber, change the order you eat in, and spot easy swaps.</p></details>
      <details><summary>Does the photo feature recognize my food automatically?</summary><p>Not yet. You add your photo and tap the foods on your plate. It takes about 20 seconds. The estimates come from standard portion sizes, so they’re a guide, not lab-exact numbers.</p></details>
      <details><summary>Do I need to scan a barcode?</summary><p>No barcode needed. You type four numbers from the Nutrition Facts panel and paste the ingredients if you want the full score.</p></details>
      <details><summary>I have prediabetes or metabolic syndrome, not PCOS. Is this for me?</summary><p>Yes. The habits in this app (more fiber and protein, fewer ultra-processed foods, moving after meals) are the same ones behind the Diabetes Prevention Program, where a lifestyle program cut new cases of type 2 diabetes by 58%. Set your focus to prediabetes and the app suggests the right lessons first.</p></details>
      <details><summary>Will this help me talk to my doctor?</summary><p>That\u2019s one of the main reasons it exists. Many women with PCOS feel brushed off. The appointment report puts your cycles, symptoms, habits and labs on one page, with the tests the PCOS guideline recommends and the questions you want to ask.</p></details>
      <details><summary>Is this evidence-based?</summary><p>Yes, and we\u2019re upfront about how strong the evidence is. Every tip and lesson links to its sources and is labeled guideline, strong, moderate, early or reasoned-not-tested. Many blood sugar habits were studied in type 2 diabetes rather than PCOS, and we say so. <a href="/evidence">See our evidence and methods</a>.</p></details>
      <details><summary>Does this replace my doctor or nurse practitioner?</summary><p>No. This is education and a daily planning tool. It doesn’t diagnose or treat anything. Keep your clinician in the loop, especially about medications or big changes.</p></details>
      <details><summary>I’m already tired. Is this one more thing to keep up with?</summary><p>It sounds like you’re running on empty, and that makes sense. Start with one thing. Eat your veggies first at dinner tonight. Small changes add up.</p></details>
      <details><summary>What happens to my data?</summary><p>We never sell or share your personal information, and there are no ad trackers. You can download or delete your data from your account page, or send a <a href="/privacy-request">privacy request</a>.</p></details>
      <details><summary>Does it cost anything?</summary><p>Creating an account is free.</p>${flag('Confirm pricing. If this becomes paid, add the price and native HighLevel checkout here.')}</details>
    </div>
  </div>
</section>

<section class="band band-ink final-cta">
  <div class="wrap narrow center">
    <h2>Your next meal is a good place to start.</h2>
    <p class="lead">Make an account, score your first label, and build one better plate today.</p>
    ${cta}
  </div>
</section>
<script src="/js/icons.js" defer></script>
<script src="/js/demo.js" defer></script>`;
  return layout({ title: `${CFG.APP_NAME} for PCOS`, description: 'Score food labels, balance your plate for blood sugar, hit protein and fiber targets, and plan meals. Made for women with PCOS.', body, user });
}

function salesPage({ user }) {
  const cta = user ? `<a class="btn btn-big" href="/app">Open your app</a>` : `<a class="btn btn-big" href="/signup">Create your free account</a>`;
  const body = `
<section class="hero hero-slim">
  <div class="wrap narrow center">
    <p class="eyebrow">What’s included</p>
    <h1>The grocery aisle, the dinner table <em>and the week ahead.</em></h1>
    <p class="lead">Built for women with PCOS who are tired of guessing. Here’s exactly what you get when you sign up.</p>
    ${cta}
  </div>
</section>
<section class="band">
  <div class="wrap">
    <div class="offer-grid">
      <div class="offer-list card">
        <h2>Your account includes</h2>
        <ul class="checks">
          <li><b>Label score.</b> A 0 to 100 score with the reasons behind it, plus one better swap. Every scan is saved so you can find it again.</li>
          <li><b>Plate check.</b> Add a photo, tap your foods, and get estimated protein, fiber, carbs and fat with tips on what to add, swap, or eat first.</li>
          <li><b>Blood sugar habits, built in.</b> Veggies first, eating in order, protein-forward breakfasts, pairing carbs and moving after you eat. Each one is linked to its research and labeled with how strong the evidence is.</li>
          <li><b>Daily targets.</b> Protein, fiber and added sugar for each day. Set your own numbers.</li>
          <li><b>Weekly meal planner + grocery list.</b> ${RECIPES.length} balanced meals and snacks, a one-tap “fill my week”, daily totals, and a grocery list grouped by aisle.</li>
          <li><b>Kitchen setup.</b> Fridge, freezer and pantry staples with what to look for on each label, snack ideas, and a pantry list sorted into keep and swap when it runs out.</li>
          <li><b>Processing check.</b> Every label shows what’s in it and what’s been done to it, so you can spot ultra-processed foods.</li>
          <li><b>${LESSONS.length} short lessons.</b> ${LESSONS.map(l => esc(l.title)).join(' · ')}.</li>
          <li><b>Your data, your call.</b> Download or delete everything from your account page.</li>
        </ul>
      </div>
      <div class="price card">
        <p class="eyebrow">Price</p>
        <p class="price-big">Free account</p>
        ${flag('No pricing supplied. If this becomes paid, replace this box with your HighLevel product/price and native checkout. Paid access must only be granted from the payment provider’s confirmed payment event.')}
        ${cta}
        <p class="small muted">Not medical advice. Always check with your clinician about your own care.</p>
      </div>
    </div>
  </div>
</section>
<section class="band band-ink"><div class="wrap narrow center">
  <h2>Ready to stop guessing?</h2>
  <p class="lead">Nothing changes if nothing changes. Start with one label.</p>${cta}
</div></section>`;
  return layout({ title: `What’s included | ${CFG.APP_NAME}`, description: 'Everything included in your account.', body, user });
}

function evidencePage({ user }) {
  const lvl = Object.entries(EV.LEVELS).map(([k, v]) => `<li><span class="ev ev-${k}">${v.label}</span> ${esc(v.text)}</li>`).join('');
  const refs = EV.ORDER.map((id, i) => { const r = EV.REFS[id]; return `<li id="ref-${id}"><span class="ref-n">${i + 1}</span><div><p class="ref-cite">${esc(r.cite)}</p><p class="small muted">${esc(r.note)}</p><a class="small" href="${esc(r.url)}" rel="noopener noreferrer" target="_blank">View source</a></div></li>`; }).join('');
  const body = `<section class="band"><div class="wrap narrow prose">
    <p class="eyebrow">Evidence &amp; methods</p>
    <h1>What the advice in this app is based on</h1>
    <p class="lead">Every tip, lesson section and default target in ${esc(CFG.APP_NAME)} links back to a source on this page, with a label showing how strong the evidence is. When the research is thin, or comes from people with type 2 diabetes instead of PCOS, we say so.</p>
    <h2>How we rate evidence</h2>
    <ul class="ev-list">${lvl}</ul>
    <h2>Where the evidence for PCOS stands</h2>
    <p>The 2023 international PCOS guideline is the main reference. It recommends healthy eating and regular physical activity for everyone with PCOS, notes they help even without weight loss, and found no single diet that works better than the others. Much of the research on meal order, walking after meals and vinegar comes from small studies in type 2 diabetes or prediabetes. Those habits are low-risk and reasonable to try, but they\u2019re not proven to treat PCOS.</p>
    <h2 id="label-score">How the label score works</h2>
    <p>The 0 to 100 label score is a transparent rule of thumb. It is <b>not</b> a validated clinical tool. It starts at 50 and adds or takes away points for one serving:</p>
    <ul>
      <li><b>Added sugar:</b> 0g scores best. Over 10g in one serving (more than 40% of the roughly 25g daily limit for women<sup><a href="#ref-aha2009">${EV.refNumber('aha2009')}</a></sup>) loses the most points.</li>
      <li><b>Fiber and protein:</b> use the FDA cut-offs for a \u201Cgood source\u201D (10% of the Daily Value) and \u201Chigh\u201D (20%)<sup><a href="#ref-fda10154">${EV.refNumber('fda10154')}</a></sup>. That works out to 2.8g and 5.6g of fiber, and 5g and 10g of protein.</li>
      <li><b>Carb-to-fiber ratio:</b> 10:1 or better earns points<sup><a href="#ref-mozaffarian2013">${EV.refNumber('mozaffarian2013')}</a></sup>.</li>
      <li><b>Ingredients:</b> a sugar in the first three ingredients, refined flour or starch<sup><a href="#ref-dga2020">${EV.refNumber('dga2020')}</a></sup>, and partially hydrogenated oil<sup><a href="#ref-fdatrans">${EV.refNumber('fdatrans')}</a></sup> lose points. A whole food listed first gains a few.</li>
    </ul>
    <p>The exact point values are our judgment, chosen so that these cut-offs line up with the grades. Think of the score as a quick comparison between two products, not a verdict on your health.</p>
    <h2 id="plate-estimates">How plate estimates work</h2>
    <p>Plate numbers come from typical values for standard portions of each food. They\u2019re estimates, and your real portions will differ. The \u201Cbalanced plate\u201D comparison uses the plate method: half non-starchy vegetables, a quarter protein, a quarter carbohydrate foods<sup><a href="#ref-adaplate">${EV.refNumber('adaplate')}</a></sup>.</p>
    <h2 id="targets">Default daily targets</h2>
    <ul>
      <li><b>Fiber 25g:</b> the adequate intake for women 19 to 50 (21g after 50)<sup><a href="#ref-iom2005">${EV.refNumber('iom2005')}</a></sup>.</li>
      <li><b>Added sugar under 25g:</b> the American Heart Association limit for most women<sup><a href="#ref-aha2009">${EV.refNumber('aha2009')}</a></sup>.</li>
      <li><b>Protein 90g:</b> a starting point above the minimum RDA of 0.8g per kg of body weight<sup><a href="#ref-iom2005">${EV.refNumber('iom2005')}</a></sup>. It reflects research where higher-protein eating helped women with PCOS<sup><a href="#ref-sorensen2012">${EV.refNumber('sorensen2012')}</a></sup>. There\u2019s no official PCOS protein target. Adjust it with your clinician, and check with them first if you have kidney disease.</li>
    </ul>
    ${flag('Confirm the 90g protein default, or switch to a weight-based default (for example 1.0 to 1.2g per kg). All lessons and tips should be clinically reviewed before launch.')}
    <h2>References</h2>
    <ol class="refs">${refs}</ol>
    <p class="small muted">Sources were checked in November 2026. Educational only, not medical advice.</p>
  </div></section>`;
  return layout({ title: `Evidence & methods | ${CFG.APP_NAME}`, description: 'The research behind every tip, lesson and score in the app.', body, user });
}

function authPage(kind, { user, next = '' }) {
  const isSignup = kind === 'signup';
  const body = `
<section class="auth-wrap">
  <div class="card auth-card">
    <h1>${isSignup ? 'Create your account' : 'Welcome back'}</h1>
    <p class="muted">${isSignup ? 'Start building better plates in under a minute.' : 'Log in to your plates, plans and targets.'}</p>
    <form id="auth-form" class="form" data-kind="${kind}" data-next="${esc(next)}" novalidate>
      ${isSignup ? '<label>First name<input name="name" autocomplete="given-name" required maxlength="60"></label>' : ''}
      <label>Email<input name="email" type="email" autocomplete="email" required maxlength="200"></label>
      <label>Password<input name="password" type="password" autocomplete="${isSignup ? 'new-password' : 'current-password'}" required minlength="${isSignup ? 10 : 1}" maxlength="200">
        ${isSignup ? '<span class="hint">At least 10 characters.</span>' : ''}</label>
      ${isSignup ? `
      <label class="check"><input type="checkbox" name="accept_terms" required> <span>I agree to the <a href="/terms" target="_blank">Terms of Use</a> and have read the <a href="/privacy" target="_blank">Privacy Policy</a>.</span></label>
      <label class="check"><input type="checkbox" name="marketing_opt_in"> <span>Email me tips and updates (optional, unsubscribe anytime).</span></label>` : ''}
      <button class="btn btn-block" type="submit">${isSignup ? 'Create account' : 'Log in'}</button>
      <p class="form-error" role="alert" hidden></p>
    </form>
    <p class="small center">${isSignup ? 'Already have an account? <a href="/login">Log in</a>' : 'New here? <a href="/signup">Create an account</a> · <a href="/forgot">Forgot password?</a>'}</p>
  </div>
</section>
<script src="/js/auth.js" defer></script>`;
  return layout({ title: `${isSignup ? 'Sign up' : 'Log in'} | ${CFG.APP_NAME}`, body, user, bodyClass: 'soft' });
}

function forgotPage({ user, token }) {
  const body = token ? `
<section class="auth-wrap"><div class="card auth-card">
  <h1>Set a new password</h1>
  <form id="reset-form" class="form" novalidate data-token="${esc(token)}">
    <label>New password<input name="password" type="password" autocomplete="new-password" minlength="10" required><span class="hint">At least 10 characters.</span></label>
    <button class="btn btn-block">Save password</button>
    <p class="form-error" role="alert" hidden></p>
  </form></div></section><script src="/js/auth.js" defer></script>` : `
<section class="auth-wrap"><div class="card auth-card">
  <h1>Reset your password</h1>
  <p class="muted">Enter your email. If there’s an account, we’ll send a secure link that works for 1 hour.</p>
  <form id="forgot-form" class="form" novalidate>
    <label>Email<input name="email" type="email" required autocomplete="email"></label>
    <button class="btn btn-block">Send reset link</button>
    <p class="form-error" role="alert" hidden></p>
  </form></div></section><script src="/js/auth.js" defer></script>`;
  return layout({ title: `Reset password | ${CFG.APP_NAME}`, body, user, bodyClass: 'soft' });
}

const MISSING = label => `<mark class="missing">[MISSING: ${label}]</mark>`;

function policyShell(title, intro, sections, user) {
  const body = `<section class="band"><div class="wrap narrow prose">
    <h1>${title}</h1>
    <p class="muted small">Policy version ${esc(CFG.POLICY_VERSION)} · Effective date: ${MISSING('effective date')}</p>
    <div class="draft-note" role="note"><strong>Draft.</strong> This page lists how the app actually works. The business details and legal wording must be supplied or approved by the owner (and ideally a lawyer) before launch. Items marked MISSING are not filled in yet.</div>
    ${intro}
    ${sections.map(([h, html]) => `<h2>${h}</h2>${html}`).join('')}
  </div></section>`;
  return layout({ title: `${title} | ${CFG.APP_NAME}`, body, user });
}

const contactBlock = `<p>Business name: ${MISSING('legal business name')}<br>Address: ${MISSING('business mailing address')}<br>Contact email: ${MISSING('privacy contact email')}</p>`;

function privacyPage({ user }) {
  return policyShell('Privacy Policy', `<p><strong>We never sell or share your personal information.</strong> We do not use advertising pixels or third-party ad trackers.</p>`, [
    ['Who we are', contactBlock],
    ['What we collect', `<ul>
      <li><b>Account:</b> first name, email, a securely hashed password, and whether you opted in to marketing emails.</li>
      <li><b>What you put in the app:</b> food labels you score, plates you build, photos you upload, food logs, daily targets, meal plans, lesson progress, daily check-ins (energy, mood, cravings, sleep, period and symptoms), lab results you enter, and 7-day experiments.</li>
      <li><b>Consent records:</b> an anonymous visitor ID, your cookie choices, the date, your browser’s user agent and an approximate region based on your time zone.</li>
      <li><b>Privacy requests:</b> the email and details you send through the privacy request form.</li></ul>`],
    ['How we use it', `<p>To run the app for you: save your entries, show your scores, plans and progress, keep your account secure, and answer privacy requests. Marketing emails only if you opted in.</p>`],
    ['Health-related information', `<p>Food and meal information can feel personal. We use it only to show it back to you inside the app. It is never sold, shared for advertising or used to build ad profiles.</p>${MISSING('owner/legal review of any health-data laws that apply (for example state consumer health data laws). Confirm whether HIPAA applies to this app or not.')}`],
    ['Who can see it', `<p>Only you can see your entries and photos. The owner/admin can see compliance records (consent log, signup consents, privacy requests). When you scan a barcode, our server looks up only the barcode number in the public Open Food Facts database; nothing about you is sent. Our hosting and database provider stores the data on our behalf: ${MISSING('hosting provider name and location (HighLevel)')}.</p>`],
    ['Cookies', `<p>See our <a href="/cookies">Cookie Policy</a>. Non-essential cookies only run if you say yes. We honor Global Privacy Control signals.</p>`],
    ['Your rights', `<p>You can access, download, correct or delete your data. Use the <a href="/privacy-request">privacy request form</a>, or download and delete your account yourself from your account page in the app.</p>`],
    ['Retention and deletion', `<p>When you delete your account, we delete your profile, entries, photos and logs. We keep only records we are required to keep, such as consent records and invoices if any purchases are ever made. ${MISSING('retention periods for retained records')}</p>`],
    ['Children', `<p>This app is not for children under ${MISSING('minimum age, e.g. 18')}.</p>`],
    ['Changes', `<p>If we change this policy we’ll update the version and date above.</p>`],
  ], user);
}

function termsPage({ user }) {
  return policyShell('Terms of Use', '', [
    ['Who we are', contactBlock],
    ['Not medical advice', `<p>The app gives general food education and planning tools. It does not diagnose, treat or replace care from your own clinician. Scores and nutrient numbers are estimates.</p>`],
    ['Your account', `<p>Keep your password private. You are responsible for activity on your account.</p>`],
    ['Acceptable use', `<p>Don’t misuse the app, try to access other people’s data, or upload anything illegal.</p>`],
    ['Legal terms', `<p>${MISSING('owner-supplied legal terms: liability limits, governing law, dispute resolution, termination')}</p>`],
  ], user);
}

function refundsPage({ user }) {
  return policyShell('Cancellation & Refund Policy', '', [
    ['Current plan', `<p>Accounts are currently free. There is nothing to buy, so there are no charges to cancel or refund.</p>`],
    ['Closing your account', `<p>You can delete your account at any time from the Account page in the app.</p>`],
    ['If paid plans are added', `<p>${MISSING('owner-supplied cancellation and refund terms, required before any paid plan goes live')}</p>`],
  ], user);
}

function cookiesPage({ user }) {
  return policyShell('Cookie Policy', '', [
    ['What we use', `<table class="table"><thead><tr><th>Name</th><th>Category</th><th>Purpose</th><th>Lasts</th></tr></thead><tbody>
      <tr><td>sid</td><td>Necessary</td><td>Keeps you logged in</td><td>30 days</td></tr>
      <tr><td>vid</td><td>Necessary</td><td>Anonymous ID used to record your cookie choice</td><td>1 year</td></tr>
      <tr><td>cc</td><td>Necessary</td><td>Remembers your cookie choice</td><td>1 year</td></tr>
    </tbody></table>
    <p>There are no analytics or marketing cookies running today. If the owner adds analytics later, they will only load after you choose to allow analytics.</p>`],
    ['Your choices', `<p>Use <button type="button" class="linklike" data-open-cookie-settings>Cookie settings</button> (also in every footer) to change your choice anytime. Visitors in the EU and UK get strict opt-in. We honor Global Privacy Control: if your browser sends it, marketing stays off.</p>`],
    ['No ad tracking', `<p>We do not use advertising pixels or third-party ad trackers.</p>`],
  ], user);
}

function privacyRequestPage({ user }) {
  const body = `<section class="band"><div class="wrap narrow">
    <h1>Privacy request</h1>
    <p class="lead">Ask to see, correct or delete the personal data we hold about you. We’ll reply by email.</p>
    <form id="pr-form" class="card form" novalidate>
      <label>Email on your account<input name="email" type="email" required maxlength="200" autocomplete="email"></label>
      <fieldset><legend>What would you like?</legend>
        <label class="check"><input type="radio" name="type" value="access" checked> <span>Get a copy of my data</span></label>
        <label class="check"><input type="radio" name="type" value="correct"> <span>Correct my data</span></label>
        <label class="check"><input type="radio" name="type" value="delete"> <span>Delete my data</span></label>
      </fieldset>
      <label>Details (optional)<textarea name="details" rows="3" maxlength="2000"></textarea></label>
      <div class="hp" aria-hidden="true"><label>Leave empty<input name="website" tabindex="-1" autocomplete="off"></label></div>
      <button class="btn">Send request</button>
      <p class="form-error" role="alert" hidden></p>
    </form>
    <div id="pr-done" class="card success" hidden><h2>Request received</h2><p>We’ll be in touch by email. For your security we may need to confirm it’s you before we act on it.</p></div>
    <p class="small muted">Logged in? You can also download or delete your data yourself on the Account page in the app.</p>
  </div></section><script src="/js/forms.js" defer></script>`;
  return layout({ title: `Privacy request | ${CFG.APP_NAME}`, body, user });
}

function adminPage({ user }) {
  const body = `<section class="band"><div class="wrap">
    <h1>Compliance</h1>
    <p class="muted">Owner only. Consent log, signup consents and privacy requests.</p>
    <div class="tabs" role="tablist">
      <button role="tab" class="tab on" data-tab="consents">Consent log</button>
      <button role="tab" class="tab" data-tab="signups">Signup consents</button>
      <button role="tab" class="tab" data-tab="requests">Data requests</button>
      <button role="tab" class="tab" data-tab="outbox">Email outbox</button>
    </div>
    <div class="admin-panel" data-panel="consents">
      <form class="filter-row" id="consent-filter">
        <label>From<input type="date" name="from"></label><label>To<input type="date" name="to"></label>
        <button class="btn btn-small">Filter</button>
        <a class="btn btn-small btn-ghost" id="consent-csv" href="/api/admin/consents.csv" download>Export CSV</a>
      </form>
      <div class="table-wrap"><table class="table" id="consent-table"></table></div>
    </div>
    <div class="admin-panel" data-panel="signups" hidden>
      <a class="btn btn-small btn-ghost" href="/api/admin/signups.csv" download>Export CSV</a>
      <div class="table-wrap"><table class="table" id="signup-table"></table></div>
    </div>
    <div class="admin-panel" data-panel="requests" hidden>
      <a class="btn btn-small btn-ghost" href="/api/admin/requests.csv" download>Export CSV</a>
      <div class="table-wrap"><table class="table" id="request-table"></table></div>
    </div>
    <div class="admin-panel" data-panel="outbox" hidden>
      <p class="small muted">Emails the app has queued. Live sending needs an email connection (see setup notes).</p>
      <div class="table-wrap"><table class="table" id="outbox-table"></table></div>
    </div>
  </div></section><script src="/js/admin.js" defer></script>`;
  return layout({ title: `Compliance | ${CFG.APP_NAME}`, body, user });
}

function appShell({ user }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(CFG.APP_NAME)}</title><link rel="icon" href="/img/icon.svg" type="image/svg+xml">
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#88a5d3">
<link rel="apple-touch-icon" href="/img/icon-180.png">

<link rel="stylesheet" href="/css/site.css"><link rel="stylesheet" href="/css/app.css">
<script src="/js/consent.js" defer></script>
<script type="text/plain" data-consent="analytics" data-src="/js/analytics-placeholder.js"></script>
</head><body class="app-body">
<a class="skip" href="#view">Skip to content</a>
<header class="app-header"><a class="brand" href="#/today">${brandWord()}</a>
<span class="hello">Hi, ${esc(user.name)}</span>${user.role === 'owner' ? '<a class="small" href="/admin/compliance">Compliance</a>' : ''}<a class="small" href="#/account">Account</a></header>
<main id="view" tabindex="-1" class="app-main"></main>
<nav class="tabbar" aria-label="App">
  <a href="#/today" data-nav="today">${ic('house')}Today</a>
  <a href="#/scan" data-nav="scan">${ic('barcode')}Scan</a>
  <a href="#/plate" data-nav="plate">${ic('fork-knife')}Plate</a>
  <a href="#/plan" data-nav="plan">${ic('calendar-blank')}Plan</a>
  <a href="#/me" data-nav="me">${ic('user-focus')}Me</a>
  <a href="#/learn" data-nav="learn">${ic('book-open')}Learn</a>
</nav>
<footer class="app-footer small"><a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <a href="/refunds">Refunds</a> · <a href="/cookies">Cookies</a> · <a href="/privacy-request">Privacy request</a> · <a href="/evidence">Evidence</a> · <button type="button" class="linklike" data-open-cookie-settings>Cookie settings</button><br>Educational only, not medical advice.</footer>
<script src="/js/icons.js" defer></script>
<script src="/js/app.js" defer></script>
</body></html>`;
}

function errorPage({ user, code, message }) {
  const body = `<section class="band"><div class="wrap narrow center"><h1>${code === 404 ? 'We couldn’t find that page' : 'Something went wrong'}</h1><p class="lead">${esc(message)}</p><a class="btn" href="/">Go home</a></div></section>`;
  return layout({ title: `${code} | ${CFG.APP_NAME}`, body, user });
}

module.exports = { evidencePage, landing, salesPage, authPage, forgotPage, privacyPage, termsPage, refundsPage, cookiesPage, privacyRequestPage, adminPage, appShell, errorPage, esc };
