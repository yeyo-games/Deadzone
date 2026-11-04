// Dibujo de las operaciones de alto riesgo (la lógica está en sim/ops.ts): el camión del convoy, el
// nido con sus tres puntos de carga, los cargamentos y el punto de entrega, los puntos que se usan con
// H, las entradas de los refuerzos, las marcas sobre el escenario y las flechas cuando quedan fuera de
// la pantalla. También las piezas de plano: señuelo sonoro y reparador de campo.
import { OPS } from '../core/config.ts';
import { TAU, roundRect } from '../core/util.ts';
import { opsView } from '../sim/ops.ts';
import { OUT } from './sprites.js';
import { carrying, myIdx, nextPoint } from '../ui/ops.js';

const inView = (v, x, y, m) => x > v.x0 - m && x < v.x1 + m && y > v.y0 - m && y < v.y1 + m;

/* ---------- convoy ---------- */

// Camión militar accidentado: cabina, caja con lona, ruedas, daños y humo según su vida; baliza que
// parpadea, componentes (verde si están conectados) y la caja de seguridad con su avance.
function drawTruck(ctx, op, time) {
  const [x, y, w, h] = op.ob;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const L = op.hz ? w : h;
  const W = op.hz ? h : w;
  const hp = op.hp / op.mx;
  ctx.save();
  ctx.translate(cx, cy);
  if (!op.hz) ctx.rotate(Math.PI / 2);
  // un poco ladeado: accidentado
  ctx.rotate(0.05);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(-L / 2 + 6, -W / 2 + 8, L, W);
  // ruedas
  ctx.fillStyle = '#16171a';
  for (const wx of [-L / 2 + 16, -L / 2 + 40, L / 2 - 22])
    for (const s of [-1, 1]) ctx.fillRect(wx - 9, s * (W / 2) - 5 + (s > 0 ? -2 : -3), 18, 10);
  // caja de carga con lona
  const bed = L - 38;
  ctx.fillStyle = '#4c5638';
  ctx.fillRect(-L / 2, -W / 2, bed, W);
  ctx.strokeStyle = 'rgba(20,24,14,0.7)';
  ctx.lineWidth = 2;
  for (let i = 1; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(-L / 2 + (bed * i) / 5, -W / 2);
    ctx.lineTo(-L / 2 + (bed * i) / 5, W / 2);
    ctx.stroke();
  }
  // lona rota
  ctx.fillStyle = '#2c3222';
  ctx.beginPath();
  ctx.moveTo(-L / 2 + bed * 0.45, -W / 2);
  ctx.lineTo(-L / 2 + bed * 0.62, -W / 2 + W * 0.45);
  ctx.lineTo(-L / 2 + bed * 0.7, -W / 2);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = OUT;
  ctx.strokeRect(-L / 2, -W / 2, bed, W);
  // cabina
  ctx.fillStyle = '#5a6644';
  roundRect(ctx, L / 2 - 36, -W / 2 + 3, 36, W - 6, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#9fb6c0';
  ctx.fillRect(L / 2 - 14, -W / 2 + 9, 8, W - 18);
  // parabrisas roto
  ctx.strokeStyle = 'rgba(30,30,30,0.8)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(L / 2 - 13, -6);
  ctx.lineTo(L / 2 - 8, 2);
  ctx.lineTo(L / 2 - 12, 9);
  ctx.stroke();
  // estrella blanca de vehículo militar
  ctx.fillStyle = 'rgba(230,224,210,0.55)';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU - Math.PI / 2;
    const r = i % 2 ? 4 : 9;
    ctx.lineTo(-L / 2 + bed * 0.25 + Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.fill();
  // daños: quemaduras que crecen con el daño
  const dmg = 1 - hp;
  ctx.fillStyle = `rgba(20,16,10,${0.25 + dmg * 0.5})`;
  for (let i = 0; i < Math.round(dmg * 7); i++) {
    const sx = -L / 2 + ((i * 37) % bed);
    const sy = -W / 2 + ((i * 23) % W);
    ctx.beginPath();
    ctx.arc(sx, sy, 6 + (i % 3) * 3, 0, TAU);
    ctx.fill();
  }
  // golpe reciente: chispazo rojo
  if (op.hit) {
    ctx.fillStyle = 'rgba(255,80,60,0.25)';
    ctx.fillRect(-L / 2, -W / 2, L, W);
  }
  // componentes: motor (cabina) y batería (costado)
  const lamp = (lx, ly, on) => {
    ctx.fillStyle = on ? '#6cf08a' : Math.sin(time * 8) > 0 ? '#ff4a3a' : '#5a1a14';
    ctx.beginPath();
    ctx.arc(lx, ly, 4, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  };
  lamp(L / 2 - 26, 0, op.on[0]);
  lamp(-L / 2 + bed / 2 - 16, -W / 2 + 6, op.on[1]);
  // caja de seguridad atrás, con su avance
  const bx = -L / 2 + 8;
  ctx.fillStyle = op.op ? '#7c8a74' : '#6a6e72';
  ctx.fillRect(bx, -12, 24, 24);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2;
  ctx.strokeRect(bx, -12, 24, 24);
  if (op.op) {
    // tapa abierta y el contenido
    ctx.fillStyle = '#3a3e40';
    ctx.fillRect(bx - 10, -12, 10, 24);
    ctx.fillStyle = '#f0c040';
    ctx.fillRect(bx + 6, -5, 12, 10);
  } else {
    const k = op.u > 0 ? op.u / OPS.convoy.unlockT : 0;
    ctx.strokeStyle = op.u < 0 ? '#b5463a' : op.pz ? '#d9a03a' : '#f0d060';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(bx + 12, 0, 7, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0.05, k));
    ctx.stroke();
  }
  // baliza ámbar en el techo de la cabina
  const on = Math.sin(time * 9) > 0.2;
  ctx.fillStyle = on ? '#ffb030' : '#6a4a10';
  ctx.beginPath();
  ctx.arc(L / 2 - 26, -W / 2 + 10, 4, 0, TAU);
  ctx.fill();
  if (on) {
    ctx.fillStyle = 'rgba(255,176,48,0.25)';
    ctx.beginPath();
    ctx.arc(L / 2 - 26, -W / 2 + 10, 14, 0, TAU);
    ctx.fill();
  }
  // humo del motor (más con más daño) y llamas si está muy dañado
  const puffs = 3 + Math.round(dmg * 5);
  for (let i = 0; i < puffs; i++) {
    const k = (time * 0.35 + i / puffs) % 1;
    ctx.fillStyle = `rgba(70,70,66,${0.42 * (1 - k)})`;
    ctx.beginPath();
    ctx.arc(L / 2 - 20 + k * 26 + Math.sin(time + i) * 4, -k * 34 + Math.cos(time * 0.7 + i) * 3, 6 + k * 14, 0, TAU);
    ctx.fill();
  }
  if (hp < 0.3) {
    for (let i = 0; i < 3; i++) {
      const k = (time * 1.6 + i / 3) % 1;
      ctx.fillStyle = `rgba(255,${160 - k * 100},40,${0.8 * (1 - k)})`;
      ctx.beginPath();
      ctx.arc(L / 2 - 30 + i * 8, -k * 18, 5 * (1 - k * 0.5), 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

/* ---------- nido ---------- */

const MARKS = ['pillar', 'root', 'sac'];

// El nido: masa orgánica con venas que late (más rápido con cada carga), sus agujeros y los tres puntos
// estructurales (pilar, raíz y saco), cada uno con la marca de dónde va la carga.
function drawNest(ctx, op, time) {
  if (op.bl) {
    ctx.fillStyle = 'rgba(16,12,10,0.8)';
    ctx.beginPath();
    ctx.arc(op.x, op.y, op.core * 1.3, 0, TAU);
    ctx.fill();
    return;
  }
  const act = 1 + op.n * 0.7 + (op.fu >= 0 ? 2 : 0);
  const beat = 1 + Math.sin(time * 2.4 * act) * 0.03 * act;
  // área de la explosión: tenue mientras se prepara, roja y latiendo en la cuenta atrás
  ctx.save();
  ctx.lineWidth = 3;
  if (op.fu >= 0) {
    const k = 0.25 + 0.2 * Math.abs(Math.sin(time * 7));
    ctx.fillStyle = `rgba(200,40,30,${k * 0.45})`;
    ctx.beginPath();
    ctx.arc(op.x, op.y, op.R, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = `rgba(255,70,50,${0.6 + k})`;
  } else ctx.strokeStyle = 'rgba(217,120,58,0.35)';
  ctx.setLineDash([14, 10]);
  ctx.lineDashOffset = -time * 20;
  ctx.beginPath();
  ctx.arc(op.x, op.y, op.R, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  // la masa
  ctx.save();
  ctx.translate(op.x, op.y);
  ctx.scale(beat, beat);
  const r = op.core;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.arc(6, 8, r, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * TAU;
    const rr = r * (0.86 + 0.1 * Math.sin(a * 5 + 1.3) + 0.04 * Math.sin(time * 1.5 + a * 3));
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = '#3e2630';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = OUT;
  ctx.stroke();
  ctx.fillStyle = '#5c3440';
  ctx.beginPath();
  ctx.arc(-r * 0.15, -r * 0.18, r * 0.6, 0, TAU);
  ctx.fill();
  // venas que brillan con la actividad
  ctx.strokeStyle = `rgba(190,90,${120 + op.n * 30},${0.35 + 0.12 * op.n + 0.15 * Math.sin(time * 3 * act)})`;
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + 0.4;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.2, Math.sin(a) * r * 0.2);
    ctx.quadraticCurveTo(Math.cos(a + 0.4) * r * 0.6, Math.sin(a + 0.4) * r * 0.6, Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92);
    ctx.stroke();
  }
  // el ojo de en medio (señal de que necesita explosivos, no balas)
  ctx.fillStyle = '#c8a040';
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.2, r * 0.12 * (0.6 + 0.4 * Math.abs(Math.sin(time * 0.8))), 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#1a0a0c';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.06, 0, TAU);
  ctx.fill();
  ctx.restore();
  // agujeros por donde salen infectados
  for (const [hx, hy] of op.ho || []) {
    ctx.fillStyle = '#120a0c';
    ctx.beginPath();
    ctx.ellipse(hx, hy, 16, 12, Math.atan2(hy - op.y, hx - op.x), 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#5c3440';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  // puntos de carga: pilar, raíz y saco, con la marca (o la carga puesta)
  (op.pts || []).forEach(([px, py, done], i) => {
    const kind = MARKS[i % 3];
    ctx.save();
    ctx.translate(px, py);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(-12, -6, 28, 22);
    if (kind === 'pillar') {
      ctx.fillStyle = '#7a7670';
      ctx.fillRect(-11, -14, 22, 26);
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 2;
      ctx.strokeRect(-11, -14, 22, 26);
      ctx.strokeStyle = 'rgba(30,30,30,0.6)';
      ctx.beginPath();
      ctx.moveTo(-6, -14);
      ctx.lineTo(2, 2);
      ctx.lineTo(-3, 12);
      ctx.stroke();
    } else if (kind === 'root') {
      ctx.fillStyle = '#5a3a2a';
      ctx.beginPath();
      ctx.moveTo(-15, 12);
      ctx.quadraticCurveTo(-4, -18, 15, -10);
      ctx.quadraticCurveTo(2, -4, 6, 12);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.fillStyle = `rgba(150,${90 + 20 * Math.sin(time * 4)},110,1)`;
      ctx.beginPath();
      ctx.ellipse(0, 0, 13, 11, 0.3, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    if (done) {
      // carga puesta: bloque gris con cables y luz roja que parpadea
      ctx.fillStyle = '#8a8f80';
      ctx.fillRect(-8, -6, 16, 11);
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-8, -6, 16, 11);
      ctx.strokeStyle = '#d24a32';
      ctx.beginPath();
      ctx.moveTo(-8, 0);
      ctx.lineTo(-13, 6);
      ctx.stroke();
      ctx.fillStyle = Math.sin(time * (op.fu >= 0 ? 16 : 6)) > 0 ? '#ff3a2a' : '#4a0e0a';
      ctx.beginPath();
      ctx.arc(4, -1, 2.5, 0, TAU);
      ctx.fill();
    } else {
      // marca de peligro: aquí va una carga
      ctx.strokeStyle = 'rgba(240,200,60,0.85)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.lineDashOffset = -time * 12;
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  });
}

/* ---------- suministros ---------- */

// Caja militar con plantilla blanca y cuerdas (el del sitio estrecho, de metal).
export function drawCrate(ctx, x, y, tier, s = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(-14, -9, 32, 24);
  ctx.fillStyle = tier === 2 ? '#5c6670' : '#5a6236';
  ctx.fillRect(-16, -12, 32, 24);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2;
  ctx.strokeRect(-16, -12, 32, 24);
  ctx.strokeStyle = 'rgba(30,26,16,0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-16, 0);
  ctx.lineTo(16, 0);
  ctx.moveTo(-6, -12);
  ctx.lineTo(-6, 12);
  ctx.stroke();
  ctx.fillStyle = 'rgba(235,230,215,0.85)';
  ctx.fillRect(2, -8, 9, 3);
  ctx.fillRect(5, -11, 3, 9);
  ctx.restore();
}

function drawDrop(ctx, op, time) {
  const [x, y, r] = op.dz;
  ctx.save();
  ctx.fillStyle = 'rgba(134,168,146,0.12)';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(134,200,150,0.75)';
  ctx.lineWidth = 3;
  ctx.setLineDash([16, 10]);
  ctx.lineDashOffset = time * 18;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  // tarima y luces de aterrizaje
  ctx.fillStyle = '#6a5436';
  ctx.fillRect(x - 26, y - 26, 52, 52);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 26, y - 26, 52, 52);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4;
    ctx.fillStyle = Math.sin(time * 5 + i * 1.6) > 0 ? '#9cf0a8' : '#2a4a30';
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * (r - 8), y + Math.sin(a) * (r - 8), 4, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/* ---------- comunes ---------- */

// Punto que se usa con H: anillo amarillo con su avance.
function drawSpot(ctx, s, time) {
  const [x, y, , prog] = s;
  ctx.save();
  ctx.strokeStyle = `rgba(240,208,96,${0.55 + 0.3 * Math.sin(time * 4)})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 18, 0, TAU);
  ctx.stroke();
  if (prog > 0) {
    ctx.strokeStyle = '#9cf0a8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, 18, -Math.PI / 2, -Math.PI / 2 + TAU * (prog / 100));
    ctx.stroke();
  }
  ctx.restore();
}

// Entrada de refuerzos anunciada: flechas rojas en el suelo que apuntan al objetivo.
function drawEntry(ctx, x, y, tx, ty, time) {
  const a = Math.atan2(ty - y, tx - x);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  for (let i = 0; i < 3; i++) {
    const k = (time * 0.9 + i / 3) % 1;
    ctx.strokeStyle = `rgba(230,70,50,${0.85 * (1 - k)})`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-10 + k * 60, -16);
    ctx.lineTo(6 + k * 60, 0);
    ctx.lineTo(-10 + k * 60, 16);
    ctx.stroke();
  }
  ctx.restore();
}

/** En el suelo (antes de los zombis): todo lo de la operación. */
export function drawOpsGround(ctx, game, time) {
  const v = opsView(game);
  const op = v && v.op;
  if (!op || op.s === 'resolve') return;
  const view = game.view;
  if (op.k === 'supply') {
    if (inView(view, op.dz[0], op.dz[1], op.dz[2] + 40)) drawDrop(ctx, op, time);
    for (const [, x, y, by, dl, tier] of op.cr || []) {
      if (by >= 0 || !inView(view, x, y, 40)) continue;
      if (!dl) {
        // entre restos: manchas oscuras debajo
        ctx.fillStyle = 'rgba(60,12,10,0.45)';
        ctx.beginPath();
        ctx.ellipse(x + 10, y + 14, 26, 12, 0.4, 0, TAU);
        ctx.fill();
      }
      drawCrate(ctx, x, y, tier);
    }
    if (op.an) drawEntry(ctx, op.an[0], op.an[1], op.dz[0], op.dz[1], time);
  } else if (op.k === 'convoy') {
    if (inView(view, op.x, op.y, 200)) drawTruck(ctx, op, time);
  } else if (inView(view, op.x, op.y, op.R + 40)) drawNest(ctx, op, time);
  for (const s of op.sp || []) if (inView(view, s[0], s[1], 30)) drawSpot(ctx, s, time);
  for (const [x, y] of op.en || []) if (inView(view, x, y, 60)) drawEntry(ctx, x, y, op.x, op.y, time);
}

/** Encima de los jugadores: el cargamento que lleva cada uno (en el robot, a la espalda). */
export function drawOpsCarried(ctx, game, time) {
  const v = opsView(game);
  const op = v && v.op;
  if (!op || op.k !== 'supply') return;
  const me = myIdx(game);
  for (const [, x, y, by, dl, tier, robot] of op.cr || []) {
    if (by < 0 || dl) continue;
    // el propio se dibuja donde está ahora (no donde lo vio el servidor)
    const p = by === me ? game.player : null;
    const px = p ? p.x : x;
    const py = p ? p.y : y;
    const up = robot ? 30 : 24;
    drawCrate(ctx, px, py - up, tier, robot ? 0.9 : 0.62);
    // indicador encima del que lo lleva
    const b = Math.sin(time * 5) * 3;
    ctx.fillStyle = '#9cf0a8';
    ctx.beginPath();
    ctx.moveTo(px - 7, py - up - 22 + b);
    ctx.lineTo(px + 7, py - up - 22 + b);
    ctx.lineTo(px, py - up - 13 + b);
    ctx.closePath();
    ctx.fill();
  }
}

// Marca sobre el objetivo: rombo que flota y la distancia.
function marker(ctx, x, y, time, col, z) {
  const b = Math.sin(time * 3) * 4;
  const s = 1 / Math.max(0.6, z);
  ctx.save();
  ctx.translate(x, y - 46 * s + b);
  ctx.scale(s, s);
  ctx.fillStyle = col;
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -11);
  ctx.lineTo(9, 0);
  ctx.lineTo(0, 11);
  ctx.lineTo(-9, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** Después de la luz (en el mundo): marcas, barra del camión, cuenta atrás y alcance del reparador. */
export function drawOpsUi(ctx, game, time) {
  const v = opsView(game);
  const op = v && v.op;
  const p = game.player;
  // alcance del reparador de campo cerca del jugador
  if (p && p.alive) {
    for (const b of game.structures.blocks) {
      if (b.kind !== 'repair' || Math.hypot(b.x + 20 - p.x, b.y + 20 - p.y) > 160) continue;
      ctx.strokeStyle = 'rgba(240,176,64,0.4)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.arc(b.x + b.w / 2, b.y + b.h / 2, OPS.plans.repair.range, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  if (!op || op.s === 'resolve') return;
  const z = game.base.z / game.dpr;
  const np = nextPoint(game, v);
  if (np) marker(ctx, np.x, np.y, time, np.exit ? '#9cf0a8' : '#f0c040', z);
  if (op.k === 'convoy') {
    const [x, y, w] = op.ob;
    const k = op.hp / op.mx;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(x - 1, y - 16, w + 2, 8);
    ctx.fillStyle = k > 0.5 ? '#86c08e' : k > 0.25 ? '#e0a040' : '#e0503a';
    ctx.fillRect(x, y - 15, w * k, 6);
  }
  if (op.k === 'nest' && op.fu >= 0 && !op.bl) {
    ctx.save();
    ctx.font = `700 ${Math.round(48 / Math.max(0.6, z))}px Teko, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffdcd0';
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 5;
    const t = op.fu.toFixed(1);
    ctx.strokeText(t, op.x, op.y - op.core - 18);
    ctx.fillText(t, op.x, op.y - op.core - 18);
    ctx.restore();
  }
}

/** En la pantalla: flechas en la orilla hacia el siguiente punto, las entradas abiertas y la salida. */
export function drawOpsArrows(game, ctx, W, H) {
  const v = opsView(game);
  const op = v && v.op;
  if (!op || op.s === 'resolve' || !game.player) return;
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
  for (const [x, y] of op.en || []) arrow(x, y, 'rgba(230,70,50,0.85)', false);
  if (op.an) arrow(op.an[0], op.an[1], 'rgba(230,70,50,0.95)', false);
  const np = nextPoint(game, v);
  if (np) arrow(np.x, np.y, np.exit ? 'rgba(156,240,168,0.95)' : 'rgba(240,192,64,0.95)', true);
  // también hacia el compañero que lleva un cargamento si yo no llevo
  if (op.k === 'supply' && !carrying(game, v)) {
    const me = myIdx(game);
    for (const c of op.cr || []) if (c[3] >= 0 && c[3] !== me && !c[4]) arrow(c[1], c[2], 'rgba(156,240,168,0.6)', false);
  }
}

/* ---------- piezas de plano (las llama drawBlock en build.js) ---------- */

// Señuelo sonoro: caja con altavoz; sonando, ondas y luz roja.
export function drawDecoy(ctx, b) {
  const { x, y, w, h } = b;
  const t = performance.now() / 1000;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(x + 5, y + 6, w, h);
  ctx.fillStyle = '#3a3e40';
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
  ctx.fillStyle = '#1c1e20';
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2 + 2, 12, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#6a6e70';
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2 + 2, 5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = b.up ? (Math.sin(t * 12) > 0 ? '#ff3a2a' : '#5a0e0a') : '#3a4a3a';
  ctx.fillRect(x + w / 2 - 3, y + 5, 6, 4);
  if (!b.up) return;
  for (let i = 0; i < 3; i++) {
    const k = (t * 0.8 + i / 3) % 1;
    ctx.strokeStyle = `rgba(255,120,90,${0.6 * (1 - k)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, 22 + k * 120, 0, TAU);
    ctx.stroke();
  }
}

// Reparador de campo: caja de herramientas con una llave y tres luces (cargas que quedan).
export function drawRepair(ctx, b) {
  const { x, y, w, h } = b;
  const used = (b.up || 0) & 3;
  const cd = (b.up || 0) >> 2;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(x + 5, y + 6, w, h);
  ctx.fillStyle = '#c0702a';
  ctx.fillRect(x + 2, y + 6, w - 4, h - 8);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 2, y + 6, w - 4, h - 8);
  ctx.strokeStyle = '#3a2a18';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 13, y + 7);
  ctx.lineTo(x + 13, y + 2);
  ctx.lineTo(x + w - 13, y + 2);
  ctx.lineTo(x + w - 13, y + 7);
  ctx.stroke();
  // llave inglesa
  ctx.strokeStyle = '#d8d4c8';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(x + 11, y + h - 9);
  ctx.lineTo(x + w - 13, y + 15);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + w - 11, y + 13, 4, 0, TAU);
  ctx.stroke();
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i < OPS.plans.repair.charges - used ? (cd ? '#6a7a50' : '#9cf0a8') : '#2a2a26';
    ctx.fillRect(x + 8 + i * 9, y + h - 8, 6, 4);
  }
}
