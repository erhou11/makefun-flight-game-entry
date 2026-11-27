// Kestrel Post: Valley Air Mail - shared constants and small math helpers.
// World units are metres. Heading 0 is north (-z), east is +x, up is +y.

function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
function lerp(a, b, t) { return a + (b - a) * t; }
function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash2(ix, iz) {
  let h = Math.imul(ix | 0, 374761393) + Math.imul(iz | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const CFG = {
  viewW: 1280,
  viewH: 720,
  groundW: 640,
  groundH: 360,
  focalGround: 320, // pixels, for the 640x360 ground pass
  focalView: 640,   // pixels, for the 1280x720 view pass

  valleyRadius: 1600,
  mountainStart: 1500,
  mountainFull: 2500,

  runway: { x: 0, zNorth: -350, zSouth: 350, width: 34, heading: 0 },

  plane: {
    maxSpeed: 62,
    stallSpeed: 16,
    rotateSpeed: 25,
    maxPitch: 0.42,
    maxRoll: 0.96,
    gearHeight: 1.4,
    ceiling: 950,
  },

  fuel: { capacity: 100, burnBase: 0.10, burnThrottle: 0.30 },

  sunDir: (() => {
    const v = [-0.52, 0.58, -0.63];
    const len = Math.hypot(v[0], v[1], v[2]);
    return [v[0] / len, v[1] / len, v[2] / len];
  })(),

  skyZenith: [62, 118, 196],
  skyHorizon: [196, 222, 238],
  fogColor: [196, 222, 238],
  fieldPalette: [
    [116, 168, 74],   // pasture
    [88, 150, 66],    // deep green
    [196, 172, 92],   // wheat
    [150, 112, 74],   // ploughed
    [168, 188, 110],  // fallow
    [102, 160, 88],   // meadow
  ],
};
