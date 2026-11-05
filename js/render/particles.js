import { rand, TAU, pick } from '../core/util.ts';
import { zombieSprite } from './zombies.js';

const BLOOD = ['#8a1f1a', '#6e1714', '#a3281f', '#5a1210'];

// Tipos de partícula
const DOT = 0;
const SMOKE = 1;
const SPARK = 2;
const CASING = 3;
const EMBER = 4;
const RING = 5;
const FIREBALL = 6;
const CHUNK = 7;
// onda expansiva gruesa de los golpes de jefe (anillo ancho que se adelgaza al abrirse)
const SHOCK = 8;
// tripa: un tramo de intestino que sale volando girando y queda tirado en el suelo
const GUT = 9;
const GUT_COLORS = ['#c45a62', '#b04850', '#d0727a', '#a8424c', '#c97a6e'];
// estela del misil antitanque: segundos que tarda en apagarse, y sus pasadas (ancho, color, opacidad,
// curva: el núcleo se apaga antes que el halo)
const STREAK = 1.6;
/** @type {[number, string, number, number][]} */
const STREAK_PASSES = [
  [9, '255,120,40', 0.16, 1],
  [4, '255,180,90', 0.4, 1.5],
  [1.6, '255,240,200', 0.9, 2.5],
];

// Bola de fuego (se dibuja aditiva y crece mientras se apaga).
let FIRE = null;
function fireSprite() {
  if (FIRE) return FIRE;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,230,1)');
  gr.addColorStop(0.25, 'rgba(255,220,120,0.95)');
  gr.addColorStop(0.55, 'rgba(255,130,40,0.75)');
  gr.addColorStop(0.8, 'rgba(200,60,20,0.35)');
  gr.addColorStop(1, 'rgba(120,20,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  FIRE = c;
  return c;
}

/**
 * Partícula del banco reutilizable (se reescribe entera en `add`).
 * @typedef {object} Particle
 * @property {number} life
 * @property {number} [delay]
 * @property {number} [type]
 * @property {number} [x]
 * @property {number} [y]
 * @property {number} [vx]
 * @property {number} [vy]
 * @property {number} [max]
 * @property {number} [size]
 * @property {string} [color]
 * @property {number} [drag]
 * @property {number} [grow]
 * @property {number} [rot]
 * @property {number} [vr]
 */
export class Particles {
  constructor(max = 1000) {
    this.max = max;
    /** @type {Particle[]} */
    this.p = Array.from({ length: max }, () => ({ life: 0 }));
    this.idx = 0;
    /** Destellos cortos que alumbran la noche (los dibuja lighting.js). @type {{ x: number, y: number, r: number, t: number, max: number }[]} */
    this.lights = [];
    /** Tramos brillantes que deja el misil antitanque y se apagan despacio (también alumbran). @type {{ x0: number, y0: number, x1: number, y1: number, t: number, max: number }[]} */
    this.streaks = [];
  }

  clear() {
    for (const q of this.p) q.life = 0;
    this.lights.length = 0;
    this.streaks.length = 0;
  }

  flash(x, y, r, t) {
    if (this.lights.length >= 24) this.lights.shift();
    this.lights.push({ x, y, r, t, max: t });
  }

  add(type, x, y, vx, vy, life, size, color, drag = 4, grow = 0, delay = 0) {
    const q = this.p[this.idx];
    q.delay = delay;
    this.idx = (this.idx + 1) % this.max;
    q.type = type;
    q.x = x;
    q.y = y;
    q.vx = vx;
    q.vy = vy;
    q.life = life;
    q.max = life;
    q.size = size;
    q.color = color;
    q.drag = drag;
    q.grow = grow;
    q.rot = rand(0, TAU);
    q.vr = rand(-12, 12);
  }

  casing(x, y, a) {
    const s = rand(70, 120);
    const aa = a + rand(-0.3, 0.3);
    this.add(CASING, x, y, Math.cos(aa) * s, Math.sin(aa) * s, 2.5, 1, '#c9a54a', 5);
  }

  muzzleSmoke(x, y, a) {
    for (let i = 0; i < 2; i++) {
      const s = rand(20, 50);
      const aa = a + rand(-0.4, 0.4);
      this.add(SMOKE, x, y, Math.cos(aa) * s, Math.sin(aa) * s, rand(0.4, 0.7), rand(3, 5), '150,145,135', 3, 14);
    }
    for (let i = 0; i < 3; i++) {
      const s = rand(150, 320);
      const aa = a + rand(-0.35, 0.35);
      this.add(SPARK, x, y, Math.cos(aa) * s, Math.sin(aa) * s, rand(0.06, 0.12), 1, '#ffd890', 8);
    }
  }

  impact(x, y, dx, dy) {
    for (let i = 0; i < 4; i++) {
      const a = Math.atan2(-dy, -dx) + rand(-1, 1);
      const s = rand(60, 200);
      this.add(SPARK, x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.08, 0.18), 1, '#f3d79a', 8);
    }
    this.add(SMOKE, x, y, -dx * 20, -dy * 20, 0.5, 3, '120,115,105', 3, 16);
  }

  // Microexplosión de una bala de la torreta pesada: chispazo y un poco de humo, sin humareda.
  // Destello que alumbra, bola de fuego con lenguas que salen, onda del tamaño del radio de daño,
  // chispas, brasas que suben, esquirlas y una voluta de humo (todo crece con la carga explosiva).
  miniBlast(x, y, R) {
    const k = R / 60;
    this.flash(x, y, 140 * k, 0.16);
    this.add(FIREBALL, x, y, 0, 0, 0.2, R * 0.36, '', 0);
    for (let i = 0; i < 3; i++) {
      const a = rand(0, TAU);
      const s = rand(60, 130) * k;
      this.add(
        FIREBALL,
        x + Math.cos(a) * R * 0.1,
        y + Math.sin(a) * R * 0.1,
        Math.cos(a) * s,
        Math.sin(a) * s,
        rand(0.12, 0.2),
        R * rand(0.13, 0.2),
        '',
        6,
      );
    }
    this.add(RING, x, y, 0, 0, 0.22, R * 0.3, '255,226,170', 0, R * 3.4);
    for (let i = 0; i < 9; i++) {
      const a = rand(0, TAU);
      const s = rand(170, 430) * k;
      this.add(
        SPARK,
        x,
        y,
        Math.cos(a) * s,
        Math.sin(a) * s,
        rand(0.1, 0.24),
        1,
        pick(['#fff2d0', '#ffd890', '#ffb060', '#ff8a40']),
        6,
      );
    }
    for (let i = 0; i < 3; i++) {
      this.add(
        EMBER,
        x + rand(-6, 6) * k,
        y + rand(-6, 6) * k,
        rand(-40, 40),
        rand(-110, -50),
        rand(0.4, 0.8),
        rand(1.2, 2.2),
        pick(['#ffcf80', '#ff9a40', '#ffe0a0']),
        1.5,
      );
      const a = rand(0, TAU);
      const s = rand(90, 200) * k;
      this.add(
        DOT,
        x,
        y,
        Math.cos(a) * s,
        Math.sin(a) * s,
        rand(0.25, 0.5),
        rand(1.5, 2.6),
        pick(['#2a2722', '#3a352d']),
        5,
      );
    }
    for (let i = 0; i < 2; i++)
      this.add(
        SMOKE,
        x + rand(-5, 5) * k,
        y + rand(-5, 5) * k,
        rand(-14, 14),
        rand(-36, -14),
        rand(0.6, 1),
        rand(5, 8) * k,
        i ? '62,58,52' : '120,80,50',
        1.6,
        26 * k,
        0.05 + i * 0.05,
      );
  }

  // Impacto sobre un zombi: salpicadura de sangre estilizada en la dirección de la bala.
  hit(x, y, dx, dy, big) {
    const n = big ? 7 : 5;
    const base = Math.atan2(dy, dx);
    for (let i = 0; i < n; i++) {
      const a = base + rand(-0.6, 0.6);
      const s = rand(60, 190);
      this.add(DOT, x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.25, 0.5), rand(1.6, 3.2), pick(BLOOD), 6);
    }
    this.add(SMOKE, x, y, dx * 30, dy * 30, 0.3, 2.5, '120,30,28', 4, 10);
  }

  death(x, y, r) {
    for (let i = 0; i < 10 + r * 0.5; i++) {
      const a = rand(0, TAU);
      const s = rand(30, 110);
      this.add(
        DOT,
        x,
        y,
        Math.cos(a) * s,
        Math.sin(a) * s,
        rand(0.3, 0.7),
        rand(1.5, 3),
        pick(i % 3 ? BLOOD : ['#3a4a2c', '#55503e']),
        5,
      );
    }
    for (let i = 0; i < 3 + r * 0.1; i++) {
      this.add(
        SMOKE,
        x + rand(-r, r) * 0.5,
        y + rand(-r, r) * 0.5,
        rand(-20, 20),
        rand(-20, 20),
        rand(0.6, 1),
        r * 0.3,
        '95,90,78',
        2,
        r * 0.8,
      );
    }
  }

  dust(x, y, r) {
    for (let i = 0; i < 6; i++) {
      const a = rand(0, TAU);
      this.add(
        SMOKE,
        x + Math.cos(a) * r * 0.4,
        y + Math.sin(a) * r * 0.4,
        Math.cos(a) * 40,
        Math.sin(a) * 40,
        rand(0.5, 0.9),
        r * 0.2,
        '110,100,85',
        3,
        r * 0.6,
      );
    }
  }

  ring(x, y, r, color = '200,190,170') {
    this.add(RING, x, y, 0, 0, 0.45, r * 0.4, color, 0, r * 3);
  }

  // Golpe de jefe que hace temblar el suelo (radio r): destello, dos ondas expansivas (una blanca y rápida,
  // otra del color del ataque), piedras y tierra que salen volando, chispas y una nube de polvo en el borde.
  quake(x, y, r, color = '210,180,140') {
    const k = Math.min(2.2, Math.max(0.5, r / 140));
    this.flash(x, y, r * 1.6, 0.22);
    this.add(SHOCK, x, y, 0, 0, 0.32, r * 0.25, '255,245,225', 0, r * 3.4);
    this.add(SHOCK, x, y, 0, 0, 0.6, r * 0.15, color, 0, r * 1.75);
    this.add(RING, x, y, 0, 0, 0.8, r * 0.3, color, 0, r * 1.1);
    const rock = ['#6b5a48', '#8a7660', '#4a3e32', '#a39079', '#3a3129'];
    for (let i = 0; i < 18 + 8 * k; i++) {
      const a = rand(0, TAU);
      const s = rand(120, 460) * k;
      this.add(
        DOT,
        x + Math.cos(a) * r * 0.2,
        y + Math.sin(a) * r * 0.2,
        Math.cos(a) * s,
        Math.sin(a) * s,
        rand(0.5, 1.1),
        rand(3, 7) * Math.min(1.5, k),
        pick(rock),
        3.2,
      );
    }
    for (let i = 0; i < 12; i++) {
      const a = rand(0, TAU);
      const s = rand(200, 520) * k;
      this.add(
        SPARK,
        x,
        y,
        Math.cos(a) * s,
        Math.sin(a) * s,
        rand(0.1, 0.25),
        1,
        pick(['#fff2d0', '#ffd890', `rgb(${color})`]),
        6,
      );
    }
    const n = 10 + Math.round(4 * k);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rand(-0.2, 0.2);
      const s = rand(50, 120) * k;
      this.add(
        SMOKE,
        x + Math.cos(a) * r * 0.75,
        y + Math.sin(a) * r * 0.75,
        Math.cos(a) * s,
        Math.sin(a) * s,
        rand(0.8, 1.4),
        r * 0.12,
        '125,110,90',
        2.2,
        r * 0.35,
      );
    }
    this.add(SMOKE, x, y, 0, 0, 1.2, r * 0.3, '110,96,80', 1, r * 0.5);
  }

  ember(x, y, s = 1) {
    this.add(
      EMBER,
      x + rand(-8, 8) * s,
      y + rand(-8, 8) * s,
      rand(-12, 12),
      rand(-40, -15),
      rand(0.6, 1.4),
      rand(1, 2.2),
      pick(['#f0a050', '#e07a30', '#ffcf80']),
      0.5,
    );
    if (Math.random() < 0.35) {
      this.add(
        SMOKE,
        x + rand(-6, 6),
        y + rand(-6, 6),
        rand(-8, 8),
        rand(-30, -10),
        rand(1.2, 2.2),
        6 * s,
        '60,58,55',
        0.5,
        22 * s,
      );
    }
  }

  explosion(x, y, R) {
    this.ring(x, y, R * 0.55, '255,190,120');
    for (let i = 0; i < 26; i++) {
      const a = rand(0, TAU);
      const s = rand(150, 520);
      this.add(
        SPARK,
        x,
        y,
        Math.cos(a) * s,
        Math.sin(a) * s,
        rand(0.12, 0.3),
        1,
        pick(['#ffd890', '#ffb060', '#fff2d0']),
        5,
      );
    }
    for (let i = 0; i < 14; i++) {
      const a = rand(0, TAU);
      const s = rand(30, 140);
      this.add(
        SMOKE,
        x + Math.cos(a) * 10,
        y + Math.sin(a) * 10,
        Math.cos(a) * s,
        Math.sin(a) * s,
        rand(0.8, 1.6),
        rand(10, 20),
        i < 5 ? '230,140,60' : '70,66,60',
        2.5,
        40,
      );
    }
    for (let i = 0; i < 18; i++) {
      const a = rand(0, TAU);
      const s = rand(80, 260);
      this.add(
        DOT,
        x,
        y,
        Math.cos(a) * s,
        Math.sin(a) * s,
        rand(0.4, 0.9),
        rand(2, 4),
        pick(['#3a352d', '#55503e', '#2a2722']),
        4,
      );
    }
  }

  // reventón verde del gordo: chorros de ácido y vapor
  acidBurst(x, y, R) {
    this.ring(x, y, R * 0.6, '150,230,70');
    for (let i = 0; i < 40; i++) {
      const a = rand(0, TAU);
      const s = rand(90, 420);
      this.add(
        DOT,
        x,
        y,
        Math.cos(a) * s,
        Math.sin(a) * s,
        rand(0.3, 0.7),
        rand(2, 5),
        pick(['#8fd13a', '#6fae22', '#c4f060', '#4f8a1c']),
        4,
      );
    }
    for (let i = 0; i < 12; i++) {
      const a = rand(0, TAU);
      const s = rand(20, 90);
      this.add(
        SMOKE,
        x + Math.cos(a) * 8,
        y + Math.sin(a) * 8,
        Math.cos(a) * s,
        Math.sin(a) * s,
        rand(0.9, 1.8),
        rand(10, 18),
        i < 6 ? '130,200,60' : '80,110,50',
        2.5,
        34,
      );
    }
  }

  // zombi en llamas: brasas que suben y humo negro
  burning(x, y, r) {
    this.add(
      EMBER,
      x + rand(-r, r) * 0.6,
      y + rand(-r, r) * 0.6,
      rand(-15, 15),
      rand(-70, -30),
      rand(0.4, 0.8),
      rand(1.2, 2.4),
      pick(['#ffb050', '#ff7a20', '#ffe08a']),
      0.5,
    );
    if (Math.random() < 0.45)
      this.add(
        SMOKE,
        x + rand(-4, 4),
        y + rand(-4, 4),
        rand(-10, 10),
        rand(-40, -18),
        rand(0.8, 1.4),
        r * 0.35,
        '35,30,26',
        0.6,
        r * 1.4,
      );
  }

  // impacto del cohete: una bola de fuego corta y después el humo que sube
  rocketImpact(x, y, R) {
    this.add(FIREBALL, x, y, 0, 0, 0.32, R * 0.42, '', 0);
    for (let i = 0; i < 4; i++) {
      const a = rand(0, TAU);
      this.add(
        FIREBALL,
        x + Math.cos(a) * R * 0.15,
        y + Math.sin(a) * R * 0.15,
        Math.cos(a) * 60,
        Math.sin(a) * 60,
        rand(0.18, 0.3),
        R * rand(0.16, 0.26),
        '',
        3,
      );
    }
    for (let i = 0; i < 16; i++) {
      const a = rand(0, TAU);
      const s = rand(20, 70);
      this.add(
        SMOKE,
        x + Math.cos(a) * R * 0.2,
        y + Math.sin(a) * R * 0.2,
        Math.cos(a) * s,
        Math.sin(a) * s - 25,
        rand(1.6, 2.8),
        rand(10, 18),
        i < 4 ? '90,80,70' : '58,55,52',
        1.2,
        22,
        rand(0.18, 0.35),
      );
    }
    for (let i = 0; i < 14; i++) {
      const a = rand(0, TAU);
      const s = rand(200, 480);
      this.add(
        SPARK,
        x,
        y,
        Math.cos(a) * s,
        Math.sin(a) * s,
        rand(0.12, 0.28),
        1,
        pick(['#ffd890', '#ffb060', '#fff2d0']),
        5,
      );
    }
  }

  // Bomba lapa: chispazo rojo al soltarla de la mano.
  stickyThrow(x, y, a) {
    for (let i = 0; i < 8; i++) {
      const aa = a + rand(-0.5, 0.5);
      const s = rand(120, 300);
      this.add(SPARK, x, y, Math.cos(aa) * s, Math.sin(aa) * s, rand(0.08, 0.2), 1, pick(['#ff5a3a', '#ffb090']), 7);
    }
    this.add(SMOKE, x, y, Math.cos(a) * 30, Math.sin(a) * 30, 0.4, 4, '150,145,135', 3, 12);
  }

  // Se pega: chispas, golpe rojo y un destello.
  stickyStick(x, y) {
    for (let i = 0; i < 12; i++) {
      const a = rand(0, TAU);
      const s = rand(80, 260);
      this.add(SPARK, x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.1, 0.22), 1, pick(['#ff6a40', '#ffd0a0']), 7);
    }
    this.ring(x, y, 22, '255,60,40');
    this.flash(x, y, 70, 0.12);
  }

  // Cada pitido: un anillo rojo que se abre y un destello que alumbra.
  stickyBlink(x, y) {
    this.add(RING, x, y, 0, 0, 0.28, 4, '255,40,30', 0, 70);
    this.flash(x, y, 55, 0.08);
  }

  // El estallido de la bomba lapa: destello enorme, bola de fuego con lenguas, dos ondas, lluvia de
  // chispas, cascotes, brasas y una columna de humo que tarda en irse.
  stickyBlast(x, y, R) {
    this.flash(x, y, R * 2.6, 0.55);
    this.add(FIREBALL, x, y, 0, 0, 0.5, R * 0.62, '', 0);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU + rand(-0.2, 0.2);
      const s = rand(160, 340);
      this.add(
        FIREBALL,
        x + Math.cos(a) * R * 0.12,
        y + Math.sin(a) * R * 0.12,
        Math.cos(a) * s,
        Math.sin(a) * s,
        rand(0.28, 0.5),
        R * rand(0.2, 0.32),
        '',
        3.5,
      );
    }
    this.add(RING, x, y, 0, 0, 0.5, R * 0.3, '255,245,220', 0, R * 3.2);
    this.add(RING, x, y, 0, 0, 0.7, R * 0.2, '255,110,50', 0, R * 2.2, 0.07);
    for (let i = 0; i < 50; i++) {
      const a = rand(0, TAU);
      const s = rand(250, 900);
      this.add(
        SPARK,
        x,
        y,
        Math.cos(a) * s,
        Math.sin(a) * s,
        rand(0.15, 0.4),
        1,
        pick(['#ffd890', '#ffb060', '#fff2d0', '#ff6a40']),
        4,
      );
    }
    for (let i = 0; i < 30; i++) {
      const a = rand(0, TAU);
      const s = rand(120, 440);
      this.add(
        DOT,
        x,
        y,
        Math.cos(a) * s,
        Math.sin(a) * s,
        rand(0.5, 1.1),
        rand(2.5, 5),
        pick(['#3a352d', '#55503e', '#2a2722']),
        3.5,
      );
    }
    for (let i = 0; i < 22; i++) this.ember(x + rand(-R, R) * 0.3, y + rand(-R, R) * 0.3, 1.4);
    for (let i = 0; i < 24; i++) {
      const a = rand(0, TAU);
      const s = rand(20, 110);
      this.add(
        SMOKE,
        x + Math.cos(a) * R * 0.25,
        y + Math.sin(a) * R * 0.25,
        Math.cos(a) * s,
        Math.sin(a) * s - 30,
        rand(1.8, 3.2),
        rand(14, 26),
        i < 6 ? '120,70,40' : '52,50,48',
        1.1,
        50,
        rand(0.15, 0.4),
      );
    }
  }

  // el gordo revienta: trozos de carne, chorros de sangre por todos lados
  gore(x, y, R) {
    for (let i = 0; i < 26; i++) {
      const a = rand(0, TAU);
      const s = rand(150, 520);
      this.add(
        CHUNK,
        x,
        y,
        Math.cos(a) * s,
        Math.sin(a) * s,
        rand(0.6, 1.2),
        rand(4, 9),
        pick(['#a8ad7e', '#9fa676', '#8a2a20', '#b0b287']),
        3.5,
      );
    }
    for (let i = 0; i < 60; i++) {
      const a = rand(0, TAU);
      const s = rand(80, 600);
      this.add(DOT, x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.3, 0.9), rand(2, 6), pick(BLOOD), 3);
    }
    this.ring(x, y, R * 0.7, '200,60,40');
  }

  // Mordida de zombi (al jugador muerto): chorro de sangre hacia a, gotas y algún trozo de carne.
  bite(x, y, a) {
    for (let i = 0; i < 22; i++) {
      const aa = a + rand(-0.7, 0.7);
      const s = rand(90, 380);
      this.add(DOT, x, y, Math.cos(aa) * s, Math.sin(aa) * s, rand(0.3, 0.8), rand(2, 5), pick(BLOOD), 3.5);
    }
    for (let i = 0; i < 3; i++) {
      const aa = a + rand(-0.9, 0.9);
      const s = rand(80, 240);
      this.add(CHUNK, x, y, Math.cos(aa) * s, Math.sin(aa) * s, rand(0.8, 1.4), rand(3, 6), pick(BLOOD), 4);
    }
  }

  // Tripas que salen volando (n tramos, power: qué tan lejos) con sangre; quedan un rato en el suelo.
  guts(x, y, n = 8, power = 1) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const s = rand(110, 420) * power;
      this.add(GUT, x, y, Math.cos(a) * s, Math.sin(a) * s, rand(4.5, 6.5), rand(3.5, 5.5), pick(GUT_COLORS), 3);
    }
    for (let i = 0; i < 10 + n * 3; i++) {
      const a = rand(0, TAU);
      const s = rand(60, 520) * power;
      this.add(DOT, x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.4, 1), rand(2, 6), pick(BLOOD), 3);
    }
  }

  // estela de humo y chispas del cohete
  rocketTrail(x, y, dx, dy) {
    this.add(
      SMOKE,
      x - dx * 10 + rand(-2, 2),
      y - dy * 10 + rand(-2, 2),
      -dx * 30 + rand(-10, 10),
      -dy * 30 + rand(-10, 10),
      rand(0.6, 1.1),
      4,
      '180,175,165',
      1.5,
      16,
    );
    this.add(
      EMBER,
      x - dx * 12,
      y - dy * 12,
      -dx * 90 + rand(-30, 30),
      -dy * 90 + rand(-30, 30),
      rand(0.1, 0.25),
      rand(1.2, 2.2),
      pick(['#ffd890', '#ffb060']),
      3,
    );
  }

  // estela del misil antitanque: un trazo encendido que se queda marcando su recorrido y se apaga
  // despacio, humo gris y brasas. len: lo que avanzó en este paso.
  atgmTrail(x, y, dx, dy, len = 10) {
    if (this.streaks.length >= 160) this.streaks.shift();
    this.streaks.push({
      x0: x - dx * (12 + len),
      y0: y - dy * (12 + len),
      x1: x - dx * 12,
      y1: y - dy * 12,
      t: STREAK,
      max: STREAK,
    });
    this.add(
      SMOKE,
      x - dx * 14 + rand(-3, 3),
      y - dy * 14 + rand(-3, 3),
      -dx * 20 + rand(-12, 12),
      -dy * 20 + rand(-12, 12),
      rand(1.1, 1.8),
      rand(5, 7),
      pick(['110,106,98', '86,82,76', '132,126,116']),
      1.6,
      16,
    );
    for (let i = 0; i < 2; i++)
      this.add(
        EMBER,
        x - dx * (12 + i * 6) + rand(-1.5, 1.5),
        y - dy * (12 + i * 6) + rand(-1.5, 1.5),
        -dx * 40 + rand(-20, 20),
        -dy * 40 + rand(-20, 20),
        rand(0.3, 0.55),
        rand(1.6, 2.6),
        pick(['#fff2c0', '#ffd070', '#ffa040']),
        5,
      );
  }

  drawStreaks(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const [w, c, a, pw] of STREAK_PASSES) {
      ctx.lineWidth = w;
      for (const s of this.streaks) {
        const k = Math.max(0, s.t / s.max);
        ctx.strokeStyle = `rgba(${c},${(a * k ** pw).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(s.x0, s.y0);
        ctx.lineTo(s.x1, s.y1);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // disparo de la torreta militar: fogonazo y una nube de humo negro que sale de la boca y del rebufo
  militaryFire(x, y, a) {
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    this.add(FIREBALL, x + ca * 6, y + sa * 6, ca * 120, sa * 120, 0.16, 18, '', 6);
    this.flash(x, y, 150, 0.12);
    for (let i = 0; i < 18; i++) {
      const aa = a + rand(-0.6, 0.6);
      const s = rand(40, 180);
      this.add(
        SMOKE,
        x,
        y,
        Math.cos(aa) * s,
        Math.sin(aa) * s,
        rand(1.4, 2.6),
        rand(6, 11),
        pick(['18,16,15', '28,25,23', '40,36,33']),
        2.4,
        rand(14, 24),
      );
    }
    // el humo que escupe hacia atrás la torre
    for (let i = 0; i < 10; i++) {
      const aa = a + Math.PI + rand(-0.7, 0.7);
      const s = rand(30, 110);
      this.add(
        SMOKE,
        x - ca * 70,
        y - sa * 70,
        Math.cos(aa) * s,
        Math.sin(aa) * s,
        rand(1.2, 2),
        rand(6, 10),
        pick(['22,20,18', '36,33,30']),
        2.4,
        18,
      );
    }
    for (let i = 0; i < 8; i++) {
      const aa = a + rand(-0.3, 0.3);
      const s = rand(250, 520);
      this.add(SPARK, x, y, Math.cos(aa) * s, Math.sin(aa) * s, rand(0.08, 0.16), 1, '#ffd890', 7);
    }
  }

  // rebufo de la bazuca hacia atrás
  backblast(x, y, a) {
    for (let i = 0; i < 10; i++) {
      const aa = a + rand(-0.45, 0.45);
      const s = rand(60, 220);
      this.add(SMOKE, x, y, Math.cos(aa) * s, Math.sin(aa) * s, rand(0.6, 1.2), rand(5, 9), '170,165,155', 3, 26);
    }
  }

  // botella rota: vidrio y llamarada
  // Un rocoso hizo pedazos un árbol o un coche: astillas y hojas, o chatarra y vidrios, y polvo.
  debris(x, y, r, kind) {
    const car = kind === 'car';
    const colors = car ? ['#5d6166', '#7d8186', '#3a3c3f', '#a8a294'] : ['#5a4030', '#7a5634', '#3a4a2c', '#4f6236'];
    for (let i = 0; i < 26; i++) {
      const a = rand(0, TAU);
      const s = rand(60, 280);
      this.add(DOT, x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.5, 1.1), rand(2.5, 6), pick(colors), 3.5);
    }
    if (car) {
      for (let i = 0; i < 12; i++) {
        const a = rand(0, TAU);
        const s = rand(90, 300);
        this.add(
          SPARK,
          x,
          y,
          Math.cos(a) * s,
          Math.sin(a) * s,
          rand(0.15, 0.4),
          1,
          pick(['#cfe8e0', '#9fc4b8', '#ffd890']),
          6,
        );
      }
    }
    for (let i = 0; i < 3; i++) this.dust(x + rand(-r, r) * 0.5, y + rand(-r, r) * 0.5, r);
  }

  shatter(x, y) {
    for (let i = 0; i < 14; i++) {
      const a = rand(0, TAU);
      const s = rand(80, 260);
      this.add(
        SPARK,
        x,
        y,
        Math.cos(a) * s,
        Math.sin(a) * s,
        rand(0.15, 0.35),
        1,
        pick(['#cfe8e0', '#9fc4b8', '#ffd890']),
        6,
      );
    }
    for (let i = 0; i < 16; i++) {
      const a = rand(0, TAU);
      const s = rand(40, 160);
      this.add(
        EMBER,
        x,
        y,
        Math.cos(a) * s,
        Math.sin(a) * s - 30,
        rand(0.4, 0.9),
        rand(1.5, 3),
        pick(['#ffb050', '#ff7a20', '#ffe08a']),
        2,
      );
    }
    this.add(SMOKE, x, y, 0, -20, 1.4, 14, '230,120,40', 1.5, 40);
  }

  pickupFx(x, y, color) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      this.add(SPARK, x, y, Math.cos(a) * 120, Math.sin(a) * 120, 0.2, 1, color, 6);
    }
  }

  update(dt) {
    for (let i = this.lights.length - 1; i >= 0; i--) if ((this.lights[i].t -= dt) <= 0) this.lights.splice(i, 1);
    for (const s of this.streaks) s.t -= dt;
    while (this.streaks.length && this.streaks[0].t <= 0) this.streaks.shift();
    for (const q of this.p) {
      if (q.life <= 0) continue;
      if (q.delay > 0) {
        q.delay -= dt;
        continue;
      }
      q.life -= dt;
      const d = Math.exp(-q.drag * dt);
      q.vx *= d;
      q.vy *= d;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.size += q.grow * dt;
      q.rot += q.vr * dt * (Math.abs(q.vx) + Math.abs(q.vy) > 5 ? 1 : 0);
    }
  }

  draw(ctx, view) {
    if (this.streaks.length) this.drawStreaks(ctx);
    for (const q of this.p) {
      if (q.life <= 0) continue;
      if (q.delay > 0 || q.x < view.x0 - 40 || q.x > view.x1 + 40 || q.y < view.y0 - 40 || q.y > view.y1 + 40) continue;
      const t = q.life / q.max;
      switch (q.type) {
        case DOT:
          ctx.globalAlpha = Math.min(1, t * 2);
          ctx.fillStyle = q.color;
          ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
          break;
        case SMOKE:
          ctx.globalAlpha = 1;
          ctx.fillStyle = `rgba(${q.color},${0.3 * t})`;
          ctx.beginPath();
          ctx.arc(q.x, q.y, q.size, 0, TAU);
          ctx.fill();
          break;
        case SPARK: {
          ctx.globalAlpha = Math.min(1, t * 3);
          ctx.strokeStyle = q.color;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(q.x, q.y);
          ctx.lineTo(q.x - q.vx * 0.025, q.y - q.vy * 0.025);
          ctx.stroke();
          break;
        }
        case CASING:
          ctx.globalAlpha = Math.min(1, t * 2);
          ctx.save();
          ctx.translate(q.x, q.y);
          ctx.rotate(q.rot);
          ctx.fillStyle = q.color;
          ctx.fillRect(-2, -1, 4, 2);
          ctx.restore();
          break;
        case EMBER:
          ctx.globalAlpha = t * (0.6 + Math.random() * 0.4);
          ctx.fillStyle = q.color;
          ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
          break;
        case FIREBALL: {
          const s = q.size * (0.6 + (1 - t) * 0.9);
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = Math.min(1, t * 1.6);
          ctx.drawImage(fireSprite(), q.x - s, q.y - s, s * 2, s * 2);
          ctx.globalCompositeOperation = 'source-over';
          break;
        }
        case CHUNK:
          // trozo de carne que vuela girando
          ctx.globalAlpha = Math.min(1, t * 3);
          ctx.save();
          ctx.translate(q.x, q.y);
          ctx.rotate(q.rot);
          ctx.fillStyle = q.color;
          ctx.fillRect(-q.size / 2, -q.size / 3, q.size, q.size * 0.66);
          ctx.fillStyle = '#5e1411';
          ctx.fillRect(-q.size / 2, -q.size / 3, q.size * 0.4, q.size * 0.66);
          ctx.restore();
          break;
        case GUT: {
          // tramo de intestino ondulado, con borde oscuro y brillo húmedo; gira mientras vuela
          ctx.globalAlpha = Math.min(1, t * 5);
          ctx.save();
          ctx.translate(q.x, q.y);
          ctx.rotate(q.rot);
          const L = q.size * 6;
          const w = q.size;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(-L / 2, 0);
          for (let i = 1; i <= 6; i++) ctx.lineTo(-L / 2 + (L * i) / 6, Math.sin(i * 1.9 + q.size * 3) * w * 0.9);
          ctx.strokeStyle = '#5e161b';
          ctx.lineWidth = w + 2;
          ctx.stroke();
          ctx.strokeStyle = q.color;
          ctx.lineWidth = w;
          ctx.stroke();
          ctx.strokeStyle = 'rgba(255,215,215,0.35)';
          ctx.lineWidth = w * 0.3;
          ctx.stroke();
          ctx.restore();
          break;
        }
        case SHOCK:
          ctx.globalAlpha = t * 0.55;
          ctx.strokeStyle = `rgb(${q.color})`;
          ctx.lineWidth = 16 * t + 2;
          ctx.beginPath();
          ctx.arc(q.x, q.y, q.size, 0, TAU);
          ctx.stroke();
          ctx.globalAlpha = t * 0.9;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(q.x, q.y, q.size + 8 * t, 0, TAU);
          ctx.stroke();
          break;
        case RING:
          ctx.globalAlpha = t * 0.6;
          ctx.strokeStyle = `rgb(${q.color})`;
          ctx.lineWidth = 3 * t + 1;
          ctx.beginPath();
          ctx.arc(q.x, q.y, q.size, 0, TAU);
          ctx.stroke();
          break;
      }
    }
    ctx.globalAlpha = 1;
  }
}

// Restos en el suelo: cuerpos que caen con una animación (varias variantes),
// charcos de sangre estilizada y salpicaduras. Todo tiene tope y se desvanece solo.
const POOLS = [];
const ACID_POOLS = [];
function poolSprite(seed, dark = '#5e1411', light = 'rgba(160,40,32,0.45)') {
  const size = 96;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  let s = seed;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  g.fillStyle = dark;
  g.beginPath();
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU;
    const d = 26 + r() * 14;
    g.lineTo(48 + Math.cos(a) * d, 48 + Math.sin(a) * d * 0.8);
  }
  g.closePath();
  g.fill();
  for (let i = 0; i < 7; i++) {
    const a = r() * TAU;
    const d = 34 + r() * 10;
    g.beginPath();
    g.arc(48 + Math.cos(a) * d, 48 + Math.sin(a) * d * 0.8, 3 + r() * 5, 0, TAU);
    g.fill();
  }
  g.fillStyle = light;
  g.beginPath();
  g.ellipse(42, 42, 14, 9, -0.5, 0, TAU);
  g.fill();
  return c;
}

// Grieta en el suelo de un golpe de jefe: hundimiento oscuro en el centro y rajaduras que se ramifican.
const CRACKS = [];
function crackSprite(seed) {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  let s = seed;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const m = size / 2;
  const gr = g.createRadialGradient(m, m, 2, m, m, 26);
  gr.addColorStop(0, 'rgba(20,16,12,0.75)');
  gr.addColorStop(0.6, 'rgba(40,32,24,0.35)');
  gr.addColorStop(1, 'rgba(40,32,24,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const crack = (x, y, a, len, w) => {
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(x, y);
    let d = 0;
    while (d < len) {
      const step = 5 + r() * 6;
      a += (r() - 0.5) * 0.9;
      x += Math.cos(a) * step;
      y += Math.sin(a) * step;
      d += step;
      g.lineTo(x, y);
      // ramas que salen de lado
      if (w > 1.2 && r() < 0.12) crack(x, y, a + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.6), (len - d) * 0.6, w * 0.55);
    }
    g.stroke();
  };
  const n = 7 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + (r() - 0.5) * 0.5;
    g.strokeStyle = 'rgba(18,14,10,0.85)';
    crack(m + Math.cos(a) * 6, m + Math.sin(a) * 6, a, 34 + r() * 26, 3.2);
  }
  // borde claro de tierra levantada
  g.strokeStyle = 'rgba(190,170,140,0.25)';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(m, m, 14 + r() * 4, 0, TAU);
  g.stroke();
  return c;
}

export class Decals {
  constructor(max = 150, maxPools = 200) {
    this.max = max;
    this.maxPools = maxPools;
    this.list = [];
    this.pools = [];
    if (!POOLS.length) for (let i = 1; i <= 4; i++) POOLS.push(poolSprite(i * 7919));
    if (!ACID_POOLS.length)
      for (let i = 1; i <= 3; i++) ACID_POOLS.push(poolSprite(i * 4801, '#4f8a1c', 'rgba(190,255,90,0.5)'));
  }
  clear() {
    this.list.length = 0;
    this.pools.length = 0;
  }
  // dx, dy: dirección del último impacto, para caer hacia ese lado
  corpse(z, dx = 0, dy = 0) {
    const spr = zombieSprite(z);
    if (this.list.length >= this.max) this.list.shift();
    const l = Math.hypot(dx, dy) || 1;
    const fx = dx / l;
    const fy = dy / l;
    const variant = (Math.random() * 3) | 0;
    // una explosión fuerte (dirección de más de 1) lanza el cuerpo mucho más lejos
    const power = Math.min(5, Math.max(1, l));
    const slide = (variant === 0 ? rand(10, 18) : variant === 1 ? rand(4, 8) : rand(2, 5)) * power;
    const spin =
      (variant === 1 ? rand(0.9, 1.6) * (Math.random() < 0.5 ? -1 : 1) : rand(-0.5, 0.5)) * (power > 1.5 ? 3 : 1);
    // lanzado por una explosión: vuela en arco antes de caer
    const lift = power > 1.5 ? power * rand(8, 12) : 0;
    this.list.push({
      img: z.burnt ? spr.burnt : spr.dead,
      x: z.x,
      y: z.y,
      x0: z.x,
      y0: z.y,
      x1: z.x + fx * slide * (z.r / 13),
      y1: z.y + fy * slide * (z.r / 13),
      a0: z.angle,
      a1: z.angle + spin,
      half: spr.half,
      t: 0,
      fall: (variant === 2 ? 0.55 : 0.4) + (lift ? 0.35 : 0),
      lift,
      shrink: variant === 2 ? 0.82 : 0.92,
      life: z.type === 'heavy' || z.type === 'fat' ? 26 : 16,
    });
    if (this.pools.length >= this.maxPools) this.pools.shift();
    this.pools.push({
      img: POOLS[(Math.random() * POOLS.length) | 0],
      x: z.x + fx * slide * 1.2,
      y: z.y + fy * slide * 1.2,
      a: rand(0, TAU),
      size: z.r * rand(2.6, 3.4),
      t: 0,
      life: 22,
      delay: 0.3,
    });
  }
  splat(x, y, size) {
    if (this.pools.length >= this.maxPools) this.pools.shift();
    this.pools.push({
      img: POOLS[(Math.random() * POOLS.length) | 0],
      x,
      y,
      a: rand(0, TAU),
      size,
      t: 0,
      life: 9,
      delay: 0,
    });
  }
  // gota del rastro de sangre de un zombi herido
  drip(x, y) {
    if (this.pools.length >= this.maxPools) this.pools.shift();
    this.pools.push({
      img: POOLS[(Math.random() * POOLS.length) | 0],
      x,
      y,
      a: rand(0, TAU),
      size: rand(2.5, 4.5),
      t: 0,
      life: 8,
      delay: 0,
    });
  }
  // grieta en el suelo de un golpe de jefe (radio r)
  crack(x, y, r) {
    if (!CRACKS.length) for (let i = 1; i <= 4; i++) CRACKS.push(crackSprite(i * 6151));
    if (this.pools.length >= this.maxPools) this.pools.shift();
    this.pools.push({
      img: CRACKS[(Math.random() * CRACKS.length) | 0],
      x,
      y,
      a: rand(0, TAU),
      size: r * 0.9,
      t: 0,
      life: 14,
      delay: 0,
    });
  }
  // charco de ácido del gordo al reventar
  acid(x, y, size) {
    if (this.pools.length >= this.maxPools) this.pools.shift();
    this.pools.push({
      img: ACID_POOLS[(Math.random() * ACID_POOLS.length) | 0],
      x,
      y,
      a: rand(0, TAU),
      size,
      t: 0,
      life: 14,
      delay: 0,
    });
  }
  update(dt) {
    for (const d of this.list) {
      d.t += dt;
      const k = Math.min(1, d.t / d.fall);
      const e = 1 - (1 - k) * (1 - k);
      d.x = d.x0 + (d.x1 - d.x0) * e;
      d.y = d.y0 + (d.y1 - d.y0) * e;
    }
    for (const p of this.pools) p.t += dt;
    while (this.list.length && this.list[0].t > this.list[0].life) this.list.shift();
    while (this.pools.length && this.pools[0].t > this.pools[0].life) this.pools.shift();
  }
  drawPools(ctx, view) {
    for (const p of this.pools) {
      if (p.x + p.size < view.x0 || p.x - p.size > view.x1 || p.y + p.size < view.y0 || p.y - p.size > view.y1)
        continue;
      const tt = p.t - p.delay;
      if (tt <= 0) continue;
      const grow = Math.min(1, tt / 1.1);
      const s = p.size * (0.35 + 0.65 * (1 - (1 - grow) * (1 - grow)));
      ctx.globalAlpha = 0.7 * Math.min(1, (p.life - p.t) / 4);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.a);
      ctx.drawImage(p.img, -s, -s, s * 2, s * 2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  draw(ctx, view) {
    for (const d of this.list) {
      if (d.x + d.half < view.x0 || d.x - d.half > view.x1 || d.y + d.half < view.y0 || d.y - d.half > view.y1)
        continue;
      const k = Math.min(1, d.t / d.fall);
      const e = 1 - (1 - k) * (1 - k);
      const fadeOut = Math.min(1, (d.life - d.t) / 3);
      ctx.globalAlpha = (0.95 - 0.1 * e) * fadeOut;
      ctx.save();
      const up = d.lift && k < 1 ? Math.sin(k * Math.PI) * d.lift : 0;
      ctx.translate(d.x, d.y - up);
      ctx.rotate(d.a0 + (d.a1 - d.a0) * e);
      const sc = (1 - (1 - d.shrink) * e) * (1 + up / 70);
      ctx.scale(sc, sc * (1 - 0.08 * e));
      ctx.drawImage(d.img, -d.half, -d.half, d.half * 2, d.half * 2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}
