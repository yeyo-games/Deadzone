// Dibujo del coloso (el muro caminante; la lógica está en sim/coloso.ts): su escudo delante (un pedazo de
// edificio, una pared de ladrillo, un montón de coches o una fachada de vidrio, cada vez más roto), sus puños
// agarrándolo, la barra del escudo y, cuando lo pierde, el aura roja de la furia. El cuerpo es el del gigante
// (render/zombies.js lo dibuja más grande).
import { COLOSO } from '../core/config.ts';
import { TAU, roundRect } from '../core/util.ts';
import { OUT } from './sprites.js';

const SKIN = '#7d8a74';

/** Los colosos en pantalla: escudos, puños y furia (encima de la horda). */
export function drawColosos(ctx, list, view, time) {
  for (const z of list) {
    if (z.type !== 'coloso' || z.dead) continue;
    if (z.x < view.x0 - 200 || z.x > view.x1 + 200 || z.y < view.y0 - 200 || z.y > view.y1 + 200) continue;
    if (z.shield > 0) drawShield(ctx, z, time);
    else drawRage(ctx, z, time);
    drawBars(ctx, z);
  }
}

function drawShield(ctx, z, time) {
  const R = COLOSO.shieldR;
  const D = 34;
  const k = 1 - z.shield / (z.shieldMax || COLOSO.shield);
  ctx.save();
  ctx.translate(z.x, z.y);
  ctx.rotate(z.angle);
  ctx.translate(COLOSO.ahead, 0);
  // se tambalea un poco al caminar
  ctx.rotate(Math.sin(time * 3 + z.id) * 0.03);
  // sombra
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  roundRect(ctx, -D / 2 + 6, -R + 8, D, R * 2, 4);
  ctx.fill();
  const kind = z.shieldKind || 'building';
  if (kind === 'cars') drawCars(ctx, R, D);
  else drawSlab(ctx, R, D, kind);
  // grietas y agujeros según lo dañado
  ctx.strokeStyle = 'rgba(20,16,12,0.8)';
  ctx.lineWidth = 1.6;
  const n = Math.floor(k * 10);
  for (let i = 0; i < n; i++) {
    const y = -R + ((i * 37) % (R * 2));
    const x = -D / 2 + ((i * 13) % D);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 6, y + 8);
    ctx.lineTo(x + 2, y + 15);
    ctx.lineTo(x + 9, y + 22);
    ctx.stroke();
    if (i % 3 === 2) {
      ctx.fillStyle = 'rgba(12,10,8,0.85)';
      ctx.beginPath();
      ctx.arc(x + 4, y + 10, 3 + (i % 4), 0, TAU);
      ctx.fill();
    }
  }
  // golpe: destello
  if (z.shieldHitT > 0) {
    ctx.fillStyle = `rgba(255,240,210,${(z.shieldHitT / 0.12) * 0.5})`;
    roundRect(ctx, -D / 2, -R, D, R * 2, 4);
    ctx.fill();
  }
  // los puños que lo sostienen, uno en cada orilla
  for (const s of [-1, 1]) {
    ctx.fillStyle = SKIN;
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(-D / 2 - 4, s * (R - 6), 13, 11, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(30,36,26,0.6)';
    ctx.lineWidth = 1.2;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(-D / 2 + 2, s * (R - 6) + i * 5);
      ctx.lineTo(-D / 2 - 6, s * (R - 6) + i * 5);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// Pedazo de edificio, pared de ladrillo o fachada de vidrio (visto desde arriba, con la fachada a la vista).
function drawSlab(ctx, R, D, kind) {
  const base = kind === 'brick' ? '#9a4a36' : kind === 'glass' ? '#5a7a92' : '#b8ad98';
  ctx.fillStyle = base;
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.2;
  roundRect(ctx, -D / 2, -R, D, R * 2, 3);
  ctx.fill();
  ctx.stroke();
  if (kind === 'brick') {
    ctx.strokeStyle = 'rgba(60,24,16,0.55)';
    ctx.lineWidth = 1;
    for (let y = -R + 6; y < R; y += 6) {
      ctx.beginPath();
      ctx.moveTo(-D / 2, y);
      ctx.lineTo(D / 2, y);
      ctx.stroke();
    }
  }
  // ventanas (o paneles de vidrio)
  const rows = kind === 'glass' ? 2 : 2;
  const cols = 5;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const y = -R + 10 + c * ((R * 2 - 20) / cols);
      const x = -D / 2 + 4 + r * ((D - 8) / rows);
      const w = (D - 8) / rows - 3;
      const h = (R * 2 - 20) / cols - 5;
      ctx.fillStyle = kind === 'glass' ? 'rgba(170,215,240,0.75)' : (r + c) % 3 === 0 ? '#e0a040' : '#2a2c30';
      ctx.fillRect(x, y, w, h);
      if (kind === 'glass') {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillRect(x, y, 1.5, h);
      }
    }
  // varillas que asoman por la orilla rota
  ctx.strokeStyle = '#6a5a4a';
  ctx.lineWidth = 1.4;
  for (const y of [-R + 4, R - 4]) {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-D / 2 + 5 + i * 7, y);
      ctx.lineTo(-D / 2 + 7 + i * 7, y + (y < 0 ? -6 : 6));
      ctx.stroke();
    }
  }
}

// Montón de coches aplastados uno sobre otro.
function drawCars(ctx, R, D) {
  /** @type {[string, number][]} */
  const cars = [
    ['#c8a040', -R + 4],
    ['#5a7ab0', -R * 0.32],
    ['#b84a3a', R * 0.32],
    ['#d0d0c8', R - 4 - R * 0.62],
  ];
  for (const [col, y] of cars) {
    ctx.save();
    ctx.translate(0, y + R * 0.31);
    ctx.rotate(((y * 7) % 10) * 0.015);
    ctx.fillStyle = col;
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2;
    roundRect(ctx, -D / 2 - 2, -R * 0.31, D + 4, R * 0.62, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(150,190,210,0.8)';
    ctx.fillRect(-D / 2 + 3, -R * 0.18, D - 6, R * 0.12);
    ctx.fillRect(-D / 2 + 3, R * 0.08, D - 6, R * 0.1);
    ctx.fillStyle = '#141516';
    ctx.fillRect(-D / 2 - 4, -R * 0.24, 3, 7);
    ctx.fillRect(-D / 2 - 4, R * 0.14, 3, 7);
    ctx.restore();
  }
}

// Sin escudo: aura roja que late, vapor y los puños cerrados al frente.
function drawRage(ctx, z, time) {
  const k = 0.5 + 0.5 * Math.sin(time * 9 + z.id);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = `rgba(255,60,30,${(0.14 + 0.1 * k).toFixed(3)})`;
  ctx.beginPath();
  ctx.arc(z.x, z.y, z.r * (1.55 + 0.1 * k), 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(z.x, z.y);
  ctx.rotate(z.angle);
  for (const s of [-1, 1]) {
    const f = z.lunge > 0 ? z.lunge * 22 : 0;
    ctx.fillStyle = '#8a6a5a';
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(z.r * 0.95 + f, s * z.r * 0.55, 15, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

// Barras sobre la cabeza: el escudo (azul) encima de la vida.
function drawBars(ctx, z) {
  const w = z.r * 2.2;
  const x = z.x - w / 2;
  const y = z.y - z.r * 1.6 - 12;
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(x - 1, y - 1, w + 2, 12);
  ctx.fillStyle = '#c84a3a';
  ctx.fillRect(x, y + 6, w * Math.max(0, z.hp / z.maxHp), 4);
  if (z.shield > 0) {
    ctx.fillStyle = '#6ab0e0';
    ctx.fillRect(x, y, w * Math.max(0, z.shield / (z.shieldMax || COLOSO.shield)), 4);
  }
}
