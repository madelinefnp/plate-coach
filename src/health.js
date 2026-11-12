// Check-ins, patterns, labs and the appointment report.
// Lab ranges are general education from published criteria, not a diagnosis. Units: US (mg/dL).
// OWNER INPUT NEEDED: confirm units (mg/dL vs mmol/L for Canada) and which labs your practice uses.
const { db } = require('./db');

const SYMPTOMS = [
  ['acne', 'Acne flare'], ['bloating', 'Bloating'], ['brain_fog', 'Brain fog'], ['hair_shedding', 'Hair shedding'],
  ['cramps', 'Cramps'], ['headache', 'Headache'], ['anxious', 'Anxious'], ['low_mood', 'Low mood'],
];
const SYMPTOM_KEYS = SYMPTOMS.map(s => s[0]);
const SCALES = ['energy', 'mood', 'cravings', 'sleep'];

// kind: label, unit, fields, interpret(value, value2) -> { band, text } , refs
const LABS = {
  a1c: { label: 'Hemoglobin A1c', unit: '%', step: 0.1, min: 3, max: 15, refs: ['ada2026'],
    interpret: v => v >= 6.5 ? { band: 'high', text: 'In the diabetes range. This needs a confirming test and a conversation with your clinician.' }
      : v >= 5.7 ? { band: 'watch', text: 'In the prediabetes range (5.7 to 6.4%). This is where lifestyle changes have the strongest evidence.' }
      : { band: 'ok', text: 'Below the prediabetes range. Risk is continuous, so habits still matter.' } },
  fpg: { label: 'Fasting glucose', unit: 'mg/dL', step: 1, min: 40, max: 500, refs: ['ada2026'],
    interpret: v => v >= 126 ? { band: 'high', text: 'In the diabetes range. This needs a confirming test and a conversation with your clinician.' }
      : v >= 100 ? { band: 'watch', text: 'In the prediabetes range (100 to 125). It also counts toward metabolic syndrome.' }
      : { band: 'ok', text: 'Below the prediabetes range. In PCOS, fasting glucose can miss problems, so ask about a glucose tolerance test.' } },
  ogtt2h: { label: '2-hour glucose tolerance test', unit: 'mg/dL', step: 1, min: 40, max: 600, refs: ['ada2026', 'pcos2023'],
    interpret: v => v >= 200 ? { band: 'high', text: 'In the diabetes range. This needs follow-up with your clinician.' }
      : v >= 140 ? { band: 'watch', text: 'In the prediabetes range (140 to 199), called impaired glucose tolerance.' }
      : { band: 'ok', text: 'Normal glucose tolerance.' } },
  tg: { label: 'Triglycerides', unit: 'mg/dL', step: 1, min: 10, max: 3000, refs: ['alberti2009'],
    interpret: v => v >= 150 ? { band: 'watch', text: '150 or higher counts toward metabolic syndrome.' } : { band: 'ok', text: 'Below the metabolic syndrome cutoff of 150.' } },
  hdl: { label: 'HDL cholesterol', unit: 'mg/dL', step: 1, min: 5, max: 200, refs: ['alberti2009'],
    interpret: v => v < 50 ? { band: 'watch', text: 'Below 50 counts toward metabolic syndrome for women.' } : { band: 'ok', text: 'At or above the cutoff of 50 for women.' } },
  bp: { label: 'Blood pressure', unit: 'mmHg', step: 1, min: 50, max: 260, two: true, refs: ['alberti2009', 'pcos2023'],
    interpret: (s, d) => (s >= 130 || d >= 85) ? { band: 'watch', text: '130/85 or higher counts toward metabolic syndrome. The PCOS guideline recommends a check every year.' } : { band: 'ok', text: 'Below 130/85. The PCOS guideline recommends a check every year.' } },
  testosterone: { label: 'Total testosterone', unit: 'ng/dL', step: 1, min: 1, max: 1000, refs: [],
    interpret: () => ({ band: 'info', text: 'Normal ranges vary by lab and method. Compare with the range printed on your lab report.' }) },
  insulin: { label: 'Fasting insulin', unit: 'µIU/mL', step: 0.1, min: 0.5, max: 300, refs: [],
    interpret: () => ({ band: 'info', text: 'There’s no agreed cutoff for fasting insulin. Tracking your own trend over time is still useful.' }) },
};

function validateLab(b) {
  const def = LABS[b.kind];
  const fields = {};
  if (!def) return { fields: { kind: 'Choose a test.' } };
  const v = Number(b.value), v2 = b.value2 === '' || b.value2 == null ? null : Number(b.value2);
  if (!Number.isFinite(v) || v < def.min || v > def.max) fields.value = `Enter a number from ${def.min} to ${def.max}.`;
  if (def.two && (!Number.isFinite(v2) || v2 < 30 || v2 > 160)) fields.value2 = 'Enter the bottom number (30 to 160).';
  const d = String(b.taken_on || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d)) || Date.parse(d) > Date.now() + 864e5) fields.taken_on = 'Pick the date of the test.';
  return Object.keys(fields).length ? { fields } : { value: { kind: b.kind, value: v, value2: def.two ? v2 : null, taken_on: d } };
}

function latestLabs(userId) {
  const rows = db.prepare('SELECT * FROM labs WHERE user_id = ? ORDER BY taken_on DESC, created_at DESC').all(userId);
  const latest = {};
  for (const r of rows) if (!latest[r.kind]) latest[r.kind] = r;
  return { rows, latest };
}

function describeLab(r) {
  const def = LABS[r.kind];
  return { ...r, label: def.label, unit: def.unit, display: def.two ? `${r.value}/${r.value2}` : String(r.value), ...def.interpret(r.value, r.value2), refs: def.refs };
}

function metabolicCheck(latest) {
  const items = [
    ['Fasting glucose 100+', latest.fpg ? latest.fpg.value >= 100 : null],
    ['Triglycerides 150+', latest.tg ? latest.tg.value >= 150 : null],
    ['HDL under 50', latest.hdl ? latest.hdl.value < 50 : null],
    ['Blood pressure 130/85+', latest.bp ? (latest.bp.value >= 130 || latest.bp.value2 >= 85) : null],
    ['Waist size (your clinician uses a cutoff for your population)', null],
  ].map(([label, met]) => ({ label, met }));
  const measured = items.filter(i => i.met !== null).length;
  const met = items.filter(i => i.met === true).length;
  return { items, measured, met };
}

const iso = d => d.toISOString().slice(0, 10);
const addDays = (s, n) => { const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const avg = a => a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : null;

function dayTotals(userId, from, to) {
  const rows = db.prepare(`SELECT log_date, SUM(protein) p, SUM(fiber) f, SUM(added_sugar) s FROM food_logs WHERE user_id = ? AND log_date BETWEEN ? AND ? GROUP BY log_date`).all(userId, from, to);
  return Object.fromEntries(rows.map(r => [r.log_date, r]));
}

function periodStarts(checkins) {
  const byDay = Object.fromEntries(checkins.map(c => [c.day, c]));
  return checkins.filter(c => c.period === 'period' && !(byDay[addDays(c.day, -1)] && byDay[addDays(c.day, -1)].period === 'period')).map(c => c.day).sort();
}

function insights(userId, today, days = 30) {
  const from = addDays(today, -(days - 1)), prevFrom = addDays(today, -(2 * days - 1)), prevTo = addDays(today, -days);
  const all = db.prepare('SELECT * FROM checkins WHERE user_id = ? AND day BETWEEN ? AND ? ORDER BY day').all(userId, addDays(today, -180), today)
    .map(c => ({ ...c, symptoms: JSON.parse(c.symptoms) }));
  const cur = all.filter(c => c.day >= from), prev = all.filter(c => c.day >= prevFrom && c.day <= prevTo);
  const t = db.prepare('SELECT protein, fiber, added_sugar FROM targets WHERE user_id = ?').get(userId) || { protein: 90, fiber: 25, added_sugar: 25 };
  const totals = dayTotals(userId, addDays(today, -180), today);

  const averages = {}; const change = {};
  for (const k of SCALES) {
    averages[k] = avg(cur.map(c => c[k]).filter(v => v != null));
    const p = avg(prev.map(c => c[k]).filter(v => v != null));
    change[k] = averages[k] != null && p != null ? Math.round((averages[k] - p) * 10) / 10 : null;
  }
  // streak of consecutive check-in days ending today or yesterday
  const daysSet = new Set(all.map(c => c.day));
  let streak = 0, d = daysSet.has(today) ? today : addDays(today, -1);
  while (daysSet.has(d)) { streak++; d = addDays(d, -1); }

  const starts = periodStarts(all);
  const lengths = starts.slice(1).map((s, i) => Math.round((Date.parse(s) - Date.parse(starts[i])) / 864e5)).filter(n => n >= 10 && n <= 120);
  const symptomCounts = Object.fromEntries(SYMPTOM_KEYS.map(k => [k, cur.filter(c => c.symptoms.includes(k)).length]));

  // personal pattern: fiber goal days vs not (needs at least 4 of each)
  let pattern = null;
  const withFood = cur.filter(c => totals[c.day] && c.energy != null);
  const hit = withFood.filter(c => totals[c.day].f >= t.fiber), miss = withFood.filter(c => totals[c.day].f < t.fiber);
  if (hit.length >= 4 && miss.length >= 4) {
    pattern = { metric: 'fiber', hitDays: hit.length, missDays: miss.length,
      energyHit: avg(hit.map(c => c.energy)), energyMiss: avg(miss.map(c => c.energy)),
      cravingsHit: avg(hit.map(c => c.cravings).filter(v => v != null)), cravingsMiss: avg(miss.map(c => c.cravings).filter(v => v != null)) };
  }

  const wins = [];
  if (change.energy != null && change.energy >= 0.5) wins.push({ icon: 'lightning', text: `Energy is up ${change.energy} points compared with the month before.` });
  if (change.cravings != null && change.cravings <= -0.5) wins.push({ icon: 'cookie', text: `Cravings are down ${Math.abs(change.cravings)} points compared with the month before.` });
  if (change.sleep != null && change.sleep >= 0.5) wins.push({ icon: 'moon', text: `Sleep is up ${change.sleep} points compared with the month before.` });
  if (change.mood != null && change.mood >= 0.5) wins.push({ icon: 'heart', text: `Mood is up ${change.mood} points compared with the month before.` });
  let proteinRun = 0; d = today;
  while (totals[d] && totals[d].p >= t.protein) { proteinRun++; d = addDays(d, -1); }
  if (proteinRun >= 3) wins.push({ icon: 'egg', text: `${proteinRun} days in a row hitting your protein goal.` });
  const fiberDays = Object.entries(totals).filter(([k, v]) => k >= from && v.f >= t.fiber).length;
  if (fiberDays >= 5) wins.push({ icon: 'leaf', text: `You hit your fiber goal on ${fiberDays} days this month.` });
  if (streak >= 7) wins.push({ icon: 'calendar-blank', text: `${streak}-day check-in streak.` });
  if (starts.length && lengths.length && lengths[lengths.length - 1] <= 35 && lengths.length >= 1 && (lengths.length < 2 || lengths[lengths.length - 2] > 35)) wins.push({ icon: 'flower-lotus', text: `Your latest cycle was ${lengths[lengths.length - 1]} days.` });

  const calendar = [];
  for (let i = 27; i >= 0; i--) { const day = addDays(today, -i); const c = all.find(x => x.day === day); calendar.push({ day, energy: c ? c.energy : null, period: c ? c.period : null }); }

  return { days, count: cur.length, streak, averages, change, starts, lengths, avgCycle: avg(lengths), lastStart: starts[starts.length - 1] || null, symptomCounts, pattern, wins, calendar };
}

const TESTS_TO_ASK = [
  { text: 'Blood pressure, checked every year', refs: ['pcos2023'] },
  { text: 'A fasting lipid profile (cholesterol and triglycerides), whatever your age or weight', refs: ['pcos2023'] },
  { text: 'A blood sugar check. A 2-hour oral glucose tolerance test is the most accurate for women at higher risk; A1c or fasting glucose are other options', refs: ['pcos2023', 'ada2026'] },
  { text: 'A check-in on mood: screening for depression and anxiety is recommended at diagnosis, and later as needed', refs: ['pcos2023'] },
];
const QUESTIONS = [
  'Do my symptoms and labs suggest insulin resistance or prediabetes?',
  'Which tests should I have, and how often should we repeat them?',
  'What are my options for irregular cycles, acne or unwanted hair?',
  'Would metformin or another medication make sense for me?',
  'How do my results change things if I want to get pregnant now or later?',
  'Can we track something besides weight, like cycles, energy or labs?',
];

function report(userId, today, days = 90) {
  const from = addDays(today, -(days - 1));
  const ins = insights(userId, today, days);
  const totals = Object.entries(dayTotals(userId, from, today));
  const user = db.prepare('SELECT name, focus FROM users WHERE id = ?').get(userId);
  const { latest } = latestLabs(userId);
  return {
    generated: today, from, days, name: user.name, focus: user.focus,
    checkins: ins.count, averages: ins.averages, starts: ins.starts.filter(s => s >= from), lengths: ins.lengths, avgCycle: ins.avgCycle,
    symptoms: SYMPTOMS.map(([k, label]) => ({ key: k, label, days: db.prepare(`SELECT COUNT(*) n FROM checkins WHERE user_id = ? AND day BETWEEN ? AND ? AND symptoms LIKE ?`).get(userId, from, today, `%"${k}"%`).n })).filter(s => s.days),
    food: { daysLogged: totals.length, protein: avg(totals.map(([, v]) => v.p)), fiber: avg(totals.map(([, v]) => v.f)), sugar: avg(totals.map(([, v]) => v.s)) },
    labs: Object.values(latest).map(describeLab),
    metabolic: metabolicCheck(latest),
    tests: TESTS_TO_ASK, questions: QUESTIONS, wins: ins.wins,
  };
}

module.exports = { SYMPTOMS, SYMPTOM_KEYS, SCALES, LABS, validateLab, latestLabs, describeLab, metabolicCheck, insights, report, TESTS_TO_ASK, QUESTIONS };
