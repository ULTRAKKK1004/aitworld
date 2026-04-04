/**
 * MAGIC RUSH - High Performance Cookie Run Style Game
 * Features: Double Jump, Parallax, Active Items, 2.5D Rendering, Dynamic Effects
 */

// Improved Web Audio Synthesis Engine (Replacing ZzFX for clarity and quality)
let audioCtx = null;
function getAudioCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}

const sounds = {
    jump: () => {
        const ctx = getAudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.1);
    },
    doubleJump: () => {
        const ctx = getAudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(500, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.1);
    },
    land: () => {
        const ctx = getAudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.05);
    },
    hit: () => {
        const ctx = getAudioCtx();
        const noise = ctx.createBufferSource();
        const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for(let i=0; i<buffer.length; i++) data[i] = Math.random() * 2 - 1;
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.2);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        noise.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
        noise.start(); noise.stop(ctx.currentTime + 0.2);
    },
    item: () => {
        const ctx = getAudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.1);
    },
    shield: () => {
        const ctx = getAudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.setValueAtTime(600, ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(800, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.4);
    },
    dash: () => {
        const ctx = getAudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.3);
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.value = 1500;
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.3);
    },
    levelUp: () => {
        const ctx = getAudioCtx();
        [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.frequency.value = f;
            gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.1);
            gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + i * 0.1 + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.4);
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(ctx.currentTime + i * 0.1); osc.stop(ctx.currentTime + i * 0.1 + 0.4);
        });
    }
};

// Improved Melodic BGM Engine
class BGMPlayer {
    constructor() { 
        this.ctx = null; 
        this.isPlaying = false; 
        this.timeout = null;
        // Melodic progression: Cmaj7 - Am7 - Dm7 - G7
        this.progression = [
            [261.63, 329.63, 392.00, 493.88], // Cmaj7
            [220.00, 261.63, 329.63, 392.00], // Am7
            [293.66, 349.23, 440.00, 523.25], // Dm7
            [196.00, 246.94, 293.66, 392.00]  // G7
        ];
        this.currentChord = 0;
    }
    
    start() {
        if(this.isPlaying) return;
        this.ctx = getAudioCtx();
        this.isPlaying = true;
        this.playLoop();
    }
    
    playLoop() {
        if(!this.isPlaying) return;
        let now = this.ctx.currentTime;
        let chord = this.progression[this.currentChord];
        
        // Play Arpeggio
        chord.forEach((note, i) => {
            this.playNote(note, now + i * 0.2, 'sine', 0.02, 0.4);
            // Bass note
            if (i === 0) this.playNote(note / 2, now, 'triangle', 0.03, 0.8);
        });

        this.currentChord = (this.currentChord + 1) % this.progression.length;
        this.timeout = setTimeout(() => this.playLoop(), 1600); // 4 notes * 0.2s * 2 loop
    }
    
    playNote(freq, time, type, vol, duration) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, time);
        
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(vol, time + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(time);
        osc.stop(time + duration);
    }
    
    stop() {
        this.isPlaying = false;
        if(this.timeout) clearTimeout(this.timeout);
    }
}
const bgm = new BGMPlayer();

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// Game State
let isPlaying = false;
let isGameOver = false;
let animationId;
let lastTime = 0;
let frameCount = 0;
let shakeAmount = 0;

let stage = 1;
let score = 0;
let health = 100;
let baseSpeed = 8;
let currentSpeed = baseSpeed;
let distanceInStage = 0;
const STAGE_LENGTH = 5000;
let warningMessage = { text: '', life: 0 };

// Parallax
let bgPositions = { sky: 0, mountains: 0, trees: 0, ground: 0 };

// Active Items
let activeEffects = { speed: 0, ghost: 0, score2x: 0, shields: 0 };
const keys = { jump: false, special: false };
let specialCooldown = 0;
const SPECIAL_MAX_CD = 5000;

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Input Listeners
function handleJumpStart(e) { if(e) e.preventDefault(); keys.jump = true; if(isPlaying && player) player.jump(); }
function handleJumpEnd(e) { if(e) e.preventDefault(); keys.jump = false; }
function handleSpecialStart(e) { if(e) e.preventDefault(); keys.special = true; if(isPlaying && player) player.useSpecial(); }
function handleSpecialEnd(e) { if(e) e.preventDefault(); keys.special = false; }

document.getElementById('btn-jump').addEventListener('mousedown', handleJumpStart);
document.getElementById('btn-jump').addEventListener('touchstart', handleJumpStart, {passive: false});
document.getElementById('btn-jump').addEventListener('mouseup', handleJumpEnd);
document.getElementById('btn-jump').addEventListener('touchend', handleJumpEnd);

document.getElementById('btn-special').addEventListener('mousedown', handleSpecialStart);
document.getElementById('btn-special').addEventListener('touchstart', handleSpecialStart, {passive: false});
document.getElementById('btn-special').addEventListener('mouseup', handleSpecialEnd);
document.getElementById('btn-special').addEventListener('touchend', handleSpecialEnd);

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') handleJumpStart();
    if (e.code === 'ShiftLeft' || e.code === 'KeyZ') handleSpecialStart();
});
window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') handleJumpEnd();
    if (e.code === 'ShiftLeft' || e.code === 'KeyZ') handleSpecialEnd();
});

// UI Elements
const scoreDisplay = document.getElementById('score-display');
const stageDisplay = document.getElementById('stage-display');
const healthFill = document.getElementById('health-fill');
const activeItemsContainer = document.getElementById('active-items');
const btnJump = document.getElementById('btn-jump');
const btnSpecial = document.getElementById('btn-special');

// Player Object
const player = {
    x: 0, y: 0, width: 60, height: 80, vy: 0, gravity: 0.8, jumpStrength: -16,
    isGrounded: false, jumpCount: 0, dashActive: 0,
    
    init() {
        this.x = canvas.width * 0.15;
        this.groundY = canvas.height - 120;
        this.y = this.groundY - this.height;
        this.vy = 0;
        this.isGrounded = true;
        this.jumpCount = 0;
        this.dashActive = 0;
    },

    jump() {
        // Check if in No Jump Zone
        const inNoJumpZone = obstacles.some(obs => obs.type === 'nojump' && this.x + this.width > obs.x && this.x < obs.x + obs.width);
        if (inNoJumpZone) {
            handleDamage();
            warningMessage = { text: 'DO NOT JUMP!', life: 60 };
            return;
        }

        if (this.jumpCount < 2) {
            this.vy = this.jumpStrength;
            this.isGrounded = false;
            this.jumpCount++;
            if (this.jumpCount === 1) {
                sounds.jump();
                createParticles(this.x + this.width/2, this.y + this.height, '#fff', 10);
            } else {
                sounds.doubleJump();
                createParticles(this.x + this.width/2, this.y + this.height/2, varColor('--accent'), 15);
            }
        }
    },

    useSpecial() {
        if (specialCooldown <= 0) {
            this.dashActive = 1000;
            specialCooldown = SPECIAL_MAX_CD;
            sounds.dash();
            shakeAmount = 10;
            createParticles(this.x, this.y + this.height/2, varColor('--secondary'), 25);
        }
    },

    update(dt) {
        this.groundY = canvas.height - 120;
        if (!this.isGrounded) this.vy += this.gravity;
        if (this.dashActive > 0) { this.dashActive -= dt; this.vy = 0; }
        this.y += this.vy;
        if (this.y + this.height >= this.groundY) {
            if (!this.isGrounded) sounds.land();
            this.y = this.groundY - this.height;
            this.vy = 0;
            this.isGrounded = true;
            this.jumpCount = 0;
        } else {
            this.isGrounded = false;
        }
    },

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        const legSwing = this.isGrounded ? Math.sin(frameCount * 0.5) * 15 : 0;
        const bob = this.isGrounded ? Math.abs(Math.sin(frameCount * 0.5)) * 5 : 0;
        ctx.translate(0, bob);
        ctx.fillStyle = '#8B4513';
        ctx.beginPath(); ctx.roundRect(10 + legSwing, this.height - 10, 15, 15, 5); ctx.fill();
        ctx.beginPath(); ctx.roundRect(35 - legSwing, this.height - 10, 15, 15, 5); ctx.fill();
        ctx.fillStyle = '#A0522D';
        ctx.beginPath(); ctx.roundRect(0, 15, this.width, this.height - 25, 20); ctx.fill();
        ctx.fillStyle = '#8B4513';
        ctx.beginPath(); ctx.arc(10, 15, 12, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(this.width - 10, 15, 12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#FFC0CB';
        ctx.beginPath(); ctx.arc(10, 15, 6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(this.width - 10, 15, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#FFE4C4';
        ctx.beginPath(); ctx.ellipse(this.width/2, 45, 15, 10, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(this.width/2, 42, 4, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#000';
        const eyeOffsetX = this.dashActive > 0 ? 5 : 0;
        ctx.beginPath(); ctx.arc(15 + eyeOffsetX, 30, 4, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(this.width - 15 + eyeOffsetX, 30, 4, 0, Math.PI*2); ctx.fill();
        if (this.dashActive > 0) {
            ctx.fillStyle = 'rgba(0, 210, 255, 0.4)';
            ctx.beginPath(); ctx.roundRect(-25, 10, this.width + 50, this.height - 10, 20); ctx.fill();
        }
        if (activeEffects.ghost > 0) ctx.globalAlpha = 0.5;
        if (activeEffects.shields > 0) {
            ctx.strokeStyle = varColor('--item-shield');
            ctx.lineWidth = 4;
            ctx.beginPath(); ctx.arc(this.width/2, this.height/2, this.height * 0.7, 0, Math.PI*2); ctx.stroke();
            ctx.fillStyle = varColor('--item-shield');
            ctx.font = '20px "Lilita One"'; ctx.textAlign = 'center'; ctx.fillText(activeEffects.shields, this.width/2, -10);
        }
        ctx.restore();
    }
};

let obstacles = [], items = [], particles = [];

function varColor(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#ffffff'; }
function createParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x, y: y, vx: (Math.random() - 0.5) * 12, vy: (Math.random() - 0.5) * 12,
            life: 1.0, color: color, size: Math.random() * 8 + 2
        });
    }
}

function spawnObstacle() {
    const rand = Math.random();
    const groundY = canvas.height - 120;
    
    if (rand > 0.85) { // No Jump Zone
        const width = 400 + Math.random() * 400;
        obstacles.push({ x: canvas.width + 100, y: groundY - 10, width: width, height: 10, type: 'nojump' });
    } else if (rand > 0.7) { // Trap (Spikes)
        obstacles.push({ x: canvas.width + 100, y: groundY - 60, width: 80, height: 60, type: 'trap' });
    } else {
        const isFlying = Math.random() > 0.6;
        const height = Math.random() * 50 + 40;
        obstacles.push({
            x: canvas.width + 100, y: isFlying ? groundY - height - Math.random() * 120 - 60 : groundY - height,
            width: 45, height: height, type: isFlying ? 'flying' : 'ground'
        });
    }
}

function spawnItem() {
    const types = ['speed', 'ghost', 'score2x', 'heal', 'bonus', 'shield'];
    items.push({
        x: canvas.width + 50, y: canvas.height - 170 - Math.random() * 180,
        width: 35, height: 35, type: types[Math.floor(Math.random() * types.length)], bob: Math.random() * 7
    });
}

function drawObstacles(ctx) {
    for (let obs of obstacles) {
        ctx.save(); ctx.translate(obs.x, obs.y);
        if (obs.type === 'nojump') {
            // Draw Warning Zone
            ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
            ctx.fillRect(0, -canvas.height, obs.width, canvas.height + obs.height);
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
            ctx.setLineDash([10, 10]);
            ctx.strokeRect(0, -canvas.height, obs.width, canvas.height + obs.height);
            ctx.fillStyle = '#ff3333';
            ctx.font = 'bold 24px "Lilita One"';
            ctx.textAlign = 'center';
            ctx.fillText('NO JUMP ZONE', obs.width/2, -50);
        } else if (obs.type === 'trap') {
            // Draw Spikes
            ctx.fillStyle = '#777';
            ctx.beginPath();
            for(let i=0; i<4; i++) {
                ctx.moveTo(i * 20, obs.height);
                ctx.lineTo(i * 20 + 10, 0);
                ctx.lineTo(i * 20 + 20, obs.height);
            }
            ctx.fill();
            ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.stroke();
        } else {
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath(); ctx.ellipse(obs.width/2, obs.height, obs.width*0.8, 5, 0, 0, Math.PI*2); ctx.fill();
            if (obs.type === 'flying') {
                ctx.fillStyle = '#444'; ctx.beginPath(); ctx.moveTo(0, obs.height/2); ctx.lineTo(obs.width/2, 0); ctx.lineTo(obs.width, obs.height/2); ctx.lineTo(obs.width/2, obs.height); ctx.fill();
                ctx.fillStyle = '#f00'; ctx.beginPath(); ctx.arc(10, obs.height/2, 6, 0, Math.PI*2); ctx.fill();
            } else {
                ctx.fillStyle = '#555'; ctx.beginPath(); ctx.moveTo(0, obs.height); ctx.lineTo(obs.width/2, 0); ctx.lineTo(obs.width, obs.height); ctx.fill();
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
            }
        }
        ctx.restore();
    }
}

function drawItems(ctx) {
    for (let item of items) {
        ctx.save(); item.bob += 0.15;
        ctx.translate(item.x, item.y + Math.sin(item.bob) * 12);
        let color = '#fff', icon = '?';
        if(item.type === 'speed') { color = varColor('--item-speed'); icon = '>>'; }
        if(item.type === 'ghost') { color = '#fff'; icon = 'G'; }
        if(item.type === 'score2x') { color = varColor('--item-score'); icon = '2X'; }
        if(item.type === 'heal') { color = '#ff3366'; icon = '+'; }
        if(item.type === 'bonus') { color = '#ffd700'; icon = '$'; }
        if(item.type === 'shield') { color = varColor('--item-shield'); icon = 'S'; }
        ctx.shadowColor = color; ctx.shadowBlur = 20; ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(item.width/2, item.height/2, item.width/2, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0; ctx.fillStyle = '#000'; ctx.font = 'bold 18px "Lilita One"';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(icon, item.width/2, item.height/2);
        ctx.restore();
    }
}

function drawParticles(ctx) {
    for (let p of particles) {
        ctx.globalAlpha = p.life; ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1.0;
}

function updateUI() {
    scoreDisplay.innerText = Math.floor(score);
    stageDisplay.innerText = stage;
    healthFill.style.width = Math.max(0, health) + '%';
    if (specialCooldown > 0) {
        const perc = 100 - (specialCooldown / SPECIAL_MAX_CD * 100);
        btnSpecial.style.background = `linear-gradient(to top, rgba(255, 0, 123, 0.4) ${perc}%, rgba(255, 255, 255, 0.1) ${perc}%)`;
    } else {
        btnSpecial.style.background = '';
    }
    let activeHTML = '';
    for (let key in activeEffects) {
        if (key === 'shields' && activeEffects[key] > 0) {
            activeHTML += `<div class="item-indicator shield"><i class="fas fa-shield-alt"></i> x${activeEffects[key]}</div>`;
        } else if (activeEffects[key] > 0 && key !== 'shields') {
            const perc = (activeEffects[key] / 20000) * 100;
            let icon = key==='speed'?'fa-bolt':(key==='ghost'?'fa-ghost':'fa-star');
            activeHTML += `<div class="item-indicator ${key}"><i class="fas ${icon}"></i><div class="item-timer"><div class="item-timer-fill" style="width: ${perc}%"></div></div></div>`;
        }
    }
    activeItemsContainer.innerHTML = activeHTML;
}

function handleDamage() {
    if (activeEffects.ghost > 0 || player.dashActive > 0) return;
    if (activeEffects.shields > 0) {
        activeEffects.shields--; sounds.shield();
        createParticles(player.x + player.width/2, player.y + player.height/2, varColor('--item-shield'), 30);
        player.dashActive = 500; return;
    }
    health -= 20; sounds.hit(); shakeAmount = 15;
    createParticles(player.x + player.width/2, player.y + player.height/2, '#f00', 30);
    player.dashActive = 1000;
    if (health <= 0) endGame();
}

function gameLoop(timestamp) {
    if (!isPlaying) return;
    const dt = timestamp - lastTime; lastTime = timestamp; frameCount++;
    currentSpeed = baseSpeed + (stage * 0.6);
    if (activeEffects.speed > 0) currentSpeed *= 2;
    distanceInStage += currentSpeed;
    if (distanceInStage > STAGE_LENGTH) {
        if (stage < 100) {
            stage++;
            health = Math.min(100, health + 20);
        }
        distanceInStage = 0;
        sounds.levelUp();
        createParticles(player.x + player.width/2, player.y, '#ff0', 50);
    }
    score += (currentSpeed / 10) * (activeEffects.score2x > 0 ? 2 : 1);
    if (specialCooldown > 0) specialCooldown -= dt;
    for (let key in activeEffects) if (key !== 'shields' && activeEffects[key] > 0) activeEffects[key] = Math.max(0, activeEffects[key] - dt);
    
    // Increased difficulty: spawn rate gets faster with stage
    const spawnRate = Math.max(10, 60 - stage * 0.5);
    if (frameCount % Math.floor(spawnRate) === 0 && Math.random() > 0.25) spawnObstacle();
    if (frameCount % (Math.floor(spawnRate) * 5) === 0 && Math.random() > 0.5) spawnItem();

    document.getElementById('bg-sky').style.backgroundPosition = `-${bgPositions.sky += currentSpeed * 0.1}px 0`;
    document.getElementById('bg-mountains').style.backgroundPosition = `-${bgPositions.mountains += currentSpeed * 0.3}px bottom`;
    document.getElementById('bg-trees').style.backgroundPosition = `-${bgPositions.trees += currentSpeed * 0.6}px bottom`;
    document.getElementById('bg-ground').style.backgroundPosition = `-${bgPositions.ground += currentSpeed}px 0`;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    if (shakeAmount > 0) {
        ctx.translate((Math.random()-0.5)*shakeAmount, (Math.random()-0.5)*shakeAmount);
        shakeAmount *= 0.9; if (shakeAmount < 0.1) shakeAmount = 0;
    }
    player.update(dt);
    for (let i = obstacles.length - 1; i >= 0; i--) {
        let obs = obstacles[i]; obs.x -= currentSpeed;
        
        // Skip collision check for nojump zone (it only affects jump logic)
        if (obs.type === 'nojump') {
            if (obs.x + obs.width < 0) obstacles.splice(i, 1);
            continue;
        }

        if (player.x < obs.x + obs.width && player.x + player.width > obs.x && player.y < obs.y + obs.height && player.y + player.height > obs.y) {
            if (player.dashActive > 0 && activeEffects.ghost <= 0) {
                createParticles(obs.x + obs.width/2, obs.y + obs.height/2, '#ccc', 20);
                obstacles.splice(i, 1); score += 50; sounds.land();
            } else handleDamage();
        } else if (obs.x + obs.width < 0) obstacles.splice(i, 1);
    }
    for (let i = items.length - 1; i >= 0; i--) {
        let it = items[i]; it.x -= currentSpeed;
        if (player.x < it.x + it.width && player.x + player.width > it.x && player.y < it.y + it.height && player.y + player.height > it.y) {
            sounds.item(); createParticles(it.x, it.y, it.type==='speed'?'#0fc':'#fff', 15);
            if (it.type === 'speed' || it.type === 'ghost' || it.type === 'score2x') activeEffects[it.type] = 20000;
            else if (it.type === 'shield') activeEffects.shields++;
            else if (it.type === 'heal') health = Math.min(100, health + 30);
            else score += 500;
            items.splice(i, 1);
        } else if (it.x + it.width < 0) items.splice(i, 1);
    }
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i]; p.x += p.vx; p.y += p.vy; p.life -= 0.04;
        if (p.life <= 0) particles.splice(i, 1);
    }
    drawObstacles(ctx); drawItems(ctx); player.draw(ctx); drawParticles(ctx);
    
    // Draw Warning Message
    if (warningMessage.life > 0) {
        ctx.fillStyle = '#ff3333';
        ctx.font = 'bold 40px "Lilita One"';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 10; ctx.shadowColor = '#000';
        ctx.fillText(warningMessage.text, canvas.width/2, canvas.height/2);
        ctx.shadowBlur = 0;
        warningMessage.life--;
    }

    ctx.restore(); updateUI();
    animationId = requestAnimationFrame(gameLoop);
}

function startGame() {
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('game-over-screen').style.display = 'none';
    if (!isGameOver) { stage = 1; score = 0; }
    health = 100; distanceInStage = 0; activeEffects = { speed: 0, ghost: 0, score2x: 0, shields: 0 };
    specialCooldown = 0; obstacles = []; items = []; particles = [];
    player.init(); isPlaying = true; isGameOver = false; lastTime = performance.now();
    bgm.start(); animationId = requestAnimationFrame(gameLoop);
}

function endGame() {
    isPlaying = false; isGameOver = true; bgm.stop(); cancelAnimationFrame(animationId);
    document.getElementById('game-over-screen').style.display = 'flex';
    document.getElementById('final-stage').innerText = stage;
    document.getElementById('final-score').innerText = Math.floor(score);
    submitScore(Math.floor(score)); fetchLeaderboard('end');
}

function submitScore(s) {
    if (s <= 0) return;
    fetch('/api/submit-score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ score: s, gameType: 'magicrush' }) })
    .then(r => r.json()).then(d => { if (d.updatedScores) document.getElementById('best-score').innerText = d.updatedScores.magicrush_best_score; });
}

function fetchLeaderboard(c) {
    const tid = c === 'start' ? 'start-rank-info' : 'end-rank-info';
    const t = document.getElementById(tid); t.innerHTML = 'Loading...';
    fetch('/api/leaderboard?gameType=magicrush').then(r => r.json()).then(d => {
        let h = `<div style="font-family:'Fredoka One';margin-bottom:10px;">GLOBAL TOP</div><div style="display:flex;flex-direction:column;gap:5px;text-align:left;font-size:0.9rem;">`;
        if (d.top10) d.top10.slice(0, 5).forEach((u, i) => { h += `<div>${i+1}. ${u.username} - ${u.best_score}</div>`; });
        if (d.userRank) h += `<div style="margin-top:10px;color:var(--item-shield);">My Rank: ${d.userRank}</div>`;
        t.innerHTML = h + `</div>`;
    });
}

document.getElementById('start-btn').addEventListener('click', () => { isGameOver = false; stage = 1; score = 0; startGame(); });
document.getElementById('restart-btn').addEventListener('click', startGame);
fetchLeaderboard('start');
