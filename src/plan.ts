/**
 * Plan v5 data, taken directly from the 2D site plan.
 * Plan units: 10 units = 1 ft, origin of the plot at (110, 90).
 * World units are metres: +x = east, +z = south (towards the house), +y = up.
 */
export const FT = 0.3048;
export const U = FT / 10;
export const wx = (x: number): number => (x - 110) * U;
export const wz = (y: number): number => (y - 90) * U;

export const PLOT_W = wx(460); // 35 ft
export const PLOT_D = wz(940); // 85 ft, plot ends at the bottom of the main stair
export const ROAD_Y = -0.3; // the whole plot sits a little above the road

export const STAIR = { x0: wx(260), x1: wx(340), steps: 5, rise: 0.16, tread: 0.3 };
export const STAIR_CX = (STAIR.x0 + STAIR.x1) / 2;
export const PORCH_Y = STAIR.steps * STAIR.rise;
export const PORCH = {
  z0: PLOT_D + STAIR.steps * STAIR.tread,
  z1: PLOT_D + STAIR.steps * STAIR.tread + 2.0,
};

export const RAMP = { x1: wx(166), z0: wz(372), z1: wz(500) }; // car entry ramp, inside the plot
export const GATE = { z0: wz(532), z1: wz(656) }; // sliding gate opening (ramp is outside on the road)
export const PILLARS_Z = [wz(360), wz(509), wz(525), wz(659)];
/** 3 ft of solid wall between the car entry and the sliding gate. */
export const MID_WALL = { z0: wz(502), z1: wz(532) };

export const PATHS = {
  plot: 'M110 200Q115 105 250 90H460V940H110Z',
  beds: 'M110 372V200Q115 105 250 90H460V372H426C414 340 430 300 420 262C410 222 428 190 406 168C382 150 352 176 322 166C292 156 266 178 238 186C206 195 188 218 184 252C180 290 166 310 170 340C172 356 166 366 164 372Z',
  hedgeBed: 'M318 372C330 352 372 344 426 346V372Z',
  eastBed: 'M460 600C436 606 422 630 422 664V880C422 905 440 920 460 925Z',
  paving: 'M110 372H460V512H360Q340 512 340 532V940H110Z',
  westBed: 'M110 730C140 734 162 760 160 800V940H110Z',
};
export const STRIPS = ['M460 512H360Q340 512 340 532V940', 'M259.5 512V940'];
export const STEPPING: Array<[number, number]> = [[236, 361], [242, 337], [248, 313], [257, 290]];
export const BENCH_PAD = { x: 300, y: 258, rx: 36, ry: 13 };
export const CESSPIT = { x: 208, y: 747 };
export const SOAK_PIT = { x: 335, y: 122 };

export type TreeKind = 'mango' | 'plumeria' | 'small' | 'kachnar' | 'green' | 'ashoka' | 'neem' | 'feature';
export const TREES: Array<{ x: number; y: number; kind: TreeKind }> = [
  { x: 155, y: 185, kind: 'mango' },
  { x: 212, y: 128, kind: 'plumeria' },
  { x: 138, y: 258, kind: 'small' },
  { x: 372, y: 118, kind: 'kachnar' },
  { x: 430, y: 122, kind: 'green' },
  { x: 136, y: 330, kind: 'plumeria' },
  { x: 440, y: 196, kind: 'ashoka' },
  { x: 442, y: 262, kind: 'ashoka' },
  { x: 440, y: 326, kind: 'ashoka' },
  { x: 442, y: 650, kind: 'neem' },
  { x: 440, y: 722, kind: 'neem' },
  { x: 440, y: 792, kind: 'neem' },
  { x: 440, y: 860, kind: 'neem' },
  { x: 300, y: 200, kind: 'feature' },
];

export type ShrubKind = 'green' | 'hibiscus' | 'yellow';
export const SHRUBS: Array<[number, number, ShrubKind]> = [
  [252, 112, 'yellow'], [405, 108, 'hibiscus'], [188, 152, 'yellow'], [130, 222, 'green'],
  [150, 296, 'hibiscus'], [140, 360, 'green'], [442, 230, 'hibiscus'], [442, 294, 'yellow'],
  [128, 768, 'green'], [145, 802, 'hibiscus'], [128, 838, 'green'], [145, 872, 'yellow'], [128, 906, 'green'],
  [300, 120, 'green'], [190, 205, 'green'], [425, 160, 'green'],
];
export const HEDGE: Array<[number, number]> = [[332, 364], [340, 362], [360, 358], [380, 356], [400, 356], [418, 358]];
export const POTS: Array<[number, number, ShrubKind]> = [[130, 676, 'green'], [130, 530, 'hibiscus'], [238, 920, 'green']];
export const BOLLARDS: Array<[number, number]> = [[354, 560], [354, 890]];
export const WALL_LIGHTS: Array<[number, number]> = [[118, 706], [118, 890]];

export const CARPORT = { x0: wx(270), x1: wx(460), z0: wz(384), z1: wz(494) };
export const CAR = { x: (wx(300) + wx(441)) / 2, z: wz(439) };

/** NW boundary curve, sampled in plan units. */
export function nwCurve(n = 14): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = (1 - t) ** 2 * 110 + 2 * t * (1 - t) * 115 + t * t * 250;
    const y = (1 - t) ** 2 * 200 + 2 * t * (1 - t) * 105 + t * t * 90;
    pts.push([x, y]);
  }
  return pts;
}

/** Ground surface height (no stair/porch). */
export function terrainY(x: number, z: number): number {
  if (x < 0) {
    if (z > GATE.z0 && z < GATE.z1 && x > -1.0) return ROAD_Y * -x;
    return ROAD_Y;
  }
  if (x < RAMP.x1 && z > RAMP.z0 && z < RAMP.z1) return ROAD_Y * (1 - x / RAMP.x1);
  return 0;
}

/** Walkable height including the main stair and porch. */
export function groundY(x: number, z: number): number {
  if (z >= PLOT_D && z < PORCH.z0 && x >= STAIR.x0 && x <= STAIR.x1) {
    const i = Math.min(STAIR.steps, Math.floor((z - PLOT_D) / STAIR.tread) + 1);
    return i * STAIR.rise;
  }
  if (z >= PORCH.z0 && x >= 0) return PORCH_Y;
  return terrainY(x, z);
}
