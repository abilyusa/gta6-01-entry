// Missions and the story: five jobs for Rosa Marín, each with stages, a map
// marker, a timer where the job needs one, and a payout. This file decides
// when a stage is done and what the next objective is; the world only asks it
// for the current marker and briefing. Free roam runs when no mission is
// active, and finishing the fifth mission ends the story.
import { CAR, GARAGE, MISSIONS, STORY_DONE } from './config.js';
import { addHeat } from './police.js';
import { makeGunman, makePickup } from './combat.js';

function courierDrops(city) {
  return [
    { x: 2000, y: 400, label: 'Drop 1/3' },
    { x: 800, y: 2000, label: 'Drop 2/3' },
    { x: 2800, y: 1200, label: 'Drop 3/3' },
  ];
}

function dockGunmen(city) {
  return [
    { x: city.docks.x + 40, y: city.docks.y + 60 },
    { x: city.docks.x + 160, y: city.docks.y + 120 },
    { x: city.docks.x + 70, y: city.docks.y + 300 },
    { x: city.docks.x + 190, y: city.docks.y + 380 },
  ];
}

/** Start a mission fresh: place its vehicles, gunmen and first marker. */
export function startMission(state, index) {
  const def = MISSIONS[index];
  const city = state.city;
  const m = { index, stage: 0, timer: 0, drops: 0, van: null };
  state.mission = m;
  state.banner = def.title;
  state.bannerTimer = 3.5;
  state.briefing = def.briefing;
  state.briefingTimer = 7;
  state.marker = null;
  if (index === 0) {
    // A red sedan waits by the plaza, engine running.
    const car = {
      kind: 'parked', x: city.plaza.x + 60, y: city.plaza.y, angle: 0, radius: CAR.radius,
      speed: 0, targetSpeed: 0, color: '#dd5240', health: 100, disabled: false, missionCar: true,
    };
    state.cars.push(car);
    state.marker = { x: car.x, y: car.y, label: 'Steal the sedan' };
  } else if (index === 1) {
    m.timer = 75;
    m.dropsList = courierDrops(city);
    state.marker = { ...m.dropsList[0] };
  } else if (index === 2) {
    addHeat(state, 3);
    state.marker = null;
  } else if (index === 3) {
    for (const spot of dockGunmen(city)) state.enemies.push(makeGunman(spot.x, spot.y));
    state.marker = { x: city.docks.x + 120, y: city.docks.y + 200, label: 'The docks' };
  } else if (index === 4) {
    const van = {
      kind: 'parked', x: city.bank.x + 90, y: city.bank.y, angle: 0, radius: CAR.radius,
      speed: 0, targetSpeed: 0, color: '#3f4a56', health: 200, disabled: false, armored: true, missionCar: true,
    };
    state.cars.push(van);
    m.van = van;
    state.marker = { x: van.x, y: van.y, label: 'Steal the armored van' };
  }
}

function finishMission(state) {
  const def = MISSIONS[state.mission.index];
  state.player.money += def.reward;
  state.nextMission = Math.min(5, state.mission.index + 1);
  state.banner = `${def.title} — complete! +$${def.reward}`;
  state.bannerTimer = 5;
  state.briefing = '';
  state.briefingTimer = 0;
  state.events.missionDone = true;
  state.mission = null;
  state.marker = null;
  state.saveDirty = true;
  if (def.id === 'score') {
    state.storyDone = true;
    state.banner = 'The Solmar Score — complete! +$2000';
    state.briefing = STORY_DONE;
    state.briefingTimer = 9;
  }
}

/** The current objective line for the HUD. */
export function objectiveText(state) {
  if (state.storyDone && !state.mission) return 'Story complete — free roam. Keep driving, Dario.';
  if (!state.mission) return 'Free roam — find your next job. (Missions resume at the hideout.)';
  const def = MISSIONS[state.mission.index];
  if (state.mission.index === 1) return `Deliver the packages — ${state.mission.drops}/3 done`;
  if (state.mission.index === 2) return 'Lose the cops — wanted level to zero';
  if (state.mission.index === 3) {
    const left = state.enemies.filter((e) => e.alive).length;
    return `Take down the gunmen — ${left} left`;
  }
  if (state.mission.index === 4) return state.mission.stage === 0 ? 'Steal the armored van' : 'Deliver the van to the hideout';
  return def.objective;
}

/** Advance the active mission one step; called every frame from the world. */
export function stepMissions(state, dt) {
  const m = state.mission;
  if (!m) return;
  const player = state.player;
  const city = state.city;

  if (m.index === 0) {
    if (player.car) finishMission(state);
  } else if (m.index === 1) {
    m.timer -= dt;
    if (m.timer <= 0) {
      // Out of time: the job fails, Rosa lets the player try again.
      state.banner = 'Courier — too slow. Rosa gives you another shot.';
      state.mission = null;
      state.marker = null;
      startMission(state, 1);
      return;
    }
    const drop = m.dropsList[m.drops];
    if (drop) {
      const dx = player.x - drop.x;
      const dy = player.y - drop.y;
      if (dx * dx + dy * dy < 70 * 70) {
        m.drops += 1;
        state.events.pickup = true;
        if (m.drops >= m.dropsList.length) finishMission(state);
        else state.marker = { ...m.dropsList[m.drops] };
      }
    }
  } else if (m.index === 2) {
    if (state.wanted === 0) finishMission(state);
  } else if (m.index === 3) {
    if (state.enemies.length > 0 && state.enemies.every((e) => !e.alive)) finishMission(state);
  } else if (m.index === 4) {
    if (m.stage === 0 && player.car === m.van) {
      m.stage = 1;
      addHeat(state, 4);
      state.marker = { x: city.hideout.x, y: city.hideout.y, label: 'Hideout' };
      state.banner = 'The van is yours — now lose the cops and bring it home!';
    } else if (m.stage === 1) {
      const dx = player.x - city.hideout.x;
      const dy = player.y - city.hideout.y;
      if (player.car === m.van && dx * dx + dy * dy < 110 * 110) finishMission(state);
    }
  }
}

/** The Tune-Up garage: drive in with a low wanted level and cash to repair
// the car and clear the heat. Returns a message when a repair happens. */
export function garageCheck(state) {
  const player = state.player;
  const g = state.city.garage;
  if (!player.car) return null;
  if (player.x < g.x || player.x > g.x + g.w || player.y < g.y || player.y > g.y + g.h) return null;
  if (state.wanted > GARAGE.maxHeat || player.money < GARAGE.price) return null;
  player.money -= GARAGE.price;
  player.car.health = 100;
  player.car.disabled = false;
  state.wanted = 0;
  state.events.pickup = true;
  state.saveDirty = true;
  state.bannerTimer = 3;
  return `Tune-Up: car repaired, heat cleared — $${GARAGE.price}`;
}

export { MISSIONS };
