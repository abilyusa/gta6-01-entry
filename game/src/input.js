// Keyboard and mouse input for Solmar. Held keys give a movement vector;
// one-shot presses (enter a car, pause, mute, confirm) are queued as bit
// flags and taken once by the loop, so a press between two frames is never
// lost and never counted twice. The mouse aims on foot and fires on click.
export const ACT_CONFIRM = 1;
export const ACT_PAUSE = 2;
export const ACT_ENTER = 4;
export const ACT_MUTE = 8;
export const ACT_SHOOT = 16;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const MUTE = new Set(['KeyM']);
const SPRINT = new Set(['ShiftLeft', 'ShiftRight']);

export function makeInput(target) {
  const held = new Set();
  let queued = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseSeen = false;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) held.add(event.code);
    else if (SPRINT.has(event.code)) held.add(event.code);
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) queued |= ACT_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) queued |= ACT_PAUSE;
    } else if (ENTER.has(event.code)) {
      if (!event.repeat) queued |= ACT_ENTER;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) queued |= ACT_MUTE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => held.clear());
  target.addEventListener('pointerdown', (event) => {
    queued |= ACT_CONFIRM;
    if (event.button === 0) queued |= ACT_SHOOT;
  });
  target.addEventListener('pointermove', (event) => {
    const rect = target.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    mouseSeen = true;
  });

  function hasAny(set) {
    for (const code of set) if (held.has(code)) return true;
    return false;
  }

  return {
    /** Movement vector, each component -1, 0 or 1. */
    move() {
      return {
        x: (hasAny(RIGHT) ? 1 : 0) - (hasAny(LEFT) ? 1 : 0),
        y: (hasAny(DOWN) ? 1 : 0) - (hasAny(UP) ? 1 : 0),
      };
    },
    sprint() {
      return hasAny(SPRINT);
    },
    mouse() {
      return { x: mouseX, y: mouseY, seen: mouseSeen };
    },
    /** The one-shot presses since the last call, as ACT_* flags. */
    takeActions() {
      const taken = queued;
      queued = 0;
      return taken;
    },
  };
}
