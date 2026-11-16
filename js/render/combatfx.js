// Lo que se siente al pelear, encima de la escena: números de daño sobre los zombis, la marca de impacto en
// la mira y un arco rojo en la orilla de la pantalla hacia donde vino el golpe que te dieron. Todo sale de
// mirar cómo cambia la vida de un fotograma a otro, así sirve igual en solitario, en el cooperativo y en
// línea (donde el cliente no calcula el daño; allí no hay números porque la foto trae la vida en %).

/** Revisa los cambios de vida de este fotograma (se llama una vez por fotograma, al dibujar). */
export function trackCombat(game) {
  const p = game.player;
  if (!p) return;
  const fx = (game.combatFx ||= { hurt: [], mark: 0, kill: false, t: game.time, shots: 0, shotT: -9 });
  const dt = Math.max(0, Math.min(0.1, game.time - fx.t));
  fx.t = game.time;
  fx.mark = Math.max(0, fx.mark - dt);
  for (const h of fx.hurt) h.t -= dt;
  fx.hurt = fx.hurt.filter((h) => h.t > 0);
  // ¿disparó hace poco? (para que la marca de impacto sea sólo de sus tiros)
  if (p.shotsFired !== fx.shots) {
    fx.shots = p.shotsFired;
    fx.shotT = game.time;
  }
  const mine = game.time - fx.shotT < 0.25;
  const nums = game.settings?.numbers !== false && game.mode.authority();
  const v = game.view;
  for (const z of game.horde.list) {
    const was = z.hpWas;
    z.hpWas = z.hp;
    if (was === undefined || z.hp >= was) continue;
    if (z.x < v.x0 - 40 || z.x > v.x1 + 40 || z.y < v.y0 - 40 || z.y > v.y1 + 40) continue;
    const d = was - Math.max(0, z.hp);
    if (nums && d >= 1) game.floaters.add(z.x, z.y - z.r * 0.6, Math.round(d), 'dmg');
    if (mine) {
      fx.mark = 0.14;
      fx.kill = z.hp <= 0 || z.dead;
    }
  }
  // te pegaron: de dónde (el zombi más cercano, o el jefe)
  const hpWas = fx.hp;
  fx.hp = p.hp;
  if (p.alive && hpWas !== undefined && p.hp < hpWas - 0.5) {
    let best = null;
    let bd = 320;
    for (const z of game.horde.list) {
      if (z.dead) continue;
      const d = Math.hypot(z.x - p.x, z.y - p.y) - z.r;
      if (d < bd) {
        bd = d;
        best = z;
      }
    }
    if (best) {
      const a = Math.atan2(best.y - p.y, best.x - p.x);
      const old = fx.hurt.find((h) => Math.abs(Math.atan2(Math.sin(h.a - a), Math.cos(h.a - a))) < 0.5);
      if (old) old.t = 0.9;
      else if (fx.hurt.length < 6) fx.hurt.push({ a, t: 0.9 });
    }
  }
}

/** Arcos rojos de los golpes recibidos y la marca de impacto (en pantalla). */
export function drawCombatHud(game, ctx, W, H) {
  const fx = game.combatFx;
  const p = game.player;
  if (!fx || !p) return;
  const d = game.dpr;
  // arcos alrededor del centro (donde está el jugador), en la dirección del golpe
  if (fx.hurt.length && p.alive) {
    const b = game.base;
    const cx = p.x * b.z + b.tx;
    const cy = p.y * b.z + b.ty;
    const R = Math.min(W, H) * 0.3;
    ctx.save();
    ctx.lineCap = 'round';
    for (const h of fx.hurt) {
      const k = Math.min(1, h.t / 0.9);
      ctx.strokeStyle = `rgba(230,40,30,${(0.75 * k).toFixed(3)})`;
      ctx.lineWidth = 9 * d;
      ctx.beginPath();
      ctx.arc(cx, cy, R, h.a - 0.32, h.a + 0.32);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,160,140,${(0.6 * k).toFixed(3)})`;
      ctx.lineWidth = 3 * d;
      ctx.stroke();
    }
    ctx.restore();
  }
  // marca de impacto: una X en la mira (con el mouse); roja si fue la baja
  if (fx.mark > 0 && game.input.mode === 'mouse' && p.alive) {
    const m = game.input.mouse;
    const x = m.x * d;
    const y = m.y * d;
    const k = fx.mark / 0.14;
    const g0 = 6 * d;
    const g1 = (13 + (1 - k) * 4) * d;
    ctx.save();
    ctx.lineCap = 'round';
    /** @type {[string, number][]} */
    const pens = [
      ['rgba(0,0,0,0.6)', 4.5],
      [fx.kill ? '#ff4a3a' : '#ffffff', 2.2],
    ];
    for (const [col, lw] of pens) {
      ctx.strokeStyle = col;
      ctx.globalAlpha = k;
      ctx.lineWidth = lw * d;
      ctx.beginPath();
      for (const [sx, sy] of [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]) {
        ctx.moveTo(x + sx * g0, y + sy * g0);
        ctx.lineTo(x + sx * g1, y + sy * g1);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
}
