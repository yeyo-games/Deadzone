// Dibujo de balas y cohetes. La lógica vive en sim/bullets.js.

export function drawBullets(ctx, list) {
  ctx.lineCap = 'round';
  let flames = false;
  for (const b of list) {
    if (b.flame) {
      flames = true;
      continue;
    }
    if (b.rocket) {
      drawRocket(ctx, b.x, b.y, Math.atan2(b.dy, b.dx) + Math.sin((b.age || 0) * 31) * 0.12, true);
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
export function drawRocket(ctx, x, y, a, flame) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  if (flame) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,170,60,0.9)';
    ctx.beginPath();
    ctx.ellipse(-13, 0, 6 + Math.random() * 4, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
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
