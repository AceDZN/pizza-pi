# Pizza Pi — progress

## 24 Oct 2026

- Read `handoffs/math-2026-10-24/COMMON.md`, `pizza-pi/BUILD_HANDOFF.md` and the design reset.
- Wrote the pure rules (`src/rules.ts`), the seven authored levels and the deterministic state machine (`src/game.ts`), with 21 tests.
- Tripo (user's Chrome): oven + sauce bottle; characters regenerated in T-pose, retopologized, Mixamo-rigged, animated (idle, cheer). See ASSETS.md.
- The user asked to design from gameplay mockups first. Four gpt-image mockups were made in ChatGPT (`design/mockups/`), and the scene was rebuilt from one long counter into a single cosy diorama to match them: oven left, chef right, customer at the pass window, pie centre stage, chunky cream/green HUD.
- Playtested in Chrome and the in-app browser (desktop + mobile emulation), fixed the bugs listed in PLAYTEST.md.
- Public repo: https://github.com/AceDZN/pizza-pi (branch `main`). The git directory lives outside the Idea Plotter checkout (`~/.git-repos/pizza-pi.git`, `core.worktree` = this folder), so the parent repo is untouched. To work on it elsewhere, clone from GitHub.

## Next ideas

- Real-phone test; reduce triangles/shadows on mobile if needed.
- A chef-specific cheer and a customer "disappointed" clip from Tripo.
- Optional content from the handoff: 15%-off coupon (אחוזים) and a deep-dish πr²h level.
- Deploy to Vercel (static `dist/`).
