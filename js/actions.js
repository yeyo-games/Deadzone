// Acciones del jugador local (teclas y botones): habilidad, robot, torreta pesada, construir y lanzar.
// En línea varias se piden al servidor (game.online.act) en vez de aplicarse aquí.
import { BUILD_ORDER, SHOP } from './core/config.ts';
import { Abilities, abilityTarget } from './sim/abilities.ts';

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

export function leaveHeavy(game) {
  game.structures.leaveHeavy(game.player);
  game.sfx.build();
}

export function startNextRound(game) {
  if (game.mode.sendNextRound()) return;
  if (game.state !== 'play' || (!game.player.alive && !game.mode.inGroup())) return;
  game.sfx.unlock();
  if (game.director.nextRound(game)) game.updateHud(false);
}

/* ---------- modo construir ---------- */
// F, el botón de construir o tocar una pieza del inventario: aparece la barra de piezas y la pieza
// elegida se ve donde caería (verde si cabe). Con ratón sigue a la mira y se pone con clic; en el
// celular va donde tocas el mapa (o delante, hacia donde caminas) y se pone al tocar o con ✓.
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
    inp.consume('cancel');
    inp.consume('wheel');
    if (inp.consume('cycleBuild')) cycleBuild(game);
    return;
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
    // en el celular, si no cabe, la pieza se queda ahí en rojo; si cabe, ✓ vuelve a poner delante
    const at = screenToWorld(game, pt.x, pt.y);
    const ok = tryBuild(game, at);
    if (inp.mode !== 'mouse') game.buildAt = ok ? null : at;
  }
  if (inp.consume('place')) tryBuild(game, buildTarget(game));
}

export function tryBuild(game, at = buildTarget(game)) {
  if (game.inv[game.buildSel] <= 0) {
    const next = BUILD_ORDER.find((k) => game.inv[k] > 0);
    if (!next) {
      game.toast('Compra barricadas en la tienda');
      return false;
    }
    game.buildSel = next;
  }
  const k = game.buildSel;
  // en línea lo coloca el servidor (y descuenta la pieza); aquí sólo se avisa si no cabe
  if (!game.mode.canBuild()) {
    if (game.structures.placement(game, k, at.x, at.y).ok) {
      game.mode.sendBuild(k, at.x, at.y);
      return true;
    }
    game.toast('No cabe ahí');
    return false;
  }
  if (game.structures.place(game, k, null, at.x, at.y)) {
    game.inv[k]--;
    game.sfx.build();
    if (game.inv[k] <= 0) {
      const next = BUILD_ORDER.find((q) => game.inv[q] > 0);
      if (next) game.buildSel = next;
    }
    return true;
  }
  game.toast('No cabe ahí');
  return false;
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
