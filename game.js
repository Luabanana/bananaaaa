const socket = io('http://localhost:3000');

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0x606060, 0.5);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
directionalLight.position.set(1, 1, 1).normalize();
scene.add(directionalLight);

// Block materials
const blockMaterials = {
    grass: new THREE.MeshLambertMaterial({ color: 0x228B22 }),
    dirt: new THREE.MeshLambertMaterial({ color: 0x8B4513 }),
    stone: new THREE.MeshLambertMaterial({ color: 0xC0C0C0 }),
    coal: new THREE.MeshLambertMaterial({ color: 0x333333 }),
    water: new THREE.MeshLambertMaterial({ color: 0x1E90FF, transparent: true, opacity: 0.7 })
};

// World and block management
const world = {};
const blockGeometry = new THREE.BoxGeometry(1, 1, 1);
const renderDistance = 16;
let lowPerformance = false;

// Toggle performance mode
document.getElementById('performance-toggle').addEventListener('click', () => {
    lowPerformance = !lowPerformance;
    document.getElementById('performance-toggle').textContent = `Performance Mode: ${lowPerformance ? 'Low' : 'High'}`;
});

// Player controls
const pointerLockControls = new (function() {
    let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false, isSprinting = false;
    const velocity = new THREE.Vector3();
    const direction = new THREE.Vector3();
    const acceleration = 0.005;
    const friction = 0.85;
    const baseSpeed = 0.06;
    const sprintMultiplier = 1.5;
    const playerHeight = 1.8;
    const playerWidth = 0.6;
    const eyeLevel = 1.62;
    const stepHeight = 0.5;

    document.addEventListener('keydown', (event) => {
        switch (event.code) {
            case 'KeyW': moveForward = true; break;
            case 'KeyS': moveBackward = true; break;
            case 'KeyA': moveLeft = true; break;
            case 'KeyD': moveRight = true; break;
            case 'ShiftLeft': isSprinting = true; document.getElementById('sprint-status').style.display = 'block'; break;
            case 'Space': if (velocity.y === 0) velocity.y = 0.18; break;
            case 'Digit1': selectBlockType('grass', 0); break;
            case 'Digit2': selectBlockType('dirt', 1); break;
            case 'Digit3': selectBlockType('stone', 2); break;
            case 'Digit4': selectBlockType('coal', 3); break;
        }
    });

    document.addEventListener('keyup', (event) => {
        switch (event.code) {
            case 'KeyW': moveForward = false; break;
            case 'KeyS': moveBackward = false; break;
            case 'KeyA': moveLeft = false; break;
            case 'KeyD': moveRight = false; break;
            case 'ShiftLeft': isSprinting = false; document.getElementById('sprint-status').style.display = 'none'; break;
        }
    });

    renderer.domElement.addEventListener('click', () => {
        renderer.domElement.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
        if (document.pointerLockElement === renderer.domElement) {
            document.addEventListener('mousemove', onMouseMove);
        } else {
            document.removeEventListener('mousemove', onMouseMove);
        }
    });

    function onMouseMove(event) {
        camera.rotation.y -= event.movementX * 0.002;
        camera.rotation.x -= event.movementY * 0.002;
        camera.rotation.x = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, camera.rotation.x));
    }

    this.update = function() {
        velocity.x *= friction;
        velocity.z *= friction;
        velocity.y -= 0.004;
        if (velocity.y < -0.2) velocity.y = -0.2;

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();

        const speed = isSprinting ? baseSpeed * sprintMultiplier : baseSpeed;
        velocity.x += direction.x * acceleration * (isSprinting ? 1.2 : 1);
        velocity.z += direction.z * acceleration * (isSprinting ? 1.2 : 1);

        const horizontalSpeed = Math.sqrt(velocity.x ** 2 + velocity.z ** 2);
        const maxSpeed = isSprinting ? baseSpeed * sprintMultiplier : baseSpeed;
        if (horizontalSpeed > maxSpeed) {
            const scale = maxSpeed / horizontalSpeed;
            velocity.x *= scale;
            velocity.z *= scale;
        }

        let newPosition = camera.position.clone().add(velocity);
        let canMove = true;
        let stepY = 0;

        const playerBox = {
            min: new THREE.Vector3(newPosition.x - playerWidth / 2, newPosition.y - eyeLevel, newPosition.z - playerWidth / 2),
            max: new THREE.Vector3(newPosition.x + playerWidth / 2, newPosition.y - eyeLevel + playerHeight, newPosition.z + playerWidth / 2)
        };

        for (let key in world) {
            const [x, y, z] = key.split(',').map(Number);
            const blockBox = { min: new THREE.Vector3(x, y, z), max: new THREE.Vector3(x + 1, y + 1, z + 1) };
            if (boxesIntersect(playerBox, blockBox)) {
                if (y + 1 <= newPosition.y - eyeLevel + stepHeight) {
                    stepY = Math.max(stepY, y + 1 - (newPosition.y - eyeLevel));
                } else {
                    canMove = false;
                    break;
                }
            }
        }

        if (canMove) {
            newPosition.y += stepY;
            camera.position.copy(newPosition);
        } else {
            velocity.x = velocity.z = 0;
        }

        if (camera.position.y < eyeLevel) {
            camera.position.y = eyeLevel;
            velocity.y = 0;
        }

        updateVisibleBlocks();
        socket.emit('playerMove', { id: socket.id, position: camera.position, sprinting: isSprinting });
    };

    function boxesIntersect(box1, box2) {
        return (box1.min.x < box2.max.x && box1.max.x > box2.min.x) &&
               (box1.min.y < box2.max.y && box1.max.y > box2.min.y) &&
               (box1.min.z < box2.max.z && box1.max.z > box2.min.z);
    }
})();

// Block rendering optimization
const blockMeshes = {};
let selectedBlockType = 'grass';

function updateVisibleBlocks() {
    const cx = Math.floor(camera.position.x);
    const cz = Math.floor(camera.position.z);

    // Clear old meshes in low performance mode
    if (lowPerformance) {
        for (let key in blockMeshes) {
            scene.remove(blockMeshes[key]);
            delete blockMeshes[key];
        }
    }

    for (let key in world) {
        const [x, y, z] = key.split(',').map(Number);
        if (Math.abs(x - cx) > renderDistance || Math.abs(z - cz) > renderDistance) {
            if (blockMeshes[key]) {
                scene.remove(blockMeshes[key]);
                delete blockMeshes[key];
            }
            continue;
        }

        if (!blockMeshes[key]) {
            const mesh = new THREE.Mesh(blockGeometry, blockMaterials[world[key]]);
            mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
            scene.add(mesh);
            blockMeshes[key] = mesh;
        }
    }
}

function selectBlockType(type, index) {
    selectedBlockType = type;
    document.querySelectorAll('.hotbar-slot').forEach((slot, i) => {
        slot.classList.toggle('selected', i === index);
    });
}

// Load initial world
socket.on('worldData', (worldData) => {
    Object.assign(world, worldData);
    updateVisibleBlocks();
});

// Raycaster for block interaction
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

renderer.domElement.addEventListener('mousedown', (event) => {
    event.preventDefault();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(Object.values(blockMeshes));

    if (intersects.length > 0) {
        const intersect = intersects[0];
        const pos = intersect.object.position.clone().floor();

        if (event.button === 0) {
            const key = `${pos.x - 0.5},${pos.y - 0.5},${pos.z - 0.5}`;
            if (world[key]) {
                delete world[key];
                scene.remove(blockMeshes[key]);
                delete blockMeshes[key];
                socket.emit('blockUpdate', { position: key, type: null });
            }
        } else if (event.button === 2) {
            const normal = intersect.face.normal;
            const newPos = pos.add(normal);
            const key = `${newPos.x - 0.5},${newPos.y - 0.5},${newPos.z - 0.5}`;
            if (!world[key] && Math.abs(newPos.x - camera.position.x) > 0.5 && Math.abs(newPos.z - camera.position.z) > 0.5) {
                world[key] = selectedBlockType;
                const mesh = new THREE.Mesh(blockGeometry, blockMaterials[selectedBlockType]);
                mesh.position.set(newPos.x, newPos.y, newPos.z);
                scene.add(mesh);
                blockMeshes[key] = mesh;
                socket.emit('blockUpdate', { position: key, type: selectedBlockType });
            }
        }
    }
});

// Handle block updates
socket.on('blockUpdate', (data) => {
    const { position, type } = data;
    if (type) {
        world[position] = type;
        const [x, y, z] = position.split(',').map(Number);
        if (Math.abs(x - camera.position.x) <= renderDistance && Math.abs(z - camera.position.z) <= renderDistance) {
            const mesh = new THREE.Mesh(blockGeometry, blockMaterials[type]);
            mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
            scene.add(mesh);
            blockMeshes[position] = mesh;
        }
    } else {
        delete world[position];
        if (blockMeshes[position]) {
            scene.remove(blockMeshes[position]);
            delete blockMeshes[position];
        }
    }
});

// Handle other players
const otherPlayers = {};
socket.on('playerMove', (data) => {
    if (data.id !== socket.id) {
        if (!otherPlayers[data.id]) {
            const geometry = new THREE.BoxGeometry(0.6, 1.8, 0.6);
            const material = new THREE.MeshLambertMaterial({ color: data.sprinting ? 0xff0000 : 0x0000ff });
            otherPlayers[data.id] = new THREE.Mesh(geometry, material);
            scene.add(otherPlayers[data.id]);
        }
        otherPlayers[data.id].position.copy(data.position);
        otherPlayers[data.id].material.color.set(data.sprinting ? 0xff0000 : 0x0000ff);
    }
});

socket.on('playerDisconnect', (id) => {
    if (otherPlayers[id]) {
        scene.remove(otherPlayers[id]);
        delete otherPlayers[id];
    }
});

// Camera position
camera.position.set(16, 10, 16);

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    pointerLockControls.update();
    renderer.render(scene, camera);
}
animate();

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});