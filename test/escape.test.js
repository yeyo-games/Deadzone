// Modo Huida (js/sim/escape.ts): la camioneta y los bidones al empezar, recoger, la amenaza por minuto,
// cargar con H, defender la camioneta, subir y salir, y que explote.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ESCAPE, ESCAPE_OBJ, ESCAPE_ROUTE, ESCAPE_STOPS, EVENTS, VAN_UP_ORDER, VAN_UPS } from '../js/core/config.ts';
import { needAt, packEscape, unpackEscape } from '../js/sim/escape.ts';
import { isFinal, makeRoute, nextStops } from '../js/sim/route.ts';
import { Director } from '../js/sim/director.ts';
import { Escape } from '../js/sim/escape.ts';
import { Player } from '../js/sim/player.ts';
import { World } from '../js/sim/world.ts';
import { Horde } from '../js/sim/zombies.ts';
import { fakeGame, silent } from './helpers.js';

function partida() {
  const world = new World(4242);
  const horde = new Horde();
  const player = new Player(world.spawn.x, world.spawn.y);
  const ended = [];
  const booms = [];
  const game = fakeGame({
    world,
    horde,
    player,
    director: new Director(),
    particles: silent,
    camera: new Proxy({ x: 0, y: 0, viewW: 1300, viewH: 1000 }, { get: (o, k) => (k in o ? o[k] : () => {}) }),
    decals: silent,
    structures: {
      wires: [],
      blocks: [],
      blasts: [],
      trapAt: () => null,
      explode(g, at) {
        this.blasts.push({ x: at.x, y: at.y, t: 0.4 });
        booms.push(at);
      },
      ignite: () => {},
      damageBlock: () => {},
    },
    bullets: { list: [] },
    pickups: {
      list: [],
      drop(k, x, y) {
        this.list.push({ k, x, y, t: 0 });
      },
    },
    time: 0,
    state: 'play',
    money: 0,
    moneyEarned: 0,
    toast: () => {},
    moneyPop: () => {},
    killZombie: (z) => {
      z.dead = true;
    },
    onZombieHit: () => {},
    onGiantStep: () => {},
    onSuperPunch: () => {},
    onPlayerDeath: () => {},
    onGoldenExpired: () => {},
    onEscapeEnd: (r) => ended.push(r),
    spawnFocus: () => player,
  });
  world.updateFlow(player.x, player.y);
  const e = new Escape();
  game.escape = e;
  e.begin(game);
  return { world, horde, player, game, e, ended, booms };
}

const step = (t, s, each) => {
  const dt = 1 / 30;
  for (let i = 0; i < s * 30; i++) {
    t.game.time += dt;
    t.e.update(dt, t.game);
    t.horde.update(dt, t.game);
    t.horde.removeDead();
    if (each?.() === false) break;
  }
};

test('al empezar: la camioneta en un sitio libre, el jugador junto a ella y bidones alcanzables lejos', () => {
  const t = partida();
  const { van } = t.e;
  assert.ok(van, 'hay camioneta');
  t.world.removeDynamic(t.e.obs);
  assert.ok(t.world.rectFree(van.x, van.y, van.w, van.h), 'no está encima de otro obstáculo');
  t.world.addDynamic(t.e.obs);
  assert.ok(t.e.nearVan(t.game), 'el jugador empieza junto a ella');
  assert.ok(t.e.cans.length >= ESCAPE.need, 'al menos los bidones que hacen falta');
  for (const c of t.e.cans) {
    const d = Math.hypot(c.x - (van.x + van.w / 2), c.y - (van.y + van.h / 2));
    assert.ok(d > ESCAPE.dist[0] * 0.55, `lejos de la camioneta: ${Math.round(d)}`);
    assert.ok(!t.world.pointBlocked(c.x, c.y, 10), 'en un sitio libre');
  }
  assert.equal(t.game.director.state, 'escape', 'sin oleadas');
  assert.equal(t.game.pickups.list.filter((p) => p.k === 'crate').length, ESCAPE.crates, 'cajas de armas');
  assert.ok(
    t.game.pickups.list.every((p) => p.t < -1000),
    'el botín de la parada no desaparece',
  );
});

test('la amenaza sube con el tiempo y llegan zombis sin parar', () => {
  const t = partida();
  const L0 = ESCAPE.startLevel;
  assert.equal(t.e.level, L0, 'se llega con algo de amenaza');
  step(t, ESCAPE.levelEvery * 2 + 1);
  assert.equal(t.e.level, L0 + 2);
  assert.equal(t.game.director.wave, L0 + 2, 'los zombis salen con la vida de ese nivel');
  assert.ok(t.horde.list.length > 10, `llegaron zombis: ${t.horde.list.length}`);
  assert.ok(t.horde.list.length <= ESCAPE.alive[0] + ESCAPE.alive[1] * (L0 + 2), 'con tope de vivos');
});

test('los bidones se recogen al tocarlos; sin los que hacen falta no se puede cargar', () => {
  const t = partida();
  const p = t.player;
  p.use = true;
  step(t, ESCAPE.startT + 0.5);
  assert.equal(t.e.phase, 'search', 'sin combustible no carga');
  for (const c of t.e.cans.slice(0, ESCAPE.need)) {
    p.x = c.x;
    p.y = c.y;
    t.e.update(1 / 30, t.game);
  }
  assert.equal(t.e.have, ESCAPE.need);
  assert.ok(t.e.cans.slice(0, ESCAPE.need).every((c) => c.taken));
});

function conCombustible(t, extra = 0) {
  for (const c of t.e.cans.slice(0, ESCAPE.need + extra)) {
    t.player.x = c.x;
    t.player.y = c.y;
    t.e.update(1 / 30, t.game);
  }
  const v = t.e.van;
  t.player.x = v.x + v.w / 2;
  t.player.y = v.y + v.h + 20;
}

test('con H en la camioneta empieza la carga; los bidones de más la acortan y pagan', () => {
  const t = partida();
  conCombustible(t, 1);
  assert.equal(t.game.money, ESCAPE.extraPay, 'el bidón de más paga');
  t.player.use = true;
  assert.ok(t.e.prompt(t.game), 'el aviso de H aparece junto a la camioneta');
  step(t, ESCAPE.startT + 0.1, () => t.e.phase === 'search');
  assert.equal(t.e.phase, 'fuel');
  assert.ok(Math.abs(t.e.fuelMax - ESCAPE.fuelT * (1 - ESCAPE.extraK)) < 1e-6);
});

test('durante la carga la horda va por la camioneta y le pega', () => {
  const t = partida();
  conCombustible(t);
  t.player.use = true;
  step(t, ESCAPE.startT + 0.1, () => t.e.phase === 'search');
  t.player.use = false;
  // el jugador se va lejos: sólo queda la camioneta
  t.player.x += 900;
  step(t, 12);
  assert.ok(
    t.horde.list.some((z) => z.goal === t.e.goal),
    'hay zombis que van por la camioneta',
  );
  assert.ok(t.e.van.hp < t.e.van.max, 'la camioneta recibe golpes');
  // ningún golpe le quita más de maxHit
  const before = t.e.van.hp;
  t.e.hitVan(1e9, t.game);
  assert.ok(before - t.e.van.hp <= t.e.van.max * ESCAPE.van.maxHit + 1e-6);
});

test('tanque lleno, subir con H: la camioneta arranca, atropella y la parada termina (sigue el viaje)', () => {
  const t = partida();
  const m0 = t.game.money;
  conCombustible(t);
  t.player.use = true;
  step(t, ESCAPE.startT + 0.1, () => t.e.phase === 'search');
  t.e.fuelT = t.e.fuelMax;
  t.e.update(1 / 30, t.game);
  assert.equal(t.e.phase, 'ready');
  const v = t.e.van;
  t.player.x = v.x + v.w / 2;
  t.player.y = v.y + v.h + 20;
  const z = t.horde.spawn('normal', v.x + v.w + 120, v.y + v.h / 2, 1, 0.01);
  step(t, ESCAPE.boardT + 0.1, () => t.e.phase === 'ready');
  assert.equal(t.e.phase, 'leaving');
  assert.ok(t.player.inVan, 'el jugador va dentro');
  const hp = t.player.hp;
  t.player.hurt(50, t.game);
  assert.equal(t.player.hp, hp, 'dentro de la camioneta no recibe golpes');
  step(t, ESCAPE.leaveT + 0.2);
  assert.ok(z.dead, 'atropella al que estaba delante');
  assert.deepEqual(t.ended, ['stop'], 'en la primera parada no se escapa todavía');
  assert.equal(t.game.money - m0, ESCAPE_ROUTE.stopPay, 'premio por la parada');
  assert.equal(t.e.phase, 'done');
});

test('si la camioneta llega a cero explota y se acaba la huida', () => {
  const t = partida();
  for (let i = 0; i < 200 && t.e.phase !== 'lost'; i++) t.e.hitVan(1e9, t.game);
  assert.equal(t.e.phase, 'lost');
  step(t, ESCAPE.lostT + 0.2);
  assert.deepEqual(t.ended, ['van']);
});

test('clear quita la camioneta del mapa y apaga el modo', () => {
  const t = partida();
  const v = t.e.van;
  assert.ok(t.world.pointBlocked(v.x + v.w / 2, v.y + v.h / 2), 'la camioneta estorba');
  t.e.clear(t.game);
  assert.equal(t.e.active, false);
  assert.ok(!t.world.pointBlocked(v.x + v.w / 2, v.y + v.h / 2), 'ya no estorba');
});

test('la camioneta queda con calle libre por delante para salir', () => {
  let ok = 0;
  for (let i = 0; i < 6; i++) {
    const t = partida();
    const v = t.e.van;
    if (t.e.runwayFree(t.world, v.x, v.y, v.w, v.h)) ok++;
  }
  assert.ok(ok >= 5, `calle libre en ${ok} de 6 mapas`);
});

test('los bidones lejanos están custodiados: al acercarte sale su guardia, con un zombi con habilidad', () => {
  const t = partida();
  const guarded = t.e.cans.filter((c) => c.guard);
  assert.equal(guarded.length, ESCAPE.guards);
  for (const c of guarded) assert.ok(ESCAPE.guardTypes.includes(c.guard));
  const c = guarded[0];
  const type = c.guard;
  t.horde.list.length = 0;
  t.player.x = c.x - ESCAPE.guardR + 40;
  t.player.y = c.y;
  t.e.update(1 / 30, t.game);
  assert.equal(c.guard, '', 'sale una sola vez');
  assert.ok(
    t.horde.list.some((z) => z.type === type),
    `salió el ${type}`,
  );
  assert.ok(t.horde.list.length >= 2, 'con su grupo');
});

test('un bidón extra da una mejora rara a elegir', () => {
  const t = partida();
  t.game.bonusPicks = [];
  conCombustible(t, 1);
  assert.deepEqual(t.game.bonusPicks, ['fuel']);
});

test('con el tanque lleno se sube desde más lejos, en menos tiempo, y la camioneta aguanta más', () => {
  const t = partida();
  conCombustible(t);
  t.player.use = true;
  step(t, ESCAPE.startT + 0.1, () => t.e.phase === 'search');
  t.e.fuelT = t.e.fuelMax;
  t.e.update(1 / 30, t.game);
  assert.equal(t.e.phase, 'ready');
  const v = t.e.van;
  // a 90 px de la camioneta ya se puede subir
  t.player.x = v.x + v.w / 2;
  t.player.y = v.y + v.h + 90;
  assert.ok(t.e.prompt(t.game), 'el aviso de subir aparece de lejos');
  const hp = v.hp;
  t.e.hitVan(1e9, t.game);
  assert.ok(hp - v.hp <= v.max * ESCAPE.van.maxHit * ESCAPE.readyDmg + 1e-6, 'recibe menos daño');
  let s = 0;
  while (t.e.phase === 'ready' && s < 3) {
    t.e.update(1 / 30, t.game);
    s += 1 / 30;
  }
  assert.ok(s <= ESCAPE.boardT + 0.1, `sube en ${s.toFixed(2)} s`);
});

test('la ruta: misma semilla, mismo mapa; de la salida al puente sin callejones sin salida', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const r = makeRoute(seed);
    assert.deepEqual(makeRoute(seed), r, 'se repite con la semilla');
    assert.equal(r.nodes[0].kind, 'start');
    const last = r.nodes[r.nodes.length - 1];
    assert.equal(last.kind, 'bridge');
    assert.ok(isFinal(r, last.id) && !isFinal(r, 0));
    for (const n of r.nodes) {
      assert.ok(ESCAPE_STOPS[n.kind], n.kind);
      if (n.mod) assert.ok(EVENTS.types[n.mod], n.mod);
      if (n.layer < r.layers - 1) assert.ok(n.next.length >= 1, 'toda parada lleva a otra');
      for (const id of n.next) assert.equal(r.nodes[id].layer, n.layer + 1, 'los caminos avanzan una capa');
    }
    // todas se pueden alcanzar desde la salida
    const seen = new Set([0]);
    for (const n of r.nodes) if (seen.has(n.id)) for (const id of n.next) seen.add(id);
    assert.equal(seen.size, r.nodes.length, `semilla ${seed}: todas alcanzables`);
    assert.equal(nextStops(r, 0).length, r.nodes.filter((n) => n.layer === 1).length, 'desde la salida, a cualquiera');
  }
});

test('viajar sólo a una parada siguiente; cada parada pide más y la amenaza sube', () => {
  const t = partida();
  const e = t.e;
  const lvl1 = e.baseLevel;
  const bad = e.route.nodes.find((n) => n.layer === 2);
  assert.equal(e.travel(bad.id), false, 'no se salta capas');
  const next = e.route.nodes[0].next[0];
  assert.ok(e.travel(next));
  assert.equal(e.stop, 2);
  assert.deepEqual(e.visited, [0, next]);
  e.begin(t.game);
  assert.equal(e.phase, 'search');
  assert.ok(e.baseLevel >= lvl1, 'la amenaza no baja');
  // en la parada 4 ya hace falta un bidón más
  e.stop = 1 + ESCAPE_ROUTE.needEvery;
  assert.equal(e.need, ESCAPE.need + 1);
  assert.ok(e.cans.length >= e.need, 'hay bidones de sobra');
});

test('el tipo de parada cambia el botín y el dinero; la ronda especial llega al director', () => {
  const t = partida();
  const e = t.e;
  const market = e.route.nodes.find((n) => n.kind === 'market');
  const police = e.route.nodes.find((n) => n.kind === 'police');
  if (market) {
    e.at = market.id;
    e.begin(t.game);
    assert.equal(e.payK, ESCAPE_STOPS.market.pay);
  }
  if (police) {
    e.at = police.id;
    t.game.pickups.list.length = 0;
    e.begin(t.game);
    assert.equal(t.game.pickups.list.filter((p) => p.k === 'crate').length, ESCAPE.crates + ESCAPE_STOPS.police.crates);
  }
  const withMod = e.route.nodes.find((n) => n.mod);
  if (withMod) {
    e.at = withMod.id;
    e.begin(t.game);
    assert.equal(t.game.director.event, withMod.mod);
  }
});

test('en el puente: al cargar llega un jefe que lo bloquea; derrotado, salir es escapar', () => {
  const t = partida();
  const e = t.e;
  e.at = e.route.nodes.length - 1;
  e.begin(t.game);
  assert.ok(e.final);
  conCombustible(t);
  t.player.use = true;
  step(t, ESCAPE.startT + 0.1, () => t.e.phase === 'search');
  assert.ok(e.bossAlive, 'llegó el jefe');
  assert.ok(ESCAPE.boss.pool.includes(e.boss.type));
  e.fuelT = e.fuelMax;
  e.update(1 / 30, t.game);
  assert.equal(e.phase, 'ready');
  const v = e.van;
  t.player.x = v.x + v.w / 2;
  t.player.y = v.y + v.h + 20;
  assert.equal(e.prompt(t.game), null, 'con el jefe vivo no se puede subir');
  e.boss.dead = true;
  assert.ok(e.prompt(t.game), 'derrotado, ya se puede');
  step(t, ESCAPE.boardT + 0.1, () => t.e.phase === 'ready');
  step(t, ESCAPE.leaveT + 0.3);
  assert.deepEqual(t.ended, ['won']);
});

test('gasolinera: barriles que estallan con un disparo cerca y en cadena', () => {
  const t = partida();
  const e = t.e;
  const gas = e.route.nodes.find((n) => n.kind === 'gas');
  if (!gas) return;
  e.at = gas.id;
  e.begin(t.game);
  assert.equal(e.barrels.length, ESCAPE_STOPS.gas.barrels);
  const [a, b] = e.barrels;
  // sólo estos dos (los demás, puestos al azar, podían quedar cerca y estallar también en cadena)
  e.barrels = [a, b];
  // dos barriles juntos: uno estalla con la bala y el otro por la explosión
  b.x = a.x + 40;
  b.y = a.y;
  t.game.bullets.list.push({ x: a.x + 5, y: a.y, owner: null, life: 100 });
  e.updateBarrels(t.game);
  assert.equal(a.alive, false, 'la bala lo hace estallar');
  e.updateBarrels(t.game);
  assert.equal(b.alive, false, 'en cadena');
  assert.equal(t.booms.length, 2);
});

test('comisaría: la horda llega con más escudos', () => {
  const t = partida();
  const e = t.e;
  const police = e.route.nodes.find((n) => n.kind === 'police');
  if (!police) return;
  e.at = police.id;
  e.begin(t.game);
  e.t = 60;
  e.mixCache = null;
  t.game.director.event = '';
  e.spawnAcc = 5;
  e.spawn(1 / 30, t.game);
  const m = Object.fromEntries(e.mixCache.m);
  const total = Object.values(m).reduce((x, y) => x + y, 0);
  assert.ok(m.swat / total > 0.3, `swat ${Math.round((m.swat / total) * 100)}%`);
});

test('el estado viaja en la foto y el cliente lo deja listo para dibujarse', () => {
  const t = partida();
  const e = t.e;
  e.have = 2;
  e.t = 47.3;
  e.cans[0].taken = true;
  const a = packEscape(e, 3);
  const c = new e.constructor();
  const seed = unpackEscape(c, a, ['', '', '', 'supremo']);
  assert.equal(seed, e.seedFor());
  assert.equal(c.route.seed, e.route.seed);
  assert.equal(c.at, e.at);
  assert.equal(c.stop, e.stop);
  assert.equal(c.phase, e.phase);
  assert.equal(c.have, 2);
  assert.equal(c.level, e.level);
  assert.equal(c.van.x, Math.round(e.van.x));
  assert.equal(c.cans.length, e.cans.length);
  assert.equal(c.cans[0].taken, true);
  assert.equal(c.bossType, 'supremo');
  assert.ok(c.active);
});

test('la ruta no usa nada que dependa del motor de JavaScript (el navegador y el servidor deben generar la misma)', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../js/sim/route.ts', import.meta.url), 'utf8');
  assert.ok(!/\.sort\(\(\)\s*=>/.test(src), 'sort con comparador al azar: cada motor lo baraja distinto');
  // una semilla fija da siempre el mismo mapa (si cambia la generación, se actualiza a propósito)
  const r = makeRoute(429790250);
  assert.equal(r.nodes.length, makeRoute(429790250).nodes.length);
  assert.deepEqual(
    r.nodes.map((n) => n.next.length > 0 || n.kind === 'bridge'),
    r.nodes.map(() => true),
  );
});

/* ---------- mejoras de la camioneta y objetivos de las paradas ---------- */

/** Empieza una parada de este tipo (la primera de la ruta pasa a ser de ese tipo), sin que lleguen zombis. */
function parada(t, kind) {
  const e = t.e;
  const n = e.route.nodes[1];
  n.kind = kind;
  n.mod = '';
  e.at = n.id;
  e.stop = 2;
  e.begin(t.game);
  e.spawnAcc = -1e9;
  return e;
}

const zombiJunto = (t, x, y) => {
  const z = t.horde.spawn('normal', x, y, 1, 1);
  z.spawnT = 0;
  return z;
};

test('mejoras de la camioneta: niveles con precio, blindaje con más vida y tanque con un bidón menos', () => {
  const t = partida();
  const e = t.e;
  assert.equal(e.upCost('armor'), VAN_UPS.armor.price[0]);
  for (const _ of VAN_UPS.armor.price) assert.ok(e.buyUp('armor'));
  assert.equal(e.upCost('armor'), 0, 'al máximo');
  assert.equal(e.buyUp('armor'), false);
  assert.equal(e.buyUp('nada'), false);
  const need = e.need;
  e.buyUp('tank');
  assert.equal(e.need, need - VAN_UPS.tank.cans);
  assert.equal(needAt(1, { tank: 5 }), 1, 'nunca menos de un bidón');
  e.begin(t.game);
  const L = VAN_UPS.armor.price.length;
  assert.equal(e.van.max, ESCAPE.van.hp * (1 + VAN_UPS.armor.hp * L));
  const hp = e.van.hp;
  e.hitVan(10, t.game);
  assert.ok(Math.abs(hp - e.van.hp - 10 * (1 - VAN_UPS.armor.cut * L)) < 1e-6, 'el golpe quita menos');
  // el viaje nuevo las olvida
  e.newTrip(5);
  assert.deepEqual(e.ups, {});
});

test('torreta del techo: dispara sola mientras carga (no mientras se buscan bidones)', () => {
  const t = partida();
  const shots = [];
  t.game.bullets.spawn = (b) => shots.push(b);
  const e = t.e;
  e.buyUp('turret');
  e.begin(t.game);
  e.spawnAcc = -1e9;
  const v = e.van;
  const z = zombiJunto(t, v.x + v.w / 2, v.y - 150);
  z.speed = 0;
  step(t, 1);
  assert.equal(shots.length, 0, 'buscando bidones no dispara');
  e.phase = 'fuel';
  step(t, 1.5);
  assert.ok(shots.length > 0, 'cargando, dispara');
  assert.equal(shots[0].dmg, VAN_UPS.turret.dmg[0]);
});

test('claxon: una vez por parada aturde y avienta a los de alrededor; faros: los de cerca van lentos', () => {
  const t = partida();
  const e = t.e;
  e.buyUp('horn');
  e.buyUp('lights');
  e.begin(t.game);
  e.spawnAcc = -1e9;
  const v = e.van;
  const z = zombiJunto(t, v.x + v.w + 40, v.y + v.h / 2);
  t.horde.update(0.001, t.game);
  t.player.x = v.x + v.w / 2;
  t.player.y = v.y + v.h + 20;
  assert.equal(e.prompt(t.game).k, 'horn', 'con H junto a la camioneta: tocar el claxon');
  t.player.use = true;
  for (let i = 0; i < 30 && !e.hornUsed; i++) e.update(1 / 30, t.game);
  assert.ok(e.hornUsed);
  assert.ok(z.stumbleT > 0, 'aturdido');
  assert.ok(z.kx > 100, `aventado: ${Math.round(z.kx)}`);
  assert.equal(e.prompt(t.game), null, 'ya no se puede otra vez');
  const z2 = zombiJunto(t, v.x + v.w + 60, v.y + v.h / 2);
  t.horde.update(0.001, t.game);
  e.update(1 / 30, t.game);
  assert.ok(z2.dazzleT > 0 && z2.dazzleK === VAN_UPS.lights.slow[0], 'deslumbrado');
  // en la parada siguiente se puede de nuevo
  e.begin(t.game);
  assert.equal(e.hornUsed, false);
});

test('gasolinera: parado en la bomba se llenan bidones, hasta que se seca', () => {
  const t = partida();
  const e = parada(t, 'gas');
  const o = e.obj;
  assert.equal(o.kind, 'pump');
  const tick = (s) => {
    for (let i = 0; i < s * 30; i++) {
      t.player.x = o.x;
      t.player.y = o.y;
      e.update(1 / 30, t.game);
    }
  };
  tick(ESCAPE_OBJ.pump.t + 0.2);
  assert.equal(e.have, 1, 'un bidón de la bomba');
  tick(ESCAPE_OBJ.pump.t * ESCAPE_OBJ.pump.max);
  assert.equal(e.have, ESCAPE_OBJ.pump.max, 'hasta que se seca');
  assert.equal(o.state, 2);
});

test('clínica: el médico te sigue a la camioneta y luego los cura entre paradas; si lo matan, se pierde', () => {
  const t = partida();
  const e = parada(t, 'clinic');
  const o = e.obj;
  assert.equal(o.kind, 'medic');
  assert.equal(o.state, 0, 'espera');
  t.player.x = o.x + 20;
  t.player.y = o.y;
  e.update(1 / 30, t.game);
  assert.equal(o.state, 1, 'al tocarlo te sigue');
  // el jugador se va: el médico lo sigue
  const d0 = Math.hypot(t.player.x + 200 - o.x, t.player.y - o.y);
  t.player.x += 200;
  for (let i = 0; i < 15; i++) e.update(1 / 30, t.game);
  assert.ok(Math.hypot(t.player.x - o.x, t.player.y - o.y) < d0 - 40, 'lo sigue');
  // junto a la camioneta: sube
  const v = e.van;
  o.x = v.x + v.w / 2;
  o.y = v.y + v.h + 10;
  t.player.x = o.x;
  t.player.y = o.y + 30;
  e.update(1 / 30, t.game);
  assert.equal(o.state, 2);
  assert.ok(e.medic, 'a bordo');
  // la parada siguiente: cura todo
  t.player.hp = 10;
  e.begin(t.game);
  assert.equal(t.player.hp, t.player.stats.maxHp);
  // otra clínica: si los zombis lo rodean, muere
  const t2 = partida();
  const e2 = parada(t2, 'clinic');
  const m = e2.obj;
  m.state = 1;
  for (let i = 0; i < 4; i++) zombiJunto(t2, m.x + Math.cos(i * 1.6) * 12, m.y + Math.sin(i * 1.6) * 12);
  t2.horde.update(0.001, t2.game);
  for (let i = 0; i < 30 * 6 && m.state === 1; i++) {
    t2.player.x = m.x + 40;
    t2.player.y = m.y;
    e2.updateMedic(1 / 30, [t2.player], t2.game);
    for (const z of t2.horde.list) {
      z.x = m.x + 8;
      z.y = m.y;
    }
    t2.horde.grid.clear();
    for (const z of t2.horde.list) t2.horde.grid.insert?.(z);
    t2.horde.update(0.001, t2.game);
  }
  assert.equal(m.state, 3, 'murió');
  assert.equal(e2.medic, false);
});

test('comisaría: con H en la armería te llevas un arma mejor y munición', () => {
  const t = partida();
  const e = parada(t, 'police');
  const o = e.obj;
  assert.equal(o.kind, 'armory');
  const had = t.player.weapons.length;
  t.player.x = o.x;
  t.player.y = o.y + 20;
  assert.equal(e.prompt(t.game).k, 'armory');
  t.player.use = true;
  for (let i = 0; i < 30 * (ESCAPE_OBJ.armory.t + 0.3) && o.state === 0; i++) e.update(1 / 30, t.game);
  assert.equal(o.state, 2, 'abierta');
  assert.equal(t.player.weapons.length, had + 1, 'un arma nueva');
  assert.ok(ESCAPE_OBJ.armory.guns.includes(t.player.weapons[t.player.wi].id), 'y en la mano');
  assert.ok(
    t.game.pickups.list.some((p) => p.k === 'ammo'),
    'munición',
  );
  assert.equal(e.prompt(t.game), null, 'ya está abierta');
});

test('supermercado: las provisiones se juntan y se venden al salir', () => {
  const t = partida();
  const e = parada(t, 'market');
  const o = e.obj;
  assert.equal(o.kind, 'cart');
  assert.ok(o.items.length >= 3, `provisiones: ${o.items.length}`);
  for (const it of o.items.slice(0, 3)) {
    t.player.x = it.x;
    t.player.y = it.y;
    e.update(1 / 30, t.game);
  }
  assert.equal(o.n, 3);
  const money = t.game.money;
  e.phase = 'leaving';
  e.phaseT = ESCAPE.leaveT;
  e.update(1 / 30, t.game);
  assert.equal(t.game.money - money, ESCAPE_ROUTE.stopPay * e.stop + 3 * ESCAPE_OBJ.cart.pay * e.stop);
});

test('la foto lleva las mejoras, el médico y el objetivo de la parada', () => {
  const t = partida();
  const e = parada(t, 'market');
  e.buyUp('turret');
  e.buyUp('horn');
  e.medic = true;
  e.hornUsed = true;
  e.turretA = 1.25;
  e.obj.items[0].taken = true;
  e.obj.n = 1;
  const c = new e.constructor();
  unpackEscape(c, packEscape(e, -1), []);
  assert.deepEqual(
    VAN_UP_ORDER.map((k) => c.ups[k]),
    VAN_UP_ORDER.map((k) => e.ups[k] || 0),
  );
  assert.ok(c.medic && c.hornUsed);
  assert.equal(c.turretA, 1.25);
  assert.equal(c.obj.kind, 'cart');
  assert.equal(c.obj.items.length, e.obj.items.length);
  assert.ok(c.obj.items[0].taken);
  assert.equal(c.obj.n, 1);
  // la armería
  const t2 = partida();
  const e2 = parada(t2, 'police');
  const c2 = new e2.constructor();
  unpackEscape(c2, packEscape(e2, -1), []);
  assert.equal(c2.obj.kind, 'armory');
  assert.equal(c2.obj.x, Math.round(e2.obj.x));
  t2.player.x = e2.obj.x;
  t2.player.y = e2.obj.y;
  assert.equal(c2.prompt({ ...t2.game, escape: c2 }, t2.player).k, 'armory', 'el aviso de H también en el cliente');
});
