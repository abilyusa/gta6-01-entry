// The wanted level and the Solmar PD. Stars rise when the player steals,
// shoots or runs someone over, and fall after a quiet stretch out of sight.
// Police cars spawn at the edge of the view, chase the player, ram the
// player's car, and bust the player if they pin them down while slow.
import { CAR, COPS, HEAT, PALETTE, WORLD } from './config.js';
import { pushOutOfBuildings } from './city.js';

export function addHeat(state, amount) {
  state.wanted = Math.max(0, Math.min(HEAT.max, state.wanted + amount));
  if (amount > 0) state.heatTimer = 0;
}

export function makeCopCar(random, x, y) {
  return {
    kind: 'police',
    x,
    y,
    angle: 0,
    radius: CAR.radius,
    speed: 0,
    targetSpeed: COPS.topSpeed,
    color: PALETTE.cop,
    health: 100,
    disabled: false,
    sirenPhase: random() * Math.PI * 2,
  };
}

function spawnSpot(state, random) {
  const p = state.player;
  const angle = random() * Math.PI * 2;
  const dist = 700 + random() * 200;
  return {
    x: Math.max(60, Math.min(WORLD.width - 60, p.x + Math.cos(angle) * dist)),
    y: Math.max(60, Math.min(WORLD.height - 160, p.y + Math.sin(angle) * dist)),
  };
}

function copCount(wanted) {
  return Math.min(1 + wanted, 6);
}

function steerToward(car, targetAngle, dt) {
  let diff = targetAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const turn = Math.max(-1, Math.min(1, diff * 2.2));
  car.angle += turn * CAR.steer * 0.9 * dt * Math.min(1, 0.4 + Math.abs(car.speed) / 300);
}

/** One police step for every police car, plus wanted decay and the bust timer. */
export function stepPolice(state, dt, random) {
  const player = state.player;
  const playerSpeed = player.car ? Math.abs(player.car.speed) : 0;
  const px = player.x;
  const py = player.y;

  // Keep the right number of police cars on the road for the wanted level.
  const police = state.cars.filter((c) => c.kind === 'police');
  if (state.wanted > 0 && police.length < copCount(state.wanted)) {
    const spot = spawnSpot(state, random);
    const car = makeCopCar(random, spot.x, spot.y);
    car.angle = Math.atan2(py - spot.y, px - spot.x);
    state.cars.push(car);
  }
  if (state.wanted === 0) {
    // No wanted level: the police drive off and despawn at a distance.
    for (let i = state.cars.length - 1; i >= 0; i -= 1) {
      const car = state.cars[i];
      if (car.kind !== 'police') continue;
      const dx = car.x - px;
      const dy = car.y - py;
      if (dx * dx + dy * dy > 900 * 900) state.cars.splice(i, 1);
    }
  }

  let nearestCop = Infinity;
  for (const car of state.cars) {
    if (car.kind !== 'police' || car.disabled) continue;
    const dx = px - car.x;
    const dy = py - car.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    nearestCop = Math.min(nearestCop, dist);
    const targetAngle = Math.atan2(dy, dx);
    steerToward(car, targetAngle, dt);
    const want = dist > 120 ? car.targetSpeed : car.targetSpeed * 0.55;
    car.speed += (want - car.speed) * Math.min(1, dt * 1.2);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.x = Math.max(40, Math.min(WORLD.width - 40, car.x));
    car.y = Math.max(40, Math.min(WORLD.height - 100, car.y));
    pushOutOfBuildings(car, state.city.buildings);
    car.sirenPhase += dt * 6;
  }

  // Busted: a police car pins the player down while they are slow.
  if (state.wanted > 0 && nearestCop < 64 && playerSpeed < 60 && !player.car) {
    state.bust += dt;
  } else if (state.wanted > 0 && nearestCop < 70 && playerSpeed < 60 && player.car) {
    state.bust += dt * 0.6;
  } else {
    state.bust = Math.max(0, state.bust - dt * 2);
  }

  // Wanted decays after a quiet stretch with no police close by.
  if (state.wanted > 0 && nearestCop > 620) {
    state.heatTimer += dt;
    if (state.heatTimer >= HEAT.coolSeconds) {
      state.wanted -= 1;
      state.heatTimer = 0;
    }
  } else {
    state.heatTimer = 0;
  }
}
