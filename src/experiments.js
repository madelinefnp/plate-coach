// 7-day personal experiments: try one habit, mark the days you did it, and compare your own check-ins
// with the 7 days before. A personal experiment shows a pattern for you, not proof.
const { db } = require('./db');

const EXPERIMENTS = [
  { key: 'veggies_first', icon: 'leaf', color: 'c-lime', title: 'Veggies first', daily: 'Eat a few bites of veggies before the rest of your biggest meal.',
    why: 'In small studies, eating vegetables before carbs lowered blood sugar swings.', watch: ['energy', 'cravings'], level: 'early', refs: ['imai2014', 'shukla2015'] },
  { key: 'protein_breakfast', icon: 'sun-horizon', color: 'c-pink', title: 'Protein-forward breakfast', daily: 'Have a breakfast with at least 20g of protein.',
    why: 'A higher-protein breakfast reduced cravings and evening snacking in a small trial.', watch: ['cravings', 'energy'], level: 'early', refs: ['leidy2013'] },
  { key: 'walk_after_dinner', icon: 'person-simple-walk', color: 'c-peri', title: '10-minute walk after dinner', daily: 'Walk (or tidy, or do squats) for 10 minutes after dinner.',
    why: 'Walking after meals lowered after-meal blood sugar in a randomized trial, most of all after dinner.', watch: ['energy', 'sleep'], level: 'moderate', refs: ['reynolds2016'] },
  { key: 'fiber_25', icon: 'plant', color: 'c-lime', title: 'Hit 25g of fiber', daily: 'Reach your fiber goal. Log food so the app can count it.',
    why: 'Eating 25 to 29g of fiber a day is linked to lower risk of type 2 diabetes.', watch: ['energy', 'cravings'], level: 'moderate', refs: ['reynolds2019'], auto: 'fiber' },
  { key: 'sweets_after_meals', icon: 'cookie', color: 'c-org', title: 'Sweets only after a meal', daily: 'If you have something sweet, have it right after a meal, not on its own.',
    why: 'Reasoned from the food-order studies: carbs last means a gentler rise.', watch: ['cravings', 'energy'], level: 'inference', refs: ['shukla2015'] },
  { key: 'pantry_swap', icon: 'arrows-clockwise', color: 'c-peri', title: 'One less ultra-processed snack', daily: 'Swap one packaged snack for a whole-food one (fruit + nuts, yogurt, veggies + hummus).',
    why: 'People ate about 500 more calories a day on ultra-processed food in a controlled trial.', watch: ['cravings', 'mood'], level: 'moderate', refs: ['hall2019'] },
];
const BY_KEY = Object.fromEntries(EXPERIMENTS.map(e => [e.key, e]));

const addDays = (s, n) => { const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const avg = a => a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : null;

function results(userId, exp, today) {
  const def = BY_KEY[exp.key];
  const end = addDays(exp.started_on, 6);
  const marked = db.prepare('SELECT day FROM experiment_days WHERE experiment_id = ?').all(exp.id).map(r => r.day);
  let doneDays = new Set(marked);
  if (def.auto === 'fiber') {
    const t = db.prepare('SELECT fiber FROM targets WHERE user_id = ?').get(userId) || { fiber: 25 };
    db.prepare('SELECT log_date, SUM(fiber) f FROM food_logs WHERE user_id = ? AND log_date BETWEEN ? AND ? GROUP BY log_date').all(userId, exp.started_on, end)
      .forEach(r => { if (r.f >= t.fiber) doneDays.add(r.log_date); });
  }
  const checks = db.prepare('SELECT * FROM checkins WHERE user_id = ? AND day BETWEEN ? AND ?').all(userId, addDays(exp.started_on, -7), end);
  const before = checks.filter(c => c.day < exp.started_on), during = checks.filter(c => c.day >= exp.started_on);
  const compare = def.watch.map(k => {
    const b = avg(before.map(c => c[k]).filter(v => v != null)), d = avg(during.map(c => c[k]).filter(v => v != null));
    return { metric: k, before: b, during: d, change: b != null && d != null ? Math.round((d - b) * 10) / 10 : null, better: k === 'cravings' ? 'down' : 'up' };
  });
  const days = [];
  for (let i = 0; i < 7; i++) { const day = addDays(exp.started_on, i); days.push({ day, done: doneDays.has(day), future: day > today }); }
  const dayNumber = Math.min(7, Math.max(1, Math.round((Date.parse(today) - Date.parse(exp.started_on)) / 864e5) + 1));
  return { ...exp, def, end, days, doneCount: days.filter(d => d.done).length, dayNumber, finished: today > end, compare, beforeCount: before.length, duringCount: during.length };
}

module.exports = { EXPERIMENTS, BY_KEY, results, addDays };
