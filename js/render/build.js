// Dibujo de barricadas, trampas, torreta pesada, granadas, fuegos y cohetes. La lógica vive en sim/build.js.
import { ABILITY, BUILD, SHOP, STICKY } from '../core/config.ts';
import { TAU, rand, roundRect } from '../core/util.ts';
import { OUT, flameSprite } from './sprites.js';
import { drawRocket } from './bullets.js';
import { drawDecoy, drawRepair } from './ops.js';
import { heavyLevel, heavyLevels, milSalvo } from '../sim/heavy.ts';

// Mira roja en el suelo que se cierra y el misil cayendo en picada sobre ella.
export function drawMissiles(ctx, st, time) {
  const R = ABILITY.bomber.radius;
  for (const m of st.missiles) {
    const k = Math.min(1, m.t / m.dur);
    const blink = 0.55 + 0.45 * Math.abs(Math.sin(time * (6 + k * 18)));
    ctx.save();
    ctx.globalAlpha = 0.12 + 0.12 * k;
    ctx.fillStyle = '#b5302a';
    ctx.beginPath();
    ctx.arc(m.x, m.y, R, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.5 * blink;
    ctx.strokeStyle = '#ff5a40';
    ctx.lineWidth = 3;
    ctx.setLineDash([18, 12]);
    ctx.beginPath();
    ctx.arc(m.x, m.y, R, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    // mira que se cierra hacia el punto de impacto
    const rr = 30 + (1 - k) * 120;
    ctx.globalAlpha = 0.9 * blink;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(m.x, m.y, rr, 0, TAU);
    ctx.moveTo(m.x - rr - 14, m.y);
    ctx.lineTo(m.x - rr + 10, m.y);
    ctx.moveTo(m.x + rr - 10, m.y);
    ctx.lineTo(m.x + rr + 14, m.y);
    ctx.moveTo(m.x, m.y - rr - 14);
    ctx.lineTo(m.x, m.y - rr + 10);
    ctx.moveTo(m.x, m.y + rr - 10);
    ctx.lineTo(m.x, m.y + rr + 14);
    ctx.stroke();
    // sombra que crece mientras baja
    ctx.globalAlpha = 0.15 + 0.35 * k;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(m.x, m.y, 6 + 16 * k, 4 + 9 * k, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    const h = (1 - k) * (1 - k) * 900;
    ctx.save();
    ctx.translate(m.x, m.y - h);
    ctx.scale(2.2, 2.2);
    drawRocket(ctx, 0, 0, Math.PI / 2, true);
    ctx.restore();
  }
}

export function drawStuck(ctx, st, time) {
  for (const r of st.stuck) {
    const glowing = r.glow && r.t > r.stick;
    if (glowing) {
      // brillo verde que pulsa cada vez más rápido antes de estallar
      const k = (r.t - r.stick) / r.glow;
      const pulse = 0.55 + 0.45 * Math.abs(Math.sin(time * (10 + k * 30)));
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (0.35 + 0.5 * k) * pulse;
      const g = ctx.createRadialGradient(r.x, r.y, 2, r.x, r.y, 30 + k * 30);
      g.addColorStop(0, 'rgba(255,250,170,1)');
      g.addColorStop(0.5, 'rgba(255,200,40,0.65)');
      g.addColorStop(1, 'rgba(230,140,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 30 + k * 30, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    // sólo asoma la cola del cohete: la ojiva está dentro
    drawRocket(ctx, r.x - Math.cos(r.ang || 0) * 6, r.y - Math.sin(r.ang || 0) * 6, r.ang || 0, false);
    if (glowing) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,230,90,0.9)';
      ctx.beginPath();
      ctx.arc(r.x, r.y, 4, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
  }
}

// Bomba lapa (sim/build.ts, STICKY): dónde se dibuja (pegada sigue al zombi, también el que llega en la foto).
function stickyAt(s) {
  const z = s.z;
  if (!s.stuck || !z || z.dead) return s;
  const c = Math.cos(z.angle);
  const sn = Math.sin(z.angle);
  return { x: z.x + s.ox * c - s.oy * sn, y: z.y + s.ox * sn + s.oy * c };
}

// Lo que le queda de mecha (0..1, 1 recién pegada) y lo rápido que parpadea.
const fuseK = (s) => Math.max(0, Math.min(1, s.fuse / STICKY.fuse));
const blinkOn = (s, time) => Math.sin(time * (8 + (1 - fuseK(s)) * 46)) > 0;

// En el suelo: el radio de la explosión en rojo, que late cada vez más rápido.
export function drawStickyZones(ctx, st, time) {
  for (const s of st.stickies || []) {
    if (s.fuse < 0) continue;
    const { x, y } = stickyAt(s);
    const k = 1 - fuseK(s);
    const R = STICKY.radius;
    const pulse = 0.5 + 0.5 * Math.abs(Math.sin(time * (4 + k * 22)));
    const g = ctx.createRadialGradient(x, y, R * 0.2, x, y, R);
    g.addColorStop(0, `rgba(255,40,20,${0.02 + 0.1 * k * pulse})`);
    g.addColorStop(0.85, `rgba(255,30,10,${0.05 + 0.16 * k * pulse})`);
    g.addColorStop(1, 'rgba(255,30,10,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, TAU);
    ctx.fill();
    ctx.save();
    ctx.setLineDash([14, 10]);
    ctx.lineDashOffset = -time * 60;
    ctx.strokeStyle = `rgba(255,60,40,${0.25 + 0.5 * pulse * (0.4 + k * 0.6)})`;
    ctx.lineWidth = 2 + k * 2;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, TAU);
    ctx.stroke();
    ctx.restore();
    // la cuenta atrás: un anillo que se cierra hacia la bomba
    ctx.strokeStyle = `rgba(255,90,60,${0.35 + 0.4 * pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 18 + (R - 18) * fuseK(s), 0, TAU);
    ctx.stroke();
  }
}

// La bomba: en el aire gira con una estela roja; pegada, el piloto parpadea, brilla y se pone al rojo.
export function drawStickies(ctx, st, time) {
  for (const s of st.stickies || []) {
    const { x, y } = stickyAt(s);
    if (s.fuse < 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(x + 2, y + 3, 7, 4, 0, 0, TAU);
      ctx.fill();
      const by = y - s.h;
      const ca = Math.cos(s.a);
      const sa = Math.sin(s.a);
      ctx.globalCompositeOperation = 'lighter';
      const tr = ctx.createLinearGradient(x, by, x - ca * 46, by - sa * 46);
      tr.addColorStop(0, 'rgba(255,70,40,0.85)');
      tr.addColorStop(1, 'rgba(255,40,20,0)');
      ctx.strokeStyle = tr;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, by);
      ctx.lineTo(x - ca * 46, by - sa * 46 + 6);
      ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.globalCompositeOperation = 'source-over';
      ctx.save();
      ctx.translate(x, by);
      const sc = 1 + s.h / 50;
      ctx.scale(sc, sc);
      drawStickyBomb(ctx, s.rot, 1);
      ctx.restore();
      continue;
    }
    const k = 1 - fuseK(s);
    const on = blinkOn(s, time);
    // brillo rojo que crece; en el último momento, al blanco
    ctx.globalCompositeOperation = 'lighter';
    const gr = 16 + k * 34 + (on ? 6 : 0);
    const g = ctx.createRadialGradient(x, y, 1, x, y, gr);
    const hot = k > 0.85;
    g.addColorStop(0, hot ? 'rgba(255,250,230,0.95)' : `rgba(255,90,60,${on ? 0.9 : 0.45})`);
    g.addColorStop(0.45, `rgba(255,40,20,${0.25 + 0.4 * k})`);
    g.addColorStop(1, 'rgba(255,20,10,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, gr, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.translate(x, y);
    // tiembla a punto de estallar
    if (k > 0.7) ctx.translate(rand(-1, 1) * k * 2, rand(-1, 1) * k * 2);
    drawStickyBomb(ctx, s.rot, on ? 1 : 0.25);
    ctx.restore();
  }
}

// Carga de explosivo plástico con cinta, detonador, cables y piloto (led: 0..1).
export function drawStickyBomb(ctx, rot, led) {
  ctx.save();
  ctx.rotate(rot);
  ctx.fillStyle = 'rgba(80,190,70,0.55)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 9.5, 6.5, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#c2ae7c';
  ctx.fillRect(-8, -5, 16, 10);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 1.2;
  ctx.strokeRect(-8, -5, 16, 10);
  ctx.fillStyle = '#3c3c36';
  ctx.fillRect(-5.5, -5, 2.2, 10);
  ctx.fillRect(3.3, -5, 2.2, 10);
  ctx.fillStyle = '#2a2d2a';
  ctx.fillRect(-2.6, -3, 5.2, 5);
  ctx.strokeStyle = '#d03a2a';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(2.6, -2);
  ctx.quadraticCurveTo(7, -8, 10, -5);
  ctx.stroke();
  ctx.strokeStyle = '#3a6ad0';
  ctx.beginPath();
  ctx.moveTo(2.6, 1);
  ctx.quadraticCurveTo(8, 6, 10.5, 3);
  ctx.stroke();
  ctx.fillStyle = led > 0.5 ? '#ff3a20' : '#7a1810';
  ctx.beginPath();
  ctx.arc(0, -0.5, 1.4, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export function drawFires(ctx, st, v, time) {
  if (!st.fires.length) return;
  const fl = flameSprite();
  for (const f of st.fires) {
    if (f.x + f.r < v.x0 || f.x - f.r > v.x1 || f.y + f.r < v.y0 || f.y - f.r > v.y1) continue;
    const grow = Math.min(1, f.t * 4);
    const fade = Math.min(1, (f.life - f.t) / 1.2);
    // charco encendido en el suelo
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.35 * fade;
    const g = ctx.createRadialGradient(f.x, f.y, 4, f.x, f.y, f.r * grow);
    g.addColorStop(0, 'rgba(255,170,60,0.9)');
    g.addColorStop(0.6, 'rgba(220,80,20,0.5)');
    g.addColorStop(1, 'rgba(160,40,10,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r * grow, 0, TAU);
    ctx.fill();
    // lenguas de fuego que bailan
    for (const q of f.flames) {
      const fx = f.x + (q.x - f.x) * grow;
      const fy = f.y + (q.y - f.y) * grow;
      const flick = 0.8 + 0.25 * Math.sin(time * 11 + q.ph) + 0.12 * Math.sin(time * 23 + q.ph * 2);
      const w = 20 * q.s * flick * fade;
      const h = w * (1.5 + 0.3 * Math.sin(time * 7 + q.ph));
      ctx.globalAlpha = 0.85 * fade;
      ctx.drawImage(fl, fx - w / 2, fy - h * 0.85, w, h);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
}

export function drawGround(ctx, st, v) {
  for (const s of st.scorches) {
    if (s.x < v.x0 - 80 || s.x > v.x1 + 80 || s.y < v.y0 - 80 || s.y > v.y1 + 80) continue;
    ctx.globalAlpha = Math.min(1, (s.life - s.t) / 5) * 0.55;
    ctx.fillStyle = '#0d0c0a';
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = s.a + (i / 12) * TAU;
      const r = 52 + Math.sin(i * 2.7 + s.a) * 12;
      ctx.lineTo(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const w of st.wires) {
    if (w.x > v.x1 || w.x + w.w < v.x0 || w.y > v.y1 || w.y + w.h < v.y0) continue;
    if (w.kind === 'spikes') drawSpikes(ctx, w);
    else if (w.kind === 'rusty') drawRusty(ctx, w);
    else if (w.kind === 'mine') drawMine(ctx, w, st.time || 0);
    else drawWire(ctx, w);
  }
}

export function drawBlocks(ctx, st, v) {
  for (const b of st.blocks) {
    if (b.x > v.x1 || b.x + b.w < v.x0 || b.y > v.y1 || b.y + b.h < v.y0) continue;
    if (b.layer) {
      // pieza encimada: un poco más arriba, con sombra sobre la de abajo
      const up = b.layer * 4;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(b.x + 2, b.y + 3 - up + 4, b.w, b.h);
      ctx.save();
      ctx.translate(0, -up);
      drawBlock(ctx, b);
      ctx.restore();
    } else drawBlock(ctx, b);
  }
}

// El cañón de las torretas pesadas montadas va encima de quien las maneja.
export function drawMannedHeavy(ctx, st) {
  for (const b of st.blocks) if (b.kind === 'heavy' && b.manned) drawHeavyGun(ctx, b);
}

// Modo construir: hasta dónde llegas (círculo) y la pieza misma, transparente, donde caería:
// con marco verde si cabe y rojo si no.
export function drawGhost(ctx, st, game, kind, time, at) {
  const p = game.player;
  const pl = st.placement(game, kind, at.x, at.y, !!game.buildRot);
  ctx.strokeStyle = 'rgba(230,224,210,0.18)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.arc(p.x, p.y, BUILD.reach, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  const pulse = 0.7 + Math.sin(time * 6) * 0.2;
  ctx.globalAlpha = 0.75;
  const piece = { k: 0, kind, x: pl.x, y: pl.y, w: pl.w, h: pl.h, hp: 1, max: 1, hitT: 0, ang: pl.a, up: 0 };
  if (SHOP[kind].ground) {
    if (kind === 'spikes') drawSpikes(ctx, piece);
    else if (kind === 'rusty') drawRusty(ctx, piece);
    else if (kind === 'mine') drawMine(ctx, piece, time);
    else drawWire(ctx, piece);
  } else drawBlock(ctx, piece);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = pl.ok ? 'rgba(150,220,160,0.3)' : 'rgba(220,70,58,0.45)';
  ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
  ctx.strokeStyle = pl.ok ? '#a8f0b4' : '#ff5a48';
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 4]);
  ctx.lineDashOffset = -time * 20;
  ctx.strokeRect(pl.x + 1.5, pl.y + 1.5, pl.w - 3, pl.h - 3);
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;
  ctx.globalAlpha = 1;
}

export function drawGrenades(ctx, st) {
  for (const g of st.grenades) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(g.x + 2, g.y + 3, 6, 4, 0, 0, TAU);
    ctx.fill();
    const s = 1 + g.h / 60;
    ctx.save();
    ctx.translate(g.x, g.y - g.h);
    ctx.rotate(g.rot);
    ctx.scale(s, s);
    if (g.kind === 'molotov') {
      drawBottle(ctx);
      ctx.restore();
      continue;
    }
    ctx.fillStyle = '#4a5a34';
    ctx.beginPath();
    ctx.ellipse(0, 0, 6, 5, 0, 0, TAU);
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = OUT;
    ctx.stroke();
    ctx.fillStyle = '#8a8a84';
    ctx.fillRect(4, -2, 4, 4);
    ctx.restore();
    if (g.t > g.dur && Math.sin(g.t * 30) > 0) {
      ctx.fillStyle = '#ff6a40';
      ctx.beginPath();
      ctx.arc(g.x, g.y, 2.2, 0, TAU);
      ctx.fill();
    }
  }
}

export function drawBars(ctx, st, v) {
  for (const b of st.blocks) {
    if (b.x > v.x1 || b.x + b.w < v.x0 || b.y > v.y1 || b.y + b.h < v.y0) continue;
    const up = (b.layer || 0) * 4;
    if (b.layer && st.topOf(b) === b) {
      // cuántas piezas hay apiladas
      ctx.font = '700 9px sans-serif';
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(b.x + b.w - 15, b.y - up - 1, 16, 11);
      ctx.fillStyle = '#e6e0d2';
      ctx.fillText(`x${b.layer + 1}`, b.x + b.w - 13, b.y - up + 8);
    }
    if (b.hp >= b.max) continue;
    const w = Math.max(28, b.w * 0.8);
    const x = b.x + b.w / 2 - w / 2;
    const y = b.y - 9 - up;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x - 1, y - 1, w + 2, 5);
    ctx.fillStyle = '#c7a24a';
    ctx.fillRect(x, y, w * (b.hp / b.max), 3);
  }
}

// Torreta pesada (inspirada en la torreta de Gears of War 4): trípode y cañón doble blindado.
// Las mejoras se ven: sacos de arena y placas (blindaje), cañones más gruesos (calibre), aletas
// de cobre (cadencia), cajas de munición rojas (carga explosiva) y un sensor con láser (piloto).
function drawHeavy(ctx, b) {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  // el dibujo crece hasta el nivel 3; los niveles de más se notan en el taller
  const armor = Math.min(3, heavyLevel(b, 'armor'));
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(cx + 4, cy + 6, 24 + armor * 3, 20 + armor * 3, 0, 0, TAU);
  ctx.fill();
  if (armor) drawSandbags(ctx, cx, cy, armor);
  // patas del trípode
  ctx.lineCap = 'round';
  for (const [lw, col] of [
    [7, OUT],
    [4, armor >= 2 ? '#5d646b' : '#4a5056'],
  ]) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = col;
    ctx.beginPath();
    for (let k = 0; k < 3; k++) {
      const a = (k * TAU) / 3 - Math.PI / 2;
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * 21, cy + Math.sin(a) * 21);
    }
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
  ctx.fillStyle = '#2a2e32';
  const foot = 7 + (armor >= 3 ? 3 : 0);
  for (let k = 0; k < 3; k++) {
    const a = (k * TAU) / 3 - Math.PI / 2;
    ctx.fillRect(cx + Math.cos(a) * 21 - foot / 2, cy + Math.sin(a) * 21 - foot / 2, foot, foot);
  }
  // anillo de giro
  ctx.fillStyle = b.hitT > 0 ? '#8a9096' : '#3a3f44';
  ctx.beginPath();
  ctx.arc(cx, cy, 12, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = OUT;
  ctx.stroke();
  if (!b.manned) drawHeavyGun(ctx, b);
}

// Parapeto de sacos de arena alrededor del trípode: más sacos con cada nivel de blindaje.
function drawSandbags(ctx, cx, cy, lv) {
  const n = [0, 5, 8, 11][lv];
  const R = 29;
  ctx.lineWidth = 1.4;
  for (let i = 0; i < n; i++) {
    // empiezan detrás y rodean hacia delante (la boca del cañón queda libre en el nivel 3)
    const a = Math.PI + ((i - (n - 1) / 2) * TAU) / 13;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillStyle = i % 2 ? '#8b7a52' : '#7a6a46';
    roundRect(ctx, -7.5, -4.5, 15, 9, 4);
    ctx.fill();
    ctx.strokeStyle = OUT;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(40,30,15,0.55)';
    ctx.beginPath();
    ctx.moveTo(-3, -3.5);
    ctx.lineTo(-3, 3.5);
    ctx.moveTo(3, -3.5);
    ctx.lineTo(3, 3.5);
    ctx.stroke();
    ctx.restore();
  }
}

const FIN = ['#4c5258', '#6e5a44', '#8d6236', '#b0702a'];
const STRIPE = ['#c9a54a', '#d98a3a', '#d9603a', '#e8402c'];

function drawHeavyGun(ctx, b) {
  const lv = Object.fromEntries(Object.entries(heavyLevels(b)).map(([k, n]) => [k, Math.min(3, n)]));
  const now = performance.now() / 1000;
  ctx.save();
  ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
  ctx.rotate(b.ang || 0);
  ctx.strokeStyle = OUT;
  // láser del piloto automático: sólo cuando nadie la maneja
  if (lv.auto && !b.manned) {
    const gr = ctx.createLinearGradient(44, 0, 190, 0);
    gr.addColorStop(0, 'rgba(255,70,50,0.55)');
    gr.addColorStop(1, 'rgba(255,70,50,0)');
    ctx.strokeStyle = gr;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(44, 0);
    ctx.lineTo(190, 0);
    ctx.stroke();
    ctx.strokeStyle = OUT;
  }
  // dos cañones con camisa de aletas y freno de boca; retrocede el que acaba de disparar.
  // El calibre los hace más largos y gruesos; la cadencia, más aletas y de cobre.
  const len = 32 + lv.cal * 3;
  const th = 5.2 + lv.cal * 0.9;
  const fins = 4 + lv.rate;
  const brake = 7 + lv.cal * 1.2;
  for (const s of [-1, 1]) {
    const k = b.side === s ? (b.recoil || 0) * 4 : 0;
    const y = s * 7;
    ctx.lineWidth = 1.2;
    ctx.fillStyle = '#25282b';
    ctx.fillRect(6 - k, y - th / 2, len, th);
    ctx.strokeRect(6 - k, y - th / 2, len, th);
    ctx.fillStyle = FIN[lv.rate];
    const gap = Math.min(4.5, 18 / fins);
    for (let i = 0; i < fins; i++) ctx.fillRect(14 + i * gap - k, y - th / 2 - 1, 2.2, th + 2);
    ctx.fillStyle = '#3b4045';
    const bx = 4 + len - k;
    ctx.fillRect(bx, y - brake / 2, 7, brake);
    ctx.strokeRect(bx, y - brake / 2, 7, brake);
    ctx.fillStyle = '#0e0f10';
    ctx.fillRect(bx + 5.5, y - 1.2, 1.5, 2.4);
    if (b.flash > 0 && b.side === s) {
      ctx.fillStyle = 'rgba(255,214,140,0.95)';
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU;
        const d = i % 2 ? 3 : 9 + Math.random() * 6;
        ctx.lineTo(bx + 10 + Math.cos(a) * d * 1.4, y + Math.sin(a) * d * 0.7);
      }
      ctx.closePath();
      ctx.fill();
    }
  }
  // cajas blindadas de cada cañón, con franja (más roja con la carga explosiva) y remaches
  ctx.lineWidth = 1.6;
  for (const s of [-1, 1]) {
    const y = s < 0 ? -14 : 2;
    roundRect(ctx, -13, y, 24, 12, 3);
    ctx.fillStyle = b.hitT > 0 ? '#b8bec4' : '#7b838a';
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = STRIPE[lv.blast];
    ctx.fillRect(-10, s < 0 ? y + 1.5 : y + 8.5, 17, 2);
    if (lv.blast) {
      // munición explosiva: rombo de peligro que brilla en el nivel máximo
      const gx = -1;
      const gy = y + 6;
      if (lv.blast >= 3) {
        ctx.fillStyle = `rgba(255,90,50,${0.25 + 0.2 * Math.sin(now * 6)})`;
        ctx.beginPath();
        ctx.arc(gx, gy, 5, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = STRIPE[lv.blast];
      ctx.beginPath();
      ctx.moveTo(gx, gy - 3);
      ctx.lineTo(gx + 3, gy);
      ctx.lineTo(gx, gy + 3);
      ctx.lineTo(gx - 3, gy);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#3a3f44';
    ctx.fillRect(-10, y + 5, 2, 2);
    ctx.fillRect(5, y + 5, 2, 2);
  }
  // escudo frontal en ángulo: más ancho y con alas con el blindaje
  const w = 19 + lv.armor * 2.5;
  ctx.beginPath();
  ctx.moveTo(8, -w);
  ctx.lineTo(13 + lv.armor, -w + 3);
  ctx.lineTo(13 + lv.armor, -10);
  ctx.lineTo(10, -10);
  ctx.lineTo(10, 10);
  ctx.lineTo(13 + lv.armor, 10);
  ctx.lineTo(13 + lv.armor, w - 3);
  ctx.lineTo(8, w);
  ctx.closePath();
  ctx.fillStyle = ['#9aa2a8', '#a7afb5', '#b4bcc2', '#c3cad0'][lv.armor];
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#c9a54a';
  ctx.fillRect(11, -w + 4, 1.6, 4);
  ctx.fillRect(11, w - 8, 1.6, 4);
  if (lv.armor >= 2) {
    // remaches de las placas añadidas
    ctx.fillStyle = '#5a6066';
    for (const yy of [-w + 10, -14, 13, w - 11]) ctx.fillRect(10.5, yy, 2, 2);
  }
  // núcleo y asas de atrás (donde se agarra quien la maneja)
  ctx.fillStyle = '#2e3236';
  ctx.beginPath();
  ctx.arc(-2, 0, 5.5, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // luz: verde si la manejan, ámbar parpadeando con el piloto automático, roja si está sola
  const blink = Math.sin(now * 7) > 0;
  ctx.fillStyle = b.manned ? '#7fe07a' : lv.auto ? (blink ? '#ffb040' : '#6a4a1a') : '#b5463a';
  ctx.fillRect(-3, -1, 2, 2);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#2a2e32';
  ctx.beginPath();
  ctx.moveTo(-13, -9);
  ctx.lineTo(-19, -11);
  ctx.moveTo(-13, 9);
  ctx.lineTo(-19, 11);
  ctx.stroke();
  if (lv.auto) {
    // sensor del piloto automático: caja con lente y antena con la punta que parpadea
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = OUT;
    roundRect(ctx, -11, -4, 8, 8, 2);
    ctx.fillStyle = '#3d4348';
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = b.manned ? '#2a5a2a' : '#ff4a36';
    ctx.beginPath();
    ctx.arc(-7, 0, 2.2, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#2a2e32';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-9, -4);
    ctx.lineTo(-15, -16);
    ctx.stroke();
    ctx.fillStyle = blink ? '#ff6a50' : '#5a1a14';
    ctx.fillRect(-16.5, -17.5, 3, 3);
  }
  ctx.restore();
}

// Vista previa del taller: la torreta (con sus mejoras) girando despacio y disparando de vez en cuando;
// pulse > 0 justo después de comprar una mejora (un destello que se abre).
export function drawHeavyPreview(ctx, b, W, H, t, pulse) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  // el cañón apunta hacia arriba: el centro va un poco abajo para que quepa entero (la militar es más grande)
  const mil = b.kind === 'military';
  const s = Math.min(W, H) / (mil ? 112 : 95);
  ctx.setTransform(s, 0, 0, s, W / 2, H * 0.6);
  const ph = (t * (mil ? 0.8 : 2.2)) % 1;
  const shot = Math.floor(t * 2.2);
  const v = {
    ...b,
    x: -b.w / 2,
    y: -b.h / 2,
    ang: -Math.PI / 2 + Math.sin(t * 0.6) * 0.9,
    manned: null,
    hitT: 0,
    side: shot % 2 ? 1 : -1,
    recoil: Math.max(0, 1 - ph * 5),
    flash: ph < 0.08 ? 1 : 0,
  };
  if (mil) drawMilitary(ctx, v);
  else drawHeavy(ctx, v);
  if (pulse > 0) {
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = '#c7a24a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, (mil ? 45 : 30) + (1 - pulse) * 30, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

// Aviso sobre la torreta pesada que tienes al lado (con teclado): montar y mejorar.
export function drawHeavyPrompt(ctx, game) {
  const p = game.player;
  // montado y disparando no estorba la vista
  if (game.input.mode !== 'mouse' || !p.alive || p.inRobot || (p.manned && game.input.firing)) return;
  const b = p.manned || game.structures.nearHeavy(p) || game.structures.heavyFor(p);
  if (!b) return;
  const up = [['M', 'mejorar']];
  const parts = p.manned ? [...up, ['E', 'bajar']] : b.manned ? up : [['E', 'montar'], ...up];
  if (!parts.length) return;
  ctx.font = '600 12px "Barlow Condensed", "Arial Narrow", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  // ancho total: [tecla] palabra  [tecla] palabra
  const widths = parts.map(([, t]) => 14 + 4 + ctx.measureText(t).width);
  const w = widths.reduce((a, q) => a + q, 0) + 12 * (parts.length - 1) + 14;
  const x0 = b.x + b.w / 2 - w / 2;
  const y = b.y - 24;
  ctx.fillStyle = 'rgba(15,17,13,0.8)';
  ctx.fillRect(x0, y - 11, w, 22);
  ctx.strokeStyle = 'rgba(199,162,74,0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 + 0.5, y - 10.5, w - 1, 21);
  let x = x0 + 7;
  parts.forEach(([k, t], i) => {
    ctx.fillStyle = '#c7a24a';
    ctx.fillRect(x, y - 7, 14, 14);
    ctx.fillStyle = '#1d1607';
    ctx.textAlign = 'center';
    ctx.fillText(k, x + 7, y + 1);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e6e0d2';
    ctx.fillText(t, x + 18, y + 1);
    x += widths[i] + 12;
  });
}

// Barrera de concreto reforzado: losa gruesa con vigas de acero en los extremos y placas oxidadas
// remachadas. Se dibuja a lo largo (L) y a lo ancho (S) desde el centro; si está de pie, se gira.
// Grietas finas a la mitad de la vida y, al cuarto, grietas grandes, esquinas rotas y varilla expuesta.
function drawReinforced(ctx, b) {
  const { x, y, w, h } = b;
  const horiz = w >= h;
  const L = horiz ? w : h;
  const S = horiz ? h : w;
  const hl = L / 2;
  const hs = S / 2;
  const life = b.hp / b.max;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(x + 5, y + 6, w, h);
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  if (!horiz) ctx.rotate(Math.PI / 2);
  // losa de concreto
  ctx.fillStyle = '#7b7973';
  ctx.fillRect(-hl, -hs, L, S);
  ctx.fillStyle = '#96948c';
  ctx.fillRect(-hl, -hs, L, S * 0.28);
  ctx.fillStyle = '#5e5c57';
  ctx.fillRect(-hl, hs - S * 0.16, L, S * 0.16);
  ctx.fillStyle = 'rgba(40,38,34,0.4)';
  for (let i = 0; i < 9; i++) ctx.fillRect(-hl + 4 + ((i * 29) % (L - 8)), -hs + 3 + ((i * 17) % (S - 6)), 2, 2);
  // placas de acero oxidado entre las vigas
  const px = hl - 14;
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? -px + 3 : 5;
    const pw = px - 8;
    const g = ctx.createLinearGradient(x0, -hs * 0.5, x0 + pw, hs * 0.5);
    g.addColorStop(0, '#8d5b35');
    g.addColorStop(1, '#5f3b22');
    ctx.fillStyle = g;
    ctx.fillRect(x0, -hs * 0.5, pw, S * 0.62);
    ctx.fillStyle = 'rgba(176,104,52,0.55)';
    ctx.fillRect(x0 + pw * 0.15, -hs * 0.4, pw * 0.3, 3);
    ctx.fillRect(x0 + pw * 0.5, hs * 0.5, pw * 0.35, 2);
    ctx.fillStyle = 'rgba(30,20,12,0.35)';
    ctx.fillRect(x0 + pw * 0.6, -hs * 0.3, 2.5, S * 0.3);
    ctx.strokeStyle = '#2e2218';
    ctx.lineWidth = 1;
    ctx.strokeRect(x0, -hs * 0.5, pw, S * 0.62);
    ctx.fillStyle = '#c9b49a';
    for (const [rx, ry] of [
      [x0 + 3, -hs * 0.5 + 3],
      [x0 + pw - 3, -hs * 0.5 + 3],
      [x0 + 3, hs * 0.74 - 3],
      [x0 + pw - 3, hs * 0.74 - 3],
    ]) {
      ctx.beginPath();
      ctx.arc(rx, ry, 1.3, 0, TAU);
      ctx.fill();
    }
  }
  // vigas de acero (perfil en I) que atraviesan la losa en los extremos y al centro
  for (const bx of [-hl + 7, hl - 7, 0]) {
    const bw = bx ? 8 : 4;
    ctx.fillStyle = '#3f4448';
    ctx.fillRect(bx - bw / 2, -hs - 2, bw, S + 3);
    ctx.fillStyle = '#6d7377';
    ctx.fillRect(bx - bw / 2, -hs - 2, bw, 2);
    ctx.fillRect(bx - bw / 2, hs - 1, bw, 2);
    ctx.fillStyle = 'rgba(200,205,210,0.25)';
    ctx.fillRect(bx - bw / 2, -hs, 1.2, S - 1);
    if (bx) {
      ctx.fillStyle = '#c7a24a';
      ctx.fillRect(bx - bw / 2, -2, bw, 4);
      ctx.fillStyle = '#1e1c18';
      ctx.fillRect(bx - 1, -2, 2, 4);
    }
  }
  // marca de pintura militar
  ctx.fillStyle = 'rgba(220,214,196,0.5)';
  ctx.fillRect(-px + 4, -hs + 3, 3, 3);
  ctx.fillRect(-px + 9, -hs + 3, 9, 3);
  ctx.lineWidth = 2;
  ctx.strokeStyle = OUT;
  ctx.strokeRect(-hl, -hs, L, S);
  if (life <= 0.5) {
    // grietas finas
    ctx.strokeStyle = 'rgba(20,18,15,0.8)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(-hl * 0.55, -hs);
    ctx.lineTo(-hl * 0.45, -hs * 0.4);
    ctx.lineTo(-hl * 0.6, hs * 0.1);
    ctx.moveTo(hl * 0.3, hs);
    ctx.lineTo(hl * 0.38, hs * 0.45);
    ctx.lineTo(hl * 0.3, hs * 0.1);
    ctx.moveTo(hl * 0.38, hs * 0.45);
    ctx.lineTo(hl * 0.5, hs * 0.3);
    ctx.stroke();
  }
  if (life <= 0.25) {
    // esquinas rotas con la varilla a la vista
    ctx.fillStyle = '#2b2925';
    for (const [cx, cy, sx, sy] of [
      [-hl, -hs, 1, 1],
      [hl, hs, -1, -1],
    ]) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + sx * 13, cy);
      ctx.lineTo(cx + sx * 9, cy + sy * 5);
      ctx.lineTo(cx + sx * 4, cy + sy * 11);
      ctx.lineTo(cx, cy + sy * 9);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#9a5a2e';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx + sx * 2, cy + sy * 4);
      ctx.lineTo(cx + sx * 11, cy + sy * 2);
      ctx.moveTo(cx + sx * 3, cy + sy * 2);
      ctx.lineTo(cx + sx * 5, cy + sy * 9);
      ctx.stroke();
    }
    // grietas grandes que cruzan la losa y abollan las placas
    ctx.strokeStyle = 'rgba(12,10,8,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-hl * 0.2, -hs);
    ctx.lineTo(-hl * 0.05, -hs * 0.3);
    ctx.lineTo(-hl * 0.25, hs * 0.25);
    ctx.lineTo(-hl * 0.1, hs);
    ctx.moveTo(-hl * 0.05, -hs * 0.3);
    ctx.lineTo(hl * 0.2, -hs * 0.1);
    ctx.moveTo(hl * 0.65, -hs);
    ctx.lineTo(hl * 0.55, -hs * 0.2);
    ctx.lineTo(hl * 0.7, hs * 0.4);
    ctx.stroke();
    ctx.fillStyle = 'rgba(15,12,10,0.35)';
    ctx.beginPath();
    ctx.ellipse(-hl * 0.45, hs * 0.1, 6, 4, 0.4, 0, TAU);
    ctx.ellipse(hl * 0.42, -hs * 0.15, 5, 3.5, -0.3, 0, TAU);
    ctx.fill();
  }
  if (b.hitT > 0) {
    ctx.fillStyle = 'rgba(255,240,220,0.35)';
    ctx.fillRect(-hl, -hs, L, S);
  }
  ctx.restore();
}

// Torreta militar: la parte de arriba de un tanque sobre su anillo de acero. La torre angulosa gira con
// el cañón largo (de él salen los misiles), la escotilla del jefe, el periscopio y cajas de equipo.
function drawMilitary(ctx, b) {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  ctx.beginPath();
  ctx.ellipse(cx + 5, cy + 7, 32, 30, 0, 0, TAU);
  ctx.fill();
  // placa de la base con pernos y el anillo de giro
  ctx.fillStyle = '#3a3e36';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2;
  roundRect(ctx, b.x + 2, b.y + 2, b.w - 4, b.h - 4, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#23261f';
  for (const [px, py] of [
    [b.x + 8, b.y + 8],
    [b.x + b.w - 8, b.y + 8],
    [b.x + 8, b.y + b.h - 8],
    [b.x + b.w - 8, b.y + b.h - 8],
  ]) {
    ctx.beginPath();
    ctx.arc(px, py, 2.2, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#2a2d26';
  ctx.beginPath();
  ctx.arc(cx, cy, 25, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#5b5f55';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(b.ang || 0);
  const rk = (b.recoil || 0) * 7;
  // cañón: tubo largo con evacuador de humos y freno de boca; retrocede al disparar
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 1.6;
  ctx.fillStyle = '#4b5239';
  ctx.fillRect(14 - rk, -3.2, 32, 6.4);
  ctx.strokeRect(14 - rk, -3.2, 32, 6.4);
  ctx.fillStyle = '#5c6447';
  ctx.fillRect(25 - rk, -4.6, 8, 9.2);
  ctx.strokeRect(25 - rk, -4.6, 8, 9.2);
  ctx.fillStyle = '#2c3022';
  ctx.fillRect(42 - rk, -4.4, 6, 8.8);
  ctx.strokeRect(42 - rk, -4.4, 6, 8.8);
  // torre angulosa (más ancha atrás, en punta hacia el cañón) con la cesta trasera
  ctx.fillStyle = '#3f4532';
  ctx.fillRect(-27, -14, 8, 28);
  ctx.strokeRect(-27, -14, 8, 28);
  ctx.beginPath();
  ctx.moveTo(-21, -17);
  ctx.lineTo(4, -18);
  ctx.lineTo(17, -9);
  ctx.lineTo(17, 9);
  ctx.lineTo(4, 18);
  ctx.lineTo(-21, 17);
  ctx.closePath();
  ctx.fillStyle = '#5a6340';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.stroke();
  // luz de arriba: el frente brilla un poco más
  ctx.fillStyle = 'rgba(214,220,170,0.12)';
  ctx.beginPath();
  ctx.moveTo(4, -18);
  ctx.lineTo(17, -9);
  ctx.lineTo(17, 9);
  ctx.lineTo(4, 18);
  ctx.closePath();
  ctx.fill();
  // mantelete del cañón
  ctx.fillStyle = '#4a5236';
  ctx.fillRect(12, -6, 6, 12);
  ctx.lineWidth = 1.4;
  ctx.strokeRect(12, -6, 6, 12);
  // cajas de equipo a los lados y lanzahumos al frente
  ctx.fillStyle = '#4c5438';
  ctx.fillRect(-16, -17, 14, 4);
  ctx.fillRect(-16, 13, 14, 4);
  ctx.strokeRect(-16, -17, 14, 4);
  ctx.strokeRect(-16, 13, 14, 4);
  ctx.fillStyle = '#2d3224';
  for (const s of [-1, 1])
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(6 + i * 3.5, s * 14.5, 1.4, 0, TAU);
      ctx.fill();
    }
  // blindaje: placas atornilladas a los lados de la torre (desde el nivel 2, más con el 5)
  const armor = heavyLevel(b, 'armor');
  if (armor >= 2) {
    ctx.fillStyle = '#4a5136';
    ctx.lineWidth = 1.3;
    const len = armor >= 5 ? 22 : 13;
    for (const sd of [-1, 1]) {
      ctx.fillRect(-20, sd > 0 ? 17 : -20, len, 3);
      ctx.strokeRect(-20, sd > 0 ? 17 : -20, len, 3);
    }
  }
  // salva: tubos lanzamisiles a los lados (izquierdo con el nivel 1, los dos con el 2)
  const tubes = milSalvo(b);
  for (let i = 1; i < tubes; i++) {
    const sd = i === 1 ? -1 : 1;
    ctx.fillStyle = '#3f4630';
    ctx.lineWidth = 1.4;
    ctx.fillRect(-6, sd * 21 - 3.5, 30, 7);
    ctx.strokeRect(-6, sd * 21 - 3.5, 30, 7);
    ctx.fillStyle = '#1c1f17';
    ctx.beginPath();
    ctx.arc(24, sd * 21, 2.4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#6d7652';
    ctx.fillRect(4, sd * 21 - 3.5, 2, 7);
  }
  // radar: mástil con antena detrás de la escotilla (gira sola)
  if (heavyLevel(b, 'radar') >= 1) {
    ctx.strokeStyle = OUT;
    ctx.fillStyle = '#5d6648';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(-23, -8, 3, 0, TAU);
    ctx.fill();
    ctx.stroke();
    const ra = performance.now() / 330;
    ctx.strokeStyle = '#9aa58a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-23 - Math.cos(ra) * 6, -8 - Math.sin(ra) * 6);
    ctx.lineTo(-23 + Math.cos(ra) * 6, -8 + Math.sin(ra) * 6);
    ctx.stroke();
    ctx.strokeStyle = OUT;
  }
  // escotilla del jefe con el periscopio y la ametralladora
  ctx.lineWidth = 1.4;
  ctx.fillStyle = '#4e5638';
  ctx.beginPath();
  ctx.arc(-8, -5, 6.5, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#3a4029';
  ctx.beginPath();
  ctx.arc(-8, -5, 3.6, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#1d211a';
  ctx.fillRect(-6, -6, 12, 2);
  ctx.fillStyle = '#8fb4c0';
  ctx.fillRect(-1, 5, 4, 5);
  ctx.strokeRect(-1, 5, 4, 5);
  // estrella y número
  ctx.fillStyle = 'rgba(230,226,205,0.7)';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 1.6 : 4;
    const aa = -Math.PI / 2 + (i * Math.PI) / 5;
    ctx.lineTo(-17 + Math.cos(aa) * r, 8 + Math.sin(aa) * r);
  }
  ctx.closePath();
  ctx.fill();
  if (b.flash > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,214,140,${Math.min(1, b.flash * 8)})`;
    ctx.beginPath();
    ctx.ellipse(54 - rk, 0, 10, 6, 0, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  if (b.hitT > 0) {
    ctx.fillStyle = 'rgba(255,240,220,0.3)';
    ctx.fillRect(-27, -18, 44, 36);
  }
  ctx.restore();
}

function drawBlock(ctx, b) {
  if (b.kind === 'decoy') return drawDecoy(ctx, b);
  if (b.kind === 'repair') return drawRepair(ctx, b);
  if (b.kind === 'heavy') return drawHeavy(ctx, b);
  if (b.kind === 'military') return drawMilitary(ctx, b);
  if (b.kind === 'reinforced') return drawReinforced(ctx, b);
  const { x, y, w, h } = b;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(x + 5, y + 6, w, h);
  if (b.kind === 'wood') {
    ctx.fillStyle = '#7a5634';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(40,25,12,0.6)';
    ctx.lineWidth = 1.5;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(x, y + (h * i) / 4);
      ctx.lineTo(x + w, y + (h * i) / 4);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,220,170,0.1)';
    ctx.fillRect(x, y, w, 3);
    ctx.strokeStyle = '#5a3c22';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 4);
    ctx.lineTo(x + w - 4, y + h - 4);
    ctx.stroke();
    ctx.fillStyle = '#b8b2a4';
    for (const [nx, ny] of [
      [5, 5],
      [w - 5, 5],
      [5, h - 5],
      [w - 5, h - 5],
    ])
      ctx.fillRect(x + nx - 1, y + ny - 1, 2.5, 2.5);
  } else if (b.kind === 'metal') {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, '#8a8f93');
    g.addColorStop(1, '#5c6166');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(30,32,34,0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 5, y + 5, w - 10, h - 10);
    ctx.strokeStyle = 'rgba(220,225,230,0.25)';
    ctx.beginPath();
    ctx.moveTo(x + 6, y + h - 6);
    ctx.lineTo(x + w - 6, y + 6);
    ctx.stroke();
    ctx.fillStyle = '#3d4044';
    for (const [nx, ny] of [
      [4, 4],
      [w - 4, 4],
      [4, h - 4],
      [w - 4, h - 4],
    ]) {
      ctx.beginPath();
      ctx.arc(x + nx, y + ny, 2, 0, TAU);
      ctx.fill();
    }
  } else if (b.kind === 'sandbag') {
    const horiz = w > h;
    const n = Math.round((horiz ? w : h) / 20);
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < n; i++) {
        const off = row ? 10 : 0;
        const along = Math.min((horiz ? w : h) - 10, 10 + i * 20 + off);
        const across = (horiz ? h : w) * (row ? 0.68 : 0.32);
        const cx = horiz ? x + along : x + across;
        const cy = horiz ? y + across : y + along;
        ctx.fillStyle = (i + row) % 2 ? '#8a7d5c' : '#7f7354';
        ctx.beginPath();
        ctx.ellipse(cx, cy, horiz ? 10.5 : w * 0.3, horiz ? h * 0.3 : 10.5, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = OUT;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }
  } else if (b.kind === 'concrete') {
    ctx.fillStyle = '#8c8a84';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#a3a19a';
    if (w > h) ctx.fillRect(x, y + 3, w, h * 0.35);
    else ctx.fillRect(x + 3, y, w * 0.35, h);
    ctx.fillStyle = 'rgba(40,38,34,0.35)';
    for (let i = 0; i < 6; i++) ctx.fillRect(x + ((i * 37) % w), y + ((i * 13) % h), 3, 3);
    ctx.fillStyle = 'rgba(199,162,74,0.8)';
    if (w > h) {
      ctx.fillRect(x + 6, y + h - 6, 10, 3);
      ctx.fillRect(x + w - 16, y + h - 6, 10, 3);
    } else {
      ctx.fillRect(x + w - 6, y + 6, 3, 10);
      ctx.fillRect(x + w - 6, y + h - 16, 3, 10);
    }
  } else if (b.kind === 'hesco') {
    // Celdas cuadradas de malla con geotextil beige, vistas desde arriba con la arena dentro.
    const horiz = w >= h;
    const S = horiz ? h : w;
    const n = Math.max(1, Math.round((horiz ? w : h) / S));
    const L = (horiz ? w : h) / n;
    for (let i = 0; i < n; i++) {
      const cx = horiz ? x + i * L : x;
      const cy = horiz ? y : y + i * L;
      const cw = horiz ? L : w;
      const ch = horiz ? h : L;
      ctx.fillStyle = '#c9b98c';
      ctx.fillRect(cx, cy, cw, ch);
      ctx.fillStyle = '#a8966a';
      ctx.fillRect(cx + 4, cy + 4, cw - 8, ch - 8);
      ctx.fillStyle = 'rgba(70,58,36,0.3)';
      ctx.fillRect(cx + 4, cy + 4, cw - 8, 3);
      ctx.fillRect(cx + 4, cy + 4, 3, ch - 8);
      ctx.fillStyle = 'rgba(60,50,30,0.35)';
      for (let k = 0; k < 5; k++)
        ctx.fillRect(cx + 8 + ((k * 13 + i * 7) % (cw - 16)), cy + 8 + ((k * 11 + i * 5) % (ch - 16)), 2, 2);
    }
    ctx.strokeStyle = 'rgba(95,98,98,0.85)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let gx = x + 4; gx < x + w; gx += 6) {
      ctx.moveTo(gx, y);
      ctx.lineTo(gx, y + 4);
      ctx.moveTo(gx, y + h - 4);
      ctx.lineTo(gx, y + h);
    }
    for (let gy = y + 4; gy < y + h; gy += 6) {
      ctx.moveTo(x, gy);
      ctx.lineTo(x + 4, gy);
      ctx.moveTo(x + w - 4, gy);
      ctx.lineTo(x + w, gy);
    }
    ctx.stroke();
    ctx.strokeStyle = '#6e7070';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 1; i < n; i++) {
      if (horiz) {
        ctx.moveTo(x + i * L, y);
        ctx.lineTo(x + i * L, y + h);
      } else {
        ctx.moveTo(x, y + i * L);
        ctx.lineTo(x + w, y + i * L);
      }
    }
    ctx.stroke();
    ctx.fillStyle = '#4d5050';
    for (let i = 0; i <= n; i++) {
      const px = horiz ? x + i * L : x;
      const py = horiz ? y : y + i * L;
      ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
      ctx.fillRect(px - 1.5 + (horiz ? 0 : w), py - 1.5 + (horiz ? h : 0), 3, 3);
    }
  } else if (b.kind === 'turret') {
    const cx = x + w / 2;
    const cy = y + h / 2;
    ctx.fillStyle = '#3d4246';
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    ctx.fillStyle = '#c7a24a';
    ctx.fillRect(x + 2, y + 2, 6, 6);
    ctx.fillRect(x + w - 8, y + h - 8, 6, 6);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(b.ang || 0);
    ctx.fillStyle = '#1e2124';
    ctx.fillRect(4, -2.5, 20, 5);
    ctx.fillStyle = '#5c6268';
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, TAU);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = OUT;
    ctx.stroke();
    ctx.fillStyle = '#b5463a';
    ctx.fillRect(2, -2, 4, 4);
    if (b.flash > 0) {
      ctx.fillStyle = 'rgba(255,214,140,0.95)';
      ctx.beginPath();
      ctx.arc(26, 0, 5, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  } else {
    ctx.fillStyle = '#3c4146';
    ctx.fillRect(x, y, w, h);
    const horiz = w > h;
    ctx.strokeStyle = 'rgba(150,158,165,0.65)';
    ctx.lineWidth = 1.2;
    const L = horiz ? w : h;
    const S = horiz ? h : w;
    for (let i = -S; i < L; i += 8) {
      ctx.beginPath();
      if (horiz) {
        ctx.moveTo(x + i, y);
        ctx.lineTo(x + i + S, y + h);
        ctx.moveTo(x + i + S, y);
        ctx.lineTo(x + i, y + h);
      } else {
        ctx.moveTo(x, y + i);
        ctx.lineTo(x + w, y + i + S);
        ctx.moveTo(x, y + i + S);
        ctx.lineTo(x + w, y + i);
      }
      ctx.stroke();
    }
    ctx.fillStyle = '#25282b';
    if (horiz) {
      ctx.fillRect(x, y, 8, h);
      ctx.fillRect(x + w - 8, y, 8, h);
      ctx.fillRect(x + w / 2 - 3, y, 6, h);
    } else {
      ctx.fillRect(x, y, w, 8);
      ctx.fillRect(x, y + h - 8, w, 8);
      ctx.fillRect(x, y + h / 2 - 3, w, 6);
    }
    ctx.fillStyle = '#c7a24a';
    for (let i = 0; i < 2; i++) {
      if (horiz) ctx.fillRect(x + (i ? w - 8 : 0), y + 2, 8, 4);
      else ctx.fillRect(x + 2, y + (i ? h - 8 : 0), 4, 8);
    }
  }
  ctx.lineWidth = 2;
  ctx.strokeStyle = OUT;
  ctx.strokeRect(x, y, w, h);
  const dmg = 1 - b.hp / b.max;
  if (dmg > 0.35) {
    ctx.strokeStyle = 'rgba(15,12,10,0.75)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.2, y + h * 0.1);
    ctx.lineTo(x + w * 0.45, y + h * 0.5);
    ctx.lineTo(x + w * 0.3, y + h * 0.9);
    if (dmg > 0.65) {
      ctx.moveTo(x + w * 0.8, y + h * 0.15);
      ctx.lineTo(x + w * 0.55, y + h * 0.55);
      ctx.lineTo(x + w * 0.85, y + h * 0.85);
    }
    ctx.stroke();
  }
  if (b.hitT > 0) {
    ctx.fillStyle = 'rgba(255,240,220,0.35)';
    ctx.fillRect(x, y, w, h);
  }
}

function drawSpikes(ctx, w) {
  const { x, y } = w;
  ctx.globalAlpha = 0.55 + 0.45 * (w.hp / w.max);
  ctx.fillStyle = '#4a4740';
  ctx.fillRect(x, y, w.w, w.h);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, w.w, w.h);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const px = x + 6 + i * ((w.w - 12) / 3);
      const py = y + 6 + j * ((w.h - 12) / 3);
      ctx.fillStyle = w.hitT > 0 ? '#e6e0d2' : '#b8b2a4';
      ctx.beginPath();
      ctx.moveTo(px, py - 4);
      ctx.lineTo(px + 3, py + 3);
      ctx.lineTo(px - 3, py + 3);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// Barrera de pinchos oxidada: tres planchas de lámina corrugada color óxido, con remaches y filas de
// pinchos torcidos. Cada oleada que pasa se ve más carcomida (hp = oleadas que le quedan).
function drawRusty(ctx, w) {
  const { x, y } = w;
  const along = w.w >= w.h;
  const L = along ? w.w : w.h;
  const W = along ? w.h : w.w;
  const wear = 1 - Math.max(0, Math.min(1, w.hp / (w.max || 3)));
  ctx.save();
  ctx.translate(x + w.w / 2, y + w.h / 2);
  if (!along) ctx.rotate(Math.PI / 2);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-L / 2 + 3, -W / 2 + 4, L, W);
  // tres planchas con sus pliegues
  for (let k = 0; k < 3; k++) {
    const px = -L / 2 + (k * L) / 3;
    const pw = L / 3 - 2;
    ctx.fillStyle = k % 2 ? '#7a4424' : '#8a4e28';
    ctx.fillRect(px + 1, -W / 2 + 2, pw, W - 4);
    ctx.strokeStyle = 'rgba(40,18,8,0.55)';
    ctx.lineWidth = 1.5;
    for (let i = 1; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(px + 1 + (pw * i) / 5, -W / 2 + 2);
      ctx.lineTo(px + 1 + (pw * i) / 5, W / 2 - 2);
      ctx.stroke();
    }
    // manchas de óxido (más con cada oleada)
    ctx.fillStyle = 'rgba(178,96,40,0.55)';
    for (let i = 0; i < 2 + Math.round(wear * 4); i++) {
      ctx.beginPath();
      ctx.arc(
        px + 6 + ((i * 17 + k * 11) % (pw - 10)),
        -W / 2 + 7 + ((i * 13 + k * 5) % (W - 14)),
        3 + (i % 2) * 2,
        0,
        TAU,
      );
      ctx.fill();
    }
    if (wear > 0.5) {
      // agujeros de la lámina carcomida
      ctx.fillStyle = 'rgba(14,10,8,0.8)';
      ctx.beginPath();
      ctx.ellipse(px + pw * 0.6, 2, 4, 2.5, 0.4, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#3a2a1e';
    for (const [rx, ry] of [
      [px + 4, -W / 2 + 5],
      [px + pw - 2, -W / 2 + 5],
      [px + 4, W / 2 - 5],
      [px + pw - 2, W / 2 - 5],
    ])
      ctx.fillRect(rx - 1, ry - 1, 2.5, 2.5);
  }
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-L / 2 + 1, -W / 2 + 2, L - 2, W - 4);
  // pinchos torcidos en dos filas
  ctx.fillStyle = w.hitT > 0 ? '#e0c8b0' : '#b49a82';
  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < 9; i++) {
      const sx = -L / 2 + 8 + i * ((L - 16) / 8) + (r ? 6 : 0);
      if (sx > L / 2 - 4) continue;
      const sy = r ? W / 4 : -W / 4;
      const lean = ((i * 7 + r * 3) % 5) - 2;
      ctx.beginPath();
      ctx.moveTo(sx + lean, sy - 6);
      ctx.lineTo(sx + 3, sy + 4);
      ctx.lineTo(sx - 3, sy + 4);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawMine(ctx, w, time) {
  const cx = w.x + w.w / 2;
  const cy = w.y + w.h / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.arc(cx + 2, cy + 3, 10, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#4a5236';
  ctx.beginPath();
  ctx.arc(cx, cy, 10, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = OUT;
  ctx.stroke();
  ctx.fillStyle = '#6a7050';
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = Math.sin(time * 6 + cx) > 0 ? '#ff5a3a' : '#5a2a20';
  ctx.beginPath();
  ctx.arc(cx, cy, 2, 0, TAU);
  ctx.fill();
}

function drawWire(ctx, w) {
  const { x, y } = w;
  const horiz = w.w > w.h;
  const L = horiz ? w.w : w.h;
  const S = horiz ? w.h : w.w;
  ctx.globalAlpha = 0.5 + 0.5 * (w.hp / w.max);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x, y, w.w, w.h);
  ctx.strokeStyle = w.hitT > 0 ? '#e6e0d2' : '#9a9a92';
  ctx.lineWidth = 1.4;
  for (const off of [0.3, 0.7]) {
    ctx.beginPath();
    for (let t = 0; t <= L; t += 6) {
      const wave = Math.sin(t * 0.55 + off * 9) * S * 0.18;
      const px = horiz ? x + t : x + S * off + wave;
      const py = horiz ? y + S * off + wave : y + t;
      if (t === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.strokeStyle = '#c9c4b6';
  ctx.lineWidth = 1;
  for (let t = 4; t < L; t += 10) {
    const px = horiz ? x + t : x + S * 0.5;
    const py = horiz ? y + S * 0.5 : y + t;
    ctx.beginPath();
    ctx.moveTo(px - 3, py - 3);
    ctx.lineTo(px + 3, py + 3);
    ctx.moveTo(px + 3, py - 3);
    ctx.lineTo(px - 3, py + 3);
    ctx.stroke();
  }
  ctx.fillStyle = '#4a3a2a';
  if (horiz) {
    ctx.fillRect(x, y + S / 2 - 3, 5, 6);
    ctx.fillRect(x + w.w - 5, y + S / 2 - 3, 5, 6);
  } else {
    ctx.fillRect(x + S / 2 - 3, y, 6, 5);
    ctx.fillRect(x + S / 2 - 3, y + w.h - 5, 6, 5);
  }
  ctx.globalAlpha = 1;
}

// Botella de molotov con trapo encendido (dibujada en el origen, apuntando a +x).
export function drawBottle(ctx, lit = true) {
  ctx.fillStyle = 'rgba(120,150,90,0.9)';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(-1, 0, 6, 4, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(200,120,40,0.8)';
  ctx.beginPath();
  ctx.ellipse(-2, 0.5, 4, 2.4, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(120,150,90,0.95)';
  ctx.fillRect(4, -1.6, 4, 3.2);
  ctx.strokeRect(4, -1.6, 4, 3.2);
  ctx.fillStyle = '#d8ccb0';
  ctx.fillRect(8, -1.2, 3, 2.4);
  if (lit) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,170,60,0.9)';
    ctx.beginPath();
    ctx.arc(11.5, 0, 2.6 + Math.random() * 1.4, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
}
