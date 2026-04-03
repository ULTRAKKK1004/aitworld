/**
 * LIFT RUSH - High Energy Vertical Arcade Game
 * Controls: Hold Space/Touch to Rise, Release to Stop
 */

let canvas, ctx;
let gameActive = false;
let score = 0;
let speed = 1.0;
let distance = 0;
let energy = 100;
let frameCount = 0;
let combo = 0;
let lastNearMiss = 0;
let hasShield = 0; // Shield timer

let lift;
let obstacles = [];
let items = [];
let particles = [];
let stars = [];

// Audio Context
let audioCtx;
let bgmInterval;

const COLORS = {
    pink: '#ff00ff',
    cyan: '#00ffff',
    lime: '#39ff14',
    yellow: '#ffff00',
    white: '#ffffff',
    bg: '#050505'
};

// --- Sound Engine ---
function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function playSound(type) {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'rise') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.start(); osc.stop(now + 0.1);
    } else if (type === 'hit') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.3);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(); osc.stop(now + 0.3);
    } else if (type === 'item') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.2);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(); osc.stop(now + 0.2);
    } else if (type === 'near-miss') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.start(); osc.stop(now + 0.05);
    }
}

function startBGM() {
    if (bgmInterval) clearInterval(bgmInterval);
    const bpm = 140;
    const interval = 60000 / bpm / 2;
    let step = 0;
    
    bgmInterval = setInterval(() => {
        if (!gameActive) return;
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.type = 'square';
        const notes = [55, 55, 65, 48.99]; // A1, A1, C2, G1
        osc.frequency.setValueAtTime(notes[Math.floor(step / 4) % 4], now);
        
        gain.gain.setValueAtTime(0.03, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        
        osc.start(); osc.stop(now + 0.1);
        step++;
    }, interval);
}

// --- Item Class ---
class Item {
    constructor() {
        const types = ['score', 'heal', 'shield'];
        this.type = types[Math.floor(Math.random() * types.length)];
        this.width = 25;
        this.height = 25;
        this.x = Math.random() * (canvas.width - this.width);
        this.y = -50;
        this.speedY = speed + 1.5;
        this.color = this.type === 'score' ? COLORS.yellow : 
                     (this.type === 'heal' ? COLORS.lime : COLORS.cyan);
        this.angle = 0;
    }

    update() {
        this.y += this.speedY;
        this.angle += 0.05;
        
        if (this.checkCollision(lift)) {
            this.collect();
            return true;
        }
        return this.y > canvas.height + 50;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x + this.width/2, this.y + this.height/2);
        ctx.rotate(this.angle);
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(-this.width/2, -this.height/2, this.width, this.height);
        
        // Inner icon
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    checkCollision(target) {
        return (
            target.x < this.x + this.width &&
            target.x + target.width > this.x &&
            target.y < this.y + this.height &&
            target.y + target.height > this.y
        );
    }

    collect() {
        playSound('item');
        if (this.type === 'score') score += 1000;
        else if (this.type === 'heal') energy = Math.min(100, energy + 20);
        else if (this.type === 'shield') hasShield = 300; // 5 seconds at 60fps
        
        for (let i = 0; i < 10; i++) {
            spawnParticle(this.x + this.width/2, this.y + this.height/2, this.color);
        }
    }
}

class Lift {
    constructor() {
        this.width = 40;
        this.height = 60;
        this.x = canvas.width / 2 - this.width / 2;
        this.y = canvas.height - 150;
        this.velocity = 0;
        this.velocityX = 0;
        this.acceleration = 0.4;
        this.accelX = 0.6;
        this.friction = 0.95;
        this.maxVelocity = 12;
        this.maxVelocityX = 7;
        this.isRising = false;
        this.isMovingLeft = false;
        this.isMovingRight = false;
        this.tilt = 0;
        this.shake = 0;
    }

    update() {
        // Vertical Movement
        if (this.isRising) {
            this.velocity -= this.acceleration;
            if (this.velocity < -this.maxVelocity) this.velocity = -this.maxVelocity;
            this.tilt = Math.max(-0.1, this.tilt - 0.01);
            
            if (frameCount % 5 === 0) playSound('rise');
            
            if (frameCount % 2 === 0) {
                spawnParticle(this.x + this.width / 2, this.y + this.height, hasShield > 0 ? COLORS.yellow : COLORS.cyan);
            }
        } else {
            this.velocity += 0.2;
            if (this.velocity > 2) this.velocity = 2;
            this.tilt *= 0.9;
        }

        // Horizontal Movement
        if (this.isMovingLeft) {
            this.velocityX -= this.accelX;
        } else if (this.isMovingRight) {
            this.velocityX += this.accelX;
        } else {
            this.velocityX *= 0.85;
        }

        if (this.velocityX < -this.maxVelocityX) this.velocityX = -this.maxVelocityX;
        if (this.velocityX > this.maxVelocityX) this.velocityX = this.maxVelocityX;

        this.x += this.velocityX;
        this.y += this.velocity;

        // X Bounds
        if (this.x < 0) {
            this.x = 0;
            this.velocityX *= -0.5;
        } else if (this.x > canvas.width - this.width) {
            this.x = canvas.width - this.width;
            this.velocityX *= -0.5;
        }
        
        // Y Bounds
        const minY = canvas.height * 0.3;
        const maxY = canvas.height - 100;
        
        if (this.y < minY) {
            this.y = minY;
            distance += Math.abs(this.velocity);
        } else if (this.y > maxY) {
            this.y = maxY;
            this.velocity = 0;
        } else {
            distance += Math.max(0, -this.velocity * 0.5);
        }

        if (this.shake > 0) this.shake -= 1;
        if (hasShield > 0) hasShield--;
    }

    draw() {
        ctx.save();
        if (this.shake > 0) {
            ctx.translate(Math.random() * this.shake - this.shake/2, Math.random() * this.shake - this.shake/2);
        }
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.rotate(this.tilt);

        // Shield Effect
        if (hasShield > 0) {
            ctx.beginPath();
            ctx.arc(0, 0, this.height * 0.8, 0, Math.PI * 2);
            ctx.strokeStyle = COLORS.yellow;
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.lineDashOffset = -frameCount;
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Outer Glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = hasShield > 0 ? COLORS.yellow : COLORS.cyan;

        // Body
        ctx.strokeStyle = hasShield > 0 ? COLORS.yellow : COLORS.cyan;
        ctx.lineWidth = 3;
        ctx.strokeRect(-this.width / 2, -this.height / 2, this.width, this.height);
        
        // Inner Details
        ctx.strokeStyle = COLORS.white;
        ctx.lineWidth = 1;
        ctx.strokeRect(-this.width / 2 + 5, -this.height / 2 + 5, this.width - 10, this.height - 10);
        
        // Scanner Line
        let scanY = (Math.sin(frameCount * 0.1) * 0.5 + 0.5) * (this.height - 10) - (this.height - 10) / 2;
        ctx.beginPath();
        ctx.moveTo(-this.width / 2 + 5, scanY);
        ctx.lineTo(this.width / 2 - 5, scanY);
        ctx.strokeStyle = COLORS.lime;
        ctx.stroke();

        ctx.restore();
    }
}

class Obstacle {
    constructor(type) {
        this.type = type;
        this.width = Math.random() * 100 + 50;
        this.height = 20;
        this.x = Math.random() > 0.5 ? -this.width : canvas.width;
        this.y = -50;
        this.speedX = (Math.random() * 2 + 2) * (this.x < 0 ? 1 : -1);
        this.speedY = speed + 2;
        this.color = COLORS.pink;
        this.nearMissed = false;

        if (type === 'laser') {
            this.width = canvas.width * 0.6;
            this.height = 10;
            this.color = COLORS.yellow;
            this.speedX = 0;
            this.x = Math.random() * (canvas.width - this.width);
        } else if (type === 'moving') {
            this.width = 80;
            this.height = 80;
            this.color = COLORS.lime;
        }
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;

        if (this.checkCollision(lift)) {
            handleCollision();
        }

        if (!this.nearMissed && Math.abs(this.y - lift.y) < 50 && Math.abs(this.x + this.width/2 - (lift.x + lift.width/2)) < 80) {
            handleNearMiss();
            this.nearMissed = true;
        }
    }

    draw() {
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        
        if (this.type === 'laser') {
            ctx.globalAlpha = 0.5 + Math.sin(frameCount * 0.2) * 0.3;
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.globalAlpha = 1;
            ctx.strokeStyle = '#fff';
            ctx.strokeRect(this.x, this.y, this.width, this.height);
        } else {
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.strokeRect(this.x, this.y, this.width, this.height);
        }
        ctx.restore();
    }

    checkCollision(target) {
        return (
            target.x < this.x + this.width &&
            target.x + target.width > this.x &&
            target.y < this.y + this.height &&
            target.y + target.height > this.y
        );
    }
}

function spawnParticle(x, y, color) {
    particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 5 + 2,
        life: 1.0,
        color: color || COLORS.cyan
    });
}

function initBackground() {
    stars = [];
    for (let i = 0; i < 100; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2,
            speed: Math.random() * 3 + 1
        });
    }
}

function drawBackground() {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    stars.forEach(star => {
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 0.5;
        ctx.fillRect(star.x, star.y, star.size, star.size);
        star.y += star.speed * (lift.isRising ? 2 : 1);
        if (star.y > canvas.height) star.y = 0;
    });
    ctx.globalAlpha = 1;

    ctx.strokeStyle = 'rgba(0, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 50) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;
        if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
        }
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 3, 3);
    }
    ctx.globalAlpha = 1;
}

function handleCollision() {
    if (hasShield > 0) return;
    
    energy -= 10;
    lift.shake = 20;
    combo = 0;
    playSound('hit');
    spawnExplosion(lift.x + lift.width/2, lift.y + lift.height/2);
    
    if (energy <= 0) {
        gameOver();
    }
    
    obstacles = obstacles.filter(o => Math.abs(o.y - lift.y) > 100);
}

function handleNearMiss() {
    combo++;
    score += 100 * combo;
    lastNearMiss = frameCount;
    playSound('near-miss');
    spawnParticle(lift.x + lift.width/2, lift.y, COLORS.yellow);
}

function spawnExplosion(x, y) {
    for (let i = 0; i < 20; i++) {
        particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 15,
            vy: (Math.random() - 0.5) * 15,
            life: 1.0,
            color: COLORS.pink
        });
    }
}

function gameOver() {
    gameActive = false;
    document.getElementById('game-over-screen').style.display = 'flex';
    document.getElementById('final-score').innerText = Math.floor(score);
    
    submitScore(Math.floor(score));
    fetchLeaderboard('end');
}

function submitScore(score) {
    console.log('[Lift-Rush] Submitting score:', score);
    fetch('/api/submit-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score, gameType: 'lift-rush' })
    }).then(r => r.json()).then(d => {
        console.log('[Lift-Rush] Submit success:', d);
        const bestEl = document.getElementById('best-score');
        if (bestEl && score > parseInt(bestEl.innerText || '0')) {
            bestEl.innerText = score;
        }
    }).catch(e => console.error('[Lift-Rush] Submit failed:', e));
}

function fetchLeaderboard(context) {
    const targetId = context === 'start' ? 'start-rank-info' : 'end-rank-info';
    const target = document.getElementById(targetId);
    
    fetch('/api/lift-rush-leaderboard')
        .then(res => res.json())
        .then(data => {
            const { bestScore } = data;
            let html = `
                <div class="rank-title">GLOBAL TOP 10</div>
                <div class="my-rank">MY RANK: #${bestScore.userRank || 'N/A'}</div>
                <div class="rivals-list">
            `;
            
            bestScore.rivals.forEach(rival => {
                html += `
                    <div class="rival-item ${rival.isCurrent ? 'current' : ''}">
                        #${rival.rank} ${rival.username}: ${rival.best_score}
                    </div>
                `;
            });
            
            html += `</div>`;
            target.innerHTML = html;
        })
        .catch(err => {
            target.innerHTML = 'Failed to load rankings.';
        });
}

function loop() {
    if (!gameActive) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();

    lift.update();
    lift.draw();

    speed = 1.0 + (distance / 5000);
    score += (lift.isRising ? 2 : 0.5) * speed;

    if (frameCount % Math.max(20, Math.floor(60 / speed)) === 0) {
        let type = 'beam';
        if (Math.random() > 0.8) type = 'laser';
        else if (Math.random() > 0.7) type = 'moving';
        obstacles.push(new Obstacle(type));
    }

    if (frameCount % 300 === 0) {
        items.push(new Item());
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
        const o = obstacles[i];
        o.update();
        o.draw();
        if (o.y > canvas.height + 100) obstacles.splice(i, 1);
    }

    for (let i = items.length - 1; i >= 0; i--) {
        if (items[i].update()) {
            items.splice(i, 1);
        } else {
            items[i].draw();
        }
    }

    updateParticles();
    updateHUD();

    frameCount++;
    requestAnimationFrame(loop);
}

function updateHUD() {
    document.getElementById('score').innerText = Math.floor(score);
    document.getElementById('energy-fill').style.width = energy + '%';
    document.getElementById('speed-val').innerText = speed.toFixed(1) + 'x';
    
    const comboText = document.getElementById('combo-text');
    if (combo > 0 && frameCount - lastNearMiss < 60) {
        comboText.innerText = 'COMBO x' + combo;
        comboText.style.display = 'block';
    } else {
        comboText.style.display = 'none';
        if (frameCount - lastNearMiss >= 60) combo = 0;
    }
}

function startGame() {
    initAudio();
    startBGM();
    
    gameActive = true;
    score = 0;
    distance = 0;
    energy = 100;
    speed = 1.0;
    frameCount = 0;
    combo = 0;
    hasShield = 0;
    obstacles = [];
    items = [];
    particles = [];
    
    lift = new Lift();
    
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('game-over-screen').style.display = 'none';
    
    fetch('/api/increment-attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game: 'lift-rush' })
    });

    loop();
}

function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    function resize() {
        canvas.width = Math.min(window.innerWidth, 500);
        canvas.height = window.innerHeight;
    }
    
    window.addEventListener('resize', resize);
    resize();
    
    initBackground();
    fetchLeaderboard('start');

    window.addEventListener('keydown', (e) => {
        if (!gameActive) return;
        if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') lift.isRising = true;
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') lift.isMovingLeft = true;
        if (e.code === 'ArrowRight' || e.code === 'KeyD') lift.isMovingRight = true;
    });

    window.addEventListener('keyup', (e) => {
        if (!gameActive) return;
        if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') lift.isRising = false;
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') lift.isMovingLeft = false;
        if (e.code === 'ArrowRight' || e.code === 'KeyD') lift.isMovingRight = false;
    });
    
    window.setLeft = (active) => { if (gameActive) lift.isMovingLeft = active; };
    window.setRight = (active) => { if (gameActive) lift.isMovingRight = active; };
    window.setRise = (active) => { if (gameActive) lift.isRising = active; };
}

window.onload = init;
