// Barricadas compradas en la tienda (madera, metal, vallas, alambre) y granadas.
import { SHOP, MOLOTOV, ROCKET, ABILITY, HEAVY, AIR, MILITARY, IMPROV, BUILD } from '../core/config.ts';
import { TAU, rand, clamp } from '../core/util.ts';
import type { Bullet, GameHost, Zombie } from '../core/types.d.ts';
import type { Player } from './player.ts';
import { milBlastR, milDmg, milRange, milReload, milSalvo, milTurn, repairHeavies, updateAutoHeavy } from './heavy.ts';

// Ficha de la tienda: sólo los campos que usa este módulo; w/h/hp existen en todas las piezas que se construyen.
interface ShopDef {
  w: number;
  h: number;
  hp: number;
  rotates?: boolean;
  ground?: boolean;
  turret?: boolean;
  armor?: number;
}
const shopDef = (kind: string): ShopDef => (SHOP as unknown as Record<string, ShopDef>)[kind];

// Pieza en pie (barricada, torreta...) registrada en el mundo como obstáculo dinámico.
export interface Block {
  k: number;
  x: number;
  y: number;
  w: number;
  h: number;
  low: boolean;
  block: boolean;
  kind: string;
  hp: number;
  max: number;
  hitT: number;
  cd: number;
  ang: number;
  owner: string | null;
  layer?: number;
  flash?: number;
  recoil?: number;
  side?: number;
  manned?: Player | null;
  // torreta pesada: niveles de sus mejoras (ver heavy.ts) y zombi al que apunta el piloto automático
  up?: number;
  aim?: Zombie | null;
  // torreta militar: cuánto falta para buscar otro blanco
  scanT?: number;
  // torreta pesada o militar en línea: su dueño dejó que los demás se suban
  shared?: boolean;
  // jefes: s que le quedan a un bloque temporal (encierro, barrera) y a una torreta apagada (pulso)
  tempT?: number;
  empT?: number;
}
// Alambre, púas y minas (en el suelo).
export interface Wire {
  kind: string;
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  max: number;
  hitT: number;
  owner: string | null;
}
export interface Grenade {
  sx: number;
  sy: number;
  ex: number;
  ey: number;
  x: number;
  y: number;
  h: number;
  t: number;
  dur: number;
  fuse: number;
  rot: number;
  owner: string | null;
  kind?: string;
}
export interface Missile {
  x: number;
  y: number;
  t: number;
  dur: number;
  owner: string | null;
}
export interface Stuck {
  z: Zombie;
  kind: string;
  x: number;
  y: number;
  owner: string | null;
  ox: number;
  oy: number;
  a: number;
  t: number;
  stick: number;
  glow: number;
  ang?: number;
  beeped?: boolean;
}
export interface Fire {
  id: number;
  x: number;
  y: number;
  r: number;
  t: number;
  life: number;
  tick: number;
  flames: { x: number; y: number; s: number; ph: number }[];
  owner: string | null;
}
export interface Scorch {
  x: number;
  y: number;
  t: number;
  life: number;
  a: number;
}
export interface Blast {
  x: number;
  y: number;
  t: number;
}
// Punto de impacto de una explosión (granada, misil, mina...).
interface BlastAt {
  x: number;
  y: number;
  owner?: string | null;
}

const SNAP = 20;
const TRAP_WIRE = { slow: 0.35, dps: 14 };
const TRAP_SPIKES = { slow: 0.5, dps: 45 };
const TURRET_RANGE = 340;
const BLAST_R = 140;
// Al morir, el gordo revienta en ácido verde.
export const ACID = { radius: 105, burn: 5, dps: 2 };
const near: Zombie[] = [];

// Bala de la torreta (la misma en el servidor y, de adorno, en los clientes en línea).
export function turretBullet(x: number, y: number, a: number, owner: string | null = null) {
  return {
    x,
    y,
    dx: Math.cos(a),
    dy: Math.sin(a),
    speed: 1100,
    life: TURRET_RANGE + 40,
    dmg: 34,
    pierce: 1,
    knock: 40,
    shot: null as unknown,
    hits: null as Zombie[] | null,
    owner,
    turret: true,
  };
}

// El misil improvisado en vuelo (ver IMPROV): estalla con Structures.improvBlast.
export function improvMissile(x: number, y: number, a: number, owner: string | null = null) {
  return {
    x,
    y,
    dx: Math.cos(a),
    dy: Math.sin(a),
    speed: IMPROV.speed,
    life: IMPROV.range,
    dmg: 0,
    pierce: 0,
    knock: 0,
    shot: null as unknown,
    hits: null as Zombie[] | null,
    owner,
    improv: true,
  };
}

// Misil antitanque de la torreta militar: vuela recto dist px (hasta donde estaba su blanco) y estalla
// en el primer zombi o pared que toca, o al llegar. fake: el de adorno de los clientes en línea, que no
// hace daño (la explosión de verdad llega del servidor). k y rk: daño y radio de la ojiva (mejoras).
export function militaryMissile(
  x: number,
  y: number,
  a: number,
  dist: number,
  owner: string | null = null,
  fake = false,
  k = 1,
  rk = 1,
) {
  return {
    x,
    y,
    sx: x,
    sy: y,
    dx: Math.cos(a),
    dy: Math.sin(a),
    speed: MILITARY.speed,
    life: Math.max(40, dist),
    dmg: 0,
    pierce: 0,
    knock: 0,
    shot: null as unknown,
    hits: null as Zombie[] | null,
    owner,
    atgm: true,
    fake,
    blastK: k,
    blastRK: rk,
  };
}

const isBig = (z: Zombie) => MILITARY.big.includes(z.type);
// Torretas a las que te subes con E.
export const MOUNTS = ['heavy', 'military'];
// Las de otro jugador, sólo si su dueño dio permiso (sin dueño, en solitario, todas).
export const mayMount = (p: Player, b: Block) => !b.owner || !!b.shared || b.owner === p.sid;
export const LOCKED = 'Esa torreta no es tuya: su dueño tiene que darte permiso';

// Distancia al jugador más cercano (en línea, el servidor tiene varios en game.targets).
// Cuánto puede quedar entre dos piezas para que la nueva se pegue a la otra.
const STICK = 28;

// Junto a una pieza que empieza en v0 y mide n: centrada con ella o con un extremo a ras del suyo,
// lo que quede más cerca de v (si nada queda a menos de STICK, en la rejilla).
function align(v: number, m: number, v0: number, n: number) {
  let best = Math.round(v / SNAP) * SNAP;
  let bd = STICK;
  for (const c of [v0 + (n - m) / 2, v0, v0 + n - m]) {
    if (Math.abs(c - v) < bd) {
      bd = Math.abs(c - v);
      best = c;
    }
  }
  return best;
}

// Pega la pieza que se va a poner (centrada en cx, cy) a la pieza vecina más cercana: encima de ella
// si apuntas sobre ella (para apilar), y si no, a su lado, tocándola y alineada con ella. Si la
// vecina es una pieza alargada y la nueva sigue su fila, se gira igual que ella. null si no hay
// vecina cerca. Las torretas sólo se arriman (nunca se apilan) y las minas no se pegan.
function snapPiece(
  def: ShopDef,
  kind: string,
  list: { kind: string; x: number; y: number; w: number; h: number; tempT?: number }[],
  cx: number,
  cy: number,
  w: number,
  h: number,
) {
  if (kind === 'mine') return null;
  let best = null;
  let bd = Number.POSITIVE_INFINITY;
  for (const b of list) {
    if (b.tempT !== undefined || b.kind === 'mine') continue;
    const bdef = shopDef(b.kind);
    if (bdef.turret) continue;
    // qué tan fuera de la vecina cae el centro (negativo: dentro)
    const ox = Math.max(b.x - cx, cx - (b.x + b.w));
    const oy = Math.max(b.y - cy, cy - (b.y + b.h));
    // las alargadas pueden girarse para alcanzarla: cuenta su lado largo
    const rx = (def.rotates ? Math.max(w, h) : w) / 2 + STICK;
    const ry = (def.rotates ? Math.max(w, h) : h) / 2 + STICK;
    if (ox > rx || oy > ry) continue;
    const inside = ox < 0 && oy < 0;
    // si el centro cae dentro de varias, la de más arriba de la pila
    const dd = inside ? -1 : Math.hypot(Math.max(ox, 0), Math.max(oy, 0));
    if (dd <= bd) {
      bd = dd;
      best = b;
    }
  }
  if (!best) return null;
  const b = best;
  const long = b.w > b.h ? 'x' : b.h > b.w ? 'y' : '';
  const ox = Math.max(b.x - cx, cx - (b.x + b.w));
  const oy = Math.max(b.y - cy, cy - (b.y + b.h));
  const bcx = b.x + b.w / 2;
  const bcy = b.y + b.h / 2;
  // encima: con la misma forma y en el mismo sitio (las alargadas se giran como la de abajo)
  if (ox < 0 && oy < 0 && !def.turret && !def.ground) {
    if (def.rotates && long && (w > h ? 'x' : 'y') !== long) [w, h] = [h, w];
    return { x: bcx - w / 2, y: bcy - h / 2, w, h };
  }
  const side = ox >= oy ? 'x' : 'y';
  // sigue la fila de una pieza alargada: se gira como ella
  if (def.rotates && long === side && (w > h ? 'x' : 'y') !== long) [w, h] = [h, w];
  if (side === 'x') {
    // a la izquierda o a la derecha, alineada con ella si casi lo está
    const y = align(cy - h / 2, h, b.y, b.h);
    if (y >= b.y + b.h || y + h <= b.y) return null;
    return { x: cx > bcx ? b.x + b.w : b.x - w, y, w, h };
  }
  const x = align(cx - w / 2, w, b.x, b.w);
  if (x >= b.x + b.w || x + w <= b.x) return null;
  return { x, y: cy > bcy ? b.y + b.h : b.y - h, w, h };
}

export class Structures {
  declare blocks: Block[];
  declare wires: Wire[];
  declare grenades: Grenade[];
  declare blasts: Blast[];
  declare scorches: Scorch[];
  declare pending: { kind: string; x: number; y: number; t: number }[];
  declare fires: Fire[];
  declare stuck: Stuck[];
  declare missiles: Missile[];
  declare fireId: number;
  declare time: number;
  constructor() {
    this.blocks = [];
    this.wires = [];
    this.grenades = [];
    this.blasts = [];
    this.scorches = [];
    this.pending = [];
    this.fires = [];
    this.stuck = [];
    this.missiles = [];
  }

  clear() {
    this.pending.length = 0;
    this.fires.length = 0;
    this.stuck.length = 0;
    this.missiles.length = 0;
    this.blocks.length = 0;
    this.wires.length = 0;
    this.grenades.length = 0;
    this.blasts.length = 0;
    this.scorches.length = 0;
  }

  /* ---------- construcción ---------- */

  // Dónde caería el bloque, alineado a una rejilla de 20 px: en (tx, ty) si se da (el punto que
  // apunta o toca el jugador, como mucho a BUILD.reach de él), si no delante de él. Si cae junto a
  // otra pieza se pega a ella (ver snapPiece): así las filas de muros quedan rectas y sin huecos.
  // turn: el jugador la giró a mano (las alargadas quedan al revés de lo que tocaría y no se giran solas).
  placement(game: GameHost, kind: string, tx?: number, ty?: number, turn = false) {
    const def = shopDef(kind);
    const p = game.player;
    if (!p) return { x: 0, y: 0, w: def.w, h: def.h, a: 0, ok: false };
    let ca = Math.cos(p.angle);
    let sa = Math.sin(p.angle);
    const at = Number.isFinite(tx) && Number.isFinite(ty);
    const d = at ? Math.hypot(tx! - p.x, ty! - p.y) : 0;
    if (d > 1) {
      ca = (tx! - p.x) / d;
      sa = (ty! - p.y) / d;
    }
    let w = def.w;
    let h = def.h;
    // las piezas alargadas se colocan atravesadas a la dirección en que se ponen
    if (def.rotates && (Math.abs(ca) > Math.abs(sa)) !== turn) {
      w = def.h;
      h = def.w;
    }
    // sin punto, delante; con punto, ahí mismo pero sin pisar al jugador (salvo lo que va en el suelo)
    const front = p.r + Math.max(w, h) / 2 + 14;
    const clear = def.ground ? 0 : p.r + (Math.abs(ca) * w + Math.abs(sa) * h) / 2 + 2;
    const dist = at ? clamp(d, clear, BUILD.reach) : front;
    const cx = p.x + ca * dist;
    const cy = p.y + sa * dist;
    const a = Math.atan2(sa, ca);
    const s = snapPiece(turn ? { ...def, rotates: false } : def, kind, def.ground ? this.wires : this.blocks, cx, cy, w, h);
    if (s && this.fits(game, def, s.x, s.y, s.w, s.h)) return { ...s, a, ok: true };
    const x = Math.round((cx - w / 2) / SNAP) * SNAP;
    const y = Math.round((cy - h / 2) / SNAP) * SNAP;
    return { x, y, w, h, a, ok: this.fits(game, def, x, y, w, h) };
  }

  // Si la pieza cabe ahí: dentro de la calle, sin pisar al jugador ni a un zombi. Las estructuras
  // se pueden encimar unas sobre otras (cada capa aguanta lo suyo); sólo la torreta necesita su sitio.
  fits(game: GameHost, def: ShopDef, x: number, y: number, w: number, h: number) {
    if (!game.world.rectFree(x, y, w, h, true)) return false;
    if (def.ground) return true;
    const p = game.player!;
    const px = clamp(p.x, x, x + w);
    const py = clamp(p.y, y, y + h);
    if ((px - p.x) ** 2 + (py - p.y) ** 2 < p.r * p.r) return false;
    game.horde.grid.query(x - 50, y - 50, x + w + 50, y + h + 50, near);
    for (const z of near) {
      const zx = clamp(z.x, x, x + w);
      const zy = clamp(z.y, y, y + h);
      if ((zx - z.x) ** 2 + (zy - z.y) ** 2 < z.r * z.r) return false;
    }
    for (const b of this.blocks) {
      if (x < b.x + b.w && x + w > b.x && y < b.y + b.h && y + h > b.y && (def.turret || shopDef(b.kind).turret))
        return false;
    }
    return true;
  }

  // owner: de quién son las bajas de sus minas y torretas (en línea); (tx, ty): dónde (ver placement)
  place(game: GameHost, kind: string, owner: string | null = null, tx?: number, ty?: number, turn = false) {
    const pl = this.placement(game, kind, tx, ty, turn);
    const p = game.player;
    if (!pl.ok || !p) return false;
    const def = shopDef(kind);
    if (def.ground) {
      this.wires.push({ kind, x: pl.x, y: pl.y, w: pl.w, h: pl.h, hp: def.hp, max: def.hp, hitT: 0, owner });
    } else {
      const o: Block = {
        k: 0,
        x: pl.x,
        y: pl.y,
        w: pl.w,
        h: pl.h,
        low: true,
        block: true,
        kind,
        hp: def.hp,
        max: def.hp,
        hitT: 0,
        cd: 0,
        ang: pl.a,
        owner,
      };
      this.blocks.push(o);
      game.world.addDynamic(o);
      this.relayer();
    }
    game.particles.dust(pl.x + pl.w / 2, pl.y + pl.h / 2, 20);
    return true;
  }

  // Altura visual de cada pieza: cuántas piezas anteriores tiene debajo (sólo para dibujarla).
  relayer() {
    const list = this.blocks;
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      let n = 0;
      for (let k = 0; k < i; k++) {
        const b = list[k];
        if (o.x < b.x + b.w && o.x + o.w > b.x && o.y < b.y + b.h && o.y + o.h > b.y)
          n = Math.max(n, (b.layer || 0) + 1);
      }
      o.layer = Math.min(n, 6);
    }
  }

  // La pieza de más arriba de la pila que incluye a o (los zombis rompen primero esa).
  topOf(o: Block) {
    for (let i = this.blocks.length - 1; i >= 0; i--) {
      const b = this.blocks[i];
      if (b === o) return o;
      if (!shopDef(b.kind).turret && o.x < b.x + b.w && o.x + o.w > b.x && o.y < b.y + b.h && o.y + o.h > b.y) return b;
    }
    return o;
  }

  damageBlock(game: GameHost, o: Block, dmg: number) {
    if (o.hp <= 0) return;
    o = this.topOf(o);
    o.hp -= dmg * (1 - (shopDef(o.kind).armor || 0));
    o.hitT = 0.12;
    game.particles.impact(
      o.x + o.w / 2 + rand(-o.w, o.w) * 0.3,
      o.y + o.h / 2 + rand(-o.h, o.h) * 0.3,
      rand(-1, 1),
      rand(-1, 1),
    );
    game.sfx.blockHit(o.kind);
    if (o.hp <= 0) {
      const i = this.blocks.indexOf(o);
      if (i >= 0) this.blocks.splice(i, 1);
      game.world.removeDynamic(o);
      this.relayer();
      game.particles.death(o.x + o.w / 2, o.y + o.h / 2, 18);
      game.sfx.blockBreak();
    }
  }

  // Destroza la pieza de una vez (el rocoso aplasta la madera o deshace el metal que no puede lanzar).
  crush(game: GameHost, o: Block) {
    this.damageBlock(game, o, Number.POSITIVE_INFINITY);
    game.particles.dust(o.x + o.w / 2, o.y + o.h / 2, 22);
  }

  // Mueve la pila de piezas de o (dx, dy) si cabe donde cae; el rocoso las avienta o las empuja.
  moveStack(game: GameHost, o: Block, dx: number, dy: number) {
    const stack = this.blocks.filter((b) => b.x < o.x + o.w && b.x + b.w > o.x && b.y < o.y + o.h && b.y + b.h > o.y);
    for (const b of stack) game.world.removeDynamic(b);
    const ok = game.world.rectFree(o.x + dx, o.y + dy, o.w, o.h);
    for (const b of stack) {
      if (ok) {
        b.x += dx;
        b.y += dy;
      }
      game.world.addDynamic(b);
    }
    return ok;
  }

  // Llamado por cada zombi: devuelve el efecto de la trampa que pisa (o null).
  trapAt(z: Zombie, dt: number, game: GameHost) {
    for (let i = 0; i < this.wires.length; i++) {
      const w = this.wires[i];
      if (z.x + z.r * 0.5 < w.x || z.x - z.r * 0.5 > w.x + w.w || z.y + z.r * 0.5 < w.y || z.y - z.r * 0.5 > w.y + w.h)
        continue;
      if (w.kind === 'mine') {
        this.wires.splice(i, 1);
        this.explode(game, { x: w.x + w.w / 2, y: w.y + w.h / 2, owner: w.owner }, 115, 280);
        return null;
      }
      const spikes = w.kind === 'spikes';
      w.hp -= dt * (spikes ? 1.5 : 2.5) * Math.sqrt(z.mass);
      w.hitT = 0.1;
      if (w.hp <= 0) this.wires.splice(i, 1);
      return spikes ? TRAP_SPIKES : TRAP_WIRE;
    }
    return null;
  }

  /* ---------- granadas ---------- */

  throwGrenade(game: GameHost, tx: number, ty: number, owner: string | null = null) {
    const p = game.player;
    if (!p) return;
    const dx = tx - p.x;
    const dy = ty - p.y;
    const d = Math.min(Math.hypot(dx, dy) || 1, 300);
    const a = Math.atan2(dy, dx);
    const ex = p.x + Math.cos(a) * d;
    const ey = p.y + Math.sin(a) * d;
    const dur = 0.25 + d / 650;
    this.grenades.push({ sx: p.x, sy: p.y, ex, ey, x: p.x, y: p.y, h: 0, t: 0, dur, fuse: dur + 0.55, rot: 0, owner });
  }

  /* ---------- misil improvisado ---------- */

  // Sale del hombro hacia donde apunta el jugador, con el chorro de humo hacia atrás.
  launchImprov(game: GameHost, tx: number, ty: number, owner: string | null = null) {
    const p = game.player;
    if (!p) return;
    const a = Math.atan2(ty - p.y, tx - p.x);
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    game.bullets.spawn(improvMissile(p.x + ca * 16, p.y + sa * 16, a, owner));
    game.particles.backblast(p.x - ca * 12, p.y - sa * 12, a + Math.PI);
    game.sfx.shot('bazooka');
    game.camera.shake(0.25, p.x, p.y);
  }

  improvBlast(game: GameHost, x: number, y: number, owner: string | null = null) {
    if (!game.mode.authority()) return;
    this.explode(game, { x, y, owner }, IMPROV.radius, IMPROV.power, 1);
  }

  /* ---------- misil balístico (habilidad del Bomber) ---------- */

  // Cae del cielo donde apunta el jugador (como mucho a ABILITY.bomber.range de él).
  launchMissile(game: GameHost, p: Player, tx: number, ty: number, owner: string | null = null) {
    const M = ABILITY.bomber;
    const dx = tx - p.x;
    const dy = ty - p.y;
    const d = Math.min(Math.hypot(dx, dy), M.range);
    const a = Math.atan2(dy, dx);
    this.missiles.push({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, t: 0, dur: M.fall, owner });
    game.sfx.missile();
  }

  updateMissiles(dt: number, game: GameHost) {
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const m = this.missiles[i];
      m.t += dt;
      if (m.t < m.dur) continue;
      this.missiles.splice(i, 1);
      this.missileBlast(game, m.x, m.y, m.owner);
    }
  }

  // El estallido del misil del Bomber (también el del misil antitanque de la torreta militar, que con
  // la ojiva mejorada multiplica el daño por k y el radio por rk).
  missileBlast(game: GameHost, x: number, y: number, owner: string | null = null, k = 1, rk = 1) {
    const M = ABILITY.bomber;
    this.explode(game, { x, y, owner }, M.radius * rk, M.power * k, 1.5);
    game.particles.ring(x, y, M.radius * rk * 0.3, '255,190,120');
    game.camera.shake(0.9, x, y);
  }

  // Los reventones de ácido se encolan: así una cadena de gordos no se pisa a sí misma.
  queueDeathBlast(kind: string, x: number, y: number) {
    this.pending.push({ kind, x, y, t: 0.06 });
  }

  /* ---------- cohetes clavados ---------- */

  // El cohete se queda clavado en la panza (gordo) o en la placa (super blindado) y estalla después.
  stickRocket(game: GameHost, z: Zombie, x: number, y: number, b: Bullet) {
    const fat = z.type === 'fat';
    // posición relativa al cuerpo, en el sistema del zombi, para que se mueva con él
    const c = Math.cos(-z.angle);
    const s = Math.sin(-z.angle);
    const lx = x - z.x;
    const ly = y - z.y;
    this.stuck.push({
      z,
      kind: z.type,
      x,
      y,
      owner: b.owner || null,
      ox: (lx * c - ly * s) * 0.7,
      oy: (lx * s + ly * c) * 0.7,
      a: Math.atan2(b.dy, b.dx) - z.angle,
      t: 0,
      stick: fat ? ROCKET.fatStick : ROCKET.heavyStick,
      glow: fat ? ROCKET.fatGlow : 0,
    });
    game.sfx.rocketStick(fat);
    game.particles.impact(x, y, -b.dx, -b.dy);
  }

  updateStuck(dt: number, game: GameHost) {
    for (let i = this.stuck.length - 1; i >= 0; i--) {
      const r = this.stuck[i];
      const z = r.z;
      r.t += dt;
      if (!z.dead) {
        const c = Math.cos(z.angle);
        const s = Math.sin(z.angle);
        r.x = z.x + r.ox * c - r.oy * s;
        r.y = z.y + r.ox * s + r.oy * c;
        r.ang = r.a + z.angle;
      }
      if (r.glow && r.t > r.stick && !r.beeped) {
        r.beeped = true;
        game.sfx.rocketArm();
      }
      // el gordo se hincha y tiembla a punto de reventar
      if (r.kind === 'fat' && !z.dead) z.swell = r.t > r.stick ? (r.t - r.stick) / r.glow : 0;
      if (r.t < r.stick + r.glow) continue;
      this.stuck.splice(i, 1);
      if (r.kind === 'fat') {
        // revienta brutalmente: carne y sangre por todos lados y todos salen volando
        const cx = z.x;
        const cy = z.y;
        z.lastOwner = r.owner;
        if (!z.dead) game.killZombie(z);
        game.particles.gore(cx, cy, ROCKET.fatRadius);
        for (let k = 0; k < 14; k++) {
          const a = rand(0, TAU);
          const d = rand(20, ROCKET.fatRadius * 0.8);
          game.decals.splat(cx + Math.cos(a) * d, cy + Math.sin(a) * d, rand(8, 18));
        }
        game.sfx.gore();
        this.explode(game, { x: cx, y: cy, owner: r.owner }, ROCKET.fatRadius, ROCKET.fatPower, 1.5);
        game.camera.shake(0.9, cx, cy);
      } else {
        // super blindado: lo revienta de un solo tiro
        if (!z.dead) {
          z.lastOwner = r.owner;
          z.lastDx = Math.cos(r.ang || 0) * 3;
          z.lastDy = Math.sin(r.ang || 0) * 3;
          game.killZombie(z);
        }
        this.explode(game, r, ROCKET.radius, ROCKET.power, 1);
      }
    }
  }

  /* ---------- molotov ---------- */

  throwMolotov(game: GameHost, tx: number, ty: number, owner: string | null = null) {
    this.throwGrenade(game, tx, ty, owner);
    const g = this.grenades[this.grenades.length - 1];
    g.kind = 'molotov';
    g.fuse = g.dur;
    game.sfx.throwBottle();
  }

  ignite(game: GameHost, x: number, y: number, owner: string | null = null) {
    const R = MOLOTOV.radius;
    const flames: Fire['flames'] = [];
    for (let i = 0; i < 16; i++) {
      const a = rand(0, TAU);
      const d = Math.sqrt(Math.random()) * R * 0.85;
      flames.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.85, s: rand(0.7, 1.25), ph: rand(0, 10) });
    }
    this.fireId = (this.fireId || 0) + 1;
    this.fires.push({ id: this.fireId, x, y, r: R, t: 0, life: MOLOTOV.life, tick: 0, flames, owner });
    if (this.fires.length > 8) this.fires.shift();
    game.particles.shatter(x, y);
    game.sfx.molotov();
    game.camera.shake(0.12, x, y);
  }

  updateFires(dt: number, game: GameHost) {
    for (let i = this.fires.length - 1; i >= 0; i--) {
      const f = this.fires[i];
      f.t += dt;
      if (f.t > f.life) {
        this.fires.splice(i, 1);
        this.scorches.push({ x: f.x, y: f.y, t: 0, life: 25, a: rand(0, TAU) });
        if (this.scorches.length > 20) this.scorches.shift();
        continue;
      }
      f.tick -= dt;
      if (f.tick > 0) continue;
      f.tick = 0.1;
      const R = f.r * Math.min(1, f.t * 4);
      game.horde.grid.query(f.x - R - 30, f.y - R - 30, f.x + R + 30, f.y + R + 30, near);
      for (const z of near) {
        if (z.dead) continue;
        const dx = z.x - f.x;
        const dy = z.y - f.y;
        if (dx * dx + dy * dy < (R + z.r * 0.5) ** 2) {
          z.burn = Math.max(z.burn, MOLOTOV.burn);
          z.lastOwner = f.owner || null;
        }
      }
      if (Math.random() < 0.5) game.sfx.crackle();
    }
  }

  acidBurst(game: GameHost, x: number, y: number) {
    const R = ACID.radius;
    game.particles.acidBurst(x, y, R);
    game.decals.acid(x, y, R * 0.75);
    for (let i = 0; i < 4; i++) game.decals.acid(x + rand(-R, R) * 0.6, y + rand(-R, R) * 0.6, rand(14, 26));
    game.sfx.acid();
    game.camera.shake(0.2, x, y);
    for (const p of game.targets || (game.player ? [game.player] : []))
      if (Math.hypot(p.x - x, p.y - y) < R + p.r) game.applyAcid(p);
  }

  // fling > 0: la onda lanza a volar a los que sobreviven (cohetes de bazuca)
  // small: microexplosión (balas de la torreta pesada): mismo daño en área, efectos pequeños
  explode(game: GameHost, g: BlastAt, R = BLAST_R, power = 330, fling = 0, small = false) {
    const { x, y } = g;
    game.horde.grid.query(x - R - 44, y - R - 44, x + R + 44, y + R + 44, near);
    for (const z of near) {
      if (z.dead) continue;
      const dx = z.x - x;
      const dy = z.y - y;
      const d = Math.hypot(dx, dy);
      if (d > R + z.r) continue;
      const f = clamp(1 - d / R, 0, 1);
      const n = d || 1;
      game.hitZombie(
        z,
        {
          dmg: power * (0.35 + 0.65 * f),
          dx: dx / n,
          dy: dy / n,
          knock: (120 + 260 * f) * (1 + fling),
          shot: null,
          blast: true,
          owner: g.owner,
        } as Partial<Bullet> as Bullet,
        z.x,
        z.y,
      );
      if (fling && !z.dead) {
        z.airV = Math.max(z.airV || 0, Math.min(AIR.vmax, ((160 + 320 * f) * fling) / Math.sqrt(z.mass)));
        z.air = z.air || 0.01;
        z.spinV = rand(-9, 9);
      }
      // los cuerpos salen despedidos lejos
      if (fling && z.dead) {
        z.lastDx = (dx / n) * (2 + 3 * f);
        z.lastDy = (dy / n) * (2 + 3 * f);
      }
    }
    if (small) {
      game.particles.miniBlast(x, y, R);
      game.sfx.miniBoom();
      return;
    }
    game.camera.shake(0.95, x, y);
    // cohete: bola de fuego corta y luego humo; granada: explosión clásica
    if (fling) game.particles.rocketImpact(x, y, R);
    else game.particles.explosion(x, y, R);
    game.sfx.explosion();
    this.blasts.push({ x, y, t: 0.4 });
    this.scorches.push({ x, y, t: 0, life: 25, a: rand(0, TAU) });
    if (this.scorches.length > 20) this.scorches.shift();
  }

  update(dt: number, game: GameHost) {
    this.time = (this.time || 0) + dt;
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.t += dt;
      const k = Math.min(1, g.t / g.dur);
      g.x = g.sx + (g.ex - g.sx) * k;
      g.y = g.sy + (g.ey - g.sy) * k;
      g.h = Math.sin(Math.PI * k) * (24 + g.dur * 30);
      if (k < 1) g.rot += dt * 14;
      if (g.t >= g.fuse) {
        this.grenades.splice(i, 1);
        if (g.kind === 'molotov') this.ignite(game, g.x, g.y, g.owner);
        else this.explode(game, g);
      }
    }
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const b = this.pending[i];
      b.t -= dt;
      if (b.t > 0) continue;
      this.pending.splice(i, 1);
      this.acidBurst(game, b.x, b.y);
    }
    this.updateFires(dt, game);
    this.updateMissiles(dt, game);
    this.updateStuck(dt, game);
    for (let i = this.blasts.length - 1; i >= 0; i--) {
      this.blasts[i].t -= dt;
      if (this.blasts[i].t <= 0) this.blasts.splice(i, 1);
    }
    for (const s of this.scorches) s.t += dt;
    while (this.scorches.length && this.scorches[0].t > this.scorches[0].life) this.scorches.shift();
    let gone: Block[] | null = null;
    for (const b of this.blocks) {
      b.hitT -= dt;
      if (b.tempT !== undefined && (b.tempT -= dt) <= 0) (gone ||= []).push(b);
      // el pulso electromagnético de un jefe la dejó apagada
      if (b.empT && b.empT > 0) {
        b.empT -= dt;
        continue;
      }
      if (b.kind === 'turret') this.updateTurret(b, dt, game);
      else if (b.kind === 'military' && !b.manned) this.updateMilitary(b, dt, game);
      else if (b.kind === 'heavy' && !b.manned) updateAutoHeavy(b, dt, game, game.ownerOf?.(b.owner) ?? null);
    }
    for (const w of this.wires) w.hitT -= dt;
    if (gone) for (const b of gone) this.crush(game, b);
  }

  // Bloques de metal temporales que pone un jefe (encierro, barrera) en esos centros: sólo donde caben
  // y sin aplastar a nadie; se deshacen a los life s.
  addTemp(game: GameHost, at: [number, number][], life: number) {
    const people = (game.targets as Player[]) || (game.player ? [game.player] : []);
    for (const [cx, cy] of at) {
      const x = Math.round((cx - 20) / 20) * 20;
      const y = Math.round((cy - 20) / 20) * 20;
      if (!game.world.rectFree(x, y, 40, 40)) continue;
      if (people.some((p) => p.x + p.r > x && p.x - p.r < x + 40 && p.y + p.r > y && p.y - p.r < y + 40)) continue;
      const hp = shopDef('metal').hp;
      const o: Block = {
        k: 0,
        x,
        y,
        w: 40,
        h: 40,
        low: true,
        block: true,
        kind: 'metal',
        hp,
        max: hp,
        hitT: 0,
        cd: 0,
        ang: 0,
        owner: null,
        tempT: life,
      };
      this.blocks.push(o);
      game.world.addDynamic(o);
      game.particles.dust(x + 20, y + 20, 10);
    }
    this.relayer();
  }

  // Torreta: apunta al zombi más cercano dentro de su alcance y dispara sola.
  updateTurret(b: Block, dt: number, game: GameHost) {
    b.cd -= dt;
    b.flash = Math.max(0, (b.flash || 0) - dt);
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    game.horde.grid.query(cx - TURRET_RANGE, cy - TURRET_RANGE, cx + TURRET_RANGE, cy + TURRET_RANGE, near);
    let best = null;
    let bd = TURRET_RANGE * TURRET_RANGE;
    for (const z of near) {
      if (z.dead) continue;
      const d = (z.x - cx) ** 2 + (z.y - cy) ** 2;
      if (d < bd) {
        bd = d;
        best = z;
      }
    }
    if (!best) return;
    const target = Math.atan2(best.y - cy, best.x - cx);
    let diff = target - b.ang;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    b.ang += Math.max(-dt * 9, Math.min(dt * 9, diff));
    if (b.cd > 0 || Math.abs(diff) > 0.25) return;
    b.cd = 0.16;
    b.flash = 0.05;
    const a = b.ang + rand(-0.04, 0.04);
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    game.bullets.spawn(turretBullet(cx + ca * 20, cy + sa * 20, a, b.owner));
    // en línea: el servidor avisa del disparo y cada cliente lanza su propia bala de adorno
    if (game.onTurretShot) game.onTurretShot(cx + ca * 20, cy + sa * 20, a);
    game.particles.muzzleSmoke(cx + ca * 22, cy + sa * 22, a);
    game.sfx.turret();
  }

  // Torreta militar: la torre gira despacio hacia su blanco (los zombis grandes antes que los demás)
  // y, ya apuntada, lanza un misil antitanque que deja humo negro al salir.
  updateMilitary(b: Block, dt: number, game: GameHost) {
    const M = MILITARY;
    const range = milRange(b);
    b.cd -= dt;
    b.flash = Math.max(0, (b.flash || 0) - dt);
    b.recoil = Math.max(0, (b.recoil || 0) - dt * 2.5);
    b.scanT = (b.scanT || 0) - dt;
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const ok = (z: Zombie | null | undefined) => {
      if (!z || z.dead || z.spawnT > 0) return false;
      const d = Math.hypot(z.x - cx, z.y - cy);
      return d < range && d > M.min;
    };
    if (!ok(b.aim)) b.aim = null;
    // busca otro blanco de vez en cuando: un grande a su alcance le gana a uno chico
    if (!b.aim || (b.scanT <= 0 && !isBig(b.aim))) {
      b.scanT = 0.3;
      game.horde.grid.query(cx - range, cy - range, cx + range, cy + range, near);
      let best = b.aim;
      let bd = best ? (isBig(best) ? 0 : 1) * 1e9 + Math.hypot(best.x - cx, best.y - cy) : Number.POSITIVE_INFINITY;
      for (const z of near) {
        if (!ok(z)) continue;
        const d = (isBig(z) ? 0 : 1) * 1e9 + Math.hypot(z.x - cx, z.y - cy);
        if (d < bd) {
          bd = d;
          best = z;
        }
      }
      b.aim = best;
    }
    const z = b.aim;
    if (!z) return;
    const want = Math.atan2(z.y - cy, z.x - cx);
    let diff = want - b.ang;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const turn = milTurn(b);
    b.ang += Math.max(-dt * turn, Math.min(dt * turn, diff));
    if (b.cd > 0 || Math.abs(diff) > 0.08) return;
    b.cd = milReload(b);
    this.fireMilitary(game, b, Math.hypot(z.x - cx, z.y - cy) - 46, b.owner);
  }

  // Lanza un misil antitanque por el cañón de la torreta militar, que llega dist px más allá de la boca
  // (lo usan la torreta sola y quien la maneja). Con la salva, también uno por cada tubo de los lados,
  // un poco abierto. La ojiva mejorada viaja en cada misil.
  fireMilitary(game: GameHost, b: Block, dist: number, owner: string | null = null) {
    b.flash = 0.12;
    b.recoil = 1;
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const k = milDmg(b);
    const rk = milBlastR(b);
    const n = milSalvo(b);
    // cañón, tubo izquierdo, tubo derecho: [adelante, al lado, giro]
    const tubes = [
      [46, 0, 0],
      [22, -19, -0.09],
      [22, 19, 0.09],
    ].slice(0, n);
    for (const [fw, sd, da] of tubes) {
      const a = b.ang + da;
      const mx = cx + Math.cos(b.ang) * fw - Math.sin(b.ang) * sd;
      const my = cy + Math.sin(b.ang) * fw + Math.cos(b.ang) * sd;
      game.bullets.spawn(militaryMissile(mx, my, a, dist, owner, false, k, rk));
      // en línea: el servidor avisa y cada cliente lanza su propio misil de adorno
      if (game.onMilitaryShot) game.onMilitaryShot(mx, my, a, dist);
      game.particles.militaryFire(mx, my, a);
    }
    game.camera.shake(0.3 + (n - 1) * 0.15, cx, cy);
    game.sfx.atgm();
  }

  /* ---------- dibujo ---------- */

  // La torreta libre que se puede montar (pesada o militar) más cercana al alcance de p (o null).
  // any: también las de otro jugador que no dio permiso.
  nearHeavy(p: Player, any = false) {
    let best = null;
    let bd = Number.POSITIVE_INFINITY;
    for (const b of this.blocks) {
      if (!MOUNTS.includes(b.kind) || b.manned || (!any && !mayMount(p, b))) continue;
      // la militar es más grande: se alcanza desde más lejos de su centro
      const d = Math.hypot(b.x + b.w / 2 - p.x, b.y + b.h / 2 - p.y) - (b.w - 40) / 2;
      if (d < bd && d < HEAVY.reach + p.r) {
        bd = d;
        best = b;
      }
    }
    return best;
  }

  // Montar o dejar la torreta pesada (en solitario, en el anfitrión y en el servidor).
  mountHeavy(p: Player, b: Block) {
    p.manned = b;
    b.manned = p;
    p.reloadT = 0;
    p.target = null;
  }

  // Al acabar la oleada: las torretas pesadas blindadas se reparan una parte.
  waveRepair() {
    repairHeavies(this.blocks);
  }

  // La torreta (pesada o militar) que p puede mejorar: la que maneja o la más cercana a su alcance
  // (aunque la maneje otro).
  heavyFor(p: Player) {
    if (p.manned) return p.manned;
    let best = null;
    let bd = HEAVY.reach + p.r;
    for (const b of this.blocks) {
      if (!MOUNTS.includes(b.kind)) continue;
      const d = Math.hypot(b.x + b.w / 2 - p.x, b.y + b.h / 2 - p.y) - (b.w - 40) / 2;
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    return best;
  }

  // La torreta (pesada o militar) de p, con dueño (o sea en línea), que maneja o tiene al alcance (o null).
  ownTurret(p: Player) {
    if (p.manned) return p.manned.owner && p.manned.owner === p.sid ? p.manned : null;
    let best = null;
    let bd = Number.POSITIVE_INFINITY;
    for (const b of this.blocks) {
      if (!MOUNTS.includes(b.kind) || !b.owner || b.owner !== p.sid) continue;
      const d = Math.hypot(b.x + b.w / 2 - p.x, b.y + b.h / 2 - p.y) - (b.w - 40) / 2;
      if (d < bd && d < HEAVY.reach + p.r) {
        bd = d;
        best = b;
      }
    }
    return best;
  }

  // En línea, el dueño de una torreta deja (o deja de dejar) que los demás se suban; al quitar el
  // permiso, quien la maneje se baja. Devuelve a quien bajó (o null).
  toggleShare(b: Block) {
    b.shared = !b.shared;
    const q = b.manned;
    if (b.shared || !q || mayMount(q, b)) return null;
    this.leaveHeavy(q);
    return q;
  }

  leaveHeavy(p: Player) {
    const b = p.manned;
    if (b && b.manned === p) b.manned = null;
    p.manned = null;
    // de la torreta militar te bajas por detrás de la torre (estabas encima)
    if (b && b.kind === 'military') {
      const d = b.w / 2 + p.r + 6;
      p.x = b.x + b.w / 2 - Math.cos(b.ang) * d;
      p.y = b.y + b.h / 2 - Math.sin(b.ang) * d;
    }
  }
}
