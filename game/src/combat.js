// Combat: bullets, gunmen, and pickups. The player shoots toward the mouse
// (or the nearest enemy when the mouse has never moved); gunmen take cover
// positions and shoot back on a timer. Bullets stop at buildings. Pickups are
// health kits the player walks over and cash dropped by beaten enemies.
import { PALETTE, SHOT } from './config.js';
import { touchesBuilding } from './city.js';

export function fireBullet(state, from, x, y, angle, enemy) {
  state.bullets.push({
    x: x + Math.cos(angle) * 26,
    y: y + Math.sin(angle) * 26,
    vx: Math.cos(angle) * SHOT.speed,
    vy: Math.sin(angle) * SHOT.speed,
    life: SHOT.life,
    from,
    enemy: !!enemy,
  });
}

export function makeGunman(x, y) {
  return { x, y, angle: 0, health: 100, shootTimer: 0.5 + Math.random() * 0.8, alive: true, flash: 0 };
}

export function makePickup(x, y, kind, amount) {
  return { x, y, kind, amount: amount || 0, bob: 0 };
}

function bulletHitsCar(bullet, car) {
  const dx = bullet.x - car.x;
  const dy = bullet.y - car.y;
  const along = Math.abs(dx * Math.cos(car.angle) + dy * Math.sin(car.angle));
  const across = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
  return along < 30 && across < 18;
}

/** Move bullets, resolve hits on cars, pedestrians, gunmen and the player. */
export function stepBullets(state, dt) {
  const player = state.player;
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const b = state.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead && touchesBuilding(b.x, b.y, 2, state.city.buildings)) dead = true;
    if (!dead && (b.x < 0 || b.x > 3200 || b.y < 0 || b.y > 2400)) dead = true;
    if (!dead && b.from === 'player') {
      for (const enemy of state.enemies) {
        if (!enemy.alive) continue;
        const dx = b.x - enemy.x;
        const dy = b.y - enemy.y;
        if (dx * dx + dy * dy < 20 * 20) {
          enemy.health -= SHOT.damage;
          enemy.flash = 0.12;
          if (enemy.health <= 0) {
            enemy.alive = false;
            state.pickups.push(makePickup(enemy.x, enemy.y, 'cash', 60));
          }
          dead = true;
          break;
        }
      }
    }
    if (!dead && b.from === 'player') {
      for (const car of state.cars) {
        if (car === player.car || car.health <= 0) continue;
        if (bulletHitsCar(b, car)) {
          car.health -= SHOT.damage;
          if (car.health <= 0) car.disabled = true;
          dead = true;
          break;
        }
      }
    }
    if (!dead && b.from === 'player') {
      for (const ped of state.peds) {
        if (!ped.alive) continue;
        const dx = b.x - ped.x;
        const dy = b.y - ped.y;
        if (dx * dx + dy * dy < 16 * 16) {
          ped.alive = false;
          state.events.killedPed = true;
          dead = true;
          break;
        }
      }
    }
    if (!dead && b.from === 'enemy') {
      const target = player.car || null;
      if (target) {
        if (bulletHitsCar(b, target)) {
          target.health -= SHOT.enemyDamage;
          if (target.health <= 0) target.disabled = true;
          dead = true;
        }
      } else {
        const dx = b.x - player.x;
        const dy = b.y - player.y;
        if (dx * dx + dy * dy < 16 * 16) {
          player.health -= SHOT.enemyDamage;
          dead = true;
        }
      }
    }
    if (dead) state.bullets.splice(i, 1);
  }
}

/** Gunmen stand their ground, aim at the player and fire on a timer. */
export function stepEnemies(state, dt) {
  const player = state.player;
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    enemy.flash = Math.max(0, enemy.flash - dt);
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    enemy.angle = Math.atan2(dy, dx);
    enemy.shootTimer -= dt;
    if (enemy.shootTimer <= 0 && dist < 520) {
      enemy.shootTimer = SHOT.enemyGap + Math.random() * 0.5;
      fireBullet(state, 'enemy', enemy.x, enemy.y, enemy.angle + (Math.random() - 0.5) * 0.16, true);
      state.events.enemyShot = true;
    }
  }
}

/** Pickups: walk over a health kit to heal, cash to collect it. */
export function stepPickups(state) {
  const player = state.player;
  for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
    const p = state.pickups[i];
    p.bob += 0.05;
    const dx = p.x - player.x;
    const dy = p.y - player.y;
    if (dx * dx + dy * dy < 30 * 30) {
      if (p.kind === 'health') player.health = Math.min(100, player.health + 40);
      else if (p.kind === 'cash') player.money += p.amount;
      state.events.pickup = true;
      state.pickups.splice(i, 1);
    }
  }
}

export { PALETTE };
