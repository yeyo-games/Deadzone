// Dibujo del modo Huida (la lógica está en sim/escape.ts): la camioneta, los bidones en el suelo, lo que
// se ve encima de la oscuridad (haces de luz de los bidones, la vida de la camioneta, el indicador de la
// carga) y las flechas en la orilla de la pantalla. También las luces que pone en la capa de oscuridad.
import { TAU, roundRect } from '../core/util.ts';
import { OUT } from './sprites.js';

/* ---------- la camioneta ---------- */

// Camioneta todoterreno vista desde arriba, con el frente hacia +x: defensa de tubos, cofre, parabrisas,
// techo con parrilla (llanta de refacción, bidones y una lona amarrada), faros y calaveras. Con la vida
// baja se ve abollada y con grietas; al recibir un golpe destella.
function drawVanBody(ctx, van, time, phase) {
  const L = van.w;
  const W = van.h;
  const hp = van.max ? Math.max(0, van.hp / van.max) : 1;
  // motor encendido: tiembla un poco
  const idle = phase === 'ready' || phase === 'leaving' ? Math.sin(time * 70) * 0.6 : 0;
  ctx.save();
  ctx.translate(van.x + L / 2, van.y + W / 2 + idle);
  // sombra
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, -L / 2 + 5, -W / 2 + 7, L, W, 10);
  ctx.fill();
  // llantas (asoman por los lados)
  ctx.fillStyle = '#121315';
  for (const wx of [-L * 0.3, L * 0.27])
    for (const s of [-1, 1]) {
      roundRect(ctx, wx - 10, s * (W / 2) - 6 + (s > 0 ? 0 : 0), 20, 12, 3);
      ctx.fill();
    }
  // carrocería
  ctx.lineWidth = 2;
  ctx.strokeStyle = OUT;
  const body = '#3d6a70';
  const dark = '#2a4a4f';
  ctx.fillStyle = body;
  roundRect(ctx, -L / 2, -W / 2, L, W, 9);
  ctx.fill();
  ctx.stroke();
  // óxido en las orillas
  ctx.fillStyle = 'rgba(140,72,34,0.55)';
  for (const [rx, ry, rr] of [
    [-L * 0.42, -W * 0.38, 6],
    [-L * 0.1, W * 0.4, 5],
    [L * 0.3, -W * 0.42, 4],
    [-L * 0.46, W * 0.2, 4],
  ]) {
    ctx.beginPath();
    ctx.ellipse(rx, ry, rr, rr * 0.6, 0.4, 0, TAU);
    ctx.fill();
  }
  // cofre (adelante) un tono más oscuro con su línea al centro
  ctx.fillStyle = dark;
  roundRect(ctx, L * 0.2, -W / 2 + 4, L * 0.28, W - 8, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(10,14,14,0.6)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(L * 0.22, 0);
  ctx.lineTo(L * 0.46, 0);
  ctx.stroke();
  // parabrisas con reflejo
  ctx.fillStyle = '#7fa3b4';
  ctx.beginPath();
  ctx.moveTo(L * 0.2, -W / 2 + 6);
  ctx.lineTo(L * 0.1, -W / 2 + 9);
  ctx.lineTo(L * 0.1, W / 2 - 9);
  ctx.lineTo(L * 0.2, W / 2 - 6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(230,245,255,0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(L * 0.17, -W / 2 + 10);
  ctx.lineTo(L * 0.13, -W * 0.05);
  ctx.stroke();
  // techo: un panel más claro, con la parrilla atrás
  ctx.fillStyle = '#4a7a80';
  roundRect(ctx, -L * 0.46, -W / 2 + 5, L * 0.55, W - 10, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(16,22,22,0.75)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i <= 5; i++) {
    const x = -L * 0.44 + (L * 0.5 * i) / 5;
    ctx.beginPath();
    ctx.moveTo(x, -W / 2 + 7);
    ctx.lineTo(x, W / 2 - 7);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-L * 0.44, -W / 2 + 7);
  ctx.lineTo(L * 0.06, -W / 2 + 7);
  ctx.moveTo(-L * 0.44, W / 2 - 7);
  ctx.lineTo(L * 0.06, W / 2 - 7);
  ctx.stroke();
  // llanta de refacción
  ctx.fillStyle = '#18191b';
  ctx.beginPath();
  ctx.arc(-L * 0.33, -W * 0.12, 11, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#6e7276';
  ctx.beginPath();
  ctx.arc(-L * 0.33, -W * 0.12, 4.5, 0, TAU);
  ctx.fill();
  // bidones rojos amarrados
  for (const [bx, by] of [
    [-L * 0.16, -W * 0.27],
    [-L * 0.16, -W * 0.02],
  ]) {
    ctx.fillStyle = '#b8342a';
    roundRect(ctx, bx - 7, by - 5, 14, 10, 2);
    ctx.fill();
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,170,140,0.5)';
    ctx.beginPath();
    ctx.moveTo(bx - 4, by - 3);
    ctx.lineTo(bx + 4, by + 3);
    ctx.moveTo(bx + 4, by - 3);
    ctx.lineTo(bx - 4, by + 3);
    ctx.stroke();
  }
  // lona verde amarrada con correas
  ctx.fillStyle = '#5a6a3a';
  roundRect(ctx, -L * 0.42, W * 0.1, L * 0.36, W * 0.28, 5);
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.stroke();
  ctx.strokeStyle = '#2a2418';
  ctx.lineWidth = 2;
  for (const x of [-L * 0.34, -L * 0.18]) {
    ctx.beginPath();
    ctx.moveTo(x, W * 0.08);
    ctx.lineTo(x, W * 0.4);
    ctx.stroke();
  }
  // espejos
  ctx.fillStyle = dark;
  for (const s of [-1, 1]) {
    ctx.fillRect(L * 0.12, s * (W / 2 + 3) - 2, 6, 4);
  }
  // defensa de tubos al frente
  ctx.strokeStyle = '#8a8e90';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(L / 2 + 2, -W / 2 + 6);
  ctx.lineTo(L / 2 + 6, -W / 2 + 10);
  ctx.lineTo(L / 2 + 6, W / 2 - 10);
  ctx.lineTo(L / 2 + 2, W / 2 - 6);
  ctx.stroke();
  ctx.lineWidth = 2;
  for (const y of [-W * 0.2, 0, W * 0.2]) {
    ctx.beginPath();
    ctx.moveTo(L / 2 - 1, y);
    ctx.lineTo(L / 2 + 6, y);
    ctx.stroke();
  }
  // faros (más brillantes con el motor encendido) y calaveras
  const on = phase === 'ready' || phase === 'leaving' || phase === 'fuel';
  ctx.fillStyle = on ? '#fff6c8' : '#d8d2a8';
  for (const s of [-1, 1]) {
    roundRect(ctx, L / 2 - 6, s * (W / 2 - 8) - 4, 5, 8, 2);
    ctx.fill();
  }
  ctx.fillStyle = on ? '#ff3a2a' : '#8a2a22';
  for (const s of [-1, 1]) ctx.fillRect(-L / 2, s * (W / 2 - 8) - 4, 3, 8);
  // daño: abolladuras y grietas según la vida que pierde
  if (hp < 0.85) {
    ctx.strokeStyle = 'rgba(8,10,10,0.75)';
    ctx.lineWidth = 1.2;
    const n = Math.ceil((1 - hp) * 9);
    for (let i = 0; i < n; i++) {
      const a = i * 2.4;
      const x = Math.cos(a * 1.7) * L * 0.38;
      const y = Math.sin(a * 2.3) * W * 0.34;
      ctx.beginPath();
      ctx.moveTo(x - 5, y - 2);
      ctx.lineTo(x, y + 1);
      ctx.lineTo(x + 4, y - 3);
      ctx.lineTo(x + 7, y + 2);
      ctx.stroke();
    }
  }
  if (hp < 0.4) {
    ctx.fillStyle = 'rgba(20,16,12,0.35)';
    roundRect(ctx, -L / 2, -W / 2, L, W, 9);
    ctx.fill();
  }
  // destello al recibir un golpe
  if (van.hitT > 0) {
    ctx.fillStyle = `rgba(255,236,220,${(van.hitT / 0.2) * 0.45})`;
    roundRect(ctx, -L / 2, -W / 2, L, W, 9);
    ctx.fill();
  }
  ctx.restore();
}

// Manguera del bidón al tanque mientras carga (un bidón en el suelo junto a la puerta trasera).
function drawFueling(ctx, van, time) {
  const x0 = van.x + van.w * 0.18;
  const y0 = van.y + van.h + 4;
  const cx = x0 - 22;
  const cy = y0 + 18;
  drawCanSprite(ctx, cx, cy, 0.9, -0.3);
  ctx.strokeStyle = '#1c1c1c';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx + 4, cy - 10);
  ctx.quadraticCurveTo(cx + 14, y0 - 2 + Math.sin(time * 6) * 2, x0, y0 - 6);
  ctx.stroke();
  // gotas que suben por la manguera
  ctx.fillStyle = '#f0c440';
  for (let i = 0; i < 3; i++) {
    const k = (time * 1.5 + i / 3) % 1;
    const px = cx + 4 + (x0 - cx - 4) * k;
    const py = cy - 10 + (y0 - 6 - (cy - 10)) * k - Math.sin(k * Math.PI) * 6;
    ctx.beginPath();
    ctx.arc(px, py, 1.6, 0, TAU);
    ctx.fill();
  }
}

/* ---------- bidones ---------- */

// Bidón rojo de combustible (unos 18×24 px por s): asa arriba, tapa, la X marcada y un brillo.
function drawCanSprite(ctx, x, y, s = 1, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s, s);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(2, 13, 10, 4, 0, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = OUT;
  ctx.fillStyle = '#c8382a';
  ctx.beginPath();
  ctx.moveTo(-9, -6);
  ctx.lineTo(-3, -12);
  ctx.lineTo(9, -12);
  ctx.lineTo(9, 12);
  ctx.lineTo(-9, 12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // asa
  ctx.fillStyle = '#8e2218';
  ctx.fillRect(1, -16, 7, 4);
  ctx.strokeRect(1, -16, 7, 4);
  // tapa
  ctx.fillStyle = '#e8c040';
  ctx.fillRect(-7, -13, 4, 4);
  // X marcada
  ctx.strokeStyle = 'rgba(255,170,150,0.65)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-5, -4);
  ctx.lineTo(6, 9);
  ctx.moveTo(6, -4);
  ctx.lineTo(-5, 9);
  ctx.stroke();
  // brillo
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.fillRect(-8, -5, 2, 15);
  ctx.restore();
}

// Barril rojo de combustible visto desde arriba: tapa con aros, franjas de peligro y un símbolo de fuego.
function drawBarrel(ctx, b, time) {
  const r = 12;
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(3, 4, r + 1, r, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#b8342a';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // franjas amarillas y negras alrededor
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r - 1, 0, TAU);
  ctx.arc(0, 0, r - 4.5, 0, TAU, true);
  ctx.clip();
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = i % 2 ? '#1a1712' : '#f0c440';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, (i / 12) * TAU, ((i + 1) / 12) * TAU);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // tapa con su aro y el tapón
  ctx.fillStyle = '#9a2a22';
  ctx.beginPath();
  ctx.arc(0, 0, r - 5, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,170,150,0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#d8d0b8';
  ctx.beginPath();
  ctx.arc(-2.5, -2.5, 1.8, 0, TAU);
  ctx.fill();
  // llamita marcada
  ctx.fillStyle = 'rgba(255,200,120,0.85)';
  ctx.beginPath();
  ctx.moveTo(2, 4);
  ctx.quadraticCurveTo(5, 0, 2.5, -3);
  ctx.quadraticCurveTo(2, 0, 0, 1);
  ctx.quadraticCurveTo(-1, 3, 2, 4);
  ctx.fill();
  // un brillo que late: avisa que es peligroso
  const a = 0.18 + 0.12 * Math.sin(time * 4 + b.ph);
  ctx.strokeStyle = `rgba(255,120,60,${a})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, r + 4, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

/** En el suelo (debajo de los zombis): los bidones, la camioneta y la manguera durante la carga. */
export function drawEscapeGround(ctx, game, time) {
  const e = game.escape;
  if (!e.active) return;
  const v = game.view;
  for (const c of e.cans) {
    if (c.taken || c.x < v.x0 - 40 || c.x > v.x1 + 40 || c.y < v.y0 - 40 || c.y > v.y1 + 40) continue;
    // anillo en el suelo que late
    const k = (time * 0.8 + c.ph) % 1;
    ctx.strokeStyle = `rgba(240,196,64,${0.55 * (1 - k)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(c.x, c.y + 6, 10 + k * 26, 0, TAU);
    ctx.stroke();
    const bob = Math.sin(time * 3 + c.ph) * 2;
    drawCanSprite(ctx, c.x, c.y + bob, 1.05, Math.sin(time * 1.3 + c.ph) * 0.08);
  }
  for (const b of e.barrels) {
    if (!b.alive || b.x < v.x0 - 30 || b.x > v.x1 + 30 || b.y < v.y0 - 30 || b.y > v.y1 + 30) continue;
    drawBarrel(ctx, b, time);
  }
  const van = e.van;
  if (van && e.phase !== 'done') {
    if (van.x + van.w > v.x0 - 60 && van.x < v.x1 + 60 && van.y + van.h > v.y0 - 60 && van.y < v.y1 + 60) {
      if (e.phase === 'fuel') drawFueling(ctx, van, time);
      if (e.phase !== 'lost') drawVanBody(ctx, van, time, e.phase);
      else drawWreck(ctx, van);
    }
  }
}

// Lo que queda de la camioneta tras explotar: carrocería quemada.
function drawWreck(ctx, van) {
  ctx.save();
  ctx.translate(van.x + van.w / 2, van.y + van.h / 2);
  ctx.rotate(0.08);
  ctx.fillStyle = '#1a1714';
  roundRect(ctx, -van.w / 2, -van.h / 2, van.w, van.h, 9);
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,120,40,0.35)';
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.arc(Math.cos(i * 2.1) * van.w * 0.35, Math.sin(i * 1.7) * van.h * 0.3, 4 + (i % 3), 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/* ---------- encima de la oscuridad ---------- */

/** Haces de luz de los bidones, aviso alrededor de la camioneta, su vida y el indicador de la carga. */
export function drawEscapeUi(ctx, game, time) {
  const e = game.escape;
  if (!e.active || e.phase === 'done') return;
  const v = game.view;
  const z = game.base.z / game.dpr;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const c of e.cans) {
    if (c.taken || c.x < v.x0 - 60 || c.x > v.x1 + 60 || c.y < v.y0 - 200 || c.y > v.y1 + 60) continue;
    // haz de luz que sube del bidón: se ve de lejos aunque esté oscuro
    const a = 0.35 + 0.15 * Math.sin(time * 2.5 + c.ph);
    const g = ctx.createLinearGradient(c.x, c.y, c.x, c.y - 150);
    g.addColorStop(0, `rgba(255,196,80,${a})`);
    g.addColorStop(1, 'rgba(255,196,80,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(c.x - 9, c.y);
    ctx.lineTo(c.x - 4, c.y - 150);
    ctx.lineTo(c.x + 4, c.y - 150);
    ctx.lineTo(c.x + 9, c.y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  const van = e.van;
  if (!van || e.phase === 'lost') return;
  const cx = van.x + van.w / 2;
  const cy = van.y + van.h / 2;
  // la camioneta te llama: anillo verde cuando hay que volver o subir
  const call = (e.phase === 'search' && e.have >= e.need) || e.phase === 'ready';
  if (call) {
    const k = (time * 0.9) % 1;
    ctx.strokeStyle = `rgba(156,240,168,${0.7 * (1 - k)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(cx, cy, van.w * 0.6 + k * 40, van.h * 0.8 + k * 40, 0, 0, TAU);
    ctx.stroke();
  }
  if (e.phase === 'leaving') return;
  // vida de la camioneta
  const hp = Math.max(0, van.hp / van.max);
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(van.x - 1, van.y - 17, van.w + 2, 8);
  ctx.fillStyle = hp > 0.5 ? '#86c08e' : hp > 0.25 ? '#e0a040' : '#e0503a';
  ctx.fillRect(van.x, van.y - 16, van.w * hp, 6);
  // indicador de la carga: un anillo que se llena sobre la camioneta, con el bidón al centro
  if (e.phase === 'fuel') {
    const k = Math.min(1, e.fuelT / e.fuelMax);
    const R = 22;
    const gy = van.y - 46;
    ctx.fillStyle = 'rgba(10,10,8,0.75)';
    ctx.beginPath();
    ctx.arc(cx, gy, R + 5, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(240,196,64,0.25)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, gy, R, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = '#f0c440';
    ctx.beginPath();
    ctx.arc(cx, gy, R, -Math.PI / 2, -Math.PI / 2 + TAU * k);
    ctx.stroke();
    drawCanSprite(ctx, cx, gy + 1, 0.75);
    ctx.font = `700 ${Math.round(16 / Math.max(0.6, z))}px Teko, sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.fillStyle = '#ffe6a8';
    const t = `${Math.ceil(e.fuelMax - e.fuelT)} s`;
    ctx.strokeText(t, cx, gy + R + 22);
    ctx.fillText(t, cx, gy + R + 22);
  }
}

/** Flechas en la orilla: amarillas hacia los bidones que faltan, verde grande hacia la camioneta. */
export function drawEscapeArrows(game, ctx, W, H) {
  const e = game.escape;
  if (!e.active || !game.player?.alive || e.phase === 'leaving' || e.phase === 'lost' || e.phase === 'done') return;
  const b = game.base;
  const arrow = (x, y, col, big) => {
    const sx = x * b.z + b.tx;
    const sy = y * b.z + b.ty;
    if (sx > 0 && sx < W && sy > 0 && sy < H) return;
    const m = 44 * game.dpr;
    const a = Math.atan2(sy - H / 2, sx - W / 2);
    const k = Math.min(Math.abs((W / 2 - m) / Math.cos(a)), Math.abs((H / 2 - m) / Math.sin(a)));
    ctx.save();
    ctx.translate(W / 2 + Math.cos(a) * k, H / 2 + Math.sin(a) * k);
    ctx.rotate(a);
    const s = (big ? 18 : 12) * game.dpr;
    ctx.fillStyle = col;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 2 * game.dpr;
    ctx.beginPath();
    ctx.moveTo(s, 0);
    ctx.lineTo(-s * 0.6, -s * 0.8);
    ctx.lineTo(-s * 0.3, 0);
    ctx.lineTo(-s * 0.6, s * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };
  if (e.phase === 'search') for (const c of e.cans) if (!c.taken) arrow(c.x, c.y, 'rgba(240,192,64,0.9)', false);
  const van = e.van;
  const back = (e.phase === 'search' && e.have >= e.need) || e.phase === 'fuel' || e.phase === 'ready';
  if (van && back) arrow(van.x + van.w / 2, van.y + van.h / 2, 'rgba(156,240,168,0.95)', true);
}

/* ---------- luces (las pinta lighting.js en su capa) ---------- */

/** Faros y luz de la camioneta, y un brillo en cada bidón. `soft` y `cone` son las imágenes de la luz. */
export function drawEscapeLights(g, game, soft, cone) {
  const e = game.escape;
  if (!e.active) return;
  for (const c of e.cans) {
    if (c.taken) continue;
    g.globalAlpha = 0.55;
    g.drawImage(soft, c.x - 70, c.y - 70, 140, 140);
  }
  const van = e.van;
  if (!van || e.phase === 'lost' || e.phase === 'done') return;
  const cx = van.x + van.w / 2;
  const cy = van.y + van.h / 2;
  g.globalAlpha = 0.7;
  g.drawImage(soft, cx - 150, cy - 150, 300, 300);
  // faros: más fuertes con el motor encendido
  const on = e.phase === 'fuel' || e.phase === 'ready' || e.phase === 'leaving';
  g.save();
  g.translate(van.x + van.w, cy);
  g.globalAlpha = on ? 0.95 : 0.45;
  g.drawImage(cone, 0, -150, 460, 300);
  g.restore();
}

/** Brillo cálido aditivo de los bidones y los barriles (en el pase de luces de lighting.js). */
export function drawEscapeGlow(ctx, game, warm) {
  const t = game.time;
  for (const b of game.escape.barrels) {
    if (!b.alive) continue;
    ctx.globalAlpha = 0.18 + 0.08 * Math.sin(t * 4 + b.ph);
    ctx.drawImage(warm, b.x - 40, b.y - 40, 80, 80);
  }
  for (const c of game.escape.cans) {
    if (c.taken) continue;
    ctx.globalAlpha = 0.3 + 0.12 * Math.sin(t * 3 + c.ph);
    ctx.drawImage(warm, c.x - 48, c.y - 48, 96, 96);
  }
}
