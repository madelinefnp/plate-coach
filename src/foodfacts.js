// Barcode lookups from Open Food Facts (open database, ODbL license: credit "Open Food Facts").
// Looked up server-side so the user's device never contacts a third party, and cached for 7 days.
// Data quality varies by product, so results PREFILL the label form for the user to check.
const { db } = require('./db');
const CFG = require('./config');

const FIELDS = 'product_name,product_name_en,brands,serving_size,serving_quantity,nutriments,ingredients_text_en,ingredients_text,nova_group';
const TTL = 7 * 864e5;
const r1 = n => Math.round(n * 10) / 10;
const SUGAR_FIRST = /^(sugar|cane sugar|corn syrup|glucose|fructose|dextrose|honey|syrup)/i;

function mapProduct(code, p) {
  const n = p.nutriments || {};
  const hasServing = n.proteins_serving != null || n.carbohydrates_serving != null;
  const basis = hasServing ? 'serving' : '100g';
  const get = k => { const v = n[`${k}_${basis}`]; return v == null || v === '' ? null : r1(Number(v)); };
  const ingredients = String(p.ingredients_text_en || p.ingredients_text || '').trim();
  const warnings = [];
  let added = get('added-sugars'), addedSource = 'listed';
  const unreliable = n['added-sugars_modifier'] === '~' || (added === 0 && SUGAR_FIRST.test(ingredients));
  if (added == null || unreliable) {
    added = get('sugars'); addedSource = 'total_sugars';
    warnings.push('Added sugar isn’t reliably listed for this product, so total sugar is filled in. Check the package and change it if the label shows added sugars.');
  }
  if (basis === '100g') warnings.push('This product’s numbers are per 100g, not per serving. Edit them to match one serving on your package if you can.');
  const fields = { protein: get('proteins'), fiber: get('fiber'), total_carbs: get('carbohydrates'), fat: get('fat') };
  for (const [k, v] of Object.entries(fields)) if (v == null) warnings.push(`The database has no ${k.replace('_', ' ')} value. Fill it in from the package.`);
  if (!ingredients) warnings.push('No ingredient list in the database. Type it from the package to check processing.');
  return {
    code, name: String(p.product_name_en || p.product_name || '').trim().slice(0, 120) || 'Unnamed product',
    brand: String(p.brands || '').split(',')[0].trim().slice(0, 60),
    serving: basis === 'serving' ? String(p.serving_size || '1 serving').slice(0, 60) : '100 g',
    basis, added_sugar: added, added_sugar_source: addedSource, ...fields, ingredients: ingredients.slice(0, 3000),
    nova_group: [1, 2, 3, 4].includes(Number(p.nova_group)) ? Number(p.nova_group) : null, warnings,
    source: 'Open Food Facts (ODbL)',
  };
}

async function lookup(code) {
  const hit = db.prepare('SELECT data, fetched_at FROM products WHERE code = ?').get(code);
  if (hit && Date.now() - hit.fetched_at < TTL) return JSON.parse(hit.data);
  const url = `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${FIELDS}`;
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': `${CFG.APP_NAME.replace(/\s+/g, '')}/1.0${CFG.OFF_CONTACT ? ` (${CFG.OFF_CONTACT})` : ''}` }, signal: ctl.signal });
    if (res.status === 404) return { notFound: true };
    if (!res.ok) throw new Error('lookup failed');
    const j = await res.json();
    if (j.status !== 1 || !j.product) return { notFound: true };
    const data = mapProduct(code, j.product);
    db.prepare('INSERT INTO products (code, data, fetched_at) VALUES (?,?,?) ON CONFLICT(code) DO UPDATE SET data = excluded.data, fetched_at = excluded.fetched_at').run(code, JSON.stringify(data), Date.now());
    return data;
  } finally { clearTimeout(timer); }
}

module.exports = { lookup, mapProduct };
