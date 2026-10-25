# Front Plot · 3D walkthrough

A third-person 3D walk through the front plot landscape plan (v5): the block drive and carport off the car entry, the 8 ft walkway to the main stair, the forecourt over the cesspit, the lawn, the small garden with the shade tree and bench, and the house. A man walks it with two companions who follow wherever he goes: an orange dog and a black-and-white cat.

Built with **Vite + TypeScript + Three.js**, rendered in a realistic architectural-visualisation style (soft ambient occlusion via N8AO, gentle bloom, filmic tone mapping, cloud sky). Everything (textures, trees, characters) is generated in code, so there are no image or model files to host.

## Controls

| Desktop | Phone / tablet |
| --- | --- |
| **W A S D** or arrow keys to walk | Joystick (bottom left) to walk |
| **Shift** to run | Push the joystick to the edge to run |
| Drag with the mouse to look around | Drag anywhere on the scene to look |
| Scroll to zoom | Pinch to zoom |
| **Q / E** to turn the camera | |

- **Go to** jumps to a spot (main stair, porch, gates, carport, garden bench).
- **Time** switches between morning, noon, evening and night (lamps and windows light up at night).
- **Labels** toggles the plan labels.
- Click or tap the **map** to jump to that point.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm run preview    # serve the production build
```

Node 18 or newer.

## Deploy on Vercel

The project is ready for Vercel as-is (`vercel.json` sets the Vite build and the `dist` output folder).

**Option A: from GitHub (recommended)**
1. Push this folder to a new GitHub repository.
2. On vercel.com, choose **Add New → Project** and import the repository.
3. Vercel detects Vite. Keep the defaults and press **Deploy**.

**Option B: from your computer with the Vercel CLI**
```bash
npm install
npx vercel          # first time: log in and link the project
npx vercel --prod   # production deploy
```

## Changing the plan

All plan measurements live in `src/plan.ts`, in the same units as the 2D plan drawing (10 units = 1 ft). Move a tree, a pot, the carport or a lamp there and the 3D scene follows.

| File | What it builds |
| --- | --- |
| `src/plan.ts` | Plan data: outlines, trees, shrubs, pots, lamps, gates, stair, ramps |
| `src/ground.ts` | Ground painted from the plan (lawn, beds, pavers, stone strips), grass blades |
| `src/structures.ts` | Walls, gates, house, stair and porch, carport, car, bench, lamps, pots |
| `src/plants.ts` | Trees, shrubs, hedge and coconut palms |
| `src/surroundings.ts` | Road, neighbouring buildings, poles and wires |
| `src/characters.ts` | The man, dog and cat, and how the companions follow |
| `src/controls.ts` | Keyboard, mouse, touch, joystick |
| `src/main.ts` | Lighting, time of day, camera, labels, UI |

Sizes are scaled from the hand sketch, so treat them as approximate until measured on site.
