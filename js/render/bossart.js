// Figuras de los jefes (vistos desde arriba, mirando hacia +x). Cada jefe tiene su silueta y lo que lo
// distingue (campana, depósitos, puerta, corona…) y, cuando lo tiene, su punto débil a la vista. Sus
// imágenes se arman la primera vez que aparece cada uno (bossSprite), no al cargar el juego.
import { ZOMBIES } from '../core/config.ts';
import { TAU, mulberry32, rrange } from '../core/util.ts';
import { OUT, buildSet, circ, ell, limb, rockBody, rockKit, softShadow } from './sprites.js';

/** @typedef {CanvasRenderingContext2D} Ctx */
/** @typedef {Record<string, any>} Pal paleta del jefe (colores y semilla) */

/** @param {Ctx} g @param {number} x @param {number} y @param {number} w @param {number} h @param {string} fill @param {number} [lw] */
function box(g, x, y, w, h, fill, lw = 1.4) {
  g.fillStyle = fill;
  g.fillRect(x, y, w, h);
  g.lineWidth = lw;
  g.strokeStyle = OUT;
  g.strokeRect(x, y, w, h);
}

/** Brillo suave (aditivo) de color col en (x, y). @param {Ctx} g @param {number} x @param {number} y @param {number} r @param {string} col @param {number} [a] */
function glow(g, x, y, r, col, a = 0.6) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(${col},${a})`);
  gr.addColorStop(1, `rgba(${col},0)`);
  g.fillStyle = gr;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
}

/**
 * Cuerpo de gigante: piernas que se alternan, brazos (armL/armR los agrandan), torso y cabeza.
 * bw: medio ancho del torso (de hombro a hombro) y bl: medio largo, en radios.
 * @param {Ctx} g @param {number} r @param {Pal} c @param {number} ph
 * @param {{ bw?: number, bl?: number, armL?: number, armR?: number, head?: number, reach?: number }} [o]
 */
function hulk(g, r, c, ph, o = {}) {
  const s = Math.sin(ph);
  const bw = o.bw ?? 0.66;
  const bl = o.bl ?? 0.48;
  const la = o.armL ?? 1;
  const ra = o.armR ?? 1;
  const reach = o.reach ?? 0.78;
  softShadow(g, r * 1.4, 0.5);
  const st = r * 0.2;
  ell(g, s * st - r * 0.12, -r * bw * 0.5, r * 0.28, r * 0.19, 0, c.pants, OUT, 1.6);
  ell(g, -s * st - r * 0.12, r * bw * 0.5, r * 0.28, r * 0.19, 0, c.pants, OUT, 1.6);
  const sw = s * r * 0.1;
  limb(g, 0, -r * bw * 0.86, r * reach * la + sw, -r * bw * 0.82, r * 0.22 * la, c.skin);
  limb(g, 0, r * bw * 0.86, r * reach * ra - sw, r * bw * 0.82, r * 0.22 * ra, c.skin);
  circ(g, r * reach * la + sw, -r * bw * 0.82, r * 0.15 * la, c.skin, OUT, 1.6);
  circ(g, r * reach * ra - sw, r * bw * 0.82, r * 0.15 * ra, c.skin, OUT, 1.6);
  ell(g, 0, 0, r * bl, r * bw, 0, c.body, OUT, 2.2);
  return { s, sw, bw, bl };
}

/** Cabeza con ojos encendidos. @param {Ctx} g @param {number} r @param {Pal} c @param {number} s @param {number} [k] @param {number} [x] */
function head(g, r, c, s, k = 0.2, x = 0.34) {
  circ(g, r * x, s * r * 0.02, r * k, c.skin, OUT, 1.8);
  g.fillStyle = c.eye || '#ffcf5a';
  g.fillRect(r * (x + k * 0.55), -r * k * 0.45 + s * r * 0.02, r * k * 0.28, r * k * 0.22);
  g.fillRect(r * (x + k * 0.55), r * k * 0.25 + s * r * 0.02, r * k * 0.28, r * k * 0.22);
}

/* ---------- los jefes ---------- */

// 1 · Rocoso Supremo: un rocoso enorme y encorvado. Brazos largos con puños gigantes, placas gruesas en
// hombros y lomo, una cresta de piedra por la columna y, atrás, la espalda agrietada con lava encendida.
/** @param {Ctx} g @param {number} r @param {Pal} p @param {number} ph */
function drawSupremo(g, r, p, ph) {
  softShadow(g, r * 1.45, 0.55);
  const s = Math.sin(ph);
  const rng = mulberry32(p.seed);
  const { boulder, stone } = rockKit(g, /** @type {any} */ (p), rng);
  rockBody(g, r, /** @type {any} */ (p), ph, rng, boulder, stone);
  g.save();
  boulder(-r * 0.52, 0, r * 0.32, r * 0.5, 9, 0.15);
  g.fillStyle = '#3a1d12';
  g.fill();
  g.clip();
  const lava = g.createRadialGradient(-r * 0.55, 0, 0, -r * 0.55, 0, r * 0.5);
  lava.addColorStop(0, '#ffd27a');
  lava.addColorStop(0.45, p.glow);
  lava.addColorStop(1, 'rgba(120,30,10,0.2)');
  g.fillStyle = lava;
  g.fillRect(-r, -r, r, r * 2);
  g.restore();
  for (const [px, py, rx, ry] of [
    [-0.66, -0.26, 0.15, 0.13],
    [-0.62, 0.22, 0.14, 0.15],
    [-0.42, -0.02, 0.12, 0.12],
  ])
    stone(px * r, py * r, rx * r, ry * r, 6, 1.2);
  g.strokeStyle = '#ffcf70';
  g.lineWidth = 1.3;
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const y = rrange(rng, -0.42, 0.42) * r;
    g.moveTo(-r * 0.78, y);
    g.lineTo(-r * rrange(rng, 0.42, 0.55), y + rrange(rng, -0.12, 0.12) * r);
  }
  g.stroke();
  for (let i = 0; i < 4; i++) stone(r * (0.08 - i * 0.16), 0, r * 0.09, r * 0.12, 5, 1.3);
  const sw = s * r * 0.12;
  stone(r * 0.02, -r * 0.86, r * 0.42, r * 0.34, 8, 2);
  stone(r * 0.02, r * 0.86, r * 0.42, r * 0.34, 8, 2);
  stone(r * 1.04 + sw, -r * 0.74, r * 0.34, r * 0.3, 7, 2);
  stone(r * 1.04 - sw, r * 0.74, r * 0.34, r * 0.3, 7, 2);
  circ(g, r * 0.36, s * r * 0.02, r * 0.2, p.skin, OUT, 1.8);
  stone(r * 0.3, s * r * 0.02, r * 0.17, r * 0.19, 6, 1.4);
  stone(r * 0.26, -r * 0.2, r * 0.08, r * 0.06, 5, 1.2);
  stone(r * 0.26, r * 0.2, r * 0.08, r * 0.06, 5, 1.2);
  glow(g, r * 0.5, s * r * 0.02, r * 0.14, '255,140,60', 0.5);
  g.fillStyle = p.eye;
  g.fillRect(r * 0.47, -r * 0.08 + s * r * 0.02, r * 0.06, r * 0.05);
  g.fillRect(r * 0.47, r * 0.03 + s * r * 0.02, r * 0.06, r * 0.05);
}

// 2 · Aplastador: casi tres metros de músculo, un brazo derecho enorme y restos de armadura industrial
// (placas grises con franjas de peligro).
/** @param {Ctx} g @param {number} r @param {Pal} c @param {number} ph */
function drawAplastador(g, r, c, ph) {
  const { s, sw } = hulk(g, r, c, ph, { armL: 0.75, armR: 1.75, bw: 0.62, reach: 0.82 });
  // placas del brazo grande con franjas amarillas y negras
  g.save();
  g.translate(r * 0.5 - sw * 0.5, r * 0.55);
  g.rotate(0.05);
  box(g, -r * 0.2, -r * 0.16, r * 0.42, r * 0.32, c.metal, 1.6);
  g.beginPath();
  g.rect(-r * 0.2, r * 0.08, r * 0.42, r * 0.08);
  g.clip();
  for (let i = -3; i < 6; i++) {
    g.fillStyle = i % 2 ? '#f0b52a' : '#1c1c1a';
    g.beginPath();
    g.moveTo(-r * 0.2 + i * r * 0.08, r * 0.16);
    g.lineTo(-r * 0.2 + (i + 1) * r * 0.08, r * 0.16);
    g.lineTo(-r * 0.2 + (i + 2) * r * 0.08, r * 0.08);
    g.lineTo(-r * 0.2 + (i + 1) * r * 0.08, r * 0.08);
    g.fill();
  }
  g.restore();
  // hombrera de acero y cinturón de remaches
  ell(g, -r * 0.02, r * 0.5, r * 0.3, r * 0.24, 0, c.metal, OUT, 2);
  for (const k of [-0.25, 0, 0.25]) circ(g, r * k, r * 0.5, r * 0.035, '#2a2b2c', null);
  box(g, -r * 0.36, -r * 0.1, r * 0.12, r * 0.2, c.metal);
  // venas del brazo grande
  g.strokeStyle = c.vein;
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(r * 0.7 - sw, r * 0.4);
  g.lineTo(r * 1.05 - sw, r * 0.5);
  g.stroke();
  head(g, r, c, s, 0.18, 0.38);
}

// 3 · Campanero: alto, delgado y deforme; una campana de bronce enorme a la espalda (su punto débil) y
// cadenas que arrastra.
/** @param {Ctx} g @param {number} r @param {Pal} c @param {number} ph */
function drawCampanero(g, r, c, ph) {
  // cadenas que arrastra por detrás
  g.strokeStyle = '#6d6a62';
  g.lineWidth = 2;
  for (const y of [-0.42, 0.42]) {
    g.beginPath();
    for (let i = 0; i < 7; i++) {
      const x = -r * (0.3 + i * 0.16);
      const yy = r * y + Math.sin(ph + i) * r * 0.05;
      g.moveTo(x, yy);
      g.arc(x, yy, r * 0.05, 0, TAU);
    }
    g.stroke();
  }
  const { s } = hulk(g, r, c, ph, { bw: 0.48, bl: 0.38, armL: 0.8, armR: 0.8, reach: 0.95 });
  // jorobas y huesos de la espalda torcida
  ell(g, -r * 0.1, -r * 0.2, r * 0.22, r * 0.16, 0.4, c.body2, OUT, 1.4);
  // la campana: bronce con borde grueso y badajo
  const bx = -r * 0.48;
  const bell = g.createRadialGradient(bx - r * 0.1, -r * 0.1, r * 0.05, bx, 0, r * 0.42);
  bell.addColorStop(0, '#f2d27a');
  bell.addColorStop(0.5, c.bell);
  bell.addColorStop(1, '#5a3d14');
  g.fillStyle = bell;
  g.beginPath();
  g.arc(bx, 0, r * 0.42, 0, TAU);
  g.fill();
  g.lineWidth = 2.4;
  g.strokeStyle = OUT;
  g.stroke();
  g.strokeStyle = 'rgba(60,35,10,0.8)';
  g.lineWidth = 1.6;
  g.beginPath();
  g.arc(bx, 0, r * 0.3, 0, TAU);
  g.stroke();
  circ(g, bx, 0, r * 0.08, '#3b2a12', OUT, 1.2);
  // correas que la sujetan
  g.strokeStyle = '#3a2a1c';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(bx + r * 0.2, -r * 0.35);
  g.lineTo(r * 0.12, -r * 0.4);
  g.moveTo(bx + r * 0.2, r * 0.35);
  g.lineTo(r * 0.12, r * 0.4);
  g.stroke();
  head(g, r, c, s, 0.17, 0.36);
}

// 4 · Contaminado: enorme y verdoso, con un traje químico amarillo hecho jirones, máscara de gas y
// depósitos industriales en la espalda (reciben el doble).
/** @param {Ctx} g @param {number} r @param {Pal} c @param {number} ph */
function drawContaminado(g, r, c, ph) {
  const { s } = hulk(g, r, c, ph, { bw: 0.68, bl: 0.52 });
  // jirones del traje dejan ver la piel verde
  const rng = mulberry32(c.seed);
  for (let i = 0; i < 5; i++)
    ell(g, rrange(rng, -0.3, 0.3) * r, rrange(rng, -0.5, 0.5) * r, r * 0.1, r * 0.06, rng() * 3, c.skin, null);
  // dos depósitos con líquido verde que brilla
  for (const y of [-0.3, 0.3]) {
    box(g, -r * 0.72, r * y - r * 0.18, r * 0.46, r * 0.36, '#7c8a73', 2);
    g.fillStyle = 'rgba(140,240,80,0.85)';
    g.fillRect(-r * 0.66, r * y - r * 0.1, r * 0.34, r * 0.2);
    glow(g, -r * 0.5, r * y, r * 0.3, '150,255,80', 0.45);
    box(g, -r * 0.3, r * y - r * 0.04, r * 0.12, r * 0.08, '#4b5246');
  }
  // tubos del depósito a la máscara
  g.strokeStyle = '#2f3a2a';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(-r * 0.2, -r * 0.3);
  g.quadraticCurveTo(r * 0.1, -r * 0.35, r * 0.3, -r * 0.1);
  g.moveTo(-r * 0.2, r * 0.3);
  g.quadraticCurveTo(r * 0.1, r * 0.35, r * 0.3, r * 0.1);
  g.stroke();
  // máscara de gas con visores y filtro
  circ(g, r * 0.34, s * r * 0.02, r * 0.2, '#3b4038', OUT, 1.8);
  circ(g, r * 0.42, -r * 0.08, r * 0.06, 'rgba(160,240,120,0.9)', OUT, 1);
  circ(g, r * 0.42, r * 0.08, r * 0.06, 'rgba(160,240,120,0.9)', OUT, 1);
  circ(g, r * 0.54, 0, r * 0.07, '#5d6656', OUT, 1.2);
}

// 5 · Carcelero: guardia de prisión gigantesco con armadura pesada, cadenas y una puerta de celda de
// metal como escudo (de frente casi no le entra nada).
/** @param {Ctx} g @param {number} r @param {Pal} c @param {number} ph */
function drawCarcelero(g, r, c, ph) {
  const { s } = hulk(g, r, c, ph, { bw: 0.66, bl: 0.5, armL: 1.1, armR: 1, reach: 0.6 });
  // placas de la armadura y la gorra
  box(g, -r * 0.3, -r * 0.5, r * 0.5, r * 0.24, c.metal, 1.6);
  box(g, -r * 0.3, r * 0.26, r * 0.5, r * 0.24, c.metal, 1.6);
  head(g, r, c, s, 0.18, 0.3);
  ell(g, r * 0.3, 0, r * 0.2, r * 0.19, 0, '#1f2638', OUT, 1.6);
  box(g, r * 0.4, -r * 0.08, r * 0.08, r * 0.16, '#1a1f2c');
  // cadena cruzada al pecho
  g.strokeStyle = '#8a8780';
  g.lineWidth = 2;
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const x = -r * 0.3 + i * r * 0.07;
    const y = -r * 0.45 + i * r * 0.13;
    g.moveTo(x + r * 0.03, y);
    g.arc(x, y, r * 0.03, 0, TAU);
  }
  g.stroke();
  // la puerta de celda delante: placa con barrotes, remaches y una ventanilla
  const dx = r * 0.78;
  box(g, dx, -r * 0.82, r * 0.16, r * 1.64, c.door, 2.4);
  g.strokeStyle = '#2b2f33';
  g.lineWidth = 2;
  for (let i = 1; i < 5; i++) {
    g.beginPath();
    g.moveTo(dx + r * 0.02, -r * 0.82 + i * r * 0.33);
    g.lineTo(dx + r * 0.14, -r * 0.82 + i * r * 0.33);
    g.stroke();
  }
  box(g, dx + r * 0.03, -r * 0.12, r * 0.1, r * 0.24, '#1b1d1f');
  for (const y of [-0.74, 0.74]) circ(g, dx + r * 0.08, r * y, r * 0.03, '#b9b4a8', null);
}

// 6 · Cazadora: alta y muy delgada, a cuatro patas, con brazos largos y cabeza baja hacia adelante.
/** @param {Ctx} g @param {number} r @param {Pal} c @param {number} ph */
function drawCazadora(g, r, c, ph) {
  const s = Math.sin(ph);
  softShadow(g, r * 1.5, 0.45);
  // cuatro patas largas, abiertas, que se alternan
  /** @type {[number, number, number, number, number][]} */
  const legs = [
    [0.25, -0.2, 1.05, -0.75, s],
    [0.25, 0.2, 1.05, 0.75, -s],
    [-0.35, -0.2, -1, -0.7, -s],
    [-0.35, 0.2, -1, 0.7, s],
  ];
  for (const [x0, y0, x1, y1, k] of legs) {
    const mx = (x0 + x1) / 2 + k * 0.08;
    const my = ((y0 + y1) / 2) * 1.4;
    limb(g, r * x0, r * y0, r * mx, r * my, r * 0.11, c.skin);
    limb(g, r * mx, r * my, r * (x1 + k * 0.12), r * y1, r * 0.08, c.skin);
    circ(g, r * (x1 + k * 0.12), r * y1, r * 0.07, c.claw, OUT, 1);
  }
  // cuerpo largo y estrecho con la columna marcada
  ell(g, 0, 0, r * 0.62, r * 0.26, 0, c.body, OUT, 2);
  g.fillStyle = c.body2;
  for (let i = 0; i < 7; i++) {
    g.beginPath();
    g.ellipse(-r * 0.5 + i * r * 0.16, 0, r * 0.05, r * 0.035, 0, 0, TAU);
    g.fill();
  }
  // cabeza alargada con ojos rojos y mandíbula abierta
  ell(g, r * 0.72, s * r * 0.03, r * 0.22, r * 0.14, 0, c.skin, OUT, 1.6);
  g.fillStyle = '#3a0d0d';
  g.beginPath();
  g.moveTo(r * 0.82, -r * 0.05);
  g.lineTo(r * 0.96, 0);
  g.lineTo(r * 0.82, r * 0.05);
  g.fill();
  glow(g, r * 0.78, 0, r * 0.12, '255,60,60', 0.4);
  g.fillStyle = '#ff3b3b';
  g.fillRect(r * 0.76, -r * 0.09, r * 0.05, r * 0.035);
  g.fillRect(r * 0.76, r * 0.055, r * 0.05, r * 0.035);
}

// 7 · Excavador: mutante gigantesco con brazos de excavadora (cucharones con dientes), placas oxidadas
// y una cadena de oruga arrastrando.
/** @param {Ctx} g @param {number} r @param {Pal} c @param {number} ph */
function drawExcavador(g, r, c, ph) {
  const { s, sw } = hulk(g, r, c, ph, { bw: 0.68, bl: 0.5, armL: 1.2, armR: 1.2, reach: 0.8 });
  // orugas de maquinaria pegadas a la espalda
  box(g, -r * 0.72, -r * 0.5, r * 0.26, r * 1, '#2d2d2b', 2);
  g.fillStyle = '#4e4b45';
  for (let i = 0; i < 7; i++) g.fillRect(-r * 0.7, -r * 0.48 + i * r * 0.14, r * 0.22, r * 0.05);
  // placas oxidadas
  const rng = mulberry32(c.seed);
  for (let i = 0; i < 4; i++)
    box(g, rrange(rng, -0.35, 0.1) * r, rrange(rng, -0.5, 0.35) * r, r * 0.2, r * 0.16, c.rust, 1.2);
  // cucharones con dientes en vez de manos
  for (const sd of [-1, 1]) {
    const x = r * 0.98 + sd * sw;
    const y = sd * r * 0.56;
    g.save();
    g.translate(x, y);
    g.beginPath();
    g.moveTo(-r * 0.2, -r * 0.18);
    g.lineTo(r * 0.12, -r * 0.2);
    g.lineTo(r * 0.2, 0);
    g.lineTo(r * 0.12, r * 0.2);
    g.lineTo(-r * 0.2, r * 0.18);
    g.closePath();
    g.fillStyle = c.bucket;
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = OUT;
    g.stroke();
    g.fillStyle = '#bdb7a6';
    for (let i = -2; i <= 2; i++) {
      g.beginPath();
      g.moveTo(r * 0.18, i * r * 0.07 - r * 0.03);
      g.lineTo(r * 0.28, i * r * 0.07);
      g.lineTo(r * 0.18, i * r * 0.07 + r * 0.03);
      g.fill();
    }
    g.restore();
  }
  head(g, r, c, s, 0.17, 0.34);
}

// 8 · Generador: gigante industrial con transformadores, cables y bobinas que brillan de azul.
/** @param {Ctx} g @param {number} r @param {Pal} c @param {number} ph */
function drawGenerador(g, r, c, ph) {
  const { s } = hulk(g, r, c, ph, { bw: 0.68, bl: 0.5 });
  // transformadores en la espalda
  for (const y of [-0.3, 0.3]) {
    box(g, -r * 0.7, r * y - r * 0.2, r * 0.4, r * 0.4, c.metal, 2);
    g.strokeStyle = '#2a2d30';
    g.lineWidth = 1.2;
    for (let i = 1; i < 4; i++) {
      g.beginPath();
      g.moveTo(-r * 0.7 + i * r * 0.1, r * y - r * 0.2);
      g.lineTo(-r * 0.7 + i * r * 0.1, r * y + r * 0.2);
      g.stroke();
    }
  }
  // bobinas que chisporrotean
  for (const [x, y] of [
    [-0.2, -0.5],
    [-0.2, 0.5],
    [0.1, -0.2],
    [0.1, 0.2],
  ]) {
    glow(g, r * x, r * y, r * 0.2, '120,190,255', 0.65);
    circ(g, r * x, r * y, r * 0.08, '#d8ecff', OUT, 1.2);
  }
  // cables sueltos
  g.strokeStyle = '#1b1d20';
  g.lineWidth = 2.4;
  g.beginPath();
  g.moveTo(-r * 0.5, -r * 0.1);
  g.bezierCurveTo(-r * 0.2, -r * 0.6, r * 0.2, -r * 0.3, r * 0.4, -r * 0.6);
  g.moveTo(-r * 0.5, r * 0.1);
  g.bezierCurveTo(-r * 0.2, r * 0.6, r * 0.2, r * 0.3, r * 0.4, r * 0.6);
  g.stroke();
  head(g, r, { ...c, eye: '#9fd4ff' }, s, 0.17, 0.34);
}

// 9 · Reina de la Colmena: criatura gigante de seis patas con un caparazón orgánico segmentado y una
// cabeza pequeña con mandíbulas.
/** @param {Ctx} g @param {number} r @param {Pal} c @param {number} ph */
function drawReina(g, r, c, ph) {
  const s = Math.sin(ph);
  softShadow(g, r * 1.5, 0.5);
  for (let i = 0; i < 3; i++) {
    const x = r * (0.3 - i * 0.35);
    const k = (i % 2 ? s : -s) * 0.12;
    for (const sd of [-1, 1]) {
      limb(g, x, sd * r * 0.4, x + r * (0.25 + k), sd * r * 0.85, r * 0.1, c.leg);
      limb(g, x + r * (0.25 + k), sd * r * 0.85, x + r * (0.4 + k), sd * r * 1.05, r * 0.07, c.leg);
    }
  }
  // abdomen grande atrás y tórax
  ell(g, -r * 0.35, 0, r * 0.62, r * 0.55, 0, c.body, OUT, 2.4);
  ell(g, r * 0.25, 0, r * 0.32, r * 0.36, 0, c.body2, OUT, 2);
  // caparazón segmentado
  g.strokeStyle = 'rgba(30,15,25,0.7)';
  g.lineWidth = 2;
  for (let i = 1; i < 5; i++) {
    g.beginPath();
    g.ellipse(-r * 0.35, 0, r * 0.62 * (1 - i * 0.18), r * 0.55 * (1 - i * 0.18), 0, -1.2, 1.2);
    g.stroke();
  }
  // sacos de huevos brillantes
  const rng = mulberry32(c.seed);
  for (let i = 0; i < 6; i++) {
    const x = -r * rrange(rng, 0.2, 0.75);
    const y = r * rrange(rng, -0.35, 0.35);
    glow(g, x, y, r * 0.12, '230,160,90', 0.5);
    circ(g, x, y, r * 0.05, c.egg, OUT, 1);
  }
  // cabeza con mandíbulas
  circ(g, r * 0.58, s * r * 0.02, r * 0.16, c.body2, OUT, 1.6);
  limb(g, r * 0.68, -r * 0.08, r * 0.86, -r * 0.03, r * 0.05, c.claw);
  limb(g, r * 0.68, r * 0.08, r * 0.86, r * 0.03, r * 0.05, c.claw);
  g.fillStyle = '#ffde6a';
  g.fillRect(r * 0.62, -r * 0.08, r * 0.05, r * 0.04);
  g.fillRect(r * 0.62, r * 0.04, r * 0.05, r * 0.04);
}

// 10 · Devorador: colosal, ancho y pesado, con armadura natural y una boca enorme al frente.
/** @param {Ctx} g @param {number} r @param {Pal} c @param {number} ph */
function drawDevorador(g, r, c, ph) {
  const s = Math.sin(ph);
  softShadow(g, r * 1.4, 0.55);
  ell(g, s * r * 0.15 - r * 0.2, -r * 0.55, r * 0.26, r * 0.2, 0, c.skin, OUT, 1.6);
  ell(g, -s * r * 0.15 - r * 0.2, r * 0.55, r * 0.26, r * 0.2, 0, c.skin, OUT, 1.6);
  limb(g, r * 0.1, -r * 0.75, r * 0.55, -r * 0.82, r * 0.2, c.skin);
  limb(g, r * 0.1, r * 0.75, r * 0.55, r * 0.82, r * 0.2, c.skin);
  // panza enorme y placas de su armadura natural
  ell(g, 0, 0, r * 0.82, r * 0.82, 0, c.body, OUT, 2.6);
  const rng = mulberry32(c.seed);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + 0.3;
    const d = r * rrange(rng, 0.4, 0.62);
    ell(g, -Math.abs(Math.cos(a)) * d * 0.7, Math.sin(a) * d, r * 0.17, r * 0.12, a, c.plate, OUT, 1.4);
  }
  // la boca: abierta al frente, con dientes
  g.save();
  g.translate(r * 0.5, 0);
  ell(g, 0, 0, r * 0.3, r * 0.4, 0, '#2a0b0b', OUT, 2);
  ell(g, r * 0.02, 0, r * 0.18, r * 0.26, 0, '#5c1515', null);
  g.fillStyle = '#e8dcc0';
  for (let i = 0; i < 9; i++) {
    const a = -1.3 + (i / 8) * 2.6;
    const x = Math.cos(a) * r * 0.28;
    const y = Math.sin(a) * r * 0.38;
    g.beginPath();
    g.moveTo(x, y - r * 0.03);
    g.lineTo(x - r * 0.09, y);
    g.lineTo(x, y + r * 0.03);
    g.fill();
  }
  g.restore();
  g.fillStyle = '#ffb347';
  g.fillRect(r * 0.2, -r * 0.48, r * 0.06, r * 0.05);
  g.fillRect(r * 0.2, r * 0.43, r * 0.06, r * 0.05);
}

// 11 · Incendiario: trabajador industrial convertido en monstruo, con armadura ennegrecida, depósitos de
// combustible rojos, tubos y una boquilla que siempre arde.
/** @param {Ctx} g @param {number} r @param {Pal} c @param {number} ph */
function drawIncendiario(g, r, c, ph) {
  const { s, sw } = hulk(g, r, c, ph, { bw: 0.66, bl: 0.5, armR: 1.2 });
  // tres depósitos de combustible
  for (const y of [-0.38, 0, 0.38]) {
    ell(g, -r * 0.55, r * y, r * 0.24, r * 0.16, 0, c.tank, OUT, 2);
    g.fillStyle = 'rgba(255,220,180,0.35)';
    g.fillRect(-r * 0.68, r * y - r * 0.08, r * 0.2, r * 0.04);
  }
  // tubos al brazo
  g.strokeStyle = '#35302a';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(-r * 0.4, r * 0.38);
  g.quadraticCurveTo(r * 0.1, r * 0.8, r * 0.75 - sw, r * 0.55);
  g.stroke();
  // boquilla del lanzallamas con su llama
  box(g, r * 0.72 - sw, r * 0.47, r * 0.24, r * 0.12, '#4a4440', 1.4);
  glow(g, r * 1.05 - sw, r * 0.53, r * 0.22, '255,140,40', 0.8);
  // placas ennegrecidas
  for (const y of [-0.45, 0.45]) ell(g, r * 0.05, r * y, r * 0.22, r * 0.16, 0, c.plate, OUT, 1.6);
  head(g, r, { ...c, eye: '#ffb03a' }, s, 0.17, 0.34);
  box(g, r * 0.4, -r * 0.08, r * 0.1, r * 0.16, '#222');
}

// 12 · Arquitecto de Ruinas: cubierto de concreto, vigas, placas de metal y varillas; dos brazos enormes
// para demoler.
/** @param {Ctx} g @param {number} r @param {Pal} c @param {number} ph */
function drawArquitecto(g, r, c, ph) {
  const { s } = hulk(g, r, c, ph, { bw: 0.7, bl: 0.52, armL: 1.45, armR: 1.45, reach: 0.82 });
  const rng = mulberry32(c.seed);
  // losas de concreto pegadas al cuerpo
  for (let i = 0; i < 7; i++) {
    g.save();
    g.translate(rrange(rng, -0.45, 0.25) * r, rrange(rng, -0.55, 0.55) * r);
    g.rotate(rng() * 3);
    box(g, -r * 0.13, -r * 0.1, r * 0.26, r * 0.2, c.concrete, 1.4);
    g.restore();
  }
  // vigas de acero que salen de la espalda
  for (const [y, a] of [
    [-0.3, -0.5],
    [0.3, 0.5],
    [0, 0],
  ]) {
    g.save();
    g.translate(-r * 0.3, r * y);
    g.rotate(Math.PI + a);
    box(g, 0, -r * 0.05, r * 0.65, r * 0.1, c.beam, 1.6);
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(0, -r * 0.01, r * 0.65, r * 0.02);
    g.restore();
  }
  // varillas dobladas
  g.strokeStyle = '#7a4a2a';
  g.lineWidth = 1.6;
  g.beginPath();
  for (let i = 0; i < 5; i++) {
    const x = rrange(rng, -0.4, 0.2) * r;
    const y = rrange(rng, -0.5, 0.5) * r;
    g.moveTo(x, y);
    g.lineTo(x + rrange(rng, -0.2, 0.2) * r, y + rrange(rng, -0.2, 0.2) * r);
  }
  g.stroke();
  head(g, r, c, s, 0.16, 0.36);
}

// 13 · Tormenta Viviente: mutante alargado cubierto de maquinaria del clima: ventiladores industriales en
// los hombros (su punto débil) y grandes placas de metal.
/** @param {Ctx} g @param {number} r @param {Pal} c @param {number} ph */
function drawTormenta(g, r, c, ph) {
  const { s } = hulk(g, r, c, ph, { bw: 0.56, bl: 0.6, reach: 0.9 });
  box(g, -r * 0.5, -r * 0.18, r * 0.8, r * 0.36, c.metal, 1.8);
  // ventiladores en los hombros
  for (const y of [-0.56, 0.56]) {
    circ(g, -r * 0.05, r * y, r * 0.3, '#3a4048', OUT, 2.2);
    g.save();
    g.translate(-r * 0.05, r * y);
    g.rotate(ph * 2);
    g.fillStyle = '#aab3bd';
    for (let i = 0; i < 4; i++) {
      g.rotate(TAU / 4);
      g.beginPath();
      g.ellipse(r * 0.13, 0, r * 0.12, r * 0.05, 0.4, 0, TAU);
      g.fill();
    }
    g.restore();
    circ(g, -r * 0.05, r * y, r * 0.06, '#d6dde4', OUT, 1);
  }
  // antenas y veleta
  g.strokeStyle = '#2c3036';
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(-r * 0.4, 0);
  g.lineTo(-r * 0.85, -r * 0.1);
  g.moveTo(-r * 0.4, 0);
  g.lineTo(-r * 0.85, r * 0.12);
  g.stroke();
  glow(g, -r * 0.2, 0, r * 0.18, '170,210,255', 0.4);
  head(g, r, { ...c, eye: '#c4e4ff' }, s, 0.16, 0.42);
}

// 14 · Titán del Apocalipsis: más de seis metros; placas, restos de coches y bloques de concreto encima,
// y placas en las rodillas (rómpelas y caminará más lento).
/** @param {Ctx} g @param {number} r @param {Pal} c @param {number} ph */
function drawTitan(g, r, c, ph) {
  const { s } = hulk(g, r, c, ph, { bw: 0.7, bl: 0.5, armL: 1.3, armR: 1.3, reach: 0.82 });
  // rodilleras de acero (asoman delante de las piernas)
  for (const sd of [-1, 1]) {
    const x = sd * s * r * 0.2 - r * 0.0;
    box(g, x + r * 0.05, sd * r * 0.35 - r * 0.08, r * 0.14, r * 0.16, c.knee, 1.6);
  }
  const rng = mulberry32(c.seed);
  // restos de coches y concreto
  for (let i = 0; i < 4; i++) {
    g.save();
    g.translate(rrange(rng, -0.45, 0.2) * r, rrange(rng, -0.5, 0.5) * r);
    g.rotate(rng() * 3);
    box(g, -r * 0.16, -r * 0.1, r * 0.32, r * 0.2, i % 2 ? c.car : c.concrete, 1.4);
    if (i % 2) {
      g.fillStyle = 'rgba(160,200,220,0.6)';
      g.fillRect(-r * 0.06, -r * 0.08, r * 0.1, r * 0.16);
    }
    g.restore();
  }
  // placas grandes de los hombros
  for (const sd of [-1, 1]) ell(g, 0, sd * r * 0.62, r * 0.32, r * 0.24, 0, c.plate, OUT, 2.2);
  head(g, r, { ...c, eye: '#ff7a3a' }, s, 0.15, 0.36);
}

// 15 · Rey de los Muertos: siete metros, armadura negra con placas de hueso, capa, y una corona de metal
// retorcido con tres núcleos rojos (su punto débil).
/** @param {Ctx} g @param {number} r @param {Pal} c @param {number} ph */
function drawRey(g, r, c, ph) {
  // capa hecha jirones detrás
  g.fillStyle = c.cape;
  g.strokeStyle = OUT;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(r * 0.1, -r * 0.7);
  for (let i = 0; i <= 8; i++) {
    const y = -r * 0.7 + (i / 8) * r * 1.4;
    g.lineTo(-r * (0.85 + (i % 2) * 0.15 + Math.sin(ph + i) * 0.04), y);
  }
  g.lineTo(r * 0.1, r * 0.7);
  g.closePath();
  g.fill();
  g.stroke();
  const { s } = hulk(g, r, c, ph, { bw: 0.64, bl: 0.48, armL: 1.15, armR: 1.15 });
  // placas de hueso sobre la armadura negra
  for (const [x, y] of [
    [-0.15, -0.42],
    [-0.15, 0.42],
    [0.1, -0.2],
    [0.1, 0.2],
  ])
    ell(g, r * x, r * y, r * 0.16, r * 0.11, 0, c.bone, OUT, 1.4);
  // costillas
  g.strokeStyle = c.bone;
  g.lineWidth = 1.6;
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.moveTo(-r * 0.25 + i * r * 0.1, -r * 0.15);
    g.lineTo(-r * 0.25 + i * r * 0.1, r * 0.15);
    g.stroke();
  }
  head(g, r, { ...c, eye: '#ff2a2a' }, s, 0.18, 0.32);
  glow(g, r * 0.4, 0, r * 0.2, '255,40,40', 0.35);
  // la corona: púas de metal retorcido y tres núcleos rojos
  g.save();
  g.translate(r * 0.32, s * r * 0.02);
  g.fillStyle = c.crown;
  g.strokeStyle = OUT;
  g.lineWidth = 1.6;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU;
    g.beginPath();
    g.moveTo(Math.cos(a - 0.25) * r * 0.17, Math.sin(a - 0.25) * r * 0.17);
    g.lineTo(Math.cos(a) * r * 0.33, Math.sin(a) * r * 0.33);
    g.lineTo(Math.cos(a + 0.25) * r * 0.17, Math.sin(a + 0.25) * r * 0.17);
    g.closePath();
    g.fill();
    g.stroke();
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + 0.5;
    const x = Math.cos(a) * r * 0.2;
    const y = Math.sin(a) * r * 0.2;
    glow(g, x, y, r * 0.1, '255,40,40', 0.9);
    circ(g, x, y, r * 0.045, '#ff5a4a', OUT, 1);
  }
  g.restore();
}

/** Dibujo, paleta y margen de cada jefe. */
const ART = {
  supremo: {
    draw: drawSupremo,
    pal: {
      stone: '#57524b',
      light: '#77706a',
      dark: '#2f2c28',
      moss: '#4a5232',
      skin: '#5e5852',
      eye: '#ffb04a',
      glow: '#ff7a2a',
    },
    pad: 1.55,
  },
  aplastador: {
    draw: drawAplastador,
    pal: { skin: '#8d7a62', body: '#6d5a48', pants: '#2c2a2a', metal: '#7b7f84', vein: '#5a3326', eye: '#ffcf5a' },
    pad: 1.8,
  },
  campanero: {
    draw: drawCampanero,
    pal: { skin: '#a3a08e', body: '#4a4238', body2: '#8a8676', pants: '#2b2622', bell: '#b8862e', eye: '#e8e0a0' },
    pad: 1.7,
  },
  contaminado: {
    draw: drawContaminado,
    pal: { skin: '#7ea24e', body: '#c9b23a', pants: '#3a4230', eye: '#c8ff80' },
    pad: 1.55,
  },
  carcelero: {
    draw: drawCarcelero,
    pal: { skin: '#8b8a7a', body: '#2f3a52', pants: '#1f2533', metal: '#5b6370', door: '#626a70', eye: '#ffd36a' },
    pad: 1.55,
  },
  cazadora: {
    draw: drawCazadora,
    pal: { skin: '#b9b2a2', body: '#8e8778', body2: '#6d675b', claw: '#2b2420' },
    pad: 1.7,
  },
  excavador: {
    draw: drawExcavador,
    pal: { skin: '#7d6f5e', body: '#5c5248', pants: '#2c2824', rust: '#8a5532', bucket: '#c98a2a', eye: '#ffcf5a' },
    pad: 1.7,
  },
  generador: {
    draw: drawGenerador,
    pal: { skin: '#7b8282', body: '#4b5258', pants: '#26292c', metal: '#6d7378' },
    pad: 1.6,
  },
  reina: {
    draw: drawReina,
    pal: { body: '#5a3b4a', body2: '#7a4a5e', leg: '#3e2a32', claw: '#2a1a1e', egg: '#e8a860' },
    pad: 1.7,
  },
  devorador: {
    draw: drawDevorador,
    pal: { skin: '#7a6658', body: '#6e5a4c', plate: '#4d4038' },
    pad: 1.45,
  },
  incendiario: {
    draw: drawIncendiario,
    pal: { skin: '#6c5a4c', body: '#2b2826', pants: '#1e1c1a', tank: '#b0362a', plate: '#3a3532' },
    pad: 1.6,
  },
  arquitecto: {
    draw: drawArquitecto,
    pal: { skin: '#8a8478', body: '#6a665e', pants: '#3a3833', concrete: '#a8a396', beam: '#6f5a46', eye: '#ffd36a' },
    pad: 1.75,
  },
  tormenta: {
    draw: drawTormenta,
    pal: { skin: '#7c858c', body: '#4c565e', pants: '#2a2f33', metal: '#6a747c' },
    pad: 1.55,
  },
  titan: {
    draw: drawTitan,
    pal: {
      skin: '#776a5e',
      body: '#4a443e',
      pants: '#2b2724',
      knee: '#8a8f94',
      car: '#7d2f2a',
      concrete: '#9a958a',
      plate: '#5d6064',
    },
    pad: 1.6,
  },
  rey: {
    draw: drawRey,
    pal: { skin: '#5d5a5a', body: '#1d1c20', pants: '#141316', bone: '#d8cfb8', cape: '#3a1218', crown: '#5c5a58' },
    pad: 1.6,
  },
};

/** @type {Record<string, import('./sprites.js').ZSet>} */
const SETS = {};

/** Juego de imágenes del jefe type (se arma la primera vez). */
export function bossSprite(type) {
  if (SETS[type]) return SETS[type];
  const a =
    /** @type {Record<string, { draw: (g: Ctx, r: number, p: Pal, ph: number) => void, pal: Record<string, string>, pad: number }>} */ (
      ART
    )[type];
  const def = /** @type {Record<string, { radius: number, frames: number }>} */ (ZOMBIES)[type];
  // los más grandes con menos resolución (pesan mucho en memoria)
  const scale = def.radius > 60 ? 1.4 : 1.7;
  SETS[type] = buildSet(a.draw, def.radius, def.frames, { ...a.pal, seed: 400 + type.length * 13 }, scale, a.pad);
  return SETS[type];
}

/** Los jefes que tienen figura (para comprobar que no falte ninguno). */
export const BOSS_ART = Object.keys(ART);
