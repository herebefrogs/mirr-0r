import { isMobile } from './mobile';
import { checkMonetization, isMonetizationEnabled, monetizationEarned } from './monetization';
import { initSpeech } from './speech';
import { save, load } from './storage';
import { ALIGN_CENTER, ALIGN_RIGHT, CHARSET_SIZE, initCharset, renderText } from './text';
import { lerp, loadImg, rand, setRandSeed, smoothLerpArray } from './utils';
import TILESET from '../img/spritesheet.webp';
import LEVELSET from '../../assets/level/png/Level_0_Tiles.png';


const konamiCode = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65];
let konamiIndex = 0;

// GAMEPLAY VARIABLES

const TITLE_SCREEN = 0;
const GAME_SCREEN = 1;
const END_SCREEN = 2;
let screen = TITLE_SCREEN;

// factor by which to reduce both moveX and moveY when player moving diagonally
// so they don't seem to move faster than when traveling vertically or horizontally
const RADIUS_ONE_AT_45_DEG = Math.cos(Math.PI / 4);
const TIME_TO_FULL_SPEED = 150;                // in millis, duration till going full speed in any direction

let hero;      // player ship currently leading the flight
let flight;    // all player ships part of the flight
let entities;
let invertImage = false;
let invertTime = 0;
let lastSpawnDuration = 0;
let score;
let highscore = load('highscore');
let lastMirrorTime;
const MIRROR_DURATION = 15000;

const COLLISION_GROUP_HUMANS = 1;
const COLLISION_GROUP_ALIENS = 2;


let speak;

// RENDER VARIABLES

const CTX = c.getContext('2d');         // visible canvas
const MAP = c.cloneNode();              // full map rendered off screen
const MAP_CTX = MAP.getContext('2d');
MAP.width = 288;                        // map size
MAP.height = 480;
const TEXT = c.cloneNode();             // text overlay, same size as viewport
const TEXT_CTX = TEXT.getContext('2d');
const VIEWPORT = c.cloneNode();         // visible portion of map/viewport
const VIEWPORT_CTX = VIEWPORT.getContext('2d');
VIEWPORT.width = TEXT.width = 180;      // viewport & text sizes
VIEWPORT.height = TEXT.height = 240;


// camera-window & edge-snapping settings
const CAMERA_WINDOW_X = 50;
const CAMERA_WINDOW_Y = 50;
const CAMERA_WINDOW_WIDTH = VIEWPORT.width - CAMERA_WINDOW_X;
let viewportOffsetX = 0;
let viewportOffsetY = 0;

const ATLAS = {
  hero: {
    hitBox: {
      x: 4, y: 2, w: 8, h: 8
    },
    fireCadence: 0.2,    // seconds between shots
    dying: [
      { x: 208, y: 0, w: 16, h: 16 },
      { x: 208, y: 16, w: 16, h: 16 },
      { x: 128, y: 32, w: 16, h: 16 },
      { x: 128, y: 48, w: 16, h: 16 }
    ],
    hit: [
      { x: 176, y: 0, w: 16, h: 16 },
      { x: 176, y: 16, w: 16, h: 16 }
    ],
    move: [
      { x: 128, y: 0, w: 16, h: 16 },
      { x: 128, y: 16, w: 16, h: 16 }
    ],
    shadow: [
      { x: 160, y: 0, w: 16, h: 16 },
      { x: 160, y: 16, w: 16, h: 16 }
    ],
    speed: 48,           // pixels per second
  },
  wingfolk: {
    hitBox: {
      x: 4, y: 2, w: 8, h: 8
    },
    dying: [
      { x: 208, y: 0, w: 16, h: 16 },
      { x: 208, y: 16, w: 16, h: 16 },
      { x: 128, y: 32, w: 16, h: 16 },
      { x: 128, y: 48, w: 16, h: 16 }
    ],
    fireCadence: 0.2,    // seconds between shots
    hit: [
      { x: 176, y: 0, w: 16, h: 16 },
      { x: 176, y: 16, w: 16, h: 16 }
    ],
    move: [
      { x: 144, y: 0, w: 16, h: 16 },
      { x: 144, y: 16, w: 16, h: 16 }
    ],
    shadow: [
      { x: 160, y: 0, w: 16, h: 16 },
      { x: 160, y: 16, w: 16, h: 16 }
    ],
    speed: 48,
  },
  shipBullet: {
    dying: [],
    hitBox: {
      x: 0, y: 2, w: 4, h: 10
    },
    hit: [
      { x: 196, y: 0, w: 4, h: 16 },
      { x: 196, y: 16, w: 4, h: 16 }
    ],
    move: [
      { x: 192, y: 0, w: 4, h: 16 },
      { x: 192, y: 16, w: 4, h: 16 },
    ],
    speed: 200,
  },
  alien1: {
    hitBox: {
      x: 3, y: 2, w: 10, h: 10
    },
    dying: [
      { x: 208, y: 0, w: 16, h: 16 },
      { x: 208, y: 16, w: 16, h: 16 },
      { x: 128, y: 32, w: 16, h: 16 },
      { x: 128, y: 48, w: 16, h: 16 }
    ],
    fireCadence: 1,
    hit: [
      { x: 48, y: 0, w: 16, h: 16 },
      { x: 48, y: 16, w: 16, h: 16 },
      { x: 48, y: 32, w: 16, h: 16 },
      { x: 48, y: 48, w: 16, h: 16 },
      { x: 48, y: 64, w: 16, h: 16 },
      { x: 48, y: 80, w: 16, h: 16 }
    ],
    move: [
      { x: 32, y: 0, w: 16, h: 16 },
      { x: 32, y: 16, w: 16, h: 16 },
      { x: 32, y: 32, w: 16, h: 16 },
      { x: 32, y: 48, w: 16, h: 16 },
      { x: 32, y: 64, w: 16, h: 16 },
      { x: 32, y: 80, w: 16, h: 16 }
    ],
    shadow: [
      // TODO 6 frames, update positions
      { x: 48, y: 80, w: 16, h: 16 },
      { x: 0, y: 80, w: 16, h: 16 },
      { x: 16, y: 80, w: 16, h: 16 },
      { x: 32, y: 80, w: 16, h: 16 },
    ],
    speed: 15,
  },
  alien2: {
    hitBox: {
      x: 1, y: 3, w: 14, h: 10
    },
    dying: [
      { x: 208, y: 0, w: 16, h: 16 },
      { x: 208, y: 16, w: 16, h: 16 },
      { x: 128, y: 32, w: 16, h: 16 },
      { x: 128, y: 48, w: 16, h: 16 }
    ],
    fireCadence: 1.5,
    hit: [
      { x: 80, y: 0, w: 16, h: 16 },
      { x: 80, y: 16, w: 16, h: 16 },
      { x: 80, y: 32, w: 16, h: 16 },
      { x: 80, y: 48, w: 16, h: 16 },
      { x: 80, y: 64, w: 16, h: 16 },
      { x: 80, y: 80, w: 16, h: 16 }
    ],
    move: [
      { x: 64, y: 0, w: 16, h: 16 },
      { x: 64, y: 16, w: 16, h: 16 },
      { x: 64, y: 32, w: 16, h: 16 },
      { x: 64, y: 48, w: 16, h: 16 },
      { x: 64, y: 64, w: 16, h: 16 },
      { x: 64, y: 80, w: 16, h: 16 }
    ],
    shadow: [
      { x: 0, y: 96, w: 16, h: 16 },
      { x: 16, y: 96, w: 16, h: 16 },
      { x: 32, y: 96, w: 16, h: 16 },
      { x: 48, y: 96, w: 16, h: 16 },
    ],
    speed: 15,
  },
  alienBullet: {
    dying: [],
    hitBox: {
      x: 2, y: 2, w:4, h: 4
    },
    hit: [
      { x: 200, y: 8, w: 8, h: 8 },
      { x: 200, y: 8, w: 8, h: 8 }
    ],
    move: [
      { x: 200, y: 0, w: 8, h: 8 },
      { x: 200, y: 16, w: 8, h: 8 }
    ],
    speed: 45,
  },
  scroll: {
    speed: {
      y: 50 // px per sec
    }
  }
};

const FRAME_DURATION = 0.1; // duration of 1 animation frame, in seconds
let tileset;   // characters sprite, embedded as a base64 encoded dataurl by build script
let levelset;

// LOOP VARIABLES

let currentTime;
let elapsedTime;
let lastTime;
let requestId;
let running = true;

// GAMEPLAY HANDLERS

function startGame() {
  setRandSeed('gamedevjs2021');
  konamiIndex = 0;
  score = 0;
  invertImage = false;
  invertTime = 0;
  lastMirrorTime = currentTime;
  viewportOffsetX = (MAP.width - VIEWPORT.width) / 2;
  viewportOffsetY = MAP.height - VIEWPORT.height;
  // TODO the whole referentiel is off due to screen (0,0) being top left rather than bottom left
  hero = createEntity({
    type: 'hero',
    collisionGroup: COLLISION_GROUP_HUMANS,
    collideWith: COLLISION_GROUP_ALIENS,
    shooting: isMobile,
    x: MAP.width / 2,
    y: MAP.height - 3*ATLAS.hero.move[0].h
  });
  flight = [
    hero,
    createEntity({
      type: 'wingfolk',
      collisionGroup: COLLISION_GROUP_HUMANS,
      collideWith: COLLISION_GROUP_ALIENS,
      shooting: isMobile,
      x: hero.x - hero.w,
      y: hero.y + hero.h
    }),
    createEntity({
      type: 'wingfolk',
      collisionGroup: COLLISION_GROUP_HUMANS,
      collideWith: COLLISION_GROUP_ALIENS,
      shooting: isMobile,
      x: hero.x + hero.w,
      y: hero.y + hero.h
    }),
  ];
  if (isMonetizationEnabled()) {
    flight.splice(1, 0, createEntity({
      type: 'wingfolk',
      collisionGroup: COLLISION_GROUP_HUMANS,
      collideWith: COLLISION_GROUP_ALIENS,
      shooting: isMobile,
      x: hero.x,
      y: hero.y + 2.25*hero.h
    }));
    hero.y -= 0.25*hero.h;
  }
  flight.forEach((ship, i) => { ship.flightRank = i+1 });
  entities = [
    ...flight
  ];
  renderMap();
  screen = GAME_SCREEN;
};

function canCollide(entity) {
  return entity.action === 'move' && entity.hp > 0;
};

function testAABBCollision(entity1, entity2) {
  return (
    (entity1.collideWith === entity2.collisionGroup
     || entity1.collisionGroup === entity2.collideWith)
    && entity1.x + entity1.hitBox.x < entity2.x + entity2.hitBox.x + entity2.hitBox.w
    && entity1.x + entity1.hitBox.x + entity1.hitBox.w > entity2.x + entity2.hitBox.x
    && entity1.y + entity1.hitBox.y < entity2.y + entity2.hitBox.y + entity2.hitBox.h
    && entity1.y + entity1.hitBox.y + entity1.hitBox.h > entity2.y + entity2.hitBox.y
  )
};

function constrainFlightToViewport() {
  const horizontallySorted = flight.sort((ship1, ship2) => ship1.x < ship2.x ? -1 : 1);
  const leftMost = horizontallySorted[0];
  const rightMost = horizontallySorted[horizontallySorted.length - 1];
  const verticallySorted = flight.sort((ship1, ship2) => ship1.y < ship2.y ? -1 : 1);
  const topMost = verticallySorted[0];
  const bottomMost = verticallySorted[verticallySorted.length - 1];

  if (leftMost.x < 0) {
    const offsetX = -leftMost.x;
    flight.forEach(ship => { ship.x += offsetX });
  } else if (rightMost.x > MAP.width - rightMost.w) {
    const offsetX = rightMost.x - MAP.width + rightMost.w;
    flight.forEach(ship => { ship.x -= offsetX });
  }
  if (topMost.y < viewportOffsetY) {
    const offsetY = viewportOffsetY - topMost.y;
    flight.forEach(ship => { ship.y += offsetY });
  } else if (bottomMost.y > viewportOffsetY + VIEWPORT.height - bottomMost.h) {
    const offsetY = bottomMost.y - viewportOffsetY - VIEWPORT.height + bottomMost.h;
    flight.forEach(ship => { ship.y -= offsetY });
  }
};


function updateCameraWindow() {
  // edge snapping
  if (0 < viewportOffsetX && hero.x < viewportOffsetX + CAMERA_WINDOW_X) {
    viewportOffsetX = Math.max(0, hero.x - CAMERA_WINDOW_X);
  }
  else if (viewportOffsetX < MAP.width - VIEWPORT.width && hero.x + hero.w > viewportOffsetX + CAMERA_WINDOW_WIDTH) {
    viewportOffsetX = Math.min(MAP.width - VIEWPORT.width, hero.x + hero.w - CAMERA_WINDOW_WIDTH);
  }
};

function createEntity({ action = 'move', type, x = 0, y = 0, ...options }) {
  const sprite = ATLAS[type][action][0];
  return {
    action,
    hitBox: ATLAS[type].hitBox,
    fireTime: 0,
    fireCadence: ATLAS[type].fireCadence,
    frame: 0,
    frameTime: 0,
    h: sprite.h,
    hp: 1,        // default to 1 hit point (killed with 1 bullet)
    moveDown: 0,
    moveLeft: 0,
    moveRight: 0,
    moveUp: 0,
    moveX: 0,
    moveY: 0,
    speed: ATLAS[type].speed,
    type,
    w: sprite.w,
    x,
    y,
    ...options
  };
};

function updateHeroInput() {
  let moveX = 0;
  let moveY = 0;
  
   if (isTouch) {
    moveX = hero.moveLeft + hero.moveRight;
    moveY = hero.moveUp + hero.moveDown;
  } else {
    if (hero.moveLeft || hero.moveRight) {
      moveX = (hero.moveLeft > hero.moveRight ? -1 : 1) * lerp(0, 1, (currentTime - Math.max(hero.moveLeft, hero.moveRight)) / TIME_TO_FULL_SPEED)
    } else {
      moveX = 0;
    }
    if (hero.moveDown || hero.moveUp) {
      moveY = (hero.moveUp > hero.moveDown ? -1 : 1) * lerp(0, 1, (currentTime - Math.max(hero.moveUp, hero.moveDown)) / TIME_TO_FULL_SPEED)
    } else {
      moveY = 0;
    }
  }
  flight.forEach(ship => {
    ship.moveX = moveX;
    ship.moveY = moveY;
  });
}

function updateEntityPositionAndAnimationFrame(entity) {
  // update animation frame
  entity.frameTime += elapsedTime;
  if (entity.frameTime > FRAME_DURATION) {
    entity.frameTime -= FRAME_DURATION;
    entity.frame += 1;

    // update action
    if (entity.hp < 1 && entity.action !== 'dying') {
      entity.action = 'dying';
      // start dying animation from 1st frame
      entity.frame = 0;
      if (entity.type.match(/alien/)) {
        score += 10;
      }
      if (entity === hero && flight.length > 1 && !hero.announcedPromotion) {
        // hero is always 1st in flight, so the next ship will be promoted
        speak(`Red ${flight[1].flightRank} taking point`);
        hero.announcedPromotion = true;
      }
    }
    if (entity.action === 'hit') {
      // only play 1 frame of the "hit" animation
      entity.action = 'move';
    }
    const frameCount = ATLAS[entity.type][entity.action].length;
    if (entity.action === 'dying' && entity.frame === frameCount) {
      // only play the "dying" animation once
      entity.dead = true;
    }

    entity.frame %= frameCount;
  }

  // update position
  const scale = entity.moveX && entity.moveY ? RADIUS_ONE_AT_45_DEG : 1;
  const distance = entity.speed * elapsedTime * scale;
  entity.x += distance * entity.moveX;
  entity.y += distance * entity.moveY;
};

function aimAtTarget(origin, target) {
  // shoot in front of the target
  const targetX = target.x + target.w/2;
  const targetY = target.y - 2*target.h;
  const hypotenuse = Math.sqrt(Math.pow(targetX - origin.x, 2) + Math.pow(targetY - origin.y, 2))
  const adjacent = targetX - origin.x;
  const opposite = targetY - origin.y;
  // x = cos(alpha), y = sin(alpha)
  return [adjacent / hypotenuse, opposite / hypotenuse];
}

function fireBullet(entity) {
  entity.fireTime += (entity.shooting && entity.action !== 'dying') ? elapsedTime : 0;
  if (entity.fireTime >= entity.fireCadence) {
    entity.fireTime -= entity.fireCadence;

    let bullet;
    switch (entity.type) {
      case 'hero':
      case 'wingfolk':
        bullet = createEntity({
          type: 'shipBullet',
          collideWith: COLLISION_GROUP_ALIENS,
          // always move up
          moveY: -1,
          x: entity.x + entity.w / 2,
          y: entity.y - entity.h
        });
        // center bullet on the nose of the hero/wingfolk ship
        bullet.x -= bullet.w / 2;
        break;
      case 'alien1':
      case 'alien2':
        bullet = createEntity({
          type: 'alienBullet',
          collideWith: COLLISION_GROUP_HUMANS,
          x: entity.x + entity.w / 2,
          y: entity.y + entity.h
        });
        // center bullet on the nose of the alien ship
        bullet.x -= bullet.w / 2;

        [bullet.moveX, bullet.moveY] = aimAtTarget(bullet, hero);
        break;
    }

    // add bullets at the end, so they are drawn on top of other sprites
    // HACK: bullet could be undefined, except in practice
    // only entities with { shooting: true } will enter the switch
    entities.push(bullet);
  }
}

function updateScrolling() {
  const scrolledDistance = ATLAS.scroll.speed.y*elapsedTime;

  flight.forEach(ship => ship.y -= scrolledDistance);
  viewportOffsetY -= scrolledDistance;

  // infinite scrolling
  if (viewportOffsetY < 0) {
    viewportOffsetY += MAP.height - VIEWPORT.height;
    // TODO resetting the background position should not affect every entity position
    entities.forEach(entity => {
      entity.y += MAP.height - VIEWPORT.height
    });
  }
}

function spawnEnemy() {
  lastSpawnDuration += elapsedTime;

  let type;

  if (rand() < lerp(0, 1, lastSpawnDuration / 30)) {
    type = 'alien1';
  } else if (rand() < lerp(0, 1, lastSpawnDuration / 40)) {
    type = 'alien2';
  }
  if (type) {
    lastSpawnDuration = 0;
    const alien = createEntity({
      type,
      collisionGroup: COLLISION_GROUP_ALIENS,
      collideWith: COLLISION_GROUP_HUMANS,
      // make them fire sooner the first time
      fireTime: 0.4,
      // alien1 fires less often, so make it tougher
      hp: type === 'alien1' ? 2 : 1,
      // always move down
      moveY: 1,
      shooting: true,
      x: viewportOffsetX + rand(0, VIEWPORT.width),
      y: viewportOffsetY
    });
    // start off screen
    alien.y -= 1.75*alien.h;

    entities.push(alien);
  }
};

function update() {
  switch (screen) {
    case GAME_SCREEN:
      updateScrolling();
      updateHeroInput();
      entities.forEach(updateEntityPositionAndAnimationFrame);
      spawnEnemy();
      entities.forEach(fireBullet);
      entities.forEach((entity1, i) => {
        if (canCollide(entity1)) {
          entities.slice(i + 1).forEach(entity2 => {
            if (canCollide(entity2) && testAABBCollision(entity1, entity2)) {
              entity1.action = entity2.action = 'hit';
              entity1.frameTime = entity2.frameTime = 0;
              entity1.hp -= 1;
              entity2.hp -= 1;
            }
          });
        }
      });
      constrainFlightToViewport();
      updateCameraWindow();
      if (currentTime - lastMirrorTime > MIRROR_DURATION) {
        lastMirrorTime += MIRROR_DURATION;
        invertImage = !invertImage;
        invertTime = currentTime;
      }
      // remove entities who have gone beyond the top of the screen plus 2 sprite height (for safety)
      // and the ones who got passed the bottom of the screen plus 1 sprite height (for safety)
      // and the ones who are dead
      // NOTE: filter actually keeps the entities still in the viewport and alive, discarding the ones to remove
      entities = entities.filter(entity => (
        entity.y < viewportOffsetY + VIEWPORT.height + entity.h
        && entity.y > viewportOffsetY - 2*entity.h
        && !entity.dead
      ));
      flight = flight.filter(ship => !ship.dead);
      // check game over condition
      if (!flight.length) {
        if (score > highscore) {
          save('highscore', score);
          highscore = score;
        }
        screen = END_SCREEN;
      }
      // check if leader is dead
      else if (!flight.filter(ship => ship.type === 'hero').length) {
        const newLeader = flight[0];
        newLeader.type = 'hero';
        // ensure continuity of keyboard/touch inputs
        newLeader.moveDown = hero.moveDown;
        newLeader.moveLeft = hero.moveLeft;
        newLeader.moveRight = hero.moveRight;
        newLeader.moveUp = hero.moveUp;
        newLeader.shooting = hero.shooting;
        // promote the next wingfolk as leader
        hero = newLeader;
      }
      break;
  }
};

// RENDER HANDLERS

function blit() {
  CTX.clearRect(0, 0, c.width, c.height);
  // copy backbuffer onto visible canvas, scaling it to screen dimensions
  CTX.save();
  const t = (currentTime - invertTime) / 500;
  const scaleX = invertImage ? lerp(1, -1, t): lerp(-1, 1, t);
  const x = scaleX < 0 ? -c.width : 0;
  const tx = smoothLerpArray([0, c.width/2, 0], t);
  CTX.translate(tx, 0);
  CTX.scale(scaleX, 1);
  CTX.drawImage(
    VIEWPORT,
    0, 0, VIEWPORT.width, VIEWPORT.height,
    x, 0, c.width, c.height
  );
  CTX.restore();
  // copy text overlay
  CTX.drawImage(
    TEXT,
    0, 0, TEXT.width, TEXT.height,
    0, 0, c.width, c.height
  );
};

function render() {
  TEXT_CTX.clearRect(0, 0, TEXT.width, TEXT.height);
  VIEWPORT_CTX.fillStyle = '#000';
  VIEWPORT_CTX.fillRect(0, 0, VIEWPORT.width, VIEWPORT.height);

  switch (screen) {
    case TITLE_SCREEN:
      renderText('jerome lecomte presents', TEXT.width / 2, CHARSET_SIZE, ALIGN_CENTER, 1);

      renderText('the', TEXT.width / 2, 6*CHARSET_SIZE, ALIGN_CENTER, 2);
      renderText('mirЯ0Я', TEXT.width / 2, 8.6*CHARSET_SIZE, ALIGN_CENTER, 2);
      renderText('dimension', TEXT.width / 2, 11.2*CHARSET_SIZE, ALIGN_CENTER, 2);
      renderText(`${isMobile ? 'swipe' : 'wasd/UDLR'} to move`, TEXT.width / 2, TEXT.height / 2, ALIGN_CENTER);
      renderText(isMobile ? 'autofire on' : '[space] to fire', TEXT.width / 2, TEXT.height / 2 + 2.4 * CHARSET_SIZE, ALIGN_CENTER);
      renderText(`${isMobile ? 'tap' : '[enter]'} to start`, TEXT.width / 2, TEXT.height / 2 + 4.8 * CHARSET_SIZE, ALIGN_CENTER);
      renderText('gamedev.js jam 2021', TEXT.width / 2, TEXT.height - 2* CHARSET_SIZE, ALIGN_CENTER);
      // if (konamiIndex === konamiCode.length) {
      //   renderText('konami mode on', TEXT.width - CHARSET_SIZE, CHARSET_SIZE, ALIGN_RIGHT);
      // }
      break;
    case GAME_SCREEN:
      renderText('score:', CHARSET_SIZE, TEXT.height - 2*CHARSET_SIZE);
      renderText(`${score}`, TEXT.width - CHARSET_SIZE, TEXT.height - 2*CHARSET_SIZE, ALIGN_RIGHT);
      VIEWPORT_CTX.drawImage(
        MAP,
        // adjust x/y offset
        viewportOffsetX, viewportOffsetY, VIEWPORT.width, VIEWPORT.height,
        0, 0, VIEWPORT.width, VIEWPORT.height
      );
      // renderText('game screen', CHARSET_SIZE, CHARSET_SIZE);
      // uncomment to debug mobile input handlers
      // renderDebugTouch();
      entities.forEach(entity => renderReflection(entity));
      entities.forEach(entity => renderEntity(entity));
      renderText(invertImage ? 'mirЯ0Я dimension!' : 'normal space...', TEXT.width / 2, CHARSET_SIZE, ALIGN_CENTER);
      break;
    case END_SCREEN:
      renderText('score:', CHARSET_SIZE, CHARSET_SIZE);
      renderText(`${score}`, TEXT.width - CHARSET_SIZE, CHARSET_SIZE, ALIGN_RIGHT);

      renderText('game over', TEXT.width / 2, TEXT.height / 2 - 4 * CHARSET_SIZE, ALIGN_CENTER, 2);
      renderText(`${isMobile ? 'tap' : '[enter]'} to restart`, TEXT.width / 2, TEXT.height / 2 + 3*CHARSET_SIZE, ALIGN_CENTER);
      renderText(isMobile ? '' : '[t]weet your score', TEXT.width / 2, TEXT.height / 2 + 4.6*CHARSET_SIZE, ALIGN_CENTER);
      if (isMonetizationEnabled()) {
        renderText('coil', CHARSET_SIZE, TEXT.height - 3.6*CHARSET_SIZE);
        renderText(monetizationEarned(), TEXT.width - CHARSET_SIZE, TEXT.height - 3.6*CHARSET_SIZE, ALIGN_RIGHT);
      }
      renderText('highscore:', CHARSET_SIZE, TEXT.height - 2*CHARSET_SIZE);
      renderText(`${highscore}`, TEXT.width - CHARSET_SIZE, TEXT.height - 2*CHARSET_SIZE, ALIGN_RIGHT);
      break;
  }

  blit();
};

// rename to shadow
function renderReflection(entity, ctx = VIEWPORT_CTX) {
  switch(entity.type) {
    case 'hero':
    case 'wingfolk':
      // TODO uncomment once their shadows animated
    // case 'alien1':
    // case 'alien2':
      if (entity.action !== 'dying') {
        const sprite = ATLAS[entity.type]['shadow'][entity.frame];
        // TODO skip draw if image outside of visible canvas
        ctx.drawImage(
          tileset,
          sprite.x, sprite.y, sprite.w, sprite.h,
          Math.round(entity.x - viewportOffsetX), Math.round(entity.y + entity.h - viewportOffsetY), sprite.w, sprite.h
        );
      }
      break;
  }
}

function renderEntity(entity, ctx = VIEWPORT_CTX) {
  const sprite = ATLAS[entity.type][entity.action][entity.frame];
  // TODO skip draw if image outside of visible canvas
  ctx.drawImage(
    tileset,
    sprite.x, sprite.y, sprite.w, sprite.h,
    Math.round(entity.x - viewportOffsetX), Math.round(entity.y - viewportOffsetY), sprite.w, sprite.h
  );
  // DEBUG render bounding box
  // ctx.lineWidth = 1;
  // ctx.strokeStyle = '#bad';
  // ctx.strokeRect(
  //   Math.round(entity.x - viewportOffsetX + entity.hitBox.x),
  //   Math.round(entity.y - viewportOffsetY + entity.hitBox.y),
  //   entity.hitBox.w,
  //   entity.hitBox.h
  // )
};

function renderMap() {
  MAP_CTX.drawImage(
    levelset,
    0, 0, MAP.width, MAP.height / 2
  )
  MAP_CTX.drawImage(
    levelset,
    0, MAP.height / 2, MAP.width, MAP.height / 2
  )
};

// LOOP HANDLERS

function loop() {
  if (running) {
    requestId = requestAnimationFrame(loop);
    render();
    currentTime = Date.now();
    elapsedTime = (currentTime - lastTime) / 1000;
    update();
    lastTime = currentTime;
  }
};

function toggleLoop(value) {
  running = value;
  if (running) {
    lastTime = Date.now();
    loop();
  } else {
    cancelAnimationFrame(requestId);
  }
};

// EVENT HANDLERS

onload = async (e) => {
  // the real "main" of the game
  document.title = 'The MIЯЯ0Я Dimension';

  onresize();
  checkMonetization();

  await initCharset(TEXT_CTX);
  tileset = await loadImg(TILESET);
  levelset = await loadImg(LEVELSET);

  texts = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => `Red ${i} taking point`);
  speak = await initSpeech(texts);

  toggleLoop(true);
};

onresize = onrotate = function() {
  // scale canvas to fit screen while maintaining aspect ratio
  const scaleToFit = Math.min(innerWidth / VIEWPORT.width, innerHeight / VIEWPORT.height);
  c.width = VIEWPORT.width * scaleToFit;
  c.height = VIEWPORT.height * scaleToFit;
  // disable smoothing on image scaling
  CTX.imageSmoothingEnabled = MAP_CTX.imageSmoothingEnabled = TEXT_CTX.imageSmoothingEnabled = VIEWPORT_CTX.imageSmoothingEnabled = false;
  // fix key events not received on itch.io when game loads in full screen
  window.focus();
};

// UTILS

document.onvisibilitychange = function(e) {
  // pause loop and game timer when switching tabs
  toggleLoop(!e.target.hidden);
};

// INPUT HANDLERS

onkeydown = function(e) {
  // prevent itch.io from scrolling the page up/down
  e.preventDefault();

  if (!e.repeat) {
    switch (screen) {
      case GAME_SCREEN:
        switch (e.code) {
          case 'ArrowLeft':
          case 'KeyA':
          case 'KeyQ':  // French keyboard support
            hero.moveLeft = currentTime;
            break;
          case 'ArrowUp':
          case 'KeyW':
          case 'KeyZ':  // French keyboard support
            hero.moveUp = currentTime;
            break;
          case 'ArrowRight':
          case 'KeyD':
            hero.moveRight = currentTime;
            break;
          case 'ArrowDown':
          case 'KeyS':
            hero.moveDown = currentTime;
            break;
          case 'Space':
            flight.forEach(ship => {
              ship.shooting = currentTime;
              // make each ship fire immediately
              ship.fireTime = ship.fireCadence
            });
            break;
          case 'KeyM':
            invertImage = !invertImage;
            invertTime = currentTime;
            break;
          case 'KeyP':
            // Pause game as soon as key is pressed
            toggleLoop(!running);
            break;
        }
        break;
    }
  }
};

onkeyup = function(e) {
  switch (screen) {
    case TITLE_SCREEN:
      switch (e.code) {
        case 'Enter':
          startGame();
          break;
        default:
          if (e.which === konamiCode[konamiIndex] && konamiIndex < konamiCode.length) {
            konamiIndex++;
          }
      }
      break;
    case GAME_SCREEN:
      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
        case 'KeyQ': // French keyboard support
          if (hero.moveRight) {
            // reversing right while hero moving left
            hero.moveRight = currentTime;
          }
          hero.moveLeft = 0;
          break;
        case 'ArrowRight':
        case 'KeyD':
          if (hero.moveLeft) {
            // reversing left while hero moving right
            hero.moveLeft = currentTime;
          }
          hero.moveRight = 0;
          break;
        case 'ArrowUp':
        case 'KeyW':
        case 'KeyZ': // French keyboard support
          if (hero.moveDown) {
            // reversing down while hero moving up
            hero.moveDown = currentTime;
          }
          hero.moveUp = 0;
          break;
        case 'ArrowDown':
        case 'KeyS':
          if (hero.moveUp) {
            // reversing up while hero moving down
            hero.moveUp = currentTime;
          }
          hero.moveDown = 0;
          break;
        case 'Space':
          flight.forEach(ship => { ship.shooting = 0 });
      }
      break;
    case END_SCREEN:
      switch (e.code) {
        case 'KeyT':
          open(`https://twitter.com/intent/tweet?text=I%20scored%20${score}%20in%20The%20MIR%D0%AF0%D0%AF%20Dimension%20by%20%40herebefrogs%20for%20%23gamedevjs%202021%0Ahttps%3A%2F%2Fbit.ly%2Fmirrord`, '_blank');
          break;
        case 'Enter':
          startGame();
          break;
      }
      break;
  }
};

// MOBILE INPUT HANDLERS

let minX = 0;
let minY = 0;
let maxX = 0;
let maxY = 0;
let MIN_DISTANCE = 30; // in px
let touches = [];
let isTouch = false;

// adding onmousedown/move/up triggers a MouseEvent and a PointerEvent
// on platform that support both (duplicate event, pointer > mouse || touch)
ontouchstart = onpointerdown = function(e) {
  e.preventDefault();
  switch (screen) {
    case GAME_SCREEN:
      isTouch = true;
      [maxX, maxY] = [minX, minY] = pointerLocation(e);
      break;
  }
};

ontouchmove = onpointermove = function(e) {
  e.preventDefault();
  switch (screen) {
    case GAME_SCREEN:
      if (minX && minY) {
        setTouchPosition(pointerLocation(e));
      }
      break;
  }
}

ontouchend = onpointerup = function(e) {
  e.preventDefault();
  switch (screen) {
    case TITLE_SCREEN:
      startGame();
      break;
    case GAME_SCREEN:
      isTouch = false;
      // stop hero
      hero.moveLeft = hero.moveRight = hero.moveDown = hero.moveUp = 0;
      // end touch
      minX = minY = maxX = maxY = 0;
      break;
    case END_SCREEN:
      screen = TITLE_SCREEN;
      break;
  }
};

// utilities
function pointerLocation(e) {
  return [e.pageX || e.changedTouches[0].pageX, e.pageY || e.changedTouches[0].pageY];
};

function setTouchPosition([x, y]) {
  // touch moving further right
  if (x > maxX) {
    maxX = x;
    hero.moveRight = lerp(0, 1, (maxX - minX) / MIN_DISTANCE)
  }
  // touch moving further left
  else if (x < minX) {
    minX = x;
    hero.moveLeft = -lerp(0, 1, (maxX - minX) / MIN_DISTANCE)
  }
  // touch reversing left while hero moving right
  else if (x < maxX && hero.moveX >= 0) {
    minX = x;
    hero.moveRight = 0;
  }
  // touch reversing right while hero moving left
  else if (minX < x && hero.moveX <= 0) {
    maxX = x;
    hero.moveLeft = 0;
  }

  // touch moving further down
  if (y > maxY) {
    maxY = y;
    hero.moveDown = lerp(0, 1, (maxY - minY) / MIN_DISTANCE)

  }
  // touch moving further up
  else if (y < minY) {
    minY = y;
    hero.moveUp = -lerp(0, 1, (maxY - minY) / MIN_DISTANCE)

  }
  // touch reversing up while hero moving down
  else if (y < maxY && hero.moveY >= 0) {
    minY = y;
    hero.moveDown = 0;
  }
  // touch reversing down while hero moving up
  else if (minY < y && hero.moveY <= 0) {
    maxY = y;
    hero.moveUp = 0;
  }

  // uncomment to debug mobile input handlers
  // addDebugTouch(x, y);
};

function addDebugTouch(x, y) {
  touches.push([x / innerWidth * VIEWPORT.width, y / innerHeight * VIEWPORT.height]);
  if (touches.length > 10) {
    touches = touches.slice(touches.length - 10);
  }
};

function renderDebugTouch() {
  let x = maxX / innerWidth * VIEWPORT.width;
  let y = maxY / innerHeight * VIEWPORT.height;
  renderDebugTouchBound(x, x, 0, VIEWPORT.height, '#f00');
  renderDebugTouchBound(0, VIEWPORT.width, y, y, '#f00');
  x = minX / innerWidth * VIEWPORT.width;
  y = minY / innerHeight * VIEWPORT.height;
  renderDebugTouchBound(x, x, 0, VIEWPORT.height, '#ff0');
  renderDebugTouchBound(0, VIEWPORT.width, y, y, '#ff0');

  if (touches.length) {
    VIEWPORT_CTX.strokeStyle = VIEWPORT_CTX.fillStyle =   '#02d';
    VIEWPORT_CTX.beginPath();
    [x, y] = touches[0];
    VIEWPORT_CTX.moveTo(x, y);
    touches.forEach(function([x, y]) {
      VIEWPORT_CTX.lineTo(x, y);
    });
    VIEWPORT_CTX.stroke();
    VIEWPORT_CTX.closePath();
    VIEWPORT_CTX.beginPath();
    [x, y] = touches[touches.length - 1];
    VIEWPORT_CTX.arc(x, y, 2, 0, 2 * Math.PI)
    VIEWPORT_CTX.fill();
    VIEWPORT_CTX.closePath();
  }
};

function renderDebugTouchBound(_minX, _maxX, _minY, _maxY, color) {
  VIEWPORT_CTX.strokeStyle = color;
  VIEWPORT_CTX.beginPath();
  VIEWPORT_CTX.moveTo(_minX, _minY);
  VIEWPORT_CTX.lineTo(_maxX, _maxY);
  VIEWPORT_CTX.stroke();
  VIEWPORT_CTX.closePath();
};
