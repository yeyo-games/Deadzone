// Ningún zombi aparece dentro de una base cerrada ni pegado a lo construido (WAVES.baseGap).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WAVES } from '../js/core/config.ts';
import { Director } from '../js/sim/director.ts';
import { World } from '../js/sim/world.ts';
import { Horde } from '../js/sim/zombies.ts';
import { fakeGame, silent } from './helpers.js';

// Encierra (x, y) en un cuadrado de muros de media anchura half.
function base(world, x, y, half) {
  const t = 20;
  const walls = [
    { x: x - half, y: y - half, w: half * 2, h: t },
    { x: x - half, y: y + half - t, w: half * 2, h: t },
    { x: x - half, y: y - half, w: t, h: half * 2 },
    { x: x + half - t, y: y - half, w: t, h: half * 2 },
  ];
  for (const w of walls) world.addDynamic({ k: 0, block: true, ...w });
  return walls;
}

function partida(half) {
  const world = new World(777);
  const { x, y } = world.spawn;
  const horde = new Horde();
  const game = fakeGame({
    world,
    horde,
    particles: silent,
    player: { x, y, alive: true },
    camera: { x, y, viewW: 400, viewH: 300 },
    spawnFocus: () => ({ x, y }),
  });
  if (half) base(world, x, y, half);
  world.updateFlow(x, y);
  const d = Object.assign(new Director(), { events: false });
  game.director = d;
  return { world, horde, game, d, x, y };
}

const dentro = (z, x, y, half) => Math.abs(z.x - x) < half && Math.abs(z.y - y) < half;

test('el interior de una base cerrada se reconoce; la ciudad de fuera no', () => {
  const t = partida(300);
  assert.equal(t.world.inBase(t.x, t.y), true);
  assert.equal(t.world.inBase(t.x + 120, t.y - 150), true);
  assert.equal(t.world.baseSpot(t.x + 300 + WAVES.baseGap / 2, t.y), true, 'pegado al muro');
  const libre = partida(0);
  assert.equal(libre.world.inBase(libre.x, libre.y), false);
});

for (const half of [320, 600]) {
  test(`con el jugador encerrado (base de ${half * 2} px) todos salen fuera de la base`, () => {
    const t = partida(half);
    t.d.queue = Array(60).fill('normal');
    for (let i = 0; i < 6; i++) t.d.spawnGroup(t.game, 10);
    const zs = t.horde.list;
    assert.ok(zs.length >= 20, `salieron ${zs.length}`);
    for (const z of zs) {
      assert.ok(!dentro(z, t.x, t.y, half), `zombi dentro en ${Math.round(z.x - t.x)},${Math.round(z.y - t.y)}`);
      assert.ok(!t.world.baseSpot(z.x, z.y), 'pegado a la base');
    }
  });
}

test('con una base abierta lejos del jugador, nadie sale pegado a sus muros', () => {
  const t = partida(0);
  // una base cerrada justo en la orilla de la vista
  base(t.world, t.x + 330, t.y, 150);
  t.world.updateFlow(t.x, t.y);
  t.d.queue = Array(80).fill('normal');
  for (let i = 0; i < 10; i++) t.d.spawnGroup(t.game, 10);
  assert.ok(t.horde.list.length >= 30);
  for (const z of t.horde.list) {
    assert.ok(!dentro(z, t.x + 330, t.y, 150), 'dentro de la base');
    assert.ok(!t.world.baseSpot(z.x, z.y), 'pegado a la base');
  }
});
