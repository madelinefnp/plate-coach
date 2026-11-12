// Nutrition logic: label quality score, plate estimates, meal library.
const { checkProcessing } = require('./processing');
// Numbers are rounded general estimates for education, not medical advice.
// OWNER REVIEW: Madeline should confirm the scoring thresholds and swaps.

const SUGAR_WORDS = ['sugar', 'cane sugar', 'brown sugar', 'corn syrup', 'high fructose corn syrup', 'dextrose',
  'fructose', 'glucose', 'sucrose', 'maltose', 'maltodextrin', 'honey', 'agave', 'maple syrup', 'rice syrup',
  'brown rice syrup', 'molasses', 'evaporated cane juice', 'cane juice', 'fruit juice concentrate', 'syrup',
  'coconut sugar', 'date syrup', 'invert sugar', 'caramel'];
const REFINED_WORDS = ['enriched', 'bleached', 'white flour', 'wheat flour', 'rice flour', 'corn starch',
  'cornstarch', 'modified food starch', 'tapioca starch', 'potato starch'];
const POOR_FAT_WORDS = ['partially hydrogenated', 'hydrogenated'];
const ADDITIVE_WORDS = ['red 40', 'yellow 5', 'yellow 6', 'blue 1', 'artificial color', 'artificial flavor'];
const WHOLE_FIRST = ['whole', 'oat', 'oats', 'almond', 'peanut', 'cashew', 'chickpea', 'lentil', 'bean', 'egg',
  'milk', 'yogurt', 'chicken', 'beef', 'salmon', 'tuna', 'quinoa', 'brown rice', 'seed', 'nut', 'flax', 'chia'];

function num(v) { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : NaN; }

function splitIngredients(text) {
  return String(text || '').toLowerCase().replace(/[()\[\]]/g, ',').split(/[,;]/)
    .map(s => s.trim()).filter(Boolean);
}

function guessCategory(name, ingredients) {
  const t = `${name} ${ingredients}`.toLowerCase();
  const cats = [
    ['cereal', /cereal|granola|flakes|loops|puffs/],
    ['yogurt', /yogurt|yoghurt|skyr/],
    ['bar', /\bbar\b|bars/],
    ['bread', /bread|bagel|tortilla|wrap|bun|muffin/],
    ['cracker', /cracker|chips|crisps|pretzel/],
    ['drink', /juice|soda|drink|latte|smoothie|tea|lemonade/],
    ['pasta', /pasta|noodle|spaghetti|macaroni/],
    ['sweet', /cookie|candy|chocolate|cake|ice cream|pastry|donut/],
    ['oatmeal', /oatmeal|instant oat|porridge/],
    ['sauce', /sauce|dressing|ketchup|bbq/],
  ];
  for (const [c, re] of cats) if (re.test(t)) return c;
  return 'other';
}

const SWAPS = {
  cereal: 'Try a protein-forward breakfast instead, like eggs with sauteed greens or Greek yogurt with nuts. In a small trial, a higher-protein breakfast cut cravings and evening snacking. If you want cereal, pick one with 5g+ fiber and under 6g added sugar and add a protein.',
  yogurt: 'Swap to plain Greek yogurt or skyr and add your own berries and a sprinkle of chia. More protein, way less added sugar.',
  bar: 'Look for a bar with 10g+ protein and under 6g added sugar, or grab a handful of nuts with a cheese stick instead. If you do have the bar, have it after a meal, not on an empty stomach.',
  bread: 'Choose a bread where "whole" grain is the first ingredient with 3g+ fiber per slice, or try a sprouted grain bread.',
  cracker: 'Swap for seed or whole-grain crackers (3g+ fiber) and pair with hummus, tuna or cheese so it holds you longer.',
  drink: 'Try sparkling water with a squeeze of citrus, or unsweetened tea. If you want juice, have the whole fruit instead, so the fiber comes along with the sugar.',
  pasta: 'Try chickpea or lentil pasta. It has a lot more protein and fiber. Or go half regular pasta and half veggies.',
  sweet: 'Keep it as dessert, right after a meal, instead of a stand-alone snack. A square or two of 70%+ dark chocolate with a few nuts is an easy upgrade.',
  oatmeal: 'Swap flavored instant oats for plain oats with a scoop of protein, nut butter and berries. Or try a protein-forward breakfast a few days a week, like eggs and veggies.',
  sauce: 'Look for a version with under 2g added sugar per serving, or make a quick olive oil, lemon and herb dressing.',
  other: 'Look for a version with less added sugar and more fiber, and pair it with a protein so it is more blood sugar friendly.',
};

function scoreLabel(input) {
  const name = String(input.name || '').trim().slice(0, 120);
  const added = num(input.added_sugar), fiber = num(input.fiber), protein = num(input.protein), carbs = num(input.total_carbs);
  const fat = input.fat === '' || input.fat == null ? 0 : num(input.fat);
  const errors = {};
  if (!name) errors.name = 'Give this food a name.';
  for (const [k, v] of Object.entries({ added_sugar: added, fiber, protein, total_carbs: carbs, fat })) {
    if (Number.isNaN(v)) errors[k] = 'Enter a number (0 or more).';
    else if (v > 300) errors[k] = 'That looks too high for one serving.';
  }
  if (!errors.total_carbs && !errors.fiber && fiber > carbs) errors.fiber = 'Fiber can’t be more than total carbs.';
  if (!errors.total_carbs && !errors.added_sugar && added > carbs) errors.added_sugar = 'Added sugar can’t be more than total carbs.';
  const ingredientsText = String(input.ingredients || '').slice(0, 3000);
  if (Object.keys(errors).length) return { errors };

  // Scoring method (documented on /evidence#label-score). A transparent rule of thumb, not a validated clinical tool.
  // Added sugar is judged against the AHA limit of ~25g/day for women (aha2009).
  // Fiber and protein use FDA "good source" (10% DV) and "high" (20% DV) cut-offs (fda10154).
  // Carb-to-fiber 10:1 (mozaffarian2013). Refined grains, hydrogenated oils (fdatrans) and early sugars are flagged.
  const ings = splitIngredients(ingredientsText);
  const reasons = [];
  let score = 50;

  if (added === 0) { score += 20; reasons.push({ good: true, text: 'No added sugar' }); }
  else if (added <= 2.5) { score += 15; reasons.push({ good: true, text: `Very low added sugar (${added}g, about 10% of a day\u2019s limit)` }); }
  else if (added <= 5) { score += 5; reasons.push({ good: true, text: `Low added sugar (${added}g)` }); }
  else if (added <= 10) { score -= 10; reasons.push({ good: false, text: `Moderate added sugar (${added}g, up to 40% of a day\u2019s limit)` }); }
  else { score -= 25; reasons.push({ good: false, text: `High added sugar (${added}g, over 40% of a day\u2019s limit)` }); }

  if (fiber >= 5.6) { score += 15; reasons.push({ good: true, text: `High in fiber (${fiber}g)` }); }
  else if (fiber >= 2.8) { score += 10; reasons.push({ good: true, text: `Good source of fiber (${fiber}g)` }); }
  else if (fiber >= 1) { score += 3; reasons.push({ good: false, text: `A little fiber (${fiber}g)` }); }
  else { score -= 5; reasons.push({ good: false, text: 'No fiber' }); }

  if (protein >= 10) { score += 15; reasons.push({ good: true, text: `High in protein (${protein}g)` }); }
  else if (protein >= 5) { score += 8; reasons.push({ good: true, text: `Good source of protein (${protein}g)` }); }
  else { reasons.push({ good: false, text: `Low protein (${protein}g)` }); }

  if (carbs >= 10 && fiber > 0 && carbs / fiber <= 10) { score += 5; reasons.push({ good: true, text: 'Carbs come with fiber (10:1 or better)' }); }
  else if (carbs >= 10) { score -= 3; reasons.push({ good: false, text: 'Carbs without much fiber (worse than 10:1)' }); }

  if (ings.length) {
    const sugarHits = ings.map((ing, i) => ({ ing, i })).filter(({ ing }) => SUGAR_WORDS.some(w => ing.includes(w)));
    if (sugarHits.some(h => h.i < 3)) { score -= 10; reasons.push({ good: false, text: `A sugar is in the first 3 ingredients (${sugarHits[0].ing})` }); }
    else if (sugarHits.length) { score -= 3; reasons.push({ good: false, text: `Contains a sweetener (${sugarHits[0].ing})` }); }
    const refined = ings.find(ing => REFINED_WORDS.some(w => ing.includes(w)) && !ing.includes('whole'));
    if (refined) { score -= 8; reasons.push({ good: false, text: `Refined flour or starch (${refined})` }); }
    if (ings.some(ing => POOR_FAT_WORDS.some(w => ing.includes(w)))) { score -= 10; reasons.push({ good: false, text: 'Hydrogenated oil (a source of trans fat)' }); }
    if (WHOLE_FIRST.some(w => ings[0].includes(w))) { score += 5; reasons.push({ good: true, text: `Whole food first (${ings[0]})` }); }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const grade = score >= 80 ? { key: 'great', label: 'Great pick', icon: 'sparkle' }
    : score >= 60 ? { key: 'good', label: 'Good choice', icon: 'check-circle' }
    : score >= 40 ? { key: 'okay', label: 'Okay sometimes', icon: 'scales' }
    : { key: 'swap', label: 'Worth swapping', icon: 'arrows-clockwise' };
  const category = guessCategory(name, ingredientsText);
  const swap = score >= 80
    ? 'This one already looks solid. Pair it with a protein or veggie and you are set.'
    : SWAPS[category];
  return {
    value: { name, serving: String(input.serving || '').slice(0, 60), added_sugar: added, fiber, protein, total_carbs: carbs, fat, ingredients: ingredientsText },
    score, result: { grade, reasons, swap, category, processing: checkProcessing(ingredientsText) },
  };
}

// Food library for building a plate. Values per listed portion (approximate, USDA-style averages).
// group: protein | veg | smartcarb | refined | fat | fruit | sweet
const FOODS = [
  ['chicken', 'Chicken breast', '', 'protein', '4 oz', 35, 0, 0, 4, 0],
  ['salmon', 'Salmon', '', 'protein', '4 oz', 25, 0, 0, 14, 0],
  ['eggs', 'Eggs', '', 'protein', '2 eggs', 12, 0, 1, 10, 0],
  ['greek_yogurt', 'Plain Greek yogurt', '', 'protein', '3/4 cup', 17, 0, 6, 4, 0],
  ['ground_turkey', 'Ground turkey', '', 'protein', '4 oz', 22, 0, 0, 9, 0],
  ['beef', 'Lean beef', '', 'protein', '4 oz', 28, 0, 0, 10, 0],
  ['shrimp', 'Shrimp', '', 'protein', '4 oz', 23, 0, 1, 1, 0],
  ['tofu', 'Firm tofu', '', 'protein', '1/2 block', 20, 2, 4, 11, 0],
  ['cottage', 'Cottage cheese', '', 'protein', '3/4 cup', 21, 0, 5, 4, 0],
  ['tuna', 'Tuna', '', 'protein', '1 can', 25, 0, 0, 1, 0],
  ['protein_shake', 'Protein powder', '', 'protein', '1 scoop', 22, 1, 3, 2, 1],
  ['broccoli', 'Broccoli', '', 'veg', '1 cup', 3, 5, 11, 0, 0],
  ['salad', 'Leafy salad', '', 'veg', '2 cups', 2, 2, 4, 0, 0],
  ['peppers', 'Bell peppers', '', 'veg', '1 cup', 1, 3, 9, 0, 0],
  ['zucchini', 'Zucchini', '', 'veg', '1 cup', 2, 2, 6, 0, 0],
  ['cauliflower', 'Cauliflower', '', 'veg', '1 cup', 2, 3, 5, 0, 0],
  ['green_beans', 'Green beans', '', 'veg', '1 cup', 2, 4, 8, 0, 0],
  ['spinach', 'Cooked spinach', '', 'veg', '1 cup', 5, 4, 7, 0, 0],
  ['carrots', 'Carrots', '', 'veg', '1 cup', 1, 4, 12, 0, 0],
  ['tomato', 'Tomatoes', '', 'veg', '1 cup', 2, 2, 7, 0, 0],
  ['black_beans', 'Black beans', '', 'smartcarb', '1/2 cup', 8, 8, 20, 0, 0],
  ['lentils', 'Lentils', '', 'smartcarb', '1/2 cup', 9, 8, 20, 0, 0],
  ['chickpeas', 'Chickpeas', '', 'smartcarb', '1/2 cup', 7, 6, 22, 2, 0],
  ['quinoa', 'Quinoa', '', 'smartcarb', '1/2 cup', 4, 3, 20, 2, 0],
  ['brown_rice', 'Brown rice', '', 'smartcarb', '1/2 cup', 3, 2, 23, 1, 0],
  ['sweet_potato', 'Sweet potato', '', 'smartcarb', '1 medium', 2, 4, 24, 0, 0],
  ['oats', 'Rolled oats', '', 'smartcarb', '1/2 cup dry', 5, 4, 27, 3, 0],
  ['whole_bread', 'Whole grain bread', '', 'smartcarb', '1 slice', 4, 3, 14, 1, 1],
  ['white_rice', 'White rice', '', 'refined', '1 cup', 4, 1, 45, 0, 0],
  ['white_bread', 'White bread', '', 'refined', '2 slices', 4, 1, 26, 2, 3],
  ['pasta', 'White pasta', '', 'refined', '1 cup', 7, 2, 43, 1, 0],
  ['tortilla', 'Flour tortilla', '', 'refined', '1 large', 5, 1, 36, 7, 1],
  ['fries', 'French fries', '', 'refined', 'medium', 4, 4, 48, 17, 0],
  ['bagel', 'Bagel', '', 'refined', '1 bagel', 10, 2, 55, 2, 5],
  ['avocado', 'Avocado', '', 'fat', '1/2', 2, 5, 9, 15, 0],
  ['olive_oil', 'Olive oil', '', 'fat', '1 tbsp', 0, 0, 0, 14, 0],
  ['nuts', 'Almonds', '', 'fat', '1/4 cup', 7, 4, 7, 18, 0],
  ['cheese', 'Cheese', '', 'fat', '1 oz', 7, 0, 0, 9, 0],
  ['chia', 'Chia seeds', '', 'fat', '1 tbsp', 2, 4, 5, 3, 0],
  ['berries', 'Berries', '', 'fruit', '1 cup', 1, 6, 15, 0, 0],
  ['apple', 'Apple', '', 'fruit', '1 medium', 0, 4, 25, 0, 0],
  ['banana', 'Banana', '', 'fruit', '1 medium', 1, 3, 27, 0, 0],
  ['juice', 'Orange juice', '', 'sweet', '1 cup', 2, 0, 26, 0, 0],
  ['soda', 'Soda', '', 'sweet', '12 oz can', 0, 0, 39, 0, 39],
  ['dessert', 'Dessert / pastry', '', 'sweet', '1 piece', 3, 1, 40, 12, 25],
  ['sweet_coffee', 'Sweetened coffee drink', '', 'sweet', '16 oz', 8, 0, 40, 6, 32],
].map(([id, name, emoji, group, portion, protein, fiber, carbs, fat, added_sugar]) =>
  ({ id, name, emoji, group, portion, protein, fiber, carbs, fat, added_sugar }));
const FOOD_BY_ID = Object.fromEntries(FOODS.map(f => [f.id, f]));

const r1 = n => Math.round(n * 10) / 10;

function analyzePlate(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) return { errors: { items: 'Add at least one food to your plate.' } };
  if (rawItems.length > 30) return { errors: { items: 'That is a lot of foods for one plate. Keep it under 30.' } };
  const items = [];
  for (const it of rawItems) {
    const f = FOOD_BY_ID[it && it.id];
    const qty = Number(it && it.qty);
    if (!f || ![0.5, 1, 1.5, 2, 3].includes(qty)) return { errors: { items: 'One of the foods or portions was not recognized.' } };
    items.push({ id: f.id, qty });
  }
  const t = { protein: 0, fiber: 0, carbs: 0, fat: 0, added_sugar: 0 };
  const groups = {};
  for (const { id, qty } of items) {
    const f = FOOD_BY_ID[id];
    for (const k of Object.keys(t)) t[k] += f[k] * qty;
    groups[f.group] = (groups[f.group] || 0) + qty;
  }
  for (const k of Object.keys(t)) t[k] = r1(t[k]);

  // Tips use well-studied blood sugar habits: veggies first, eat in order (fiber, then protein/fat, carbs last),
  // pair carbs, sweets as dessert, move after eating, optional vinegar. Ordered by priority; the app shows them all.
  const hasCarbs = !!(groups.smartcarb || groups.refined || groups.fruit || groups.sweet);
  const tips = [];
  if (t.protein < 25) tips.push({ kind: 'add', icon: 'egg', level: 'moderate', refs: ['sorensen2012', 'shukla2015'], title: 'Add protein', text: `About ${Math.round(t.protein)}g protein here. Aim for roughly 25 to 30g at a meal. Eggs, Greek yogurt, chicken, fish, tofu or beans all work. In a trial of women with PCOS, shifting some carbs to protein improved glucose measures.` });
  if (!groups.veg) tips.push({ kind: 'add', icon: 'leaf', level: 'early', refs: ['imai2014', 'adaplate'], title: 'Start with veggies', text: 'Add a side salad or some roasted veggies and eat a few bites of them first. Getting fiber in before the rest of the meal can blunt the blood sugar rise that follows.' });
  else if (t.fiber < 8) tips.push({ kind: 'add', icon: 'plant', level: 'guideline', refs: ['iom2005'], title: 'Bump the fiber', text: `About ${Math.round(t.fiber)}g fiber. About 25g a day is the recommended amount for women, so 8g or more per meal gets you there. Add another cup of veggies, beans, lentils, chia or berries.` });
  if (groups.refined) tips.push({ kind: 'swap', icon: 'arrows-clockwise', level: 'guideline', refs: ['dga2020', 'mozaffarian2013'], title: 'Swap refined carbs for whole-food fiber', text: 'Try sweet potato, quinoa, beans, brown rice or whole grain bread instead of white rice, white bread, pasta or tortillas. Or go half and half with veggies.' });
  if (hasCarbs && (groups.veg || groups.protein)) tips.push({ kind: 'order', icon: 'list-numbers', level: 'early', refs: ['shukla2015', 'imai2014'], title: 'Eat it in this order', text: 'Veggies first, then your protein and fat, and save the starchy or sweet part for last. In small studies, mostly in type 2 diabetes, the same meal eaten this way caused a smaller blood sugar rise.' });
  if (t.added_sugar > 10) tips.push({ kind: 'swap', icon: 'cookie', level: 'inference', refs: ['aha2009', 'shukla2015'], title: 'Make it dessert, not a snack', text: `About ${Math.round(t.added_sugar)}g added sugar, which is a big part of the roughly 25g daily limit. If you want the sweet thing, having it right after a meal (carbs last) is reasoned from the food-order studies rather than tested directly.` });
  if (t.carbs > 60 && t.fiber < 10) tips.push({ kind: 'balance', icon: 'scales', level: 'guideline', refs: ['adaplate'], title: 'Carbs are high for the fiber', text: `About ${Math.round(t.carbs)}g carbs with ${Math.round(t.fiber)}g fiber. Shrink the starch a little and fill the space with veggies or protein.` });
  if (t.carbs > 45 || t.added_sugar > 10) tips.push({ kind: 'move', icon: 'person-simple-walk', level: 'moderate', refs: ['reynolds2016', 'pcos2023'], title: 'Move for 10 minutes after', text: 'A short walk after eating lets your muscles use some of the glucose. In a trial in type 2 diabetes, 10 minutes after each meal beat one longer walk at another time, especially after dinner.' });
  if (!groups.fat && t.fat < 8) tips.push({ kind: 'add', icon: 'drop', level: 'inference', refs: [], title: 'Add a healthy fat', text: 'A little avocado, olive oil, nuts or seeds makes a meal more satisfying and helps you absorb fat-soluble vitamins (A, D, E and K).' });
  if (t.carbs > 45) tips.push({ kind: 'optional', icon: 'flask', level: 'early', refs: ['johnston2004', 'shishehbor2017'], title: 'Optional: vinegar first', text: 'Small, short studies suggest about 1 tablespoon of vinegar in a tall glass of water before a carb-heavy meal can soften the rise. The evidence is weak. Use a straw and rinse after. Skip it with reflux or ulcers, and check with your clinician if you take blood sugar medication.' });
  if (!tips.length) tips.push({ kind: 'win', icon: 'sparkle', level: 'guideline', refs: ['adaplate'], title: 'This plate is balanced', text: 'Protein, fiber and smart carbs are all here. Eat the veggies first and you\u2019re set.' });

  // Balance score: share of plate "slots" by group, compared to 1/2 veg, 1/4 protein, 1/4 smart carb.
  const totalQty = Object.values(groups).reduce((a, b) => a + b, 0);
  const share = g => (groups[g] || 0) / totalQty;
  const composition = { veg: r1(share('veg') * 100), protein: r1(share('protein') * 100),
    carbs: r1((share('smartcarb') + share('refined')) * 100), other: r1((share('fat') + share('fruit') + share('sweet')) * 100) };
  return { items, totals: t, tips, composition };
}

// Meal ideas. ing = [item, aisle] for the grocery list. Values are approximate.
const P = 'produce', PR = 'protein', D = 'dairy & eggs', PA = 'pantry', F = 'frozen', B = 'bread & grains';
const RECIPES = [
  ['r_eggs_toast', 'breakfast', 'Veggie egg scramble + whole grain toast', 'savory', 24, 7, 20, 18, 1, [['Eggs', D], ['Spinach', P], ['Bell peppers', P], ['Whole grain bread', B]]],
  ['r_salmon_crackers', 'breakfast', 'Smoked salmon, avocado + cucumber on seed crackers', 'savory', 22, 8, 16, 20, 0, [['Smoked salmon', PR], ['Avocados', P], ['Cucumbers', P], ['Seed crackers', PA]]],
  ['r_chicken_bowl', 'breakfast', 'Leftover chicken, greens + quinoa breakfast bowl', 'savory', 32, 7, 24, 12, 0, [['Chicken breast', PR], ['Mixed greens', P], ['Quinoa', B], ['Lemons', P]]],
  ['r_tofu_scramble', 'breakfast', 'Tofu scramble with peppers + avocado', 'savory', 22, 9, 15, 20, 0, [['Firm tofu', PR], ['Bell peppers', P], ['Avocados', P], ['Turmeric + cumin', PA]]],
  ['r_yogurt_bowl', 'breakfast', 'Greek yogurt bowl with berries, chia + almonds', '', 26, 12, 30, 15, 0, [['Plain Greek yogurt', D], ['Berries (fresh or frozen)', F], ['Chia seeds', PA], ['Almonds', PA]]],
  ['r_protein_oats', 'breakfast', 'Protein oats with cinnamon + walnuts', '', 30, 8, 35, 14, 1, [['Rolled oats', B], ['Plain Greek yogurt', D], ['Walnuts', PA], ['Cinnamon', PA]]],
  ['r_cottage_fruit', 'breakfast', 'Cottage cheese, peaches + pumpkin seeds', '', 27, 4, 22, 10, 0, [['Cottage cheese', D], ['Peaches (or frozen)', P], ['Pumpkin seeds', PA]]],
  ['r_smoothie', 'breakfast', 'Green protein smoothie with spinach + flax', '', 28, 9, 28, 9, 1, [['Spinach', P], ['Frozen berries', F], ['Ground flax', PA], ['Plain Greek yogurt', D], ['Unsweetened milk', D]]],
  ['r_chicken_salad', 'lunch', 'Big chicken salad with chickpeas + olive oil', '', 38, 10, 28, 18, 0, [['Chicken breast', PR], ['Mixed greens', P], ['Canned chickpeas', PA], ['Cucumbers', P], ['Extra virgin olive oil', PA]]],
  ['r_tuna_wrap', 'lunch', 'Tuna lettuce wraps + white bean salad', '', 33, 9, 25, 10, 0, [['Canned tuna', PA], ['Romaine lettuce', P], ['Canned white beans', PA], ['Red onion', P], ['Lemons', P]]],
  ['r_lentil_soup', 'lunch', 'Lentil vegetable soup + Greek yogurt dollop', '', 25, 15, 40, 6, 0, [['Dry or canned lentils', PA], ['Carrots', P], ['Celery', P], ['Canned tomatoes', PA], ['Plain Greek yogurt', D]]],
  ['r_burrito_bowl', 'lunch', 'Turkey burrito bowl with black beans + salsa', '', 35, 13, 38, 14, 1, [['Ground turkey', PR], ['Canned black beans', PA], ['Brown rice', B], ['Salsa', PA], ['Romaine lettuce', P]]],
  ['r_quinoa_bowl', 'lunch', 'Quinoa power bowl with salmon + greens', '', 32, 8, 32, 18, 0, [['Salmon', PR], ['Quinoa', B], ['Mixed greens', P], ['Cucumbers', P], ['Lemons', P]]],
  ['r_egg_salad', 'lunch', 'Egg salad on seed crackers + cucumber', 'savory', 22, 7, 20, 20, 0, [['Eggs', D], ['Plain Greek yogurt', D], ['Seed crackers', PA], ['Cucumbers', P]]],
  ['r_salmon_veg', 'dinner', 'Sheet pan salmon, broccoli + sweet potato', '', 32, 9, 32, 16, 0, [['Salmon', PR], ['Broccoli', P], ['Sweet potatoes', P], ['Extra virgin olive oil', PA]]],
  ['r_stirfry', 'dinner', 'Chicken veggie stir fry over brown rice', '', 36, 7, 35, 12, 2, [['Chicken breast', PR], ['Frozen stir-fry vegetables', F], ['Brown rice', B], ['Low-sodium soy sauce', PA], ['Garlic + ginger', P]]],
  ['r_turkey_chili', 'dinner', 'Turkey + bean chili with avocado', '', 34, 14, 30, 15, 1, [['Ground turkey', PR], ['Canned kidney beans', PA], ['Canned tomatoes', PA], ['Onions', P], ['Avocados', P]]],
  ['r_shrimp_tacos', 'dinner', 'Shrimp tacos in corn tortillas + slaw', '', 30, 9, 34, 12, 1, [['Shrimp (frozen is fine)', F], ['Corn tortillas', B], ['Shredded cabbage', P], ['Limes', P], ['Plain Greek yogurt', D]]],
  ['r_chickpea_pasta', 'dinner', 'Chickpea pasta with meat sauce + side salad', '', 38, 12, 45, 14, 3, [['Chickpea pasta', PA], ['Ground turkey', PR], ['Canned tomatoes', PA], ['Mixed greens', P]]],
  ['r_tofu_curry', 'dinner', 'Tofu + vegetable curry with cauliflower rice', '', 24, 9, 22, 18, 1, [['Firm tofu', PR], ['Frozen cauliflower rice', F], ['Spinach', P], ['Light coconut milk', PA], ['Curry powder', PA]]],
  ['r_apple_pb', 'snack', 'Apple + natural peanut butter', '', 7, 6, 28, 16, 1, [['Apples', P], ['Natural peanut butter', PA]]],
  ['r_hummus_veg', 'snack', 'Hummus + crunchy veggies', '', 6, 6, 18, 8, 0, [['Hummus', D], ['Carrots', P], ['Cucumbers', P]]],
  ['r_cheese_nuts', 'snack', 'Cheese + almonds', '', 13, 3, 4, 17, 0, [['Cheese', D], ['Almonds', PA]]],
  ['r_edamame', 'snack', 'Edamame with sea salt', '', 17, 8, 14, 8, 0, [['Frozen edamame', F]]],
  ['r_eggs_berries', 'snack', 'Two hard-boiled eggs + berries', '', 13, 4, 16, 10, 0, [['Eggs', D], ['Berries (fresh or frozen)', F]]],
  ['r_yogurt_seeds', 'snack', 'Greek yogurt + pumpkin seeds + cinnamon', '', 20, 2, 9, 9, 0, [['Plain Greek yogurt', D], ['Pumpkin seeds', PA], ['Cinnamon', PA]]],
  ['r_cottage_tomato', 'snack', 'Cottage cheese + cherry tomatoes', '', 21, 2, 9, 5, 0, [['Cottage cheese', D], ['Cherry tomatoes', P]]],
  ['r_roasted_chickpeas', 'snack', 'Crispy roasted chickpeas (homemade)', '', 7, 6, 22, 5, 0, [['Canned chickpeas', PA], ['Extra virgin olive oil', PA], ['Smoked paprika', PA]]],
  ['r_pear_walnuts', 'snack', 'Pear + walnuts', '', 4, 7, 28, 13, 0, [['Pears', P], ['Walnuts', PA]]],
  ['r_tuna_cucumber', 'snack', 'Tuna salad on cucumber rounds', '', 20, 1, 4, 8, 0, [['Canned tuna', PA], ['Cucumbers', P], ['Plain Greek yogurt', D]]],
  ['r_chia_pudding', 'snack', 'Chia pudding with berries', '', 8, 11, 20, 10, 0, [['Chia seeds', PA], ['Unsweetened milk', D], ['Berries (fresh or frozen)', F]]],
  ['r_dark_choc', 'snack', 'Dark chocolate (70%+) + almonds, after a meal', '', 5, 4, 12, 17, 4, [['Dark chocolate 70%+', PA], ['Almonds', PA]]],
].map(([id, meal, name, tag, protein, fiber, carbs, fat, added_sugar, ing]) =>
  ({ id, meal, name, savory: tag === 'savory', protein, fiber, carbs, fat, added_sugar, ing: ing.map(([item, aisle]) => ({ item, aisle })) }));
const RECIPE_BY_ID = Object.fromEntries(RECIPES.map(r => [r.id, r]));

module.exports = { scoreLabel, analyzePlate, FOODS, FOOD_BY_ID, RECIPES, RECIPE_BY_ID };
