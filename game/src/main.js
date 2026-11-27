// Kestrel Post: Valley Air Mail - main loop and game states.
// Title screen (with the demo flying behind it), the sortie itself, pause and
// the end screen. ?demo=1 starts straight into the autopilot demo; ?view=cockpit
// starts in the cockpit camera.

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = CFG.viewW;
canvas.height = CFG.viewH;

function fitCanvas() {
  const scale = Math.min(window.innerWidth / CFG.viewW, window.innerHeight / CFG.viewH);
  canvas.style.width = Math.floor(CFG.viewW * scale) + 'px';
  canvas.style.height = Math.floor(CFG.viewH * scale) + 'px';
}
window.addEventListener('resize', fitCanvas);
fitCanvas();
Input.attach(canvas);

const params = new URLSearchParams(window.location.search);
let demoMode = params.get('demo') === '1';
let viewMode = params.get('view') === 'cockpit' ? 'cockpit' : 'chase';
let state = demoMode ? 'flying' : 'title';
let paused = false;

let plane = newAircraft();
let sortie = newSortie();
let camState = { heading: 0, pitch: 0, roll: 0 };
sortieBanner(sortie, 'Throttle up with W. Lift off past 50 knots.', 0, 8);

function resetSortie() {
  plane = newAircraft();
  sortie = newSortie();
  camState = { heading: 0, pitch: 0, roll: 0 };
  resetAutopilot();
  sortieBanner(sortie, 'Throttle up with W. Lift off past 50 knots.', performance.now() / 1000, 8);
}

function handleEvents(events, now) {
  for (const ev of events) {
    if (ev.type === 'liftoff') {
      sortie.started = true;
    } else if (ev.type === 'ring') {
      Sound.chime();
    } else if (ev.type === 'ringClip') {
      Sound.thud();
      sortieBanner(sortie, 'Clipped the ring. Airframe damage.', now, 3);
    } else if (ev.type === 'parcelLanded') {
      if (ev.points > 0) {
        Sound.chime();
        sortieBanner(sortie, 'Mail delivered at ' + DROPZONES[ev.zone].name + ': +' + ev.points, now, 4);
      } else {
        sortieBanner(sortie, 'Parcel missed ' + DROPZONES[ev.zone].name + '.', now, 4);
      }
    } else if (ev.type === 'touchdown') {
      if (sortie.phase === 'land') {
        const grade = gradeTouchdown(sortie, plane, ev.descent, ev.onRunway, ev.aligned);
        sortie.score += grade.points;
        finishSortie(sortie, plane, { kind: 'landed', label: grade.label + ' at Kestrel Strip' });
        Sound.fanfare();
        state = 'ended';
      } else if (sortie.phase !== 'takeoff') {
        finishSortie(sortie, plane, { kind: 'forced', label: 'Forced landing. The mail waits for another day.' });
        state = 'ended';
      }
    } else if (ev.type === 'crash') {
      Sound.thud();
      finishSortie(sortie, plane, { kind: 'crashed', label: ev.reason });
      state = 'ended';
    }
  }
}

let lastTime = performance.now();
function frame() {
  requestAnimationFrame(frame);
  const nowMs = performance.now();
  const now = nowMs / 1000;
  const dt = clamp((nowMs - lastTime) / 1000, 0, 0.05);
  lastTime = nowMs;

  if (Input.cameraQueued) {
    Input.cameraQueued = false;
    viewMode = viewMode === 'chase' ? 'cockpit' : 'chase';
  }
  if (Input.pauseQueued) {
    Input.pauseQueued = false;
    if (state === 'flying') paused = !paused;
  }
  if (Input.restartQueued) {
    Input.restartQueued = false;
    resetSortie();
    state = 'flying';
    paused = false;
  }
  if (state === 'title' && Input.startQueued) {
    Input.startQueued = false;
    Sound.init();
    demoMode = false;
    resetSortie();
    state = 'flying';
  } else if (Input.startQueued) {
    Input.startQueued = false;
    Sound.init();
  }

  if (!paused && state !== 'ended') {
    const demo = demoMode || state === 'title';
    const ctl = demo ? autopilotInput(plane, sortie) : Input.read();
    if (ctl.drop && sortie.phase === 'drops') {
      const agl = plane.alt - terrainHeight(plane.x, plane.z);
      if (agl < 140 && dropParcel(sortie, plane)) Sound.drop();
    }
    const events = [];
    stepFlight(plane, ctl, dt, events);
    updateMissions(sortie, plane, dt, now, events);
    handleEvents(events, now);
    Sound.update(plane.throttle, plane.speed, plane.fuel > 0 && !plane.crashed);
  }

  const cam = buildCamera(plane, camState, viewMode, dt);
  renderWorld(ctx, cam, plane, sortie, now, viewMode);
  if (state === 'flying') drawHud(ctx, cam, plane, sortie, now);
  if (state === 'title') drawTitleScreen(ctx, now);
  if (state === 'ended') drawEndScreen(ctx, sortie, plane);
  if (paused) {
    ctx.fillStyle = 'rgba(10,16,26,0.45)';
    ctx.fillRect(0, 0, CFG.viewW, CFG.viewH);
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 40px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', CFG.viewW / 2, CFG.viewH / 2);
  }
}
requestAnimationFrame(frame);
