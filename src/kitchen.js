// Kitchen content: staples, label checks, snack builder, planning moments and success habits.
// Written in Root Cause NP's voice: add, don't restrict. Progress over perfection.
// OWNER REVIEW: Madeline should confirm staples and tips fit her program.

const STAPLES = [
  {
    zone: 'fridge', title: 'The fridge', icon: 'drop',
    items: [
      { name: 'Eggs', why: 'Fast protein for any meal.', check: null },
      { name: 'Plain Greek yogurt or skyr', why: 'About 15 to 20g protein a serving.', check: 'Ingredients should be just milk and cultures. Skip flavored cups with added sugar or sweeteners.' },
      { name: 'Cottage cheese', why: 'Protein for snacks and breakfasts.', check: 'Look for milk, cream, salt and cultures. Some brands add gums, which is a sign of more processing.' },
      { name: 'Leafy greens', why: 'Your “veggies first” starter.', check: null },
      { name: 'Crunchy veg (peppers, cucumbers, carrots)', why: 'Snack and salad fiber.', check: null },
      { name: 'Hummus', why: 'Fiber and protein for dipping.', check: 'Chickpeas, tahini, oil, lemon, garlic, salt. Skip ones with preservatives you don’t recognize if you can.' },
      { name: 'Cheese', why: 'Protein and fat that make snacks last.', check: 'Real cheese is milk, cultures, salt and enzymes. “Cheese product” is a different thing.' },
      { name: 'Tofu or tempeh', why: 'Plant protein that keeps for weeks.', check: null },
      { name: 'Lemons and limes', why: 'Flavor without a sauce bottle.', check: null },
    ],
  },
  {
    zone: 'freezer', title: 'The freezer', icon: 'sparkle',
    items: [
      { name: 'Frozen vegetables', why: 'Picked and frozen fast, so they\u2019re often as nutritious as fresh, and they don\u2019t go bad.', check: 'Ingredients: just the vegetable. Skip ones with sauce packets.' },
      { name: 'Frozen berries', why: 'Fiber for yogurt, oats and smoothies.', check: 'Just fruit, no added sugar.' },
      { name: 'Frozen fish or shrimp', why: 'A 15-minute dinner protein.', check: 'Plain, not breaded.' },
      { name: 'Frozen edamame', why: 'A snack with 17g protein and 8g fiber.', check: null },
      { name: 'Frozen cauliflower rice', why: 'Easy way to add veg to grain bowls.', check: null },
      { name: 'Whole grain bread', why: 'Keeps for weeks in the freezer.', check: '“Whole” grain as the first ingredient, at least 3g fiber a slice, short ingredient list.' },
    ],
  },
  {
    zone: 'pantry', title: 'The pantry', icon: 'grains',
    items: [
      { name: 'Canned beans, lentils and chickpeas', why: 'Fiber and protein in one. Ready in seconds.', check: 'Beans, water, salt. That’s it. Rinse to cut sodium.' },
      { name: 'Canned tuna or salmon', why: 'Shelf-stable protein.', check: 'Fish, water or olive oil, salt.' },
      { name: 'Oats, quinoa, brown rice', why: 'Whole grains for steady energy.', check: 'Plain, unflavored. Flavored instant packets usually add sugar and flavors.' },
      { name: 'Chickpea or lentil pasta', why: 'More protein and fiber than white pasta.', check: 'Ingredient list should be the bean flour, sometimes with pea protein.' },
      { name: 'Natural nut butter', why: 'Healthy fat to pair with fruit.', check: 'Nuts, maybe salt. Skip hydrogenated oils and added sugar.' },
      { name: 'Nuts and seeds (chia, flax, pumpkin)', why: 'Fat, fiber and crunch.', check: 'Raw or dry roasted. Skip honey-roasted or candied.' },
      { name: 'Extra virgin olive oil', why: 'Your main cooking fat.', check: null },
      { name: 'Vinegars', why: 'Dressings, and optional vinegar water before carb-heavy meals.', check: null },
      { name: 'Canned tomatoes and salsa', why: 'Quick sauces with no sugar needed.', check: 'Tomatoes, salt, maybe herbs. Salsa: vegetables and spices, no sugar.' },
      { name: 'Spices', why: 'Cinnamon, cumin, smoked paprika, garlic powder, chili flakes. Flavor that turns basics into meals.', check: null },
      { name: 'Seed or whole grain crackers', why: 'Crunch with fiber.', check: 'At least 3g fiber per serving, whole grains or seeds first.' },
    ],
  },
];

const LABEL_CHECKS = [
  { q: 'What’s in it?', icon: 'tag', text: 'The Nutrition Facts panel: added sugar, fiber and protein per serving. That’s the label score.' },
  { q: 'What’s been done to it?', icon: 'flask', text: 'The ingredient list. Could you buy each ingredient at a grocery store and cook with it? If you see things like maltodextrin, “natural flavor,” emulsifiers or sweeteners, it’s ultra-processed.' },
  { q: 'Is there a simpler version?', icon: 'arrows-clockwise', text: 'Often the same food exists with a shorter list: plain yogurt instead of flavored, nut butter that’s just nuts, bread with whole grain first.' },
];

const SNACK_BUILDER = {
  protein: ['Greek yogurt', 'Cottage cheese', '2 hard-boiled eggs', 'Cheese', 'Handful of nuts', 'Hummus', 'Tuna', 'Edamame'],
  fiber: ['Berries', 'Apple or pear', 'Crunchy veggies', 'Chia seeds', 'Roasted chickpeas', 'Seed crackers', 'Cherry tomatoes'],
};

const PLAN_MOMENTS = [
  { icon: 'sun-horizon', title: 'Busy weekday breakfasts', text: 'Decide the night before. Rotate 2 or 3 protein-forward breakfasts so there’s nothing to think about. Egg muffins and chia pudding prep ahead.' },
  { icon: 'fork-knife', title: 'Workday lunches', text: 'Cook once, eat twice. Make extra dinner and pack it before you sit down to eat.' },
  { icon: 'clock', title: 'The 3pm snack', text: 'This is when cravings hit. Pack a protein + fiber pair in the morning so the vending machine isn’t your plan.' },
  { icon: 'moon', title: 'Tired-night dinners', text: 'Have a 15-minute fallback: frozen veg + canned beans or fish + a quick grain. No takeout guilt, just a plan.' },
];

const PREP_HOUR = [
  'Cook 2 proteins (for example, a tray of chicken and a pot of lentils)',
  'Roast 2 trays of vegetables',
  'Cook 1 pot of grains (quinoa or brown rice)',
  'Mix 1 sauce or dressing (olive oil, lemon, garlic, herbs)',
  'Wash fruit and cut crunchy veg for snacks',
  'Hard-boil a few eggs',
];

const SUCCESS = [
  { icon: 'calendar-blank', title: 'Plan 3 dinners, not 7', text: 'Leftovers and a fallback meal cover the rest. Small plans actually happen.' },
  { icon: 'list-checks', title: 'Shop with a list', text: 'Your meal plan builds the grocery list for you. Shopping from a list is how plans become meals.' },
  { icon: 'arrows-clockwise', title: 'Swap one pantry item a week', text: 'When something runs out, replace it with a simpler version. In two months your pantry looks different, with zero overhaul.' },
  { icon: 'clock', title: 'Have a 2-minute version', text: 'On the hardest days, do the smallest version: Greek yogurt and berries, or a handful of nuts with an apple. Consistency beats perfect.' },
  { icon: 'heart', title: 'Add before you subtract', text: 'Ask what you can add to a meal (protein, veggies, fiber) before thinking about what to take away.' },
];

module.exports = { STAPLES, LABEL_CHECKS, SNACK_BUILDER, PLAN_MOMENTS, PREP_HOUR, SUCCESS };
