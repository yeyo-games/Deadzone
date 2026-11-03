// Jefes (sim/bosses.ts): el Rocoso Supremo. Daño por la espalda y piel endurecida, fases y furia,
// pisotón, embestida, piedra lanzada, premio al derrotarlo y lo que viaja en la foto.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BOSS, BOSSES, SHOP, ZOMBIES } from '../js/core/config.ts';
import {
  bossDamage,
  bossFor,
  bossFx,
  bossHp,
  bossPhase,
  bossStatus,
  FX_LINE,
  FX_LOB,
  FX_N,
  FX_RING,
  STATUS_N,
  spawnBoss,
} from '../js/sim/bosses.ts';
import { Structures } from '../js/sim/build.ts';
import { bulletHit } from '../js/sim/combat.ts';
import { Player } from '../js/sim/player.ts';
import * as Rules from '../js/sim/rules.ts';
import { World } from '../js/sim/world.ts';
import { Horde } from '../js/sim/zombies.ts';
import { encodeBosses } from '../js/net/snapshot.ts';
import { TYPES } from '../js/net/protocol.ts';
import { fakeGame, silent } from './helpers.js';

const B = BOSSES.supremo;

// Una partida mínima con el mundo, la horda y las barricadas de verdad.
function partida() {
  const world = new World(777);
  const horde = new Horde();
  const structures = new Structures();
  const player = new Player(world.spawn.x, world.spawn.y);
  const banners = [];
  const game = fakeGame({
    world,
    horde,
    structures,
    player,
    particles: silent,
    camera: silent,
    decals: silent,
    pickups: { drop: () => {} },
    time: 0,
    state: 'play',
    hurtFlash: 0,
    hitZombie: () => {},
    killZombie: (z) => {
      z.dead = true;
    },
    onZombieHit: () => {},
    onGiantStep: () => {},
    onSuperPunch: () => {},
    onPlayerDeath: () => {},
    banner: (t, s) => banners.push([t, s]),
  });
  return { world, horde, structures, player, game, banners };
}

function jefe(t, dx = 0, dy = -300) {
  const z = spawnBoss(t.game, 'supremo', t.player.x + dx, t.player.y + dy);
  z.spawnT = 0;
  return z;
}

function pieza(game, kind, x, y) {
  const { hp, w, h } = SHOP[kind];
  const o = { k: 0, x, y, w, h, low: true, block: true, kind, hp, max: hp, hitT: 0, cd: 0, ang: 0, owner: null };
  game.structures.blocks.push(o);
  game.world.addDynamic(o);
  return o;
}

// Corre la horda s segundos (con un tope de vida para el jugador, que no muera).
function correr(t, s, cada) {
  for (let i = 0; i < s * 60; i++) {
    t.player.hp = Math.max(t.player.hp, 50);
    t.horde.update(1 / 60, t.game);
    cada?.();
  }
}

test('cada 5 oleadas un jefe; su vida crece con los jugadores', () => {
  assert.equal(bossFor(BOSS.every), 'supremo');
  for (const w of [1, 4, 6, 9]) assert.equal(bossFor(w), null);
  assert.equal(ZOMBIES.supremo.hp, 15000);
  assert.equal(bossHp(1), 1);
  assert.equal(bossHp(3), 1 + 2 * BOSS.perPlayer);
  const t = partida();
  t.game.targets = [t.player, new Player(0, 0), new Player(0, 0)];
  const z = jefe(t);
  assert.equal(z.maxHp, ZOMBIES.supremo.hp * bossHp(3));
});

test('por la espalda le entra más daño; con la piel endurecida, la mitad', () => {
  const t = partida();
  const z = jefe(t);
  z.angle = 0;
  assert.equal(bossDamage(z, { dx: -1, dy: 0 }), 1, 'de frente');
  assert.equal(bossDamage(z, { dx: 1, dy: 0 }), B.back, 'por la espalda');
  z.hardT = 1;
  assert.equal(bossDamage(z, { dx: -1, dy: 0 }), 1 - B.skin.k);
  // bulletHit lo aplica (y no lo frena ni lo empuja)
  z.hardT = 0;
  const hp = z.hp;
  bulletHit(t.game, z, { dmg: 100, dx: 1, dy: 0, knock: 60 }, z.x, z.y);
  assert.equal(z.hp, hp - 100 * B.back);
  assert.equal(z.kx, 0);
  assert.ok(!(z.slow > 0));
});

test('fases por la vida y, desesperado, la furia de piedra: corre y pega más rápido', () => {
  const t = partida();
  const z = jefe(t, 0, -900);
  assert.equal(bossPhase(z), 0);
  z.hp = z.maxHp * 0.5;
  assert.equal(bossPhase(z), 1);
  const sp = z.speed;
  z.hp = z.maxHp * 0.2;
  assert.equal(bossPhase(z), 2);
  correr(t, 0.05);
  assert.ok(z.fury);
  assert.equal(z.speed, sp * B.fury.speed);
  assert.equal(z.atkK, B.fury.rate);
  assert.match(t.banners.at(-1)[0], /enfurece/);
});

test('pisotón: avisa en el suelo, luego golpea y avienta al jugador cercano y daña barricadas', () => {
  const t = partida();
  const z = jefe(t, 0, -120);
  z.cd = 0;
  z.skinCd = 99;
  const muro = pieza(t.game, 'metal', Math.round(z.x / 20) * 20 + 60, Math.round(z.y / 20) * 20);
  const hp0 = t.player.hp;
  correr(t, 0.1);
  assert.equal(z.wk, 'stomp');
  const fx = bossFx(t.horde);
  assert.equal(fx[0][0], FX_RING);
  assert.equal(fx[0][3], B.stomp.r);
  let golpe = false;
  correr(t, B.stomp.windup + 0.1, () => {
    golpe ||= t.player.hp < hp0;
  });
  assert.ok(golpe, 'le quitó vida');
  assert.ok(muro.hp < SHOP.metal.hp, 'dañó la barricada');
});

// Pone al jugador en una calle por la que el jefe puede embestir dist px sin topar con un edificio y
// devuelve esa dirección.
function pasillo(t, dist) {
  const R = ZOMBIES.supremo.radius + 6;
  const libre = (x, y, ux, uy) => {
    for (let d = 0; d <= dist + 60; d += 20) if (t.world.pointBlocked(x + ux * d, y + uy * d, R)) return false;
    return true;
  };
  const { x: sx, y: sy } = t.world.spawn;
  for (let k = 0; k < 4000; k += 40)
    for (const [ox, oy] of [
      [k, 0],
      [-k, 0],
      [0, k],
      [0, -k],
    ])
      for (const [ux, uy] of [
        [0, -1],
        [1, 0],
      ])
        if (libre(sx + ox, sy + oy, ux, uy)) {
          t.player.x = sx + ox;
          t.player.y = sy + oy;
          return [ux, uy];
        }
  throw new Error('no hay pasillo libre');
}

test('embestida: avisa con una franja, aplasta la madera a su paso y atropella al jugador', () => {
  const t = partida();
  const p = t.player;
  const [ux, uy] = pasillo(t, 420);
  const z = jefe(t, ux * 420, uy * 420);
  z.cd = 0;
  z.skinCd = 99;
  // fuerza la embestida (y no la piedra)
  const r = Math.random;
  Math.random = () => 0.1;
  try {
    correr(t, 0.05);
  } finally {
    Math.random = r;
  }
  assert.equal(z.wk, 'charge');
  assert.equal(bossFx(t.horde)[0][0], FX_LINE);
  const madera = pieza(
    t.game,
    'wood',
    Math.round((p.x + ux * 220) / 20) * 20 - 20,
    Math.round((p.y + uy * 220) / 20) * 20 - 20,
  );
  const hp0 = p.hp;
  let atropello = false;
  correr(t, B.charge.windup + B.charge.time, () => {
    atropello ||= p.hp < hp0;
  });
  assert.ok(!t.structures.blocks.includes(madera), 'la madera quedó aplastada');
  assert.ok(atropello, 'te atropelló');
});

test('la piedra lanzada cae donde estabas y golpea el área', () => {
  const t = partida();
  const p = t.player;
  const z = jefe(t, 0, -400);
  z.cd = 0;
  z.skinCd = 99;
  const r = Math.random;
  Math.random = () => 0.9;
  try {
    correr(t, 0.05);
  } finally {
    Math.random = r;
  }
  assert.equal(z.wk, 'rock');
  correr(t, B.rock.windup + 0.05);
  assert.equal(t.horde.lobs.length, 1);
  assert.equal(bossFx(t.horde).find((f) => f[0] === FX_LOB)[3], B.rock.r);
  const hp0 = p.hp;
  correr(t, B.rock.fly);
  assert.equal(t.horde.lobs.length, 0);
  assert.ok(p.hp < hp0);
});

test('piel endurecida: la pone cuando ya está herido, dura su tiempo y se ve en la barra', () => {
  const t = partida();
  const z = jefe(t, 0, -900);
  z.cd = 0;
  z.skinCd = 0;
  z.hp = z.maxHp * 0.8;
  correr(t, B.skin.windup + 0.1);
  assert.ok(z.hardT > B.skin.time - 0.5);
  assert.equal(bossStatus(t.horde.list)[0].hard, true);
});

test('derrotado: premio para cada jugador, botín y aviso', () => {
  const t = partida();
  const z = jefe(t);
  const pagos = [];
  const drops = [];
  t.game.pickups = { drop: (k) => drops.push(k) };
  t.game.player.weapons = [{}, {}];
  Rules.killZombie(t.game, z, {
    kills: {},
    xp: () => {},
    bounty: () => {},
    golden: () => {},
    toast: () => {},
    boss: (_z, n) => pagos.push(n),
  });
  assert.deepEqual(pagos, [B.reward]);
  assert.ok(drops.filter((k) => k === 'crate').length >= 2);
  assert.match(t.banners.at(-1)[0], /derrotado/);
});

test('la foto lleva la barra y los avisos del jefe, esté donde esté', () => {
  const t = partida();
  const z = jefe(t, 0, -120);
  z.hp = z.maxHp * 0.4;
  z.cd = 0;
  z.skinCd = 99;
  correr(t, 0.1);
  const { bo, bf } = encodeBosses(t.horde);
  assert.equal(bo.length, STATUS_N);
  assert.equal(TYPES[bo[0]], 'supremo');
  assert.equal(bo[1], Math.ceil((z.hp / z.maxHp) * 1000));
  assert.equal(bo[2], 1, 'enfurecido');
  assert.equal(bf.length % FX_N, 0);
  assert.equal(bf[0], FX_RING);
});
