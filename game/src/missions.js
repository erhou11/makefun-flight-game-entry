// The sortie: take off, fly the ring course, drop the mail, land back home.
// Owns the rings, the drop zones, falling parcels, scoring and phase changes.

// Eight rings around the valley, flown in order. alt is metres above the ground.
const RINGS = [
  { x: 520, z: -620, alt: 120, r: 19 },
  { x: 1120, z: -180, alt: 155, r: 19 },
  { x: 920, z: 520, alt: 95, r: 19 },
  { x: 220, z: 1020, alt: 140, r: 19 },
  { x: -620, z: 820, alt: 110, r: 19 },
  { x: -1120, z: 120, alt: 165, r: 19 },
  { x: -720, z: -720, alt: 100, r: 19 },
  { x: -140, z: -1120, alt: 135, r: 19 },
];

// Three farms waiting for their mail. Parcels are dropped with Space below 140 m.
const DROPZONES = [
  { x: 660, z: 360, r: 45, name: 'Miller Farm' },
  { x: -460, z: -360, r: 45, name: 'Riverside' },
  { x: 160, z: 660, r: 45, name: 'South Field' },
];

function newSortie() {
  return {
    phase: 'takeoff', // takeoff -> rings -> drops -> land -> done
    ringIndex: 0,
    ringsDone: 0,
    dropsDone: 0,
    dropScores: [0, 0, 0],
    parcels: [],
    score: 0,
    timer: 0,
    started: false,
    banner: '',
    bannerUntil: 0,
    ringClipArmed: true,
    result: null,
  };
}

function sortieBanner(sortie, text, now, seconds) {
  sortie.banner = text;
  sortie.bannerUntil = now + (seconds || 4);
}

// Where the pilot should head next; used by the HUD marker and the autopilot.
function currentTarget(sortie, plane) {
  if (sortie.phase === 'takeoff') {
    return { x: 0, z: -700, alt: 120, label: 'Climb out' };
  }
  if (sortie.phase === 'rings') {
    const ring = RINGS[sortie.ringIndex];
    return { x: ring.x, z: ring.z, alt: ring.alt, label: 'Ring ' + (sortie.ringIndex + 1) + ' of ' + RINGS.length };
  }
  if (sortie.phase === 'drops') {
    for (let i = 0; i < DROPZONES.length; i++) {
      if (sortie.dropScores[i] === 0 && !sortie.parcels.some(p => p.zone === i && !p.landed)) {
        const dz = DROPZONES[i];
        return { x: dz.x, z: dz.z, alt: 90, label: 'Drop at ' + dz.name };
      }
    }
    return { x: 0, z: 0, alt: 120, label: 'Head home' };
  }
  if (sortie.phase === 'land') {
    return { x: CFG.runway.x, z: CFG.runway.zSouth - 60, alt: 0, label: 'Land at Kestrel Strip' };
  }
  return { x: plane.x, z: plane.z, alt: plane.alt, label: '' };
}

function dropParcel(sortie, plane) {
  // One parcel per zone; the zone is the nearest unfinished one.
  let best = -1, bestDist = 1e9;
  for (let i = 0; i < DROPZONES.length; i++) {
    if (sortie.dropScores[i] !== 0) continue;
    if (sortie.parcels.some(p => p.zone === i && !p.landed)) continue;
    const d = Math.hypot(plane.x - DROPZONES[i].x, plane.z - DROPZONES[i].z);
    if (d < bestDist) { bestDist = d; best = i; }
  }
  if (best < 0) return null;
  const parcel = {
    zone: best,
    x: plane.x, z: plane.z, alt: plane.alt - 2,
    vx: Math.sin(plane.heading) * plane.speed * 0.55,
    vz: -Math.cos(plane.heading) * plane.speed * 0.55,
    vy: -2,
    landed: false,
  };
  sortie.parcels.push(parcel);
  return parcel;
}

function stepParcels(sortie, dt, events) {
  for (const parcel of sortie.parcels) {
    if (parcel.landed) continue;
    parcel.vy = Math.max(parcel.vy - 14 * dt, -7); // chute drag caps the fall
    parcel.x += parcel.vx * dt;
    parcel.z += parcel.vz * dt;
    parcel.alt += parcel.vy * dt;
    const ground = terrainHeight(parcel.x, parcel.z);
    if (parcel.alt <= ground + 0.4) {
      parcel.landed = true;
      const dz = DROPZONES[parcel.zone];
      const d = Math.hypot(parcel.x - dz.x, parcel.z - dz.z);
      let pts = 0;
      if (d <= 15) pts = 150;
      else if (d <= 30) pts = 100;
      else if (d <= dz.r) pts = 60;
      sortie.dropScores[parcel.zone] = pts;
      if (pts > 0) sortie.dropsDone++;
      sortie.score += pts;
      events.push({ type: 'parcelLanded', zone: parcel.zone, points: pts, dist: d });
    }
  }
}

function updateMissions(sortie, plane, dt, now, events) {
  if (sortie.started && sortie.phase !== 'done') sortie.timer += dt;
  stepParcels(sortie, dt, events);

  if (sortie.phase === 'takeoff' && !plane.onGround) {
    sortie.phase = 'rings';
    sortieBanner(sortie, 'Airborne. Fly the gold rings in order.', now, 5);
    events.push({ type: 'phase', phase: 'rings' });
  }

  if (sortie.phase === 'rings') {
    const ring = RINGS[sortie.ringIndex];
    const dx = plane.x - ring.x;
    const dz = plane.z - ring.z;
    const dy = plane.alt - (terrainHeight(ring.x, ring.z) + ring.alt);
    const dist = Math.hypot(dx, dz, dy);
    if (dist < ring.r) {
      sortie.score += 100;
      sortie.ringsDone++;
      sortie.ringIndex++;
      sortie.ringClipArmed = true;
      events.push({ type: 'ring', index: sortie.ringIndex });
      if (sortie.ringIndex >= RINGS.length) {
        sortie.phase = 'drops';
        sortieBanner(sortie, 'Ring course clear. Deliver the mail: low over a target, press Space.', now, 6);
        events.push({ type: 'phase', phase: 'drops' });
      }
    } else if (dist < ring.r + 8 && sortie.ringClipArmed) {
      sortie.ringClipArmed = false;
      plane.damage = Math.min(100, plane.damage + 6);
      events.push({ type: 'ringClip' });
    }
    if (dist > ring.r + 40) sortie.ringClipArmed = true;
  }

  if (sortie.phase === 'drops') {
    const allDropped = sortie.dropScores.every(s => s !== 0) ||
      (sortie.parcels.length >= DROPZONES.length && sortie.parcels.every(p => p.landed));
    if (allDropped) {
      sortie.phase = 'land';
      sortieBanner(sortie, 'Mail delivered. Bring her home to Kestrel Strip.', now, 6);
      events.push({ type: 'phase', phase: 'land' });
    }
  }
}

function gradeTouchdown(sortie, plane, descentRate, onRunway, aligned) {
  if (!onRunway) return { label: 'Forced landing in a field', points: 60 };
  if (!aligned) return { label: 'Landed across the strip', points: 80 };
  if (descentRate > -1.2) return { label: 'Greased it', points: 220 };
  if (descentRate > -2.4) return { label: 'Firm touchdown', points: 160 };
  return { label: 'Hard landing', points: 90 };
}

function finishSortie(sortie, plane, outcome) {
  sortie.phase = 'done';
  const fuelUsed = Math.round(CFG.fuel.capacity - plane.fuel);
  const timeBonus = outcome.kind === 'landed' ? Math.max(0, 240 - Math.round(sortie.timer)) : 0;
  sortie.score += timeBonus - fuelUsed - Math.round(plane.damage * 2);
  if (sortie.score < 0) sortie.score = 0;
  let grade = 'C';
  if (sortie.score >= 1400) grade = 'S';
  else if (sortie.score >= 1100) grade = 'A';
  else if (sortie.score >= 750) grade = 'B';
  sortie.result = {
    kind: outcome.kind,
    label: outcome.label,
    grade,
    timeBonus,
    fuelUsed,
    time: sortie.timer,
  };
}
