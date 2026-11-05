// Los zombis vienen a toda velocidad hasta tocarte (no frenan al entrar en pantalla ni al alcanzarte) y,
// si te mueres, los de cerca corren a comerte.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEATH, WAVES } from '../js/core/config.ts';
import { Director } from '../js/sim/director.ts';
import { Player } from '../js/sim/player.ts';
import { World } from '../js/sim/world.ts';
import { Horde } from '../js/sim/zombies.ts';
import { fakeGame, silent } from './helpers.js';

function partida() {
  const world = new World(777);
  const horde = new Horde();
  const player = new Player(world.spawn.x, world.spawn.y);
  const game = fakeGame({
    world,
    horde,
    player,
    particles: silent,
    decals: silent,
    structures: { wires: [], blocks: [], trapAt: () => null },
    time: 0,
    state: 'play',
    onZombieHit: () => {},
  });
  world.updateFlow(player.x, player.y);
  return { world, horde, player, game };
}

// Un zombi a dist px a la derecha del jugador, sin tropezar ni desviarse; devuelve cuánto avanza hacia
// el jugador en un paso de 1/60 s, como fracción de su velocidad.
function paso(t, dist) {
  const p = t.player;
  t.horde.list.length = 0;
  const z = t.horde.spawn('normal', p.x + dist, p.y, 1, 1);
  Object.assign(z, { spawnT: 0, stumbleT: 0, nextStumble: 99, wander: 0, wanderV: 0, wob: 0, pace: 1 });
  const x0 = z.x;
  t.horde.update(1 / 60, t.game);
  return (x0 - z.x) / (z.speed * (1 / 60));
}

test('outside: 0 dentro de la vista y crece al alejarse de su borde', () => {
  const d = new Director();
  const views = [{ x: 0, y: 0, hw: 400, hh: 300 }];
  assert.equal(d.outside(views, 100, 100, 10), 0);
  assert.equal(d.outside(views, 400 + 50 + 100, 0, 10), 100);
  assert.ok(d.outside(views, 2000, 0, 10) > d.outside(views, 900, 0, 10));
  assert.equal(d.outside([], 0, 0, 10), Number.POSITIVE_INFINITY);
});

test('al alcanzarte no frenan hasta tocarte', () => {
  const t = partida();
  const z0 = t.horde.spawn('normal', 0, 0, 1, 1);
  const reach = z0.r + t.player.r + z0.def.reach;
  z0.dead = true;
  t.horde.removeDead();
  // a tiro de golpe pero sin tocarte todavía: a toda velocidad (antes iba al 15 %)
  const k = paso(t, reach - 2);
  assert.ok(k > 0.6, `avanzó ${k.toFixed(2)} de su velocidad`);
});

test('fuera de pantalla el impulso se apaga antes de que aparezcan', () => {
  const t = partida();
  const d = new Director();
  t.game.director = d;
  t.game.camera = { x: t.player.x, y: t.player.y, viewW: 800, viewH: 600 };
  // justo afuera del borde de la vista ya casi van a su velocidad normal
  const borde = paso(t, 400 + 14 + 40 + 20);
  // lejos, con todo el impulso
  const lejos = paso(t, 400 + 14 + 40 + WAVES.offRamp + 200);
  assert.ok(borde < 1.2, `en el borde ${borde.toFixed(2)}`);
  assert.ok(lejos > 1.5, `lejos ${lejos.toFixed(2)}`);
});

test('muerto el jugador, los de cerca corren a comérselo', () => {
  const t = partida();
  const vivo = paso(t, 200);
  t.player.alive = false;
  const muerto = paso(t, 200);
  assert.ok(muerto > vivo * (DEATH.feast - 0.25), `vivo ${vivo.toFixed(2)} · muerto ${muerto.toFixed(2)}`);
});
