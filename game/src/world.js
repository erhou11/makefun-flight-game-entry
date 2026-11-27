// The valley: terrain height, ground colours, the runway, the river, roads and
// the scattered scenery (trees, barns, a water tower) the renderer draws.

function terrainHeightRaw(x, z) {
  const r = Math.hypot(x, z);
  const mountain = smoothstep(CFG.mountainStart, CFG.mountainFull, r);
  let h = mountain * (215 + 70 * Math.sin(x * 0.004 + 1.7) * Math.cos(z * 0.0031 - 0.6)
    + 55 * Math.sin((x + z) * 0.0019));
  // Gentle rolling in the valley, flattened around the runway.
  const roll = 2.6 * Math.sin(x * 0.011) * Math.cos(z * 0.009);
  const flatNearRunway = smoothstep(90, 420, Math.hypot(x - CFG.runway.x, z));
  h += roll * flatNearRunway * (1 - mountain);
  return h;
}

// The height field is sampled into a grid once; the renderer and the flight
// model read it back with bilinear interpolation, which is far cheaper than
// re-running the trigonometry per pixel.
const HEIGHT_GRID = (() => {
  const N = 257, EXTENT = 2600;
  const data = new Float32Array(N * N);
  for (let iz = 0; iz < N; iz++) {
    for (let ix = 0; ix < N; ix++) {
      data[iz * N + ix] = terrainHeightRaw(-EXTENT + (ix / (N - 1)) * EXTENT * 2, -EXTENT + (iz / (N - 1)) * EXTENT * 2);
    }
  }
  return { data, N, EXTENT };
})();

function terrainHeight(x, z) {
  const { data, N, EXTENT } = HEIGHT_GRID;
  if (x < -EXTENT || x > EXTENT || z < -EXTENT || z > EXTENT) return terrainHeightRaw(x, z);
  const fx = (x + EXTENT) / (EXTENT * 2) * (N - 1);
  const fz = (z + EXTENT) / (EXTENT * 2) * (N - 1);
  const ix = Math.min(Math.floor(fx), N - 2);
  const iz = Math.min(Math.floor(fz), N - 2);
  const tx = fx - ix, tz = fz - iz;
  const a = data[iz * N + ix], b = data[iz * N + ix + 1];
  const c = data[(iz + 1) * N + ix], d = data[(iz + 1) * N + ix + 1];
  return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
}

function riverCenterX(z) {
  return 420 * Math.sin(z * 0.0011) + 150 * Math.sin(z * 0.0037 + 0.8);
}

function isOnRunway(x, z) {
  const rw = CFG.runway;
  return Math.abs(x - rw.x) <= rw.width / 2 && z >= rw.zNorth && z <= rw.zSouth;
}

function groundColor(x, z, knownHeight) {
  const rw = CFG.runway;
  // Runway slab with centreline dashes, edge lines and threshold bars.
  if (isOnRunway(x, z)) {
    const ax = Math.abs(x - rw.x);
    if (ax > rw.width / 2 - 1.6) return [225, 228, 230];
    if (ax < 1.1 && ((z % 36) + 36) % 36 < 18) return [235, 238, 240];
    if (z < rw.zNorth + 26 || z > rw.zSouth - 26) {
      if (((x % 6) + 6) % 6 < 3) return [232, 235, 238];
    }
    const shade = 96 + ((hash2(Math.floor(x / 9), Math.floor(z / 9)) * 14) | 0);
    return [shade, shade + 2, shade + 6];
  }
  // River with sandy banks.
  const riverDist = Math.abs(x - riverCenterX(z));
  if (riverDist < 15) {
    const sparkle = hash2(Math.floor(x / 7), Math.floor(z / 7)) * 22;
    return [64 + sparkle, 128 + sparkle, 196];
  }
  if (riverDist < 21) return [196, 178, 132];
  // Two dirt roads crossing the valley.
  if (Math.abs(z - 180) < 5 || Math.abs(x + 520) < 5) return [178, 156, 116];
  // Mail drop targets painted on the fields.
  for (let i = 0; i < DROPZONES.length; i++) {
    const dz = DROPZONES[i];
    const d = Math.hypot(x - dz.x, z - dz.z);
    if (d < dz.r) {
      const band = Math.floor(d / 9) % 2;
      return band ? [238, 240, 242] : [204, 62, 52];
    }
  }
  // Patchwork fields by hashed cell, with a little per-pixel grain.
  const cell = 130;
  const ix = Math.floor(x / cell);
  const iz = Math.floor(z / cell);
  const pick = CFG.fieldPalette[Math.floor(hash2(ix, iz) * CFG.fieldPalette.length)];
  const grain = 0.92 + hash2(Math.floor(x / 11), Math.floor(z / 11)) * 0.16;
  let r = pick[0] * grain, g = pick[1] * grain, b = pick[2] * grain;
  // Rock and snow as the ground climbs into the mountain ring.
  const h = knownHeight !== undefined ? knownHeight : terrainHeight(x, z);
  if (h > 6) {
    const rockMix = clamp((h - 6) / 90, 0, 1);
    r = lerp(r, 122, rockMix); g = lerp(g, 116, rockMix); b = lerp(b, 112, rockMix);
    if (h > 165) {
      const snowMix = clamp((h - 165) / 60, 0, 1);
      r = lerp(r, 240, snowMix); g = lerp(g, 244, snowMix); b = lerp(b, 250, snowMix);
    }
  }
  return [r, g, b];
}

// Scenery is placed once with a fixed seed so every run of the game (and every
// screenshot) sees the same valley. Items avoid the runway, river and targets.
const SCENERY = (() => {
  const rand = mulberry32(20261126);
  const items = [];
  function clearOf(x, z) {
    if (Math.abs(x - CFG.runway.x) < 70 && z > CFG.runway.zNorth - 90 && z < CFG.runway.zSouth + 90) return false;
    if (Math.abs(x - riverCenterX(z)) < 34) return false;
    if (Math.abs(z - 180) < 16 || Math.abs(x + 520) < 16) return false;
    for (let i = 0; i < DROPZONES.length; i++) {
      if (Math.hypot(x - DROPZONES[i].x, z - DROPZONES[i].z) < DROPZONES[i].r + 24) return false;
    }
    return true;
  }
  for (let i = 0; i < 150; i++) {
    const a = rand() * Math.PI * 2;
    const r = 160 + rand() * 1250;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (!clearOf(x, z)) continue;
    items.push({ kind: rand() < 0.62 ? 'pine' : 'tree', x, z, s: 0.8 + rand() * 0.7 });
  }
  const barnSpots = [[240, 420], [-380, 260], [700, -480], [-820, -260], [120, -760], [-240, 980], [980, 640], [-1080, 520]];
  for (const [x, z] of barnSpots) items.push({ kind: 'barn', x, z, s: 1 });
  items.push({ kind: 'tower', x: 90, z: -430, s: 1 });
  items.push({ kind: 'tower', x: -640, z: -620, s: 1 });
  return items;
})();

// Low drifting clouds, drawn as soft billboards.
const CLOUDS = (() => {
  const rand = mulberry32(777);
  const clouds = [];
  for (let i = 0; i < 14; i++) {
    clouds.push({
      x: (rand() - 0.5) * 3200,
      z: (rand() - 0.5) * 3200,
      y: 300 + rand() * 160,
      s: 90 + rand() * 130,
    });
  }
  return clouds;
})();
