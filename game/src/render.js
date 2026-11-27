// Rendering: a per-pixel ground pass (sky, fields, river, runway, mountains)
// drawn at half resolution and scaled up, then billboards for scenery and
// rings, the aircraft in chase view, or the cockpit frame. No images are
// loaded; everything is drawn from the world data.

let groundCanvas = null;
let groundCtx = null;
let groundImage = null;

function buildCamera(plane, camState, mode, dt) {
  // The camera follows with a little lag so it never fights the pilot.
  const follow = mode === 'cockpit' ? 1 : Math.min(1, dt * 5);
  camState.heading += wrapAngle(plane.heading - camState.heading) * follow;
  camState.pitch += (plane.pitch - camState.pitch) * follow;
  camState.roll += (plane.roll - camState.roll) * follow;

  const h = camState.heading;
  const p = mode === 'cockpit' ? camState.pitch : camState.pitch * 0.55 - 0.045;
  const r = mode === 'cockpit' ? camState.roll : camState.roll * 0.55;

  const fwdYaw = [Math.sin(h), 0, -Math.cos(h)];
  const rightYaw = [Math.cos(h), 0, Math.sin(h)];
  const F = [fwdYaw[0] * Math.cos(p), Math.sin(p), fwdYaw[2] * Math.cos(p)];
  const upPitch = [-fwdYaw[0] * Math.sin(p), Math.cos(p), -fwdYaw[2] * Math.sin(p)];
  const R = [
    rightYaw[0] * Math.cos(r) - upPitch[0] * Math.sin(r),
    -upPitch[1] * Math.sin(r),
    rightYaw[2] * Math.cos(r) - upPitch[2] * Math.sin(r),
  ];
  const U = [
    upPitch[0] * Math.cos(r) + rightYaw[0] * Math.sin(r),
    upPitch[1] * Math.cos(r),
    upPitch[2] * Math.cos(r) + rightYaw[2] * Math.sin(r),
  ];

  let cam;
  if (mode === 'cockpit') {
    cam = { x: plane.x, y: plane.alt + 1.3, z: plane.z, F, R, U };
  } else {
    const back = 17, up = 5.2;
    cam = {
      x: plane.x - fwdYaw[0] * back,
      y: plane.alt + up,
      z: plane.z - fwdYaw[2] * back,
      F, R, U,
    };
  }
  return cam;
}

function projectPoint(cam, x, y, z) {
  const rx = x - cam.x, ry = y - cam.y, rz = z - cam.z;
  const d = rx * cam.F[0] + ry * cam.F[1] + rz * cam.F[2];
  if (d < 2.5) return null;
  const sx = CFG.viewW / 2 + (rx * cam.R[0] + ry * cam.R[1] + rz * cam.R[2]) / d * CFG.focalView;
  const sy = CFG.viewH / 2 - (rx * cam.U[0] + ry * cam.U[1] + rz * cam.U[2]) / d * CFG.focalView;
  return { sx, sy, d, s: CFG.focalView / d };
}

function renderGroundPass(cam) {
  if (!groundCanvas) {
    groundCanvas = document.createElement('canvas');
    groundCanvas.width = CFG.groundW;
    groundCanvas.height = CFG.groundH;
    groundCtx = groundCanvas.getContext('2d');
    groundImage = groundCtx.createImageData(CFG.groundW, CFG.groundH);
  }
  const data = groundImage.data;
  const W = CFG.groundW, H = CFG.groundH, focal = CFG.focalGround;
  const zen = CFG.skyZenith, hor = CFG.skyHorizon, fog = CFG.fogColor, sun = CFG.sunDir;
  let idx = 0;
  for (let py = 0; py < H; py++) {
    const ny = (H / 2 - py) / focal;
    const baseX = cam.F[0] + cam.U[0] * ny;
    const baseY = cam.F[1] + cam.U[1] * ny;
    const baseZ = cam.F[2] + cam.U[2] * ny;
    for (let px = 0; px < W; px++) {
      const nx = (px - W / 2) / focal;
      const dx = baseX + cam.R[0] * nx;
      const dy = baseY + cam.R[1] * nx;
      const dz = baseZ + cam.R[2] * nx;
      let r, g, b;
      if (dy < -0.0008) {
        let t = -cam.y / dy;
        if (t > 6000) {
          r = fog[0]; g = fog[1]; b = fog[2];
          data[idx++] = r; data[idx++] = g; data[idx++] = b; data[idx++] = 255;
          continue;
        }
        let hx = cam.x + dx * t;
        let hz = cam.z + dz * t;
        let hgt = terrainHeight(hx, hz);
        if (hgt > 0.4) {
          // Rising ground: march the ray in steps to the first crossing so
          // mountains taller than the camera render as a proper ridge.
          let prevT = 0;
          for (let k = 1; k <= 5; k++) {
            const tk = t * k / 5;
            const yk = cam.y + dy * tk;
            const xk = cam.x + dx * tk;
            const zk = cam.z + dz * tk;
            const hk = terrainHeight(xk, zk);
            if (yk <= hk) {
              t = prevT + (tk - prevT) * 0.5;
              hx = cam.x + dx * t;
              hz = cam.z + dz * t;
              hgt = terrainHeight(hx, hz);
              break;
            }
            prevT = tk;
            hx = xk; hz = zk; hgt = hk;
          }
        }
        const c = groundColor(hx, hz, hgt);
        const shade = 0.84 + clamp(hgt / 240, 0, 0.3);
        const f = 1 - Math.exp(-t / 3000);
        r = lerp(c[0] * shade, fog[0], f);
        g = lerp(c[1] * shade, fog[1], f);
        b = lerp(c[2] * shade, fog[2], f);
      } else {
        const mix = smoothstep(-0.02, 0.55, ny);
        r = lerp(hor[0], zen[0], mix);
        g = lerp(hor[1], zen[1], mix);
        b = lerp(hor[2], zen[2], mix);
        const invLen = 1 / Math.hypot(dx, dy, dz);
        const s = (dx * sun[0] + dy * sun[1] + dz * sun[2]) * invLen;
        if (s > 0.92) {
          const glow = (s - 0.92) * 4.5;
          r += 64 * glow; g += 52 * glow; b += 26 * glow;
        }
        if (s > 0.9993) { r = 255; g = 246; b = 214; }
      }
      data[idx++] = r; data[idx++] = g; data[idx++] = b; data[idx++] = 255;
    }
  }
  groundCtx.putImageData(groundImage, 0, 0);
}

function drawTree(ctx, sx, sy, s, kind) {
  ctx.fillStyle = '#6b4a2f';
  ctx.fillRect(sx - 0.16 * s, sy - 1.3 * s, 0.32 * s, 1.3 * s);
  if (kind === 'pine') {
    ctx.fillStyle = '#2e5d33';
    for (let i = 0; i < 3; i++) {
      const w = (2.5 - i * 0.55) * s;
      const yBase = sy - (1.1 + i * 1.5) * s;
      ctx.beginPath();
      ctx.moveTo(sx - w, yBase);
      ctx.lineTo(sx + w, yBase);
      ctx.lineTo(sx, yBase - 2.1 * s);
      ctx.closePath();
      ctx.fill();
    }
  } else {
    ctx.fillStyle = '#4a7d3a';
    ctx.beginPath();
    ctx.arc(sx, sy - 3.4 * s, 2.2 * s, 0, Math.PI * 2);
    ctx.arc(sx - 1.4 * s, sy - 2.4 * s, 1.5 * s, 0, Math.PI * 2);
    ctx.arc(sx + 1.4 * s, sy - 2.5 * s, 1.6 * s, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBarn(ctx, sx, sy, s) {
  const w = 11 * s, h = 4.6 * s;
  ctx.fillStyle = '#9c4a38';
  ctx.fillRect(sx - w / 2, sy - h, w, h);
  ctx.fillStyle = '#5d4632';
  ctx.beginPath();
  ctx.moveTo(sx - w / 2 - 0.7 * s, sy - h);
  ctx.lineTo(sx + w / 2 + 0.7 * s, sy - h);
  ctx.lineTo(sx, sy - h - 2.6 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e8e2d4';
  ctx.fillRect(sx - 1.1 * s, sy - 2.9 * s, 2.2 * s, 2.9 * s);
}

function drawTower(ctx, sx, sy, s) {
  ctx.strokeStyle = '#7a828c';
  ctx.lineWidth = Math.max(1, 0.22 * s);
  ctx.beginPath();
  ctx.moveTo(sx - 2.2 * s, sy); ctx.lineTo(sx - 1.1 * s, sy - 11 * s);
  ctx.moveTo(sx + 2.2 * s, sy); ctx.lineTo(sx + 1.1 * s, sy - 11 * s);
  ctx.moveTo(sx - 1.7 * s, sy - 5.5 * s); ctx.lineTo(sx + 1.7 * s, sy - 5.5 * s);
  ctx.stroke();
  ctx.fillStyle = '#b9c2cc';
  ctx.fillRect(sx - 2.6 * s, sy - 15.5 * s, 5.2 * s, 4.5 * s);
  ctx.beginPath();
  ctx.ellipse(sx, sy - 15.5 * s, 2.6 * s, 0.9 * s, 0, Math.PI, 0);
  ctx.fill();
}

function drawScenery(ctx, cam) {
  const drawn = [];
  for (const item of SCENERY) {
    const gy = terrainHeight(item.x, item.z);
    const p = projectPoint(cam, item.x, gy, item.z);
    if (!p || p.d > 2600 || p.sx < -160 || p.sx > CFG.viewW + 160) continue;
    drawn.push({ item, p });
  }
  drawn.sort((a, b) => b.p.d - a.p.d);
  for (const { item, p } of drawn) {
    const s = p.s * item.s;
    if (item.kind === 'barn') drawBarn(ctx, p.sx, p.sy, s);
    else if (item.kind === 'tower') drawTower(ctx, p.sx, p.sy, s);
    else drawTree(ctx, p.sx, p.sy, s, item.kind);
  }
}

function drawClouds(ctx, cam, now) {
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const cloud of CLOUDS) {
    const drift = (now * 2.2) % 3400;
    let cx = cloud.x + drift;
    if (cx > 1700) cx -= 3400;
    const p = projectPoint(cam, cx, cloud.y, cloud.z);
    if (!p || p.d > 4200) continue;
    const w = cloud.s * p.s;
    ctx.beginPath();
    ctx.ellipse(p.sx, p.sy, w, w * 0.24, 0, 0, Math.PI * 2);
    ctx.ellipse(p.sx - w * 0.5, p.sy + w * 0.06, w * 0.55, w * 0.18, 0, 0, Math.PI * 2);
    ctx.ellipse(p.sx + w * 0.5, p.sy + w * 0.05, w * 0.6, w * 0.19, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRings(ctx, cam, sortie, now) {
  const sorted = RINGS.map((ring, i) => ({ ring, i })).reverse();
  for (const { ring, i } of sorted) {
    const cy = terrainHeight(ring.x, ring.z) + ring.alt;
    const p = projectPoint(cam, ring.x, cy, ring.z);
    if (!p) continue;
    const radius = ring.r * p.s;
    const isNext = sortie.phase === 'rings' && i === sortie.ringIndex;
    const done = i < sortie.ringIndex || sortie.phase === 'drops' || sortie.phase === 'land' || sortie.phase === 'done';
    if (isNext) {
      const ground = projectPoint(cam, ring.x, terrainHeight(ring.x, ring.z), ring.z);
      if (ground) {
        ctx.strokeStyle = 'rgba(255,207,63,0.20)';
        ctx.lineWidth = Math.max(2, radius * 0.14);
        ctx.beginPath();
        ctx.moveTo(ground.sx, ground.sy);
        ctx.lineTo(p.sx, p.sy);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = isNext ? 'rgba(255,207,63,' + (0.82 + 0.18 * Math.sin(now * 4)) + ')'
      : done ? 'rgba(96,200,120,0.5)' : 'rgba(190,208,228,0.5)';
    ctx.lineWidth = clamp(radius * 0.07, 2, 13);
    ctx.beginPath();
    ctx.arc(p.sx, p.sy, radius, 0, Math.PI * 2);
    ctx.stroke();
    if (radius > 30) {
      ctx.fillStyle = isNext ? 'rgba(255,230,150,0.95)' : 'rgba(220,232,244,0.7)';
      ctx.font = 'bold ' + Math.round(clamp(radius * 0.5, 14, 44)) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), p.sx, p.sy);
    }
  }
}

function drawParcels(ctx, cam, sortie) {
  for (const parcel of sortie.parcels) {
    const p = projectPoint(cam, parcel.x, parcel.alt, parcel.z);
    if (!p) continue;
    const s = Math.max(1.4, p.s);
    ctx.fillStyle = '#8a6a42';
    ctx.fillRect(p.sx - 0.6 * s, p.sy - 0.5 * s, 1.2 * s, 1 * s);
    if (!parcel.landed) {
      ctx.fillStyle = 'rgba(240,240,235,0.9)';
      ctx.beginPath();
      ctx.ellipse(p.sx, p.sy - 1.3 * s, 1.1 * s, 0.45 * s, 0, Math.PI, 0);
      ctx.fill();
    }
  }
}

function drawPlaneShadow(ctx, cam, plane) {
  const gy = terrainHeight(plane.x, plane.z) + 0.3;
  const p = projectPoint(cam, plane.x, gy, plane.z);
  if (!p) return;
  const heightAbove = plane.alt - gy;
  const alpha = clamp(0.45 - heightAbove / 260, 0, 0.45);
  if (alpha <= 0.01) return;
  ctx.fillStyle = 'rgba(20,26,18,' + alpha + ')';
  ctx.beginPath();
  ctx.ellipse(p.sx, p.sy, 6.5 * p.s, 2.2 * p.s, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawAircraft(ctx, plane, now) {
  const cx = CFG.viewW / 2;
  const cy = CFG.viewH * 0.66 - plane.pitch * 60 + Math.sin(now * 31) * 0.7;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(plane.roll * 0.82);
  const cream = '#f3ead8';
  const red = '#c23b2e';
  const outline = 'rgba(46,40,32,0.6)';

  // Wings, swept slightly back, red tips.
  ctx.fillStyle = cream;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-16, -34); ctx.lineTo(-198, -4); ctx.lineTo(-202, 12); ctx.lineTo(-18, 20);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(16, -34); ctx.lineTo(198, -4); ctx.lineTo(202, 12); ctx.lineTo(18, 20);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = red;
  ctx.beginPath();
  ctx.moveTo(-198, -4); ctx.lineTo(-168, -10); ctx.lineTo(-166, 12); ctx.lineTo(-202, 12);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(198, -4); ctx.lineTo(168, -10); ctx.lineTo(166, 12); ctx.lineTo(202, 12);
  ctx.closePath(); ctx.fill();

  // Fuselage from nose (top) to tail (bottom).
  ctx.fillStyle = cream;
  ctx.beginPath();
  ctx.moveTo(0, -124);
  ctx.bezierCurveTo(24, -104, 28, -60, 24, -10);
  ctx.bezierCurveTo(20, 40, 14, 80, 9, 112);
  ctx.lineTo(-9, 112);
  ctx.bezierCurveTo(-14, 80, -20, 40, -24, -10);
  ctx.bezierCurveTo(-28, -60, -24, -104, 0, -124);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = red;
  ctx.fillRect(-25, -16, 50, 7);

  // Canopy.
  ctx.fillStyle = '#22303c';
  ctx.beginPath();
  ctx.ellipse(0, -58, 16, 30, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(190,220,240,0.5)';
  ctx.beginPath();
  ctx.ellipse(-5, -66, 6, 16, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // Tailplane and fin.
  ctx.fillStyle = cream;
  ctx.beginPath();
  ctx.moveTo(-66, 96); ctx.lineTo(66, 96); ctx.lineTo(54, 112); ctx.lineTo(-54, 112);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = red;
  ctx.beginPath();
  ctx.moveTo(0, 74); ctx.lineTo(-10, 114); ctx.lineTo(10, 114);
  ctx.closePath(); ctx.fill();

  // Propeller blur at the nose.
  const spin = now * (6 + plane.throttle * 40);
  ctx.fillStyle = 'rgba(28,28,32,0.30)';
  ctx.beginPath();
  ctx.ellipse(0, -122, 54, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(28,28,32,0.5)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(Math.cos(spin) * -50, -122 + Math.sin(spin) * 4);
  ctx.lineTo(Math.cos(spin) * 50, -122 - Math.sin(spin) * 4);
  ctx.stroke();
  ctx.restore();
}

function drawGauge(ctx, x, y, r, label, valueText, frac) {
  ctx.fillStyle = '#14181d';
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#3d4652'; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = '#ffb84d';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI * 0.75 + i * (Math.PI * 1.5 / 10);
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * (r - 7), y + Math.sin(a) * (r - 7));
    ctx.lineTo(x + Math.cos(a) * (r - 2), y + Math.sin(a) * (r - 2));
    ctx.stroke();
  }
  const na = Math.PI * 0.75 + clamp(frac, 0, 1) * Math.PI * 1.5;
  ctx.strokeStyle = '#ffd98a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(na) * (r - 8), y + Math.sin(na) * (r - 8));
  ctx.stroke();
  ctx.fillStyle = '#ffd98a';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(valueText, x, y + r * 0.55);
  ctx.fillStyle = '#9fb4c4';
  ctx.font = '10px system-ui, sans-serif';
  ctx.fillText(label, x, y + r * 0.85);
}

function drawCockpit(ctx, plane, now) {
  const W = CFG.viewW, H = CFG.viewH;
  // Windshield posts and top bar.
  ctx.strokeStyle = '#272d35';
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.moveTo(60, H); ctx.lineTo(300, 60);
  ctx.moveTo(W - 60, H); ctx.lineTo(W - 300, 60);
  ctx.moveTo(280, 52); ctx.lineTo(W - 280, 52);
  ctx.stroke();
  // Nose cowl and prop arc.
  ctx.fillStyle = '#e9dfc9';
  ctx.beginPath();
  ctx.ellipse(W / 2, H + 40, 190, 150, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#c23b2e';
  ctx.fillRect(W / 2 - 190, H - 96, 380, 10);
  ctx.strokeStyle = 'rgba(30,30,34,0.18)';
  ctx.lineWidth = 26;
  ctx.beginPath();
  ctx.ellipse(W / 2, H - 108, 330, 70, 0, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
  // Glareshield with lit gauges.
  ctx.fillStyle = '#1d2229';
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(0, H - 92);
  ctx.quadraticCurveTo(W / 2, H - 150, W, H - 92);
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();
  const kt = Math.round(plane.speed * 1.944);
  const ft = Math.round(Math.max(0, plane.alt - terrainHeight(plane.x, plane.z)) * 3.281);
  drawGauge(ctx, W / 2 - 220, H - 62, 36, 'KNOTS', String(kt), plane.speed / 70);
  drawGauge(ctx, W / 2, H - 74, 40, 'ALT FT', String(ft), (plane.alt % 1000) / 1000);
  drawGauge(ctx, W / 2 + 220, H - 62, 36, 'FUEL', String(Math.round(plane.fuel)), plane.fuel / 100);
}

function renderWorld(ctx, cam, plane, sortie, now, viewMode) {
  renderGroundPass(cam);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(groundCanvas, 0, 0, CFG.viewW, CFG.viewH);
  drawClouds(ctx, cam, now);
  drawScenery(ctx, cam);
  drawRings(ctx, cam, sortie, now);
  drawParcels(ctx, cam, sortie);
  drawPlaneShadow(ctx, cam, plane);
  if (viewMode === 'cockpit') drawCockpit(ctx, plane, now);
  else drawAircraft(ctx, plane, now);
}
