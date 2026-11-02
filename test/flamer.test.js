// Lanzallamas (WEAPONS.flamer): reemplaza al rifle, atraviesa a todos los que toca y los deja ardiendo.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CRATE_WEAPONS, WEAPON_ORDER, WEAPONS } from '../js/core/config.ts';
import { Bullets, flameBullet } from '../js/sim/bullets.ts';
import { bulletHit } from '../js/sim/combat.ts';
import { World } from '../js/sim/world.ts';
import { Horde } from '../js/sim/zombies.ts';
import { fakeGame, silent } from './helpers.js';

// Mundo, horda y balas de verdad; los golpes usan la regla de impacto real y se anotan en `hits`.
function partida() {
  const world = new World(777);
  const horde = new Horde();
  const bullets = new Bullets();
  const hits = [];
  const game = fakeGame({ world, horde, bullets, particles: silent, decals: silent });
  game.hitZombie = (z, b, hx, hy) => {
    hits.push(z);
    bulletHit(game, z, b, hx, hy);
  };
  return { world, horde, bullets, game, hits };
}

function zombi(t, type, x, y) {
  const z = t.horde.spawn(type, x, y, 1, 0.001);
  z.spawnT = 0;
  return z;
}

// Deja volar las llamaradas hasta que se apaguen.
function volar(t) {
  t.horde.grid.clear();
  for (const z of t.horde.list) t.horde.grid.insert(z);
  for (let i = 0; i < 120 && t.bullets.list.length; i++) t.bullets.update(1 / 60, t.game);
}

test('el lanzallamas ocupa el lugar del rifle en la tienda y en las cajas de armas', () => {
  assert.equal(WEAPONS.rifle, undefined);
  assert.equal(WEAPONS.flamer.name, 'Lanzallamas');
  assert.equal(WEAPON_ORDER.indexOf('flamer'), 3);
  assert.ok(CRATE_WEAPONS.includes('flamer'));
  assert.equal(WEAPONS.flamer.price, 1200);
});

test('la llamarada atraviesa a todos los de la fila, no los empuja y los deja ardiendo', () => {
  const t = partida();
  const { x, y } = t.world.spawn;
  const fila = [40, 90, 140].map((d) => zombi(t, 'normal', x + d, y));
  const hp = fila.map((z) => z.hp);
  t.bullets.spawn(flameBullet(x, y, 0, 9));
  volar(t);
  fila.forEach((z, i) => {
    assert.ok(t.hits.includes(z), `quemó al ${i + 1}º`);
    assert.equal(z.hp, hp[i] - 9);
    assert.equal(z.burn, WEAPONS.flamer.burn);
    assert.equal(z.kx, 0);
  });
});

test('el gigante ataja las llamas, y no llegan más allá de su alcance', () => {
  const t = partida();
  const { x, y } = t.world.spawn;
  const gigante = zombi(t, 'giant', x + 70, y);
  const detras = zombi(t, 'normal', x + 160, y);
  const lejos = zombi(t, 'normal', x, y + WEAPONS.flamer.range + 60);
  t.bullets.spawn(flameBullet(x, y, 0, 9));
  t.bullets.spawn(flameBullet(x, y, Math.PI / 2, 9));
  volar(t);
  assert.ok(t.hits.includes(gigante));
  assert.ok(!t.hits.includes(detras));
  assert.ok(!t.hits.includes(lejos));
});

test('las llamas de adorno (otro jugador en línea) no hacen daño', () => {
  const t = partida();
  const { x, y } = t.world.spawn;
  const z = zombi(t, 'normal', x + 60, y);
  t.bullets.spawn(flameBullet(x, y, 0, 0, true));
  volar(t);
  assert.equal(t.hits.length, 0);
  assert.ok(!(z.burn > 0));
});
