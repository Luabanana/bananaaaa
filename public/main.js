let camera, scene, renderer, controls;
let overlay = document.getElementById("overlay");
let startButton = document.getElementById("startButton");

startButton.addEventListener("click", () => {
    overlay.style.display = "none"; // verberg startscherm
    startGame();
});

function startGame() {
    controls.lock(); // muis locken
    animate();
}


// 3D AI Arena - PointerLock FPS-lite (no module imports; uses global THREE)
let scene, camera, renderer, controls;
let bullets = [], enemies = [], walls = [];
let clock = new THREE.Clock();
let keys = { w:false, a:false, s:false, d:false, shift:false };
let speed = 10; // base move speed
let sprintMul = 1.6;
let playerHP = 100;
let score = 0;
let level = 1;
let playing = false;

const uiHP = document.getElementById('hp');
const uiScore = document.getElementById('score');
const uiLevel = document.getElementById('level');
const msg = document.getElementById('msg');
const gameOver = document.getElementById('gameOver');
const finalStats = document.getElementById('finalStats');
const restartBtn = document.getElementById('restartBtn');
const startBtn = document.getElementById('startBtn');

// Crosshair
const crosshair = document.createElement('div');
crosshair.className = 'crosshair';
document.body.appendChild(crosshair);

// ---------- Init ----------
init();
animate();

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0f1a);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(0, 1.6, 10);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  controls = new THREE.PointerLockControls(camera, document.body);
  controls.getObject().position.set(0, 1.6, 0);
  scene.add(controls.getObject());

  // Lights
  const hemi = new THREE.HemisphereLight(0xffffff, 0x223355, 0.6);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(5, 10, 2);
  dir.castShadow = true;
  scene.add(dir);

  // Floor
  const floorGeo = new THREE.PlaneGeometry(200, 200);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.05, roughness: 0.9 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI/2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Arena objects
  createArena();

  // Events
  window.addEventListener('resize', onResize);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousedown', onMouseDown);

  // Start via button (guaranteed user gesture for pointer lock)
  startBtn.addEventListener('click', () => {
    if (!playing) {
      startGame(/*withPointerLock*/true);
    }
  });

  // Also allow pressing Enter to start (pointer lock may be blocked by browser, but start anyway)
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Enter' && !playing) {
      startGame(/*withPointerLock*/true); // try to lock; if blocked, user can click once to lock
    }
  });

  restartBtn.addEventListener('click', () => {
    resetGame();
    startGame(true);
  });

  // If user clicks anywhere on canvas while not playing, start & lock
  document.body.addEventListener('click', () => {
    if (!playing) startGame(true);
  });
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onKeyDown(e) {
  switch (e.code) {
    case 'KeyW': keys.w = true; break;
    case 'KeyA': keys.a = true; break;
    case 'KeyS': keys.s = true; break;
    case 'KeyD': keys.d = true; break;
    case 'ShiftLeft': 
    case 'ShiftRight':
      keys.shift = true; break;
  }
}
function onKeyUp(e) {
  switch (e.code) {
    case 'KeyW': keys.w = false; break;
    case 'KeyA': keys.a = false; break;
    case 'KeyS': keys.s = false; break;
    case 'KeyD': keys.d = false; break;
    case 'ShiftLeft': 
    case 'ShiftRight':
      keys.shift = false; break;
  }
}

function onMouseDown(e) {
  if (!playing) return;
  if (document.pointerLockElement !== document.body) {
    controls.lock();
    return;
  }
  if (e.button === 0) fire();
}

function startGame(lockPointer) {
  msg.classList.add('hidden');
  gameOver.classList.add('hidden');
  playing = true;
  if (lockPointer) controls.lock();
  spawnLevel(level);
}

function resetGame() {
  enemies.forEach(e => scene.remove(e.mesh));
  bullets.forEach(b => scene.remove(b.mesh));
  enemies = [];
  bullets = [];
  level = 1;
  score = 0;
  playerHP = 100;
  uiHP.textContent = playerHP.toString();
  uiLevel.textContent = level.toString();
  uiScore.textContent = score.toString();
  controls.getObject().position.set(0, 1.6, 0);
}

function spawnLevel(n) {
  const count = Math.min(2 + n, 20);
  for (let i = 0; i < count; i++) {
    const pos = randomSpawnPos(25, 60);
    enemies.push(createEnemy(pos, 2 + n * 0.2));
  }
  uiLevel.textContent = n.toString();
}

function randomSpawnPos(minR, maxR) {
  const angle = Math.random() * Math.PI * 2;
  const r = minR + Math.random() * (maxR - minR);
  return new THREE.Vector3(Math.cos(angle) * r, 0, Math.sin(angle) * r);
}

function createArena() {
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.1, roughness: 0.8 });
  const wallGeo = new THREE.BoxGeometry(6, 4, 1);
  const positions = [
    [0, 0, -12], [0, 0, 12], [12, 0, 0], [-12, 0, 0],
    [18, 0, 18], [-18, 0, 18], [18, 0, -18], [-18, 0, -18],
  ];
  positions.forEach(p => {
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.set(p[0], 2, p[2]);
    wall.castShadow = true; wall.receiveShadow = true;
    scene.add(wall);
    walls.push(wall);
  });

  const rimMat = wallMat;
  const rim1 = new THREE.Mesh(new THREE.BoxGeometry(1, 3, 100), rimMat); rim1.position.set(50, 1.5, 0);
  const rim2 = new THREE.Mesh(new THREE.BoxGeometry(1, 3, 100), rimMat); rim2.position.set(-50, 1.5, 0);
  const rim3 = new THREE.Mesh(new THREE.BoxGeometry(100, 3, 1), rimMat); rim3.position.set(0, 1.5, 50);
  const rim4 = new THREE.Mesh(new THREE.BoxGeometry(100, 3, 1), rimMat); rim4.position.set(0, 1.5, -50);
  [rim1,rim2,rim3,rim4].forEach(r => { r.receiveShadow = true; scene.add(r); walls.push(r); });
}

function createEnemy(pos, speed=2.5) {
  const geo = new THREE.SphereGeometry(0.6, 18, 18);
  const mat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0x220000, roughness: 0.6 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(pos).setY(0.6);
  mesh.castShadow = true;
  scene.add(mesh);
  return {
    mesh,
    speed,
    hp: 3 + Math.floor(level * 0.4),
    cooldown: 0,
  };
}

function fire() {
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const origin = controls.getObject().position.clone().add(new THREE.Vector3(0, 0.2, 0));

  const geo = new THREE.SphereGeometry(0.08, 12, 12);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(origin);
  scene.add(mesh);

  bullets.push({
    mesh,
    dir: dir.clone(),
    speed: 60,
    life: 1.5,
  });
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());

  if (playing) {
    updatePlayer(dt);
    updateBullets(dt);
    updateEnemies(dt);
  }

  renderer.render(scene, camera);
}

function updatePlayer(dt) {
  let move = new THREE.Vector3();
  const dir = getForward();

  const forward = new THREE.Vector3(dir.x, 0, dir.z).normalize();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0,1,0)).negate().normalize();

  if (keys.w) move.add(forward);
  if (keys.s) move.sub(forward);
  if (keys.a) move.sub(right);
  if (keys.d) move.add(right);

  const moveLen = move.length();
  if (moveLen > 0) move.divideScalar(moveLen);

  const spd = speed * (keys.shift ? sprintMul : 1);
  move.multiplyScalar(spd * dt);

  const next = controls.getObject().position.clone().add(move);
  const radius = 0.4;
  if (!collides(next, radius)) {
    controls.getObject().position.copy(next);
  } else {
    const tryX = controls.getObject().position.clone().add(new THREE.Vector3(move.x,0,0));
    if (!collides(tryX, radius)) controls.getObject().position.copy(tryX);
    const tryZ = controls.getObject().position.clone().add(new THREE.Vector3(0,0,move.z));
    if (!collides(tryZ, radius)) controls.getObject().position.copy(tryZ);
  }
}

function collides(pos, radius) {
  if (Math.abs(pos.x) > 49 - radius || Math.abs(pos.z) > 49 - radius) return true;
  for (const w of walls) {
    const box = new THREE.Box3().setFromObject(w);
    box.min.x -= radius; box.min.z -= radius;
    box.max.x += radius; box.max.z += radius;
    const point = new THREE.Vector3(pos.x, w.position.y, pos.z);
    if (box.containsPoint(point)) return true;
  }
  return false;
}

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.mesh.position.addScaledVector(b.dir, b.speed * dt);
    b.life -= dt;

    if (collides(b.mesh.position, 0.05)) {
      scene.remove(b.mesh);
      bullets.splice(i,1);
      continue;
    }
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      const d = e.mesh.position.distanceTo(b.mesh.position);
      if (d < 0.6) {
        e.hp -= 1;
        scene.remove(b.mesh);
        bullets.splice(i,1);
        if (e.hp <= 0) {
          scene.remove(e.mesh);
          enemies.splice(j,1);
          score += 10;
          uiScore.textContent = score.toString();
          if (enemies.length === 0) {
            level++;
            spawnLevel(level);
          }
        }
        break;
      }
    }

    if (b.life <= 0) {
      scene.remove(b.mesh);
      bullets.splice(i,1);
    }
  }
}

function updateEnemies(dt) {
  const playerPos = controls.getObject().position;
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    const toPlayer = new THREE.Vector3().subVectors(playerPos, e.mesh.position);
    const dist = toPlayer.length();
    toPlayer.y = 0;

    if (dist > 0.001) {
      toPlayer.normalize();
      const step = e.speed * dt;
      const desired = e.mesh.position.clone().addScaledVector(toPlayer, step);

      if (!collides(desired, 0.5)) {
        e.mesh.position.copy(desired);
      } else {
        const side = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x).multiplyScalar(0.6 * step);
        const alt = e.mesh.position.clone().add(side);
        if (!collides(alt, 0.5)) e.mesh.position.copy(alt);
      }
    }

    if (dist < 1.0) {
      if (e.cooldown <= 0) {
        playerHP -= 10;
        uiHP.textContent = Math.max(0, playerHP).toString();
        e.cooldown = 0.8;
        const push = new THREE.Vector3().subVectors(playerPos, e.mesh.position).setY(0).normalize().multiplyScalar(2.0);
        const next = playerPos.clone().add(push);
        if (!collides(next, 0.4)) controls.getObject().position.copy(next);
        if (playerHP <= 0) {
          endGame();
          return;
        }
      }
    }
    e.cooldown = Math.max(0, e.cooldown - dt);
  }
}

function endGame() {
  playing = false;
  controls.unlock();
  finalStats.textContent = `Je haalde level ${level} met score ${score}.`;
  gameOver.classList.remove('hidden');
}

// Helpers
function getForward() {
  const obj = controls.getObject();
  const dir = new THREE.Vector3(0,0,-1);
  dir.applyQuaternion(obj.quaternion);
  return dir;
}
