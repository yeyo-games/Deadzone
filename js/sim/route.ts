// Ruta del modo Huida (etapa 2): un mapa de paradas en capas, como un árbol que se abre y se vuelve a
// cerrar en el puente. Sólo datos (con semilla, para que se pueda guardar y repetir); el dibujo está en
// render/route.js y la pantalla en ui/route.js. Cifras en ESCAPE_ROUTE y ESCAPE_STOPS (config.ts).
import { ESCAPE_ROUTE, ESCAPE_STOP_KINDS, ESCAPE_STOPS, EVENT_ORDER } from '../core/config.ts';
import { mulberry32 } from '../core/util.ts';

/** Una parada del mapa. x: su capa (0..1) · y: su lugar dentro de la capa (0..1) · next: ids de la siguiente. */
export interface RouteNode {
  id: number;
  layer: number;
  kind: string;
  /** ronda especial de la parada (clave de EVENTS) o '' */
  mod: string;
  name: string;
  x: number;
  y: number;
  next: number[];
}

export interface Route {
  seed: number;
  nodes: RouteNode[];
  layers: number;
}

/** Genera la ruta con esta semilla: siempre la misma para la misma semilla. */
export function makeRoute(seed: number): Route {
  const rng = mulberry32(seed);
  const pick = <T>(a: T[]) => a[Math.floor(rng() * a.length)];
  const R = ESCAPE_ROUTE;
  const nodes: RouteNode[] = [];
  const layers: RouteNode[][] = [];
  for (let l = 0; l < R.layers; l++) {
    const edge = l === 0 || l === R.layers - 1;
    const n = edge ? 1 : R.width[0] + Math.floor(rng() * (R.width[1] - R.width[0] + 1));
    const row: RouteNode[] = [];
    // tipos sin repetir dentro de la capa
    const kinds = [...ESCAPE_STOP_KINDS].sort(() => rng() - 0.5);
    for (let i = 0; i < n; i++) {
      const kind = l === 0 ? 'start' : l === R.layers - 1 ? 'bridge' : kinds[i % kinds.length];
      const def = ESCAPE_STOPS[kind];
      // la salida y el puente no traen ronda especial
      const mod = !edge && rng() < R.modChance ? pick(EVENT_ORDER) : '';
      const node: RouteNode = {
        id: nodes.length,
        layer: l,
        kind,
        mod,
        name: pick(def.names),
        x: l / (R.layers - 1),
        // repartidas a lo alto, con un poco de azar (sin salirse de su franja)
        y: n === 1 ? 0.5 : 0.12 + (0.76 * (i + 0.5 + (rng() - 0.5) * 0.3)) / n,
        next: [],
      };
      nodes.push(node);
      row.push(node);
    }
    layers.push(row);
  }
  // caminos: cada parada a la que le toca por su lugar en la capa y, a veces, a una vecina; ninguna queda
  // sin entrada (los caminos casi no se cruzan porque se unen por orden)
  for (let l = 0; l < R.layers - 1; l++) {
    const a = layers[l];
    const b = layers[l + 1];
    a.forEach((n, i) => {
      const j = a.length === 1 ? Math.floor(rng() * b.length) : Math.round((i * (b.length - 1)) / (a.length - 1));
      n.next.push(b[j].id);
      const k = j + (rng() < 0.5 ? -1 : 1);
      if (b.length > 1 && rng() < 0.55 && k >= 0 && k < b.length) n.next.push(b[k].id);
      // desde la salida se puede ir a todas las de la primera capa
      if (l === 0) n.next = b.map((x) => x.id);
    });
    for (const m of b) {
      if (a.some((n) => n.next.includes(m.id))) continue;
      // la más cercana de la capa anterior le abre camino
      let best = a[0];
      for (const n of a) if (Math.abs(n.y - m.y) < Math.abs(best.y - m.y)) best = n;
      best.next.push(m.id);
    }
    for (const n of a) n.next.sort((p, q) => nodes[p].y - nodes[q].y);
  }
  return { seed, nodes, layers: R.layers };
}

/** Paradas a las que se puede ir desde `at`. */
export const nextStops = (r: Route, at: number) => (r.nodes[at]?.next || []).map((id) => r.nodes[id]);

/** ¿Es la última parada (el puente)? */
export const isFinal = (r: Route, at: number) => r.nodes[at]?.layer === r.layers - 1;
