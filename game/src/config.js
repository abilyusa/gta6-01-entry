// Solmar — every tuning number, colour and story beat in one place.
// The playfield is a 1280x720 window into a 3200x2400 city; nothing here
// depends on the screen size, so the same numbers drive the game and the
// screenshot scenes.
export const VIEW = { width: 1280, height: 720 };
export const WORLD = { width: 3200, height: 2400 };

// Streets sit on a 400 px grid; each street is 96 px wide, lanes offset 24 px.
export const STREET = { spacing: 400, halfWidth: 48, lane: 24 };
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 14,
  walk: 230,
  sprint: 340,
  health: 100,
  grabRadius: 70,
};

export const CAR = {
  length: 48,
  width: 24,
  radius: 20,
  accel: 430,
  brake: 700,
  reverseTop: 190,
  topSpeed: 540,
  steer: 2.7,
  drag: 0.55,
};

export const TRAFFIC = { cars: 18, slow: 150, fast: 250 };
export const CROWD = { peds: 32, stroll: 55, run: 150 };
export const COPS = { topSpeed: 580, bustTime: 1.6, clearTime: 6, clearRadius: 720 };

export const HEAT = {
  steal: 1,
  shoot: 1,
  runOver: 1,
  max: 5,
  coolSeconds: 9,
};

export const SHOT = { speed: 780, life: 0.9, damage: 34, enemyDamage: 9, enemyGap: 0.9 };

export const GARAGE = { price: 100, maxHeat: 2 };

export const SAVE_KEY = 'solmar-save-v1';

export const PALETTE = {
  lawn: '#86b25e',
  lawnDark: '#7aa654',
  park: '#639c4e',
  sand: '#ecd9a2',
  sea: '#2e86c1',
  seaDeep: '#2470a3',
  asphalt: '#40434b',
  dash: '#f0d64e',
  curb: '#a2a8b0',
  roofs: ['#d0704b', '#4d82bd', '#c0a94e', '#825da6', '#4db08f', '#c05f74', '#93714d', '#5f92bd'],
  tree: '#33802f',
  treeShade: '#276b2c',
  hero: '#f6cd4e',
  heroShirt: '#e85a4f',
  cop: '#2f6fd0',
  copLight: '#ff4038',
  cars: ['#dd5240', '#3f7ed9', '#ececec', '#f6cd4e', '#7d4dd9', '#3fab8f', '#eb8d40', '#8f959c'],
  peds: ['#ececec', '#dd5240', '#3f7ed9', '#f6cd4e', '#7d4dd9', '#3fab8f'],
  text: '#f5f7f9',
  dim: '#ccd1d8',
  gold: '#f6cd4e',
  red: '#e85a4f',
  blue: '#54c6f8',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

// The story: Dario Vega comes home to Solmar owing fixer Rosa Marín one last
// job. Five jobs, each with a briefing, an objective line and a payout.
export const MISSIONS = [
  {
    id: 'first-ride',
    title: '1 · First Ride',
    briefing: 'Rosa: "You are back, Dario. No car, no cash, no name. Take the red sedan by the plaza — keys are in it. That is how this city works."',
    objective: 'Steal a car — press E next to one',
    reward: 200,
  },
  {
    id: 'courier',
    title: '2 · Courier',
    briefing: 'Rosa: "Three drops, one hour on the clock. The packages are not yours to open. Drive like the cops already know."',
    objective: 'Deliver the packages to the three yellow markers',
    reward: 400,
  },
  {
    id: 'heat',
    title: '3 · Heat',
    briefing: 'Rosa: "Somebody talked. Three stars, Dario — the whole Solmar PD is coming. Lose them. Do not get caught, do not get shot."',
    objective: 'Lose the cops — get your wanted level to zero',
    reward: 500,
  },
  {
    id: 'docks',
    title: '4 · Dockside Payback',
    briefing: 'Rosa: "The crew that sold you out drinks at the docks. Four of them, all armed. End it, and the debt is half gone."',
    objective: 'Take down all four gunmen at the docks',
    reward: 800,
  },
  {
    id: 'score',
    title: '5 · The Solmar Score',
    briefing: 'Rosa: "Last job. The armored van outside the Solmar Bank, full of casino cash. Take it, bring it to the hideout. Then we are free."',
    objective: 'Steal the armored van and deliver it to the hideout',
    reward: 2000,
  },
];

export const STORY_DONE =
  'The van is home. Rosa counts the cash, laughs, and burns the debt slip. Solmar is yours now, Dario — keep the car, keep the money, keep driving.';
