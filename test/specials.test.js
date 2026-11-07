// Zombis con habilidades (js/sim/specials.ts, SPECIALS en config): cuándo salen, el escupitajo de
// ácido, el grito del chillón, el excavador bajo tierra y el saltador sobre las barricadas.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EVENTS, SPECIAL_ORDER, SPECIALS, WAVES, ZOMBIE_VARIANTS, ZOMBIES } from '../js/core/config.ts';
import { TYPES } from '../js/net/protocol.ts';
import { waveCounts } from '../js/sim/director.ts';
import { LOB_ACID, tryJump } from '../js/sim/specials.ts';
import { Player } from '../js/sim/player.ts';
import { World } from '../js/sim/world.ts';
import { Horde } from '../js/sim/zombies.ts';
import { fakeGame, silent } from './helpers.js';

function partida() {
  const world = new World(777);
  const horde = new Horde();
  const player = new Player(world.spawn.x, world.spawn.y);
  const hits = [];
  const game = fakeGame({
    world,
    horde,
    player,
    particles: silent,
    camera: silent,
    decals: silent,
    structures: { wires: [], blocks: [], trapAt: () => null, damageBlock: () => {}, topOf: (b) => b },
    time: 0,
    state: 'play',
    hurtFlash: 0,
    killZombie: (z) => {
      z.dead = true;
    },
    onZombieHit: (z) => hits.push(z.type),
    onGiantStep: () => {},
    onSuperPunch: () => {},
    onPlayerDeath: () => {},
  });
  world.updateFlow(player.x, player.y);
  return { world, horde, player, game, hits };
}

// Una dirección desde el jugador con dist px libres en línea recta.
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

function zombi(t, type, dist) {
  const a = libre(t, dist);
  const z = t.horde.spawn(type, t.player.x + Math.cos(a) * dist, t.player.y + Math.sin(a) * dist, 1, 1);
  Object.assign(z, { spawnT: 0, nextStumble: 99 });
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

test('cada uno tiene ficha, variantes de dibujo y lugar en la foto', () => {
  for (const k of SPECIAL_ORDER) {
    assert.ok(ZOMBIES[k], k);
    assert.ok(ZOMBIE_VARIANTS[k] > 0, k);
    assert.ok(TYPES.includes(k), `${k} en TYPES`);
  }
  // se agregaron al final: los índices de los de antes no cambian
  assert.equal(TYPES.indexOf('demon'), TYPES.indexOf('spitter') - 1);
});

test('salen desde su oleada, pocos, y crecen; en la estampida no', () => {
  const m = WAVES.count;
  for (const k of SPECIAL_ORDER) {
    const from = SPECIALS[k].from;
    assert.equal(waveCounts(from - 1, m, null)[k], 0, `${k} antes de la oleada ${from}`);
    assert.ok(waveCounts(from, m, null)[k] >= 1, `${k} en la oleada ${from}`);
    assert.ok(waveCounts(from + 10, m, null)[k] > waveCounts(from, m, null)[k], `${k} crece`);
    assert.equal(waveCounts(30, m, EVENTS.types.stampede)[k], 0);
  }
});

test('el escupidor se para, tiembla y escupe ácido que cae donde vas a estar', () => {
  const t = partida();
  const z = zombi(t, 'spitter', 300);
  z.spitCd = 0;
  let windup = false;
  correr(t, 2, () => {
    windup ||= z.bs === 'windup';
    return t.horde.lobs.length === 0;
  });
  assert.ok(windup, 'se prepara antes (el cliente lo ve temblar)');
  assert.equal(t.horde.lobs.length, 1);
  const l = t.horde.lobs[0];
  assert.equal(l.kind, LOB_ACID);
  assert.ok(Math.hypot(l.x - t.player.x, l.y - t.player.y) < 5, 'apunta a ti (quieto)');
  // al caer te quema y deja un charco de ácido
  correr(t, SPECIALS.spitter.fly + 0.2, () => t.horde.lobs.length > 0 || t.hits.length === 0);
  assert.ok(t.hits.includes('spitter'), 'el escupitajo te pega');
  assert.ok(t.horde.zones.some((zn) => zn.kind === SPECIALS.spitter.zone));
});

test('el escupidor no escupe si estás muy cerca o muy lejos', () => {
  for (const d of [SPECIALS.spitter.range[0] - 60, SPECIALS.spitter.range[1] + 200]) {
    const t = partida();
    const z = zombi(t, 'spitter', d);
    z.spitCd = 0;
    z.speed = 0;
    correr(t, 0.3);
    assert.equal(z.bs !== 'windup' && t.horde.lobs.length === 0, true, `a ${d} px`);
  }
});

test('el grito del chillón acelera a los de alrededor y no a los lejanos', () => {
  const t = partida();
  const z = zombi(t, 'screamer', 300);
  z.yellCd = 0;
  const cerca = t.horde.spawn('normal', z.x + 40, z.y, 1, 1);
  const lejos = t.horde.spawn('normal', z.x + SPECIALS.screamer.r * 3, z.y, 1, 1);
  t.horde.grid.clear();
  for (const o of t.horde.list) t.horde.grid.insert(o);
  correr(t, SPECIALS.screamer.windup + 0.1);
  assert.ok(cerca.buffT > 0 && cerca.buffK === SPECIALS.screamer.boost, 'el de al lado corre más');
  assert.equal(cerca.buffRes, 1, 'sin resistencia extra');
  assert.ok(!(lejos.buffT > 0), 'el lejano no lo oye');
});

test('el excavador va bajo tierra, sin chocar con muros, y sale cerca de ti golpeando', () => {
  const t = partida();
  const z = zombi(t, 'digger', 600);
  correr(t, 0.05);
  assert.ok(z.under, 'se entierra al aparecer');
  assert.equal(
    t.horde.grid.query(z.x - 5, z.y - 5, z.x + 5, z.y + 5, []).includes(z),
    false,
    'bajo tierra las balas no lo encuentran',
  );
  let warned = false;
  correr(t, 8, () => {
    warned ||= z.bs === 'windup';
    return z.under;
  });
  assert.ok(warned, 'avisa antes de salir');
  assert.ok(!z.under);
  assert.ok(Math.hypot(z.x - t.player.x, z.y - t.player.y) < SPECIALS.digger.emerge + 20);
  assert.ok(t.hits.includes('digger'), 'te golpea al salir');
});

test('el saltador brinca una barricada de una capa y no una de dos', () => {
  const t = partida();
  const z = t.horde.spawn('jumper', 1000, 1000, 1, 1);
  const blk = { x: 1012, y: 960, w: 20, h: 80, layer: 0 };
  t.game.world = { pointBlocked: () => null };
  assert.equal(tryJump(z, blk, t.game, t.game.world), true);
  assert.equal(z.bs, 'leap');
  assert.ok(z.tx > blk.x + blk.w + z.r, 'cae del otro lado');
  // en pleno salto vuela por encima de todo
  correr({ ...t, game: { ...t.game, world: t.world } }, SPECIALS.jumper.time / 2);
  assert.ok(z.air > 0);

  const q = t.horde.spawn('jumper', 1000, 1000, 1, 1);
  t.game.structures.topOf = () => ({ ...blk, layer: 1 });
  assert.equal(tryJump(q, blk, t.game, t.game.world), false, 'dos capas: no puede');
  t.game.structures.topOf = (b) => b;
  t.game.world = { pointBlocked: () => true };
  assert.equal(tryJump(q, blk, t.game, t.game.world), false, 'sin sitio del otro lado: no salta');
});

test('mientras salta no lo frena el alambre y al caer sigue caminando', () => {
  const t = partida();
  const z = zombi(t, 'jumper', 300);
  Object.assign(z, { bs: 'leap', bt: SPECIALS.jumper.time, lx0: z.x, ly0: z.y, tx: z.x + 60, ty: z.y });
  let trapped = 0;
  t.game.structures.wires = [{}];
  t.game.structures.trapAt = () => {
    trapped++;
    return { slow: 0, dps: 0 };
  };
  correr(t, SPECIALS.jumper.time + 0.2);
  assert.equal(z.bs, 'walk');
  assert.equal(z.air, 0);
  assert.equal(trapped, 0, 'el alambre no le hace nada');
});
