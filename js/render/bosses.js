// Dibujo de los jefes (la lógica vive en sim/bosses.ts): los avisos en el suelo antes de cada ataque,
// las zonas que dejan (veneno, fuego, electricidad, viento, polvo), lo que lanzan y la piel endurecida.
// Su barra de vida está en ui/hud.js y su figura en bossart.js.
import { BOSS_ZONE_ORDER, BOSS_ZONES } from '../core/config.ts';
import { TAU } from '../core/util.ts';
import { bossFx, bossStatus, FX_CAST, FX_LINE, FX_LOB, FX_RING, FX_ZONE } from '../sim/bosses.ts';

const EMPTY = { status: [], fx: [] };

// Lo que hay que mostrar: en línea llega con la foto (remote.js); si no, sale de la horda.
export function bossView(game) {
  if (game.mode.viaServer()) return game.bossNet || EMPTY;
  return { status: bossStatus(game.horde.list), fx: bossFx(game.horde) };
}

// Anillo de aviso: se llena desde el centro hasta el borde justo cuando llega el golpe.
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

// Franja por donde va a pasar (embestida o golpe en línea), con flechas que avanzan.
function band(ctx, x, y, len, a, w, p, time) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.fillStyle = `rgba(220,50,35,${0.12 + 0.1 * p})`;
  ctx.fillRect(0, -w, len, w * 2);
  ctx.fillStyle = `rgba(220,50,35,${0.22 + 0.2 * p})`;
  ctx.fillRect(0, -w, len * p, w * 2);
  ctx.strokeStyle = `rgba(240,80,60,${0.6 + 0.3 * Math.abs(Math.sin(time * 12))})`;
  ctx.lineWidth = 3;
  ctx.strokeRect(0, -w, len, w * 2);
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  const h = Math.min(18, w * 0.7);
  for (let i = 0; i < 5; i++) {
    const cx = ((i / 5 + time * 0.8) % 1) * len;
    ctx.beginPath();
    ctx.moveTo(cx - h * 0.8, -h);
    ctx.lineTo(cx + h * 0.2, 0);
    ctx.lineTo(cx - h * 0.8, h);
    ctx.stroke();
  }
  ctx.restore();
}

// Una zona en el suelo: parpadea mientras se arma y luego queda encendida, con su textura.
function zone(ctx, f, time) {
  const [, x, y, r, kind, t, life, arm] = f;
  const id = BOSS_ZONE_ORDER[kind] || 'toxic';
  const col = BOSS_ZONES[id].col;
  if (id === 'dust') return;
  const fade = Math.min(1, (life - t) / 0.6, t / 0.3);
  const armed = t >= arm;
  const a = (armed ? 0.32 : 0.12 + 0.12 * Math.abs(Math.sin(time * 10))) * fade;
  const gr = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
  gr.addColorStop(0, `rgba(${col},${a * 1.4})`);
  gr.addColorStop(0.7, `rgba(${col},${a})`);
  gr.addColorStop(1, `rgba(${col},0)`);
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = `rgba(${col},${(armed ? 0.5 : 0.8) * fade})`;
  ctx.lineWidth = 2;
  ctx.setLineDash(armed ? [] : [8, 6]);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  if (!armed) return;
  // burbujas, chispas, llamas o remolino según la zona
  const n = Math.min(10, 3 + Math.round(r / 30));
  for (let i = 0; i < n; i++) {
    const s = i * 2.39 + x * 0.01;
    if (id === 'wind') {
      const ang = time * 4 + s;
      const d = r * (0.3 + 0.6 * ((i / n + time * 0.2) % 1));
      ctx.fillStyle = `rgba(${col},${0.6 * fade})`;
      ctx.fillRect(x + Math.cos(ang) * d - 3, y + Math.sin(ang) * d - 2, 6, 4);
      continue;
    }
    const ang = s * 3.1;
    const d = r * 0.75 * (((s * 0.37) % 1) + 0.05);
    const k = (time * (id === 'elec' ? 6 : 1.5) + s) % 1;
    const px = x + Math.cos(ang) * d;
    const py = y + Math.sin(ang) * d;
    if (id === 'elec') {
      ctx.strokeStyle = `rgba(200,230,255,${(1 - k) * fade})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + 8 * Math.cos(s), py + 8 * Math.sin(s));
      ctx.lineTo(px + 4, py + 12);
      ctx.stroke();
    } else {
      ctx.fillStyle =
        id === 'fire'
          ? `rgba(255,${180 - k * 120},60,${(1 - k) * 0.8 * fade})`
          : `rgba(${col},${(1 - k) * 0.7 * fade})`;
      ctx.beginPath();
      ctx.arc(px, py - k * (id === 'fire' ? 14 : 4), (id === 'fire' ? 5 : 3) * (1 - k * 0.5), 0, TAU);
      ctx.fill();
    }
  }
}

// En el suelo, debajo de los zombis: zonas, anillos (pisotón, dónde cae algo) y franjas.
export function drawBossGround(ctx, game, time) {
  const { fx } = bossView(game);
  for (const f of fx) if (f[0] === FX_ZONE) zone(ctx, f, time);
  for (const f of fx) {
    const [k, x, y, r, a, t, dur, w] = f;
    const p = dur > 0 ? Math.min(1, t / dur) : 1;
    if (k === FX_RING) ring(ctx, x, y, r, p, time, '220,50,35');
    else if (k === FX_LOB) ring(ctx, x, y, r, p, time, '235,140,40');
    else if (k === FX_LINE) band(ctx, x, y, r, a, w || 40, p, time);
    else if (k === FX_CAST) {
      // está llamando, gritando o preparando algo: un círculo morado que late
      ctx.strokeStyle = `rgba(190,110,255,${0.4 + 0.4 * Math.abs(Math.sin(time * 9))})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 8]);
      ctx.lineDashOffset = -time * 40;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = `rgba(190,110,255,${0.08 + 0.12 * p})`;
      ctx.beginPath();
      ctx.arc(x, y, r * p, 0, TAU);
      ctx.fill();
    }
  }
}

// Encima de todo: lo que vuela (con su sombra), el polvo que tapa la vista y la piel endurecida.
export function drawBossAir(ctx, game, time) {
  const { fx, status } = bossView(game);
  for (const f of fx) {
    if (f[0] === FX_ZONE && BOSS_ZONE_ORDER[f[4]] === 'dust') {
      // tormenta de polvo: una nube espesa que no deja ver qué hay dentro
      const [, x, y, r, , t, life] = f;
      const fade = Math.min(1, (life - t) / 1, t / 0.8);
      const gr = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
      gr.addColorStop(0, `rgba(120,96,64,${0.75 * fade})`);
      gr.addColorStop(0.75, `rgba(140,112,76,${0.55 * fade})`);
      gr.addColorStop(1, 'rgba(140,112,76,0)');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
      continue;
    }
    if (f[0] !== FX_LOB) continue;
    const [, x, y, , , t, dur, x0, y0] = f;
    const k = dur > 0 ? Math.min(1, t / dur) : 1;
    const gx = x0 + (x - x0) * k;
    const gy = y0 + (y - y0) * k;
    const h = 4 * 150 * k * (1 - k);
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
  // piel endurecida o caparazón: la coraza gira alrededor
  for (const b of status) {
    if (!b.hard) continue;
    for (const z of game.horde.list) {
      if (z.type !== b.type || z.dead || z.under) continue;
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
