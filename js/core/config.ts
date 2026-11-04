// Constantes de equilibrio del juego. Todo lo ajustable vive aquí.

export const WORLD_SIZE = 3800;
export const CHUNK = 512;
export const ROAD_CENTERS = [300, 1100, 1900, 2700, 3500];
export const ROAD_HALF = 110;
export const SIDEWALK = 44;
export const NAV_CELL = 40;
// tope de zombis vivos a la vez en cualquier modo (lo que no cabe espera en la cola de la oleada)
export const MAX_ALIVE = 1000;

export const PLAYER_BASE = {
  radius: 14,
  maxHp: 100,
  // velocidad al caminar en múltiplos de lo que camina un zombi normal en la primera oleada
  // (ZOMBIE_SPEED × WAVES.speed): 1,25 → unos 166 px/s. Corriendo, por runMult.
  walk: 1.25,
  runMult: 1.75,
  maxStamina: 100,
  staminaDrain: 30,
  staminaRegen: 20,
  regenDelay: 0.7,
  mass: 4,
};

// Temblor de cámara. shake: px máximos con el temblor al tope (la mitad del original, 16).
// Un temblor con lugar (explosión, cornada…) es completo hasta near px de la cámara y se apaga en far.
// stack: cuánto suma un temblor sobre otro (la fuente más fuerte manda; no se acumulan hasta el tope).
export const CAMERA = { shake: 8, near: 200, far: 1000, stack: 0.25 };

// Arma con la que se empieza: balas infinitas, no se vende ni está en la tienda.
export const START_WEAPON = 'smg';

// rate = disparos por segundo, range = distancia máxima en px del mundo.
// La pistola ya no se usa (el arma inicial es START_WEAPON); se deja por partidas guardadas viejas.
export const WEAPONS = {
  pistol: {
    id: 'pistol',
    name: 'Pistola',
    damage: 24,
    rate: 3.4,
    mag: 12,
    reserve: Infinity,
    reserveMax: Infinity,
    pickup: 0,
    reload: 1.05,
    spread: 0.035,
    bloom: 0.05,
    pellets: 1,
    speed: 950,
    range: 560,
    knock: 60,
    shake: 0.12,
    pierce: 0,
    len: 11,
  },
  smg: {
    id: 'smg',
    name: 'Subfusil',
    damage: 14,
    rate: 11,
    mag: 32,
    reserve: Infinity,
    reserveMax: Infinity,
    pickup: 0,
    reload: 1.5,
    spread: 0.09,
    bloom: 0.022,
    pellets: 1,
    speed: 1000,
    range: 520,
    knock: 30,
    shake: 0.03,
    pierce: 0,
    len: 15,
    desc: 'Ráfagas rápidas para contener a la horda.',
  },
  // Armas de la tienda: el precio sube con su poder (daño por segundo contando recargas, a cuántos
  // atraviesa y el área), en una escalera que acompaña el dinero de las oleadas: la escopeta tras la
  // primera, la bazuca hacia la sexta. La munición sigue costando por cargador lo que cada una pedía
  // por cada 1000 de daño.
  shotgun: {
    id: 'shotgun',
    name: 'Escopeta',
    damage: 30,
    rate: 1.8,
    mag: 6,
    reserve: 24,
    reserveMax: Infinity,
    pickup: 12,
    reload: 1.8,
    spread: 0.3,
    bloom: 0.1,
    pellets: 8,
    speed: 820,
    range: 340,
    knock: 140,
    shake: 0.3,
    pierce: 0,
    len: 20,
    price: 500,
    ammoPrice: 12,
    desc: '8 perdigones de golpe: derriba grupos y los empuja lejos.',
  },
  // Lanzallamas: cada disparo es una llamarada corta (flameBullet en sim/bullets.ts) que atraviesa a
  // todos los zombis que toca (el gigante la ataja), no los empuja y los deja ardiendo burn s
  // (MOLOTOV.dps por segundo). El cargador es el depósito de combustible.
  flamer: {
    id: 'flamer',
    name: 'Lanzallamas',
    damage: 9,
    rate: 18,
    mag: 100,
    reserve: 200,
    reserveMax: Infinity,
    pickup: 100,
    reload: 2.4,
    spread: 0.16,
    bloom: 0.004,
    pellets: 1,
    speed: 560,
    range: 250,
    knock: 0,
    shake: 0.012,
    pierce: 0,
    len: 26,
    flame: true,
    burn: 3,
    price: 1200,
    ammoPrice: 18,
    desc: 'Escupe fuego de cerca: quema a todos los que toca y los deja ardiendo.',
  },
  ar: {
    id: 'ar',
    name: 'Fusil de asalto',
    damage: 30,
    rate: 9,
    mag: 30,
    reserve: 90,
    reserveMax: Infinity,
    pickup: 30,
    reload: 1.6,
    spread: 0.05,
    bloom: 0.015,
    pellets: 1,
    speed: 1250,
    range: 700,
    knock: 50,
    shake: 0.04,
    pierce: 1,
    len: 20,
    price: 800,
    ammoPrice: 12,
    desc: 'Automático, preciso y perforante. El todoterreno.',
  },
  autoshotgun: {
    id: 'autoshotgun',
    name: 'Escopeta automática',
    damage: 22,
    rate: 3.2,
    mag: 12,
    reserve: 36,
    reserveMax: Infinity,
    pickup: 12,
    reload: 2.2,
    spread: 0.32,
    bloom: 0.06,
    pellets: 9,
    speed: 850,
    range: 340,
    knock: 110,
    shake: 0.28,
    pierce: 0,
    len: 22,
    price: 2000,
    ammoPrice: 19,
    desc: '9 perdigones fuertes en ráfaga continua. Barre hordas de cerca.',
  },
  sniper: {
    id: 'sniper',
    name: 'Francotirador',
    damage: 300,
    rate: 0.9,
    mag: 5,
    reserve: 20,
    reserveMax: Infinity,
    pickup: 5,
    reload: 2.4,
    spread: 0.003,
    bloom: 0.08,
    pellets: 1,
    speed: 2000,
    range: 1400,
    knock: 220,
    shake: 0.35,
    pierce: 6,
    len: 30,
    price: 4500,
    ammoPrice: 30,
    desc: 'Lento pero brutal: 300 de daño por bala y atraviesa hasta 6 zombis en fila.',
  },
  lmg: {
    id: 'lmg',
    name: 'Ametralladora',
    damage: 30,
    rate: 12,
    mag: 100,
    reserve: 200,
    reserveMax: Infinity,
    pickup: 100,
    reload: 3.2,
    spread: 0.08,
    bloom: 0.012,
    pellets: 1,
    speed: 1200,
    range: 650,
    knock: 45,
    shake: 0.015,
    pierce: 2,
    len: 26,
    price: 3000,
    ammoPrice: 41,
    desc: 'Cargador de 100 balas que atraviesan 2 zombis: fuego sin pausa, recarga lenta.',
  },
  // Lanza cohetes (ver ROCKET): explota al impactar; tarda 4 s en recargar.
  bazooka: {
    id: 'bazooka',
    name: 'Bazuca antitanque',
    damage: 0,
    rate: 1,
    mag: 1,
    reserve: 4,
    reserveMax: Infinity,
    pickup: 1,
    reload: 4,
    spread: 0.01,
    bloom: 0,
    pellets: 1,
    speed: 640,
    range: 950,
    knock: 260,
    shake: 0.5,
    pierce: 0,
    len: 30,
    rocket: true,
    price: 6000,
    ammoPrice: 30,
    desc: 'Cohete con el doble de explosión que una granada. Revienta gordos y blindados. Recarga en 4 s.',
  },
  // Cañón doble de la torreta pesada (SHOP.heavy): no se compra ni se lleva, se usa montado.
  // Sus balas salen de HEAVY.ammo (se compran en la tienda) y son explosivas (blast): estallan en
  // el primer zombi o pared que tocan con una microexplosión (HEAVY.blastR, HEAVY.blastPower).
  heavy: {
    id: 'heavy',
    name: 'Torreta pesada',
    damage: 60,
    rate: 9,
    mag: 0,
    reserve: 0,
    reserveMax: 0,
    pickup: 0,
    reload: 0,
    spread: 0.035,
    bloom: 0.01,
    pellets: 1,
    speed: 1600,
    range: 1000,
    knock: 90,
    shake: 0.06,
    pierce: 0,
    blast: true,
    len: 30,
  },
};
export const WEAPON_ORDER = ['pistol', 'smg', 'shotgun', 'flamer', 'ar', 'autoshotgun', 'sniper', 'lmg', 'bazooka'];

// Cohete de la bazuca. La granada tiene radio 140 y 330 de daño: el cohete abarca el doble de área.
// Contra un gordo se queda clavado en su panza (stick s), brilla en verde (glow s) y estalla más fuerte;
// contra un super blindado se incrusta en la placa de la panza y lo revienta de un solo tiro.
export const ROCKET = {
  radius: 200,
  power: 660,
  fatStick: 1,
  fatGlow: 0.6,
  fatRadius: 250,
  fatPower: 950,
  heavyStick: 0.35,
};
// Habilidad de clase (se elige al empezar cada partida). cooldown en s; cada mejora la baja
// cdStep (x0,85) hasta minCooldown.
// bomber: misil balístico que cae donde apuntas tras fall s (1,5 veces el radio y el daño
// del cohete); berserker: 3 ametralladoras vacían 3 cargadores en time s, con su propio
// daño y perforación (no cambia si se ajusta la ametralladora de la tienda);
// booster: inmune y speed veces más rápido durante time s.
export const ABILITY = {
  cooldown: 60,
  minCooldown: 20,
  cdStep: 0.85,
  bomber: { radius: ROCKET.radius * 1.5, power: ROCKET.power * 1.5, fall: 1.4, range: 700 },
  berserker: { time: 3, mags: 3, guns: 3, weapon: 'lmg', damage: 22, pierce: 1 },
  booster: { time: 2, speed: 3 },
};
export const CLASS_ORDER = ['bomber', 'berserker', 'booster'];
// cajas de armas (las básicas); las mejores se compran
export const CRATE_WEAPONS = ['shotgun', 'flamer'];

// Unidad de velocidad: la del zombi normal en px/s (al azar entre los dos; 1,5 veces la de antes,
// [60, 88]). En ZOMBIES, speed es un múltiplo de esta unidad y nunca menos de 1 (ningún tipo es
// más lento que un normal), salvo el rocoso, que es lento a propósito. La animación de pasos
// avanza con la distancia, así que no patinan.
export const ZOMBIE_SPEED = [90, 132];

export const ZOMBIES = {
  normal: {
    hp: 42,
    speed: 1,
    radius: 13,
    damage: 8,
    attackRate: 0.9,
    xp: 2,
    mass: 1,
    reach: 7,
    frames: 6,
    turn: 4,
  },
  // Policía SWAT: como un normal (misma velocidad), con escudo antidisturbios; aguanta 8 veces más.
  swat: {
    hp: 42 * 8,
    speed: 1,
    radius: 14,
    damage: 10,
    attackRate: 0.9,
    xp: 20,
    mass: 2.5,
    reach: 8,
    frames: 6,
    turn: 3.5,
  },
  sprinter: {
    hp: 26,
    speed: 1.3,
    radius: 11,
    damage: 6,
    attackRate: 1.3,
    xp: 4,
    mass: 0.8,
    reach: 6,
    frames: 6,
    turn: 7,
  },
  // Super blindado: un gordo con armadura militar completa. Desde la oleada 11; 50 veces la vida de un normal.
  // Da super golpes: 30 de daño, te avienta y destroza estructuras (blockDmg por golpe).
  heavy: {
    hp: 42 * 50,
    speed: 1,
    radius: 22,
    damage: 30,
    attackRate: 0.7,
    xp: 50,
    mass: 6,
    reach: 9,
    frames: 6,
    turn: 2.5,
    blockDmg: 260,
    punch: 1000,
  },
  // Toro: zombi musculoso que embiste al verte (ver BULL).
  bull: {
    hp: 42 * 7,
    speed: 1,
    radius: 17,
    damage: 14,
    attackRate: 0.8,
    xp: 16,
    mass: 5,
    reach: 8,
    frames: 6,
    turn: 3.5,
  },
  fat: {
    hp: 130,
    speed: 1,
    radius: 21,
    damage: 14,
    attackRate: 0.75,
    xp: 8,
    mass: 4,
    reach: 8,
    frames: 6,
    turn: 3,
  },
  // Rocoso: cuerpo de roca más ancho que un gordo, lento y pesado (aparta a la horda al pasar).
  // El doble de la vida del super blindado. Camina recto y destroza lo que le estorba (ver ROCK).
  rock: {
    hp: 42 * 100,
    speed: 0.6,
    radius: 34,
    damage: 18,
    attackRate: 0.6,
    xp: 40,
    mass: 14,
    reach: 9,
    frames: 6,
    turn: 2,
  },
  // Zombi dorado: poco común, huye de ti y desaparece si no lo matas a tiempo.
  golden: {
    hp: 42 * 3,
    speed: 1.1,
    radius: 13,
    damage: 6,
    attackRate: 0.9,
    xp: 15,
    mass: 1,
    reach: 7,
    frames: 6,
    turn: 6,
  },
  giant: {
    hp: 1500,
    speed: 1,
    radius: 42,
    damage: 32,
    attackRate: 0.45,
    xp: 30,
    mass: 40,
    reach: 14,
    frames: 8,
    turn: 1.4,
    blocksBullets: true,
  },
  // Jefes (BOSSES): bossZ arma su ficha (sim/bosses.ts lleva su cabeza; su barra va arriba de la pantalla).
  ...bossZombies(),
};

// Ficha de zombi de cada jefe: vida (en solitario), radio, velocidad, daño y ritmo de su golpe cuerpo a cuerpo.
function bossZ(hp: number, radius: number, speed: number, damage: number, attackRate: number) {
  return {
    hp,
    speed,
    radius,
    damage,
    attackRate,
    xp: Math.round(300 + hp / 100),
    mass: Math.round(radius * 1.6),
    reach: 16,
    frames: 6,
    turn: 1.6,
    blocksBullets: true,
    blockDmg: damage * 10,
    boss: true,
  };
}
function bossZombies() {
  return {
    supremo: bossZ(15000, 50, 0.7, 26, 0.6),
    aplastador: bossZ(25000, 46, 0.85, 34, 0.7),
    campanero: bossZ(38000, 40, 0.8, 24, 0.8),
    contaminado: bossZ(55000, 54, 0.65, 30, 0.6),
    carcelero: bossZ(78000, 52, 0.7, 36, 0.6),
    cazadora: bossZ(105000, 36, 1.35, 30, 1.1),
    excavador: bossZ(145000, 56, 0.7, 40, 0.55),
    generador: bossZ(190000, 56, 0.7, 36, 0.6),
    reina: bossZ(250000, 66, 0.45, 40, 0.5),
    devorador: bossZ(330000, 74, 0.5, 50, 0.5),
    incendiario: bossZ(430000, 58, 0.7, 40, 0.6),
    arquitecto: bossZ(560000, 64, 0.6, 48, 0.5),
    tormenta: bossZ(720000, 62, 0.75, 40, 0.6),
    titan: bossZ(900000, 84, 0.55, 60, 0.45),
    rey: bossZ(1200000, 78, 0.7, 60, 0.6),
  };
}

// Jefes (sim/bosses.ts): cada BOSS.every oleadas llega uno, en el orden de BOSS_ORDER (el primero en
// la oleada 5, el segundo en la 10… el último en la 75; después vuelven a empezar). Su vida es la de
// ZOMBIES (en solitario); en grupo se multiplica por 1 + perPlayer por cada jugador extra, y cuando la
// lista vuelve a empezar, por loop cada vuelta. La horda que lo acompaña es support de la normal y la
// oleada del jefe nunca es ronda especial. Fases según la vida que le queda: normal, enfurecido (≤ rage)
// y desesperado (≤ despair); en cada una espera cd[fase] veces menos entre ataque y ataque.
// hp: multiplicador de la vida de todos los jefes (sobre la de ZOMBIES; también su curación) · dmg:
// multiplicador de todo el daño que hacen al jugador (cuerpo a cuerpo, ataques y zonas; no a las barricadas).
// Peleas cortas y peligrosas: poca vida, mucho daño.
export const BOSS = {
  every: 5,
  perPlayer: 0.6,
  support: 0.5,
  rage: 0.6,
  despair: 0.3,
  cd: [1, 0.8, 0.6],
  loop: 1.5,
  hp: 0.3,
  dmg: 2,
};
export const BOSS_ORDER = [
  'supremo',
  'aplastador',
  'campanero',
  'contaminado',
  'carcelero',
  'cazadora',
  'excavador',
  'generador',
  'reina',
  'devorador',
  'incendiario',
  'arquitecto',
  'tormenta',
  'titan',
  'rey',
];

/**
 * Un ataque de jefe. Todos avisan antes (windup s; un anillo o una franja en el suelo) y se eligen al
 * azar (w: peso) entre los que tocan por distancia al jugador (min–max px), fase (phase) y espera propia
 * (cd s). Qué hace cada tipo (k), con sus números:
 *   charge  embestida: speed px/s durante time s; al jugador hit y throw; a las barricadas block (la
 *           madera la aplasta si crush); contra un edificio queda aturdido stun s (y recibe vuln de daño);
 *           dashes: varias embestidas cortas seguidas, cada una desviada hasta spread rad
 *   ring    golpe en un círculo de radio r en at ('self' a su alrededor, 'target' donde estás, 'front'
 *           delante de él, 'block' la barricada más cercana, 'strong' la más dura): hit, push (negativo
 *           atrae), block, slow (te frena a slowK durante slowT s), zone (deja una zona); n golpes cada gap s
 *   lob     n proyectiles que vuelan fly s: at 'target' (repartidos en spread px), 'radial' (alrededor
 *           de él, a spread px) o 'block'; al caer, ring de radio r (hit, push, block) y zone
 *   line    golpe en línea recta de len px y ancho wid: hit, push (negativo atrae), block, root s (te
 *           deja quieto), zone (zonas a lo largo)
 *   summon  n zombis de types alrededor de él (at 'self') o junto a ti (at 'target'); hp: su vida
 *   buff    los zombis a r px (r = 0: todos) van speed veces más rápido y reciben res del daño time s
 *   self    él mismo time s: recibe dmg del daño (dmg > 1: queda expuesto), corre speed, golpea rate;
 *           still: no se mueve; cloak: casi invisible; aura: zona que deja a su paso; luego after s
 *           aturdido recibiendo vuln
 *   zone    n zonas (kind de BOSS_ZONES) de radio r durante life s: at 'self', 'target' o 'around'
 *           (repartidas a spread px de ti)
 *   burrow  se hunde, viaja bajo tierra time s y sale debajo de ti: ring r (hit, push, block); luego
 *           after s aturdido (vuln)
 *   leap    salta sobre lo que haya hasta junto a ti en time s: ring r al caer; luego after s quieto (vuln)
 *   pull    te atrae con fuerza force durante time s si estás a r px (él no se mueve)
 *   emp     apaga time s las torretas a r px
 *   walls   n bloques de metal temporales (life s) alrededor de ti ('cage') o entre él y tú ('wall')
 *   revive  levanta hasta n zombis caídos hace poco, con la mitad de su vida
 * vuln en cualquier ataque: el daño que recibe mientras lo prepara.
 */
export interface BossAtk {
  id: string;
  name: string;
  k: string;
  windup: number;
  w?: number;
  cd?: number;
  min?: number;
  max?: number;
  phase?: number;
  vuln?: number;
  at?: string;
  r?: number;
  hit?: number;
  push?: number;
  block?: number;
  slowK?: number;
  slowT?: number;
  zone?: string;
  n?: number;
  gap?: number;
  fly?: number;
  spread?: number;
  len?: number;
  wid?: number;
  root?: number;
  speed?: number;
  time?: number;
  throw?: number;
  crush?: boolean;
  stun?: number;
  dashes?: number;
  types?: string[];
  hp?: number;
  res?: number;
  dmg?: number;
  rate?: number;
  still?: boolean;
  cloak?: boolean;
  aura?: string;
  after?: number;
  force?: number;
  kind?: string;
  life?: number;
}

/**
 * Lo que tiene cada jefe además de sus ataques:
 *   back / front: daño que recibe por la espalda / de frente (front < 1: escudo)
 *   fury: al quedar con at de vida corre speed y pega rate veces más rápido, espera wait veces menos entre
 *     ataques, recibe dmg del daño y, si summon, llama a esos zombis (n de types) una vez
 *   trail: deja una zona (kind) a su paso cada every s · heal: se cura per por cada zombi que muere a r px
 *   hunger: por cada step de vida perdida pega dmg más · stagger: las explosiones lo aturden stun s
 *   swarm: con at de vida o menos, llama n zombis de types cada every s
 *   part: una parte que se rompe (name; hp: parte de su vida máxima; from 'back', 'front' o 'any'; share:
 *     parte del daño que le llega). Rota: off (ataques que ya no hace), speed, dmg (daño que recibe);
 *     segs: se rompe por tramos, cada uno multiplica dmg y calma a la horda
 */
export interface BossDef {
  name: string;
  tip: string;
  reward: number;
  wait: [number, number];
  back?: number;
  front?: number;
  fury?: {
    at: number;
    speed: number;
    rate: number;
    wait?: number;
    dmg?: number;
    summon?: { n: number; types: string[] };
  };
  trail?: { kind: string; every: number; r: number; life: number };
  heal?: { r: number; per: number };
  hunger?: { step: number; dmg: number };
  stagger?: number;
  swarm?: { at: number; every: number; n: number; types: string[] };
  part?: {
    name: string;
    hp: number;
    from: string;
    share: number;
    off?: string[];
    speed?: number;
    dmg?: number;
    segs?: number;
  };
  atk: BossAtk[];
}

// Zonas que dejan los jefes: dps de daño a quien esté dentro, lo frena a slow, color y nombre de la causa.
export const BOSS_ZONES: Record<string, { dps: number; slow: number; col: string }> = {
  toxic: { dps: 9, slow: 0.85, col: '120,200,60' },
  fire: { dps: 14, slow: 1, col: '255,120,40' },
  elec: { dps: 16, slow: 0.7, col: '120,190,255' },
  wind: { dps: 5, slow: 0.45, col: '200,200,190' },
  dust: { dps: 0, slow: 0.8, col: '150,120,80' },
};
export const BOSS_ZONE_ORDER = ['toxic', 'fire', 'elec', 'wind', 'dust'];

export const BOSSES: Record<string, BossDef> = {
  supremo: {
    name: 'El Rocoso Supremo',
    tip: 'Dispárale por la espalda: ahí la piedra es más delgada',
    reward: 1500,
    wait: [2.4, 4],
    back: 1.4,
    fury: { at: 0.3, speed: 1.45, rate: 1.7 },
    atk: [
      {
        id: 'charge',
        name: 'Embestida rocosa',
        k: 'charge',
        windup: 1.1,
        min: 200,
        max: 760,
        speed: 520,
        time: 1.4,
        hit: 35,
        throw: 1300,
        block: 1500,
        crush: true,
        stun: 1.6,
      },
      {
        id: 'stomp',
        name: 'Pisotón',
        k: 'ring',
        windup: 1,
        max: 230,
        at: 'self',
        r: 200,
        hit: 18,
        push: 950,
        block: 300,
      },
      {
        id: 'rock',
        name: 'Lanzamiento de roca',
        k: 'lob',
        windup: 0.9,
        min: 170,
        max: 680,
        at: 'target',
        n: 1,
        fly: 1,
        r: 85,
        hit: 30,
        push: 500,
        block: 600,
      },
      { id: 'skin', name: 'Piel endurecida', k: 'self', windup: 0.7, cd: 20, time: 8, dmg: 0.5 },
    ],
  },
  aplastador: {
    name: 'El Aplastador',
    tip: 'Si falla la carga queda aturdido 3 s: ahí es cuando pega duro',
    reward: 2200,
    wait: [2.2, 3.6],
    fury: { at: 0.3, speed: 1.3, rate: 1.6 },
    atk: [
      {
        id: 'hammer',
        name: 'Martillazo',
        k: 'ring',
        windup: 1.1,
        max: 320,
        at: 'front',
        r: 170,
        hit: 30,
        push: 600,
        block: 1400,
      },
      {
        id: 'charge',
        name: 'Carga brutal',
        k: 'charge',
        windup: 1,
        min: 220,
        max: 800,
        speed: 600,
        time: 1.3,
        hit: 30,
        throw: 1700,
        block: 1200,
        crush: true,
        stun: 3,
        vuln: 1,
      },
      {
        id: 'grab',
        name: 'Agarre demoledor',
        k: 'line',
        windup: 0.7,
        max: 150,
        len: 140,
        wid: 60,
        hit: 45,
        push: 1900,
      },
      {
        id: 'combo',
        name: 'Golpes consecutivos',
        k: 'ring',
        windup: 0.6,
        max: 260,
        at: 'front',
        r: 110,
        hit: 16,
        push: 300,
        block: 700,
        n: 3,
        gap: 0.35,
      },
      { id: 'rally', name: 'Rompefilas', k: 'buff', windup: 0.8, cd: 14, r: 600, speed: 1.5, res: 1, time: 6 },
    ],
  },
  campanero: {
    name: 'El Campanero',
    tip: 'Rompe la campana de su espalda y se acaban sus llamadas',
    reward: 3000,
    wait: [2.4, 3.8],
    fury: { at: 0.2, speed: 1.2, rate: 1.3, summon: { n: 14, types: ['sprinter'] } },
    part: { name: 'Campana', hp: 0.12, from: 'back', share: 1, off: ['call', 'wave', 'war'] },
    atk: [
      {
        id: 'call',
        name: 'Llamada de la horda',
        k: 'summon',
        windup: 1.6,
        cd: 16,
        at: 'self',
        n: 20,
        types: ['normal', 'normal', 'sprinter'],
      },
      {
        id: 'wave',
        name: 'Onda sonora',
        k: 'ring',
        windup: 1,
        max: 420,
        at: 'self',
        r: 380,
        hit: 4,
        slowK: 0.5,
        slowT: 4,
      },
      { id: 'war', name: 'Campanada de guerra', k: 'buff', windup: 0.9, cd: 12, r: 520, speed: 1.35, res: 1, time: 8 },
      { id: 'chain', name: 'Golpe de cadena', k: 'line', windup: 0.7, max: 300, len: 300, wid: 34, hit: 24, push: 500 },
    ],
  },
  contaminado: {
    name: 'El Contaminado',
    tip: 'Sus depósitos de la espalda reciben el doble: rodéalo',
    reward: 3800,
    wait: [2.4, 3.8],
    back: 2,
    trail: { kind: 'toxic', every: 0.5, r: 46, life: 5 },
    fury: { at: 0.3, speed: 1.25, rate: 1.3 },
    atk: [
      {
        id: 'cloud',
        name: 'Nube tóxica',
        k: 'zone',
        windup: 0.9,
        cd: 10,
        at: 'self',
        kind: 'toxic',
        n: 1,
        r: 190,
        life: 8,
      },
      {
        id: 'spit',
        name: 'Proyectil corrosivo',
        k: 'lob',
        windup: 0.7,
        min: 160,
        max: 700,
        at: 'target',
        n: 1,
        fly: 0.8,
        r: 70,
        hit: 18,
        block: 900,
        zone: 'toxic',
      },
      {
        id: 'burst',
        name: 'Explosión química',
        k: 'ring',
        windup: 1.1,
        max: 260,
        at: 'self',
        r: 240,
        hit: 24,
        push: 700,
        block: 300,
        zone: 'toxic',
      },
      {
        id: 'rain',
        name: 'Lluvia corrosiva',
        k: 'lob',
        windup: 1.2,
        min: 120,
        max: 800,
        at: 'target',
        n: 6,
        spread: 240,
        fly: 1.2,
        r: 64,
        hit: 14,
        block: 300,
        zone: 'toxic',
      },
    ],
  },
  carcelero: {
    name: 'El Carcelero',
    tip: 'Su puerta para casi todo de frente: atácalo por los costados y la espalda',
    reward: 4600,
    wait: [2.4, 3.6],
    front: 0.2,
    back: 1.2,
    fury: { at: 0.3, speed: 1.25, rate: 1.4 },
    atk: [
      {
        id: 'bash',
        name: 'Golpe de prisión',
        k: 'line',
        windup: 0.8,
        max: 220,
        len: 170,
        wid: 80,
        hit: 30,
        push: 900,
        block: 1600,
      },
      {
        id: 'hook',
        name: 'Cadena de captura',
        k: 'line',
        windup: 0.8,
        min: 140,
        max: 420,
        len: 420,
        wid: 30,
        hit: 12,
        push: -900,
        root: 1.2,
      },
      { id: 'cage', name: 'Encierro', k: 'walls', windup: 1, cd: 14, min: 120, max: 700, kind: 'cage', n: 8, life: 6 },
      {
        id: 'march',
        name: 'Carga blindada',
        k: 'charge',
        windup: 1,
        min: 220,
        max: 700,
        speed: 330,
        time: 2,
        hit: 26,
        throw: 900,
        block: 900,
        crush: true,
        stun: 0.8,
      },
    ],
  },
  cazadora: {
    name: 'La Cazadora',
    tip: 'Después de cada salto se queda quieta un momento; las explosiones la aturden',
    reward: 5500,
    wait: [1.6, 2.8],
    stagger: 0.7,
    fury: { at: 0.25, speed: 1.6, rate: 1.4, wait: 0.7 },
    atk: [
      {
        id: 'leap',
        name: 'Salto depredador',
        k: 'leap',
        windup: 0.6,
        min: 180,
        max: 700,
        time: 0.7,
        r: 110,
        hit: 26,
        push: 700,
        block: 300,
        after: 1.1,
        vuln: 1.4,
      },
      {
        id: 'dash',
        name: 'Ataque relámpago',
        k: 'charge',
        windup: 0.5,
        min: 120,
        max: 520,
        speed: 820,
        time: 0.3,
        hit: 18,
        throw: 700,
        block: 300,
        dashes: 3,
        spread: 0.7,
        stun: 0.8,
      },
      { id: 'stalk', name: 'Acecho', k: 'self', windup: 0.5, cd: 14, time: 3.5, speed: 1.8, cloak: true, dmg: 1 },
      {
        id: 'scream',
        name: 'Grito de persecución',
        k: 'summon',
        windup: 1,
        cd: 15,
        at: 'self',
        n: 10,
        types: ['sprinter'],
      },
    ],
  },
  excavador: {
    name: 'El Excavador',
    tip: 'Al salir de la tierra tarda 4 s en reponerse',
    reward: 6500,
    wait: [2.4, 3.8],
    fury: { at: 0.3, speed: 1.2, rate: 1.3, wait: 0.75 },
    atk: [
      {
        id: 'dig',
        name: 'Ataque subterráneo',
        k: 'burrow',
        windup: 1,
        min: 200,
        max: 1100,
        time: 2.4,
        r: 150,
        hit: 34,
        push: 900,
        block: 800,
        after: 4,
        vuln: 1.3,
      },
      {
        id: 'quake',
        name: 'Derrumbe',
        k: 'ring',
        windup: 1.2,
        max: 700,
        at: 'target',
        r: 170,
        hit: 20,
        push: 400,
        block: 1800,
      },
      {
        id: 'debris',
        name: 'Lanzamiento de escombros',
        k: 'lob',
        windup: 0.9,
        max: 600,
        at: 'radial',
        n: 8,
        spread: 260,
        fly: 0.9,
        r: 70,
        hit: 18,
        block: 500,
      },
      {
        id: 'tunnel',
        name: 'Túnel de invasión',
        k: 'summon',
        windup: 1.3,
        cd: 16,
        at: 'target',
        n: 12,
        types: ['normal', 'swat', 'fat'],
      },
      {
        id: 'wreck',
        name: 'Demolición',
        k: 'ring',
        windup: 0.7,
        max: 600,
        at: 'block',
        r: 80,
        hit: 10,
        block: 900,
        n: 4,
        gap: 0.5,
      },
    ],
  },
  generador: {
    name: 'El Generador',
    tip: 'Tras la sobrecarga queda inmóvil y vulnerable 5 s',
    reward: 7600,
    wait: [2.2, 3.4],
    fury: { at: 0.3, speed: 1.2, rate: 1.4, wait: 0.75 },
    atk: [
      {
        id: 'bolt',
        name: 'Descarga eléctrica',
        k: 'line',
        windup: 0.7,
        max: 560,
        len: 560,
        wid: 26,
        hit: 30,
        push: 300,
        slowK: 0.5,
        slowT: 1.5,
      },
      { id: 'emp', name: 'Pulso electromagnético', k: 'emp', windup: 1.2, cd: 18, r: 700, time: 6 },
      {
        id: 'floor',
        name: 'Suelo electrificado',
        k: 'zone',
        windup: 1,
        cd: 9,
        at: 'around',
        kind: 'elec',
        n: 4,
        r: 90,
        spread: 220,
        life: 5,
      },
      {
        id: 'over',
        name: 'Sobrecarga',
        k: 'self',
        windup: 0.8,
        cd: 26,
        time: 10,
        speed: 1.5,
        rate: 1.6,
        dmg: 0.8,
        aura: 'elec',
        after: 5,
        vuln: 1.6,
      },
      {
        id: 'arc',
        name: 'Cadena eléctrica',
        k: 'ring',
        windup: 0.9,
        max: 700,
        at: 'target',
        r: 260,
        hit: 22,
        slowK: 0.6,
        slowT: 1.5,
        zone: 'elec',
      },
    ],
  },
  reina: {
    name: 'La Reina de la Colmena',
    tip: 'Mientras pare infectados no se mueve y recibe más daño',
    reward: 9000,
    wait: [2.6, 4],
    swarm: { at: 0.4, every: 15, n: 8, types: ['sprinter'] },
    fury: { at: 0.25, speed: 1.3, rate: 1.3 },
    atk: [
      {
        id: 'brood',
        name: 'Nacimiento masivo',
        k: 'summon',
        windup: 2,
        cd: 18,
        at: 'self',
        n: 25,
        types: ['sprinter'],
        vuln: 1.4,
      },
      {
        id: 'guard',
        name: 'Guardia real',
        k: 'summon',
        windup: 1.6,
        cd: 26,
        at: 'self',
        n: 4,
        types: ['heavy'],
        vuln: 1.4,
      },
      { id: 'order', name: 'Orden de ataque', k: 'buff', windup: 1, cd: 14, r: 0, speed: 1.3, res: 0.85, time: 8 },
      { id: 'shell', name: 'Caparazón protector', k: 'self', windup: 0.6, cd: 22, time: 6, dmg: 0.1, still: true },
      { id: 'spike', name: 'Aguijón', k: 'line', windup: 0.8, max: 300, len: 300, wid: 50, hit: 30, push: 700 },
    ],
  },
  devorador: {
    name: 'El Devorador',
    tip: 'Se cura cuando mueren zombis cerca: limpia su alrededor',
    reward: 11000,
    wait: [2.4, 3.6],
    heal: { r: 420, per: 900 },
    hunger: { step: 0.2, dmg: 0.1 },
    fury: { at: 0.2, speed: 1.3, rate: 1.3 },
    atk: [
      {
        id: 'bite',
        name: 'Mordida titánica',
        k: 'line',
        windup: 0.7,
        max: 200,
        len: 180,
        wid: 90,
        hit: 60,
        push: 900,
        block: 1500,
      },
      { id: 'suck', name: 'Succión', k: 'pull', windup: 0.8, cd: 12, max: 520, r: 520, force: 300, time: 3 },
      {
        id: 'quake',
        name: 'Golpe sísmico',
        k: 'ring',
        windup: 1.2,
        max: 400,
        at: 'self',
        r: 340,
        hit: 18,
        push: 900,
        block: 900,
      },
      {
        id: 'spew',
        name: 'Vómito de restos',
        k: 'lob',
        windup: 1,
        min: 200,
        max: 700,
        at: 'target',
        n: 3,
        spread: 160,
        fly: 1,
        r: 80,
        hit: 22,
        block: 500,
      },
    ],
  },
  incendiario: {
    name: 'El Incendiario',
    tip: 'Cuando se sobrecalienta, sus depósitos quedan expuestos: recibe un 60 % más',
    reward: 13000,
    wait: [2.2, 3.4],
    trail: { kind: 'fire', every: 0.6, r: 40, life: 4 },
    fury: { at: 0.3, speed: 1.25, rate: 1.3, wait: 0.75 },
    atk: [
      {
        id: 'flame',
        name: 'Llamarada frontal',
        k: 'line',
        windup: 0.8,
        max: 320,
        len: 320,
        wid: 70,
        hit: 22,
        push: 300,
        zone: 'fire',
      },
      {
        id: 'bomb',
        name: 'Bombardeo incendiario',
        k: 'lob',
        windup: 1,
        min: 150,
        max: 750,
        at: 'target',
        n: 4,
        spread: 200,
        fly: 1,
        r: 70,
        hit: 14,
        block: 300,
        zone: 'fire',
      },
      {
        id: 'heat',
        name: 'Sobrecalentamiento',
        k: 'self',
        windup: 0.8,
        cd: 24,
        time: 12,
        rate: 1.4,
        dmg: 1.6,
        aura: 'fire',
      },
      {
        id: 'storm',
        name: 'Tormenta de llamas',
        k: 'zone',
        windup: 1.4,
        cd: 16,
        phase: 1,
        at: 'around',
        kind: 'fire',
        n: 8,
        r: 80,
        spread: 520,
        life: 6,
      },
    ],
  },
  arquitecto: {
    name: 'El Arquitecto de Ruinas',
    tip: 'Mientras demuele, sus brazos quedan expuestos: recibe un 50 % más',
    reward: 15000,
    wait: [2.4, 3.6],
    fury: { at: 0.3, speed: 1.2, rate: 1.3, wait: 0.75 },
    atk: [
      {
        id: 'breaker',
        name: 'Destructor de muros',
        k: 'ring',
        windup: 1.2,
        max: 900,
        at: 'strong',
        r: 120,
        hit: 20,
        block: 3000,
        vuln: 1.5,
      },
      {
        id: 'wall',
        name: 'Barrera de escombros',
        k: 'walls',
        windup: 0.9,
        cd: 14,
        min: 200,
        max: 800,
        kind: 'wall',
        n: 5,
        life: 8,
      },
      {
        id: 'chain',
        name: 'Demolición en cadena',
        k: 'ring',
        windup: 1,
        max: 700,
        at: 'block',
        r: 230,
        hit: 18,
        block: 1300,
        vuln: 1.5,
      },
      {
        id: 'slab',
        name: 'Proyectil estructural',
        k: 'lob',
        windup: 1,
        min: 180,
        max: 800,
        at: 'target',
        n: 1,
        fly: 1.1,
        r: 120,
        hit: 40,
        push: 700,
        block: 1400,
      },
      {
        id: 'siege',
        name: 'Asedio inteligente',
        k: 'summon',
        windup: 1.4,
        cd: 18,
        at: 'target',
        n: 15,
        types: ['normal', 'swat', 'bull'],
      },
    ],
  },
  tormenta: {
    name: 'La Tormenta Viviente',
    tip: 'Rompe los mecanismos de sus hombros (por la espalda) y se acaba el viento',
    reward: 17000,
    wait: [2.2, 3.4],
    part: { name: 'Hombros', hp: 0.15, from: 'back', share: 1, off: ['gust', 'whirl', 'dust'] },
    fury: { at: 0.2, speed: 1.2, rate: 1.3, wait: 0.6 },
    atk: [
      {
        id: 'gust',
        name: 'Ráfaga monstruosa',
        k: 'line',
        windup: 0.9,
        max: 600,
        len: 600,
        wid: 120,
        hit: 10,
        push: 1700,
      },
      {
        id: 'whirl',
        name: 'Torbellino de escombros',
        k: 'zone',
        windup: 1,
        cd: 10,
        at: 'target',
        kind: 'wind',
        n: 1,
        r: 150,
        life: 7,
      },
      {
        id: 'hail',
        name: 'Lluvia de proyectiles',
        k: 'lob',
        windup: 1,
        min: 100,
        max: 800,
        at: 'target',
        n: 7,
        spread: 260,
        fly: 1.1,
        r: 60,
        hit: 16,
        block: 400,
      },
      {
        id: 'dust',
        name: 'Tormenta de polvo',
        k: 'zone',
        windup: 1.2,
        cd: 20,
        at: 'self',
        kind: 'dust',
        n: 1,
        r: 520,
        life: 8,
      },
    ],
  },
  titan: {
    name: 'El Titán del Apocalipsis',
    tip: 'Rompe las placas de sus rodillas (de frente) y caminará más lento',
    reward: 20000,
    wait: [2.4, 3.6],
    part: { name: 'Rodillas', hp: 0.12, from: 'front', share: 0.5, speed: 0.6 },
    fury: { at: 0.3, speed: 1.5, rate: 1.5, wait: 0.5, dmg: 1.25 },
    atk: [
      {
        id: 'stomp',
        name: 'Pisotón devastador',
        k: 'ring',
        windup: 1.3,
        max: 420,
        at: 'self',
        r: 380,
        hit: 30,
        push: 1200,
        block: 700,
      },
      {
        id: 'car',
        name: 'Lanzamiento de vehículos',
        k: 'lob',
        windup: 1.1,
        min: 200,
        max: 900,
        at: 'target',
        n: 1,
        fly: 1.2,
        r: 130,
        hit: 45,
        push: 900,
        block: 2200,
      },
      {
        id: 'charge',
        name: 'Carga colosal',
        k: 'charge',
        windup: 1.2,
        min: 250,
        max: 900,
        speed: 480,
        time: 1.8,
        hit: 40,
        throw: 1600,
        block: 3000,
        crush: true,
        stun: 1.5,
      },
      {
        id: 'doom',
        name: 'Golpe de destrucción',
        k: 'ring',
        windup: 2,
        max: 1000,
        at: 'strong',
        r: 200,
        hit: 50,
        push: 1000,
        block: 4500,
      },
    ],
  },
  rey: {
    name: 'El Rey de los Muertos',
    tip: 'Su corona tiene tres núcleos: cada uno que rompas lo debilita y calma a la horda',
    reward: 30000,
    wait: [2.2, 3.4],
    part: { name: 'Corona', hp: 0.15, from: 'any', share: 0.3, dmg: 1.2, segs: 3 },
    swarm: { at: 0.2, every: 12, n: 8, types: ['normal', 'sprinter', 'swat', 'bull'] },
    fury: { at: 0.2, speed: 1.4, rate: 1.4, wait: 0.55 },
    atk: [
      {
        id: 'army',
        name: 'Llamado del ejército',
        k: 'summon',
        windup: 1.5,
        cd: 18,
        at: 'self',
        n: 16,
        types: ['normal', 'sprinter', 'swat', 'fat', 'bull', 'rock'],
      },
      { id: 'rule', name: 'Dominio absoluto', k: 'buff', windup: 1.2, cd: 24, r: 0, speed: 1.3, res: 0.7, time: 15 },
      {
        id: 'doom',
        name: 'Aniquilación',
        k: 'ring',
        windup: 3,
        max: 900,
        at: 'target',
        r: 280,
        hit: 65,
        push: 1300,
        block: 5000,
      },
      { id: 'raise', name: 'Resurrección del ejército', k: 'revive', windup: 1.6, cd: 22, n: 30 },
      {
        id: 'sweep',
        name: 'Golpe real',
        k: 'line',
        windup: 0.8,
        max: 300,
        len: 300,
        wid: 90,
        hit: 40,
        push: 1000,
        block: 1500,
      },
    ],
  },
};

// Arranque suave para engancharse rápido:
//   size: fracción de normales y velocistas en las oleadas 1, 2 y 3 (desde la 4, la horda entera)
//   swatFrom: oleada desde la que llegan policías SWAT · freeHits: hasta qué oleada los golpes no cuestan dinero
//   xp: fracción de la experiencia que piden los niveles 1 y 2
//   bonus: premio por superar la oleada w = base + perWave × w
export const START = {
  size: [0.45, 0.65, 0.85],
  swatFrom: 2,
  freeHits: 3,
  xp: [0.47, 0.67],
  bonus: { base: 15, perWave: 10 },
};

// Curva de experiencia: barata al principio (mejoras seguidas en los primeros minutos)
// y cuadrática después, sin saltos bruscos entre niveles.
//   nv1 24 · nv2 60 · nv3 139 · nv5 275 · nv10 825 · nv20 2825
export const xpForLevel = (lvl: number) => Math.round((25 + 20 * lvl + 6 * lvl * lvl) * (START.xp[lvl - 1] ?? 1));

// Dinero por cada zombi eliminado: la cuarta parte de lo que era (se ganaba demasiado rápido).
// Hay fracciones: lo que sobra de cada baja se junta en Player.cash hasta completar un dólar.
export const BOUNTY = {
  normal: 0.5,
  sprinter: 1.5,
  swat: 5,
  fat: 2.5,
  heavy: 12.5,
  bull: 7.5,
  rock: 10,
  giant: 2.5,
  golden: 0,
  supremo: 100,
  aplastador: 150,
  campanero: 200,
  contaminado: 250,
  carcelero: 300,
  cazadora: 350,
  excavador: 400,
  generador: 450,
  reina: 500,
  devorador: 550,
  incendiario: 600,
  arquitecto: 650,
  tormenta: 700,
  titan: 800,
  rey: 1000,
};

// Tamaño y ritmo de las oleadas: rondas cortas.
// count: fracción de zombis por oleada (se aplica igual en solitario y en línea, ver NET.crowd)
// hp / speed: vida y velocidad base de los zombis de oleada · straggle: s antes de acercar a los rezagados
// spawnTime: toda la oleada aparece en estos s (en ráfagas cada burst s), salvo que se llegue al tope de vivos
// view: media caja (px) que se da por vista de los demás jugadores (cubre celular vertical y pantalla ancha);
// nadie aparece dentro de la vista de ningún jugador vivo
// offscreen: multiplicador de velocidad de un zombi que ningún jugador ve (llegan antes, sin rezagados)
// lost: px desde el jugador más cercano a partir de los que un zombi fuera de vista se da por perdido
// baseGap: ningún zombi aparece dentro de una base cerrada ni a menos de estos px de algo construido
export const WAVES = {
  count: 0.75,
  hp: 0.9,
  speed: 1.2,
  straggle: 3,
  spawnTime: 10,
  burst: 0.4,
  view: [680, 520],
  offscreen: 1.8,
  lost: 1100,
  baseGap: 140,
};

// Embestida del toro: te ve, escarba y carga en línea recta.
// hit: daño al jugador · long/short: daño de la embestida larga y corta contra estructuras.
// Rocoso (ZOMBIES.rock): desde la oleada `from`, `first` por oleada y `per` más por cada oleada
// siguiente (escalado como la horda). Camina recto hacia ti; si topa con un edificio rodea
// detour s por la ruta normal. Contra lo que le estorba:
//   árboles y coches: se planta smash s y los hace pedazos (desaparecen del mapa)
//   madera: la aplasta al pasar · metal: la abolla (dent de su vida) y la lanza throw px
//   metal, valla y sacos: no los mueve enseguida; se recarga contra ellos y los golpea (leanHit cada
//   leanRate s). Si sigue pegado al mismo muro lean s: el metal lo avienta y la valla y los sacos los
//   empuja (push px/s) mientras les quita pushDps hasta quebrarlos
//   concreto, torretas: embestida corta (short px de impulso) de shortHit
//   HESCO y concreto reforzado: se aleja long px, carga y embiste con longHit
// Si te alcanza te agarra (hold s), te quita grab.hit y te lanza (throw px/s) hacia donde hay más
// zombis: los que tocas mientras vuelas (fly s) mueren, salvo los grandes (big), que sólo se apartan.
export const ROCK = {
  from: 5,
  first: 1,
  per: 0.6,
  detour: 2.5,
  smash: 0.5,
  dent: 0.7,
  lean: 5,
  leanHit: 150,
  leanRate: 0.6,
  throw: 70,
  push: 70,
  pushDps: 750,
  short: 45,
  shortHit: 350,
  long: 120,
  longHit: 700,
  ramSpeed: 300,
  grab: { cd: 6, hold: 0.35, hit: 50, throw: 1700, fly: 0.55, big: ['rock', 'heavy', 'giant', 'bull'] },
};

export const BULL = {
  sight: 430,
  windup: 0.75,
  speed: 470,
  maxTime: 1.25,
  hit: 40,
  throw: 1500,
  long: 250,
  short: 40,
  cooldown: 2.2,
};

// Zombis normales heridos: se desangran (vida por segundo) y avanzan arrastrándose.
export const WOUND = { bleed: 3, pace: 0.5 };

// Zombis lanzados por explosiones y embestidas: gravedad (px/s²) y altura máxima (px). Se dibujan
// más grandes cuanto más alto van; sin tope, varias explosiones seguidas los subían cientos de px
// y parecían gigantes encima de los muros. vmax: velocidad con la que se llega justo al tope.
const AIR_MAX = 70;
export const AIR = { gravity: 900, max: AIR_MAX, vmax: Math.sqrt(2 * 900 * AIR_MAX) };

// Molotov: charco de fuego y quemadura sobre los zombis que lo pisan.
export const MOLOTOV = { radius: 82, life: 6.5, burn: 4, dps: 24 };

// Zombi dorado: recompensa al matarlo y cuánto vive antes de desaparecer.
export const GOLDEN = { rewardMin: 25, rewardMax: 63, life: 26, warnAt: 7, firstAfter: 12, every: [35, 65] };

// Racha: bajas seguidas sin dejar pasar window s entre una y otra ni recibir un golpe de zombi.
// tiers: [bajas, multiplicador] del dinero y la experiencia de cada baja · golden: bajas que suma
// un dorado · show: desde cuántas bajas se ve el contador.
// Latas: la moneda de la personalización. Al superar cada oleada ganas base + 1 por cada `every`
// oleadas (1 en las primeras, 2 desde la 5, 3 desde la 10...). Se guardan en la cuenta.
export const CANS = { base: 1, every: 5 };
export const cansForWave = (wave: number) => CANS.base + Math.floor(Math.max(0, wave) / CANS.every);

// Lo que se pone el superviviente, por ranura (el primero de cada lista es el de fábrica). price: latas
// que cuesta (sin price es gratis). El orden importa: en línea viaja como un carácter por ranura.
export const LOOK_SLOTS: Record<string, { id: string; name: string; price?: number }[]> = {
  hat: [
    { id: 'none', name: 'Nada' },
    { id: 'cap', name: 'Gorra' },
    { id: 'cowboy', name: 'Vaquero' },
    { id: 'beanie', name: 'Gorro' },
    { id: 'helmet', name: 'Casco' },
    { id: 'bandana', name: 'Bandana' },
    { id: 'hood', name: 'Capucha' },
    { id: 'tophat', name: 'Sombrero de copa', price: 6 },
    { id: 'viking', name: 'Vikingo', price: 12 },
    { id: 'samurai', name: 'Kabuto samurái', price: 18 },
    { id: 'crown', name: 'Corona', price: 30 },
  ],
  suit: [
    { id: 'none', name: 'Normal' },
    { id: 'camo', name: 'Camuflaje' },
    { id: 'vest', name: 'Chaleco táctico' },
    { id: 'hazmat', name: 'Traje hazmat', price: 10 },
    { id: 'ninja', name: 'Ninja', price: 14 },
    { id: 'gold', name: 'Armadura dorada', price: 30 },
  ],
  face: [
    { id: 'none', name: 'Nada' },
    { id: 'glasses', name: 'Gafas de sol', price: 3 },
    { id: 'gasmask', name: 'Máscara de gas', price: 6 },
    { id: 'hockey', name: 'Máscara de hockey', price: 8 },
    { id: 'nvg', name: 'Visor nocturno', price: 12 },
    { id: 'cyber', name: 'Visor cibernético', price: 20 },
  ],
  back: [
    { id: 'pack', name: 'Mochila' },
    { id: 'katana', name: 'Katana', price: 8 },
    { id: 'cape', name: 'Capa', price: 12 },
    { id: 'jetpack', name: 'Jetpack', price: 20 },
    { id: 'wings', name: 'Alas', price: 35 },
  ],
  aura: [
    { id: 'none', name: 'Nada' },
    { id: 'neon', name: 'Estela de neón', price: 15 },
    { id: 'sparks', name: 'Chispas eléctricas', price: 18 },
    { id: 'flames', name: 'Pies en llamas', price: 22 },
    { id: 'toxic', name: 'Aura tóxica', price: 25 },
  ],
};
export const LOOK_SLOT_ORDER = ['hat', 'suit', 'face', 'back', 'aura'];

export const COMBO = {
  window: 2.5,
  golden: 10,
  show: 5,
  tiers: [
    [10, 1.5],
    [25, 2],
    [50, 3],
    [100, 4],
  ],
};

// Rondas especiales: desde la oleada `from`, cada oleada tiene `chance` de serlo; nunca dos
// seguidas ni un tipo que salió en las `gap` especiales anteriores. Cada tipo lleva su cartel
// (name, desc), tag: su nombre corto en el contador de oleada, y pay: multiplicador del dinero
// de las bajas de esa ronda.
//   fog: niebla que deja ver hasta clear px (thick: opacidad de la niebla)
//   blackout: farolas apagadas y oscuridad ambient · stampede: solo velocistas y toros, size de
//   la horda normal y bulls de ella toros · golden: un dorado cada every s · siege: swat de los
//   normales con escudo · blood: zombis speed veces más rápidos
export interface EventDef {
  name: string;
  tag: string;
  desc: string;
  pay: number;
  clear?: number;
  thick?: number;
  ambient?: number;
  size?: number;
  bulls?: number;
  every?: [number, number];
  swat?: number;
  speed?: number;
}
export const EVENTS: { from: number; chance: number; gap: number; types: Record<string, EventDef> } = {
  from: 2,
  chance: 0.65,
  gap: 2,
  types: {
    fog: {
      name: 'Niebla',
      tag: 'Niebla',
      desc: 'No ves más allá de unos pasos: escucha a la horda',
      pay: 1.5,
      clear: 230,
      thick: 0.9,
    },
    blackout: {
      name: 'Apagón',
      tag: 'Apagón',
      desc: 'Se apagaron las farolas: solo queda tu linterna',
      pay: 1.5,
      ambient: 0.82,
    },
    stampede: {
      name: 'Estampida',
      tag: 'Estampida',
      desc: 'Velocistas y toros a toda carrera',
      pay: 1.5,
      size: 0.6,
      bulls: 0.1,
    },
    golden: {
      name: 'Lluvia dorada',
      tag: 'Dorados',
      desc: 'Zombis dorados por todas partes: atrápalos',
      pay: 1.5,
      every: [7, 11],
    },
    siege: {
      name: 'Asedio blindado',
      tag: 'Asedio',
      desc: 'La mitad de la horda llega con escudo',
      pay: 1.5,
      swat: 0.5,
    },
    blood: { name: 'Luna de sangre', tag: 'Sangre', desc: 'Más rápidos y pagan el doble', pay: 2, speed: 1.2 },
  },
};
// Orden fijo de los tipos: la foto manda la ronda especial por su lugar aquí (0 = ninguna).
export const EVENT_ORDER = ['fog', 'blackout', 'stampede', 'golden', 'siege', 'blood'];

// Dinero que pierdes con cada golpe de zombi (siempre más de $15).
export const MONEY_LOSS = { min: 16, max: 40 };

// Probabilidad de que cada tipo suelte munición o botiquín al morir.
export const DROPS = {
  normal: { ammo: 0.06, med: 0.02 },
  sprinter: { ammo: 0.06, med: 0.02 },
  swat: { ammo: 0.18, med: 0.06 },
  fat: { ammo: 0.3, med: 0.1 },
  heavy: { ammo: 0.6, med: 0.25 },
  bull: { ammo: 0.4, med: 0.15 },
  rock: { ammo: 0.5, med: 0.2 },
  golden: { ammo: 0.5, med: 0.5 },
};

// Robot de combate (tienda): vida, tamaño (el doble de un gordo), precio y reparación.
export const ROBOT = { hp: 10000, radius: 42, mass: 40, price: 10000, repairPerHp: 0.1, speed: 0.85, gunScale: 1.7 };

// Torreta pesada montada: munición que se compra (pack balas por price), qué tan rápido gira el
// cañón (rad/s), cuánto daño quita su escudo al que la maneja, a qué distancia se monta y la
// microexplosión de cada bala (radio en px y daño en el centro; la granada es 140 y 330).
export const HEAVY = { pack: 100, price: 200, turn: 4.5, shield: 0.5, reach: 60, blastR: 60, blastPower: 55 };

// Torreta militar (SHOP.military): gira despacio (turn rad/s) hacia el zombi a su alcance (range px),
// prefiriendo a los grandes (big), y cada reload s lanza un misil antitanque que vuela recto a speed px/s
// y estalla con el radio y el daño del misil del Bomber (ABILITY.bomber) en el primer zombi o pared que
// toca, o donde estaba su blanco. No necesita munición. min: no dispara a los que tiene encima.
// También se monta con E: subido en la escotilla (seat px detrás del centro) la torre gira más rápido
// (handTurn) hacia tu mira y lanzas tú un misil cada manual s, hasta donde apuntas. range, turn y
// reload son los de fábrica: las mejoras del taller (MILITARY_UP) los cambian, y en la misma proporción
// handTurn y manual.
export const MILITARY = {
  range: 720,
  min: 90,
  turn: 1.8,
  handTurn: 3,
  reload: 2.4,
  manual: 1.6,
  seat: 8,
  speed: 620,
  big: ['rock', 'heavy', 'giant', 'bull', 'fat'],
};

// Mejoras de cada torreta pesada: se compran junto a ella (tecla M o el botón Mejorar) y son de esa
// torreta. price: lo que cuesta cada nivel; los arreglos de efecto empiezan en el nivel 0 (de fábrica).
// Cada mejora llega a 15 niveles como mucho (4 bits por mejora en `up`, ver heavy.ts).
//   cal: multiplica el daño de la bala y de su explosión · rate: disparos por segundo
//   blast: radio de la explosión (px) · armor: vida, y la parte de la vida que repara al acabar la oleada
//   auto: sin nadie a los mandos dispara sola (a rate de su cadencia, hasta range px) con las balas del dueño
export interface HeavyUpDef {
  name: string;
  desc: string;
  price: number[];
  dmg?: number[];
  rate?: number[];
  r?: number[];
  hp?: number[];
  repair?: number[];
  range?: number;
  plan?: string;
  cd?: number[];
  reach?: number[];
  turn?: number[];
  n?: number[];
}
export const HEAVY_UP: Record<string, HeavyUpDef> = {
  cal: {
    name: 'Calibre',
    desc: 'Balas más pesadas: más daño al pegar y al estallar.',
    price: [1000, 2500, 5000, 8000, 12000, 17000, 23000, 30000, 40000, 50000],
    dmg: [1, 1.2, 1.4, 1.6, 1.8, 2, 2.25, 2.5, 2.75, 3, 3.3],
  },
  rate: {
    name: 'Cadencia',
    desc: 'Alimentador más rápido: más balas por segundo.',
    price: [1000, 2500, 5000, 8000, 12000, 17000, 23000, 30000, 40000, 50000],
    rate: [9, 11, 13, 15, 16, 17, 18, 19, 20, 21, 22],
  },
  blast: {
    name: 'Carga explosiva',
    desc: 'Cada bala estalla en un radio más grande.',
    price: [1200, 3000, 6000, 9000, 13000, 18000, 24000, 31000, 40000, 50000],
    r: [60, 75, 90, 105, 115, 125, 135, 145, 155, 165, 175],
  },
  armor: {
    name: 'Blindaje',
    desc: 'Placas y sacos de arena: más vida, y se repara sola al acabar cada oleada.',
    price: [800, 2000, 4000, 6500, 9500, 13000, 17000, 22000, 28000, 35000],
    hp: [4000, 6000, 8000, 10000, 12500, 15000, 17500, 20000, 23000, 26000, 30000],
    repair: [0, 0.15, 0.25, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7],
  },
  auto: {
    name: 'Piloto automático',
    desc: 'Sin nadie a los mandos, dispara sola a los zombis con tus balas.',
    price: [6000],
    rate: [0, 0.5],
    range: 520,
  },
  // plano del nido (OPS.plans.fire): se instala una vez y se elige entre balas normales e incendiarias
  fire: {
    name: 'Munición incendiaria',
    desc: 'Balas que prenden fuego: 20% menos de daño directo, pero queman a los zombis un rato.',
    price: [3000],
    plan: 'fire',
  },
};
export const HEAVY_UP_ORDER = ['cal', 'rate', 'blast', 'armor', 'auto', 'fire'];

// Mejoras de cada torreta militar (MILITARY): el mismo taller (tecla M), guardadas igual en `up`.
//   warhead: multiplica el daño (dmg) y el radio (r) del estallido · reload: segundos entre misiles
//   (cd; subido, el manual baja igual) · radar: alcance (reach px) y giro (turn rad/s; subido, igual)
//   armor: vida y la parte que repara al acabar la oleada · salvo: misiles por disparo (n), en abanico
export const MILITARY_UP: Record<string, HeavyUpDef> = {
  warhead: {
    name: 'Ojiva',
    desc: 'Carga hueca más potente: cada misil pega más fuerte y estalla más grande.',
    price: [3000, 6000, 10000, 15000, 21000, 28000, 36000, 45000],
    dmg: [1, 1.2, 1.4, 1.6, 1.85, 2.1, 2.4, 2.7, 3],
    r: [1, 1.05, 1.1, 1.15, 1.2, 1.25, 1.3, 1.35, 1.4],
  },
  reload: {
    name: 'Cargador automático',
    desc: 'El siguiente misil entra solo: dispara más seguido.',
    price: [3000, 6000, 10000, 15000, 21000, 28000, 36000, 45000],
    cd: [2.4, 2.1, 1.85, 1.65, 1.5, 1.35, 1.2, 1.1, 1],
  },
  radar: {
    name: 'Radar',
    desc: 'Ve más lejos y la torre gira más rápido hacia su blanco.',
    price: [2500, 5000, 9000, 14000, 20000],
    reach: [720, 800, 880, 960, 1040, 1120],
    turn: [1.8, 2.2, 2.6, 3, 3.4, 3.8],
  },
  armor: {
    name: 'Blindaje',
    desc: 'Placas de tanque: más vida, y se repara sola al acabar cada oleada.',
    price: [2000, 4500, 8000, 12000, 17000, 23000, 30000, 38000],
    hp: [9000, 12000, 15000, 18000, 22000, 26000, 30000, 35000, 40000],
    repair: [0, 0.15, 0.25, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6],
  },
  salvo: {
    name: 'Salva',
    desc: 'Más tubos: lanza varios misiles a la vez, en abanico.',
    price: [25000, 60000],
    n: [1, 2, 3],
  },
};
export const MILITARY_UP_ORDER = ['warhead', 'reload', 'radar', 'armor', 'salvo'];

// Clasificación mundial y estadísticas de uso (Supabase, sin librerías: API REST; ver supabase/esquema.sql).
// url: la del proyecto ('https://xxxx.supabase.co'); key: la clave publicable (sb_publishable_…), que es
// pública por diseño: las tablas sólo se escriben a través de las funciones dz_* y sólo `scores` se lee.
// Vacías = sólo clasificación de este dispositivo (y la de Claude si se abre como Artifact), sin estadísticas.
export const ONLINE = {
  url: 'https://pftrqgbronbiqzydylfd.supabase.co',
  key: 'sb_publishable_pSzagBZQ-Qj7tgvCeojedA_Y0IEOuIV',
};

// Multijugador en línea con servidor autoritativo (carpeta server/).
// server: dirección del servidor (wss://…). Vacía: en localhost se usa ws://<equipo>:2567.
// También se puede cambiar al abrir el juego con ?servidor=wss://…
export const NET = {
  server: 'wss://servidor.yeyo.games', // máquina de Vultr en Ciudad de México (deploy/README.md)
  maxPlayers: 4, // cupo de sala (el servidor manda: MAX_PLAYERS)
  tickHz: 60, // pasos de simulación por segundo (servidor y predicción)
  snapHz: 20, // fotos del estado por segundo hacia cada jugador
  interpDelay: 110, // ms de retraso para dibujar a los demás entre dos fotos
  maxExtrapolate: 100, // ms máximos que se adelanta algo sin foto nueva
  pendingMax: 120, // entradas sin confirmar que guarda el cliente (2 s)
  snapDist: 150, // corrección mayor que esto (px): se salta directo, sin suavizar
  smooth: 12, // rapidez con que se borra una corrección pequeña
  reconnectSeconds: 20,
  view: 1000, // mitad del cuadro alrededor de cada jugador que se le manda
  zombieView: [900, 760], // mitad del cuadro para los zombis (cubre cualquier pantalla); dorado y gigante usan view
  crowd: [0.5, 0.15], // zombis por oleada: 0,5 del solitario + 0,15 por cada jugador extra
};

// Umbrales de la música dinámica (peligro = suma de cercanía de zombis).
export const MUSIC = { threatOn: 4, threatOff: 2, hordeOn: 14, hordeOff: 8, minHold: 4 };

// Tienda entre oleadas. w/h en px del mundo; rotates = se coloca perpendicular a la mira.
export const SHOP = {
  wood: {
    name: 'Bloque de madera',
    desc: 'Barricada básica. Disparas por encima de ella.',
    price: 10,
    hp: 160,
    w: 40,
    h: 40,
  },
  metal: {
    name: 'Bloque de metal',
    desc: 'Placa de acero: aguanta 3 veces más que la madera.',
    price: 30,
    hp: 520,
    w: 40,
    h: 40,
  },
  sandbag: {
    name: 'Sacos terreros',
    desc: 'Muro ancho y barato. Ideal para cerrar calles rápido.',
    price: 25,
    hp: 450,
    w: 80,
    h: 24,
    rotates: true,
  },
  fence: {
    name: 'Valla de metal reforzado',
    desc: 'Muro ancho muy resistente. Frena a los gordos un buen rato.',
    price: 70,
    hp: 1400,
    w: 80,
    h: 24,
    rotates: true,
  },
  concrete: {
    name: 'Muro de concreto',
    desc: 'La defensa más dura: aguanta más del doble que la valla.',
    price: 150,
    hp: 3200,
    w: 80,
    h: 28,
    rotates: true,
  },
  hesco: {
    name: 'Barrera HESCO',
    desc: 'Gaviones militares de malla rellenos de arena. Casi indestructible.',
    price: 800,
    hp: 10000,
    w: 80,
    h: 40,
    rotates: true,
  },
  reinforced: {
    name: 'Barrera de concreto reforzado',
    desc: 'Concreto grueso con placas de acero y vigas. Lo más duro que puedes construir.',
    price: 1300,
    hp: 18000,
    // fracción del daño que no le llega
    armor: 0.1,
    w: 80,
    h: 40,
    rotates: true,
  },
  turret: {
    name: 'Torreta automática',
    desc: 'Dispara sola al zombi más cercano. Ponla detrás de tus muros.',
    price: 500,
    hp: 700,
    w: 40,
    h: 40,
    turret: true,
  },
  // Se monta con E (o el botón): la manejas tú con su cañón doble (WEAPONS.heavy) y balas compradas.
  heavy: {
    name: 'Torreta pesada',
    desc: 'Cañón doble blindado: móntala con E y dispara balas explosivas que estallan entre la horda. Necesita munición.',
    price: 15000,
    hp: 4000,
    w: 40,
    h: 40,
    turret: true,
    manned: true,
  },
  // Torre de tanque que dispara sola misiles antitanque (MILITARY): ocupa 3×3 casillas.
  military: {
    name: 'Torreta militar',
    desc: 'Torre de tanque que lanza sola misiles antitanque: cada uno estalla como el misil del Bomber. Busca primero a los zombis grandes. Súbete con E para dispararlos tú.',
    price: 50000,
    hp: 9000,
    w: 60,
    h: 60,
    turret: true,
  },
  wire: {
    name: 'Alambre de púas',
    desc: 'No bloquea el paso: frena mucho y hiere a los zombis que lo cruzan.',
    price: 20,
    hp: 70,
    w: 80,
    h: 40,
    rotates: true,
    ground: true,
  },
  spikes: {
    name: 'Trampa de pinchos',
    desc: 'Placa de clavos: frena y hiere mucho más que el alambre.',
    price: 60,
    hp: 300,
    w: 40,
    h: 40,
    ground: true,
  },
  // Tira de tres bloques de lámina oxidada con pinchos: no tapa el paso, pero frena muchísimo a los
  // zombis que la cruzan (TRAP_RUSTY en build.ts). No se gasta con el uso: dura `waves` oleadas
  // (su `hp` cuenta las oleadas que le quedan) y al final se deshace de óxido.
  rusty: {
    name: 'Barrera de pinchos oxidada',
    desc: 'Tres bloques de lámina oxidada llena de pinchos: los zombis que la cruzan casi se detienen. Dura 3 oleadas.',
    price: 100,
    hp: 3,
    waves: 3,
    w: 120,
    h: 40,
    rotates: true,
    ground: true,
  },
  mine: {
    name: 'Mina terrestre',
    desc: 'Explota cuando un zombi la pisa y arrasa todo alrededor.',
    price: 45,
    hp: 1,
    w: 24,
    h: 24,
    ground: true,
  },
  grenade: {
    name: 'Granada',
    desc: 'Explosión en área que arrasa grupos enteros. Cara, úsala bien.',
    price: 90,
    consumable: true,
  },
  molotov: {
    name: 'Molotov',
    desc: 'Botella incendiaria: deja un charco de fuego que quema a todo zombi que lo pisa.',
    price: 60,
    consumable: true,
  },
  // Planos de las operaciones (OPS.plans): sólo se ven y se compran tras ganarlos (plan).
  decoy: {
    name: 'Señuelo sonoro',
    desc: 'Altavoz con sirena: ponlo y actívalo con H. Atrae a los zombis normales cercanos 8 s y se gasta. Uno activo a la vez.',
    price: 500,
    hp: 900,
    w: 40,
    h: 40,
    plan: 'decoy',
  },
  repair: {
    name: 'Reparador de campo',
    desc: 'Caja de herramientas con 3 cargas: con H repara un 25% a una estructura o robot cercano que lleve 5 s sin recibir daño.',
    price: 1000,
    hp: 600,
    w: 40,
    h: 40,
    plan: 'repair',
  },
  improv: {
    name: 'Misil improvisado',
    desc: 'Tubo, pólvora y cinta: sale recto hacia donde apuntas y estalla al primer golpe. De un solo uso.',
    price: 120,
    consumable: true,
  },
  sticky: {
    name: 'Bomba lapa',
    desc: 'Carga adhesiva: se pega al zombi más cercano a donde apuntas (jefes incluidos) y estalla a los 2 s. Revienta a los gordos, le arranca la mitad de la vida a un rocoso, 1000 al que la lleva y 500 a los de alrededor.',
    price: 250,
    consumable: true,
  },
};
// Modo construir: hasta qué distancia del jugador (px) se coloca la pieza donde apuntas o tocas.
export const BUILD = { reach: 190 };
export const BUILD_ORDER = [
  'wood',
  'sandbag',
  'metal',
  'fence',
  'concrete',
  'hesco',
  'reinforced',
  'turret',
  'heavy',
  'military',
  'wire',
  'spikes',
  'rusty',
  'mine',
  'decoy',
  'repair',
];
export const THROWABLES = ['grenade', 'molotov', 'improv', 'sticky'];
// Misil improvisado (SHOP.improv): vuela recto (cabeceando más que el cohete de la bazuca) hasta
// range px y estalla en el primer zombi o pared que toca, un poco más fuerte que una granada
// (radio 140, daño 330) y con la mitad del área del cohete.
export const IMPROV = { speed: 640, range: 650, radius: 160, power: 420, wobble: 1.8 };
// Bomba lapa (SHOP.sticky): vuela en arco (hasta range px) hacia el zombi más cercano a donde apuntas
// (a seek px como mucho, jefes incluidos), lo sigue y se le pega; a los fuse s estalla. Si no hay
// zombi, cae al suelo y se pega al primero que la toque antes de estallar. Al que la lleva: dmg (al
// gordo lo revienta; al rocoso le quita rock de su vida máxima); a los demás a radius px: area (al
// gordo también lo revienta; al rocoso, rockArea de su vida). La onda lanza a volar a los que quedan.
export const STICKY = {
  range: 360,
  seek: 110,
  fuse: 2,
  radius: 210,
  dmg: 1000,
  area: 500,
  rock: 0.5,
  rockArea: 0.25,
  fling: 1.6,
};
export const SHOP_ORDER = [...BUILD_ORDER, ...THROWABLES];
// Vender un arma devuelve esta fracción de su precio.
export const SELL_RATE = 0.5;

// Largo de cada arma dibujada desde su culata (para la boca del cañón en el brazo del robot).
export const GUN_REACH = {
  pistol: 12,
  smg: 22,
  shotgun: 30,
  flamer: 36,
  ar: 30,
  autoshotgun: 30,
  sniper: 46,
  lmg: 37,
  bazooka: 51,
};

// Etapas de recarga sincronizadas con el progreso de la animación (0..1).
export const RELOAD_STEPS = {
  pistol: [
    [0.12, 'magOut'],
    [0.6, 'magIn'],
    [0.88, 'slide'],
  ],
  smg: [
    [0.15, 'magOut'],
    [0.58, 'magIn'],
    [0.86, 'bolt'],
  ],
  ar: [
    [0.14, 'magOut'],
    [0.56, 'magIn'],
    [0.85, 'bolt'],
  ],
  flamer: [
    [0.12, 'coverOpen'],
    [0.3, 'magOut'],
    [0.62, 'magIn'],
    [0.9, 'coverClose'],
  ],
  sniper: [
    [0.1, 'boltOpen'],
    [0.3, 'shell'],
    [0.5, 'shell'],
    [0.7, 'shell'],
    [0.9, 'boltClose'],
  ],
  shotgun: [
    [0.15, 'shell'],
    [0.32, 'shell'],
    [0.49, 'shell'],
    [0.66, 'shell'],
    [0.88, 'pump'],
  ],
  autoshotgun: [
    [0.12, 'magOut'],
    [0.55, 'drumIn'],
    [0.86, 'bolt'],
  ],
  lmg: [
    [0.08, 'coverOpen'],
    [0.3, 'magOut'],
    [0.55, 'belt'],
    [0.75, 'coverClose'],
    [0.9, 'bolt'],
  ],
  bazooka: [
    [0.12, 'coverOpen'],
    [0.45, 'rocketIn'],
    [0.7, 'rocketSeat'],
    [0.92, 'boltClose'],
  ],
};

// Cuántas variantes de dibujo (paletas) tiene cada tipo de zombi. render/sprites.js comprueba que coincida.
export const ZOMBIE_VARIANTS = {
  normal: 8,
  golden: 2,
  swat: 2,
  heavy: 2,
  sprinter: 3,
  fat: 4,
  bull: 3,
  rock: 2,
  giant: 2,
  supremo: 1,
  aplastador: 1,
  campanero: 1,
  contaminado: 1,
  carcelero: 1,
  cazadora: 1,
  excavador: 1,
  generador: 1,
  reina: 1,
  devorador: 1,
  incendiario: 1,
  arquitecto: 1,
  tormenta: 1,
  titan: 1,
  rey: 1,
};

// Colores de carrocería de los coches abandonados (el mundo elige uno al generarse).
export const CAR_COLORS = ['#7d2f2a', '#c75f43', '#3f566b', '#6b6d68', '#b8b1a0', '#2f3a32', '#8a6a3a', '#4b4f63'];

// Operaciones de alto riesgo (sim/ops.ts): encuentros opcionales entre oleadas, desde la oleada `from`
// y luego cada `every`. Por radio se ofrecen dos de las tres (convoy, nido, suministros) o seguir con
// las oleadas. Duración buscada: 2 a 4 minutos contando el camino.
//   voteT: segundos para votar en grupo · dist: distancia por ruta (px) desde donde se aceptó hasta la
//   zona · gap: distancia mínima a las zonas de las últimas operaciones · tries: lugares que se prueban
//   arrive: a esta distancia del objetivo salen los guardias · reach: alcance de la tecla H
//   outT: segundos de la transición de regreso · retreatHold: segundos que se mantiene «Retirada»
//   budget: zombis de la operación como parte de la siguiente oleada (guardias incluidos) · guards: la
//   parte del presupuesto que son guardias · pace: segundos en los que saldría todo el presupuesto a ritmo
//   normal · burst: como mucho por segundo · reward: dinero (base + perWave por oleada pasada la 20, por
//   el multiplicador de cada una) para cada participante
export const OPS = {
  from: 20,
  every: 5,
  voteT: 20,
  dist: [1000, 1750],
  gap: 900,
  tries: 70,
  arrive: 650,
  reach: 58,
  outT: 3,
  retreatHold: 1.5,
  budget: { convoy: 0.6, nest: 0.8, supply: 0.7 } as Record<string, number>,
  guards: { convoy: 0.08, nest: 0.12, supply: 0.14 } as Record<string, number>,
  pace: 150,
  burst: 30,
  reward: { base: 2000, perWave: 150, mult: { convoy: 1, nest: 1.25, supply: 1.15 } as Record<string, number> },
  // Convoy: camión de w×h con vida hp; cada golpe le quita como mucho maxHit de su vida (así los
  // multiplicadores contra muros no lo revientan de una vez). partT: segundos de H en cada componente ·
  // unlockT: segundos de desbloqueo (en fases de `phase` s) mientras alguien esté a `near` px · truck: parte
  // de los refuerzos que va por el camión · heavy: grupo resistente de la última fase · lootT: H en la caja
  convoy: {
    hp: 3200,
    maxHit: 0.035,
    w: 136,
    h: 58,
    partT: 2,
    unlockT: 60,
    phase: 20,
    near: 320,
    truck: 0.4,
    heavy: { heavy: 3, rock: 1, bull: 1 } as Record<string, number>,
    lootT: 1,
    activity: [0.7, 1, 1.45],
  },
  // Nido: núcleo de core px; tres puntos de carga a ring px del centro (plantT s de H cada uno); la
  // explosión alcanza R px a los fuse s de poner la tercera y quita blast de la vida máxima a quien siga
  // dentro. exitK: la salida a pie más larga debe tardar como mucho esta parte de la cuenta atrás.
  // activity: ritmo de refuerzos con 0, 1, 2 y 3 cargas puestas.
  nest: { core: 92, ring: 132, plantT: 3, fuse: 12, R: 300, blast: 0.65, exitK: 0.6, activity: [0.55, 0.9, 1.3, 1.9] },
  // Suministros: pickT s de H para recoger · slow: cuánto frena llevar uno · dropR: radio del punto de
  // entrega · near/far/narrow: distancia por ruta (px) del punto de entrega a cada cargamento · answer:
  // segundos de aviso y parte del presupuesto de cada respuesta tras una entrega · dropT: H para soltarlo
  supply: {
    pickT: 1,
    slow: 0.15,
    dropR: 78,
    near: [420, 720],
    far: [1050, 1500],
    narrow: [600, 1150],
    answer: [3, 0.06],
    dropT: 0.5,
  },
  // Planos que se ganan (una vez por partida) al completar cada operación.
  //   decoy (convoy): pieza que se activa con H y atrae a los zombis normales a radius px durante lure s
  //   fire (nido): munición incendiaria del taller de la torreta pesada: dmg del daño y burn s de fuego
  //   repair (suministros): pieza con charges cargas; cada una repara heal de la vida máxima de una
  //   estructura o robot a range px que lleve quiet s sin daño; cd s entre usos
  // Sus precios están en SHOP.decoy, SHOP.repair y HEAVY_UP.fire.
  plans: {
    decoy: { lure: 8, radius: 520 },
    fire: { dmg: 0.8, burn: 2.5 },
    repair: { charges: 3, heal: 0.25, quiet: 5, cd: 20, range: 240 },
  },
};
// Qué plano da cada operación.
export const OP_PLAN: Record<string, string> = { convoy: 'decoy', nest: 'fire', supply: 'repair' };
