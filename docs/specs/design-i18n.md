# Design, languages and layout

## Languages
- Spanish (default) and English, switched in the sidebar. The choice is saved with her data.
- Every visible text exists in both languages. `tests/keys.test.mjs` fails if one is missing.
- Default subject names are translated. Names she typed are shown as written.
- Dates, weekdays and months follow the language.

## Design page
- Colours: 8 presets and a free picker, separately for the main colour (buttons) and the accent.
- Mode: light, dark, or follow the device.
- Corners: sharp, soft, rounded, very rounded.
- Fonts: 10, all system fonts (nothing is loaded from outside).
- Backgrounds: 18, including 8 animated (aurora, stars, rain, snow, bubbles, hearts, deep sea, fireflies) and her own photo. Animations stop when the device asks for reduced motion.
- A "reset" button restores the defaults. Choices are saved with her data. The photo is not.
- A card "Who can see my progress" lists the linked parents and what they can and cannot see.

## Layout
- Sidebar with 16 line-icon entries, language switch, name, sign-out. Below 860 px wide the sidebar becomes a slide-out menu.
- Pages are single-column cards that reflow on phones. Charts are plain SVG or CSS, with no chart library.
- The first screen after sign-in is the home page. For a parent the sidebar has two entries (Family, Add a child) and the first screen is Family. The sidebar foot shows the app version (`vX.Y.Z`, taken from `package.json` at build time).
- The home page shows a one-time card to a child with linked parents (dismissal stored in `sp2-notice`, shown again if the set of parents changes).

## Technology
Vanilla JavaScript modules bundled by esbuild into `app.js` (about 150 KB), one stylesheet, no framework, no runtime dependencies. HTML is built with an escaping template helper so typed text cannot inject markup.

## Tests
`tests/app.test.js` covers navigation, icons, language switch and design controls.

## Known gaps
Not tested on real phones or on Safari. No accessibility audit beyond labels and keyboard use for the main controls.
