// Torreta militar (SHOP.military, MILITARY): a quién apunta, el misil antitanque y su explosión.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ABILITY, MILITARY, SHOP } from '../js/core/config.ts';
import { militaryMissile, Structures } from '../js/sim/build.ts';
import { Bullets } from '../js/sim/bullets.ts';
import { World } from '../js/sim/world.ts';
import { Horde } from '../js/sim/zombies.ts';
import { fakeGame, silent } from './helpers.js';

// Mundo, horda, barricadas y balas de verdad; los golpes se anotan en `hits`.
function partida() {
  const world = new World(777);
  const horde = new Horde();
  const structures = new Structures();
  const bullets = new Bullets();
  const hits = [];
  const game = fakeGame({
    world,
    horde,
    structures,
    bullets,
    particles: silent,
    camera: silent,
    decals: silent,
    time: 0,
    hitZombie: (z, b) => hits.push([z, b.dmg]),
  });
  return { world, horde, structures, bullets, game, hits };
}

// Una torreta militar en un sitio despejado, junto al punto de partida.
function torreta(t) {
  const { x, y } = t.world.spawn;
  const b = {
    k: 0,
    x: Math.round(x / 20) * 20 - 30,
    y: Math.round(y / 20) * 20 - 30,
    w: 60,
    h: 60,
    low: true,
    block: true,
    kind: 'military',
    hp: SHOP.military.hp,
    max: SHOP.military.hp,
    hitT: 0,
    cd: 0,
    ang: 0,
    owner: 'ana',
  };
  t.structures.blocks.push(b);
  return b;
}

// Los zombis quietos, pero en la rejilla donde los buscan la torreta y las balas.
function regrid(t) {
  t.horde.grid.clear();
  for (const z of t.horde.list) t.horde.grid.insert(z);
}

function zombi(t, type, x, y) {
  const z = t.horde.spawn(type, x, y, 1, 0.001);
  z.spawnT = 0;
  return z;
}

// Corre la torreta hasta que dispare (o se acabe el tiempo); devuelve el misil.
function hastaDisparar(t, b, s = 6) {
  for (let i = 0; i < s * 60; i++) {
    regrid(t);
    t.structures.updateMilitary(b, 1 / 60, t.game);
    const m = t.bullets.list.find((q) => q.atgm);
    if (m) return m;
  }
  return null;
}

test('cuesta 50 mil, ocupa 3×3 y está en la tienda después de la torreta pesada', async () => {
  const { BUILD_ORDER } = await import('../js/core/config.ts');
  assert.equal(SHOP.military.price, 50000);
  assert.equal(SHOP.military.w, 60);
  assert.ok(SHOP.military.turret);
  assert.equal(BUILD_ORDER.indexOf('military'), BUILD_ORDER.indexOf('heavy') + 1);
});

test('apunta primero a los zombis grandes y les lanza un misil antitanque', () => {
  const t = partida();
  const b = torreta(t);
  const cx = b.x + 30;
  const cy = b.y + 30;
  zombi(t, 'normal', cx + 200, cy);
  const roca = zombi(t, 'rock', cx, cy - 500);
  const m = hastaDisparar(t, b);
  assert.ok(m, 'disparó');
  const off = Math.atan2(m.dy, m.dx) - Math.atan2(roca.y - cy, roca.x - cx);
  assert.ok(Math.abs(Math.atan2(Math.sin(off), Math.cos(off))) < 0.1, 'hacia el rocoso');
  assert.equal(m.owner, 'ana');
  assert.ok(!m.fake);
  assert.ok(Math.abs(m.life - Math.hypot(roca.x - m.x, roca.y - m.y)) < 1, 'vuela hasta donde estaba su blanco');
  assert.equal(b.cd, MILITARY.reload);
});

test('no dispara a los que tiene encima ni fuera de su alcance', () => {
  const t = partida();
  const b = torreta(t);
  zombi(t, 'normal', b.x + 30 + MILITARY.min * 0.5, b.y + 30);
  zombi(t, 'normal', b.x + 30 + MILITARY.range + 60, b.y + 30);
  assert.equal(hastaDisparar(t, b, 3), null);
});

test('el misil estalla con el radio y el daño del misil del Bomber; el de adorno no hace daño', () => {
  const t = partida();
  const { x, y } = t.world.spawn;
  const blasts = [];
  const real = t.structures.explode.bind(t.structures);
  t.structures.explode = (game, g, R, power, fling) => {
    blasts.push({ R, power, fling, owner: g.owner });
    return real(game, g, R, power, fling);
  };
  const z = zombi(t, 'normal', x + 150, y);
  regrid(t);
  t.bullets.spawn(militaryMissile(x, y, 0, 400, 'ana'));
  for (let i = 0; i < 60 && t.bullets.list.length; i++) t.bullets.update(1 / 60, t.game);
  assert.equal(blasts.length, 1, 'estalló al tocar al zombi');
  assert.deepEqual(blasts[0], { R: ABILITY.bomber.radius, power: ABILITY.bomber.power, fling: 1.5, owner: 'ana' });
  assert.ok(t.hits.some(([q]) => q === z));
  // el de adorno (clientes en línea) se apaga sin hacer daño
  const antes = t.hits.length;
  t.bullets.spawn(militaryMissile(x, y, 0, 400, null, true));
  for (let i = 0; i < 60 && t.bullets.list.length; i++) t.bullets.update(1 / 60, t.game);
  assert.equal(blasts.length, 1);
  assert.equal(t.hits.length, antes);
  // sin tocar a nadie, estalla donde estaba su blanco
  t.bullets.spawn(militaryMissile(x, y, Math.PI, 120, 'ana'));
  for (let i = 0; i < 60 && t.bullets.list.length; i++) t.bullets.update(1 / 60, t.game);
  assert.equal(blasts.length, 2);
});
