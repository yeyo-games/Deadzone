// Dibujo de balas y cohetes. La lógica vive en sim/bullets.js.

export function drawBullets(ctx, list) {
  ctx.lineCap = 'round';
  let flames = false;
  for (const b of list) {
    if (b.flame) {
      flames = true;
      continue;
    }
    if (b.rocket && b.wid === 'glauncher') {
      drawShell(ctx, b);
      continue;
    }
    if (b.wid === 'crossbow') {
      drawBolt(ctx, b);
      continue;
    }
    if (b.wid === 'railgun' || b.wid === 'sniper') {
      drawBeam(ctx, b, b.wid === 'railgun');
      continue;
    }
    if (b.rocket) {
      // el de la bazuca mejorada es más grande
      const big = (b.rocketK || 1) > 1 ? 1.5 : 1;
      drawRocket(ctx, b.x, b.y, Math.atan2(b.dy, b.dx) + Math.sin((b.age || 0) * 31) * 0.12, true, b.improv, big);
      continue;
    }
    if (b.improv) {
      drawRocket(ctx, b.x, b.y, Math.atan2(b.dy, b.dx), true, true);
      continue;
    }
    if (b.atgm) {
      drawAtgm(ctx, b);
      continue;
    }
    const len = b.trail;
    ctx.strokeStyle = 'rgba(255,214,150,0.25)';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(b.x - b.dx * len, b.y - b.dy * len);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,205,0.9)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(b.x - b.dx * len * 0.5, b.y - b.dy * len * 0.5);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  if (flames) drawFlames(ctx, list);
}

// Granada del lanzagranadas: casco verde que gira, con su banda y un hilo de humo.
function drawShell(ctx, b) {
  const a = Math.atan2(b.dy, b.dx);
  ctx.strokeStyle = 'rgba(190,185,170,0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(b.x - b.dx * 26, b.y - b.dy * 26);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(a + (b.age || 0) * 20);
  ctx.fillStyle = '#4a5a34';
  ctx.beginPath();
  ctx.ellipse(0, 0, 5.5, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c9a54a';
  ctx.fillRect(-1, -4, 2, 8);
  ctx.restore();
}

// Virote de la ballesta: asta de madera, punta de metal y plumas.
function drawBolt(ctx, b) {
  const a = Math.atan2(b.dy, b.dx);
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(a);
  ctx.strokeStyle = 'rgba(255,240,205,0.18)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-34, 0);
  ctx.lineTo(-14, 0);
  ctx.stroke();
  ctx.fillStyle = '#8a6a44';
  ctx.fillRect(-14, -0.9, 16, 1.8);
  ctx.fillStyle = '#d0d4d8';
  ctx.beginPath();
  ctx.moveTo(2, -2.2);
  ctx.lineTo(6, 0);
  ctx.lineTo(2, 2.2);
  ctx.fill();
  ctx.fillStyle = '#c8402c';
  ctx.beginPath();
  ctx.moveTo(-14, 0);
  ctx.lineTo(-18, -3);
  ctx.lineTo(-11, 0);
  ctx.lineTo(-18, 3);
  ctx.fill();
  ctx.restore();
}

// Francotirador y cañón de riel: trazadora larga (el de riel, un rayo azul con halo).
function drawBeam(ctx, b, rail) {
  const len = (b.trail || 20) * (rail ? 4 : 2.4);
  const x0 = b.x - b.dx * len;
  const y0 = b.y - b.dy * len;
  ctx.strokeStyle = rail ? 'rgba(80,190,255,0.28)' : 'rgba(255,230,190,0.22)';
  ctx.lineWidth = rail ? 8 : 4;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.strokeStyle = rail ? 'rgba(200,240,255,0.95)' : 'rgba(255,248,225,0.95)';
  ctx.lineWidth = rail ? 2.6 : 1.6;
  ctx.beginPath();
  ctx.moveTo(b.x - b.dx * len * 0.6, b.y - b.dy * len * 0.6);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

// Llamaradas del lanzallamas: salen pequeñas y blancas de la boquilla, crecen, se vuelven naranjas y
// rojas, ondulan y acaban en humo oscuro.
function drawFlames(ctx, list) {
  ctx.save();
  for (const b of list) {
    if (!b.flame) continue;
    const k = 1 - b.life / (b.life0 || 1);
    if (k < 0.5) continue;
    const r = 6 + k * 18;
    ctx.fillStyle = `rgba(38,32,28,${((k - 0.5) * 0.5).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(b.x - b.dy * Math.sin(b.seed) * 6, b.y + b.dx * Math.sin(b.seed) * 6 - k * 8, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'lighter';
  for (const b of list) {
    if (!b.flame) continue;
    const k = 1 - b.life / (b.life0 || 1);
    const w = Math.sin(b.seed + k * 9) * k * 7;
    const r0 = 6 + k * 17 + Math.random() * 2;
    const gc = Math.round(210 - k * 150);
    const bc = Math.round(Math.max(0, 90 - k * 180));
    // tres lenguas por llamarada, hacia la boquilla, para que el chorro se vea seguido
    for (let j = 0; j < 3; j++) {
      const off = j * 11 * (0.5 + k);
      const x = b.x - b.dx * off - b.dy * w;
      const y = b.y - b.dy * off + b.dx * w;
      const r = r0 * (1 - j * 0.22);
      ctx.fillStyle = `rgba(255,110,25,${(0.16 * (1 - k)).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, r * 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,${gc},${bc},${(0.5 * (1 - k * 0.75)).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      if (k < 0.4) {
        ctx.fillStyle = `rgba(255,248,215,${(0.55 * (1 - k / 0.4)).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, r * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

// Misil antitanque de la torreta militar: el recorrido brilla detrás de él y se apaga hacia la torre.
const TRAIL = 340;
function drawAtgm(ctx, b) {
  const a = Math.atan2(b.dy, b.dx);
  const run = Math.min(TRAIL, Math.hypot(b.x - b.sx, b.y - b.sy));
  const tx = b.x - b.dx * run;
  const ty = b.y - b.dy * run;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const [w, al] of [
    [11, 0.16],
    [5, 0.4],
    [2, 0.95],
  ]) {
    const gr = ctx.createLinearGradient(tx, ty, b.x, b.y);
    gr.addColorStop(0, 'rgba(255,150,60,0)');
    gr.addColorStop(0.7, `rgba(255,190,100,${al * 0.6})`);
    gr.addColorStop(1, `rgba(255,236,190,${al})`);
    ctx.strokeStyle = gr;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(b.x - b.dx * 12, b.y - b.dy * 12);
    ctx.stroke();
  }
  // resplandor de la tobera
  const gl = ctx.createRadialGradient(b.x - b.dx * 14, b.y - b.dy * 14, 0, b.x - b.dx * 14, b.y - b.dy * 14, 22);
  gl.addColorStop(0, 'rgba(255,230,170,0.9)');
  gl.addColorStop(1, 'rgba(255,140,50,0)');
  ctx.fillStyle = gl;
  ctx.beginPath();
  ctx.arc(b.x - b.dx * 14, b.y - b.dy * 14, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(a);
  ctx.scale(1.25, 1.25);
  ctx.strokeStyle = '#141612';
  ctx.lineWidth = 0.9;
  // cuerpo largo y aletas en cruz
  ctx.fillStyle = '#5a6248';
  ctx.fillRect(-11, -2.4, 16, 4.8);
  ctx.strokeRect(-11, -2.4, 16, 4.8);
  ctx.fillStyle = '#c9c2a8';
  ctx.beginPath();
  ctx.moveTo(5, -2.4);
  ctx.lineTo(11, 0);
  ctx.lineTo(5, 2.4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#3a4030';
  ctx.beginPath();
  ctx.moveTo(-11, -2.4);
  ctx.lineTo(-14, -6);
  ctx.lineTo(-8, -2.4);
  ctx.moveTo(-11, 2.4);
  ctx.lineTo(-14, 6);
  ctx.lineTo(-8, 2.4);
  ctx.fill();
  ctx.fillStyle = '#c94a32';
  ctx.fillRect(1, -2.4, 1.6, 4.8);
  ctx.restore();
}

// Cohete de la bazuca (también se dibuja clavado en un zombi). flame = tobera encendida.
// improv: el misil improvisado, un tubo oxidado con cinta y la punta pintada a mano.
export function drawRocket(ctx, x, y, a, flame, improv = false, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  if (scale !== 1) ctx.scale(scale, scale);
  if (flame) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,170,60,0.9)';
    ctx.beginPath();
    ctx.ellipse(-13, 0, 6 + Math.random() * 4, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  if (improv) {
    drawImprov(ctx);
    ctx.restore();
    return;
  }
  ctx.fillStyle = '#4a5636';
  ctx.strokeStyle = '#141612';
  ctx.lineWidth = 1;
  ctx.fillRect(-9, -2.6, 13, 5.2);
  ctx.strokeRect(-9, -2.6, 13, 5.2);
  ctx.fillStyle = '#6d6f68';
  ctx.beginPath();
  ctx.moveTo(4, -3.4);
  ctx.lineTo(11, 0);
  ctx.lineTo(4, 3.4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#2a3220';
  ctx.beginPath();
  ctx.moveTo(-9, -2.6);
  ctx.lineTo(-12, -5);
  ctx.lineTo(-7, -2.6);
  ctx.moveTo(-9, 2.6);
  ctx.lineTo(-12, 5);
  ctx.lineTo(-7, 2.6);
  ctx.fill();
  ctx.restore();
}

function drawImprov(ctx) {
  ctx.strokeStyle = '#141612';
  ctx.lineWidth = 1;
  // tubo oxidado
  ctx.fillStyle = '#8a5a34';
  ctx.fillRect(-10, -2.8, 15, 5.6);
  ctx.strokeRect(-10, -2.8, 15, 5.6);
  // cinta gris
  ctx.fillStyle = '#c9c4b4';
  ctx.fillRect(-6, -3.1, 2.6, 6.2);
  ctx.fillRect(0, -3.1, 2.6, 6.2);
  // punta roja chueca
  ctx.fillStyle = '#b8402c';
  ctx.beginPath();
  ctx.moveTo(5, -3);
  ctx.lineTo(10.5, 0.6);
  ctx.lineTo(5, 3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // aletas de lata
  ctx.fillStyle = '#9aa1a8';
  ctx.beginPath();
  ctx.moveTo(-10, -2.8);
  ctx.lineTo(-13, -6);
  ctx.lineTo(-7, -2.8);
  ctx.moveTo(-10, 2.8);
  ctx.lineTo(-12, 5.5);
  ctx.lineTo(-7, 2.8);
  ctx.fill();
}
