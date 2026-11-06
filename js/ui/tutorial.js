// Entrenamiento obligatorio: la primera partida de este dispositivo empieza con unas prácticas guiadas
// (moverse, correr, disparar, recargar, construir y lanzar una granada) y la primera oleada no llega
// hasta terminarlas. Quien ya jugó antes (tiene récord o partida guardada) no lo repite a la fuerza;
// desde el menú se puede repetir como práctica: no toca la partida guardada, no se muere y al terminar
// vuelve al menú. Mientras dura no se guarda la partida ni se abren las mejoras (ver updatePlay).
// Si un zombi de práctica se queda atorado lejos, el paso no se traba: a los STUCK s se retira.
import { rand, storage, TAU } from '../core/util.ts';
import { tryFullscreen } from './menu.js';
import { showClass } from './class.js';

const KEY = 'dz-tuto';
// s que se esperan a los zombis de práctica que no llegan (atorados): luego se retiran
const STUCK = 20;

// ¿Ya cayeron los zombis de práctica? (a los STUCK s, los que quedan lejos se retiran)
function cleared(game, s, t) {
  const p = game.player;
  if (t > STUCK) for (const z of s.list) if (!z.dead && Math.hypot(z.x - p.x, z.y - p.y) > 160) z.dead = true;
  return s.list.every((z) => z.dead);
}

/** ¿Ya hizo el entrenamiento (o ya había jugado antes de que existiera)? */
export function tutoDone(game) {
  if (storage.get(KEY, false)) return true;
  const cur = game.accounts.current;
  const played =
    !!storage.get('dz-best', null) ||
    !!cur?.best ||
    !!storage.get(game.accounts.saveKey(), null) ||
    !!storage.get(game.accounts.checkKey(), null);
  if (played) storage.set(KEY, true);
  return played;
}

/**
 * Los pasos. `touch`: el texto en el celular. `start` prepara el paso; `done` dice si ya lo cumplió.
 * `glow`: el botón táctil que se ilumina.
 */
const STEPS = [
  {
    t: 'Muévete',
    d: 'Camina con <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd>.',
    touch: 'Arrastra el joystick de la izquierda para caminar.',
    start: (game, s) => {
      s.x = game.player.x;
      s.y = game.player.y;
      s.dist = 0;
    },
    done: (game, s) => {
      const p = game.player;
      s.dist += Math.hypot(p.x - s.x, p.y - s.y);
      s.x = p.x;
      s.y = p.y;
      return s.dist >= 260;
    },
    prog: (_game, s) => s.dist / 260,
  },
  {
    t: 'Corre',
    d: 'Mantén <kbd>Shift</kbd> mientras caminas. Correr gasta estamina (la barra amarilla).',
    touch: 'Lleva el joystick hasta el borde para correr. Correr gasta estamina (la barra amarilla).',
    start: (_game, s) => {
      s.run = 0;
    },
    done: (game, s, dt) => {
      if (game.player.running) s.run += dt;
      return s.run >= 1.2;
    },
    prog: (_game, s) => s.run / 1.2,
  },
  {
    t: 'Dispara',
    d: 'Apunta con el ratón y haz <kbd>clic</kbd> para disparar. Acaba con los zombis.',
    touch: 'Mantén el botón de disparo: apunta solo al más cercano. Acaba con los zombis.',
    glow: 'btn-fire',
    start: (game, s) => {
      s.list = spawnAround(game, 3, 'normal');
      s.n = s.list.length;
    },
    done: (game, s, _dt, t) => cleared(game, s, t),
    prog: (_game, s) => s.list.filter((z) => z.dead).length / s.n,
  },
  {
    t: 'Recarga',
    d: 'Pulsa <kbd>R</kbd> para recargar antes de quedarte sin balas.',
    touch: 'Toca el botón de recargar antes de quedarte sin balas.',
    glow: 'btn-reload',
    start: (game) => {
      const w = game.player.weapon;
      w.mag = Math.min(w.mag, Math.floor(game.player.magSize(w.def) / 2));
      w.reserve = Math.max(w.reserve, game.player.magSize(w.def));
    },
    done: (game) => game.player.reloadT > 0,
  },
  {
    t: 'Construye',
    d: 'Pulsa <kbd>F</kbd> y haz <kbd>clic</kbd> para poner una barricada de madera. Sal con <kbd>F</kbd>.',
    touch: 'Toca el botón de construir y luego ✓ para poner una barricada de madera.',
    glow: 'btn-build',
    start: (game, s) => {
      game.inv.wood += 2;
      s.n = game.structures.blocks.length;
    },
    done: (game, s) => game.structures.blocks.length > s.n,
    end: (game) => {
      if (game.building) game.toggleBuild(false);
    },
  },
  {
    t: 'Lanza una granada',
    d: 'Llega un grupo: pulsa <kbd>G</kbd> para lanzarles una granada y remata a los que queden.',
    touch: 'Llega un grupo: toca el botón de granada para lanzársela y remata a los que queden.',
    glow: 'btn-grenade',
    start: (game, s) => {
      game.inv.grenade += 1;
      s.g = game.inv.grenade;
      s.list = spawnAround(game, 5, 'normal', true);
      s.thrown = false;
    },
    done: (game, s, _dt, t) => {
      if (game.inv.grenade < s.g) s.thrown = true;
      return s.thrown && cleared(game, s, t);
    },
  },
  {
    t: '¡A sobrevivir!',
    d: 'Cada oleada trae más zombis y algunos nuevos. Entre oleadas abre la <b>tienda</b> y, al subir de nivel, elige una <b>mejora</b>. En el <b>Manual</b> del menú están todos los zombis y sus debilidades.',
    button: 'Empezar la oleada 1',
    practice: 'Volver al menú',
    start: () => {},
    done: (_game, s) => !!s.ok,
  },
];

// Zombis de práctica a la vista, en lugares libres (en grupo: juntos, del mismo lado).
function spawnAround(game, n, type, group = false) {
  const p = game.player;
  const out = [];
  const base = rand(0, TAU);
  for (let i = 0; i < n; i++) {
    for (let t = 0; t < 30; t++) {
      const a = group ? base + rand(-0.35, 0.35) : base + (i / n) * TAU + rand(-0.4, 0.4);
      const d = group ? rand(300, 360) : rand(260, 340);
      const x = p.x + Math.cos(a) * d;
      const y = p.y + Math.sin(a) * d;
      if (game.world.pointBlocked(x, y, 20)) continue;
      const z = game.horde.spawn(type, x, y, 1, 0.75);
      z.spawnT = 0;
      out.push(z);
      break;
    }
  }
  return out;
}

/** Empieza el entrenamiento (lo llama start() en menu.js cuando toca). */
export function beginTuto(game, practice = false) {
  game.tuto = { i: -1, s: {}, t: 0, practice };
  next(game);
}

function next(game) {
  const tu = game.tuto;
  const prev = STEPS[tu.i];
  prev?.end?.(game);
  tu.i++;
  tu.s = {};
  tu.t = 0;
  const st = STEPS[tu.i];
  if (!st) return finish(game);
  st.start(game, tu.s);
  if (tu.i > 0) game.sfx.level();
  render(game);
}

function finish(game) {
  storage.set(KEY, true);
  const practice = game.tuto.practice;
  game.tuto = null;
  game.forceTuto = false;
  glow(game, null);
  game.$('tuto').hidden = true;
  game.toast('Entrenamiento completado');
  // la práctica vuelve al menú, donde sigue tu partida guardada
  if (practice) return game.setupMenu();
  // la primera oleada llega enseguida
  game.director.timer = 0;
}

function glow(game, id) {
  for (const b of game.root.querySelectorAll('.tuto-glow')) b.classList.remove('tuto-glow');
  if (id) game.$(id)?.classList.add('tuto-glow');
}

function render(game) {
  const tu = game.tuto;
  const st = STEPS[tu.i];
  const touch = game.input.mode === 'touch';
  game.$('tuto').hidden = false;
  game.$('tuto-n').textContent = `Entrenamiento · ${tu.i + 1} de ${STEPS.length}`;
  game.$('tuto-t').textContent = st.t;
  game.$('tuto-d').innerHTML = touch && st.touch ? st.touch : st.d;
  const btn = game.$('tuto-ok');
  btn.hidden = !st.button;
  btn.textContent = (tu.practice && st.practice) || st.button || '';
  game.$('tuto-bar').hidden = !st.prog;
  game.$('tuto-card').classList.remove('tuto-pop');
  void game.$('tuto-card').offsetWidth;
  game.$('tuto-card').classList.add('tuto-pop');
  glow(game, touch ? st.glow : null);
}

/** Un paso del entrenamiento (desde updatePlay mientras game.tuto existe). */
export function updateTuto(game, dt) {
  const tu = game.tuto;
  if (!tu || !game.player.alive) return;
  const st = STEPS[tu.i];
  tu.t += dt;
  // en la práctica no se muere (no hay partida que perder)
  if (tu.practice) game.player.hp = game.player.stats.maxHp;
  if (st.prog) game.$('tuto-fill').style.width = `${Math.round(Math.min(1, st.prog(game, tu.s)) * 100)}%`;
  // el texto cambia si cambia el modo de entrada (ratón ↔ toque)
  const mode = game.input.mode;
  if (tu.mode !== mode) {
    tu.mode = mode;
    render(game);
  }
  if (st.done(game, tu.s, dt, tu.t)) {
    // una pausa breve para que se vea que lo logró
    tu.wait = (tu.wait || 0) + dt;
    game.$('tuto-card').classList.add('tuto-ok');
    if (tu.wait < 0.6) return;
    tu.wait = 0;
    game.$('tuto-card').classList.remove('tuto-ok');
    next(game);
  }
}

/** Se acabó la partida o se salió al menú: el entrenamiento queda pendiente. */
export function clearTuto(game) {
  game.tuto = null;
  glow(game, null);
  const el = game.$('tuto');
  if (el) el.hidden = true;
}

export function bindTuto(game) {
  game.$('tuto-ok').addEventListener('click', () => {
    if (game.tuto) game.tuto.s.ok = true;
  });
  game.$('btn-tuto').addEventListener('click', () => {
    tryFullscreen(game);
    game.forceTuto = true;
    showClass(game, false);
  });
}
