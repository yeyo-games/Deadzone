// Dibujo del mapa de ruta del modo Huida (los datos están en sim/route.ts; la pantalla en ui/route.js):
// un mapa táctico oscuro con cuadrícula, curvas de nivel, la ciudad al principio y un río con el puente al
// final; las carreteras entre paradas (con su raya amarilla), las insignias de cada parada con su icono,
// la ronda especial que trae, y la camioneta que viaja de una parada a otra levantando polvo.
import { ESCAPE_STOPS, EVENTS } from '../core/config.ts';
import { TAU, mulberry32, roundRect } from '../core/util.ts';

/** Color de la etiqueta de cada ronda especial. */
const MOD_COL = {
  fog: '#b8bcb4',
  blackout: '#6d7fae',
  stampede: '#f09040',
  golden: '#f0c440',
  siege: '#7fa6c8',
  blood: '#e04848',
};

/** Dónde queda cada parada en el lienzo (horizontal en pantallas anchas, de abajo hacia arriba en las altas). */
export function routeLayout(route, w, h) {
  const horiz = w >= h * 1.1;
  const mx = horiz ? Math.min(90, w * 0.08) : Math.min(60, w * 0.12);
  const my = horiz ? Math.min(70, h * 0.12) : Math.min(80, h * 0.08);
  const pos = route.nodes.map((n) =>
    horiz
      ? { x: mx + n.x * (w - 2 * mx), y: my + n.y * (h - 2 * my) }
      : { x: mx + n.y * (w - 2 * mx), y: h - my - n.x * (h - 2 * my) },
  );
  const r = Math.max(15, Math.min(26, Math.min(w, h) * 0.045));
  return { horiz, pos, r, w, h };
}

/** La parada bajo el punto (px, py) del lienzo, o -1. */
export function routeHit(L, px, py) {
  let best = -1;
  let bd = (L.r * 1.6) ** 2;
  L.pos.forEach((p, i) => {
    const d = (p.x - px) ** 2 + (p.y - py) ** 2;
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return best;
}

// Control de la curva de una carretera (sale y llega "de frente" según la dirección del mapa).
function curve(L, a, b) {
  const k = 0.45;
  return L.horiz
    ? [a.x + (b.x - a.x) * k, a.y, b.x - (b.x - a.x) * k, b.y]
    : [a.x, a.y + (b.y - a.y) * k, b.x, b.y - (b.y - a.y) * k];
}

/** Punto y dirección de la carretera a→b en t (0..1). */
export function roadAt(L, a, b, t) {
  const [c1x, c1y, c2x, c2y] = curve(L, a, b);
  const u = 1 - t;
  const x = u * u * u * a.x + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * b.x;
  const y = u * u * u * a.y + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * b.y;
  const dx = 3 * u * u * (c1x - a.x) + 6 * u * t * (c2x - c1x) + 3 * t * t * (b.x - c2x);
  const dy = 3 * u * u * (c1y - a.y) + 6 * u * t * (c2y - c1y) + 3 * t * t * (b.y - c2y);
  return { x, y, a: Math.atan2(dy, dx) };
}

function roadPath(ctx, L, a, b) {
  const [c1x, c1y, c2x, c2y] = curve(L, a, b);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.bezierCurveTo(c1x, c1y, c2x, c2y, b.x, b.y);
}

/* ---------- el fondo ---------- */

// Fondo del mapa (se guarda: sólo cambia si cambia el tamaño o la ruta).
let BG = null;
function background(route, L, dpr) {
  const key = `${route.seed}|${L.w}|${L.h}|${dpr}`;
  if (BG && BG.key === key) return BG.c;
  const c = document.createElement('canvas');
  c.width = Math.round(L.w * dpr);
  c.height = Math.round(L.h * dpr);
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  const rng = mulberry32(route.seed ^ 0x5eed);
  const { w, h } = L;
  // papel oscuro con viñeta
  const gr = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.1, w / 2, h / 2, Math.max(w, h) * 0.75);
  gr.addColorStop(0, '#1d2117');
  gr.addColorStop(1, '#0c0e0a');
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
  // grano
  for (let i = 0; i < (w * h) / 90; i++) {
    g.fillStyle = rng() < 0.5 ? 'rgba(230,224,210,0.025)' : 'rgba(0,0,0,0.12)';
    g.fillRect(rng() * w, rng() * h, 1.2, 1.2);
  }
  // cuadrícula
  g.strokeStyle = 'rgba(230,224,210,0.045)';
  g.lineWidth = 1;
  for (let x = 0; x < w; x += 40) {
    g.beginPath();
    g.moveTo(x + 0.5, 0);
    g.lineTo(x + 0.5, h);
    g.stroke();
  }
  for (let y = 0; y < h; y += 40) {
    g.beginPath();
    g.moveTo(0, y + 0.5);
    g.lineTo(w, y + 0.5);
    g.stroke();
  }
  // curvas de nivel: anillos deformados alrededor de unas colinas
  g.strokeStyle = 'rgba(134,168,120,0.09)';
  for (let k = 0; k < 4; k++) {
    const cx = (0.25 + rng() * 0.6) * w;
    const cy = (0.15 + rng() * 0.7) * h;
    const ph = rng() * 10;
    for (let ring = 1; ring <= 5; ring++) {
      const R = ring * Math.min(w, h) * 0.05;
      g.beginPath();
      for (let i = 0; i <= 48; i++) {
        const a = (i / 48) * TAU;
        const rr = R * (1 + 0.18 * Math.sin(a * 3 + ph) + 0.1 * Math.sin(a * 5 - ph * 2));
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr * 0.75;
        if (i) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
      g.stroke();
    }
  }
  // la ciudad alrededor de la salida: manzanas
  const s = L.pos[0];
  g.fillStyle = 'rgba(230,224,210,0.05)';
  for (let i = 0; i < 70; i++) {
    const a = rng() * TAU;
    const d = rng() * Math.min(w, h) * 0.2;
    const bw = 6 + rng() * 14;
    const bh = 6 + rng() * 14;
    g.fillRect(s.x + Math.cos(a) * d - bw / 2, s.y + Math.sin(a) * d - bh / 2, bw, bh);
  }
  // el río junto al puente
  const e = L.pos[L.pos.length - 1];
  g.strokeStyle = 'rgba(70,110,140,0.35)';
  g.lineWidth = Math.max(14, Math.min(w, h) * 0.05);
  g.lineCap = 'round';
  g.beginPath();
  if (L.horiz) {
    const x0 = e.x - 4;
    g.moveTo(x0 + 30, -20);
    g.bezierCurveTo(x0 - 40, h * 0.3, x0 + 40, h * 0.7, x0 - 20, h + 20);
  } else {
    const y0 = e.y + 4;
    g.moveTo(-20, y0 - 30);
    g.bezierCurveTo(w * 0.3, y0 + 40, w * 0.7, y0 - 40, w + 20, y0 + 20);
  }
  g.stroke();
  g.strokeStyle = 'rgba(150,190,220,0.12)';
  g.lineWidth = 2;
  g.stroke();
  BG = { key, c };
  return c;
}

/* ---------- iconos de las paradas (en una caja de 24 px) ---------- */

function icon(ctx, kind, col) {
  ctx.strokeStyle = col;
  ctx.fillStyle = col;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  switch (kind) {
    case 'start':
      // edificios
      ctx.rect(-10, -2, 6, 12);
      ctx.rect(-3, -9, 7, 19);
      ctx.rect(5, -5, 5, 15);
      ctx.stroke();
      break;
    case 'gas':
      // surtidor con manguera
      roundRect(ctx, -9, -10, 12, 20, 2);
      ctx.stroke();
      ctx.fillRect(-6, -7, 6, 5);
      ctx.beginPath();
      ctx.moveTo(3, -5);
      ctx.lineTo(8, -1);
      ctx.lineTo(8, 7);
      ctx.lineTo(5, 9);
      ctx.stroke();
      break;
    case 'clinic':
      ctx.fillRect(-3, -10, 6, 20);
      ctx.fillRect(-10, -3, 20, 6);
      break;
    case 'police': {
      // escudo con estrella
      ctx.moveTo(0, -11);
      ctx.lineTo(9, -7);
      ctx.lineTo(8, 3);
      ctx.quadraticCurveTo(5, 9, 0, 11);
      ctx.quadraticCurveTo(-5, 9, -8, 3);
      ctx.lineTo(-9, -7);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU - Math.PI / 2;
        const r = i % 2 ? 2 : 4.5;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.fill();
      break;
    }
    case 'market':
      // carrito
      ctx.moveTo(-11, -8);
      ctx.lineTo(-7, -8);
      ctx.lineTo(-4, 5);
      ctx.lineTo(8, 5);
      ctx.lineTo(10, -4);
      ctx.lineTo(-6, -4);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-2, 9, 2, 0, TAU);
      ctx.arc(6, 9, 2, 0, TAU);
      ctx.fill();
      break;
    case 'homes':
      // casa
      ctx.moveTo(-10, -1);
      ctx.lineTo(0, -10);
      ctx.lineTo(10, -1);
      ctx.moveTo(-7, -3);
      ctx.lineTo(-7, 9);
      ctx.lineTo(7, 9);
      ctx.lineTo(7, -3);
      ctx.stroke();
      ctx.fillRect(-2, 3, 4, 6);
      break;
    case 'bridge':
      // arco del puente
      ctx.moveTo(-12, 4);
      ctx.lineTo(12, 4);
      ctx.moveTo(-10, 4);
      ctx.quadraticCurveTo(0, -12, 10, 4);
      ctx.moveTo(-5, 4);
      ctx.lineTo(-5, -3);
      ctx.moveTo(0, 4);
      ctx.lineTo(0, -5);
      ctx.moveTo(5, 4);
      ctx.lineTo(5, -3);
      ctx.stroke();
      break;
  }
}

/* ---------- la camioneta en miniatura ---------- */

/** Camioneta vista desde arriba, del tamaño de una insignia (s = largo en px), mirando hacia `a`. */
export function drawVanMini(ctx, x, y, a, s) {
  const L = s;
  const W = s * 0.5;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  roundRect(ctx, -L / 2 + 2, -W / 2 + 3, L, W, W * 0.25);
  ctx.fill();
  ctx.fillStyle = '#3d6a70';
  ctx.strokeStyle = '#0d0f0b';
  ctx.lineWidth = 1.5;
  roundRect(ctx, -L / 2, -W / 2, L, W, W * 0.25);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#7fa3b4';
  ctx.fillRect(L * 0.08, -W / 2 + 2, L * 0.1, W - 4);
  ctx.fillStyle = '#4a7a80';
  ctx.fillRect(-L * 0.42, -W / 2 + 2, L * 0.46, W - 4);
  ctx.fillStyle = '#b8342a';
  ctx.fillRect(-L * 0.2, -W * 0.3, L * 0.12, W * 0.25);
  ctx.fillStyle = '#18191b';
  ctx.beginPath();
  ctx.arc(-L * 0.3, 0, W * 0.2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fff6c8';
  ctx.fillRect(L / 2 - 3, -W / 2 + 2, 2, 3);
  ctx.fillRect(L / 2 - 3, W / 2 - 5, 2, 3);
  ctx.restore();
}

/* ---------- el mapa ---------- */

/**
 * Dibuja el mapa. st: { at, visited, sel, hover, t, travel: { to, k } | null, puffs }.
 * Devuelve el acomodo (para saber qué parada se toca).
 */
export function drawRoute(ctx, route, w, h, dpr, st) {
  const L = routeLayout(route, w, h);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.drawImage(background(route, L, dpr), 0, 0, w, h);
  const nodes = route.nodes;
  const cur = nodes[st.at];
  const avail = new Set(cur ? cur.next : []);
  const visited = new Set(st.visited);
  const pathEdges = new Set();
  for (let i = 1; i < st.visited.length; i++) pathEdges.add(`${st.visited[i - 1]}>${st.visited[i]}`);
  const t = st.t;
  // carreteras: primero las de más atrás (apagadas), luego las que puedes tomar y el camino recorrido
  const drawRoad = (a, b, mode) => {
    const A = L.pos[a.id];
    const B = L.pos[b.id];
    const alpha = mode === 'dim' ? 0.32 : 1;
    ctx.globalAlpha = alpha;
    roadPath(ctx, L, A, B);
    ctx.strokeStyle = '#090a07';
    ctx.lineWidth = L.r * 0.62;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.strokeStyle = mode === 'path' ? '#5a4a2a' : '#3a3a33';
    ctx.lineWidth = L.r * 0.42;
    ctx.stroke();
    ctx.setLineDash([L.r * 0.3, L.r * 0.32]);
    ctx.lineDashOffset = mode === 'next' ? -t * 30 : 0;
    ctx.strokeStyle = mode === 'path' ? '#f0c440' : mode === 'next' ? 'rgba(240,196,64,0.9)' : 'rgba(240,196,64,0.4)';
    ctx.lineWidth = mode === 'path' ? 2.4 : 1.6;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  };
  for (const a of nodes)
    for (const id of a.next) {
      const key = `${a.id}>${id}`;
      if (pathEdges.has(key) || (a.id === st.at && avail.has(id))) continue;
      drawRoad(a, nodes[id], 'dim');
    }
  for (const key of pathEdges) {
    const [a, b] = key.split('>').map(Number);
    drawRoad(nodes[a], nodes[b], 'path');
  }
  if (cur)
    for (const id of cur.next) {
      // la que elegiste brilla más
      if (id === st.sel && !st.travel) {
        ctx.save();
        ctx.shadowColor = 'rgba(240,196,64,0.8)';
        ctx.shadowBlur = 14;
        drawRoad(cur, nodes[id], 'next');
        ctx.restore();
      } else drawRoad(cur, nodes[id], 'next');
    }
  // polvo de la camioneta en viaje
  for (const p of st.puffs || []) {
    ctx.globalAlpha = Math.max(0, p.life) * 0.5;
    ctx.fillStyle = '#b8a888';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * (1.6 - p.life), 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // paradas
  for (const n of nodes) {
    const P = L.pos[n.id];
    const def = ESCAPE_STOPS[n.kind];
    const isCur = n.id === st.at;
    const isAvail = avail.has(n.id) && !st.travel;
    const isSel = n.id === st.sel;
    const done = visited.has(n.id) && !isCur;
    const locked = !isCur && !done && !avail.has(n.id);
    const big = n.kind === 'bridge' || n.kind === 'start' ? 1.2 : 1;
    const pulse = isAvail ? 1 + 0.06 * Math.sin(t * 5 + n.id) : 1;
    const R = L.r * big * pulse * (isSel ? 1.12 : 1);
    ctx.save();
    ctx.translate(P.x, P.y);
    ctx.globalAlpha = locked ? 0.5 : 1;
    // halo de las que puedes elegir y de donde estás
    if (isAvail || isCur) {
      const hg = ctx.createRadialGradient(0, 0, R * 0.6, 0, 0, R * 2.1);
      hg.addColorStop(0, isCur ? 'rgba(156,240,168,0.35)' : `rgba(240,196,64,${isSel ? 0.45 : 0.22})`);
      hg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(0, 0, R * 2.1, 0, TAU);
      ctx.fill();
    }
    // insignia: disco oscuro con el anillo del color de su tipo
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.arc(2, 3, R, 0, TAU);
    ctx.fill();
    ctx.fillStyle = done ? '#1a1c16' : '#161912';
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, TAU);
    ctx.fill();
    ctx.lineWidth = Math.max(2.5, R * 0.14);
    ctx.strokeStyle = done ? '#5a5a50' : def.col;
    ctx.stroke();
    if (isSel && isAvail) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#fff6d8';
      ctx.beginPath();
      ctx.arc(0, 0, R + 5, 0, TAU);
      ctx.stroke();
    }
    ctx.save();
    const k = R / 16;
    ctx.scale(k, k);
    icon(ctx, n.kind, done ? '#7a7a70' : def.col);
    ctx.restore();
    // recorrida: una palomita
    if (done) {
      ctx.fillStyle = '#86c08e';
      ctx.beginPath();
      ctx.arc(R * 0.72, -R * 0.72, R * 0.36, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#0d0f0b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(R * 0.56, -R * 0.72);
      ctx.lineTo(R * 0.7, -R * 0.58);
      ctx.lineTo(R * 0.9, -R * 0.88);
      ctx.stroke();
    }
    // ronda especial: una etiqueta pegada arriba a la derecha de la insignia
    if (n.mod && !done && !isCur) {
      const ev = EVENTS.types[n.mod];
      const txt = ev.tag.toUpperCase();
      const fs = Math.round(Math.max(10, R * 0.56));
      ctx.font = `600 ${fs}px Teko, sans-serif`;
      const tw = ctx.measureText(txt).width + 9;
      const th = fs * 1.15;
      const tx = R * 0.55;
      const ty = -R * 1.05 - th / 2;
      ctx.fillStyle = 'rgba(10,10,8,0.92)';
      roundRect(ctx, tx, ty, tw, th, 3);
      ctx.fill();
      ctx.strokeStyle = MOD_COL[n.mod] || '#ccc';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = MOD_COL[n.mod] || '#ccc';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(txt, tx + 4.5, ty + th / 2 + 1);
    }
    // votos de los compañeros (en línea): una insignia con el número
    const nv = st.votes?.[n.id] || 0;
    if (nv && isAvail) {
      ctx.fillStyle = '#86c08e';
      ctx.strokeStyle = '#0d0f0b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(-R * 0.8, -R * 0.8, R * 0.42, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#0d0f0b';
      ctx.font = `700 ${Math.round(R * 0.6)}px Teko, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(nv), -R * 0.8, -R * 0.78);
    }
    // nombre del tipo debajo
    ctx.font = `600 ${Math.round(R * (isSel ? 0.78 : 0.68))}px Teko, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    const label = def.name.toUpperCase();
    ctx.strokeText(label, 0, R + 5);
    ctx.fillStyle = isSel && isAvail ? '#fff6d8' : done ? '#8a887e' : '#e6e0d2';
    ctx.fillText(label, 0, R + 5);
    ctx.restore();
  }
  // la camioneta: en la parada actual o viajando por la carretera elegida
  if (cur) {
    // quieta: encima de la parada (en el mapa vertical, a su izquierda, para no tapar la de arriba)
    let vx = L.pos[cur.id].x - (L.horiz ? 0 : L.r * 2.2);
    let vy = L.pos[cur.id].y - (L.horiz ? L.r * 1.25 : 0);
    let va = L.horiz ? 0 : -Math.PI / 2;
    if (st.travel) {
      const tt = st.travel.k;
      const e = tt < 0.5 ? 2 * tt * tt : 1 - (-2 * tt + 2) ** 2 / 2;
      const q = roadAt(L, L.pos[cur.id], L.pos[st.travel.to], e);
      vx = q.x;
      vy = q.y;
      va = q.a;
    }
    drawVanMini(ctx, vx, vy + (st.travel ? 0 : Math.sin(t * 3) * 1.5), va, L.r * 1.5);
  }
  // rosa de los vientos
  const cx = w - 34;
  const cy = 34;
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = '#e6e0d2';
  ctx.fillStyle = '#e6e0d2';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, 16, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy - 20);
  ctx.lineTo(cx + 5, cy);
  ctx.lineTo(cx, cy + 4);
  ctx.lineTo(cx - 5, cy);
  ctx.closePath();
  ctx.fill();
  ctx.font = '600 11px Teko, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('N', cx, cy - 21);
  ctx.globalAlpha = 1;
  return L;
}

/**
 * Ilustración de una parada para la tarjeta del mapa: su icono en grande sobre un resplandor de su color,
 * y encima el efecto de su ronda especial (niebla, apagón, estampida, dorados, asedio o luna de sangre).
 */
export function drawStopArt(ctx, w, h, dpr, kind, mod, t) {
  const def = ESCAPE_STOPS[kind];
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2;
  const cy = h / 2;
  // fondo: cuadrícula y resplandor del color del tipo
  ctx.fillStyle = '#0f110c';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(230,224,210,0.05)';
  ctx.lineWidth = 1;
  for (let x = (t * 8) % 16; x < w; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += 16) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
    ctx.stroke();
  }
  const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, h * 0.75);
  g.addColorStop(0, `${def.col}55`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // anillos que se abren
  for (let i = 0; i < 2; i++) {
    const k = (t * 0.5 + i / 2) % 1;
    ctx.strokeStyle = `${def.col}${Math.round((1 - k) * 90)
      .toString(16)
      .padStart(2, '0')}`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, h * 0.22 + k * h * 0.3, 0, TAU);
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(cx, cy);
  const s = (h * 0.32) / 12;
  ctx.scale(s, s);
  ctx.shadowColor = def.col;
  ctx.shadowBlur = 10;
  icon(ctx, kind, def.col);
  ctx.restore();
  // la ronda especial encima
  const rng = mulberry32(7);
  if (mod === 'fog') {
    for (let i = 0; i < 6; i++) {
      const x = ((rng() * w + t * 12 * (i % 2 ? 1 : -1)) % (w + 80)) - 40;
      const fg = ctx.createRadialGradient(x, rng() * h, 4, x, rng() * h, 50);
      fg.addColorStop(0, 'rgba(200,205,198,0.35)');
      fg.addColorStop(1, 'rgba(200,205,198,0)');
      ctx.fillStyle = fg;
      ctx.fillRect(0, 0, w, h);
    }
  } else if (mod === 'blackout') {
    const vg = ctx.createRadialGradient(cx, cy, h * 0.15, cx, cy, h * 0.7);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.85)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  } else if (mod === 'stampede') {
    ctx.strokeStyle = 'rgba(240,144,64,0.55)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      const y = rng() * h;
      const x = ((rng() * w + t * 260) % (w + 60)) - 60;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 30 + rng() * 30, y);
      ctx.stroke();
    }
  } else if (mod === 'golden') {
    for (let i = 0; i < 14; i++) {
      const x = rng() * w;
      const y = rng() * h;
      const a = 0.4 + 0.6 * Math.abs(Math.sin(t * 3 + i));
      ctx.fillStyle = `rgba(240,196,64,${a})`;
      ctx.beginPath();
      ctx.arc(x, y, 1.5 + (i % 3), 0, TAU);
      ctx.fill();
    }
  } else if (mod === 'siege') {
    ctx.strokeStyle = 'rgba(127,166,200,0.5)';
    ctx.lineWidth = 3;
    for (let i = -1; i <= 1; i += 2) {
      const x = cx + i * w * 0.32;
      ctx.beginPath();
      ctx.moveTo(x, cy - 22);
      ctx.lineTo(x + 14, cy - 16);
      ctx.lineTo(x + 12, cy + 6);
      ctx.quadraticCurveTo(x + 7, cy + 18, x, cy + 22);
      ctx.quadraticCurveTo(x - 7, cy + 18, x - 12, cy + 6);
      ctx.lineTo(x - 14, cy - 16);
      ctx.closePath();
      ctx.stroke();
    }
  } else if (mod === 'blood') {
    ctx.fillStyle = 'rgba(150,10,14,0.28)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#c42a2a';
    ctx.shadowColor = '#ff3030';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(w - 28, 24, 13, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  // marco
  ctx.strokeStyle = `${def.col}88`;
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
}
