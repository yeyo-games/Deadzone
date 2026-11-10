// Personaje: colores, sombrero, traje, cara, espalda y efecto, con una vista previa que camina en su
// sitio. Las piezas con precio se compran con latas (se ganan al superar oleadas, ver CANS); antes de
// comprarlas se pueden probar en la vista previa.
import { cansForWave, LOOK_SLOT_ORDER, LOOK_SLOTS } from '../core/config.ts';
import { storage } from '../core/util.ts';
import { Player } from '../sim/player.ts';
import { cleanLook, DEFAULT_LOOK, drawSurvivor, LOOK_PARTS } from '../render/sprites.js';
import { on } from './dom.js';

const SLOT_NAMES = { colors: 'Colores', hat: 'Sombrero', suit: 'Traje', face: 'Cara', back: 'Espalda', aura: 'Efecto' };
const CAN_SVG =
  '<svg class="can" viewBox="0 0 12 14" aria-hidden="true"><rect x="2" y="2" width="8" height="11" rx="1.5" fill="#b8392e" stroke="#141612"/><rect x="2" y="5" width="8" height="4" fill="#d8d2c4"/><ellipse cx="6" cy="2" rx="4" ry="1.2" fill="#9aa1a8" stroke="#141612" stroke-width=".6"/></svg>';

/* ---------- latas (por cuenta) ---------- */

/** @returns {{ n: number, own: string[] }} */
export function wallet(game) {
  const w = storage.get(game.accounts.cansKey(), null);
  return {
    n: Math.max(0, Math.floor(Number(w?.n) || 0)),
    own: Array.isArray(w?.own) ? w.own.filter((x) => typeof x === 'string') : [],
  };
}

function saveWallet(game, w) {
  storage.set(game.accounts.cansKey(), w);
}

const itemOf = (slot, id) => LOOK_SLOTS[slot].find((i) => i.id === id);
// Las piezas sin precio son de todos; las demás, de quien las compró.
export const owns = (w, slot, id) => !itemOf(slot, id)?.price || w.own.includes(`${slot}:${id}`);

// Al superar una oleada: latas según la oleada (las partidas con trampas no ganan).
export function earnCans(game, wave) {
  addCans(game, cansForWave(wave));
}

/** Suma n latas a la cuenta (oleadas superadas, paradas de la Huida). */
export function addCans(game, n) {
  if (game.devUsed || !(n > 0)) return;
  const w = wallet(game);
  w.n += n;
  saveWallet(game, w);
  game.moneyPop(`+${n} ${n === 1 ? 'lata' : 'latas'}`, 'cans');
}

// Quita lo que esta cuenta no tiene (el aspecto se guarda en el aparato, las latas en la cuenta).
export function fitLook(game) {
  const w = wallet(game);
  const look = { ...game.look };
  for (const k of LOOK_SLOT_ORDER) if (!owns(w, k, look[k])) look[k] = DEFAULT_LOOK[k];
  game.look = cleanLook(look);
  game.player.look = game.look;
  storage.set('dz-look', game.look);
}

/* ---------- pantalla ---------- */

export function showLook(game) {
  game.setState('look');
  // muñeco sólo para la vista previa: camina en su sitio y gira despacio
  game.lookDummy = new Player(110, 110);
  game.lookDummy.r *= 2.7;
  game.lookDummy.speedNow = 60;
  game.lookTry = null;
  game.lookSlot = game.lookSlot || 'hat';
  renderLook(game);
}

function colorRow(game, part) {
  const row = document.createElement('div');
  row.className = 'look-row';
  const lbl = document.createElement('span');
  lbl.textContent = part.name;
  const sw = document.createElement('div');
  sw.className = 'look-sw';
  for (const c of part.colors) {
    const b = document.createElement('button');
    b.type = 'button';
    b.style.background = c;
    b.setAttribute('aria-label', `${part.name} ${c}`);
    b.classList.toggle('on', game.look[part.id] === c);
    b.addEventListener('click', () => setLook(game, { ...game.look, [part.id]: c }));
    sw.appendChild(b);
  }
  row.append(lbl, sw);
  return row;
}

export function renderLook(game) {
  const w = wallet(game);
  game.$('look-cans').innerHTML = `${CAN_SVG}<b>${w.n}</b> ${w.n === 1 ? 'lata' : 'latas'}`;
  const box = game.$('look-parts');
  box.innerHTML = '';
  // pestañas: los colores y cada ranura con sus piezas
  const tabs = document.createElement('div');
  tabs.className = 'look-tabs';
  for (const k of ['colors', ...LOOK_SLOT_ORDER]) {
    const t = document.createElement('button');
    t.type = 'button';
    t.className = `chip${k === game.lookSlot ? ' on' : ''}`;
    t.textContent = SLOT_NAMES[k];
    t.addEventListener('click', () => {
      game.lookSlot = k;
      game.lookTry = null;
      renderLook(game);
    });
    tabs.appendChild(t);
  }
  box.appendChild(tabs);
  const k = game.lookSlot;
  if (k === 'colors') {
    for (const part of LOOK_PARTS) box.appendChild(colorRow(game, part));
    return renderBuy(game, w);
  }
  const items = document.createElement('div');
  items.className = 'look-items';
  for (const it of LOOK_SLOTS[k]) {
    const b = document.createElement('button');
    b.type = 'button';
    const mine = owns(w, k, it.id);
    const worn = game.look[k] === it.id;
    const trying = game.lookTry && game.lookTry.slot === k && game.lookTry.id === it.id;
    b.className = `look-item${worn ? ' on' : ''}${mine ? '' : ' locked'}${trying ? ' try' : ''}`;
    b.innerHTML = `<span>${it.name}</span>${mine ? '' : `<small>${CAN_SVG}${it.price}</small>`}`;
    b.addEventListener('click', () => {
      if (mine) {
        game.lookTry = null;
        setLook(game, { ...game.look, [k]: it.id });
      } else {
        // las que no tienes se prueban en la vista previa y se compran abajo
        game.lookTry = { slot: k, id: it.id };
        renderLook(game);
      }
    });
    items.appendChild(b);
  }
  box.appendChild(items);
  renderBuy(game, w);
}

function renderBuy(game, w) {
  const bar = game.$('look-buy');
  const t = game.lookTry;
  bar.hidden = !t;
  if (!t) return;
  const it = itemOf(t.slot, t.id);
  const short = it.price - w.n;
  game.$('look-buy-name').textContent = `Probando: ${it.name}`;
  const btn = game.$('btn-look-buy');
  btn.disabled = short > 0;
  btn.innerHTML = short > 0 ? `Te faltan ${short} ${CAN_SVG}` : `Comprar · ${it.price} ${CAN_SVG}`;
}

function buyTry(game) {
  const t = game.lookTry;
  if (!t) return;
  const it = itemOf(t.slot, t.id);
  const w = wallet(game);
  if (!it || owns(w, t.slot, t.id) || w.n < it.price) return;
  w.n -= it.price;
  w.own.push(`${t.slot}:${t.id}`);
  saveWallet(game, w);
  game.lookTry = null;
  game.sfx.level();
  setLook(game, { ...game.look, [t.slot]: t.id });
  game.toast(`¡${it.name} es tuyo!`);
}

export function setLook(game, look) {
  game.look = cleanLook(look);
  game.player.look = game.look;
  storage.set('dz-look', game.look);
  renderLook(game);
}

export function drawLookPreview(game, dt) {
  const p = game.lookDummy;
  const c = game.$('look-preview');
  const g = c.getContext('2d');
  const t = game.lookTry;
  p.look = t ? { ...game.look, [t.slot]: t.id } : game.look;
  p.walkPhase += dt * 9;
  p.angle += dt * 0.6;
  p.legAngle = p.angle;
  g.clearRect(0, 0, c.width, c.height);
  drawSurvivor(g, p, game.time);
}

// Botones de la pantalla de personaje y del menú que la abre.
export function bindLook(game) {
  on(game, 'btn-look', () => showLook(game));
  on(game, 'btn-look-done', () => {
    game.lookTry = null;
    game.setState('menu');
  });
  on(game, 'btn-look-buy', () => buyTry(game));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  // al azar sólo entre lo que tienes
  on(game, 'btn-look-random', () => {
    const w = wallet(game);
    setLook(game, {
      ...Object.fromEntries(LOOK_PARTS.map((q) => [q.id, pick(q.colors)])),
      ...Object.fromEntries(LOOK_SLOT_ORDER.map((k) => [k, pick(LOOK_SLOTS[k].filter((i) => owns(w, k, i.id))).id])),
    });
  });
  on(game, 'btn-look-reset', () => setLook(game, DEFAULT_LOOK));
}
