// The autopilot flies the demo (attract) mode behind the title screen and on
// request: it takes off, threads the rings, drops the mail and lands. It uses
// the same controls a player has, so the demo is the real game being flown.

const autoState = { leg: 'fix' };

function resetAutopilot() {
  autoState.leg = 'fix';
}

function autopilotInput(plane, sortie) {
  const ctl = { pitchIn: 0, rollIn: 0, throttleDelta: 0, brake: false, drop: false };
  const agl = plane.alt - terrainHeight(plane.x, plane.z);

  if (plane.onGround) {
    ctl.throttleDelta = 1;
    if (plane.speed > CFG.plane.rotateSpeed + 2) ctl.pitchIn = 0.7;
    return ctl;
  }

  // Landing: join the approach fix south of the strip, then glide in.
  if (sortie.phase === 'land') {
    const fix = { x: 0, z: 980, alt: 135 };
    const distFix = Math.hypot(plane.x - fix.x, plane.z - fix.z);
    if (autoState.leg === 'fix' && distFix < 160) autoState.leg = 'final';
    if (autoState.leg === 'final' && plane.z < -120) autoState.leg = 'fix'; // went around
    let aim, wantAlt, wantSpeed;
    if (autoState.leg === 'fix') {
      aim = fix; wantAlt = fix.alt; wantSpeed = 36;
    } else {
      aim = { x: 0, z: 300 };
      wantAlt = Math.max(0, (plane.z - 300)) * 0.085 + 1;
      wantSpeed = 27;
      if (agl < 9) { wantAlt = 0; ctl.pitchIn = 0.18; ctl.throttleDelta = -1; }
    }
    const err = wrapAngle(Math.atan2(aim.x - plane.x, -(aim.z - plane.z)) - plane.heading);
    ctl.rollIn = clamp(err * 1.5, -1, 1);
    if (autoState.leg !== 'final' || agl >= 9) {
      ctl.pitchIn = clamp((wantAlt - agl) * 0.02 - plane.vy * 0.07, -1, 1);
      ctl.throttleDelta = clamp((wantSpeed - plane.speed) * 0.16, -1, 1);
    }
    return ctl;
  }

  const target = currentTarget(sortie, plane);
  const targetAlt = terrainHeight(target.x, target.z) + target.alt;
  const err = wrapAngle(Math.atan2(target.x - plane.x, -(target.z - plane.z)) - plane.heading);
  ctl.rollIn = clamp(err * 1.35, -1, 1);
  ctl.pitchIn = clamp((targetAlt - plane.alt) * 0.016 - plane.vy * 0.06, -1, 1);
  const wantSpeed = sortie.phase === 'drops' ? 35 : 43;
  ctl.throttleDelta = clamp((wantSpeed - plane.speed) * 0.16, -1, 1);

  // Stay off the ground while navigating.
  if (agl < 45) ctl.pitchIn = Math.max(ctl.pitchIn, 0.55);

  // Release a parcel when the target farm is close below.
  if (sortie.phase === 'drops' && agl < 130 && !sortie.parcels.some(p => !p.landed)) {
    const dist = Math.hypot(plane.x - target.x, plane.z - target.z);
    if (dist < 52) ctl.drop = true;
  }
  return ctl;
}
