# Pizza Pi — playtest notes (24 Oct 2026)

Automation and my own playthroughs can't show that the game is fun or that students learn from it. Those need real grade-8 players.

## Verified

**Unit tests (21, passing):** every authored ticket has a perfect solution inside its stock; L1 r = 10 and sauce 298–330; r = 20 is flagged as diameter-as-radius; sauce at circumference value is named; L2 crust 94.2 ±4% with gap and overlap; π·r named; L3 minimum r = 14 (13.5 fails, 15 wastes); L4 d 26, ×1.69, linear ×1.3 named, unenlarged pie named; L5 one d40 beats two d28 by 25.1 cm²; L6 540 g water, wet/dry, fix with 1000 g flour; L7 numbers; out-of-stock and shift clock end the shift; all four rush tickets servable in any order; calculator parser.

**In a real browser:**

| What | Where | Result |
|---|---|---|
| Full L1 win, keyboard only (arrows, `2`, typed 314, `Enter`, `4`, `Enter` bake, `Enter` serve) | Chrome desktop 1568×708 | ★★★, tip +14; result scroll matches mockup 04 |
| Mouse drag stretches the dough | Chrome + in-app browser | drag gave r = 13; the −1 chip ×3 gave 10 |
| Recoverable mistakes: bare ring (250 cm²), linear sauce in L4 (408), crust gap 80 cm in L2, wet dough tearing in L6 | in-app browser | visible consequence + chef line + floating tag; L2 result explains `2 × π × r ≈ 94.2`, gap 14.2; ticket stays open, retry works |
| Oven: pie slides into the oven mouth, comes out golden; cheese lava at the gap | in-app browser | ✓ (`design/screenshots/crust-gap-lava.jpg`) |
| L5 two-pie choice, L7 four tickets + 2:30 clock + queueing customers | in-app browser | ✓ |
| Hint (notebook) disabled in L7; restart and level select | scripted | ✓ |
| Tripo models in gameplay (oven, bottle, chef, Noa, Saba; kids as tinted Noa clones) with idle/cheer clips playing | both browsers | ✓ |
| Mobile 375×812 portrait | in-app browser emulation | layout matches mockup 03 (`design/screenshots/mobile-crust-gap.jpg`) |
| Console errors | in-app browser + Chrome | none; one three.js deprecation warning (PCFSoftShadowMap) fixed |
| Performance | Chrome, this Mac, DPR 2, 3456×1560 canvas | 94 fps measured, 226 draw calls, ≈481k triangles rendered (shadows included) |
| Build | `npm run build` | JS 789 KB (211 KB gzip), CSS 17 KB, models 3.4 MB, dist 4.3 MB |

## Bugs found while playing (fixed)

- The camera went NaN on a 0×0 first resize and the scene stayed black.
- Skinned Tripo characters were frustum-culled (bind-pose bounds) and vanished in the window.
- Typing a sauce amount lost focus mid-number when a chef tip re-rendered the card; the leftover digits then jumped stations ("314" → oven).
- Formulas in LTR spans wrapped and read backwards in RTL paragraphs (`≈ r × π × 2`).
- Timers rebuilt the HUD every second, invalidating buttons mid-click.

## UI/UX pass 2 (hand-played in Chrome after user feedback, 24 Oct)

Played levels 1, 2, 5 and 7 by mouse and keyboard, checked 3, 4 and 6 by script plus screenshots, and checked mobile 375×812. Found and fixed:

- **Clicks lost:** topping chips and other ± chips sometimes did nothing because the HUD rebuilt the button between press and release. Chips now act on pointerdown, and cards only re-render when their HTML changes.
- **Camera re-zoomed while dragging the dough** (framing followed r), so the drag-to-radius mapping drifted under the mouse. The station framing is now fixed; the camera settles faster.
- **No drag affordance** on the dough ball: added a pulsing ring.
- **The chef covered the customer** on wide screens, and his tip bubble covered his face. Smaller chef placed further back; the bubble anchors beside his head.
- **The game HUD showed through the title/intro/level cards:** now hidden behind them.
- **Customers walked through the kitchen** and off-duty ones loitered in shot. They now walk behind the wall; waiting customers queue in the dining room, seen through the pass (rush hour reads as a crowd). The active customer is already at the window on the intro card.
- **Result card covered the customer's reaction:** it now sits beside the window (bottom sheet on phones), without dimming.
- **Pie never reached the customer** on serve; now it slides to the pass. At the oven station the pie is staged in front of the oven, then goes fully inside to bake (it used to sit half under the tabs, then stop at the mouth).
- **Props in the way:** the sauce bottle and a basil pot sat in the bake path; the oil bottle too. Moved. Topping jars hid behind the chef; now back-right with their own camera framing.
- **Crust:** within tolerance it now draws as sealed (it showed a gap next to a "סגור ✓" tag); golden cheese colour; the rope is thick and orange on a cream tape; rope dragging hits the tape plane (it read 68 cm at the 70 mark); the reel and the zero end are on screen; the knife hides after the cut.
- **Particles:** red "gravel" splats, cotton-ball steam and huge confetti cubes were shrunk. A sauce stream now runs from the nozzle while squeezing.
- **Text:** formulas outside LTR spans in the notebook read scrambled (`2 × r × π`); all formulas are now isolated. Parentheses around LTR numbers in tickets rendered as "(קוטר 25 )" and were removed. Tickets showed "ניסיון 2" after a first-try success. The coin emoji rendered grey and is now an SVG.
- **Level 5 scale tilted the wrong way:** it's now a drawn balance whose heavier pan (one large pizza) goes down, with your choice marked.
- **Mobile:** the portrait camera re-tuned so the dough and crust tape sit above the control card.
- **Enter on a card** that had just changed could press the next card's button; Enter is now ignored for 450 ms after a card change.

Testing note: Chrome and the in-app browser throttle animation frames when their window is in the background, which froze the game clock (it looked like "baking never finishes"). That is not a player-facing bug; scripted checks step time with `advanceTime`.

## Known limits / not verified

- No touch-device test on a real phone (emulated viewport only); FPS on phones is not measured. Triangle count is high for low-end phones: the character meshes (~19k each) and shadow pass are the first things to cut.
- The full L2–L7 flows were driven by script plus screenshots, not by hand clicking every step.
- The crust ruler is 120 cm; anything longer is clamped (no level needs more than 94.2).
- Wet/dry dough shows only when stretching past r = 7 (by design), so a student could knead and not notice until the dough station.
- The chef's cheer is borrowed from Noa's clip (same Mixamo skeleton); it reads fine but isn't his own animation.
- Sound is procedural and was not listened to by a person in this session.
- Accessibility: keyboard play works and feedback is never colour-only (tags, text, sound), but no screen-reader pass.
- Student learning, difficulty curve and fun are hypotheses until a classroom playtest.
