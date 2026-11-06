// Manual de supervivencia (menú): un libro viejo con cadenas y candado. Al tocarlo el candado tiembla,
// las cadenas revientan y caen, se le sacude el polvo a la tapa y el libro se abre con las hojas
// pasando solas. Dentro, una página por zombi y por jefe: su dibujo animado, de qué oleada sale, su
// vida, velocidad y daño, cómo es y sus debilidades. Se ve una página a la vez y se pasa de una en una
// con los botones, tocando la página, deslizando el dedo o con las flechas.
import { BOSS, BOSS_ORDER, BOSSES, DEMON, ROCK, ZOMBIES } from '../core/config.ts';
import { rand, TAU } from '../core/util.ts';
import { zombieSprites } from '../render/sprites.js';
import { bossSprite } from '../render/bossart.js';
import { on } from './dom.js';

/**
 * Los zombis comunes, en el orden en que aparecen. from: oleada (0: raro, en cualquier ronda).
 * @type {{ type: string, name: string, from: number, look: string, weak: string[], warn: string[] }[]}
 */
const COMMON = [
  {
    type: 'normal',
    name: 'Caminante',
    from: 1,
    look: 'El de siempre. Ya no es lento: llega en hordas de cientos por cada oleada.',
    weak: [
      'Con una o dos balas cae',
      'Si le das y no muere se frena, se desangra y se arrastra',
      'En grupo: granadas, molotov y escopeta',
    ],
    warn: ['Nunca viene solo: no te dejes rodear'],
  },
  {
    type: 'sprinter',
    name: 'Velocista',
    from: 1,
    look: 'Flaco y desesperado. Corre más que tú caminando.',
    weak: ['La menor vida de todos: una bala basta', 'Las balas lo frenan como a los caminantes'],
    warn: ['Te alcanza si no corres o no le disparas antes de que llegue'],
  },
  {
    type: 'swat',
    name: 'Policía SWAT',
    from: 2,
    look: 'Un policía con su escudo al brazo. Aguanta ocho veces más que un caminante.',
    weak: [
      'Es lento: mantén la distancia y no dejes de disparar',
      'Los explosivos y las armas pesadas lo tumban rápido',
    ],
    warn: ['Con munición escasa se come tus cargadores'],
  },
  {
    type: 'fat',
    name: 'Gordo',
    from: 2,
    look: 'Grande y lento, aguanta unas tres veces más que un caminante.',
    weak: [
      'Un cohete o misil se le queda pegado y lo revienta',
      'La bomba lapa lo revienta de una',
      'Es de los más lentos: lo ves venir',
    ],
    warn: ['Al morir revienta en ácido verde: si te salpica te quema 5 s. Mátalo lejos de ti'],
  },
  {
    type: 'bull',
    name: 'Toro',
    from: 3,
    look: 'Musculoso, bronceado y con cuernos de hueso. Al verte escarba y embiste.',
    weak: [
      'Escarba antes de embestir: es tu aviso para hacerte a un lado',
      'Una barricada lo entretiene: la embiste una y otra vez',
    ],
    warn: ['Su embestida te lanza y te quita 40 de vida'],
  },
  {
    type: 'rock',
    name: 'Rocoso',
    from: ROCK.from,
    look: 'Un zombi recubierto de roca, mucho más grande que un gordo. Va recto hacia ti.',
    weak: [
      'El más lento de todos: aléjate y dispárale sin parar',
      'Las explosiones sí lo mueven; la bomba lapa le arranca la mitad de su vida',
    ],
    warn: ['Las balas no lo frenan', 'Destroza árboles, coches y barricadas', 'Si te agarra te lanza hacia la horda'],
  },
  {
    type: 'demon',
    name: 'Demonio rojo',
    from: DEMON.from,
    look: 'Alto como un jefe y flaco, de piel roja, con máscara de madera y los brazos destrozados.',
    weak: [
      '¡El fuego! Lanzallamas, molotov y balas incendiarias lo matan 4 veces más rápido',
      'Sólo salta si te ve: ponte detrás de una pared o barricada',
    ],
    warn: [
      'El más rápido de todos y a ratos corre como loco',
      'Salta hacia ti desde lejos y te golpea al caer',
      'Las balas no lo frenan',
    ],
  },
  {
    type: 'heavy',
    name: 'Super blindado',
    from: 11,
    look: 'Un gordo con armadura militar. Aguanta cincuenta veces más que un caminante.',
    weak: [
      'Explosivos: casi la mitad de las balas le rebotan, las explosiones no',
      'Un cohete o misil se le queda pegado y estalla',
      'Es muy lento',
    ],
    warn: ['Sus super golpes te quitan 30, te avientan y destrozan barricadas'],
  },
  {
    type: 'golden',
    name: 'Zombi dorado',
    from: 0,
    look: 'Raro: aparece de vez en cuando durante una ronda. No ataca, sólo huye.',
    weak: ['No se defiende: persíguelo y dispárale', 'Si lo matas da entre $100 y $250'],
    warn: ['Desaparece a los 26 s si no lo alcanzas'],
  },
];

const LIST_SPEED = Math.max(...COMMON.map((c) => ZOMBIES[c.type].speed));
const LIST_DMG = Math.max(...COMMON.map((c) => ZOMBIES[c.type].damage));

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const num = (n) => Math.round(n).toLocaleString('es-MX');

// Barra de una cifra (la vida va en escala logarítmica: de 26 a 4200 no cabría de otro modo).
function bar(label, k, text) {
  return `<div class="pg-stat"><span>${label}</span><i><b style="width:${Math.round(Math.max(0.06, Math.min(1, k)) * 100)}%"></b></i><em>${text}</em></div>`;
}

function portrait(type, boss) {
  return `<div class="pg-photo"><canvas class="pg-z" data-z="${type}"${boss ? ' data-boss="1"' : ''}></canvas></div>`;
}

const list = (cls, title, items) =>
  `<h4 class="${cls}">${title}</h4><ul class="${cls}">${items.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>`;

// Una página: dos partes (a: quién es; b: qué hacer). En una página ancha van lado a lado; en una alta,
// una debajo de otra.
const pg = (a, b) => ({ a, b });

/** Las páginas del libro, en orden (una por toque). */
function buildPages() {
  const pages = [];
  const index = [];
  pages.push(null);
  for (const c of COMMON) {
    const z = ZOMBIES[c.type];
    index.push({ name: c.name, i: pages.length });
    pages.push(
      pg(
        `<p class="pg-kicker">${c.from ? `Desde la oleada ${c.from}` : 'Raro · en cualquier ronda'}</p>` +
          `<h3>${esc(c.name)}</h3>${portrait(c.type, false)}` +
          `<div class="pg-stats">${bar('Vida', Math.log(z.hp / 20) / Math.log(4200 / 20), num(z.hp))}${bar(
            'Velocidad',
            z.speed / LIST_SPEED,
            z.speed >= LIST_SPEED ? 'la mayor' : '',
          )}${bar('Daño', z.damage / LIST_DMG, c.type === 'golden' ? 'no ataca' : num(z.damage))}</div>`,
        `<p class="pg-look">${esc(c.look)}</p>${list('pg-weak', 'Debilidades', c.weak)}${list('pg-warn', 'Cuidado', c.warn)}`,
      ),
    );
  }
  const bossAt = pages.length;
  index.push({ name: 'Los jefes', i: bossAt, boss: true });
  pages.push(
    pg(
      `<h3 class="pg-big">Los jefes</h3><p class="pg-look">Cada ${BOSS.every} oleadas llega uno, con menos horda a su alrededor. Cada uno tiene su punto débil: apréndetelo antes de que llegue.</p><div class="pg-seal" aria-hidden="true"></div>`,
      `<ol class="pg-bosses">${BOSS_ORDER.map(
        (t, k) =>
          `<li><button type="button" data-go="${bossAt + 1 + k}"><span>${esc(BOSSES[t].name)}</span><em>oleada ${(k + 1) * BOSS.every}</em></button></li>`,
      ).join('')}</ol>`,
    ),
  );
  BOSS_ORDER.forEach((t, k) => {
    const b = BOSSES[t];
    const z = ZOMBIES[t];
    pages.push(
      pg(
        `<p class="pg-kicker">Jefe ${k + 1} · oleada ${(k + 1) * BOSS.every}</p>` +
          `<h3>${esc(b.name)}</h3>${portrait(t, true)}` +
          `<div class="pg-stats pg-boss-n"><span>Vida <b>${num(z.hp * BOSS.hp)}</b></span><span>Premio <b>$${num(b.reward)}</b></span></div>`,
        `${list('pg-weak', 'Punto débil', [b.tip])}${list(
          'pg-warn',
          'Sus ataques',
          b.atk.map((a) => a.name),
        )}`,
      ),
    );
  });
  pages.push(
    pg(
      '<h3 class="pg-big">Últimas notas</h3><ul class="pg-notes"><li>Las barricadas compran tiempo: ponlas donde la horda se amontona.</li><li>El fuego se contagia de zombi en zombi.</li><li>Los explosivos sirven contra todo lo blindado.</li><li>Entre oleadas, la tienda; al subir de nivel, una mejora.</li></ul>',
      '<p class="pg-end">Si encontraste este libro, el que lo escribió ya no está.<br><br>Que te sirva más que a él.</p>',
    ),
  );
  pages[0] = pg(
    '<p class="pg-kicker">Día 47</p><h3 class="pg-big">A quien encuentre este libro</h3><p class="pg-look">Aquí apunté todo lo que aprendimos de ellos: de dónde salen, cuánto aguantan y cómo se les mata. Léelo antes de salir.</p><p class="pg-sign">— el último de la Zona 9</p>',
    `<h4 class="pg-idx-t">Índice</h4><ol class="pg-index">${index
      .map(
        (e) =>
          `<li${e.boss ? ' class="pg-idx-boss"' : ''}><button type="button" data-go="${e.i}">${esc(e.name)}</button></li>`,
      )
      .join('')}</ol>`,
  );
  return pages;
}

/* ---------- estado ---------- */

/** @type {any} */
let M = null;
let PAGES = null;

function page(i) {
  const p = PAGES[i];
  if (!p) return '';
  const side = p.a.includes('pg-photo') ? ' pg-side' : '';
  return `<div class="pg-in"><div class="pg-a${side}">${p.a}</div><div class="pg-b">${p.b}</div></div><span class="pg-num">${i + 1}</span>`;
}

const blankPage = () => '<div class="pg-in pg-blank"></div>';

/** Abre el manual (cerrado, con sus cadenas). */
export function openManual(game) {
  PAGES ||= buildPages();
  M = { phase: 'locked', t: 0, i: 0, busy: false, links: [], dust: [], token: (M?.token || 0) + 1 };
  const $ = game.$;
  const tome = $('tome');
  tome.className = 'tome';
  $('tome-leaf').hidden = true;
  $('tome-nav').hidden = true;
  $('tome-hint').hidden = false;
  $('tome-hint').textContent = 'Toca el libro para romper las cadenas';
  $('pg-right').innerHTML = page(0);
  game.setState('manual');
  layout(game);
  paintDust(game);
}

export function closeManual(_game) {
  if (M) M.token++;
  M = null;
}

// Tamaño del libro según la pantalla: una sola página, más ancha o más alta según quepa. Ancha: sus dos
// partes lado a lado; alta: una debajo de otra.
function layout(game) {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const tall = W < H;
  const aw = W - (tall ? 24 : 150);
  const ah = H - (tall ? 150 : 90);
  const k = Math.max(0.62, Math.min(1.6, aw / ah));
  const pw = Math.min(aw, ah * k, 1000);
  const ph = pw / k;
  const tome = game.$('tome');
  tome.classList.toggle('wide', k >= 0.95);
  game.$('manual').classList.toggle('tall', tall);
  tome.style.width = `${Math.round(pw)}px`;
  tome.style.height = `${Math.round(ph)}px`;
  tome.style.setProperty('--ph', `${Math.round(ph)}px`);
  tome.style.setProperty(
    '--fs',
    `${Math.max(9, Math.min(17, Math.sqrt(pw * ph) * (tall ? 0.03 : 0.026))).toFixed(1)}px`,
  );
  M.size = `${W}x${H}`;
}

/* ---------- polvo de la tapa ---------- */

function fit(c) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(c.clientWidth * dpr));
  const h = Math.max(1, Math.round(c.clientHeight * dpr));
  if (c.width !== w || c.height !== h) {
    c.width = w;
    c.height = h;
  }
  return dpr;
}

// Capa de polvo gris con grumos y telarañas en las esquinas.
function paintDust(game) {
  const c = game.$('cover-dust');
  c.style.opacity = '1';
  fit(c);
  const g = c.getContext('2d');
  const { width: w, height: h } = c;
  g.clearRect(0, 0, w, h);
  g.fillStyle = 'rgba(160,150,128,0.62)';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(205,196,172,0.35)' : 'rgba(90,84,70,0.25)';
    const r = rand(0.6, 3.2) * (w / 300);
    g.beginPath();
    g.arc(rand(0, w), rand(0, h), r, 0, TAU);
    g.fill();
  }
  g.strokeStyle = 'rgba(225,220,205,0.35)';
  g.lineWidth = Math.max(1, w / 400);
  for (const [cx, cy, sx, sy] of [
    [0, 0, 1, 1],
    [w, h, -1, -1],
  ]) {
    const R = w * 0.32;
    for (let k = 0; k < 6; k++) {
      const a = (k / 5) * (Math.PI / 2);
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(a) * R * sx, cy + Math.sin(a) * R * sy);
      g.stroke();
    }
    for (let ring = 1; ring <= 4; ring++) {
      g.beginPath();
      for (let k = 0; k <= 5; k++) {
        const a = (k / 5) * (Math.PI / 2);
        const rr = (R * ring) / 4.4;
        const x = cx + Math.cos(a) * rr * sx;
        const y = cy + Math.sin(a) * rr * sy;
        if (k)
          g.quadraticCurveTo(cx + Math.cos(a - 0.15) * rr * 0.86 * sx, cy + Math.sin(a - 0.15) * rr * 0.86 * sy, x, y);
        else g.moveTo(x, y);
      }
      g.stroke();
    }
  }
}

// Una pasada del trapo: borra una franja de polvo y suelta una nube.
function wipe(game, k, fx) {
  const c = game.$('cover-dust');
  const g = c.getContext('2d');
  const { width: w, height: h } = c;
  g.save();
  g.globalCompositeOperation = 'destination-out';
  g.lineCap = 'round';
  g.lineWidth = h * 0.2;
  g.strokeStyle = 'rgba(0,0,0,0.85)';
  const y = h * (0.1 + k * 0.16);
  g.beginPath();
  g.moveTo(-w * 0.1, y + h * 0.12);
  g.quadraticCurveTo(w * 0.5, y - h * 0.08, w * 1.1, y + h * 0.04);
  g.stroke();
  g.restore();
  // nube que sale de la tapa hacia un lado
  const r = coverRect(game, fx);
  const dir = k % 2 ? -1 : 1;
  for (let i = 0; i < 46; i++) {
    M.dust.push({
      x: r.x + rand(0.05, 0.95) * r.w,
      y: r.y + (0.1 + k * 0.16) * r.h + rand(-0.06, 0.06) * r.h,
      vx: dir * rand(40, 360),
      vy: rand(-140, 20),
      r: rand(2, 9) * (r.w / 300),
      life: rand(0.8, 1.8),
      t: 0,
    });
  }
}

/* ---------- cadenas ---------- */

// Rectángulo de la tapa dentro del lienzo de efectos (en px del lienzo).
function coverRect(game, fx) {
  const a = fx.getBoundingClientRect();
  const b = game.$('tome-cover').getBoundingClientRect();
  const k = fx.width / Math.max(1, a.width);
  return { x: (b.left - a.left) * k, y: (b.top - a.top) * k, w: b.width * k, h: b.height * k };
}

// Eslabones a lo largo de una recta (en px del lienzo).
function chainLinks(x0, y0, x1, y1, L) {
  const d = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.ceil(d / (L * 0.78));
  const a = Math.atan2(y1 - y0, x1 - x0);
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, a, flat: i % 2 === 1, L, vx: 0, vy: 0, va: 0 });
  }
  return out;
}

function makeChains(game, fx) {
  const r = coverRect(game, fx);
  const L = Math.max(10, r.w * 0.075);
  const ext = r.w * 0.06;
  M.links = [
    ...chainLinks(r.x - ext, r.y + r.h * 0.12, r.x + r.w + ext, r.y + r.h * 0.88, L),
    ...chainLinks(r.x + r.w + ext, r.y + r.h * 0.12, r.x - ext, r.y + r.h * 0.88, L),
  ];
  M.lock = { x: r.x + r.w / 2, y: r.y + r.h / 2, s: L, vx: 0, vy: 0, a: 0, va: 0 };
}

function drawLink(g, l, alpha) {
  g.save();
  g.globalAlpha = alpha;
  g.translate(l.x, l.y);
  g.rotate(l.a);
  const L = l.L;
  const grad = g.createLinearGradient(0, -L * 0.3, 0, L * 0.3);
  grad.addColorStop(0, '#d2d4cf');
  grad.addColorStop(0.45, '#7c7f7a');
  grad.addColorStop(1, '#2f312d');
  g.strokeStyle = '#141612';
  if (l.flat) {
    g.lineWidth = L * 0.34;
    g.beginPath();
    g.moveTo(-L * 0.5, 0);
    g.lineTo(L * 0.5, 0);
    g.stroke();
    g.strokeStyle = grad;
    g.lineWidth = L * 0.2;
    g.stroke();
  } else {
    g.lineWidth = L * 0.22;
    g.beginPath();
    g.ellipse(0, 0, L * 0.52, L * 0.3, 0, 0, TAU);
    g.stroke();
    g.strokeStyle = grad;
    g.lineWidth = L * 0.13;
    g.stroke();
  }
  g.restore();
}

function drawLock(g, k, alpha) {
  const s = k.s;
  g.save();
  g.globalAlpha = alpha;
  g.translate(k.x, k.y);
  g.rotate(k.a);
  g.strokeStyle = '#141612';
  g.lineWidth = s * 0.34;
  g.beginPath();
  g.arc(0, -s * 0.55, s * 0.5, Math.PI, 0);
  g.stroke();
  g.strokeStyle = '#9a9c96';
  g.lineWidth = s * 0.2;
  g.stroke();
  const grad = g.createLinearGradient(-s, 0, s, 0);
  grad.addColorStop(0, '#5a3f1c');
  grad.addColorStop(0.5, '#b88a3e');
  grad.addColorStop(1, '#4a3316');
  g.fillStyle = grad;
  g.strokeStyle = '#141612';
  g.lineWidth = s * 0.08;
  g.beginPath();
  g.roundRect(-s * 0.8, -s * 0.6, s * 1.6, s * 1.3, s * 0.18);
  g.fill();
  g.stroke();
  g.fillStyle = '#141612';
  g.beginPath();
  g.arc(0, -s * 0.05, s * 0.16, 0, TAU);
  g.fill();
  g.fillRect(-s * 0.06, -s * 0.05, s * 0.12, s * 0.4);
  g.restore();
}

/* ---------- cada fotograma ---------- */

/** Un paso del manual: la secuencia de apertura, los efectos y los dibujos animados de los zombis. */
export function updateManual(game, _dt) {
  if (!M) return;
  // la animación va con el reloj real (no con el del juego, que se frena si el equipo va lento)
  const now = performance.now();
  const dt = M.last ? Math.min(0.5, (now - M.last) / 1000) : 0;
  M.last = now;
  if (game.input.consume('pause')) return game.setupMenu();
  if (`${window.innerWidth}x${window.innerHeight}` !== M.size) {
    layout(game);
    if (M.phase === 'locked') {
      paintDust(game);
      M.links = [];
    }
  }
  M.t += dt;
  const fx = game.$('tome-fx');
  fit(fx);
  // mientras está cerrado las cadenas siguen a la tapa (por si el libro se acomoda o cambia de tamaño)
  if (M.phase === 'locked') makeChains(game, fx);
  const g = fx.getContext('2d');
  g.clearRect(0, 0, fx.width, fx.height);
  const ph = M.phase;
  if (ph === 'breaking') {
    if (M.t < 0.55) {
      // el candado tiembla y las cadenas se tensan
      const sh = Math.sin(M.t * 70) * (fx.width / 400) * (1 + M.t * 4);
      M.lock.a = Math.sin(M.t * 55) * 0.18;
      for (const l of M.links) l.jit = sh;
    } else if (!M.snapped) {
      M.snapped = true;
      game.sfx.chainBreak?.();
      const r = coverRect(game, fx);
      for (const l of M.links) {
        const dx = l.x - (r.x + r.w / 2);
        l.jit = 0;
        l.vx = Math.sign(dx || 1) * rand(80, 380) + rand(-60, 60);
        l.vy = rand(-380, -60);
        l.va = rand(-9, 9);
      }
      Object.assign(M.lock, { vx: rand(-80, 80), vy: -260, va: rand(-6, 6) });
    } else {
      const grav = fx.height * 2.4;
      for (const l of [...M.links, M.lock]) {
        l.vy += grav * dt;
        l.x += l.vx * dt;
        l.y += l.vy * dt;
        l.a += l.va * dt;
      }
    }
    if (M.t > 1.5) {
      M.links = [];
      M.lock = null;
      setPhase(game, 'dusting');
    }
  } else if (ph === 'dusting') {
    const k = Math.floor(M.t / 0.17);
    while ((M.wiped || 0) <= Math.min(5, k)) {
      wipe(game, M.wiped || 0, fx);
      game.sfx.dustWipe?.();
      M.wiped = (M.wiped || 0) + 1;
    }
    if (M.t > 1.05) game.$('cover-dust').style.opacity = '0';
    if (M.t > 1.4) setPhase(game, 'opening');
  } else if (ph === 'opening') {
    if (M.t > 1.25) setPhase(game, 'flutter');
  } else if (ph === 'flutter') {
    if (!M.busy) {
      if ((M.flaps || 0) < 4) {
        M.flaps = (M.flaps || 0) + 1;
        flip(game, 0, 0.26, true);
      } else setPhase(game, 'open');
    }
  }
  // cadenas (con su temblor) y candado
  const fade = ph === 'breaking' && M.snapped ? Math.max(0, 1 - (M.t - 0.55) / 0.9) : 1;
  if (M.links.length) {
    for (const l of M.links) {
      const j = l.jit || 0;
      drawLink(g, { ...l, x: l.x + j, y: l.y - j * 0.5 }, fade);
    }
    if (M.lock) drawLock(g, M.lock, fade);
  }
  // nubes de polvo
  for (let i = M.dust.length - 1; i >= 0; i--) {
    const d = M.dust[i];
    d.t += dt;
    if (d.t > d.life) {
      M.dust.splice(i, 1);
      continue;
    }
    d.vx *= 1 - dt * 1.6;
    d.vy = d.vy * (1 - dt * 1.6) - 10 * dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    // motas suaves que se abren y se desvanecen
    const k = d.t / d.life;
    const rr = d.r * (1 + k * 3);
    const a = 0.3 * (1 - k) * Math.min(1, d.t * 8);
    const grd = g.createRadialGradient(d.x, d.y, 0, d.x, d.y, rr);
    grd.addColorStop(0, `rgba(196,186,162,${a.toFixed(3)})`);
    grd.addColorStop(1, 'rgba(196,186,162,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(d.x, d.y, rr, 0, TAU);
    g.fill();
  }
  drawPortraits(game);
}

// Los dibujos de los zombis caminando hacia quien lee.
function drawPortraits(game) {
  const t = performance.now() / 1000;
  for (const c of game.$('tome').querySelectorAll('canvas.pg-z')) {
    if (!c.clientWidth) continue;
    fit(c);
    const g = c.getContext('2d');
    const type = c.dataset.z;
    const set = c.dataset.boss ? bossSprite(type) : zombieSprites()[type]?.[0];
    g.clearRect(0, 0, c.width, c.height);
    if (!set) continue;
    const fr = set.frames[Math.floor(t * 7) % set.frames.length];
    const S = Math.min(c.width, c.height) * (c.dataset.boss ? 1.05 : 1.15);
    g.save();
    g.translate(c.width / 2, c.height / 2);
    g.rotate(Math.PI / 2 + Math.sin(t * 1.3) * 0.08);
    g.drawImage(fr, -S / 2, -S / 2, S, S);
    g.restore();
  }
}

function setPhase(game, ph) {
  M.phase = ph;
  M.t = 0;
  const tome = game.$('tome');
  if (ph === 'breaking') {
    game.sfx.chainRattle?.();
    game.$('tome-hint').hidden = true;
    tome.classList.add('shake');
  } else if (ph === 'dusting') tome.classList.remove('shake');
  else if (ph === 'opening') {
    game.sfx.bookOpen?.();
    tome.classList.add('open');
  } else if (ph === 'open') {
    game.$('tome-nav').hidden = false;
    game.$('tome-hint').hidden = false;
    game.$('tome-hint').textContent = 'Toca una página o desliza para pasar las hojas';
    syncNav(game);
  }
}

function syncNav(game) {
  game.$('tome-prev').disabled = M.i <= 0;
  game.$('tome-next').disabled = M.i >= PAGES.length - 1;
  game.$('tome-pn').textContent = `${M.i + 1} / ${PAGES.length}`;
}

/**
 * Pasa a la página `to` (blank: hoja en blanco que pasa sola al abrir, sin cambiar de página).
 * Hacia adelante la página gira sobre el lomo (a la izquierda) y deja ver la siguiente; hacia atrás la
 * anterior vuelve girando sobre la actual.
 */
function flip(game, to, dur = 0.62, blank = false) {
  if (!M || M.busy) return;
  const i = M.i;
  const fwd = blank || to > i;
  if (!blank && (to === i || to < 0 || to >= PAGES.length)) return;
  M.busy = true;
  const $ = game.$;
  const leaf = $('tome-leaf');
  const front = $('leaf-front');
  const back = $('leaf-back');
  // translateZ: la hoja siempre por encima de la página que tapa
  const turned = 'translateZ(2px) rotateY(-180deg)';
  const flat = 'translateZ(2px) rotateY(0deg)';
  leaf.style.transition = 'none';
  back.innerHTML = blankPage();
  if (fwd) {
    front.innerHTML = blank ? blankPage() : page(i);
    if (!blank) $('pg-right').innerHTML = page(to);
    leaf.style.transform = flat;
  } else {
    front.innerHTML = page(to);
    leaf.style.transform = turned;
  }
  leaf.classList.remove('turning', 'fwd', 'back');
  leaf.hidden = false;
  void leaf.offsetWidth;
  leaf.style.setProperty('--dur', `${dur}s`);
  leaf.classList.add('turning', fwd ? 'fwd' : 'back');
  leaf.style.transition = `transform ${dur}s cubic-bezier(.42,.08,.3,1)`;
  leaf.style.transform = fwd ? turned : flat;
  game.sfx.pageFlip?.();
  const tk = M.token;
  setTimeout(() => {
    if (!M || M.token !== tk) return;
    if (!fwd) $('pg-right').innerHTML = page(to);
    leaf.hidden = true;
    leaf.classList.remove('turning', 'fwd', 'back');
    if (!blank) M.i = to;
    M.busy = false;
    if (M.phase === 'open') syncNav(game);
  }, dur * 1000);
}

export function bindManual(game) {
  const $ = game.$;
  on(game, 'btn-manual', () => {
    game.sfx.unlock();
    openManual(game);
  });
  on(game, 'btn-manual-back', () => game.setupMenu());
  on(game, 'tome-prev', () => M && flip(game, M.i - 1));
  on(game, 'tome-next', () => M && flip(game, M.i + 1));
  const tome = $('tome');
  let down = null;
  tome.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY };
  });
  tome.addEventListener('pointerup', (e) => {
    if (!M || !down) return;
    const dx = e.clientX - down.x;
    const dy = e.clientY - down.y;
    down = null;
    if (M.phase === 'locked') return setPhase(game, 'breaking');
    if (M.phase !== 'open') return;
    // del índice: ir a esa página
    const go = /** @type {HTMLElement} */ (e.target).closest?.('[data-go]');
    if (go) return flip(game, Number(go.getAttribute('data-go')));
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) return flip(game, M.i + (dx < 0 ? 1 : -1));
    // tocar la mitad derecha avanza una página; la izquierda regresa una
    const r = tome.getBoundingClientRect();
    flip(game, M.i + (e.clientX > r.left + r.width / 2 ? 1 : -1));
  });
  window.addEventListener('keydown', (e) => {
    if (!M || game.state !== 'manual') return;
    if (M.phase === 'locked' && (e.key === 'Enter' || e.key === ' ')) return setPhase(game, 'breaking');
    if (M.phase !== 'open') return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') flip(game, M.i + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') flip(game, M.i - 1);
  });
}
