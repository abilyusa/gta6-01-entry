// The city of Solmar: a street grid, the blocks between the streets filled
// with buildings, parks and trees, a beach and sea along the south edge,
// docks on the east edge, and the named places the story uses — the plaza,
// the hideout, the Tune-Up garage, the Solmar Bank and the hospital. This
// file only builds the map and answers collision questions; it never draws.
import { PALETTE, STREET, WORLD } from './config.js';

export function streetLines(axis) {
  const lines = [];
  for (let c = STREET.spacing; c < WORLD.width; c += STREET.spacing) lines.push(c);
  return axis === 'x' ? lines : lines.filter((c) => c < WORLD.height);
}

function onStreetCoord(value) {
  for (const c of streetLines('x')) if (Math.abs(value - c) <= STREET.halfWidth) return true;
  return false;
}

/** True when the point is on any street (a vertical or a horizontal one). */
export function isOnStreet(x, y) {
  return onStreetCoord(x) || onStreetCoord(y);
}

/** Push a circle out of every building it overlaps; edits in place. */
export function pushOutOfBuildings(body, buildings) {
  for (const b of buildings) {
    const nx = Math.max(b.x, Math.min(body.x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(body.y, b.y + b.h));
    const dx = body.x - nx;
    const dy = body.y - ny;
    const distSq = dx * dx + dy * dy;
    if (distSq >= body.radius * body.radius) continue;
    if (distSq === 0) {
      body.y = b.y - body.radius;
      continue;
    }
    const dist = Math.sqrt(distSq);
    body.x = nx + (dx / dist) * body.radius;
    body.y = ny + (dy / dist) * body.radius;
  }
}

/** True when the circle overlaps any building. */
export function touchesBuilding(x, y, radius, buildings) {
  for (const b of buildings) {
    const nx = Math.max(b.x, Math.min(x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - nx;
    const dy = y - ny;
    if (dx * dx + dy * dy < radius * radius) return true;
  }
  return false;
}

export function buildCity(random) {
  const buildings = [];
  const trees = [];
  const parks = [];
  const vStreets = streetLines('x');
  const hStreets = streetLines('y');

  // One block per cell of the grid; the south strip is beach, the east strip docks.
  for (let gx = 0; gx < vStreets.length + 1; gx += 1) {
    for (let gy = 0; gy < hStreets.length + 1; gy += 1) {
      const x0 = (gx === 0 ? 0 : vStreets[gx - 1] + STREET.halfWidth) + 14;
      const x1 = (gx === vStreets.length ? WORLD.width : vStreets[gx] - STREET.halfWidth) - 14;
      const y0 = (gy === 0 ? 0 : hStreets[gy - 1] + STREET.halfWidth) + 14;
      const y1 = (gy === hStreets.length ? WORLD.height : hStreets[gy] - STREET.halfWidth) - 14;
      if (y0 > 2080) continue; // beach strip, no buildings
      if (x0 > 2960 && y0 > 1500) continue; // docks strip
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      const roll = random();
      if (roll < 0.18) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        const count = 4 + Math.floor(random() * 5);
        for (let i = 0; i < count; i += 1) {
          trees.push({ x: x0 + 20 + random() * (x1 - x0 - 40), y: y0 + 20 + random() * (y1 - y0 - 40) });
        }
        continue;
      }
      const cols = x1 - x0 > 220 ? 2 : 1;
      const rows = y1 - y0 > 220 ? 2 : 1;
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          const bw = (x1 - x0) / cols - 24;
          const bh = (y1 - y0) / rows - 24;
          buildings.push({
            x: x0 + cx * ((x1 - x0) / cols) + 8,
            y: y0 + cy * ((y1 - y0) / rows) + 8,
            w: bw,
            h: bh,
            color: PALETTE.roofs[Math.floor(random() * PALETTE.roofs.length)],
          });
        }
      }
      if (random() < 0.5) {
        trees.push({ x: x0 + 12 + random() * (x1 - x0 - 24), y: y0 + 12 + random() * (y1 - y0 - 24) });
      }
    }
  }

  // Named places, all on streets so the player can reach them.
  return {
    buildings,
    trees,
    parks,
    vStreets,
    hStreets,
    beachY: 2160,
    seaY: 2290,
    plaza: { x: 1200, y: 1200 },
    hideout: { x: 620, y: 620 },
    garage: { x: 1000, y: 1000, w: 150, h: 110 },
    bank: { x: 2000, y: 800 },
    hospital: { x: 2400, y: 1600 },
    docks: { x: 2960, y: 1560, w: 240, h: 480 },
  };
}
