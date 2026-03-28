import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

class VoxelWorld {
    constructor(options) {
        this.cellSize = options.cellSize;
        this.tileSize = options.tileSize;
        this.tileTextureWidth = options.tileTextureWidth;
        this.cells = {};
    }
    computeCellId(x, y, z) {
        const { cellSize } = this;
        return `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)},${Math.floor(z / cellSize)}`;
    }
    setVoxel(x, y, z, v) {
        let cellId = this.computeCellId(x, y, z);
        let cell = this.cells[cellId];
        if (!cell) { cell = new Uint8Array(this.cellSize ** 3); this.cells[cellId] = cell; }
        const { cellSize } = this;
        const vx = THREE.MathUtils.euclideanModulo(x, cellSize) | 0;
        const vy = THREE.MathUtils.euclideanModulo(y, cellSize) | 0;
        const vz = THREE.MathUtils.euclideanModulo(z, cellSize) | 0;
        cell[vy * cellSize * cellSize + vz * cellSize + vx] = v;
    }
    getVoxel(x, y, z) {
        const cell = this.cells[this.computeCellId(x, y, z)];
        if (!cell) return 0;
        const { cellSize } = this;
        const vx = THREE.MathUtils.euclideanModulo(x, cellSize) | 0;
        const vy = THREE.MathUtils.euclideanModulo(y, cellSize) | 0;
        const vz = THREE.MathUtils.euclideanModulo(z, cellSize) | 0;
        return cell[vy * cellSize * cellSize + vz * cellSize + vx];
    }
    generateGeometryDataForCell(cellX, cellY, cellZ) {
        const { cellSize, tileSize, tileTextureWidth } = this;
        const positions = [], normals = [], uvs = [], indices = [];
        const startX = cellX * cellSize, startY = cellY * cellSize, startZ = cellZ * cellSize;
        for (let y = 0; y < cellSize; ++y) {
            for (let z = 0; z < cellSize; ++z) {
                for (let x = 0; x < cellSize; ++x) {
                    const vx = startX + x, vy = startY + y, vz = startZ + z;
                    const voxel = this.getVoxel(vx, vy, vz);
                    if (voxel) {
                        const uvVoxel = voxel - 1;
                        if (voxel === 6 || voxel === 7) { 
                            const ndx = positions.length / 3;
                            const cross = [
                                {p:[0.2,0,0.2],u:[0,0]},{p:[0.8,0,0.8],u:[1,0]},{p:[0.2,0.8,0.2],u:[0,1]},{p:[0.8,0.8,0.8],u:[1,1]},
                                {p:[0.2,0,0.8],u:[0,0]},{p:[0.8,0,0.2],u:[1,0]},{p:[0.2,0.8,0.8],u:[0,1]},{p:[0.8,0.8,0.2],u:[1,1]}
                            ];
                            for(const v of cross) {
                                positions.push(v.p[0]+vx, v.p[1]+vy, v.p[2]+vz);
                                normals.push(0,1,0);
                                uvs.push((uvVoxel + v.u[0]) * tileSize / tileTextureWidth, v.u[1]);
                            }
                            indices.push(ndx,ndx+1,ndx+2,ndx+2,ndx+1,ndx+3, ndx+4,ndx+5,ndx+6,ndx+6,ndx+5,ndx+7);
                            continue;
                        }
                        for (const { projection, vertices } of VoxelWorld.faces) {
                            const neighbor = this.getVoxel(vx + projection[0], vy + projection[1], vz + projection[2]);
                            const isTrans = (v) => v === 0 || v === 5 || v === 6 || v === 7 || v === 8 || v === 11;
                            if (isTrans(neighbor) || (voxel !== neighbor)) {
                                const ndx = positions.length / 3;
                                for (const { pos, uv } of vertices) {
                                    let py = pos[1];
                                    if (voxel === 11 && projection[1] === 1) py -= 0.15;
                                    positions.push(pos[0]+vx, py+vy, pos[2]+vz);
                                    normals.push(...projection);
                                    uvs.push((uvVoxel + uv[0]) * tileSize / tileTextureWidth, uv[1]);
                                }
                                indices.push(ndx, ndx+1, ndx+2, ndx+2, ndx+1, ndx+3);
                            }
                        }
                    }
                }
            }
        }
        return { positions, normals, uvs, indices };
    }
}
VoxelWorld.faces = [
    { projection: [-1, 0, 0], vertices: [{pos:[0,1,0],uv:[0,1]},{pos:[0,1,1],uv:[1,1]},{pos:[0,0,0],uv:[0,0]},{pos:[0,0,1],uv:[1,0]}] },
    { projection: [1, 0, 0], vertices: [{pos:[1,1,1],uv:[0,1]},{pos:[1,1,0],uv:[1,1]},{pos:[1,0,1],uv:[0,0]},{pos:[1,0,0],uv:[1,0]}] },
    { projection: [0, -1, 0], vertices: [{pos:[1,0,1],uv:[1,0]},{pos:[0,0,1],uv:[0,0]},{pos:[1,0,0],uv:[1,1]},{pos:[0,0,0],uv:[0,1]}] },
    { projection: [0, 1, 0], vertices: [{pos:[0,1,1],uv:[1,1]},{pos:[1,1,1],uv:[0,1]},{pos:[0,1,0],uv:[1,0]},{pos:[1,1,0],uv:[0,0]}] },
    { projection: [0, 0, -1], vertices: [{pos:[1,1,0],uv:[0,1]},{pos:[0,1,0],uv:[1,1]},{pos:[1,0,0],uv:[0,0]},{pos:[0,0,0],uv:[1,0]}] },
    { projection: [0, 0, 1], vertices: [{pos:[0,1,1],uv:[0,1]},{pos:[1,1,1],uv:[1,1]},{pos:[0,0,1],uv:[0,0]},{pos:[1,0,1],uv:[1,0]}] },
];

async function init() {
    const container = document.getElementById('game-container');
    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.autoClear = false;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#a0d8ef');
    scene.fog = new THREE.Fog('#a0d8ef', 20, 100);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const cameraEuler = new THREE.Euler(0, 0, 0, 'YXZ');
    const minimapCamera = new THREE.OrthographicCamera(-35, 35, 35, -35, 1, 1000);
    minimapCamera.up.set(0, 0, -1);

    const controls = new PointerLockControls(camera, document.body);
    const intro = document.getElementById('intro-overlay');
    const startGame = () => { if('ontouchstart' in window){ intro.style.display='none'; }else{ controls.lock(); } };
    intro.addEventListener('click', startGame);
    controls.addEventListener('lock', () => intro.style.display='none');
    scene.add(controls.getObject());

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

    const world = new VoxelWorld({ cellSize: 128, tileSize: 32, tileTextureWidth: 512 });

    const weaponGroup = new THREE.Group(); camera.add(weaponGroup);
    const sword = new THREE.Group();
    const s_h = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.1), new THREE.MeshLambertMaterial({color: 0x8B4513}));
    const s_b = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.8, 0.05), new THREE.MeshLambertMaterial({color: 0xADD8E6}));
    s_b.position.y = 0.5; sword.add(s_h, s_b); sword.position.set(0.5, -0.6, -0.8); sword.rotation.x = -Math.PI/3;
    weaponGroup.add(sword);
    const gun = new THREE.Group();
    const g_b = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 0.6), new THREE.MeshLambertMaterial({color: 0x333333}));
    const g_h = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 0.15), new THREE.MeshLambertMaterial({color: 0x222222}));
    g_h.position.set(0, -0.2, 0.2); gun.add(g_b, g_h); gun.position.set(0.4, -0.4, -0.6);
    weaponGroup.add(gun);
    const bow = new THREE.Group();
    const b_c = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.02, 8, 12, Math.PI), new THREE.MeshLambertMaterial({color: 0x8B4513}));
    b_c.rotation.y = Math.PI/2; bow.add(b_c); bow.position.set(0.4, -0.3, -0.7);
    weaponGroup.add(bow);

    const updateWeapons = (id) => { sword.visible = (id === 10); gun.visible = (id === 8); bow.visible = (id === 9); };
    updateWeapons(1);

    const enemies = [];
    const zMat = new THREE.MeshLambertMaterial({color: 0x2ecc71}), zCloth = new THREE.MeshLambertMaterial({color: 0x3498db});
    function spawnZombie(x, z) {
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.3), zCloth); body.position.y = 0.8;
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), zMat); head.position.y = 1.4;
        const larm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), zMat); larm.position.set(-0.4, 1.0, 0.3); larm.rotation.x = -Math.PI/2;
        const rarm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), zMat); rarm.position.set(0.4, 1.0, 0.3); rarm.rotation.x = -Math.PI/2;
        const lleg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), zCloth); lleg.position.set(-0.2, 0.3, 0);
        const rleg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), zCloth); rleg.position.set(0.2, 0.3, 0);
        g.add(body, head, larm, rarm, lleg, rleg);
        let gy = 0; for(let y=40; y>=0; y--) if(world.getVoxel(Math.floor(x),y,Math.floor(z))!==0) { gy=y+1; break; }
        g.position.set(x, gy, z); g.userData = { hp: 3 };
        scene.add(g); enemies.push(g);
    }

    const size = 64;
    for(let x=0; x<size; x++) {
        for(let z=0; z<size; z++) {
            const h = Math.floor(Math.sin(x/10)*3 + Math.cos(z/10)*3 + 12);
            for(let y=0; y<20; y++) {
                let b = 0;
                if(y < h){ b=2; if(y===h-1) b=1; if(y<h-4) b=3; } else if(y<10) b=11;
                if(b!==0) world.setVoxel(x,y,z,b);
            }
            if(x>10 && x<54 && z>10 && z<54 && Math.random()<0.008 && h>10) spawnZombie(x,z);
        }
    }

    let spawnX = 32, spawnZ = 32, spawnY = 25;
    let found = false;
    for (let r = 0; r < 30 && !found; r++) {
        for (let x = 32-r; x <= 32+r && !found; x++) {
            for (let z = 32-r; z <= 32+r && !found; z++) {
                let h = 0; for (let y = 40; y >= 0; y--) { if (world.getVoxel(x,y,z)!==0 && world.getVoxel(x,y,z)!==11) { h=y; break; } }
                if (h > 10) { spawnX = x+0.5; spawnZ = z+0.5; spawnY = h+1.8; found = true; }
            }
        }
    }
    // 초기 위치 설정: 카메라가 아닌 controls 객체에 직접 설정
    controls.getObject().position.set(spawnX, spawnY, spawnZ);
    camera.position.set(0, 0, 0);

    const geometry = new THREE.BufferGeometry();
    const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ map: texture, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide }));
    scene.add(mesh);
    const updateGeom = () => {
        const d = world.generateGeometryDataForCell(0,0,0);
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(d.positions, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(d.normals, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(d.uvs, 2));
        geometry.setIndex(d.indices);
    };
    updateGeom();
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const sun = new THREE.DirectionalLight(0xffffff, 0.6); sun.position.set(10, 20, 10); scene.add(sun);

    let curBlock = 1, score = 0, swinging = false, isBuild = false;
    const select = (id) => {
        curBlock = id;
        document.querySelectorAll('.hotbar-item').forEach(el => el.classList.remove('active'));
        const item = document.querySelector(`.hotbar-item[data-block="${id}"]`);
        if(item) item.classList.add('active');
        updateWeapons(id);
    };

    document.querySelectorAll('.hotbar-item').forEach(el => {
        el.addEventListener('touchstart', (e) => { e.stopPropagation(); select(parseInt(el.dataset.block)); }, {passive:false});
        el.addEventListener('click', (e) => { e.stopPropagation(); select(parseInt(el.dataset.block)); });
    });

    const submitScore = (finalScore) => {
        fetch('/api/submit-score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ score: finalScore, gameType: 'mc-world' })
        }).catch(err => console.error('Score submission failed:', err));
    };

    const attack = () => {
        if (swinging) return; swinging = true;
        const activeWeapon = curBlock === 10 ? sword : (curBlock === 8 ? gun : bow);
        const range = curBlock === 10 ? 4 : (curBlock === 8 ? 20 : 15);
        const damage = curBlock === 10 ? 2 : (curBlock === 8 ? 1 : 1.5);
        const startZ = activeWeapon.position.z;
        let startT = performance.now();
        const anim = () => {
            let elap = (performance.now()-startT)/100;
            if(elap<1){ activeWeapon.position.z=startZ+Math.sin(elap*Math.PI)*0.2; requestAnimationFrame(anim); }
            else{ activeWeapon.position.z=startZ; swinging=false; }
        }; anim();
        const ray = new THREE.Raycaster(); ray.setFromCamera({x:0,y:0}, camera); ray.far = range;
        const hits = ray.intersectObjects(enemies, true);
        if(hits.length > 0) {
            let target = hits[0].object; while(target.parent && !target.userData.hp) target = target.parent;
            if(target.userData.hp) {
                target.userData.hp -= damage;
                target.traverse(c => { if(c.material){ c.material.emissive?.setHex(0xff0000); setTimeout(()=>c.material.emissive?.setHex(0), 100); } });
                if(target.userData.hp<=0){ 
                    scene.remove(target); enemies.splice(enemies.indexOf(target), 1); 
                    score += 100; document.getElementById('score-val').innerText = score;
                    submitScore(score);
                }
            }
        }
    };

    const knob = document.getElementById('joystick-knob'), area = document.getElementById('joystick-area');
    let moveTouchId = null, lookTouchId = null, lookLastX = 0, lookLastY = 0;
    const keys = {w:0,a:0,s:0,d:0,space:0};

    const triggerInteraction = (clientX, clientY) => {
        if (curBlock >= 8) { attack(); return; }
        const ray = new THREE.Raycaster();
        const mouse = new THREE.Vector2((clientX/window.innerWidth)*2-1, -(clientY/window.innerHeight)*2+1);
        ray.setFromCamera(mouse, camera);
        const hits = ray.intersectObject(mesh);
        if(hits.length > 0) {
            const h = hits[0];
            const pos = h.point.clone().add(h.face.normal.clone().multiplyScalar(isBuild ? 0.5 : -0.5));
            const x = Math.floor(pos.x), y = Math.floor(pos.y), z = Math.floor(pos.z);
            if(isBuild) { if(curBlock < 8) { world.setVoxel(x,y,z,curBlock); score+=10; } }
            else world.setVoxel(x,y,z,0);
            updateGeom(); document.getElementById('score-val').innerText = score;
        }
    };

    window.addEventListener('touchstart', (e) => {
        for(let i=0; i<e.changedTouches.length; i++){
            const t = e.changedTouches[i];
            const target = t.target;
            if(target.closest('#hotbar') || target.closest('.action-btn')) continue;

            const r = area.getBoundingClientRect();
            const dx = t.clientX - (r.left + 50), dy = t.clientY - (r.top + 50);
            if(Math.sqrt(dx*dx+dy*dy) < 60 && moveTouchId === null) moveTouchId = t.identifier;
            else if(lookTouchId === null && t.clientX > window.innerWidth / 4){
                lookTouchId = t.identifier; lookLastX = t.clientX; lookLastY = t.clientY;
            }
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

    window.addEventListener('mousedown', (e) => { if(intro.style.display === 'none' && !e.target.closest('#hotbar') && !e.target.closest('.action-btn')) triggerInteraction(e.clientX, e.clientY); });
    window.addEventListener('keydown', (e) => {
        if(e.code === 'Digit0') select(10);
        else if(e.code.startsWith('Digit')) select(parseInt(e.code[5]));
        if(keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = 1;
    });
    window.addEventListener('keyup', (e) => { if(keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = 0; });
    
    document.getElementById('attack-btn').addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); attack(); });
    document.getElementById('jump-btn').addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); keys.space = 1; });
    document.getElementById('jump-btn').addEventListener('touchend', () => keys.space = 0);
    const modeBtn = document.getElementById('mode-btn');
    if(modeBtn) modeBtn.addEventListener('click', (e) => { e.stopPropagation(); isBuild=!isBuild; modeBtn.innerText=isBuild?'BUILD':'REMOVE'; modeBtn.classList.toggle('build-mode', isBuild); });

    const vel = new THREE.Vector3();
    let lastT = performance.now();
    const animate = () => {
        requestAnimationFrame(animate);
        const now = performance.now(), delta = Math.min((now - lastT)/1000, 0.1); lastT = now;
        if (intro.style.display === 'none') {
            const pObj = controls.getObject();
            const mVec = new THREE.Vector3(); camera.getWorldDirection(mVec); mVec.y = 0; mVec.normalize();
            // sVec을 (전방 x 위) 순서로 계산하여 '오른쪽' 방향 벡터를 얻음
            const sVec = new THREE.Vector3().crossVectors(mVec, camera.up).normalize();
            
            // 전방(w-s)과 우측(d-a) 입력을 조합하여 이동 방향 결정
            const moveDir = new THREE.Vector3().addScaledVector(mVec, keys.w - keys.s).addScaledVector(sVec, keys.d - keys.a);
            
            if (moveDir.lengthSq() > 0) {
                moveDir.normalize();
                const moveStep = moveDir.multiplyScalar(8 * delta);

                const checkCollision = (nx, ny, nz) => {
                    const pad = 0.3;
                    for (let ox of [-pad, pad]) {
                        for (let oz of [-pad, pad]) {
                            // 눈 아래 0.3m(이마/코)와 0.8m(가슴)만 체크하여 바닥(1.8m 아래) 걸림 방지
                            const b1 = world.getVoxel(Math.floor(nx + ox), Math.floor(ny - 0.3), Math.floor(nz + oz));
                            const b2 = world.getVoxel(Math.floor(nx + ox), Math.floor(ny - 0.8), Math.floor(nz + oz));
                            if ((b1 !== 0 && b1 !== 11) || (b2 !== 0 && b2 !== 11)) return true;
                        }
                    }
                    return false;
                };

                if (!checkCollision(pObj.position.x + moveStep.x, pObj.position.y, pObj.position.z)) pObj.position.x += moveStep.x;
                if (!checkCollision(pObj.position.x, pObj.position.y, pObj.position.z + moveStep.z)) pObj.position.z += moveStep.z;
            }

            vel.y -= 22 * delta;
            pObj.position.y += vel.y * delta;
            let floorY = -10;
            for (let ox of [-0.2, 0.2]) {
                for (let oz of [-0.2, 0.2]) {
                    for (let y = Math.floor(pObj.position.y - 1.5); y <= Math.floor(pObj.position.y + 0.5); y++) {
                        const v = world.getVoxel(Math.floor(pObj.position.x + ox), y, Math.floor(pObj.position.z + oz));
                        if (v !== 0 && v !== 11) { floorY = Math.max(floorY, y + 1.8); }
                    }
                }
            }
            if (pObj.position.y < floorY) { pObj.position.y = floorY; vel.y = 0; if (keys.space) vel.y = 9; }
            if (pObj.position.y < -5) pObj.position.set(spawnX, spawnY, spawnZ);

            enemies.forEach(en => {
                const dist = en.position.distanceTo(pObj.position);
                if (dist < 1.2 && performance.now() % 1000 < 20) {
                    score = Math.max(0, score - 5); document.getElementById('score-val').innerText = score;
                }
                if (dist < 15 && dist > 1.2) {
                    en.position.add(new THREE.Vector3().subVectors(pObj.position, en.position).setY(0).normalize().multiplyScalar(2.2 * delta));
                    en.lookAt(pObj.position.x, en.position.y, pObj.position.z);
                }
                let egr = 0; for(let y=40; y>=0; y--) { if(world.getVoxel(Math.floor(en.position.x), y, Math.floor(en.position.z))!==0) { egr=y+1; break; } }
                en.position.y = THREE.MathUtils.lerp(en.position.y, egr, 0.2);
            });

            if (Math.random() < 0.001) {
                const rx = pObj.position.x + (Math.random()-0.5)*40, rz = pObj.position.z + (Math.random()-0.5)*40;
                if (Math.abs(rx-pObj.position.x)>10) spawnZombie(rx, rz);
            }
            minimapCamera.position.set(pObj.position.x, 50, pObj.position.z);
            minimapCamera.lookAt(pObj.position.x, 0, pObj.position.z);
        }
        
        renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
        renderer.render(scene, camera);
        if (intro.style.display === 'none') {
            renderer.clearDepth();
            renderer.setScissorTest(true);
            const mSize = 110;
            renderer.setViewport(window.innerWidth - mSize - 20, window.innerHeight - mSize - 20, mSize, mSize);
            renderer.setScissor(window.innerWidth - mSize - 20, window.innerHeight - mSize - 20, mSize, mSize);
            renderer.render(scene, minimapCamera);
            renderer.setScissorTest(false);
        }
    };
    animate();
}
init().catch(console.error);
