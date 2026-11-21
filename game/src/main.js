// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between three screens:
// title, play and paused. Progress saves after every job and at the garage.
//
// ?seed=N fixes the city's layout. ?shot=start|chase|street|combat (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.
import { STEP, VIEW } from './config.js';
import { makeRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_WASTED } from './world.js';
import { ACT_CONFIRM, ACT_ENTER, ACT_MUTE, ACT_PAUSE, ACT_SHOOT, makeInput } from './input.js';
import { makeAudio } from './audio.js';
import { createRenderer, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';
import { clearSave, loadGame, saveGame } from './save.js';

/** The longest frame the loop catches up on; a longer stall is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(makeRandom(seed));
const renderer = createRenderer(canvas);
const audio = makeAudio();

function runShot(name) {
  const scene = stageShot(name, world);
  const ui = { time: 3, muted: false, save: null, nearCar: false, inGarage: false };
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, ui);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = makeInput(canvas);
  const save = loadGame();
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let time = 0;
  let newGame = false;

  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyN' && screen === SCREEN_TITLE) newGame = true;
    audio.unlock();
  });
  canvas.addEventListener('pointerdown', () => audio.unlock());

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    if (newGame) {
      clearSave();
      world.reset(null);
    } else if (save) {
      world.reset(save);
    } else {
      world.reset(null);
    }
    newGame = false;
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Follow the yellow marker.');
  }

  function mouseWorld() {
    const mouse = input.mouse();
    const rect = canvas.getBoundingClientRect();
    const scaleX = VIEW.width / Math.max(1, rect.width);
    const scaleY = VIEW.height / Math.max(1, rect.height);
    return {
      x: world.state.camera.x + mouse.x * scaleX,
      y: world.state.camera.y + mouse.y * scaleY,
      seen: mouse.seen,
    };
  }

  function nearCar() {
    const p = world.state.player;
    if (p.car) return false;
    for (const car of world.state.cars) {
      if (car.disabled) continue;
      const dx = car.x - p.x;
      const dy = car.y - p.y;
      if (dx * dx + dy * dy < 70 * 70) return true;
    }
    return false;
  }

  function inGarage() {
    const p = world.state.player;
    const g = world.state.city.garage;
    return p.x >= g.x && p.x <= g.x + g.w && p.y >= g.y && p.y <= g.y + g.h;
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACT_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACT_CONFIRM && screen === SCREEN_TITLE) startGame();
    else if (actions & ACT_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      if (world.state.saveDirty) saveGame(world.state);
      announce('Paused.');
    } else if (actions & (ACT_PAUSE | ACT_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    return actions;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    time += dt;
    const wasPlaying = screen === SCREEN_PLAY;
    const actions = handleActions();
    if (screen === SCREEN_TITLE) {
      // The city lives behind the title: traffic and pedestrians move.
      world.step(STEP, { move: { x: 0, y: 0 }, sprint: false, actions: 0, aim: { x: 0, y: 0, seen: false }, shoot: false });
    } else if (screen === SCREEN_PLAY) {
      accumulator += dt;
      let stepActions = actions & ACT_ENTER;
      while (accumulator >= STEP) {
        const shoot = wasPlaying && !!(actions & (ACT_SHOOT | ACT_CONFIRM)) && !world.state.player.car;
        const events = world.step(STEP, {
          move: input.move(),
          sprint: input.sprint(),
          actions: stepActions,
          aim: mouseWorld(),
          shoot,
        });
        stepActions = 0;
        const ev = world.state.events;
        if (ev.shoot) audio.shot();
        if (ev.enemyShot) audio.enemyShot();
        if (ev.pickup) audio.pickup();
        if (ev.missionDone) audio.mission();
        if (ev.hit) audio.hit();
        if (events & EVENT_BUSTED) {
          audio.busted();
          announce('Busted. You lost $150.');
        }
        if (events & EVENT_WASTED) {
          audio.busted();
          announce('Wasted. The hospital patched you up for $100.');
        }
        accumulator -= STEP;
      }
      const p = world.state.player;
      audio.engine(p.car ? p.car.speed : 0, !!p.car);
      audio.siren(world.state.wanted > 0, dt);
      if (world.state.saveDirty) saveGame(world.state);
    } else {
      accumulator = 0;
      audio.engine(0, false);
      audio.siren(false, dt);
    }
    renderer.draw(world.state, screen, {
      time,
      muted: audio.isMuted(),
      save,
      nearCar: screen === SCREEN_PLAY && nearCar(),
      inGarage: screen === SCREEN_PLAY && inGarage(),
    });
  }

  // Leaving the tab pauses a running game rather than letting the cops close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      if (world.state.saveDirty) saveGame(world.state);
      announce('Paused.');
    }
  });

  announce('Solmar. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
