// Dibujo de los jefes (la lógica vive en sim/bosses.ts): los avisos en el suelo antes de cada ataque,
// las piedras en el aire y la piel endurecida. Su barra de vida está en ui/hud.js.
import { TAU } from '../core/util.ts';
import { bossFx, bossStatus, FX_LINE, FX_LOB, FX_RING } from '../sim/bosses.ts';

const EMPTY = { status: [], fx: [] };

// Lo que hay que mostrar: en línea llega con la foto (remote.js); si no, sale de la horda.
export function bossView(game) {
  if (game.mode.viaServer()) return game.bossNet || EMPTY;
  return { status: bossStatus(game.horde.list), fx: bossFx(game.horde) };
}

// Anillo de aviso: rojo que se llena desde el centro hasta el borde justo cuando llega el golpe.
function ring(ctx, x, y, r, k, time, col) {
  ctx.fillStyle = `rgba(${col},${0.1 + 0.08 * k})`;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = `rgba(${col},${0.18 + 0.2 * k})`;
  ctx.beginPath();
  ctx.arc(x, y, r * k, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = `rgba(${col},${0.55 + 0.35 * Math.abs(Math.sin(time * (8 + k * 10)))})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();
}

// En el suelo, debajo de los zombis: anillos (pisotón, dónde cae la piedra) y la franja de la embestida.
export function drawBossGround(ctx, game, time) {
  const { fx } = bossView(game);
  for (const f of fx) {
    const [k, x, y, r, a, t, dur] = f;
    const p = dur > 0 ? Math.min(1, t / dur) : 1;
    if (k === FX_RING) ring(ctx, x, y, r, p, time, '220,50,35');
    else if (k === FX_LOB) ring(ctx, x, y, r, p, time, '235,140,40');
    else if (k === FX_LINE) {
      // franja por donde va a pasar, con flechas que avanzan
      const w = 46;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.fillStyle = `rgba(220,50,35,${0.12 + 0.1 * p})`;
      ctx.fillRect(0, -w, r, w * 2);
      ctx.fillStyle = `rgba(220,50,35,${0.22 + 0.2 * p})`;
      ctx.fillRect(0, -w, r * p, w * 2);
      ctx.strokeStyle = `rgba(240,80,60,${0.6 + 0.3 * Math.abs(Math.sin(time * 12))})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(0, -w, r, w * 2);
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      for (let i = 0; i < 5; i++) {
        const cx = ((i / 5 + time * 0.8) % 1) * r;
        ctx.beginPath();
        ctx.moveTo(cx - 14, -18);
        ctx.lineTo(cx + 4, 0);
        ctx.lineTo(cx - 14, 18);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}

// Encima de todo: las piedras volando (con su sombra) y la piel endurecida del jefe.
export function drawBossAir(ctx, game, time) {
  const { fx, status } = bossView(game);
  for (const f of fx) {
    if (f[0] !== FX_LOB) continue;
    const [, x, y, , , t, dur, x0, y0] = f;
    const k = dur > 0 ? Math.min(1, t / dur) : 1;
    const gx = x0 + (x - x0) * k;
    const gy = y0 + (y - y0) * k;
    const h = 4 * 150 * k * (1 - k);
    // sombra en el suelo, que crece al bajar
    ctx.fillStyle = `rgba(0,0,0,${0.2 + 0.25 * k})`;
    ctx.beginPath();
    ctx.ellipse(gx, gy, 12 + 10 * k, 8 + 6 * k, 0, 0, TAU);
    ctx.fill();
    ctx.save();
    ctx.translate(gx, gy - h);
    ctx.rotate(time * 6 + x0);
    const s = 1 + h / 300;
    ctx.scale(s, s);
    ctx.fillStyle = '#6f6a60';
    ctx.strokeStyle = '#141612';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const aa = (i / 7) * TAU;
      const rr = 16 * (0.8 + 0.2 * Math.sin(i * 2.7 + x0));
      ctx.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#8f897c';
    ctx.beginPath();
    ctx.arc(-4, -4, 6, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  // piel endurecida: la piedra brilla fría y una coraza gira alrededor
  for (const b of status) {
    if (!b.hard) continue;
    for (const z of game.horde.list) {
      if (z.type !== b.type || z.dead) continue;
      ctx.save();
      ctx.translate(z.x, z.y);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(160,190,220,${0.35 + 0.2 * Math.sin(time * 5)})`;
      ctx.lineWidth = 4;
      for (let i = 0; i < 6; i++) {
        const a0 = time * 1.5 + (i / 6) * TAU;
        ctx.beginPath();
        ctx.arc(0, 0, z.r * 1.18, a0, a0 + 0.6);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(140,170,200,0.12)';
      ctx.beginPath();
      ctx.arc(0, 0, z.r * 1.1, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }
}
