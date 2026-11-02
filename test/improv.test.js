// Misil improvisado (SHOP.improv, IMPROV): de un solo uso, sale recto y estalla al primer golpe.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { IMPROV, SHOP, SHOP_ORDER, THROWABLES } from '../js/core/config.ts';
import { improvMissile, Structures } from '../js/sim/build.ts';
import { Bullets } from '../js/sim/bullets.ts';
import { World } from '../js/sim/world.ts';
import { Horde } from '../js/sim/zombies.ts';
import { fakeGame, silent } from './helpers.js';

function partida() {
  const world = new World(777);
  const horde = new Horde();
  const structures = new Structures();
  const bullets = new Bullets();
  const blasts = [];
  const game = fakeGame({ world, horde, structures, bullets, particles: silent, camera: silent, decals: silent });
  structures.explode = (_g, at, R, power) => blasts.push({ x: at.x, y: at.y, R, power, owner: at.owner });
  const { x, y } = world.spawn;
  game.player = { x, y };
  return { world, horde, structures, bullets, game, blasts };
}

function volar(t) {
  t.horde.grid.clear();
  for (const z of t.horde.list) t.horde.grid.insert(z);
  for (let i = 0; i < 120 && t.bullets.list.length; i++) t.bullets.update(1 / 60, t.game);
}

test('se compra en la tienda como la granada y se usa una vez', () => {
  assert.ok(THROWABLES.includes('improv'));
  assert.ok(SHOP_ORDER.includes('improv'));
  assert.equal(SHOP.improv.consumable, true);
  assert.equal(SHOP.improv.price, 120);
});

test('sale hacia donde apuntas y estalla en el primer zombi que toca', () => {
  const t = partida();
  const { x, y } = t.world.spawn;
  // una fila de zombis atravesada en su camino (el misil cabecea: alguno lo recibe)
  for (const dy of [-60, -30, 0, 30, 60]) t.horde.spawn('fat', x + 140, y + dy, 1, 0.001).spawnT = 0;
  t.structures.launchImprov(t.game, x + 400, y, 'ana');
  assert.equal(t.bullets.list.length, 1);
  assert.ok(t.bullets.list[0].improv);
  volar(t);
  assert.equal(t.bullets.list.length, 0);
  assert.equal(t.blasts.length, 1);
  assert.equal(t.blasts[0].R, IMPROV.radius);
  assert.equal(t.blasts[0].power, IMPROV.power);
  assert.equal(t.blasts[0].owner, 'ana');
  assert.ok(Math.abs(t.blasts[0].x - (x + 140)) < 60, 'estalló en la fila, no al final');
});

test('sin tocar a nadie estalla al final de su recorrido', () => {
  const t = partida();
  const { x, y } = t.world.spawn;
  t.bullets.spawn(improvMissile(x, y, Math.PI / 2));
  volar(t);
  assert.equal(t.blasts.length, 1);
  assert.ok(Math.hypot(t.blasts[0].x - x, t.blasts[0].y - y) <= IMPROV.range + 4);
});
