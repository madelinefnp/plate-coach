# Better Plate (working title)

A food-quality and meal-planning app for women with PCOS, from Root Cause NP. Every health claim is linked to a source on `/evidence` and labeled with how strong the evidence is.

- **Public pages:** landing page `/` (`/landingpage` redirects to it), offer page `/salespage`, `/signup`, `/login`, `/forgot`
- **App** (signed in) `/app`, built around the questions people actually ask:
  - **Today:** daily protein, fiber and added-sugar targets, plus a food log
  - **Scan ("Is this food a good pick?"):** a 0 to 100 score for what's in it, plus a processing check for what's been done to it, based on NOVA ultra-processing markers. Includes one better swap and a pantry list sorted into keep and swap when it runs out.
  - **My plate:** add a photo, tap your foods, and get estimates and rebalancing tips. You can create, view, edit and delete plates.
  - **Plan:** week planner with protein-forward breakfasts first, a grocery list built from the plan and grouped by aisle (checks saved), snack ideas plus a snack builder, fridge, freezer and pantry staples with a label check for each, and a prep and success guide
  - **Me:** a 20-second daily check-in (energy, mood, cravings, sleep, period, symptoms); patterns (streak, non-scale wins, 28-day energy and cycle calendar, cycle length, top symptoms, and how energy compares on fiber-goal days, labeled as a personal pattern); My numbers (labs shown against ADA prediabetes and metabolic syndrome ranges, plus a metabolic syndrome check); and a printable appointment report with guideline-based tests and questions
  - **Barcode scanning:** camera scan (the browser's built-in BarcodeDetector, with the ZXing library as fallback for iPhone) or a typed barcode. Looked up server-side in Open Food Facts (ODbL, credited in the app), cached for 7 days, and used to prefill the label form for the user to check. Unreliable added-sugar values fall back to total sugar, with a warning
  - **7-day experiments:** veggies first, protein breakfast, walk after dinner, 25g fiber (auto-tracked from the food log), sweets after meals, one less ultra-processed snack. Mark days done; results compare check-ins with the 7 days before
  - **Install and reminders:** installable from the browser (manifest plus a service worker that caches the app shell offline, never API data), and repeating calendar (.ics) reminders for the check-in, the after-dinner walk and Sunday planning
  - **Focus setting:** PCOS, insulin resistance, prediabetes or metabolic syndrome. Sets which lesson is suggested first
  - **Learn:** 10 lessons (insulin resistance, real food vs ultra-processed, making it stick, plate building, blood sugar habits, elimination phases)
  - **Account:** targets, email opt-in, data export, account deletion
- **Evidence page:** `/evidence` (rating scale, label-score method, plate method, default targets, 26 references)
- **Compliance pages:** `/privacy`, `/terms`, `/refunds`, `/cookies`, `/privacy-request`, `/admin/compliance` (owner only)

## Run it

```bash
npm install
```

```bash
OWNER_EMAIL=you@yourdomain.com npm start
```

Open http://localhost:3000. Then sign up with `OWNER_EMAIL` to get the owner role and see `/admin/compliance`.

Environment variables (put them in Secrets, never in frontend code):

| Variable | Purpose | Default |
|---|---|---|
| `OWNER_EMAIL` | Account that becomes owner/admin, and where privacy-request alerts go | `owner@example.test` |
| `APP_NAME` / `BRAND_NAME` | Display names | `Better Plate` / `Root Cause NP` |
| `BASE_URL` | Used in emailed links | `http://localhost:3000` |
| `SHOW_OWNER_FLAGS` | Set to `0` to hide the yellow "Owner to confirm" notes before launch | shown |
| `DATA_DIR` | Where the database and uploaded photos are stored | `./data` |
| `NODE_ENV=production` | Turns on secure cookies | |

## Tests

```bash
npm test
```

```bash
npm run test:browser
```

`npm test` runs 33 API and security tests. `npm run test:browser` runs 37 Playwright tests (including evidence links on tips and lessons) (consent banner, full user journey on mobile, admin, CSV downloads, footer links, no horizontal scroll, no console errors) and saves screenshots to `screenshots/`.

## Moving into HighLevel AI Studio

This build runs as a standalone Node app (Express + SQLite). It was built outside AI Studio because AI Studio wasn't reachable from the build environment. To move it in:

1. Create the tables and RLS policies in `docs/highlevel-rls.sql` in the AI Studio Cloud database. Here, isolation is enforced by the server, where every query filters by the signed-in user's id. In AI Studio, RLS has to enforce it in the database. Run the two-account test again after migrating.
2. Point auth at native Cloud users. Set the owner role on the owner's profile row only.
3. Keep photos in a private Cloud storage bucket, using the path rules in that file.
4. Connect email. Right now the owner alert and password-reset emails are **queued** in the `email_outbox` table, which is visible in the admin "Email outbox" tab. **They are not delivered yet.** Either connect a mail sender, or use the HighLevel "Privacy request" form and workflow (tag `privacy-request`, internal notification, confirmation email, 7-day task) and link the footer to it.

## Compliance check (as of this build)

| Requirement | Status | How it was checked |
|---|---|---|
| Banner blocks tracking scripts until the visitor says yes | **Passed** | Browser test: analytics stays unloaded after Reject all and after a reload, and loads only after Accept all |
| Every banner choice creates a new dated `consent_records` row | **Passed** | API and browser tests (reject, accept, custom). The table is append-only (update/delete triggers abort) |
| EU/UK strict opt-in, nothing pre-ticked; GPC honored | **Passed** | Browser test with a Paris time zone and a simulated GPC signal |
| Signup creates a `signup_consents` row; terms box required; marketing unchecked by default | **Passed** | API and browser tests |
| Each Export CSV downloads a CSV | **Passed** | Consent log (with date filter), signup consents, data requests |
| Delete request from `/privacy-request` appears in `/admin/compliance` | **Passed** | Browser test, including the status buttons |
| Owner gets an email for each new request | **Partial** | The email is created and queued, but **not delivered** until an email connection is set up |
| Every footer link works, including Cookie settings | **Passed** | Browser test |
| `/admin/compliance` blocked for signed-out visitors and non-owners | **Passed** | Signed out: redirected to login. Non-owner: 403. Admin APIs return 401/403 |
| Two-account test (B can't read, change or delete A's data or photos) | **Passed** | API test, including direct requests by id |
| Rate limits on login, signup and forms | **Passed** (in memory, per IP) | API test |
| No raw errors or stack traces shown | **Passed** | API test with bad JSON and invalid input |
| Account deletion removes personal data and files | **Passed** | Keeps consent records (legal record) |
| Payments | **N/A** | No price was supplied, so there is no checkout. Accounts are free |

## Evidence standard

- `src/evidence.js` holds every reference. Each one was checked against PubMed, the publisher or a government record in November 2026. Details that couldn't be verified (some page ranges) were left out rather than guessed. Two URLs (the National Academies catalog page and the FDA trans fat page) come from memory and couldn't be opened from the build environment, so click them once to confirm.
- Every lesson section and plate tip has a `level` (guideline, strong, moderate, early, inference) and `refs`. The app shows both. The browser test fails if a lesson cites a reference that doesn't exist.
- Content was corrected to match the evidence:
  - "Savory breakfast" became "protein-forward breakfast", because the trial showed reduced savory cravings, not sweet ones.
  - The elimination-phase lesson now says there's no good evidence that removing food groups helps PCOS in general, and it flags the higher risk of disordered eating.
  - Vinegar is marked as weak evidence.
  - Food-order habits are marked as studied mainly in type 2 diabetes.
  - "Sweets after a meal" is marked as reasoned, not tested.
- Label scoring now uses FDA "good source"/"high" cut-offs for fiber and protein, the AHA added-sugar limit and the 10:1 carb-to-fiber ratio. Two penalties with no evidence behind them (artificial colors, short ingredient list) were removed.
- **Owner/clinical review needed:** the 90g protein default (there is no official PCOS target), and a final clinical read of every lesson.

## Blood sugar habits and trademarks

The habits (veggies first, eating in order, protein-forward breakfast, pairing carbs, sweets after meals, moving after eating, optional vinegar) come from published research that anyone can teach. "Glucose Goddess" is someone else's brand. So the app does **not** use that name, the author's name, her branded phrases or her graphics, and it doesn't imply any affiliation. Keep it that way in marketing too. Teach the research in your own words.

## Design

Current: retro and clear. Periwinkle, hot orange, lime/pistachio and bubblegum pink on cream, midnight blue text, Anton headlines, Figtree body, Phosphor duotone icons, nothing tilted. Text on colored backgrounds is always midnight blue, for contrast. Design previews are in `previews/`.

Previous direction (replaced): 
Editorial and quiet: bone background, espresso text, sage and clay accents, Fraunces (light) headings, DM Sans body, Phosphor line icons (MIT license, self-hosted), no emoji. Fonts and icons are served from this app, with no third-party requests. Optional photography direction is in `docs/image-brief.md`.

## Network note

Barcode lookups call `world.openfoodfacts.org` from the server. In sandboxes that route traffic through an HTTPS proxy, start Node with `NODE_USE_ENV_PROXY=1`. Optionally set `OFF_CONTACT` to a contact address for Open Food Facts' User-Agent etiquette.
