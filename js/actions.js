// Acciones del jugador local (teclas y botones): habilidad, robot, torreta pesada, construir y lanzar.
// En línea varias se piden al servidor (game.online.act) en vez de aplicarse aquí.
import { BUILD, BUILD_ORDER, SHOP } from './core/config.ts';
import { Abilities, abilityTarget } from './sim/abilities.ts';
import { LOCKED } from './sim/build.ts';
import { opsView } from './sim/ops.ts';

// X o el botón: misil donde apuntas, megarráfaga o impulso.
export function useAbility(game) {
  const p = game.player;
  if (!p.cls || !p.alive) return;
  if (p.abCd > 0) return game.toast(`Habilidad lista en ${Math.ceil(p.abCd)} s`);
  const t = abilityTarget(game, p);
  // en línea la usa el servidor; aquí se ve al instante (el misil llega con la siguiente foto)
  game.mode.sendAbility(p, t);
  Abilities.use(game, p, t.x, t.y, null);
  game.updateHud(false);
}

// Subirse o bajarse del robot (E o el botón ROBOT). Junto a una torreta pesada, la monta.
export function toggleRobot(game) {
  const p = game.player;
  // en línea la monta y la deja el servidor (que repite estas comprobaciones)
  if (game.mode.viaServer() && (p.manned || (!p.inRobot && game.structures.nearHeavy(p))))
    return game.online.act('robot');
  if (p.manned) return leaveHeavy(game);
  if (!p.inRobot) {
    const h = game.structures.nearHeavy(p);
    if (h) return mountHeavy(game, h);
  }
  const rb = game.robot;
  // junto a la torreta de otro jugador que no dio permiso (y sin el robot al lado)
  if (!p.inRobot && game.structures.nearHeavy(p, true) && !(rb.owned && !rb.broken && rb.near(p)))
    return game.toast(LOCKED);
  if (!rb.owned) {
    if (game.structures.blocks.some((b) => b.kind === 'heavy' || b.kind === 'military'))
      return game.toast('Acércate a la torreta para montarla');
    return game.toast('Compra el robot de combate en la tienda');
  }
  // en línea se sube o se baja en el servidor (que repite estas mismas comprobaciones)
  if (game.mode.viaServer()) {
    if (!rb.piloted && rb.broken) return game.toast('Robot destruido: repáralo en la tienda');
    if (!rb.piloted && !rb.near(p)) return game.toast('Acércate al robot para subirte');
    return game.online.act('robot');
  }
  if (rb.piloted) {
    rb.leave(p, game.world);
    game.sfx.build();
    return;
  }
  if (rb.broken) return game.toast('Robot destruido: repáralo en la tienda');
  if (!rb.near(p)) return game.toast('Acércate al robot para subirte');
  rb.board(p);
  game.sfx.punch();
  game.camera.shake(0.2);
}

export function mountHeavy(game, b) {
  const p = game.player;
  game.structures.mountHeavy(p, b);
  game.sfx.build();
  game.camera.shake(0.12);
  if (b.kind === 'heavy' && p.heavyAmmo <= 0) game.toast('Torreta sin balas: cómpralas en la tienda');
}

// En línea (L o el candado): dejar o no que los demás se suban a tu torreta (b, o la que tienes al
// lado); lo hace el servidor, que baja a quien la maneje si quitas el permiso.
export function shareTurret(game, b = null) {
  const p = game.player;
  if (!game.mode.viaServer() || !p.alive || p.inRobot) return;
  const t = b || game.structures.ownTurret(p);
  if (!t) return game.toast('Acércate a tu torreta para prestarla');
  game.online.act('share', { tx: t.x, ty: t.y });
  game.sfx.build();
}

export function leaveHeavy(game) {
  game.structures.leaveHeavy(game.player);
  game.sfx.build();
}

export function startNextRound(game) {
  // con una operación en marcha la oleada siguiente espera (se termina o se abandona antes)
  const ov = opsView(game);
  if (ov && ov.op) return game.toast('Primero termina la operación o retírate');
  if (game.mode.sendNextRound()) return;
  // empezar la oleada rechaza la oferta de la radio
  if (game.ops.offer) game.ops.offer = null;
  if (game.state !== 'play' || (!game.player.alive && !game.mode.inGroup())) return;
  game.sfx.unlock();
  if (game.director.nextRound(game)) game.updateHud(false);
}

/* ---------- modo construir ---------- */
// F, el botón de construir o tocar una pieza del inventario: aparece la barra de piezas y la pieza
// elegida se ve donde caería (verde si cabe). Con ratón sigue a la mira y se pone con clic; en el
// celular va delante (hacia donde caminas) o donde tocas o arrastras el dedo en el mapa, y se pone con
// ✓; después la siguiente se propone justo al lado, siguiendo la fila. R o ⟳ la giran.
// Mientras tanto no se dispara. Se sale con F, clic derecho, Esc o la ✕ de la barra.

const owned = (game) => BUILD_ORDER.filter((k) => game.inv[k] > 0);

export function toggleBuild(game, on = !game.building) {
  if (on && !owned(game).length) {
    game.toast('Compra barricadas en la tienda');
    on = false;
  }
  if (on && game.inv[game.buildSel] <= 0) game.buildSel = owned(game)[0];
  game.building = on;
  game.buildAt = null;
  game.buildDir = null;
  game.buildRot = false;
  game.input.blockFire = on;
  game.root.classList.toggle('building', on);
}

// Elegir una pieza (barra o inventario): también entra al modo construir.
export function pickBuild(game, k) {
  if (!(game.inv[k] > 0)) return;
  game.buildSel = k;
  if (!game.building) toggleBuild(game, true);
}

// Dónde se pondría la pieza ahora (en el mundo).
export function buildTarget(game) {
  if (game.input.mode === 'mouse') return mouseWorld(game);
  if (game.buildAt) return game.buildAt;
  const p = game.player;
  const a = p.legAngle ?? p.angle;
  return { x: p.x + Math.cos(a) * 70, y: p.y + Math.sin(a) * 70 };
}

// Las teclas, clics y toques del modo construir (va antes de que el jugador use la entrada).
export function stepBuild(game) {
  const inp = game.input;
  if (inp.consume('build')) toggleBuild(game);
  if (!game.building) {
    inp.consume('place');
    inp.consume('point');
    inp.consume('drop');
    inp.consume('cancel');
    inp.consume('wheel');
    inp.consume('rotate');
    if (inp.consume('cycleBuild')) cycleBuild(game);
    return;
  }
  // R gira la pieza (mientras construyes no recargas)
  if (inp.consume('rotate')) {
    inp.consume('reload');
    game.buildRot = !game.buildRot;
  }
  if (!game.player.alive || !owned(game).length || inp.consume('cancel')) return toggleBuild(game, false);
  const list = owned(game);
  const wheel = inp.consume('wheel');
  if (wheel || inp.consume('cycleBuild')) {
    const i = list.indexOf(game.buildSel);
    game.buildSel = list[(i + (wheel < 0 ? -1 : 1) + list.length) % list.length];
  }
  // con el modo abierto, los números eligen pieza en vez de arma
  const n = inp.consume('slot');
  if (n && list[n - 1]) game.buildSel = list[n - 1];
  const pt = inp.consume('point');
  if (pt) {
    // con ratón el clic la pone; en el celular tocar (o arrastrar) sólo la mueve ahí y ✓ la pone
    const at = screenToWorld(game, pt.x, pt.y);
    if (inp.mode === 'mouse') tryBuild(game, at);
    else {
      game.buildAt = at;
      game.buildDir = null;
    }
  }
  // en el celular, soltar una pieza arrastrada desde la barra la pone ahí
  const drop = inp.consume('drop');
  if (drop) {
    const at = screenToWorld(game, drop.x, drop.y);
    game.buildAt = at;
    game.buildDir = null;
    const pl = tryBuild(game, at);
    if (pl) nextSpot(game, pl);
  }
  if (inp.consume('place')) {
    const pl = tryBuild(game, buildTarget(game));
    if (pl && inp.mode !== 'mouse') nextSpot(game, pl);
  }
}

// En el celular, tras poner una pieza con ✓ la siguiente se propone a su lado, a lo largo de la
// fila (la de una pieza alargada, su lado largo; la de una cuadrada, atravesada a ti): primero hacia
// donde ya ibas y, al empezar, hacia el lado más cercano a ti. Si ya no alcanzas, vuelve delante.
function nextSpot(game, pl) {
  const p = game.player;
  const cx = pl.x + pl.w / 2;
  const cy = pl.y + pl.h / 2;
  const along = pl.w !== pl.h ? pl.w > pl.h : Math.abs(cx - p.x) <= Math.abs(cy - p.y);
  const step = along ? pl.w : pl.h;
  const spot = (s) => ({ x: cx + (along ? s * step : 0), y: cy + (along ? 0 : s * step) });
  const far = (s) => Math.hypot(spot(s).x - p.x, spot(s).y - p.y);
  const d = game.buildDir;
  const sides = d && d.along === along ? [d.s, -d.s] : far(1) <= far(-1) ? [1, -1] : [-1, 1];
  for (const s of sides) {
    if (far(s) > BUILD.reach) continue;
    game.buildAt = spot(s);
    game.buildDir = { along, s };
    return;
  }
  game.buildAt = null;
  game.buildDir = null;
}

// Pone la pieza elegida en at; devuelve dónde quedó (o null si no cabe).
export function tryBuild(game, at = buildTarget(game)) {
  if (game.inv[game.buildSel] <= 0) {
    const next = BUILD_ORDER.find((k) => game.inv[k] > 0);
    if (!next) {
      game.toast('Compra barricadas en la tienda');
      return null;
    }
    game.buildSel = next;
  }
  const k = game.buildSel;
  const rot = !!game.buildRot;
  const pl = game.structures.placement(game, k, at.x, at.y, rot);
  // en línea lo coloca el servidor (y descuenta la pieza); aquí sólo se avisa si no cabe
  if (!game.mode.canBuild()) {
    if (pl.ok) {
      game.mode.sendBuild(k, at.x, at.y, rot);
      return pl;
    }
    game.toast('No cabe ahí');
    return null;
  }
  if (game.structures.place(game, k, null, at.x, at.y, rot)) {
    game.inv[k]--;
    game.sfx.build();
    if (game.inv[k] <= 0) {
      const next = BUILD_ORDER.find((q) => game.inv[q] > 0);
      if (next) game.buildSel = next;
    }
    return pl;
  }
  game.toast('No cabe ahí');
  return null;
}

export function cycleBuild(game) {
  const list = owned(game);
  if (!list.length) return;
  const i = list.indexOf(game.buildSel);
  game.buildSel = list[(i + 1) % list.length];
  game.toast(SHOP[game.buildSel].name);
}

export function tryGrenade(game, kind = 'grenade') {
  if (game.inv[kind] <= 0) {
    game.toast(
      kind === 'molotov'
        ? 'Sin molotovs: cómpralos en la tienda'
        : kind === 'improv'
          ? 'Sin misiles improvisados: cómpralos en la tienda'
          : 'Sin granadas: cómpralas en la tienda',
    );
    return;
  }
  const p = game.player;
  let tx;
  let ty;
  if (game.input.mode === 'mouse') {
    const m = mouseWorld(game);
    tx = m.x;
    ty = m.y;
  } else if (p.target && !p.target.dead) {
    tx = p.target.x;
    ty = p.target.y;
  } else {
    tx = p.x + Math.cos(p.angle) * 220;
    ty = p.y + Math.sin(p.angle) * 220;
  }
  game.inv[kind]--;
  // en línea la lanza el servidor; la cuenta se corrige con su siguiente foto
  if (game.mode.sendThrow(kind, tx, ty)) return;
  if (kind === 'molotov') game.structures.throwMolotov(game, tx, ty);
  else if (kind === 'improv') game.structures.launchImprov(game, tx, ty);
  else game.structures.throwGrenade(game, tx, ty);
}

export function mouseWorld(game) {
  const m = game.input.mouse;
  return screenToWorld(game, m.x, m.y);
}

export function screenToWorld(game, x, y) {
  return { x: (x * game.dpr - game.base.tx) / game.base.z, y: (y * game.dpr - game.base.ty) / game.base.z };
}
