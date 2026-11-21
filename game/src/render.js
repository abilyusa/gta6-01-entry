// Drawing only: the world's state and the current screen in, pixels out.
// The 1280x720 view is scaled to fit the window and centred; the camera
// pans over the city inside it. Flat shapes and canvas text: the HUD, the
// minimap, the mission panel, the wanted stars, and the title and pause
// screens are all drawn here.
import { FONT, MISSIONS, PALETTE, STREET, VIEW, WORLD } from './config.js';
import { objectiveText } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }

  function textPlain(value, x, y, size, color, align, baseline) {
    if (!fonts.has('p' + size)) fonts.set('p' + size, `${size}px ${FONT}`);
    context.font = fonts.get('p' + size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }

  function drawGround(state) {
    const city = state.city;
    context.fillStyle = PALETTE.lawn;
    context.fillRect(0, 0, WORLD.width, WORLD.height);
    // Mown stripes so the grass reads as city lawns, not a flat fill.
    context.fillStyle = PALETTE.lawnDark;
    for (let y = 0; y < WORLD.height; y += 160) context.fillRect(0, y, WORLD.width, 6);
    for (const park of city.parks) {
      context.fillStyle = PALETTE.park;
      context.fillRect(park.x, park.y, park.w, park.h);
    }
    // Beach and sea along the south edge.
    context.fillStyle = PALETTE.sand;
    context.fillRect(0, city.beachY, WORLD.width, WORLD.height - city.beachY);
    context.fillStyle = PALETTE.sea;
    context.fillRect(0, city.seaY, WORLD.width, WORLD.height - city.seaY);
    context.fillStyle = PALETTE.seaDeep;
    for (let x = 0; x < WORLD.width; x += 260) {
      context.fillRect(x + 40, city.seaY + 40, 120, 4);
      context.fillRect(x + 140, city.seaY + 90, 90, 4);
    }
    // Streets: asphalt, centre dashes, and pale sidewalks.
    context.fillStyle = PALETTE.curb;
    for (const cx of city.vStreets) context.fillRect(cx - STREET.halfWidth - 8, 0, STREET.halfWidth * 2 + 16, city.beachY);
    for (const cy of city.hStreets) context.fillRect(0, cy - STREET.halfWidth - 8, WORLD.width, STREET.halfWidth * 2 + 16);
    context.fillStyle = PALETTE.asphalt;
    for (const cx of city.vStreets) context.fillRect(cx - STREET.halfWidth, 0, STREET.halfWidth * 2, city.beachY);
    for (const cy of city.hStreets) context.fillRect(0, cy - STREET.halfWidth, WORLD.width, STREET.halfWidth * 2);
    context.fillStyle = PALETTE.dash;
    for (const cx of city.vStreets) {
      for (let y = 0; y < city.beachY; y += 64) context.fillRect(cx - 2, y, 4, 30);
    }
    for (const cy of city.hStreets) {
      for (let x = 0; x < WORLD.width; x += 64) context.fillRect(x, cy - 2, 30, 4);
    }
    // Docks: wooden piers on the east edge.
    context.fillStyle = '#8a6a4a';
    context.fillRect(city.docks.x, city.docks.y, city.docks.w, city.docks.h);
    context.fillStyle = '#a8825c';
    for (let y = city.docks.y; y < city.docks.y + city.docks.h; y += 40) {
      context.fillRect(city.docks.x, y, city.docks.w, 4);
    }
    // Tune-Up garage pad.
    context.fillStyle = '#c8ccd2';
    context.fillRect(city.garage.x, city.garage.y, city.garage.w, city.garage.h);
    context.fillStyle = PALETTE.blue;
    context.font = `bold 20px ${FONT}`;
    context.textAlign = 'center';
    context.fillText('TUNE-UP', city.garage.x + city.garage.w / 2, city.garage.y + city.garage.h / 2 + 7);
  }

  function drawBuildings(state) {
    const city = state.city;
    for (const b of city.buildings) {
      context.fillStyle = 'rgba(0,0,0,0.25)';
      context.fillRect(b.x + 8, b.y + 10, b.w, b.h);
      context.fillStyle = b.color;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = 'rgba(255,255,255,0.35)';
      context.fillRect(b.x, b.y, b.w, 6);
      context.fillStyle = 'rgba(0,0,0,0.18)';
      const cols = Math.max(1, Math.floor(b.w / 34));
      const rows = Math.max(1, Math.floor(b.h / 34));
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          context.fillRect(b.x + 10 + cx * 34, b.y + 12 + cy * 34, 16, 12);
        }
      }
    }
    for (const t of city.trees) {
      context.fillStyle = PALETTE.treeShade;
      context.beginPath();
      context.arc(t.x + 3, t.y + 4, 13, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.tree;
      context.beginPath();
      context.arc(t.x, t.y, 12, 0, Math.PI * 2);
      context.fill();
    }
    // Named places, labelled on the ground.
    context.font = `bold 22px ${FONT}`;
    context.textAlign = 'center';
    context.fillStyle = 'rgba(255,255,255,0.85)';
    context.fillText('PLAZA', city.plaza.x, city.plaza.y - 70);
    context.fillText('HIDEOUT', city.hideout.x, city.hideout.y - 60);
    context.fillText('SOLMAR BANK', city.bank.x, city.bank.y - 70);
    context.fillText('HOSPITAL', city.hospital.x, city.hospital.y - 60);
    context.fillText('DOCKS', city.docks.x + 120, city.docks.y - 24);
  }

  function drawCar(car, time) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    if (car.disabled) context.globalAlpha = 0.75;
    // Wheels, body, windshield, roof.
    context.fillStyle = '#14161a';
    context.fillRect(-20, -15, 12, 6);
    context.fillRect(-20, 9, 12, 6);
    context.fillRect(8, -15, 12, 6);
    context.fillRect(8, 9, 12, 6);
    context.fillStyle = car.color;
    context.beginPath();
    context.roundRect(-24, -12, 48, 24, 7);
    context.fill();
    context.fillStyle = 'rgba(20,30,44,0.85)';
    context.fillRect(-4, -10, 12, 20);
    context.fillStyle = 'rgba(255,255,255,0.25)';
    context.fillRect(-22, -10, 6, 20);
    if (car.kind === 'police') {
      const flash = Math.floor(time * 4 + car.sirenPhase) % 2 === 0;
      context.fillStyle = flash ? '#ff4038' : '#3b82ff';
      context.beginPath();
      context.arc(-8, -8, 4, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = flash ? '#3b82ff' : '#ff4038';
      context.beginPath();
      context.arc(-8, 8, 4, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#f5f7f9';
      context.font = `bold 9px ${FONT}`;
      context.textAlign = 'center';
      context.fillText('PD', 8, 3);
    }
    if (car.armored) {
      context.fillStyle = '#f6cd4e';
      context.font = `bold 9px ${FONT}`;
      context.textAlign = 'center';
      context.fillText('ARMORED', 6, 3);
    }
    if (car.health < 45 && !car.disabled) {
      context.fillStyle = 'rgba(120,120,120,0.7)';
      context.beginPath();
      context.arc(-14 + Math.sin(time * 9) * 3, -6, 7, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  function drawPerson(x, y, angle, color, radius, shirt) {
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.fillStyle = color;
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = shirt || '#22252b';
    context.beginPath();
    context.arc(4, 0, radius * 0.55, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#14161a';
    context.fillRect(radius - 2, -3, 6, 6);
    context.restore();
  }

  function drawWorld(state, time) {
    const cam = state.camera;
    context.save();
    context.translate(-cam.x, -cam.y);
    drawGround(state);
    drawBuildings(state);
    // Mission marker: a pulsing beacon and a ground ring.
    if (state.marker) {
      const pulse = 1 + Math.sin(time * 4) * 0.15;
      context.strokeStyle = PALETTE.gold;
      context.lineWidth = 4;
      context.beginPath();
      context.arc(state.marker.x, state.marker.y, 34 * pulse, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = PALETTE.gold;
      context.beginPath();
      context.moveTo(state.marker.x, state.marker.y - 52);
      context.lineTo(state.marker.x - 10, state.marker.y - 30);
      context.lineTo(state.marker.x + 10, state.marker.y - 30);
      context.closePath();
      context.fill();
    }
    for (const p of state.pickups) {
      const bob = Math.sin(p.bob) * 3;
      if (p.kind === 'health') {
        context.fillStyle = '#f5f7f9';
        context.fillRect(p.x - 11, p.y - 11 + bob, 22, 22);
        context.fillStyle = PALETTE.red;
        context.fillRect(p.x - 3, p.y - 8 + bob, 6, 16);
        context.fillRect(p.x - 8, p.y - 3 + bob, 16, 6);
      } else {
        context.fillStyle = PALETTE.gold;
        context.beginPath();
        context.arc(p.x, p.y + bob, 10, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#8a6a1a';
        context.font = `bold 12px ${FONT}`;
        context.textAlign = 'center';
        context.fillText('$', p.x, p.y + 4 + bob);
      }
    }
    for (const car of state.cars) drawCar(car, time);
    for (const ped of state.peds) {
      if (!ped.alive) continue;
      drawPerson(ped.x, ped.y, ped.angle, ped.color, 9);
    }
    for (const enemy of state.enemies) {
      if (!enemy.alive) continue;
      drawPerson(enemy.x, enemy.y, enemy.angle, '#3a3f47', 11, enemy.flash > 0 ? '#ffffff' : '#e85a4f');
      context.fillStyle = PALETTE.red;
      context.fillRect(enemy.x - 14, enemy.y - 24, 28, 5);
      context.fillStyle = '#7ee081';
      context.fillRect(enemy.x - 14, enemy.y - 24, 28 * Math.max(0, enemy.health / 100), 5);
    }
    for (const b of state.bullets) {
      context.fillStyle = '#ffe27a';
      context.beginPath();
      context.arc(b.x, b.y, 4, 0, Math.PI * 2);
      context.fill();
    }
    const p = state.player;
    if (!p.car) {
      drawPerson(p.x, p.y, p.angle, PALETTE.hero, 13, PALETTE.heroShirt);
      if (p.invuln > 0 && Math.floor(p.invuln * 8) % 2 === 0) {
        context.strokeStyle = 'rgba(255,255,255,0.8)';
        context.lineWidth = 2;
        context.beginPath();
        context.arc(p.x, p.y, 19, 0, Math.PI * 2);
        context.stroke();
      }
    }
    context.restore();
  }

  function drawMinimap(state) {
    const mw = 220;
    const mh = 168;
    const mx = 16;
    const my = VIEW.height - mh - 16;
    const sx = mw / WORLD.width;
    const sy = mh / WORLD.height;
    context.fillStyle = 'rgba(10,14,20,0.78)';
    context.beginPath();
    context.roundRect(mx - 6, my - 6, mw + 12, mh + 12, 10);
    context.fill();
    context.strokeStyle = 'rgba(255,255,255,0.35)';
    context.lineWidth = 1;
    context.stroke();
    context.save();
    context.beginPath();
    context.rect(mx, my, mw, mh);
    context.clip();
    context.fillStyle = '#5d8a4a';
    context.fillRect(mx, my, mw, mh);
    context.fillStyle = '#2e86c1';
    context.fillRect(mx, my + 2160 * sy, mw, mh);
    context.strokeStyle = '#c8ccd2';
    context.lineWidth = 2;
    for (const cx of state.city.vStreets) {
      context.beginPath();
      context.moveTo(mx + cx * sx, my);
      context.lineTo(mx + cx * sx, my + mh);
      context.stroke();
    }
    for (const cy of state.city.hStreets) {
      context.beginPath();
      context.moveTo(mx, my + cy * sy);
      context.lineTo(mx + mw, my + cy * sy);
      context.stroke();
    }
    if (state.marker) {
      context.fillStyle = PALETTE.gold;
      context.save();
      context.translate(mx + state.marker.x * sx, my + state.marker.y * sy);
      context.rotate(Math.PI / 4);
      context.fillRect(-6, -6, 12, 12);
      context.restore();
    }
    for (const car of state.cars) {
      if (car.kind !== 'police') continue;
      context.fillStyle = '#5aa2ff';
      context.beginPath();
      context.arc(mx + car.x * sx, my + car.y * sy, 4, 0, Math.PI * 2);
      context.fill();
    }
    for (const enemy of state.enemies) {
      if (!enemy.alive) continue;
      context.fillStyle = PALETTE.red;
      context.beginPath();
      context.arc(mx + enemy.x * sx, my + enemy.y * sy, 3, 0, Math.PI * 2);
      context.fill();
    }
    const p = state.player;
    context.fillStyle = '#ffffff';
    context.save();
    context.translate(mx + p.x * sx, my + p.y * sy);
    context.rotate(p.angle);
    context.beginPath();
    context.moveTo(8, 0);
    context.lineTo(-6, -5);
    context.lineTo(-6, 5);
    context.closePath();
    context.fill();
    context.restore();
    context.restore();
    textPlain('SOLMAR', mx + 4, my - 12, 13, 'rgba(255,255,255,0.85)', 'left');
  }

  function drawHud(state, ui) {
    // Mission panel, top left.
    context.fillStyle = 'rgba(10,14,20,0.72)';
    context.beginPath();
    context.roundRect(16, 14, 430, 64, 8);
    context.fill();
    const missionTitle = state.mission ? MISSIONS[state.mission.index].title : (state.storyDone ? 'Story complete' : 'Free roam');
    text(missionTitle, 30, 38, 19, PALETTE.gold, 'left');
    textPlain(objectiveText(state), 30, 62, 15, PALETTE.text, 'left');
    if (state.mission && state.mission.index === 1) {
      textPlain(`${Math.ceil(state.mission.timer)}s left`, 420, 38, 15, state.mission.timer < 20 ? PALETTE.red : PALETTE.text, 'right');
    }
    // Wanted stars + money + health, top right.
    context.fillStyle = 'rgba(10,14,20,0.72)';
    context.beginPath();
    context.roundRect(VIEW.width - 300, 14, 284, 64, 8);
    context.fill();
    for (let i = 0; i < 5; i += 1) {
      text(i < state.wanted ? '★' : '☆', VIEW.width - 282 + i * 26, 44, 24, i < state.wanted ? PALETTE.gold : 'rgba(255,255,255,0.4)', 'left');
    }
    text(`$${state.player.money}`, VIEW.width - 30, 44, 22, '#7ee081', 'right');
    context.fillStyle = 'rgba(255,255,255,0.25)';
    context.fillRect(VIEW.width - 282, 54, 252, 10);
    context.fillStyle = state.player.health > 30 ? '#7ee081' : PALETTE.red;
    context.fillRect(VIEW.width - 282, 54, 252 * Math.max(0, state.player.health / 100), 10);
    // Speed and weapon, bottom right.
    const p = state.player;
    const speed = p.car ? Math.round(Math.abs(p.car.speed) * 0.18) : 0;
    text(p.car ? `${speed} mph` : 'On foot', VIEW.width - 30, VIEW.height - 24, 22, PALETTE.text, 'right');
    textPlain(p.car ? 'E — leave car' : 'Pistol · click to shoot · E — enter car', VIEW.width - 30, VIEW.height - 52, 14, PALETTE.dim, 'right');
    if (ui.muted) textPlain('Muted (M)', VIEW.width - 30, VIEW.height - 76, 14, PALETTE.dim, 'right');
    // Busted progress.
    if (state.bust > 0.1) {
      context.fillStyle = 'rgba(10,14,20,0.72)';
      context.beginPath();
      context.roundRect(VIEW.width / 2 - 130, 96, 260, 34, 8);
      context.fill();
      textPlain('BUSTED INCOMING — MOVE!', VIEW.width / 2, 119, 17, PALETTE.red, 'center');
    }
    // Banner + briefing.
    if (state.banner) {
      context.fillStyle = 'rgba(10,14,20,0.78)';
      const w = Math.min(860, 40 + state.banner.length * 9);
      context.beginPath();
      context.roundRect(VIEW.width / 2 - w / 2, 150, w, 44, 8);
      context.fill();
      textPlain(state.banner, VIEW.width / 2, 179, 19, PALETTE.gold, 'center');
    }
    if (state.briefing && state.briefingTimer > 0) {
      context.fillStyle = 'rgba(10,14,20,0.72)';
      context.beginPath();
      context.roundRect(260, VIEW.height - 148, VIEW.width - 440, 58, 8);
      context.fill();
      wrapText(state.briefing, 260 + (VIEW.width - 440) / 2, VIEW.height - 124, VIEW.width - 480, 15);
    }
    // Off-screen marker arrow.
    if (state.marker) {
      const cam = state.camera;
      const sx = state.marker.x - cam.x;
      const sy = state.marker.y - cam.y;
      if (sx < 0 || sx > VIEW.width || sy < 0 || sy > VIEW.height) {
        const cx = clamp(sx, 60, VIEW.width - 60);
        const cy = clamp(sy, 110, VIEW.height - 60);
        const angle = Math.atan2(sy - cy, sx - cx);
        context.save();
        context.translate(cx, cy);
        context.rotate(angle);
        context.fillStyle = PALETTE.gold;
        context.beginPath();
        context.moveTo(18, 0);
        context.lineTo(-10, -11);
        context.lineTo(-10, 11);
        context.closePath();
        context.fill();
        context.restore();
        const dist = Math.round(Math.sqrt((sx - cx) ** 2 + (sy - cy) ** 2) / 10);
        textPlain(`${state.marker.label || 'Target'} · ${dist}m`, clamp(cx, 110, VIEW.width - 110), cy + 30, 14, PALETTE.gold, 'center');
      } else if (state.marker.label) {
        textPlain(state.marker.label, sx, sy - 66, 15, PALETTE.gold, 'center');
      }
    }
    // "Press E" prompt near a car.
    if (ui.nearCar && !p.car) {
      textPlain('Press E to steal this car', VIEW.width / 2, VIEW.height - 176, 18, PALETTE.gold, 'center');
    }
    if (ui.inGarage && p.car) {
      textPlain('Tune-Up Garage — repair + clear wanted: $100', VIEW.width / 2, VIEW.height - 176, 18, PALETTE.blue, 'center');
    }
  }

  function wrapText(value, cx, y, maxWidth, size) {
    const words = value.split(' ');
    const lines = [''];
    for (const word of words) {
      const test = lines[lines.length - 1] ? `${lines[lines.length - 1]} ${word}` : word;
      context.font = `${size}px ${FONT}`;
      if (context.measureText(test).width > maxWidth && lines[lines.length - 1]) lines.push(word);
      else lines[lines.length - 1] = test;
    }
    lines.forEach((line, i) => textPlain(line, cx, y + i * 19, size, PALETTE.text, 'center'));
  }

  function drawPanel(title, lines, prompt, accent) {
    context.fillStyle = 'rgba(8,10,16,0.72)';
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    const width = 680;
    const height = 150 + lines.length * 30 + 74;
    const x = (VIEW.width - width) / 2;
    const y = (VIEW.height - height) / 2;
    context.fillStyle = '#171c26';
    context.beginPath();
    context.roundRect(x, y, width, height, 14);
    context.fill();
    context.strokeStyle = accent || PALETTE.gold;
    context.lineWidth = 2;
    context.stroke();
    text(title, VIEW.width / 2, y + 66, 44, accent || PALETTE.gold, 'center');
    lines.forEach((line, i) => textPlain(line, VIEW.width / 2, y + 118 + i * 30, 18, PALETTE.dim, 'center'));
    text(prompt, VIEW.width / 2, y + height - 30, 20, PALETTE.text, 'center');
  }

  function drawTitle(state, ui) {
    drawWorld(state, ui.time);
    context.fillStyle = 'rgba(8,10,16,0.55)';
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    text('SOLMAR', VIEW.width / 2, 150, 84, PALETTE.gold, 'center');
    textPlain('An open-world crime story — sun, sea, and one last job.', VIEW.width / 2, 190, 20, PALETTE.text, 'center');
    textPlain('A fan-made original. Not affiliated with Rockstar Games.', VIEW.width / 2, 218, 14, PALETTE.dim, 'center');
    const lines = [
      'Dario Vega is home, broke, and in debt to fixer Rosa Marín.',
      'Five jobs stand between him and freedom — if the Solmar PD lets him finish them.',
      '',
      'WASD / arrows — walk & drive · Mouse — aim · Click — shoot',
      'E — steal / leave a car · Shift — sprint · P — pause · M — mute',
      'Steal cars, lose the cops, run missions. Save: progress saves after every job.',
    ];
    const height = 150 + lines.length * 28 + 74;
    const width = 680;
    const x = (VIEW.width - width) / 2;
    const y = 244;
    context.fillStyle = 'rgba(10,14,20,0.8)';
    context.beginPath();
    context.roundRect(x, y, width, height, 14);
    context.fill();
    lines.forEach((line, i) => textPlain(line, VIEW.width / 2, y + 44 + i * 28, 17, i < 2 ? PALETTE.text : PALETTE.dim, 'center'));
    const prompt = ui.save ? 'Press Enter — Continue ($' + ui.save.money + ' · job ' + (Math.min(5, ui.save.missionIndex + 1)) + ' of 5) or N — New game' : 'Press Enter or click to start';
    text(prompt, VIEW.width / 2, y + height + 44, 22, PALETTE.gold, 'center');
    if (ui.save) textPlain('Saved ' + new Date(ui.save.savedAt).toLocaleDateString(), VIEW.width / 2, y + height + 74, 14, PALETTE.dim, 'center');
  }

  /** Paint one frame: the world, then the HUD or a screen panel. */
  function draw(state, screen, ui) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#0b0e14';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (screen === SCREEN_TITLE) {
      drawTitle(state, ui);
      return;
    }
    drawWorld(state, ui.time);
    drawMinimap(state);
    drawHud(state, ui);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['Progress saves after every job — nothing is lost by quitting here.', 'M — mute · Enter — resume'], 'Press P or Enter to resume', PALETTE.blue);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, view };
}
