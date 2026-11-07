// Mejoras con mecánicas y rarezas (js/sim/upgrades.ts y js/sim/perks.ts).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BOUNTY, COMBO, PERKS, RARITY, WEAPONS } from '../js/core/config.ts';
import { Bullets } from '../js/sim/bullets.ts';
import { lastStand, onKill, extraShots, frenzyMult, ownShot, shotExtras } from '../js/sim/perks.ts';
import { Player } from '../js/sim/player.ts';
import * as Rules from '../js/sim/rules.ts';
import { UPGRADES, rarityOf, rollUpgrades } from '../js/sim/upgrades.ts';
import { bullet, fakeGame, silent, zombie } from './helpers.js';

const byId = (id) => UPGRADES.find((u) => u.id === id);
const take = (p, ...ids) => ids.forEach((id) => byId(id).apply(p));

// Todas las mejoras que pueden salir en muchas tandas (opt: fuente y oleada, como rollUpgrades).
function seen(p, level, taken = {}, n = 400, opt = {}) {
  const out = new Set();
  for (let i = 0; i < n; i++) for (const u of rollUpgrades(p, level, taken, 3, opt)) out.add(u.id);
  return out;
}
const rarities = (ids) => new Set([...ids].map((id) => rarityOf(byId(id))));

test('cada mejora tiene una rareza conocida y un ícono', async () => {
  const { ICONS } = await import('../js/sim/upgrades.ts');
  for (const u of UPGRADES) {
    assert.ok(RARITY[rarityOf(u)], u.id);
    assert.ok(ICONS[u.icon], `falta el ícono de ${u.id}`);
  }
  assert.equal(rarityOf(byId('dmg')), 'comun');
  assert.equal(rarityOf(byId('twin')), 'legendaria');
});

test('al subir de nivel: comunes y, desde su oleada, raras; nunca legendarias ni sinergias', () => {
  const p = new Player(0, 0);
  take(p, 'incend', 'volatile');
  const early = rarities(seen(p, 30, {}, 600, { source: 'level', wave: RARITY.rara.fromWave - 1 }));
  assert.deepEqual([...early], ['comun'], 'antes de su oleada, sólo comunes (aunque el nivel sea alto)');
  const late = rarities(seen(p, 30, {}, 1500, { source: 'level', wave: 40 }));
  assert.ok(late.has('rara'));
  assert.ok(!late.has('legendaria') && !late.has('sinergia'), 'esas salen sólo del cofre del jefe');
});

test('el zombi dorado da raras y el cofre del jefe legendarias, con la sinergia lista siempre', () => {
  const p = new Player(0, 0);
  assert.deepEqual([...rarities(seen(p, 1, {}, 300, { source: 'golden' }))], ['rara']);
  const box = seen(p, 1, {}, 600, { source: 'boss' });
  assert.deepEqual([...rarities(box)], ['legendaria']);
  assert.ok(!box.has('inferno') && !box.has('chain'), 'sin las dos mejoras no hay sinergia');

  take(p, 'incend', 'volatile');
  for (let i = 0; i < 50; i++) {
    const ids = rollUpgrades(p, 1, { incend: 1, volatile: 1 }, 3, { source: 'boss' }).map((u) => u.id);
    assert.equal(ids[0], 'inferno', 'Incendiarias + Volátil: Infierno va siempre en el cofre');
  }
  const q = new Player(0, 0);
  take(q, 'ricochet', 'pierce');
  assert.ok(seen(q, 1, {}, 20, { source: 'boss' }).has('chain'), 'Rebote + Perforantes: Reacción en cadena');
});

test('sin legendarias que dar, el cofre ofrece raras; sin raras, comunes', () => {
  const p = new Player(0, 0);
  const allLeg = { twin: 2, volatile: 1, laststand: 1 };
  assert.deepEqual([...rarities(seen(p, 1, allLeg, 300, { source: 'boss' }))], ['rara']);
  const allRare = { incend: 2, ricochet: 2, vamp: 3, greed: 3, frenzy: 2 };
  const ups = rollUpgrades(p, 1, { ...allLeg, ...allRare }, 3, { source: 'boss' });
  assert.equal(ups.length, 3);
  assert.deepEqual([...rarities(ups.map((u) => u.id))], ['comun']);
});

test('el tope de cada mejora se respeta', () => {
  const p = new Player(0, 0);
  const out = seen(p, 10, { volatile: 1, laststand: 1, twin: 2 }, 600, { source: 'boss' });
  assert.ok(!out.has('volatile') && !out.has('laststand') && !out.has('twin'));
});

test('Codicia sube el dinero de cada baja', () => {
  const game = { director: {} };
  const p = new Player(0, 0);
  const base = Rules.bountyNow(game, { cash: 0, stats: p.stats }, 'swat', 1);
  assert.equal(base, BOUNTY.swat);
  take(p, 'greed');
  assert.equal(
    Rules.bountyNow(game, { cash: 0, stats: p.stats }, 'swat', 1),
    Math.floor(BOUNTY.swat * (1 + PERKS.greed)),
  );
});

test('la baja a balazos queda marcada; la de una explosión o una torreta, no', () => {
  const game = fakeGame();
  for (const [b, want] of [
    [bullet({ dmg: 999 }), true],
    [bullet({ dmg: 999, blast: true }), false],
    [bullet({ dmg: 999, turret: true }), false],
  ]) {
    const z = zombie('normal', 10);
    assert.equal(
      Rules.hitZombie(game, z, b, 0, 0, () => {}),
      true,
    );
    assert.equal(z.shotKill, want);
  }
  assert.equal(ownShot(bullet({ rocket: true })), false);
});

// Un juego mínimo para las bajas con mejoras: anota las explosiones encoladas.
function mundo() {
  const blasts = [];
  const game = fakeGame({
    director: { wave: 3, hpMult: 1 },
    structures: { queueDeathBlast: (kind, x, y, o) => blasts.push({ kind, x, y, o }), explode: () => {} },
    toast: () => {},
  });
  return { game, blasts };
}

test('Sed de sangre cura con cada baja a balazos y sólo así', () => {
  const { game } = mundo();
  const p = new Player(0, 0);
  take(p, 'vamp', 'vamp');
  p.hp = 50;
  onKill(game, { x: 0, y: 0, shotKill: true }, p);
  assert.equal(p.hp, 50 + 2 * PERKS.vamp);
  onKill(game, { x: 0, y: 0, shotKill: false }, p);
  assert.equal(p.hp, 50 + 2 * PERKS.vamp, 'una explosión no cura');
  p.hp = p.stats.maxHp;
  onKill(game, { x: 0, y: 0, shotKill: true }, p);
  assert.equal(p.hp, p.stats.maxHp, 'nunca pasa de la vida máxima');
});

test('Carga volátil hace estallar al zombi según su probabilidad; Infierno, al que muere ardiendo', (t) => {
  const { game, blasts } = mundo();
  const p = new Player(0, 0);
  take(p, 'volatile');
  t.mock.method(Math, 'random', () => PERKS.volatile.chance + 0.01);
  onKill(game, { x: 5, y: 6, shotKill: true }, p);
  assert.equal(blasts.length, 0, 'por encima de la probabilidad no estalla');
  Math.random.mock.mockImplementation(() => PERKS.volatile.chance - 0.01);
  onKill(game, { x: 5, y: 6, shotKill: true, lastOwner: 'a' }, p);
  assert.equal(blasts.length, 1);
  assert.equal(blasts[0].kind, 'perk');
  assert.equal(blasts[0].o.owner, 'a');
  assert.equal(blasts[0].o.R, PERKS.volatile.radius);

  Math.random.mock.mockImplementation(() => 0.99);
  onKill(game, { x: 0, y: 0, burnt: true }, p);
  assert.equal(blasts.length, 1, 'sin Infierno, arder no basta');
  take(p, 'incend', 'inferno');
  onKill(game, { x: 0, y: 0, burnt: true }, p);
  assert.equal(blasts.length, 2);
  assert.equal(blasts[1].o.burn, PERKS.inferno.burn, 'Infierno prende a los de alrededor');
});

test('Última oportunidad salva de un golpe mortal una vez por oleada', () => {
  const { game } = mundo();
  let deaths = 0;
  Object.assign(game, { camera: silent, onPlayerDeath: () => deaths++ });
  const p = new Player(0, 0);
  take(p, 'laststand');
  p.hurt(9999, game);
  assert.ok(p.alive);
  assert.equal(p.hp, p.stats.maxHp * PERKS.lastStand.hp);
  p.hurt(9999, game);
  assert.equal(p.alive, false, 'la segunda vez en la misma oleada no');
  assert.equal(deaths, 1);

  const q = new Player(0, 0);
  take(q, 'laststand');
  q.hurt(9999, game);
  game.director.wave++;
  q.hurt(9999, game);
  assert.ok(q.alive, 'en la oleada siguiente vuelve a servir');
  assert.equal(lastStand(game, new Player(0, 0)), false, 'sin la mejora no hace nada');
});

test('Frenesí sólo acelera con la racha activa; Doble cañón no toca cohetes ni lanzallamas', () => {
  const p = new Player(0, 0);
  take(p, 'frenzy');
  assert.equal(frenzyMult(p), 1);
  p.combo.n = COMBO.tiers[0][0];
  assert.equal(frenzyMult(p), 1 + PERKS.frenzy);

  take(p, 'twin');
  assert.equal(extraShots(p, WEAPONS.smg), 1);
  assert.equal(extraShots(p, WEAPONS.bazooka), 0);
  assert.equal(extraShots(p, WEAPONS.flamer), 0);
  assert.equal(shotExtras(p, WEAPONS.smg), null, 'sin fuego ni rebotes, la bala va como siempre');
  take(p, 'incend', 'ricochet');
  assert.deepEqual(shotExtras(p, WEAPONS.smg), { burn: PERKS.burn, bounce: 1, bounceKeep: false });
  assert.equal(shotExtras(p, WEAPONS.bazooka), null);
});

test('una bala con Rebote salta al zombi más cercano y pierde parte del daño', () => {
  const z = (id, x, y) => ({ ...zombie('normal', 1000), id, x, y, r: 12, dead: false, def: {} });
  const a = z(1, 100, 0);
  const b = z(2, 100, 120);
  const far = z(3, 100, -900);
  const hits = [];
  const game = fakeGame({
    world: { pointBlocked: () => false },
    horde: { grid: { query: (_x0, _y0, _x1, _y1, out) => (out.length = 0) || out.push(a, b, far) } },
    hitZombie: (zz, bb) => hits.push([zz.id, bb.dmg]),
  });
  game.particles = silent;
  const list = new Bullets();
  list.spawn({ x: 0, y: 0, dx: 1, dy: 0, speed: 3000, life: 600, dmg: 10, pierce: 0, knock: 1, hits: null, bounce: 1 });
  for (let i = 0; i < 20 && list.list.length; i++) list.update(1 / 60, game);
  assert.deepEqual(
    hits.map(([id]) => id),
    [1, 2],
    'pega en el primero y rebota al cercano',
  );
  assert.equal(hits[1][1], 10 * PERKS.bounce.dmg);
});
