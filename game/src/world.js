// The simulation: one state, one fixed step. The player walks or drives,
// steals cars, shoots, gets chased, runs missions, gets busted or wasted,
// and the camera follows. Subsystems (traffic, police, combat, missions)
// each own their rules; this file wires them together and owns collisions,
// entering and leaving cars, and the bust/waste consequences.
import { CAR, COPS, CROWD, HEAT, PALETTE, PLAYER, STEP, TRAFFIC, VIEW, WORLD } from './config.js';
import { buildCity, pushOutOfBuildings } from './city.js';
import { makePed, makeTrafficCar, stepPed, stepTrafficCar } from './traffic.js';
import { addHeat, stepPolice } from './police.js';
import { fireBullet, makePickup, stepBullets, stepEnemies, stepPickups } from './combat.js';
import { garageCheck, startMission, stepMissions } from './missions.js';

export const EVENT_BUSTED = 1;
export const EVENT_WASTED = 2;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function createWorld(random) {
  const city = buildCity(random);
  const state = {
    city,
    random,
    player: {
      x: city.hideout.x, y: city.hideout.y, angle: -Math.PI / 2, radius: PLAYER.radius,
      health: PLAYER.health, money: 0, car: null, invuln: 0, shootCooldown: 0,
    },
    cars: [],
    peds: [],
    enemies: [],
    bullets: [],
    pickups: [],
    wanted: 0,
    heatTimer: 0,
    bust: 0,
    mission: null,
    nextMission: 0,
    storyDone: false,
    marker: null,
    banner: '',
    bannerTimer: 0,
    briefing: '',
    briefingTimer: 0,
    camera: { x: 0, y: 0 },
    elapsed: 0,
    events: {},
    stats: { carsStolen: 0 },
    saveDirty: false,
  };

  function reset(save) {
    const p = state.player;
    p.x = city.hideout.x;
    p.y = city.hideout.y;
    p.angle = -Math.PI / 2;
    p.health = PLAYER.health;
    p.money = save ? save.money : 0;
    p.car = null;
    p.invuln = 0;
    p.shootCooldown = 0;
    state.cars = [];
    state.peds = [];
    state.enemies = [];
    state.bullets = [];
    state.pickups = [];
    state.wanted = 0;
    state.heatTimer = 0;
    state.bust = 0;
    state.storyDone = save ? !!save.storyDone : false;
    state.nextMission = save ? save.missionIndex : 0;
    state.stats.carsStolen = save ? save.carsStolen || 0 : 0;
    state.elapsed = 0;
    state.events = {};
    state.marker = null;
    state.banner = 'Welcome to Solmar';
    state.bannerTimer = 0;
    state.briefing = '';
    state.briefingTimer = 0;
    for (let i = 0; i < TRAFFIC.cars; i += 1) state.cars.push(makeTrafficCar(random, city));
    for (let i = 0; i < CROWD.peds; i += 1) state.peds.push(makePed(random, city));
    // Parked cars the player can take, scattered near streets.
    for (let i = 0; i < 5; i += 1) {
      const spot = makeTrafficCar(random, city);
      spot.kind = 'parked';
      spot.speed = 0;
      spot.targetSpeed = 0;
      state.cars.push(spot);
    }
    state.pickups.push(makePickup(city.hospital.x, city.hospital.y + 40, 'health'));
    state.pickups.push(makePickup(city.plaza.x - 80, city.plaza.y + 80, 'health'));
    state.pickups.push(makePickup(city.docks.x + 120, city.docks.y + 240, 'health'));
    if (!state.storyDone) startMission(state, state.nextMission);
    updateCamera();
  }

  function updateCamera() {
    const p = state.player;
    state.camera.x = clamp(p.x - VIEW.width / 2, 0, WORLD.width - VIEW.width);
    state.camera.y = clamp(p.y - VIEW.height / 2, 0, WORLD.height - VIEW.height);
  }

  function nearestCar(maxDist) {
    const p = state.player;
    let best = null;
    let bestDist = maxDist;
    for (const car of state.cars) {
      if (car.disabled) continue;
      const dx = car.x - p.x;
      const dy = car.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist) {
        bestDist = dist;
        best = car;
      }
    }
    return best;
  }

  function enterCar(car) {
    const p = state.player;
    p.car = car;
    p.x = car.x;
    p.y = car.y;
    if (car.kind === 'traffic' || car.kind === 'police') {
      addHeat(state, HEAT.steal);
      state.stats.carsStolen += 1;
      state.events.steal = true;
    }
    car.kind = 'player';
    car.targetSpeed = 0;
  }

  function exitCar() {
    const p = state.player;
    const car = p.car;
    if (!car) return;
    car.speed = 0;
    car.kind = 'parked';
    p.car = null;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    p.angle = car.angle;
    pushOutOfBuildings(p, city.buildings);
  }

  function stepPlayer(dt, controls) {
    const p = state.player;
    const actions = controls.actions;
    p.shootCooldown = Math.max(0, p.shootCooldown - dt);
    if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);

    if (actions.enter) {
      if (p.car) exitCar();
      else {
        const car = nearestCar(PLAYER.grabRadius);
        if (car) enterCar(car);
      }
    }

    if (p.car) {
      const car = p.car;
      const move = controls.move;
      if (move.y < 0) car.speed += CAR.accel * dt;
      else if (move.y > 0) {
        car.speed -= (car.speed > 10 ? CAR.brake : CAR.accel * 0.6) * dt;
      } else {
        car.speed -= car.speed * CAR.drag * dt;
      }
      car.speed = clamp(car.speed, -CAR.reverseTop, car.armored ? 470 : CAR.topSpeed);
      if (Math.abs(car.speed) < 4 && move.y === 0) car.speed = 0;
      const turnFactor = clamp(car.speed / 160, -1, 1);
      car.angle += move.x * CAR.steer * turnFactor * dt;
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      car.x = clamp(car.x, 40, WORLD.width - 40);
      car.y = clamp(car.y, 40, city.seaY - 14);
      pushOutOfBuildings(car, city.buildings);
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      // Running over pedestrians.
      for (const ped of state.peds) {
        if (!ped.alive) continue;
        const dx = ped.x - p.x;
        const dy = ped.y - p.y;
        if (dx * dx + dy * dy < 26 * 26 && Math.abs(car.speed) > 90) {
          ped.alive = false;
          addHeat(state, HEAT.runOver);
        }
      }
    } else {
      const move = controls.move;
      const length = Math.sqrt(move.x * move.x + move.y * move.y);
      const speed = controls.sprint ? PLAYER.sprint : PLAYER.walk;
      if (length > 0) {
        p.x += (move.x / length) * speed * dt;
        p.y += (move.y / length) * speed * dt;
        if (!controls.aim.seen) p.angle = Math.atan2(move.y, move.x);
      }
      if (controls.aim.seen) {
        p.angle = Math.atan2(controls.aim.y - p.y, controls.aim.x - p.x);
      }
      p.x = clamp(p.x, 20, WORLD.width - 20);
      p.y = clamp(p.y, 20, city.seaY - 12);
      pushOutOfBuildings(p, city.buildings);
      // Traffic can hit a player on foot.
      for (const car of state.cars) {
        if (car.kind !== 'traffic' || car.speed < 40 || p.invuln > 0) continue;
        const dx = car.x - p.x;
        const dy = car.y - p.y;
        if (dx * dx + dy * dy < 26 * 26) {
          p.health -= 12;
          p.invuln = 1;
          p.x += (dx === 0 ? 0 : -dx / Math.abs(dx)) * 10;
          state.events.hit = true;
        }
      }
      // Shooting: click (or Space on the keyboard) fires toward the aim.
      if (controls.shoot && p.shootCooldown <= 0) {
        p.shootCooldown = 0.28;
        let angle = p.angle;
        if (!controls.aim.seen) {
          let best = null;
          let bestDist = 520;
          for (const enemy of state.enemies) {
            if (!enemy.alive) continue;
            const dx = enemy.x - p.x;
            const dy = enemy.y - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < bestDist) {
              bestDist = dist;
              best = enemy;
            }
          }
          if (best) angle = Math.atan2(best.y - p.y, best.x - p.x);
        }
        fireBullet(state, 'player', p.x, p.y, angle, false);
        state.events.shoot = true;
        if (state.wanted < 1) addHeat(state, HEAT.shoot);
        else state.heatTimer = 0;
      }
    }
  }

  function stepCars(dt) {
    for (const car of state.cars) {
      if (car.kind === 'traffic') stepTrafficCar(car, state.cars, city, dt, random);
    }
    // Car-to-car shoves: separate overlapping cars and bleed their speed.
    const cars = state.cars;
    for (let i = 0; i < cars.length; i += 1) {
      for (let j = i + 1; j < cars.length; j += 1) {
        const a = cars[i];
        const b = cars[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distSq = dx * dx + dy * dy;
        if (distSq >= 40 * 40 || distSq === 0) continue;
        const dist = Math.sqrt(distSq);
        const push = (40 - dist) / 2;
        const nx = dx / dist;
        const ny = dy / dist;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        if (a.kind !== 'player') a.speed *= 0.85;
        if (b.kind !== 'player') b.speed *= 0.85;
      }
    }
  }

  function topUpCrowd() {
    let traffic = 0;
    for (const car of state.cars) if (car.kind === 'traffic') traffic += 1;
    if (traffic < 10) state.cars.push(makeTrafficCar(random, city));
    let alive = 0;
    for (const ped of state.peds) if (ped.alive) alive += 1;
    if (alive < 18) state.peds.push(makePed(random, city));
  }

  function respawn(kind) {
    const p = state.player;
    if (kind === 'busted') {
      p.money = Math.max(0, p.money - 150);
      state.banner = 'BUSTED — the Solmar PD took $150 and your freedom for a night.';
    } else {
      p.money = Math.max(0, p.money - 100);
      state.banner = 'WASTED — the hospital patched you up for $100.';
    }
    state.bannerTimer = 5;
    p.health = PLAYER.health;
    p.car = null;
    p.x = kind === 'busted' ? city.hideout.x : city.hospital.x;
    p.y = kind === 'busted' ? city.hideout.y : city.hospital.y;
    p.invuln = 2;
    state.wanted = 0;
    state.bust = 0;
    state.bullets = [];
    state.cars = state.cars.filter((c) => c.kind !== 'police');
    state.saveDirty = true;
    // Restart the current mission from its first stage.
    if (state.mission) {
      const index = state.mission.index;
      state.enemies = [];
      state.cars = state.cars.filter((c) => !c.missionCar);
      state.mission = null;
      state.marker = null;
      startMission(state, index);
    }
    updateCamera();
  }

  /**
   * One fixed step. `controls` carries the movement vector, sprint flag,
   * one-shot action flags and the mouse aim in world coordinates. Returns
   * EVENT_BUSTED / EVENT_WASTED flags for the caller to react to.
   */
  function step(dt, controls) {
    let events = 0;
    state.events = {};
    state.elapsed += dt;
    if (state.briefingTimer > 0) state.briefingTimer -= dt;
    if (state.bannerTimer > 0) {
      state.bannerTimer -= dt;
      if (state.bannerTimer <= 0) state.banner = '';
    }

    stepPlayer(dt, controls);
    stepCars(dt);
    const danger = { x: state.player.x, y: state.player.y, active: state.wanted > 0 || state.events.shoot };
    for (const ped of state.peds) stepPed(ped, danger, dt, random, city);
    stepPolice(state, dt, random);
    stepBullets(state, dt);
    stepEnemies(state, dt);
    stepPickups(state);
    stepMissions(state, dt);
    const garageMessage = garageCheck(state);
    if (garageMessage) state.banner = garageMessage;
    if (state.events.killedPed) addHeat(state, HEAT.runOver);
    topUpCrowd();
    updateCamera();

    if (state.bust >= COPS.bustTime) {
      respawn('busted');
      events |= EVENT_BUSTED;
    } else if (state.player.health <= 0) {
      respawn('wasted');
      events |= EVENT_WASTED;
    }
    // Free roam: walking up to the hideout starts the next job.
    if (!state.mission && !state.storyDone) {
      const dx = state.player.x - city.hideout.x;
      const dy = state.player.y - city.hideout.y;
      if (dx * dx + dy * dy < 90 * 90 && state.nextMission < 5) startMission(state, state.nextMission);
    }
    return events;
  }

  reset(null);
  return { state, reset, step };
}

export { PALETTE };
