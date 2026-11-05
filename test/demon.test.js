// Demonio rojo (ZOMBIES.demon y DEMON): cuándo sale, que es el más rápido, el salto hacia ti, la carrera
// como loco, que las balas no lo frenan y que el fuego lo mata más rápido.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEMON, EVENTS, MOLOTOV, WAVES, ZOMBIES } from '../js/core/config.ts';
import { bulletHit } from '../js/sim/combat.ts';
import { waveCounts } from '../js/sim/director.ts';
import { Player } from '../js/sim/player.ts';
import { World } from '../js/sim/world.ts';
import { Horde } from '../js/sim/zombies.ts';
import { bullet, fakeGame, silent } from './helpers.js';

function partida() {
  const world = new World(777);
  const horde = new Horde();
  const player = new Player(world.spawn.x, world.spawn.y);
  const game = fakeGame({
    world,
    horde,
    player,
    particles: silent,
    camera: silent,
    decals: silent,
    structures: { wires: [], blocks: [], trapAt: () => null },
    time: 0,
    state: 'play',
    hurtFlash: 0,
    killZombie: (z) => {
      z.dead = true;
    },
    onZombieHit: () => {},
    onGiantStep: () => {},
    onSuperPunch: () => {},
    onPlayerDeath: () => {},
  });
  world.updateFlow(player.x, player.y);
  return { world, horde, player, game };
}

// Una dirección desde el jugador con dist px libres en línea recta (para que lo vea y pueda saltar).
function libre(t, dist) {
  const p = t.player;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    let ok = true;
    for (let s = 0; s <= dist + 40 && ok; s += 10)
      ok = !t.world.pointBlocked(p.x + Math.cos(a) * s, p.y + Math.sin(a) * s, 22);
    if (ok) return a;
  }
  throw new Error('no hay línea libre');
}

function demonio(t, dist) {
  const a = libre(t, dist);
  const z = t.horde.spawn('demon', t.player.x + Math.cos(a) * dist, t.player.y + Math.sin(a) * dist, 1, 1);
  Object.assign(z, { spawnT: 0, nextStumble: 99, rageCd: 99 });
  return z;
}

function correr(t, s, each) {
  const dt = 1 / 60;
  for (let i = 0; i < s * 60; i++) {
    t.game.time += dt;
    t.player.hp = 1e9;
    t.horde.update(dt, t.game);
    if (each?.() === false) break;
  }
}

test('salen desde la oleada DEMON.from, pocos, y crecen; en la estampida no', () => {
  const m = WAVES.count;
  for (let w = 1; w < DEMON.from; w++) assert.equal(waveCounts(w, m, null).demon, 0, `oleada ${w}`);
  assert.ok(waveCounts(DEMON.from, m, null).demon >= 1);
  assert.ok(waveCounts(DEMON.from + 10, m, null).demon > waveCounts(DEMON.from, m, null).demon);
  assert.equal(waveCounts(30, m, EVENTS.types.stampede).demon, 0);
  const c = waveCounts(20, m, null);
  assert.equal(c.total, c.normal + c.swat + c.sprinter + c.fat + c.heavy + c.bull + c.rock + c.demon);
});

test('la vida del rocoso y el más rápido de todos los zombis comunes', () => {
  const d = ZOMBIES.demon;
  assert.equal(d.hp, ZOMBIES.rock.hp);
  for (const [k, z] of Object.entries(ZOMBIES)) if (k !== 'demon' && !z.boss) assert.ok(d.speed > z.speed, k);
});

test('salta hacia ti y cae a tu lado, listo para golpear', () => {
  const t = partida();
  const z = demonio(t, 340);
  z.leapCd = 0;
  let salto = false;
  correr(t, 0.3, () => {
    salto ||= z.air > 0;
    return !salto;
  });
  assert.ok(salto, 'saltó');
  correr(t, 2, () => z.leaping);
  const d = Math.hypot(z.x - t.player.x, z.y - t.player.y);
  assert.ok(d < z.r + t.player.r + 40, `cayó a ${Math.round(d)} px`);
  assert.equal(z.stumbleT <= 0, true, 'cae sin tropezar');
});

test('no salta si estás demasiado cerca o demasiado lejos', () => {
  for (const dist of [DEMON.leap.min - 40, DEMON.leap.max + 120]) {
    const t = partida();
    const z = demonio(t, dist);
    z.leapCd = 0;
    let salto = false;
    correr(t, 0.05, () => {
      salto ||= z.air > 0;
    });
    assert.ok(!salto, `a ${dist} px`);
  }
});

test('a ratos corre como loco: más rápido', () => {
  const avance = (rage) => {
    const t = partida();
    const z = demonio(t, 600);
    z.leapCd = 99;
    z.rageCd = rage ? 0 : 99;
    z.pace = 1;
    Object.assign(z, { speed: 200, wob: 0, wander: 0, wanderV: 0 });
    const d0 = Math.hypot(z.x - t.player.x, z.y - t.player.y);
    correr(t, 0.5);
    return d0 - Math.hypot(z.x - t.player.x, z.y - t.player.y);
  };
  const loco = avance(true);
  const normal = avance(false);
  assert.ok(loco > normal * 1.15, `${loco.toFixed(0)} contra ${normal.toFixed(0)}`);
});

test('las balas no lo frenan, pero el fuego le hace mucho más daño', () => {
  const g = fakeGame();
  const z = { ...new Horde().spawn('demon', 0, 0, 1, 1) };
  bulletHit(g, z, bullet({ dmg: 10 }), 0, 0);
  assert.ok(!(z.slow > 0), 'no se frena');
  const hp0 = z.hp;
  bulletHit(g, z, bullet({ dmg: 10, flame: true, burn: 3 }), 0, 0);
  assert.equal(hp0 - z.hp, 10 * ZOMBIES.demon.fire);
  // ardiendo pierde fire veces más vida que otro zombi
  const t = partida();
  const dz = demonio(t, 600);
  const nz = t.horde.spawn('normal', dz.x, dz.y + 1, 1, 1);
  nz.hp = nz.maxHp = 1e6;
  dz.burn = nz.burn = 2;
  const a = dz.hp;
  const b = nz.hp;
  correr(t, 0.5);
  const kd = a - dz.hp;
  const kn = b - nz.hp;
  assert.ok(Math.abs(kd / kn - ZOMBIES.demon.fire) < 0.3, `${kd.toFixed(1)} contra ${kn.toFixed(1)}`);
  assert.ok(kn > MOLOTOV.dps * 0.4);
});
