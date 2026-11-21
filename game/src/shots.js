// The screenshot scenes behind ?shot=start|chase|street|combat. Each one
// plays the real rules forward from a fresh world for a fixed number of
// steps, steered by a simple autopilot (drive the road, walk the plaza,
// shoot the nearest gunman), so the frame is what real play looks like and
// the same seed always gives the same frame.
import { STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { startMission } from './missions.js';

const IDLE = { move: { x: 0, y: 0 }, sprint: false, actions: 0, aim: { x: 0, y: 0, seen: false }, shoot: false };

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function driveEast(state) {
  const p = state.player;
  const targetX = 2200;
  const targetY = 800;
  const desired = Math.atan2(targetY - p.y, targetX - p.x);
  let diff = desired - p.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return { move: { x: clamp(diff * 2, -1, 1), y: -1 }, sprint: false, actions: 0, aim: { x: 0, y: 0, seen: false }, shoot: false };
}

function walkPlaza(state) {
  // Stroll east along the plaza road so traffic and pedestrians pass by.
  return { move: { x: 1, y: 0 }, sprint: false, actions: 0, aim: { x: 0, y: 0, seen: false }, shoot: false };
}

function shootNearest(state) {
  let best = null;
  let bestDist = 99999;
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    const dx = enemy.x - state.player.x;
    const dy = enemy.y - state.player.y;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      best = enemy;
    }
  }
  const aim = best ? { x: best.x, y: best.y, seen: true } : { x: 0, y: 0, seen: false };
  return { move: { x: 0, y: 0 }, sprint: false, actions: 0, aim, shoot: !!best };
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * start: the title screen over a living city. chase: a three-star pursuit
 * in a stolen car. street: on foot at the plaza mid-courier-run. combat:
 * the dockside shootout.
 */
export function stageShot(name, world) {
  const state = world.state;
  if (name === 'chase') {
    world.reset(null);
    startMission(state, 2);
    const car = state.cars.find((c) => c.kind === 'traffic') || state.cars[0];
    state.player.car = car;
    car.kind = 'player';
    car.x = 900;
    car.y = 1200;
    car.angle = 0;
    car.speed = 300;
    state.player.x = car.x;
    state.player.y = car.y;
    state.player.angle = 0;
    for (let i = 0; i < 4 / STEP; i += 1) world.step(STEP, driveEast(state));
    return { screen: SCREEN_PLAY };
  }
  if (name === 'street') {
    world.reset(null);
    startMission(state, 1);
    state.player.x = state.city.plaza.x - 120;
    state.player.y = state.city.plaza.y;
    for (let i = 0; i < 4 / STEP; i += 1) world.step(STEP, walkPlaza(state));
    return { screen: SCREEN_PLAY };
  }
  if (name === 'combat') {
    world.reset(null);
    startMission(state, 3);
    state.player.x = state.city.docks.x - 160;
    state.player.y = state.city.docks.y + 200;
    state.wanted = 2;
    for (let i = 0; i < 5 / STEP; i += 1) world.step(STEP, shootNearest(state));
    return { screen: SCREEN_PLAY };
  }
  world.reset(null);
  for (let i = 0; i < 5 / STEP; i += 1) world.step(STEP, IDLE);
  return { screen: SCREEN_TITLE };
}
