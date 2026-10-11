# Contributing

Thanks for helping. The most valuable contributions are **corrections from
fluent signers**: if a sign looks wrong, please say so, even without code.

## Licence of contributions

The project is under the [Personal Use License](LICENSE) (source-available, not
open-source). By submitting a contribution you grant the copyright holder a
perpetual, irrevocable licence to use, modify and relicense it as part of the
project (section 4 of the licence). Only contribute what you have the right to.

## Setup

```bash
git clone https://github.com/37OMKAR/signlanguage.git
cd signlanguage
npm install
npm run dev
```

Node 20+ is required.

## Before you open a pull request

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

CI runs the same checks plus `npm run license:check`.

## Ground rules

- **Provenance is mandatory.** Every dictionary entry needs `provenance` and
  `commercial_safe`. Never mark research-only or unknown-licence data as
  safe. See [docs/LICENSING.md](docs/LICENSING.md).
- **No video.** All motion is numeric keyframes. Do not add video playback.
- **No API keys in the browser.** AI calls go through `scripts/ai-proxy`.
- **Match the surrounding code.** Keep comments to the non-obvious "why".
- **Add tests** for logic changes (compile, NLP rules, IK, loader).

## Fixing or adding a sign

1. Read [docs/DATA_FORMAT.md](docs/DATA_FORMAT.md) and [docs/ARM_IK.md](docs/ARM_IK.md).
2. Edit `data/gloss_dictionary.json`: finger `curls`, `R_palm_deg`, and
   `R_at` / `L_at` for hand location.
3. Run the app at slow speed (the slider goes down to 0.25x) and compare
   with a trusted reference such as Lifeprint or Handspeak.
4. In the PR, say which reference you used and whether a signer reviewed it.

## Reporting a bad sign

Open a *Sign correction* issue with the gloss, what you see, what it should
look like, and a reference link.

## Code of conduct

Be respectful. Deaf and hard-of-hearing people are the people this project
is for; centre their feedback.
