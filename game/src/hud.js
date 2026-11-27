// The head-up display: airspeed and altitude tapes, compass strip, artificial
// horizon, throttle/fuel/damage bars, mission banner, target marker, plus the
// title and end-of-sortie screens.

function drawTape(ctx, x, y, w, h, value, step, fmt, label) {
  ctx.fillStyle = 'rgba(14,20,28,0.62)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(160,200,230,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  const midY = y + h / 2;
  const pxPerUnit = h / (step * 6);
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const first = Math.floor((value - step * 3) / step) * step;
  for (let v = first; v <= value + step * 3; v += step) {
    if (v < 0) continue;
    const ty = midY - (v - value) * pxPerUnit;
    if (ty < y + 4 || ty > y + h - 4) continue;
    ctx.strokeStyle = 'rgba(220,238,250,0.8)';
    ctx.beginPath();
    ctx.moveTo(x + w - 12, ty); ctx.lineTo(x + w, ty);
    ctx.stroke();
    ctx.fillStyle = 'rgba(220,238,250,0.85)';
    ctx.fillText(fmt(v), x + w / 2 - 5, ty + 4);
  }
  ctx.fillStyle = '#0d141c';
  ctx.fillRect(x - 2, midY - 13, w + 4, 26);
  ctx.strokeStyle = '#ffb84d';
  ctx.strokeRect(x - 2, midY - 13, w + 4, 26);
  ctx.fillStyle = '#ffd98a';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText(fmt(Math.round(value)), x + w / 2, midY + 6);
  ctx.fillStyle = 'rgba(220,238,250,0.8)';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText(label, x + w / 2, y - 8);
}

function drawCompass(ctx, heading) {
  const W = CFG.viewW;
  const x0 = W / 2 - 210, w = 420, y = 14, h = 34;
  ctx.fillStyle = 'rgba(14,20,28,0.62)';
  ctx.fillRect(x0, y, w, h);
  ctx.strokeStyle = 'rgba(160,200,230,0.5)';
  ctx.strokeRect(x0, y, w, h);
  const deg = ((heading * 180 / Math.PI) % 360 + 360) % 360;
  const pxPerDeg = w / 90;
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const names = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
  for (let d = Math.floor((deg - 45) / 5) * 5; d <= deg + 45; d += 5) {
    const dd = ((d % 360) + 360) % 360;
    const tx = W / 2 + (d - deg) * pxPerDeg;
    if (tx < x0 + 4 || tx > x0 + w - 4) continue;
    ctx.strokeStyle = 'rgba(220,238,250,0.7)';
    ctx.beginPath();
    ctx.moveTo(tx, y + h - 8); ctx.lineTo(tx, y + h);
    ctx.stroke();
    if (names[dd]) {
      ctx.fillStyle = dd === 0 ? '#ff8a7a' : '#dceefc';
      ctx.fillText(names[dd], tx, y + 17);
    }
  }
  ctx.fillStyle = '#ffb84d';
  ctx.beginPath();
  ctx.moveTo(W / 2 - 7, y + h + 2);
  ctx.lineTo(W / 2 + 7, y + h + 2);
  ctx.lineTo(W / 2, y + h + 12);
  ctx.closePath();
  ctx.fill();
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText(String(Math.round(deg)).padStart(3, '0') + '°', W / 2, y + h + 30);
}

function drawHorizonBall(ctx, plane, cx, cy, r) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-plane.roll);
  const pitchPx = plane.pitch * r * 1.6;
  ctx.fillStyle = '#4d8fd1';
  ctx.fillRect(-r * 1.6, -r * 1.6 + pitchPx, r * 3.2, r * 1.6);
  ctx.fillStyle = '#7a5c38';
  ctx.fillRect(-r * 1.6, pitchPx, r * 3.2, r * 1.6);
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 1.5;
  for (const off of [-20, -10, 10, 20]) {
    const y = pitchPx + off * r / 30;
    ctx.beginPath();
    ctx.moveTo(-r * 0.45, y); ctx.lineTo(r * 0.45, y);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = '#2c3540';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#ffb84d';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.55, cy); ctx.lineTo(cx - r * 0.16, cy);
  ctx.moveTo(cx + r * 0.16, cy); ctx.lineTo(cx + r * 0.55, cy);
  ctx.stroke();
  ctx.fillStyle = '#ffb84d';
  ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
}

function drawBar(ctx, x, y, w, h, frac, color, label) {
  ctx.fillStyle = 'rgba(14,20,28,0.62)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x + 1, y + 1, (w - 2) * clamp(frac, 0, 1), h - 2);
  ctx.strokeStyle = 'rgba(160,200,230,0.5)';
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = 'rgba(230,242,252,0.92)';
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, x + 4, y + h - 3);
}

function drawTargetMarker(ctx, cam, plane, sortie) {
  const target = currentTarget(sortie, plane);
  if (sortie.phase === 'done') return;
  const ty = terrainHeight(target.x, target.z) + target.alt;
  const p = projectPoint(cam, target.x, ty, target.z);
  const dist = Math.round(Math.hypot(plane.x - target.x, plane.z - target.z));
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  if (p && p.sx > 40 && p.sx < CFG.viewW - 40 && p.sy > 60 && p.sy < CFG.viewH - 120) {
    ctx.strokeStyle = '#ffcf3f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.sx, p.sy - 12); ctx.lineTo(p.sx + 10, p.sy); ctx.lineTo(p.sx, p.sy + 12); ctx.lineTo(p.sx - 10, p.sy);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(target.label + '  ' + dist + ' m', p.sx, p.sy - 20);
  } else {
    // Off-screen: an arrow at the edge pointing the way.
    const bearing = Math.atan2(target.x - plane.x, -(target.z - plane.z));
    const rel = wrapAngle(bearing - plane.heading);
    const ax = CFG.viewW / 2 + Math.sin(rel) * 300;
    const ay = 110;
    ctx.fillStyle = '#ffcf3f';
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(rel);
    ctx.beginPath();
    ctx.moveTo(0, -12); ctx.lineTo(8, 8); ctx.lineTo(-8, 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(target.label + '  ' + dist + ' m', ax, ay + 28);
  }
}

function drawHud(ctx, cam, plane, sortie, now) {
  const W = CFG.viewW, H = CFG.viewH;
  const kt = plane.speed * 1.944;
  const agl = Math.max(0, plane.alt - terrainHeight(plane.x, plane.z));
  const ft = agl * 3.281;

  drawTape(ctx, 22, 190, 58, 320, kt, 10, v => String(v), 'KNOTS');
  drawTape(ctx, W - 80, 190, 58, 320, ft, 100, v => String(v), 'ALT FT');
  drawCompass(ctx, plane.heading);
  drawHorizonBall(ctx, plane, 112, H - 104, 50);

  drawBar(ctx, 176, H - 148, 150, 15, plane.throttle, '#7fd08a', 'THROTTLE');
  drawBar(ctx, 176, H - 126, 150, 15, plane.fuel / CFG.fuel.capacity, plane.fuel < 20 ? '#e05a4a' : '#5aa7e0', 'FUEL ' + Math.round(plane.fuel));
  drawBar(ctx, 176, H - 104, 150, 15, plane.damage / 100, '#e08a4a', 'DAMAGE ' + Math.round(plane.damage) + '%');

  // Vertical speed readout under the altitude tape.
  ctx.fillStyle = 'rgba(230,242,252,0.92)';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const vs = Math.round(plane.vy * 3.281 * 60 / 10) * 10;
  ctx.fillText('VS ' + (vs >= 0 ? '+' : '') + vs, W - 51, 532);

  // Score, timer and mission checklist, bottom right.
  ctx.textAlign = 'right';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillStyle = '#ffe9a8';
  ctx.fillText('SCORE ' + sortie.score, W - 24, H - 118);
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(230,242,252,0.92)';
  const mm = Math.floor(sortie.timer / 60);
  const ss = String(Math.floor(sortie.timer % 60)).padStart(2, '0');
  ctx.fillText('TIME ' + mm + ':' + ss, W - 24, H - 94);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('Rings ' + sortie.ringsDone + '/' + RINGS.length + '   Mail ' + sortie.dropsDone + '/' + DROPZONES.length, W - 24, H - 72);
  ctx.fillText(sortie.phase === 'land' ? 'Objective: land at Kestrel Strip' : 'Objective: ' + currentTarget(sortie, plane).label, W - 24, H - 52);

  // Flight path marker and pitch ladder at the centre.
  ctx.strokeStyle = 'rgba(160,230,160,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(W / 2, H / 2 - plane.pitch * 160, 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(W / 2 - 26, H / 2 - plane.pitch * 160); ctx.lineTo(W / 2 - 12, H / 2 - plane.pitch * 160);
  ctx.moveTo(W / 2 + 12, H / 2 - plane.pitch * 160); ctx.lineTo(W / 2 + 26, H / 2 - plane.pitch * 160);
  ctx.stroke();

  drawTargetMarker(ctx, cam, plane, sortie);

  // Mission banner, bottom centre.
  if (now < sortie.bannerUntil && sortie.banner) {
    ctx.font = 'bold 19px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const wText = ctx.measureText(sortie.banner).width + 36;
    ctx.fillStyle = 'rgba(14,20,28,0.66)';
    ctx.fillRect(W / 2 - wText / 2, H - 64, wText, 34);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(sortie.banner, W / 2, H - 41);
  }

  // Warnings.
  ctx.textAlign = 'center';
  ctx.font = 'bold 22px system-ui, sans-serif';
  if (plane.stalled) {
    ctx.fillStyle = Math.sin(now * 8) > 0 ? '#ff6a55' : '#ffb0a0';
    ctx.fillText('STALL', W / 2, 150);
  } else if (!plane.onGround && agl < 26 && plane.vy < -3.4) {
    ctx.fillStyle = '#ff6a55';
    ctx.fillText('PULL UP', W / 2, 150);
  } else if (plane.fuel <= 0 && !plane.onGround) {
    ctx.fillStyle = '#ffb84d';
    ctx.fillText('ENGINE OUT - GLIDE HOME', W / 2, 150);
  } else if (plane.fuel < 18 && plane.fuel > 0) {
    ctx.fillStyle = '#ffb84d';
    ctx.fillText('LOW FUEL', W / 2, 150);
  }
}

function drawTitleScreen(ctx, now) {
  const W = CFG.viewW, H = CFG.viewH;
  ctx.fillStyle = 'rgba(10,16,26,0.45)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe9a8';
  ctx.font = 'bold 76px system-ui, sans-serif';
  ctx.fillText('KESTREL POST', W / 2, 170);
  ctx.fillStyle = '#dceefc';
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.fillText('Valley Air Mail', W / 2, 214);
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(220,238,252,0.92)';
  const lines = [
    'Fly the Kestrel K-2 mail plane: thread the gold rings, drop the mail',
    'on the farm targets, then bring her home to Kestrel Strip.',
    '',
    'W / S throttle      Arrows or A/D pitch and bank      Mouse steers too',
    'Space drop parcel (brake on the ground)      C camera      P pause      R restart',
    '',
    'Watch your fuel and your airspeed. Slow flight stalls, and the valley floor is hard.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, W / 2, 286 + i * 30));
  ctx.fillStyle = Math.sin(now * 3) > -0.2 ? '#ffcf3f' : '#c9a13a';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText('Press Enter or click to fly', W / 2, 560);
  ctx.fillStyle = 'rgba(220,238,252,0.7)';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('Demo flight is running behind this screen. Take over any time.', W / 2, 596);
}

function drawEndScreen(ctx, sortie, plane) {
  const W = CFG.viewW, H = CFG.viewH;
  const res = sortie.result;
  ctx.fillStyle = 'rgba(10,16,26,0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = res.kind === 'crashed' ? '#ff8a7a' : '#ffe9a8';
  ctx.font = 'bold 54px system-ui, sans-serif';
  ctx.fillText(res.kind === 'crashed' ? 'SORTIE LOST' : 'SORTIE COMPLETE', W / 2, 190);
  ctx.fillStyle = '#dceefc';
  ctx.font = '22px system-ui, sans-serif';
  ctx.fillText(res.label, W / 2, 234);
  ctx.font = '19px system-ui, sans-serif';
  const mm = Math.floor(res.time / 60);
  const ss = String(Math.floor(res.time % 60)).padStart(2, '0');
  const rows = [
    'Rings flown: ' + sortie.ringsDone + ' of ' + RINGS.length,
    'Mail delivered: ' + sortie.dropsDone + ' of ' + DROPZONES.length,
    'Flight time: ' + mm + ':' + ss + '   Time bonus: +' + res.timeBonus,
    'Fuel used: ' + res.fuelUsed + '   Damage: ' + Math.round(plane.damage) + '%',
    'Final score: ' + sortie.score,
  ];
  rows.forEach((row, i) => ctx.fillText(row, W / 2, 300 + i * 34));
  ctx.fillStyle = '#ffcf3f';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText('Grade ' + res.grade, W / 2, 520);
  ctx.fillStyle = '#dceefc';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText('Press R to fly again', W / 2, 580);
}
