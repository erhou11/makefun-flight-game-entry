// The Kestrel K-2 flight model: arcade handling with real discipline - speed
// bleeds in a climb, turns need bank, slow flight stalls, and the ground is
// unforgiving. stepFlight advances one tick and reports what happened.

function newAircraft() {
  const startZ = CFG.runway.zSouth - 40;
  return {
    x: CFG.runway.x,
    z: startZ,
    alt: terrainHeight(CFG.runway.x, startZ) + CFG.plane.gearHeight,
    heading: 0, // north, down the strip
    speed: 0,
    pitch: 0,
    roll: 0,
    vy: 0,
    throttle: 0,
    fuel: CFG.fuel.capacity,
    damage: 0,
    onGround: true,
    stalled: false,
    crashed: false,
  };
}

// ctl: { pitchIn, rollIn, throttleDelta, brake } with inputs in -1..1.
function stepFlight(plane, ctl, dt, events) {
  const P = CFG.plane;
  const engineOn = plane.fuel > 0 && !plane.crashed;

  plane.throttle = clamp(plane.throttle + ctl.throttleDelta * dt * 0.55, 0, 1);
  const throttle = engineOn ? plane.throttle : 0;
  if (engineOn) {
    plane.fuel = Math.max(0, plane.fuel - (CFG.fuel.burnBase + throttle * CFG.fuel.burnThrottle) * dt);
  }

  // Speed chases the throttle setting; gravity helps in a dive, hurts in a climb.
  const targetSpeed = 10 + throttle * (P.maxSpeed - 10);
  plane.speed += (targetSpeed - plane.speed) * Math.min(1, dt * 0.4);
  plane.speed -= Math.sin(plane.pitch) * 9.81 * dt * 0.55;
  if (plane.onGround) plane.speed -= plane.speed * dt * (ctl.brake ? 1.6 : 0.12);
  plane.speed = clamp(plane.speed, 0, 78);

  // Attitude follows the stick with a little lag, faster at speed.
  const authority = clamp(plane.speed / 30, 0.25, 1);
  let wantPitch = ctl.pitchIn * P.maxPitch;
  plane.stalled = !plane.onGround && plane.speed < P.stallSpeed;
  if (plane.stalled) wantPitch = Math.min(wantPitch, -0.18); // nose drops
  plane.pitch += (wantPitch - plane.pitch) * Math.min(1, dt * (2.2 + authority * 2));
  plane.roll += (ctl.rollIn * P.maxRoll - plane.roll) * Math.min(1, dt * (2.4 + authority * 2));

  // Banked flight turns; the sharper the bank, the tighter the turn.
  if (!plane.onGround) {
    plane.heading = wrapAngle(plane.heading + (9.81 * Math.tan(plane.roll) / Math.max(plane.speed, 9)) * dt);
  } else if (plane.speed > 4) {
    plane.heading = wrapAngle(plane.heading + ctl.rollIn * 0.35 * dt); // rudder steering on the roll
  }

  plane.vy = plane.onGround ? 0 : Math.sin(plane.pitch) * plane.speed * 0.62;
  plane.x += Math.sin(plane.heading) * plane.speed * dt;
  plane.z += -Math.cos(plane.heading) * plane.speed * dt;
  plane.alt += plane.vy * dt;
  if (plane.alt > P.ceiling) plane.alt = P.ceiling;

  const ground = terrainHeight(plane.x, plane.z) + P.gearHeight;

  if (plane.onGround) {
    plane.alt = ground;
    if (plane.speed >= P.rotateSpeed && ctl.pitchIn > 0.25) {
      plane.onGround = false;
      plane.alt = ground + 0.5;
      events.push({ type: 'liftoff' });
    }
    return;
  }

  if (plane.alt <= ground) {
    const descent = plane.vy;
    const onRunway = isOnRunway(plane.x, plane.z);
    const headingErr = Math.abs(wrapAngle(plane.heading - CFG.runway.heading));
    const aligned = headingErr < 0.26 || Math.abs(headingErr - Math.PI) < 0.26;
    plane.alt = ground;
    if (descent < -5.2 || plane.speed > 46 || Math.abs(plane.roll) > 0.5) {
      plane.crashed = true;
      plane.speed = 0;
      events.push({ type: 'crash', reason: descent < -5.2 ? 'Drove her into the ground' : 'Too fast and crooked' });
    } else if (!onRunway && descent < -3.4) {
      plane.crashed = true;
      plane.speed = 0;
      events.push({ type: 'crash', reason: 'Broke up in the rough' });
    } else {
      plane.onGround = true;
      plane.vy = 0;
      plane.pitch = 0;
      plane.roll = 0;
      if (descent < -2.4) plane.damage = Math.min(100, plane.damage + 18);
      events.push({ type: 'touchdown', descent, onRunway, aligned });
    }
  }

  if (plane.damage >= 100 && !plane.crashed) {
    plane.crashed = true;
    events.push({ type: 'crash', reason: 'The airframe gave up' });
  }
}
