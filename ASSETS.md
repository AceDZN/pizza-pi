# Pizza Pi — assets

Everything ships in the repo and is loaded locally; nothing is fetched at runtime.

## Tripo models (Tripo Studio in the user's Chrome, 24 Oct 2026)

Generator: Tripo Studio, HD Model, text-to-3D, H3.1. Characters were regenerated in **T-pose** (the user asked for rigged, animated characters), retopologized to 20k triangles, auto-rigged with the **Mixamo** skeleton preset, and animated with Tripo's free **idle** and **cheer** presets. Exports are GLB, 1k textures, skeleton on, "animation stay in place" on.

Optimization (all files): `npx @gltf-transform/cli@4.2.1 optimize <raw> <out> --compress meshopt --texture-compress webp --texture-size 1024` plus `--simplify-ratio 0.04 --simplify-error 0.002` for the two static props and `--simplify false` for the skinned characters. Raw downloads stay in `scripts/raw/` (gitignored). Loaded with three's `GLTFLoader` + `MeshoptDecoder`.

| File | Used as | Task id | Prompt (abridged) | Raw → shipped | Triangles (loaded) | Clips | SHA-256 |
|---|---|---|---|---|---|---|---|
| `oven.glb` | Hero wood-fired oven, left of the counter; glowing mouth the pie slides into | `654e17f2-8a26-4b24-80f2-a1c1cc0e7e83` | "Stylized chunky wood-fired pizza oven, rounded igloo dome of warm terracotta bricks, wide arched mouth glowing with orange embers…, short copper chimney…, hand-painted cartoon style" | 31.1 MB → 448 KB | 39,654 | — | `493d076a…c090` |
| `sauce-bottle.glb` | Tomato squeeze bottle that tilts nozzle-down and squashes on every squeeze | `c8fb2560-025a-4585-a5c0-67f993d5b46b` | "Red tomato sauce squeeze bottle with a pointed white nozzle cap, soft squishy plastic body, cartoon smiling tomato and basil leaf label…" | 28.8 MB → 379 KB | 37,668 | — | `569f80c3…69ed` |
| `chef.glb` | Peppe the pizzaiolo (mentor, speech bubbles), right of the counter | `926490d6-2d55-4bc5-a88b-2a1681346827` | "Cheerful chubby pizzaiolo chef character in T-pose, arms stretched straight out…, big curly black mustache, tall white chef hat, red neckerchief, flour-dusted white apron with basil green belt…" | 3.46 MB → 683 KB | 18,142 | idle (cheer borrowed from Noa by bone name, hips translation dropped) | `d2735f03…a581` |
| `noa.glb` | Noa, teen customer | `7f449562-0e02-4ab9-a20d-6f4d1b7c490c` | "Hungry teenage girl customer character in T-pose…, big round glasses, oversized purple hoodie, jeans, chunky sneakers, messy high ponytail, excited grin…" | 4.10 MB → 921 KB | 19,308 | idle, cheer | `31602ccd…c43d` |
| `saba.glb` | Saba Moti, grandpa customer | `eb6264df-76aa-42b6-bc06-8125b8be17f9` | "Tall skinny grandpa customer character in T-pose…, flat tweed cap, huge fluffy white beard, knitted basil-green vest over a striped shirt…" | 4.23 MB → 931 KB | 18,514 | idle, cheer | `789a00ba…2007` |

| `kid-ido.glb` | Ido (8), one of the three hungry kids in level 3 / rush hour | `c67a1916-9402-4ba9-98e9-55a7bf931101` | "Small energetic boy about 8 years old in T-pose…, curly red hair, freckles, green and white striped soccer jersey with the number 7…" | 3.11 MB → 617 KB | 10,034 | rigged; idle/cheer borrowed from Noa/Saba by bone name | `46df866817d03823…` |
| `kid-maya.glb` | Maya (6) | `bfe8055d-58be-4362-9aed-8fa1b7f0d34b` | "Tiny cheerful girl about 6 years old in T-pose…, two big puffy black pigtails with yellow bows, bright yellow raincoat, red rain boots…" | 2.59 MB → 452 KB | 9,602 | same | `3efaae523c1a8ecd…` |
| `kid-yoni.glb` | Yoni (10) | `ce9eb8c9-d74f-4dc9-b165-e219b3092cd8` | "Chubby boy about 10 years old in T-pose…, backwards blue baseball cap over dark curly hair, orange t-shirt with a pizza slice print, brown cargo shorts…" | 2.85 MB → 537 KB | 9,310 | same | `8681d2eb7f6ba029…` |

The three kids replaced tinted clones of Noa after user feedback (24 Oct, evening): T-pose generation, triangle retopology at 10k, Mixamo auto-rig. Their clips reuse Noa's and Saba's Tripo idle/cheer by bone name (hips translation dropped) because Tripo's animation queue took 10+ minutes per clip. Cost by list price: 3 × (45 + 35 + 20) = 300 credits; shared balance 2555 → 2255.

Task URLs: `https://studio.tripo3d.ai/workspace/generate/<task id>`.

### Credits and budget (honest accounting)

- The Tripo account is shared with the two other builders, who generated at the same time, so the balance cannot be attributed per click. Balance seen before my first generation: **3940**. Last balance seen: **2630**.
- My own spend by Tripo's listed prices: 8 generations × 45 + 3 retopologies × 35 + 3 auto-rigs × 20 = **525 credits**. Animation presets showed no deduction.
- The handoff budget was **5 generations**. I used **8**: the first five (oven, bottle, and three posed characters), then three T-pose regenerations after the user asked for rigged and animated characters. The three posed originals (chef `98c3d175-89df-427f-a8ca-adb4e90c4656`, girl `bacbfab2-586e-4b30-b6c7-fe38134cb003`, grandpa id not recorded) are **not used**. No credits were bought; no plan was upgraded.

## Gameplay mockups (gpt-image, ChatGPT in the user's Chrome)

At the user's request, gameplay "screenshots" were generated first and used as the UI/UX target. Conversation: `https://chatgpt.com/c/6adc85b4-fa84-83eb-9c6d-3d8196f84394`. Prompts described the Tripo characters and oven so the art direction matches.

| File | Screen | SHA-256 |
|---|---|---|
| `design/mockups/01-dough-station.png` | Desktop, dough station, radius ruler, HUD frame | `764615ff…a7` |
| `design/mockups/02-sauce-station.png` | Desktop, sauce gauge, bare ring warning, chef's notebook | `5fad3c52…a2` |
| `design/mockups/03-mobile-crust.png` | Phone portrait, crust tape and gap | `4c1b5746…b4` |
| `design/mockups/04-result.png` | Result scroll after a perfect pie | `20f44443…0e` |

`design/screenshots/` holds real in-game captures from Chrome and the in-app browser for side-by-side comparison.

## Procedural (exact geometry, not generated meshes)

Dough disc and rim, sauce disc (radius = √(A/π)), overflow puddle, charred bare ring, cheese-crust tube along an arc of exactly L/r radians, dough ruler (cm), crust tape (cm), ghost ring (level 4), peel, counter, walls, window, lamp, toppings, mixing bowl, jug, bell, knife, sponge, particles. Textures (wood, dough, sauce, bricks, chalkboard, rulers, labels) are painted on canvases at runtime.

## Other

- Font: Rubik (Hebrew + Latin subsets, weights 500/700/900) via `@fontsource/rubik` 5.2.8, bundled (SIL OFL 1.1).
- Sound: procedural WebAudio in `src/audio.ts` (no audio files).
