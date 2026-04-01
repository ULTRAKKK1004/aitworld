import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { ChunkManager } from './ChunkManager.js';
import { PlayerData } from './Player.js';
import { MonsterManager } from './Monsters.js';

class AudioManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.masterGain.gain.value = 0.4;
        
        this.bgmNodes = [];
        this.currentState = 'CALM'; // CALM, TENSE, COMBAT
        this.lastState = null;
        this.transitioning = false;
        
        this.victoryTimeout = null;
        this.defeatTimeout = null;
    }

    async start() {
        if (this.ctx.state === 'suspended') await this.ctx.resume();
        this.playState(this.currentState);
        this.startBirdSounds();
    }

    stopBGM() {
        this.bgmNodes.forEach(node => {
            try {
                if (node.gain) {
                    node.gain.gain.setTargetAtTime(0, this.ctx.currentTime + 1);
                }
                setTimeout(() => { if (node.osc) node.osc.stop(); }, 1000);
            } catch(e) {}
        });
        this.bgmNodes = [];
    }

    createNode(type, freq, vol) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.value = 0; // Start silent for fade-in
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        this.bgmNodes.push({ osc, gain });
        return { osc, gain };
    }

    playState(state) {
        this.stopBGM();
        const now = this.ctx.currentTime;
        
        if (state === 'CALM') {
            // Magical, bright ambient pad
            const n1 = this.createNode('sine', 440, 0.1); // A4
            const n2 = this.createNode('triangle', 554.37, 0.08); // C#5
            const n3 = this.createNode('sine', 659.25, 0.05); // E5
            
            // Slow modulation for magical feel
            const lfo = this.ctx.createOscillator();
            lfo.frequency.value = 0.2;
            const lfoGain = this.ctx.createGain();
            lfoGain.gain.value = 10;
            lfo.connect(lfoGain);
            lfoGain.connect(n1.osc.frequency);
            lfo.start();
            this.bgmNodes.push({ osc: lfo, gain: lfoGain });

            n1.gain.gain.setTargetAtTime(0.08, now, 2);
            n2.gain.gain.setTargetAtTime(0.06, now, 2);
            n3.gain.gain.setTargetAtTime(0.04, now, 2);

        } else if (state === 'TENSE') {
            // Mysterious, slightly dissonant drone
            const n1 = this.createNode('sawtooth', 110, 0.1); // A2
            const n2 = this.createNode('triangle', 116.54, 0.08); // A#2 (dissonance)
            
            const lfo = this.ctx.createOscillator();
            lfo.frequency.value = 2; // Faster throb
            const lfoGain = this.ctx.createGain();
            lfoGain.gain.value = 0.05;
            lfo.connect(lfoGain);
            lfoGain.connect(n1.gain.gain);
            lfo.start();
            this.bgmNodes.push({ osc: lfo, gain: lfoGain });

            n1.gain.gain.setTargetAtTime(0.08, now, 1);
            n2.gain.gain.setTargetAtTime(0.06, now, 1);

        } else if (state === 'COMBAT') {
            // Fast, driving bass and aggressive synth
            const base = this.createNode('square', 55, 0.15); // A1
            const lead = this.createNode('sawtooth', 220, 0.1); // A3
            
            // 16th note arpeggiator effect on lead
            const lfo = this.ctx.createOscillator();
            lfo.type = 'square';
            lfo.frequency.value = 8; 
            const lfoGain = this.ctx.createGain();
            lfoGain.gain.value = 0.1;
            lfo.connect(lfoGain);
            lfoGain.connect(lead.gain.gain);
            lfo.start();
            this.bgmNodes.push({ osc: lfo, gain: lfoGain });

            base.gain.gain.setTargetAtTime(0.12, now, 0.5);
            lead.gain.gain.setTargetAtTime(0.08, now, 0.5);
        }
    }

    updateState(newState) {
        if (this.currentState !== newState && !this.victoryTimeout && !this.defeatTimeout) {
            this.lastState = this.currentState;
            this.currentState = newState;
            this.playState(newState);
        }
    }

    startBirdSounds() {
        setInterval(() => {
            if (this.currentState === 'CALM' && Math.random() < 0.4) {
                this.playBirdChirp();
            }
        }, 3000);
    }

    playBirdChirp() {
        if(!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.connect(gain);
        gain.connect(this.masterGain);
        
        // High pitched chirp
        osc.frequency.setValueAtTime(4000 + Math.random() * 1000, now);
        osc.frequency.exponentialRampToValueAtTime(3000 + Math.random() * 500, now + 0.1);
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.05, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        
        osc.start(now);
        osc.stop(now + 0.15);
    }

    playVictory() {
        this.stopBGM();
        this.victoryTimeout = true;
        const now = this.ctx.currentTime;
        
        // Triumphant major arpeggio
        const notes = [440, 554.37, 659.25, 880]; // A, C#, E, A
        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = freq;
            osc.connect(gain);
            gain.connect(this.masterGain);
            
            const time = now + i * 0.15;
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(0.1, time + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.5);
            
            osc.start(time);
            osc.stop(time + 0.6);
        });

        setTimeout(() => {
            this.victoryTimeout = false;
            this.playState(this.currentState);
        }, 2000);
    }

    playDefeat() {
        this.stopBGM();
        this.defeatTimeout = true;
        const now = this.ctx.currentTime;
        
        // Descending, detuned minor notes
        const notes = [329.63, 311.13, 293.66, 277.18]; // E, Eb, D, C#
        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.value = freq;
            osc.connect(gain);
            gain.connect(this.masterGain);
            
            const time = now + i * 0.4;
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(0.15, time + 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.8);
            
            osc.start(time);
            osc.stop(time + 0.9);
        });
        
        setTimeout(() => {
            this.defeatTimeout = false;
            this.currentState = 'CALM';
            this.playState('CALM');
        }, 3000);
    }

    playSFX(type) {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.masterGain);
        
        if (type === 'hit') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.1);
            osc.start(now); osc.stop(now + 0.1);
        } else if (type === 'jump') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.1);
            osc.start(now); osc.stop(now + 0.1);
        }
    }
}

let scene, camera, renderer, controls, minimapCamera, audioManager;
let chunkManager, player, monsterManager;
let weapons = {};

async function init() {
    const container = document.getElementById('game-container');
    if (!container) return;

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    const skyColor = '#87CEEB';
    scene.background = new THREE.Color(skyColor); 
    scene.fog = new THREE.Fog(skyColor, 100, 150);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.layers.enable(0); 

    minimapCamera = new THREE.OrthographicCamera(-100, 100, 100, -100, 1, 1000);
    minimapCamera.up.set(0, 0, -1);
    minimapCamera.layers.enable(0); 
    minimapCamera.layers.enable(1); 
    
    const playerModel = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({color: 0x3498db});
    const pBody = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.4), bodyMat); pBody.position.y = 0.9;
    const pHead = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), bodyMat); pHead.position.y = 1.5;
    playerModel.add(pBody, pHead);
    scene.add(playerModel);
    
    const markerGeo = new THREE.ConeGeometry(2, 5, 3);
    const markerMat = new THREE.MeshBasicMaterial({ color: 0x0000ff });
    const pMarker = new THREE.Mesh(markerGeo, markerMat);
    pMarker.rotation.x = Math.PI / 2;
    pMarker.position.y = 10;
    pMarker.layers.set(1);
    playerModel.add(pMarker);

    playerModel.traverse(c => { if (c.layers) c.layers.set(1); });

    const cameraPivot = new THREE.Group();
    scene.add(cameraPivot);
    cameraPivot.add(camera);
    camera.position.set(0, 1.6, 0); 
    
    controls = new PointerLockControls(cameraPivot, document.body);
    window.gameControls = controls;
    
    let currentShake = new THREE.Vector3();
    window.shakeScreen = (intensity) => {
        const start = performance.now();
        const shake = () => {
            const elapsed = performance.now() - start;
            if (elapsed < 500) {
                const amount = (intensity || 0.1) * (1 - elapsed / 500);
                currentShake.set((Math.random() - 0.5) * amount, (Math.random() - 0.5) * amount, 0);
                requestAnimationFrame(shake);
            } else { currentShake.set(0, 0, 0); }
        };
        shake();
    };

    const intro = document.getElementById('intro-overlay');
    const startAction = () => {
        if (!('ontouchstart' in window)) controls.lock();
        if (intro) intro.style.display = 'none';
        if(!audioManager) {
            audioManager = new AudioManager();
            audioManager.start();
            window.audioManager = audioManager;
        }
    };
    
    if (intro) {
        intro.addEventListener('click', startAction);
        intro.addEventListener('touchstart', (e) => { e.preventDefault(); startAction(); }, {passive: false});
    }
    controls.addEventListener('lock', () => { if(intro) intro.style.display = 'none'; });

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
        loader.load(url, img => { if(ctx) ctx.drawImage(img, i*32, 0, 32, 32); res(); }, undefined, () => {
            if(ctx) { ctx.fillStyle = '#ff00ff'; ctx.fillRect(i*32, 0, 32, 32); }
            res(); 
        });
    })));
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;

    chunkManager = new ChunkManager(scene, texture);
    player = new PlayerData();
    await player.load(); 
    monsterManager = new MonsterManager(scene);

    if (player.position) chunkManager.updatePlayerPosition(player.position.x, player.position.z);
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
        if (weapons.stick) weapons.stick.visible = (id === 10);
        if (weapons.sword) weapons.sword.visible = (id === 11 && (player.weapons.sword || 0) > 0);
        if (weapons.bow) weapons.bow.visible = (id === 9 && (player.weapons.bow || 0) > 0);
    };
    select(10);

    document.querySelectorAll('.hotbar-item').forEach(el => {
        const handler = (e) => { e.preventDefault(); e.stopPropagation(); select(parseInt(el.dataset.block)); };
        el.addEventListener('click', handler);
        el.addEventListener('touchstart', handler, {passive: false});
    });

    let swinging = false;
    const attack = () => {
        if (!player || !monsterManager || swinging) return;
        if (audioManager) audioManager.playSFX('hit');
        let wpName = "";
        if (curBlock === 10) wpName = "stick";
        else if (curBlock === 11) wpName = "sword";
        else if (curBlock === 9) wpName = "bow";
        
        if (!wpName || wpName === "" || (wpName !== 'stick' && (player.weapons[wpName] || 0) === 0)) {
            if(wpName && wpName !== "") player.showNotification(`Unlock ${wpName} first!`);
            return;
        }

        swinging = true;
        const activeWeapon = weapons[wpName];
        if (!activeWeapon) { swinging = false; return; }
        const weaponTier = player.weapons[wpName] || 1;
        const range = wpName === 'stick' ? 3.5 : (wpName === 'sword' ? 5.0 : 25);
        const damage = (wpName === 'stick' ? 1 : (wpName === 'sword' ? 3 : 2)) * weaponTier * (1 + player.level * 0.1);

        const startZ = activeWeapon.position.z;
        let startT = performance.now();
        const anim = () => {
            let elap = (performance.now()-startT)/150;
            if(elap<1){ activeWeapon.position.z = startZ + Math.sin(elap * Math.PI) * 0.2; requestAnimationFrame(anim); }
            else { activeWeapon.position.z = startZ; swinging = false; }
        }; anim();

        const ray = new THREE.Raycaster();
        ray.camera = camera;
        const dir = new THREE.Vector3(); const origin = new THREE.Vector3();
        camera.getWorldPosition(origin); camera.getWorldDirection(dir); 
        ray.set(origin, dir); ray.far = range;
        const hits = ray.intersectObjects(monsterManager.monsters.map(m => m.group), true);
        if(hits.length > 0) {
            let curr = hits[0].object;
            while(curr) {
                if (curr.userData && curr.userData.monster) {
                    curr.userData.monster.takeDamage(damage);
                    player.showFloatingText(`-${Math.floor(damage)}`, '#ff0000');
                    break;
                }
                curr = curr.parent;
            }
        }
    };

    const triggerInteraction = () => {
        if (!chunkManager || !player) return;
        if (curBlock === 10 || curBlock === 11 || curBlock === 9) { attack(); return; }
        const ray = new THREE.Raycaster();
        ray.camera = camera;
        const dir = new THREE.Vector3(); const origin = new THREE.Vector3();
        camera.getWorldPosition(origin); camera.getWorldDirection(dir);
        ray.set(origin, dir); 
        const meshes = [];
        chunkManager.meshes.forEach(group => { if(group && group.children) group.children.forEach(child => meshes.push(child)); });
        const hits = ray.intersectObjects(meshes);
        if(hits.length > 0) {
            const h = hits[0]; if (!h.face) return;
            const pos = h.point.clone().add(h.face.normal.clone().multiplyScalar(isBuild ? 0.5 : -0.5));
            const x = Math.floor(pos.x), y = Math.floor(pos.y), z = Math.floor(pos.z);
            if(isBuild) {
                if (curBlock === 9) { 
                    if ((player.inventory.wood || 0) > 0) { chunkManager.setVoxelGlobal(x, y, z, 9); player.addItem('wood', -1); }
                    else player.showNotification("Not enough wood!");
                    return;
                }
                chunkManager.setVoxelGlobal(x, y, z, curBlock);
                player.score += 10; player.updateUI();
            } else chunkManager.setVoxelGlobal(x, y, z, 0);
        }
    };
    
    document.getElementById('inventory-btn')?.addEventListener('click', () => { 
        const inv = document.getElementById('inventory-overlay'); if (inv) inv.style.display = 'block'; 
    });
    document.getElementById('save-btn')?.addEventListener('click', async (e) => {
        e.stopPropagation(); if (player) { await player.save(); player.showNotification("Game Saved!"); alert("저장되었습니다."); }
    });
    document.getElementById('exit-btn')?.addEventListener('click', async (e) => {
        e.stopPropagation(); if (confirm("Save and exit?")) { if (player) await player.save(); window.isReloading = true; location.href = '/dashboard'; }
    });
    document.getElementById('reset-data-btn')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm("Reset data?")) {
            window.isReloading = true;
            try { const res = await fetch('/api/mc-world/reset', { method: 'POST' }); if ((await res.json()).success) location.reload(); } catch(e) {}
        }
    });
    document.getElementById('close-inv-btn')?.addEventListener('click', () => { 
        const inv = document.getElementById('inventory-overlay'); if (inv) inv.style.display = 'none'; 
    });
    document.getElementById('inv-bow')?.addEventListener('click', () => { if(player.upgradeWeapon('bow')) select(curBlock); });
    document.getElementById('inv-sword')?.addEventListener('click', () => { if(player.upgradeWeapon('sword')) select(curBlock); });

    const keys = {w:0,a:0,s:0,d:0,space:0};
    let isBuild = false;
    const modeBtn = document.getElementById('mode-btn');
    if(modeBtn) {
        modeBtn.addEventListener('click', (e) => { 
            e.stopPropagation(); isBuild = !isBuild; modeBtn.innerText = isBuild ? 'BUILD' : 'REMOVE'; modeBtn.classList.toggle('build-mode', isBuild); 
        });
    }

    window.addEventListener('keydown', (e) => {
        if(e.code === 'Digit0') select(11);
        else if(e.code === 'Digit1') select(10);
        else if(e.code.startsWith('Digit')) { const d = parseInt(e.code[5]); if(d >= 2 && d <= 9) select(d - 1); }
        if(keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = 1;
    });
    window.addEventListener('keyup', (e) => { if(keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = 0; });
    window.addEventListener('mousedown', (e) => { 
        if(intro && intro.style.display === 'none' && !e.target.closest('#hotbar') && !e.target.closest('#inventory-overlay') && !e.target.closest('#inventory-btn')) triggerInteraction();
    });

    const getArea = () => document.getElementById('joystick-area');
    const getKnob = () => document.getElementById('joystick-knob');
    let moveTouchId = null, lookTouchId = null, lookLastX = 0, lookLastY = 0;

    window.addEventListener('touchstart', (e) => {
        const area = getArea(); if (!area) return;
        for(let i=0; i<e.changedTouches.length; i++){
            const t = e.changedTouches[i]; const target = t.target;
            if(target.closest('#hotbar') || target.closest('.action-btn') || target.closest('#inventory-overlay') || target.closest('#inventory-btn')) continue;
            const r = area.getBoundingClientRect(); const cx = r.left + r.width/2, cy = r.top + r.height/2;
            const dx = t.clientX - cx, dy = t.clientY - cy;
            if(Math.sqrt(dx*dx+dy*dy) < r.width * 0.6 && moveTouchId === null) moveTouchId = t.identifier;
            else if(lookTouchId === null && t.clientX > window.innerWidth / 4){ lookTouchId = t.identifier; lookLastX = t.clientX; lookLastY = t.clientY; }
        }
    }, {passive:false});

    window.addEventListener('touchmove', (e) => {
        const area = getArea(); const knob = getKnob(); if (!area || !knob) return;
        const r = area.getBoundingClientRect(); const cx = r.left + r.width/2, cy = r.top + r.height/2;
        for(let i=0; i<e.touches.length; i++){
            const t = e.touches[i];
            if(t.identifier === moveTouchId){
                e.preventDefault(); const dx = t.clientX - cx, dy = t.clientY - cy;
                const d = Math.min(Math.sqrt(dx*dx+dy*dy), r.width/2), a = Math.atan2(dy,dx);
                knob.style.transform = `translate(${Math.cos(a)*d}px, ${Math.sin(a)*d}px)`;
                keys.w = dy < -r.height/12 ? 1 : 0; keys.s = dy > r.height/12 ? 1 : 0; 
                keys.a = dx < -r.width/12 ? 1 : 0; keys.d = dx > r.width/12 ? 1 : 0;
            }
            if(t.identifier === lookTouchId){
                const dx = t.clientX - lookLastX, dy = t.clientY - lookLastY;
                controls.getObject().rotation.y -= dx * 0.005;
                camera.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, camera.rotation.x - dy * 0.005));
                lookLastX = t.clientX; lookLastY = t.clientY;
            }
        }
    }, {passive:false});

    window.addEventListener('touchend', (e) => {
        const knob = getKnob();
        for(let i=0; i<e.changedTouches.length; i++){
            const t = e.changedTouches[i];
            if(t.identifier === moveTouchId){ moveTouchId=null; if(knob) knob.style.transform=''; Object.assign(keys, {w:0,a:0,s:0,d:0}); }
            if(t.identifier === lookTouchId) lookTouchId=null;
        }
    });

    document.getElementById('attack-btn')?.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); attack(); });
    document.getElementById('jump-btn')?.addEventListener('touchstart', (e) => { 
        e.preventDefault(); e.stopPropagation(); keys.space = 1; if(audioManager) audioManager.playSFX('jump'); 
    });
    document.getElementById('jump-btn')?.addEventListener('touchend', () => keys.space = 0);

    const pObj = controls.getObject(); pObj.position.set(player.position.x, player.position.y || 25, player.position.z);
    const vel = new THREE.Vector3(); let lastT = performance.now(), lastSave = lastT;
    
    const animate = () => {
        requestAnimationFrame(animate);
        const now = performance.now(), delta = Math.min((now - lastT)/1000, 0.1); lastT = now;
        if (!intro || intro.style.display === 'none') {
            player.position.copy(pObj.position); playerModel.position.copy(pObj.position); playerModel.rotation.y = pObj.rotation.y;
            chunkManager.updatePlayerPosition(pObj.position.x, pObj.position.z);
            const cx = Math.floor(pObj.position.x / chunkManager.chunkSize), cz = Math.floor(pObj.position.z / chunkManager.chunkSize);
            const village = chunkManager.getVillage(cx, cz);
            player.update(delta, !!village);

            const inWater = chunkManager.getVoxelGlobal(pObj.position.x, pObj.position.y - 0.5, pObj.position.z) === 11;
            const gravity = inWater ? 5 : 22, jumpForce = inWater ? 4 : 9, speedBase = inWater ? 4 : 10;
            const mVec = new THREE.Vector3(); pObj.getWorldDirection(mVec); mVec.y = 0; mVec.normalize();
            const sVec = new THREE.Vector3().crossVectors(mVec, pObj.up).normalize();
            const moveDir = new THREE.Vector3().addScaledVector(mVec, keys.s - keys.w).addScaledVector(sVec, keys.a - keys.d);
            
            if (moveDir.lengthSq() > 0) {
                moveDir.normalize(); const moveStep = moveDir.multiplyScalar(speedBase * delta);
                const checkCol = (nx, ny, nz) => {
                    for (let ox of [-0.3, 0.3]) for (let oz of [-0.3, 0.3]) for (let oy of [0.5, 1.5, 1.8]) {
                        const b = chunkManager.getVoxelGlobal(nx + ox, ny + oy, nz + oz); if (b !== 0 && b !== 11) return true;
                    }
                    return false;
                };
                if (!checkCol(pObj.position.x + moveStep.x, pObj.position.y, pObj.position.z)) pObj.position.x += moveStep.x;
                if (!checkCol(pObj.position.x, pObj.position.y, pObj.position.z + moveStep.z)) pObj.position.z += moveStep.z;
            }

            vel.y -= gravity * delta; if (inWater && keys.space) vel.y = jumpForce; pObj.position.y += vel.y * delta;
            let floorY = -20;
            for (let ox of [-0.2, 0.2]) for (let oz of [-0.2, 0.2]) for (let y = Math.floor(pObj.position.y - 1.2); y <= Math.floor(pObj.position.y + 0.2); y++) {
                const v = chunkManager.getVoxelGlobal(pObj.position.x + ox, y, pObj.position.z + oz); if (v !== 0 && v !== 11) floorY = Math.max(floorY, y + 1);
            }
            if (pObj.position.y < floorY) { pObj.position.y = floorY; vel.y = 0; if (keys.space && !inWater) vel.y = jumpForce; }
            if (pObj.position.y < -10) player.die();
            camera.position.set(0, 1.6, 0).add(currentShake);

            if (village) {
                document.getElementById('village-name').innerText = village.name;
                player.lastVillage = { x: cx * 32 + 16, z: cz * 32 + 16 };
            } else {
                document.getElementById('village-name').innerText = "Unknown Wilderness";
                if (Math.random() < 0.3 * delta) monsterManager.spawn(pObj.position, player.level);
            }
            monsterManager.update(delta, player, chunkManager);

            if (audioManager) {
                let nearDist = 999, combat = false;
                monsterManager.monsters.forEach(m => {
                    const d = m.group.position.distanceTo(player.position); if (d < nearDist) nearDist = d;
                    if (m.state === 'ATTACK' || m.state === 'CHASE') combat = true;
                });
                if (combat && nearDist < 10) audioManager.updateState('COMBAT');
                else if (nearDist < 25) audioManager.updateState('TENSE');
                else audioManager.updateState('CALM');
            }

            if(now - lastSave > 10000 && !window.isReloading) { player.save(); lastSave = now; }
            minimapCamera.position.set(pObj.position.x, 80, pObj.position.z); minimapCamera.lookAt(pObj.position.x, 0, pObj.position.z);
            renderer.autoClear = true; renderer.setViewport(0, 0, window.innerWidth, window.innerHeight); renderer.render(scene, camera);
            renderer.autoClear = false; renderer.clearDepth(); renderer.setScissorTest(true);
            renderer.setViewport(window.innerWidth - 130, window.innerHeight - 130, 110, 110);
            renderer.setScissor(window.innerWidth - 130, window.innerHeight - 130, 110, 110);
            renderer.render(scene, minimapCamera); renderer.setScissorTest(false);
        }
    };
    animate();
    window.addEventListener('beforeunload', () => { if (!window.isReloading) player.save(); });
}
init().catch(console.error);
