import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { ChunkManager } from './ChunkManager.js';
import { PlayerData } from './Player.js';
import { MonsterManager } from './Monsters.js';

let scene, camera, renderer, controls, minimapCamera;
let chunkManager, player, monsterManager;
let weapons = {};
let audioListener, bgm;

async function init() {
    const container = document.getElementById('game-container');
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    const skyColor = '#87CEEB';
    scene.background = new THREE.Color(skyColor); 
    scene.fog = new THREE.Fog(skyColor, 100, 150);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    minimapCamera = new THREE.OrthographicCamera(-100, 100, 100, -100, 1, 1000);
    minimapCamera.up.set(0, 0, -1);

    audioListener = new THREE.AudioListener();
    camera.add(audioListener);
    
    const playerModel = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({color: 0x3498db});
    const pBody = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.4), bodyMat); pBody.position.y = 0.9;
    const pHead = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), bodyMat); pHead.position.y = 1.5;
    playerModel.add(pBody, pHead);
    scene.add(playerModel);

    const cameraPivot = new THREE.Group();
    scene.add(cameraPivot);
    cameraPivot.add(camera);
    camera.position.set(0, 1.5, 4); 
    
    controls = new PointerLockControls(cameraPivot, document.body);
    window.gameControls = controls;
    
    window.shakeScreen = (intensity) => {
        const start = performance.now();
        const shake = () => {
            const elapsed = performance.now() - start;
            if (elapsed < 500) {
                const amount = intensity * (1 - elapsed / 500);
                camera.position.x += (Math.random() - 0.5) * amount;
                camera.position.y += (Math.random() - 0.5) * amount;
                requestAnimationFrame(shake);
            }
        };
        shake();
    };

    const intro = document.getElementById('intro-overlay');
    const startAction = () => {
        if (!('ontouchstart' in window)) controls.lock();
        intro.style.display = 'none';
        if(!bgm) {
            try {
                const ctx = audioListener.context;
                const osc = ctx.createOscillator();
                osc.type = 'sine'; osc.frequency.value = 110;
                const gain = ctx.createGain(); gain.gain.value = 0.05;
                osc.connect(gain); gain.connect(ctx.destination);
                osc.start();
                bgm = true;
            } catch(e) {}
        }
    };
    
    intro.addEventListener('click', startAction);
    intro.addEventListener('touchstart', (e) => { e.preventDefault(); startAction(); }, {passive: false});
    controls.addEventListener('lock', () => intro.style.display = 'none');

    const loader = new THREE.ImageLoader();
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 32;
    const ctx = canvas.getContext('2d');
    const blockUrls = [
        'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.16.4/blocks/grass_block_side.png',
        'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.16.4/blocks/dirt.png',
        'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.16.4/blocks/stone.png',
        'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.16.4/blocks/oak_log.png',
        'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.16.4/blocks/oak_leaves.png',
        'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.16.4/blocks/poppy.png',
        'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.16.4/blocks/cactus_side.png',
        'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.16.4/blocks/iron_block.png',
        'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.16.4/blocks/oak_planks.png',
        'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.16.4/blocks/glass.png',
        'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.16.4/blocks/water_still.png',
    ];
    await Promise.all(blockUrls.map((url, i) => new Promise(res => {
        loader.load(url, img => { ctx.drawImage(img, i*32, 0, 32, 32); res(); }, undefined, () => {
            ctx.fillStyle = '#ff00ff'; ctx.fillRect(i*32, 0, 32, 32); res(); 
        });
    })));
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;

    chunkManager = new ChunkManager(scene, texture);
    player = new PlayerData();
    await player.load(); 
    monsterManager = new MonsterManager(scene);

    chunkManager.updatePlayerPosition(player.position.x, player.position.z);
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const sun = new THREE.DirectionalLight(0xffffff, 0.6); sun.position.set(50, 100, 50); scene.add(sun);

    const weaponGroup = new THREE.Group(); camera.add(weaponGroup);
    weapons.stick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8), new THREE.MeshLambertMaterial({color: 0x8B4513}));
    weapons.stick.position.set(0.4, -0.4, -0.5); weapons.stick.rotation.x = -Math.PI/3;
    weaponGroup.add(weapons.stick);
    weapons.sword = new THREE.Group();
    const s_h = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.1), new THREE.MeshLambertMaterial({color: 0x444444}));
    const s_b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, 0.03), new THREE.MeshLambertMaterial({color: 0xADD8E6}));
    s_b.position.y = 0.4; weapons.sword.add(s_h, s_b); weapons.sword.position.set(0.5, -0.5, -0.7); weapons.sword.rotation.x = -Math.PI/3;
    weaponGroup.add(weapons.sword);
    weapons.bow = new THREE.Group();
    const b_c = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.02, 8, 12, Math.PI), new THREE.MeshLambertMaterial({color: 0x8B4513}));
    b_c.rotation.y = Math.PI/2; weapons.bow.add(b_c); weapons.bow.position.set(0.4, -0.3, -0.6);
    weaponGroup.add(weapons.bow);

    let curBlock = 10;
    const select = (id) => {
        curBlock = id;
        document.querySelectorAll('.hotbar-item').forEach(el => el.classList.remove('active'));
        const item = document.querySelector(`.hotbar-item[data-block="${id}"]`);
        if(item) item.classList.add('active');
        weapons.stick.visible = (id === 10);
        weapons.sword.visible = (id === 11 && (player.weapons.sword || 0) > 0);
        weapons.bow.visible = (id === 9 && (player.weapons.bow || 0) > 0);
    };
    select(10);

    document.querySelectorAll('.hotbar-item').forEach(el => {
        const handler = (e) => { e.preventDefault(); e.stopPropagation(); select(parseInt(el.dataset.block)); };
        el.addEventListener('click', handler);
        el.addEventListener('touchstart', handler, {passive: false});
    });

    let swinging = false;
    const attack = () => {
        if (swinging) return;
        let wpName = "";
        if (curBlock === 10) wpName = "stick";
        else if (curBlock === 11) wpName = "sword";
        else if (curBlock === 9) wpName = "bow";
        
        if (!wpName || (wpName !== 'stick' && (player.weapons[wpName] || 0) === 0)) {
            if(wpName) player.showNotification(`Unlock ${wpName} first!`);
            return;
        }

        swinging = true;
        const activeWeapon = weapons[wpName];
        const weaponTier = player.weapons[wpName] || 1;
        const range = wpName === 'stick' ? 3 : (wpName === 'sword' ? 4.5 : 20);
        const damage = (wpName === 'stick' ? 1 : (wpName === 'sword' ? 3 : 2)) * weaponTier * (1 + player.level * 0.1);

        const startZ = activeWeapon.position.z;
        let startT = performance.now();
        const anim = () => {
            let elap = (performance.now()-startT)/150;
            if(elap<1){ activeWeapon.position.z = startZ + Math.sin(elap * Math.PI) * 0.2; requestAnimationFrame(anim); }
            else { activeWeapon.position.z = startZ; swinging = false; }
        }; anim();

        const ray = new THREE.Raycaster();
        const pObj = controls.getObject();
        const dir = new THREE.Vector3(); pObj.getWorldDirection(dir);
        ray.set(pObj.position, dir); ray.far = range;

        const monsterMeshes = [];
        monsterManager.monsters.forEach(m => monsterMeshes.push(...m.group.children));
        const hits = ray.intersectObjects(monsterMeshes, false);
        if(hits.length > 0) {
            let obj = hits[0].object;
            while(obj.parent && !obj.userData.monster) obj = obj.parent;
            if(obj.userData.monster) {
                obj.userData.monster.takeDamage(damage);
                player.showFloatingText(`-${Math.floor(damage)}`, '#ff0000');
            }
        }
    };

    const triggerInteraction = () => {
        if (curBlock === 10 || curBlock === 11 || curBlock === 9) { attack(); return; }

        const ray = new THREE.Raycaster();
        const pObj = controls.getObject();
        const dir = new THREE.Vector3(); pObj.getWorldDirection(dir);
        ray.set(pObj.position, dir); 
        const meshes = [];
        chunkManager.meshes.forEach(group => meshes.push(...group.children));
        const hits = ray.intersectObjects(meshes);
        if(hits.length > 0) {
            const h = hits[0];
            const pos = h.point.clone().add(h.face.normal.clone().multiplyScalar(isBuild ? 0.5 : -0.5));
            const x = Math.floor(pos.x), y = Math.floor(pos.y), z = Math.floor(pos.z);
            if(isBuild) {
                if (curBlock === 9) { 
                    if ((player.inventory.wood || 0) > 0) { chunkManager.setVoxelGlobal(x, y, z, 9); player.addItem('wood', -1); }
                    else player.showNotification("Not enough wood!");
                    return;
                }
                if(curBlock === 4) { 
                    chunkManager.setVoxelGlobal(x, y, z, 4);
                    setTimeout(() => { chunkManager.setVoxelGlobal(x, y+1, z, 5); player.addItem('wood', 2); player.addItem('fruit', 1); }, 2000);
                } else if (curBlock === 6) { 
                    chunkManager.setVoxelGlobal(x, y, z, 6);
                    setTimeout(() => player.addItem('herbs', 1), 2000);
                } else chunkManager.setVoxelGlobal(x, y, z, curBlock);
                player.score += 10; player.updateUI();
            } else chunkManager.setVoxelGlobal(x, y, z, 0);
        }
    };

    const invOverlay = document.getElementById('inventory-overlay');
    document.getElementById('inventory-btn')?.addEventListener('click', () => { invOverlay.style.display = 'block'; });
    document.getElementById('close-inv-btn')?.addEventListener('click', () => { invOverlay.style.display = 'none'; });
    document.getElementById('inv-bow')?.addEventListener('click', () => { if(player.upgradeWeapon('bow')) select(curBlock); });
    document.getElementById('inv-sword')?.addEventListener('click', () => { if(player.upgradeWeapon('sword')) select(curBlock); });

    const keys = {w:0,a:0,s:0,d:0,space:0};
    let isBuild = false;
    const modeBtn = document.getElementById('mode-btn');
    if(modeBtn) {
        modeBtn.addEventListener('click', (e) => { 
            e.stopPropagation(); isBuild = !isBuild; 
            modeBtn.innerText = isBuild ? 'BUILD' : 'REMOVE'; 
            modeBtn.classList.toggle('build-mode', isBuild); 
        });
    }

    window.addEventListener('keydown', (e) => {
        if(e.code === 'Digit0') select(11);
        else if(e.code === 'Digit1') select(10);
        else if(e.code.startsWith('Digit')) {
            const digit = parseInt(e.code[5]);
            if(digit >= 2 && digit <= 9) select(digit - 1);
        }
        if(keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = 1;
    });
    window.addEventListener('keyup', (e) => { if(keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = 0; });
    window.addEventListener('mousedown', (e) => { 
        if(intro.style.display === 'none' && !e.target.closest('#hotbar') && !e.target.closest('#inventory-overlay') && !e.target.closest('#inventory-btn')) {
            triggerInteraction();
        } 
    });

    const knob = document.getElementById('joystick-knob'), area = document.getElementById('joystick-area');
    let moveTouchId = null, lookTouchId = null, lookLastX = 0, lookLastY = 0;
    const cameraEuler = new THREE.Euler(0, 0, 0, 'YXZ');

    window.addEventListener('touchstart', (e) => {
        for(let i=0; i<e.changedTouches.length; i++){
            const t = e.changedTouches[i];
            if(t.target.closest('#hotbar') || t.target.closest('.action-btn') || t.target.closest('#inventory-overlay') || t.target.closest('#inventory-btn')) continue;
            const r = area.getBoundingClientRect();
            const dx = t.clientX - (r.left + 50), dy = t.clientY - (r.top + 50);
            if(Math.sqrt(dx*dx+dy*dy) < 60 && moveTouchId === null) moveTouchId = t.identifier;
            else if(lookTouchId === null && t.clientX > window.innerWidth / 4){ lookTouchId = t.identifier; lookLastX = t.clientX; lookLastY = t.clientY; }
        }
    }, {passive:false});

    window.addEventListener('touchmove', (e) => {
        for(let i=0; i<e.touches.length; i++){
            const t = e.touches[i];
            if(t.identifier === moveTouchId){
                e.preventDefault();
                const r = area.getBoundingClientRect();
                const dx = t.clientX - (r.left + 50), dy = t.clientY - (r.top + 50);
                const d = Math.min(Math.sqrt(dx*dx+dy*dy), 50), a = Math.atan2(dy,dx);
                knob.style.transform = `translate(${Math.cos(a)*d}px, ${Math.sin(a)*d}px)`;
                keys.w = dy < -10 ? 1 : 0; keys.s = dy > 10 ? 1 : 0; keys.a = dx < -10 ? 1 : 0; keys.d = dx > 10 ? 1 : 0;
            }
            if(t.identifier === lookTouchId){
                const dx = t.clientX - lookLastX, dy = t.clientY - lookLastY;
                cameraEuler.y -= dx * 0.005; cameraEuler.x -= dy * 0.005;
                cameraEuler.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, cameraEuler.x));
                camera.quaternion.setFromEuler(cameraEuler);
                lookLastX = t.clientX; lookLastY = t.clientY;
            }
        }
    }, {passive:false});

    window.addEventListener('touchend', (e) => {
        for(let i=0; i<e.changedTouches.length; i++){
            const t = e.changedTouches[i];
            if(t.identifier === moveTouchId){ moveTouchId=null; knob.style.transform=''; Object.assign(keys, {w:0,a:0,s:0,d:0}); }
            if(t.identifier === lookTouchId) lookTouchId=null;
        }
    });

    document.getElementById('attack-btn')?.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); attack(); });
    document.getElementById('jump-btn')?.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); keys.space = 1; });
    document.getElementById('jump-btn')?.addEventListener('touchend', () => keys.space = 0);

    controls.getObject().position.set(player.position.x, player.position.y || 25, player.position.z);

    const vel = new THREE.Vector3();
    let lastT = performance.now();
    let lastSave = lastT;
    
    const animate = () => {
        requestAnimationFrame(animate);
        const now = performance.now(), delta = Math.min((now - lastT)/1000, 0.1); lastT = now;
        
        if (intro.style.display === 'none') {
            const pObj = controls.getObject(); 
            player.position.x = pObj.position.x;
            player.position.y = pObj.position.y;
            player.position.z = pObj.position.z;
            playerModel.position.copy(pObj.position);
            playerModel.rotation.y = pObj.rotation.y;

            chunkManager.updatePlayerPosition(pObj.position.x, pObj.position.z);

            const inWater = chunkManager.getVoxelGlobal(pObj.position.x, pObj.position.y - 0.5, pObj.position.z) === 11;
            const gravity = inWater ? 5 : 22;
            const jumpForce = inWater ? 4 : 9;
            const speedBase = inWater ? 4 : 10;

            const mVec = new THREE.Vector3(); pObj.getWorldDirection(mVec); mVec.y = 0; mVec.normalize();
            const sVec = new THREE.Vector3().crossVectors(mVec, pObj.up).normalize();
            const moveDir = new THREE.Vector3().addScaledVector(mVec, keys.w - keys.s).addScaledVector(sVec, keys.d - keys.a);
            
            if (moveDir.lengthSq() > 0) {
                moveDir.normalize();
                const moveStep = moveDir.multiplyScalar(speedBase * delta);
                const checkCollision = (nx, ny, nz) => {
                    const pad = 0.3;
                    for (let ox of [-pad, pad]) {
                        for (let oz of [-pad, pad]) {
                            const b = chunkManager.getVoxelGlobal(nx + ox, ny - 0.5, nz + oz);
                            if (b !== 0 && b !== 11) return true;
                        }
                    }
                    return false;
                };
                if (!checkCollision(pObj.position.x + moveStep.x, pObj.position.y, pObj.position.z)) pObj.position.x += moveStep.x;
                if (!checkCollision(pObj.position.x, pObj.position.y, pObj.position.z + moveStep.z)) pObj.position.z += moveStep.z;
            }

            vel.y -= gravity * delta;
            if (inWater && keys.space) vel.y = jumpForce; 
            pObj.position.y += vel.y * delta;

            let floorY = -20;
            for (let ox of [-0.2, 0.2]) {
                for (let oz of [-0.2, 0.2]) {
                    for (let y = Math.floor(pObj.position.y - 1.5); y <= Math.floor(pObj.position.y + 0.5); y++) {
                        const v = chunkManager.getVoxelGlobal(pObj.position.x + ox, y, pObj.position.z + oz);
                        if (v !== 0 && v !== 11) { floorY = Math.max(floorY, y + 1.8); }
                    }
                }
            }
            if (pObj.position.y < floorY) { pObj.position.y = floorY; vel.y = 0; if (keys.space && !inWater) vel.y = jumpForce; }
            if (pObj.position.y < -10) player.die();

            const camTargetPos = new THREE.Vector3(0, 1.5, 3.5); 
            const worldCamTarget = camTargetPos.clone().applyMatrix4(pObj.matrixWorld);
            const camDir = new THREE.Vector3().subVectors(worldCamTarget, pObj.position).normalize();
            const camDist = 3.5;
            
            let finalDist = camDist;
            const meshes = [];
            chunkManager.meshes.forEach(group => meshes.push(...group.children));
            const camRay = new THREE.Raycaster(pObj.position, camDir, 0, camDist);
            const hits = camRay.intersectObjects(meshes);
            if (hits.length > 0) finalDist = hits[0].distance - 0.2;
            
            camera.position.set(0, 1.5, Math.max(0.1, finalDist));
            camera.lookAt(pObj.position.x, pObj.position.y + 1.2, pObj.position.z);
            
            const cx = Math.floor(pObj.position.x / chunkManager.chunkSize);
            const cz = Math.floor(pObj.position.z / chunkManager.chunkSize);
            const village = chunkManager.getVillage(cx, cz);
            const vNameEl = document.getElementById('village-name');
            if (village) {
                if(vNameEl) vNameEl.innerText = village.name;
                player.lastVillage = { x: cx * chunkManager.chunkSize + 16, z: cz * chunkManager.chunkSize + 16 };
            } else {
                if(vNameEl) vNameEl.innerText = "Unknown Wilderness";
                if (Math.random() < 0.3 * delta) monsterManager.spawn(pObj.position, player.level);
            }
            monsterManager.update(delta, player, chunkManager);

            if(now - lastSave > 10000) { player.save(); lastSave = now; }
            minimapCamera.position.set(pObj.position.x, 80, pObj.position.z);
            minimapCamera.lookAt(pObj.position.x, 0, pObj.position.z);
        }
        
        renderer.autoClear = true;
        renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
        renderer.render(scene, camera);
        
        if (intro.style.display === 'none') {
            renderer.autoClear = false;
            renderer.clearDepth();
            renderer.setScissorTest(true);
            const mSize = 110, padding = 20;
            renderer.setViewport(window.innerWidth - mSize - padding, window.innerHeight - mSize - padding, mSize, mSize);
            renderer.setScissor(window.innerWidth - mSize - padding, window.innerHeight - mSize - padding, mSize, mSize);
            renderer.render(scene, minimapCamera);
            renderer.setScissorTest(false);
            renderer.autoClear = true;
        }
    };
    animate();
    window.addEventListener('beforeunload', () => player.save());
}
init().catch(console.error);
