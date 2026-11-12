// "What's been done to it?" A processing check from an ingredient list, based on the NOVA
// classification's marker approach (Monteiro 2019): ingredients rarely used in home kitchens,
// or additives used to make a product more palatable or appealing, signal ultra-processing.
// This is a transparent screen, not a lab test. Framed positively: it suggests swaps, never shame.

const MARKERS = [
  { group: 'Industrial sugars', why: 'Sugars made in factories, not kitchens.', words: ['high fructose corn syrup', 'high-fructose corn syrup', 'corn syrup solids', 'glucose syrup', 'glucose-fructose', 'maltodextrin', 'invert sugar', 'dextrose', 'fructose'] },
  { group: 'Industrial fats', why: 'Oils changed by industrial processes.', words: ['hydrogenated', 'interesterified'] },
  { group: 'Modified proteins and starches', why: 'Parts of foods broken down or rebuilt in a factory.', words: ['hydrolyzed', 'hydrolysed', 'protein isolate', 'soy protein isolate', 'whey protein isolate', 'milk protein concentrate', 'modified starch', 'modified food starch', 'modified corn starch', 'textured vegetable protein'] },
  { group: 'Flavors', why: 'Added to make a product taste like more than it is.', words: ['natural flavor', 'natural flavour', 'artificial flavor', 'artificial flavour', 'flavoring', 'flavouring', 'smoke flavor'] },
  { group: 'Colors', why: 'Added to make a product look appealing.', words: ['red 40', 'yellow 5', 'yellow 6', 'blue 1', 'caramel color', 'caramel colour', 'titanium dioxide', 'artificial color', 'color added', 'colour added'] },
  { group: 'Emulsifiers and thickeners', why: 'Change texture and shelf life.', words: ['lecithin', 'mono- and diglycerides', 'mono and diglycerides', 'monoglycerides', 'polysorbate', 'carrageenan', 'carboxymethylcellulose', 'cellulose gum', 'xanthan gum', 'guar gum', 'gellan gum', 'sodium stearoyl lactylate', 'datem'] },
  { group: 'Non-sugar sweeteners', why: 'Sweeten without sugar, keeping the taste for sweet high.', words: ['sucralose', 'aspartame', 'acesulfame', 'saccharin', 'stevia extract', 'steviol', 'monk fruit extract', 'erythritol', 'maltitol', 'sorbitol', 'xylitol'] },
  { group: 'Flavor enhancers', why: 'Boost savory taste beyond the food itself.', words: ['monosodium glutamate', 'msg', 'disodium inosinate', 'disodium guanylate', 'yeast extract'] },
];
const CULINARY = ['sugar', 'cane sugar', 'honey', 'maple syrup', 'salt', 'sea salt', 'oil', 'butter', 'vinegar', 'molasses'];

function split(text) {
  return String(text || '').toLowerCase().replace(/[()\[\]{}]/g, ',').replace(/\band\b/g, ',').split(/[,;.]/).map(s => s.trim()).filter(Boolean);
}

function checkProcessing(ingredientsText) {
  const ings = split(ingredientsText);
  if (!ings.length) return { level: 'unknown', label: 'Add the ingredients to check', note: 'Paste the ingredient list to see what’s been done to this food.', found: [], count: 0 };
  const found = [];
  for (const m of MARKERS) {
    const hits = [...new Set(ings.filter(ing => m.words.some(w => (w === 'msg' ? /\bmsg\b/.test(ing) : ing.includes(w)))))];
    if (hits.length) found.push({ group: m.group, why: m.why, items: hits.slice(0, 4) });
  }
  const culinary = ings.some(ing => CULINARY.some(w => ing === w || ing.endsWith(' ' + w) || ing.startsWith(w + ' ')));
  let level, label, note;
  if (found.length) {
    level = 'ultra'; label = 'Ultra-processed signs';
    note = `${found.length === 1 ? 'One sign' : found.length + ' kinds of signs'} of ultra-processing. No stress: swap it for a simpler version when it runs out.`;
  } else if (culinary || ings.length > 5) {
    level = 'processed'; label = 'Processed';
    note = 'Made from real foods with things like salt, sugar or oil added. These can be part of a balanced plate.';
  } else if (ings.length > 1) {
    level = 'minimal'; label = 'Minimally processed';
    note = 'A short list of recognizable foods. Great pantry staple.';
  } else {
    level = 'whole'; label = 'Whole food';
    note = 'One ingredient. It’s just food.';
  }
  return { level, label, note, found, count: ings.length };
}

module.exports = { checkProcessing, MARKERS };
