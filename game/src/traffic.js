// Traffic and pedestrians: the city alive around the player. Traffic cars
// drive their lane along a street, turn at intersections, and slow for the
// car ahead. Pedestrians stroll the sidewalks and run from gunfire, sirens
// and speeding cars. This file knows nothing about missions or the HUD.
import { CAR, CROWD, PALETTE, STREET, TRAFFIC, WORLD } from './config.js';
import { isOnStreet, touchesBuilding } from './city.js';

function pick(random, list) {
  return list[Math.floor(random() * list.length)];
}

function randomStreetSpot(random, city) {
  const vertical = random() < 0.5;
  if (vertical) {
    const cx = city.vStreets[Math.floor(random() * city.vStreets.length)];
    return { x: cx + (random() < 0.5 ? -STREET.lane : STREET.lane), y: 60 + random() * (WORLD.height - 320), axis: 'v', dir: random() < 0.5 ? 1 : -1 };
  }
  const cy = city.hStreets[Math.floor(random() * city.hStreets.length)];
  return { x: 60 + random() * (WORLD.width - 120), y: cy + (random() < 0.5 ? -STREET.lane : STREET.lane), axis: 'h', dir: random() < 0.5 ? 1 : -1 };
}

export function makeTrafficCar(random, city, near) {
  const spot = near || randomStreetSpot(random, city);
  const angle = spot.axis === 'v' ? (spot.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (spot.dir > 0 ? 0 : Math.PI);
  return {
    kind: 'traffic',
    x: spot.x,
    y: spot.y,
    angle,
    radius: CAR.radius,
    speed: TRAFFIC.slow + random() * (TRAFFIC.fast - TRAFFIC.slow),
    targetSpeed: TRAFFIC.slow + random() * (TRAFFIC.fast - TRAFFIC.slow),
    color: pick(random, PALETTE.cars),
    axis: spot.axis,
    dir: spot.dir,
    health: 100,
    disabled: false,
    honk: 0,
  };
}

export function makePed(random, city) {
  // Sidewalk: just off a street, inside a block edge.
  const cx = city.vStreets[Math.floor(random() * city.vStreets.length)];
  const cy = city.hStreets[Math.floor(random() * city.hStreets.length)];
  const onVertical = random() < 0.5;
  const x = onVertical ? cx + STREET.halfWidth + 14 + random() * 30 : 80 + random() * (WORLD.width - 160);
  const y = onVertical ? 80 + random() * (WORLD.height - 360) : cy + STREET.halfWidth + 14 + random() * 30;
  return {
    x, y,
    angle: random() * Math.PI * 2,
    speed: CROWD.stroll * (0.7 + random() * 0.6),
    color: pick(random, PALETTE.peds),
    state: 'walk',
    wander: 0,
    alive: true,
  };
}

function carAhead(car, cars) {
  const aheadX = car.x + Math.cos(car.angle) * 70;
  const aheadY = car.y + Math.sin(car.angle) * 70;
  for (const other of cars) {
    if (other === car || other.kind === 'parked') continue;
    const dx = other.x - aheadX;
    const dy = other.y - aheadY;
    if (dx * dx + dy * dy < 55 * 55) return true;
  }
  return false;
}

function atCrossing(car, city) {
  const nearV = city.vStreets.some((cx) => Math.abs(car.x - cx) < 34);
  const nearH = city.hStreets.some((cy) => Math.abs(car.y - cy) < 34);
  return nearV && nearH;
}

/** One traffic step: lane driving, intersection turns, slowing for traffic. */
export function stepTrafficCar(car, cars, city, dt, random) {
  if (car.disabled) {
    car.speed = Math.max(0, car.speed - 300 * dt);
  } else if (carAhead(car, cars)) {
    car.speed = Math.max(0, car.speed - 500 * dt);
  } else {
    car.speed += (car.targetSpeed - car.speed) * Math.min(1, dt * 1.5);
  }
  // Turn at an intersection: keep going, or turn onto the crossing street.
  if (!car.disabled && atCrossing(car, city) && random() < dt * 1.2) {
    if (car.axis === 'v' && random() < 0.5) {
      car.axis = 'h';
      car.dir = random() < 0.5 ? 1 : -1;
      car.angle = car.dir > 0 ? 0 : Math.PI;
      car.y = city.hStreets.reduce((best, cy) => (Math.abs(cy - car.y) < Math.abs(best - car.y) ? cy : best), city.hStreets[0]) + (random() < 0.5 ? -STREET.lane : STREET.lane);
    } else if (car.axis === 'h' && random() < 0.5) {
      car.axis = 'v';
      car.dir = random() < 0.5 ? 1 : -1;
      car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      car.x = city.vStreets.reduce((best, cx) => (Math.abs(cx - car.x) < Math.abs(best - car.x) ? cx : best), city.vStreets[0]) + (random() < 0.5 ? -STREET.lane : STREET.lane);
    }
  }
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  // Wrap around the far edge so traffic never runs out.
  if (car.x < -60) car.x = WORLD.width + 40;
  if (car.x > WORLD.width + 60) car.x = -40;
  if (car.y < -60) car.y = WORLD.height - 200;
  if (car.y > WORLD.height - 120) car.y = -40;
}

/** One pedestrian step: stroll, wander, or flee from danger. */
export function stepPed(ped, danger, dt, random, city) {
  if (!ped.alive) return;
  const dx = ped.x - danger.x;
  const dy = ped.y - danger.y;
  const distSq = dx * dx + dy * dy;
  if (danger.active && distSq < 260 * 260) {
    ped.state = 'flee';
    ped.angle = Math.atan2(dy, dx);
    ped.x += Math.cos(ped.angle) * CROWD.run * dt;
    ped.y += Math.sin(ped.angle) * CROWD.run * dt;
  } else {
    if (ped.state === 'flee' && distSq > 420 * 420) ped.state = 'walk';
    ped.wander -= dt;
    if (ped.wander <= 0) {
      ped.wander = 2 + random() * 3;
      ped.angle += (random() - 0.5) * 2.2;
    }
    ped.x += Math.cos(ped.angle) * ped.speed * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * dt;
  }
  ped.x = Math.max(30, Math.min(WORLD.width - 30, ped.x));
  ped.y = Math.max(30, Math.min(WORLD.height - 90, ped.y));
  if (touchesBuilding(ped.x, ped.y, 10, city.buildings)) {
    ped.angle += Math.PI / 2;
    ped.x = Math.max(30, Math.min(WORLD.width - 30, ped.x - Math.cos(ped.angle) * 20));
    ped.y = Math.max(30, Math.min(WORLD.height - 90, ped.y - Math.sin(ped.angle) * 20));
  }
}

export { isOnStreet, CAR };
