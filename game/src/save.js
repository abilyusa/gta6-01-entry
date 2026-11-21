// Saving: the whole campaign fits in one localStorage entry — money, the
// mission reached, the story flag, and the player's best haul. Saving happens
// on mission completion, on a garage repair, and when the player quits to the
// title screen; loading restores it so a session survives a closed tab.
import { SAVE_KEY } from './config.js';

export function saveGame(state) {
  try {
    const data = {
      money: state.player.money,
      missionIndex: state.mission ? state.mission.index : state.nextMission,
      storyDone: state.storyDone,
      carsStolen: state.stats.carsStolen,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    state.saveDirty = false;
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.money !== 'number' || typeof data.missionIndex !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage can be off: nothing to clear.
  }
}
