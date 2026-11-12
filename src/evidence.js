// Evidence library. Every health claim in the app points at one or more of these.
// Citations were checked against PubMed / publisher / government records (Nov 2026).
// Where a page number or exact detail could not be verified it is left out rather than guessed.

const LEVELS = {
  guideline: { label: 'Guideline', text: 'From a clinical guideline or official reference value.' },
  strong: { label: 'Strong evidence', text: 'Supported by systematic reviews or consistent larger trials.' },
  moderate: { label: 'Moderate evidence', text: 'Supported by randomized trials, but limited in size or length.' },
  early: { label: 'Early evidence', text: 'Small or short studies, mostly in people with type 2 diabetes or prediabetes rather than PCOS. Promising, not proven.' },
  expert: { label: 'Expert view', text: 'A framework from a recognized expert. A useful way to think about food, not proven on its own.' },
  inference: { label: 'Reasoned, not tested', text: 'A practical step reasoned from related evidence. It has not been tested directly.' },
};

const REFS = {
  pcos2023: {
    cite: 'Teede HJ, et al. International Evidence-based Guideline for the Assessment and Management of Polycystic Ovary Syndrome 2023. Monash University; endorsed by 39 organizations. Published in Fertil Steril, Hum Reprod, J Clin Endocrinol Metab and Eur J Endocrinol (2023).',
    note: 'Recommends healthy eating and physical activity for all women with PCOS, with benefits even without weight loss. Found no one diet better than another. Activity advice (based on general adult guidelines): at least 150 minutes of moderate or 75 minutes of vigorous activity a week, plus muscle strengthening on 2 non-consecutive days. Flags higher risk of disordered eating and asks clinicians to avoid weight stigma.',
    url: 'https://doi.org/10.26180/23625288.v1',
  },
  stepto2013: {
    cite: 'Stepto NK, et al. Women with polycystic ovary syndrome have intrinsic insulin resistance on euglycaemic-hyperinsulaemic clamp. Hum Reprod. 2013;28(3):777-784.',
    note: 'Gold-standard clamp testing found insulin resistance in 75% of lean and 95% of overweight women with PCOS.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/23315061/',
  },
  dk2012: {
    cite: 'Diamanti-Kandarakis E, Dunaif A. Insulin resistance and the polycystic ovary syndrome revisited: an update on mechanisms and implications. Endocr Rev. 2012;33(6):981-1030.',
    note: 'Review of how insulin resistance, independent of weight, contributes to PCOS, including insulin acting on the ovary to raise androgen production.',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5393155/',
  },
  sorensen2012: {
    cite: 'Sørensen LB, et al. Effects of increased dietary protein-to-carbohydrate ratios in women with polycystic ovary syndrome. Am J Clin Nutr. 2012;95(1):39-48.',
    note: '6-month trial, 57 women with PCOS. Swapping some carbohydrate for protein improved weight loss and glucose measures.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/22158730/',
  },
  leidy2013: {
    cite: 'Leidy HJ, et al. Beneficial effects of a higher-protein breakfast on the appetitive, hormonal, and neural signals controlling energy intake regulation in overweight/obese, "breakfast-skipping," late-adolescent girls. Am J Clin Nutr. 2013;97(4):677-688.',
    note: 'Small crossover trial (20 girls, 7 days per arm). Eating breakfast reduced cravings compared with skipping it. The 35g-protein breakfast also cut savory cravings more than a 13g-protein cereal breakfast, and reduced evening snacking compared with skipping.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/?term=Leidy+higher-protein+breakfast+breakfast-skipping+late-adolescent+girls',
  },
  shukla2015: {
    cite: 'Shukla AP, Iliescu RG, Thomas CE, Aronne LJ. Food order has a significant impact on postprandial glucose and insulin levels. Diabetes Care. 2015;38(7):e98-e99.',
    note: 'Pilot study, 11 adults with type 2 diabetes. The same meal eaten vegetables and protein first, carbohydrate last, gave lower glucose and insulin after the meal.',
    url: 'https://doi.org/10.2337/dc15-0429',
  },
  imai2014: {
    cite: 'Imai S, Fukui M, Kajiyama S. Effect of eating vegetables before carbohydrates on glucose excursions in patients with type 2 diabetes. J Clin Biochem Nutr. 2014;54(1):7-11.',
    note: 'Review of one research group’s studies (mostly Japanese adults with type 2 diabetes). Eating vegetables before carbohydrates lowered glucose swings short term and was linked to better long-term control.',
    url: 'https://www.jstage.jst.go.jp/article/jcbn/54/1/54_13-67/_article',
  },
  reynolds2016: {
    cite: 'Reynolds AN, Mann JI, Williams S, Venn BJ. Advice to walk after meals is more effective for lowering postprandial glycaemia in type 2 diabetes mellitus than advice that does not specify timing: a randomised crossover study. Diabetologia. 2016;59(12).',
    note: 'Randomized crossover trial, 41 adults with type 2 diabetes. Ten minutes of walking after each meal lowered after-meal glucose about 12% more than one 30-minute walk at another time, with the biggest effect after dinner.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/27747394/',
  },
  johnston2004: {
    cite: 'Johnston CS, Kim CM, Buller AJ. Vinegar improves insulin sensitivity to a high-carbohydrate meal in subjects with insulin resistance or type 2 diabetes. Diabetes Care. 2004;27(1):281-282.',
    note: 'Small study (29 people). Vinegar before a high-carbohydrate meal improved the after-meal insulin response, most in people with insulin resistance.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/?term=Johnston+vinegar+improves+insulin+sensitivity+high-carbohydrate+meal',
  },
  shishehbor2017: {
    cite: 'Shishehbor F, Mansoori A, Shirani F. Vinegar consumption can attenuate postprandial glucose and insulin responses; a systematic review and meta-analysis of clinical trials. Diabetes Res Clin Pract. 2017;127:1-9.',
    note: 'Pooled small trials and found lower after-meal glucose and insulin with vinegar. Later reviews rate the included studies at high risk of bias.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/28292654/',
  },
  aha2009: {
    cite: 'Johnson RK, et al. Dietary sugars intake and cardiovascular health: a scientific statement from the American Heart Association. Circulation. 2009;120(11):1011-1020.',
    note: 'Recommends no more than about 100 calories a day from added sugar for most women, about 6 teaspoons or 25g.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/19704096/',
  },
  iom2005: {
    cite: 'Institute of Medicine. Dietary Reference Intakes for Energy, Carbohydrate, Fiber, Fat, Fatty Acids, Cholesterol, Protein, and Amino Acids. Washington, DC: National Academies Press; 2005.',
    note: 'Sets adequate fiber intake at 14g per 1,000 calories: 25g a day for women 19 to 50 and 21g after 50. Protein RDA is 0.8g per kg of body weight.',
    url: 'https://nap.nationalacademies.org/catalog/10490',
  },
  mozaffarian2013: {
    cite: 'Mozaffarian RS, et al. Identifying whole grain foods: a comparison of different approaches for selecting more healthful whole grain products. Public Health Nutr. 2013;16(12).',
    note: 'Of 545 grain products, those with a carbohydrate-to-fiber ratio of 10:1 or better had more fiber and less sugar, sodium and trans fat. This worked better than the Whole Grain Stamp.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/23286205/',
  },
  fda10154: {
    cite: 'U.S. Food and Drug Administration. 21 CFR 101.54, Nutrient content claims for "good source," "high," "more," and "high potency."',
    note: 'A "good source" provides 10 to 19% of the Daily Value per serving, and "high" provides 20% or more. With Daily Values of 28g fiber and 50g protein, that is 2.8g and 5.6g fiber, and 5g and 10g protein.',
    url: 'https://www.ecfr.gov/current/title-21/chapter-I/subchapter-B/part-101/subpart-D/section-101.54',
  },
  dga2020: {
    cite: 'U.S. Department of Agriculture and U.S. Department of Health and Human Services. Dietary Guidelines for Americans, 2020-2025. 9th edition. December 2020.',
    note: 'Recommends making at least half of grains whole grains, limiting refined grains and added sugars, and notes most people fall short on fiber.',
    url: 'https://www.dietaryguidelines.gov/',
  },
  adaplate: {
    cite: 'American Diabetes Association. What is the Diabetes Plate Method? Diabetes Food Hub.',
    note: 'Half the plate non-starchy vegetables, a quarter protein, a quarter carbohydrate foods. A practical model, not a precise carb count.',
    url: 'https://diabetesfoodhub.org/articles/what-is-the-diabetes-plate-method.html',
  },
  fdatrans: {
    cite: 'U.S. Food and Drug Administration. Final determination regarding partially hydrogenated oils (2015).',
    note: 'FDA found partially hydrogenated oils, the main source of artificial trans fat, are no longer generally recognized as safe.',
    url: 'https://www.fda.gov/food/food-additives-petitions/trans-fat',
  },
};

Object.assign(REFS, {
  hall2019: {
    cite: 'Hall KD, et al. Ultra-processed diets cause excess calorie intake and weight gain: an inpatient randomized controlled trial of ad libitum food intake. Cell Metab. 2019;30(1):67-77.',
    note: '20 adults lived at the NIH for 4 weeks. Diets were matched for calories offered, sugar, fat, fiber and salt. On the ultra-processed diet people ate about 500 more calories a day, ate faster and gained weight; on the minimally processed diet they lost weight.',
    url: 'https://www.nih.gov/news-events/news-releases/nih-study-finds-heavily-processed-foods-cause-overeating-weight-gain',
  },
  monteiro2019: {
    cite: 'Monteiro CA, et al. Ultra-processed foods: what they are and how to identify them. Public Health Nutr. 2019;22(5):936-941.',
    note: 'Defines the NOVA groups (unprocessed, culinary ingredients, processed, ultra-processed). A food is ultra-processed if its ingredient list has things rarely used in home kitchens, like high-fructose corn syrup, hydrolyzed proteins or hydrogenated oils, or additives such as flavors, colors, emulsifiers, sweeteners and thickeners.',
    url: 'https://doi.org/10.1017/S1368980018003762',
  },
  lane2024: {
    cite: 'Lane MM, et al. Ultra-processed food exposure and adverse health outcomes: umbrella review of epidemiological meta-analyses. BMJ. 2024;384:e077310.',
    note: 'Pooled 45 meta-analyses (about 9.9 million people). Higher ultra-processed food intake was linked with 32 poorer health outcomes, including type 2 diabetes. These are associations from observational studies, not proof of cause.',
    url: 'https://doi.org/10.1136/bmj-2023-077310',
  },
  lustig2021: {
    cite: 'Lustig RH. Metabolical: The Lure and the Lies of Processed Food, Nutrition, and Modern Medicine. Harper Wave; 2021.',
    note: 'A pediatric endocrinologist\u2019s framework, summed up as \u201Cprotect the liver, feed the gut\u201D: limit added sugar and refined carbs, eat more fiber, and pay attention to what\u2019s been done to food, not only what\u2019s in it. Reviewers find the food advice sound but some of the science arguments stronger than the evidence.',
    url: 'https://search.worldcat.org/search?q=Metabolical+Lustig',
  },
  reynolds2019: {
    cite: 'Reynolds A, Mann J, Cummings J, Winter N, Mete E, Te Morenga L. Carbohydrate quality and human health: a series of systematic reviews and meta-analyses. Lancet. 2019;393(10170):434-445.',
    note: 'Across prospective studies and trials, people eating 25 to 29g of fiber a day had lower risk of type 2 diabetes, heart disease and early death than those eating little. Higher intakes may help even more. Certainty: moderate for fiber.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/30638909/',
  },
  ducrot2017: {
    cite: 'Ducrot P, et al. Meal planning is associated with food variety, diet quality and body weight status in a large sample of French adults. Int J Behav Nutr Phys Act. 2017;14:12.',
    note: '40,554 adults. People who planned meals ahead ate a more varied, higher-quality diet, and women who planned had lower odds of overweight and obesity. Observational, so it shows a link rather than cause.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/28153017/',
  },
  ada2026: {
    cite: 'American Diabetes Association. Diagnosis and Classification of Diabetes: Standards of Care in Diabetes, 2026. Diabetes Care. 2026 (Section 2).',
    note: 'Prediabetes: A1c 5.7 to 6.4%, fasting glucose 100 to 125 mg/dL, or 2-hour glucose 140 to 199 mg/dL on a 75g glucose tolerance test. Diabetes: A1c 6.5% or higher, fasting glucose 126 or higher, or 2-hour glucose 200 or higher, usually confirmed with a second test. Risk is continuous across these ranges.',
    url: 'https://diabetes.org/about-diabetes/diagnosis',
  },
  alberti2009: {
    cite: 'Alberti KGMM, et al. Harmonizing the metabolic syndrome: a joint interim statement. Circulation. 2009;120(16):1640-1645.',
    note: 'Metabolic syndrome is 3 or more of 5: raised waist size (cutoffs depend on population), triglycerides 150 mg/dL or more, HDL under 50 mg/dL in women, blood pressure 130/85 or more, fasting glucose 100 mg/dL or more (or treatment for any of these).',
    url: 'https://www.world-heart-federation.org/wp-content/uploads/2017/05/1640.full_.pdf',
  },
  dpp2002: {
    cite: 'Diabetes Prevention Program Research Group (Knowler WC, et al.). Reduction in the incidence of type 2 diabetes with lifestyle intervention or metformin. N Engl J Med. 2002;346(6):393-403.',
    note: 'In 3,234 adults with prediabetes, a lifestyle program (healthier eating and 150 minutes of activity a week) cut new cases of type 2 diabetes by 58% over about 3 years. Metformin cut them by 31%.',
    url: 'https://doi.org/10.1056/NEJMoa012512',
  },
});

const ORDER = Object.keys(REFS);
const refNumber = id => ORDER.indexOf(id) + 1;

module.exports = { LEVELS, REFS, ORDER, refNumber };
