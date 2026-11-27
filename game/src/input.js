// Keyboard and mouse controls. Arrow keys or WASD fly, W/S and Shift/Ctrl work
// the throttle, Space drops a parcel (and brakes on the ground), C swaps the
// camera, P pauses, R restarts. Moving the mouse also steers: the plane banks
// and pitches toward the pointer while it is active.

const Input = {
  keys: {},
  mouseX: 0,
  mouseY: 0,
  mouseActiveUntil: 0,
  dropQueued: false,
  cameraQueued: false,
  pauseQueued: false,
  restartQueued: false,
  startQueued: false,

  attach(canvas) {
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      Input.keys[e.code] = true;
      if (e.code === 'Space') Input.dropQueued = true;
      if (e.code === 'KeyC') Input.cameraQueued = true;
      if (e.code === 'KeyP') Input.pauseQueued = true;
      if (e.code === 'KeyR') Input.restartQueued = true;
      if (e.code === 'Enter') Input.startQueued = true;
    });
    window.addEventListener('keyup', (e) => { Input.keys[e.code] = false; });
    window.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      Input.mouseX = (e.clientX - rect.left) / rect.width * CFG.viewW;
      Input.mouseY = (e.clientY - rect.top) / rect.height * CFG.viewH;
      Input.mouseActiveUntil = performance.now() + 2500;
    });
    canvas.addEventListener('mousedown', () => { Input.startQueued = true; });
  },

  read() {
    const k = Input.keys;
    let pitchIn = 0, rollIn = 0, throttleDelta = 0;
    if (k.ArrowUp) pitchIn += 1;
    if (k.ArrowDown) pitchIn -= 1;
    if (k.ArrowLeft || k.KeyA) rollIn -= 1;
    if (k.ArrowRight || k.KeyD) rollIn += 1;
    if (k.KeyW || k.ShiftLeft || k.ShiftRight) throttleDelta += 1;
    if (k.KeyS || k.ControlLeft || k.ControlRight) throttleDelta -= 1;
    if (performance.now() < Input.mouseActiveUntil && pitchIn === 0 && rollIn === 0) {
      pitchIn = clamp((CFG.viewH / 2 - Input.mouseY) / 190, -1, 1);
      rollIn = clamp((Input.mouseX - CFG.viewW / 2) / 240, -1, 1);
    }
    const ctl = {
      pitchIn,
      rollIn,
      throttleDelta,
      brake: !!k.Space,
      drop: Input.dropQueued,
    };
    Input.dropQueued = false;
    return ctl;
  },
};
