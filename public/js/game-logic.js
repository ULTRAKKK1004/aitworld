/**
* NEON BREAKOUT - Integrated with Tor-AI Portal
*/
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
// UI Elements
const scoreEl = document.getElementById('score');
const stageEl = document.getElementById('stage');
const timerEl = document.getElementById('timer');
const attacksContainer = document.getElementById('attacks-container');
const activeEffectsDiv = document.getElementById('active-effects');
const gameOverScreen = document.getElementById('game-over-screen');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const menuBtn = document.getElementById('menu-btn');
const stageSelectionDiv = document.getElementById('stage-selection');
const gameOverContentDiv = document.getElementById('game-over-content');
const finalScoreEl = document.getElementById('final-score');
const finalStageEl = document.getElementById('final-stage');
const stageGrid = document.getElementById('stageGrid');
const btnLeft = document.getElementById('btn-left');
const btnRight = document.getElementById('btn-right');
const gameTitle = document.getElementById('game-title');

// --- AUDIO CONTEXT SETUP ---
let audioCtx = null;
let bgmInterval = null;

function startBrickBGM() {
    if (bgmInterval) return;
    console.log("Starting Frantic Arcade BGM");
    let step = 0;
    bgmInterval = setInterval(() => {
        if (!audioCtx || audioCtx.state !== 'running' || !gameState.running) return;
        
        // Frantic, high-pitched arcade melody
        const melody = [523.25, 587.33, 659.25, 523.25, 783.99, 698.46, 659.25, 523.25]; // C5 major arpeggio feel
        const bass = [130.81, 130.81, 164.81, 196.00]; // Low C context
        
        const now = audioCtx.currentTime;
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        
        // Alternating between melody and fast bass pulses
        let freq = (step % 2 === 0) ? melody[Math.floor(step/2) % melody.length] : bass[Math.floor(step/4) % bass.length];
        
        o.type = (step % 4 === 0) ? 'square' : 'triangle';
        o.frequency.setValueAtTime(freq, now);
        
        // Increased gain to 0.2
        g.gain.setValueAtTime(0.2, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        
        o.connect(g);
        g.connect(audioCtx.destination);
        o.start();
        o.stop(now + 0.1);
        
        step++;
    }, 125); // Very fast (125ms) for a hectic, challenging feel
}

function stopBrickBGM() {
    if (bgmInterval) {
        clearInterval(bgmInterval);
        bgmInterval = null;
    }
}

function playBlockHitSound(hitHP, maxHP) {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.type = 'sine';
    const minFreq = 300;
    const maxFreq = 1200;
    const hpRatio = hitHP / maxHP; 
    const frequency = minFreq + ((maxFreq - minFreq) * (1 - hpRatio));
    oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.3);
}

// --- CONFIGURATION ---
const PADDLE_WIDTH = 100;
const PADDLE_HEIGHT = 15;
const PADDLE_Y_MARGIN = 80;
const PADDLE_Y = canvas.height - PADDLE_Y_MARGIN;
const BLOCK_SIZE = 40;
const BLOCK_ROWS = 7;
const BLOCK_COLS = 8;
const BLOCK_PADDING = 6;
const BLOCK_OFFSET_TOP = 70;
const BLOCK_OFFSET_LEFT = (canvas.width - (BLOCK_COLS * (BLOCK_SIZE + BLOCK_PADDING) - BLOCK_PADDING)) / 2;
const MAX_BLOCK_HP = 10; 

// --- STATE ---
let gameState = {
    running: false,
    score: 0,
    attacks: 3,
    respawnsLeft: 10,
    stage: 1,
    startTime: 0,
    elapsedTime: 0,
    balls: [],
    blocks: [],
    particles: [],
    items: [],
    lasers: [],
    paddleX: canvas.width / 2 - PADDLE_WIDTH / 2,
    currentPaddleWidth: PADDLE_WIDTH,
    keys: { left: false, right: false },
    lastItemTime: Date.now(),
    currentItem: null,
    itemTimer: 0,
    penaltyMultiplier: 1.0,
    dirChanges: [],
    lastPaddleDir: 0,
    prevPaddleX: 0,
    penaltyDebounce: false,
    effects: {
        doubleSpeed: false,
        invincibleBlocks: false,
        halfSpeed: false,
        doubleDamage: false,
        explodeRow: false,
        paddleDouble: false,
        paddleHalf: false
    }
};

class LaserBeam {
    constructor(x, width) {
        this.x = x;
        this.width = width;
        this.y = 0;
        this.height = canvas.height;
        this.life = 1.0;
        this.decay = 0.05;
        this.color = '#0ff';
    }
    update() {
        this.life -= this.decay;
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 20;
        ctx.shadowColor = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        // Outer glow
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x + 2, this.y, this.width - 4, this.height);
        ctx.restore();
    }
}

// --- CLASSES (Particle, Item, Ball, Block) ---
class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y; this.color = color;
        this.size = Math.random() * 4 + 2;
        this.speedX = (Math.random() - 0.5) * 6;
        this.speedY = (Math.random() - 0.5) * 6;
        this.life = 1.0;
        this.decay = 0.02 + Math.random() * 0.02;
    }
    update() { this.x += this.speedX; this.y += this.speedY; this.life -= this.decay; this.size *= 0.95; }
    draw() {
        ctx.save(); ctx.globalAlpha = this.life; ctx.fillStyle = this.color; ctx.shadowBlur = 10; ctx.shadowColor = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size); ctx.restore();
    }
}
class Item {
    constructor() {
        this.size = 30; this.x = Math.random() * (canvas.width - this.size * 2) + this.size;
        this.y = -this.size; this.speed = 3; this.angle = 0;
        const items = ['A', 'B', 'C', 'D', 'E', 'R', 'F', 'G'];
        this.type = items[Math.floor(Math.random() * items.length)];
        this.colors = { 'A': '#FF3333', 'B': '#FFFFFF', 'C': '#33FFFF', 'D': '#FFFF33', 'E': '#FF33FF', 'R': '#00FF00', 'F': '#FF6600', 'G': '#00CCFF' };
        this.color = this.colors[this.type];
    }
    update() { this.y += this.speed; this.angle += 0.05; this.x += Math.sin(this.angle) * 1.0; }
    draw() {
        ctx.save(); ctx.shadowBlur = 15; ctx.shadowColor = this.color; ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#000'; ctx.font = 'bold 18px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(this.type, this.x, this.y); ctx.restore();
    }
}
class Ball {
    constructor(x, y) {
        this.x = x; this.y = y; this.radius = 5;
        this.baseSpeed = 5 + (gameState.stage * 0.5);
        this.active = true; this.color = '#FFF';
        this.dx = (Math.random() * 6) - 3; this.dy = -(4 + Math.random() * 2);
        this.updateSpeed();
    }
    updateSpeed() {
        let currentSpeed = this.baseSpeed * (gameState.penaltyMultiplier || 1.0);
        if (gameState.effects.doubleSpeed) currentSpeed *= 2;
        if (gameState.effects.halfSpeed) currentSpeed *= 0.7;
        const mag = Math.sqrt(this.dx * this.dx + this.dy * this.dy);
        if (mag > 0) { this.dx = (this.dx / mag) * currentSpeed; this.dy = (this.dy / mag) * currentSpeed; }
    }
    update() {
        if (!this.active) return;
        this.x += this.dx; this.y += this.dy;
        if (this.x + this.radius > canvas.width || this.x - this.radius < 0) this.dx = -this.dx;
        if (this.y - this.radius < 0) { this.y = this.radius; this.dy = -this.dy; }
        if (this.y + this.radius >= PADDLE_Y && this.y - this.radius <= PADDLE_Y + PADDLE_HEIGHT &&
            this.x >= gameState.paddleX && this.x <= gameState.paddleX + gameState.currentPaddleWidth) {
            if (gameState.effects.explodeRow) { this.triggerExplosionRow(); gameState.effects.explodeRow = false; removeActiveEffect('E'); }
            let collidePoint = this.x - (gameState.paddleX + gameState.currentPaddleWidth / 2);
            collidePoint = collidePoint / (gameState.currentPaddleWidth / 2);
            let angle = collidePoint * (Math.PI / 2.5);
            this.dx = this.baseSpeed * Math.sin(angle); this.dy = -this.baseSpeed * Math.cos(angle);
            this.updateSpeed();
            if (gameState.balls.length < 10) spawnNewBall(this.x, this.y, -this.dx, this.dy);
        }
        if (this.y - this.radius > canvas.height) this.active = false;
    }
    triggerExplosionRow() {
        const hitBlocks = gameState.blocks.filter(b => b.active && this.x >= b.x && this.x <= b.x + b.width);
        hitBlocks.forEach(block => {
            if (!block.active) return;
            block.hp = 0; block.active = false;
            gameState.score += 100 * gameState.stage;
            createExplosion(block.x + block.width/2, block.y + block.height/2, '#fff');
            checkNeighboringBlocks(block.x, block.y);
        });
        updateUI();
    }
    draw() {
        if (!this.active) return;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fillStyle = this.color;
        ctx.shadowBlur = gameState.effects.doubleSpeed ? 20 : 15;
        ctx.shadowColor = gameState.effects.doubleSpeed ? '#f00' : this.color;
        ctx.fill(); ctx.closePath();
    }
}
function getNeonColor(hp) {
    const colors = [
        '#FF0033', // 1: Red
        '#9D00FF', // 2: Purple
        '#FF00FF', // 3: Magenta
        '#FF9900', // 4: Orange
        '#FFFF00', // 5: Yellow
        '#00FF00', // 6: Green
        '#00FFFF', // 7: Cyan
        '#0099FF', // 8: Azure
        '#FFFFFF'  // 9+: White/Glow
    ];
    if (hp <= 0) return colors[0];
    if (hp >= colors.length) return colors[colors.length - 1];
    return colors[hp - 1];
}

class Block {
    constructor(x, y, hp) {
        this.x = x; this.y = y; this.width = BLOCK_SIZE; this.height = BLOCK_SIZE;
        this.hp = hp; this.baseHp = hp; this.color = getNeonColor(hp); this.active = true;
    }
    draw() {
        if (!this.active) return;
        if (gameState.effects.invincibleBlocks && Math.floor(Date.now() / 200) % 2 === 0) return;
        
        // Block body
        ctx.save();
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Gloss effect
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(this.x + 2, this.y + 2, this.width - 4, this.height - 4);
        
        // Inner detail
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(this.x + 4, this.y + 4, this.width - 8, 4);
        
        // HP Text
        ctx.fillStyle = (this.hp <= 2) ? '#000' : '#FFF';
        ctx.font = 'bold 16px Courier New';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 0;
        ctx.fillText(this.hp, this.x + this.width / 2, this.y + this.height / 2);
        ctx.restore();
    }
}

// --- CORE FUNCTIONS ---
function initStage(stageNum) {
    gameState.stage = stageNum; gameState.balls = []; gameState.blocks = []; gameState.particles = [];
    gameState.currentPaddleWidth = getStagePaddleWidth(stageNum);
    gameState.paddleX = canvas.width / 2 - gameState.currentPaddleWidth / 2;
    gameState.prevPaddleX = gameState.paddleX;
    gameState.lastItemTime = Date.now();
    gameState.respawning = false;
    gameState.penaltyMultiplier = 1.0;
    gameState.dirChanges = [];
    resetEffects();
    gameState.balls.push(new Ball(canvas.width / 2, canvas.height - 120));
    let baseHp = 3 + ((gameState.stage - 1) * 2);
    for (let r = 0; r < BLOCK_ROWS; r++) {
        for (let c = 0; c < BLOCK_COLS; c++) {
            let hp = baseHp;
            if (gameState.stage > 3) { if (Math.random() > 0.7) hp += 1; if (Math.random() > 0.9) hp += 1; }
            let x = BLOCK_OFFSET_LEFT + c * (BLOCK_SIZE + BLOCK_PADDING);
            let y = BLOCK_OFFSET_TOP + r * (BLOCK_SIZE + BLOCK_PADDING);
            gameState.blocks.push(new Block(x, y, hp));
        }
    }
    updateUI(); updateAttacksUI();
}
function spawnNewBall(x, y, dx, dy) {
    if (gameState.balls.length < 10) {
        let newBall = new Ball(x, y); newBall.dx = dx; newBall.dy = dy; newBall.updateSpeed();
        newBall.active = true; gameState.balls.push(newBall);
    }
}
function createExplosion(x, y, color) { 
    if (gameState.particles.length > 500) return; // Prevent performance freeze
    for (let i = 0; i < 15; i++) gameState.particles.push(new Particle(x, y, color)); 
}
function applyItemEffect(itemType) {
    let duration = 5000; let effectText = "";
    gameState.itemTimer = Date.now() + duration; gameState.currentItem = itemType;
    switch(itemType) {
        case 'A': gameState.effects.doubleSpeed = true; effectText = "Double Speed (2x)"; break;
        case 'B': gameState.effects.invincibleBlocks = true; effectText = "Invincible Blocks"; break;
        case 'C': gameState.effects.halfSpeed = true; effectText = "Slow Motion (0.7x)"; break;
        case 'D': gameState.effects.doubleDamage = true; effectText = "Double Damage"; break;
        case 'E': gameState.effects.explodeRow = true; effectText = "Row Explosion Ready"; break;
        case 'R': 
            gameState.attacks = 3; 
            updateAttacksUI(); 
            effectText = "Attacks Reloaded!"; 
            break;
        case 'F': 
            gameState.effects.paddleHalf = true; 
            gameState.currentPaddleWidth = PADDLE_WIDTH / 2;
            effectText = "Paddle Half (0.5x)"; 
            break;
        case 'G': 
            gameState.effects.paddleDouble = true; 
            gameState.currentPaddleWidth = PADDLE_WIDTH * 2;
            effectText = "Paddle Double (2x)"; 
            break;
    }
    addActiveEffect(effectText);
}
function addActiveEffect(text) {
    const div = document.createElement('div'); div.className = 'effect-text'; div.innerText = text;
    if (text.includes("패널티")) {
        div.style.color = "#f00";
        div.style.borderColor = "#f00";
        div.style.textShadow = "0 0 10px #f00";
    }
    activeEffectsDiv.appendChild(div); setTimeout(() => { if (div.parentNode) div.parentNode.removeChild(div); }, 5000);
}
function removeActiveEffect(type) {
    // Current UI doesn't track effects by type for individual removal,
    // so we just clear the container or let the timeout handle it.
    // This function prevents ReferenceError.
    if (type === 'E') {
        const effects = activeEffectsDiv.getElementsByClassName('effect-text');
        for (let i = 0; i < effects.length; i++) {
            if (effects[i].innerText.includes("Row Explosion")) {
                effects[i].remove();
                break;
            }
        }
    }
}
function resetEffects() {
    gameState.effects.doubleSpeed = false; gameState.effects.invincibleBlocks = false;
    gameState.effects.halfSpeed = false; gameState.effects.doubleDamage = false;
    gameState.effects.explodeRow = false;
    gameState.effects.paddleHalf = false; gameState.effects.paddleDouble = false;
    gameState.currentItem = null;
    gameState.currentPaddleWidth = getStagePaddleWidth(gameState.stage);
    activeEffectsDiv.innerHTML = '';
}

function getStagePaddleWidth(stage) {
    let width = PADDLE_WIDTH;
    if (stage > 10) {
        width -= (stage - 10) * 5;
        if (width < 30) width = 30;
    }
    return width;
}
function checkItemCollision(item) {
    return (item.y + item.size/2 >= PADDLE_Y && item.y - item.size/2 <= PADDLE_Y + PADDLE_HEIGHT &&
            item.x >= gameState.paddleX && item.x <= gameState.paddleX + gameState.currentPaddleWidth);
}
function checkCollisions() {
    gameState.blocks.forEach(block => {
        if (!block.active || gameState.effects.invincibleBlocks) return;
        gameState.balls.forEach(ball => {
            if (!ball.active) return;
            if (ball.x + ball.radius > block.x && ball.x - ball.radius < block.x + block.width &&
                ball.y + ball.radius > block.y && ball.y - ball.radius < block.y + block.height) {
                if (ball.y + ball.radius <= block.y + block.height / 2) { ball.dy = -ball.dy; ball.y = block.y - ball.radius - 1; }
                else if (ball.y - ball.radius >= block.y + block.height / 2) {
                    if (ball.y < PADDLE_Y - 50) { ball.dy = -ball.dy; ball.y = block.y + block.height + ball.radius + 1; }
                    else { ball.dx = -ball.dx; }
                } else { ball.dx = -ball.dx; }
                playBlockHitSound(block.hp, block.baseHp);
                let damage = gameState.effects.doubleDamage ? 2 : 1;
                block.hp -= damage; createExplosion(ball.x, ball.y, block.color);
                if (block.hp <= 0) {
                    block.active = false; gameState.score += 100 * gameState.stage;
                    createExplosion(block.x + block.width/2, block.y + block.height/2, '#fff');
                    checkNeighboringBlocks(block.x, block.y);
                } else { block.color = getNeonColor(block.hp); }
                updateUI();
            }
        });
    });
    if (gameState.blocks.filter(b => b.active).length === 0) {
        if (gameState.stage < 20) { gameState.stage++; initStage(gameState.stage); }
        else { gameWin(); }
    }
}
function checkNeighboringBlocks(blockX, blockY) {
    if (gameState.effects.invincibleBlocks) return;
    const neighbors = [
        { x: blockX + BLOCK_SIZE + BLOCK_PADDING, y: blockY }, 
        { x: blockX - (BLOCK_SIZE + BLOCK_PADDING), y: blockY },
        { x: blockX, y: blockY + BLOCK_SIZE + BLOCK_PADDING }, 
        { x: blockX, y: blockY - (BLOCK_SIZE + BLOCK_PADDING) }
    ];
    neighbors.forEach(pos => {
        // Use a small epsilon for coordinate comparison
        let target = gameState.blocks.find(b => Math.abs(b.x - pos.x) < 5 && Math.abs(b.y - pos.y) < 5 && b.active);
        if (target) {
            target.hp--;
            if (target.hp <= 0) {
                target.active = false; 
                gameState.score += 50 * gameState.stage;
                createExplosion(target.x + target.width/2, target.y + target.height/2, '#fff');
                // Recursive call for chain reaction
                checkNeighboringBlocks(target.x, target.y);
            } else { 
                target.color = getNeonColor(target.hp); 
            }
        }
    });
}
function update() {
    if (gameState.keys.left) gameState.paddleX -= 7;
    if (gameState.keys.right) gameState.paddleX += 7;
    if (gameState.paddleX < 0) gameState.paddleX = 0;
    if (gameState.paddleX + gameState.currentPaddleWidth > canvas.width) gameState.paddleX = canvas.width - gameState.currentPaddleWidth;

    // --- PADDLE MOVEMENT PENALTY TRACKING ---
    let currentDir = 0;
    if (gameState.paddleX > gameState.prevPaddleX) currentDir = 1;
    else if (gameState.paddleX < gameState.prevPaddleX) currentDir = -1;

    if (currentDir !== 0 && currentDir !== gameState.lastPaddleDir) {
        gameState.dirChanges.push(Date.now());
        gameState.lastPaddleDir = currentDir;
    }
    gameState.prevPaddleX = gameState.paddleX;

    const now = Date.now();
    gameState.dirChanges = gameState.dirChanges.filter(t => now - t < 1000);

    if (gameState.dirChanges.length >= 15 && !gameState.penaltyDebounce) {
        gameState.penaltyMultiplier *= 2.0;
        addActiveEffect("과도한 움직임으로 인한 패널티");
        gameState.balls.forEach(b => b.updateSpeed());
        gameState.penaltyDebounce = true;
        setTimeout(() => { gameState.penaltyDebounce = false; }, 1000);
    }
    // ------------------------------------------

    if (gameState.currentItem && Date.now() > gameState.itemTimer) resetEffects();
    if (Date.now() - gameState.lastItemTime > 10000) { gameState.items.push(new Item()); gameState.lastItemTime = Date.now(); }
    for (let i = gameState.items.length - 1; i >= 0; i--) {
        let item = gameState.items[i]; item.update();
        if (checkItemCollision(item)) { applyItemEffect(item.type); createExplosion(item.x, item.y, item.color); gameState.items.splice(i, 1); }
        else if (item.y > canvas.height + 50) gameState.items.splice(i, 1);
    }
    gameState.balls.forEach(ball => { ball.updateSpeed(); ball.update(); });
    gameState.balls = gameState.balls.filter(b => b.active);
    checkCollisions();
    gameState.particles.forEach(p => p.update());
    gameState.particles = gameState.particles.filter(p => p.life > 0);
    
    // Update lasers
    gameState.lasers.forEach(l => l.update());
    gameState.lasers = gameState.lasers.filter(l => l.life > 0);

    if (gameState.balls.length === 0 && !gameState.respawning) {
        gameState.respawning = true;
        // Decrement respawns left
        if (gameState.respawnsLeft > 0) {
            gameState.respawnsLeft--;
            if (gameState.respawnsLeft <= 0) {
                gameOver();
            } else {
                // Respawn ball
                setTimeout(() => { 
                    if (gameState.running && gameState.balls.length === 0 && gameState.respawnsLeft > 0) {
                        gameState.balls.push(new Ball(canvas.width / 2, canvas.height - 120)); 
                        gameState.respawning = false;
                    }
                }, 1000);
            }
        }
    }
    if (gameState.running) {
        gameState.elapsedTime = Math.floor((Date.now() - gameState.startTime) / 1000);
        let m = Math.floor(gameState.elapsedTime / 60).toString().padStart(2, '0');
        let s = (gameState.elapsedTime % 60).toString().padStart(2, '0');
        timerEl.innerText = `${m}:${s}`;
    }
}
function draw() {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)'; ctx.lineWidth = 2; ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
    ctx.fillStyle = '#0ff'; ctx.shadowBlur = 20; ctx.shadowColor = '#0ff'; ctx.fillRect(gameState.paddleX, PADDLE_Y, gameState.currentPaddleWidth, PADDLE_HEIGHT);
    ctx.shadowBlur = 0;
    if (!gameState.effects.invincibleBlocks) { gameState.blocks.forEach(b => b.draw()); }
    else { gameState.blocks.forEach(b => { if (b.active) { ctx.fillStyle = '#555'; ctx.fillRect(b.x, b.y, b.width, b.height); ctx.fillStyle = '#000'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b.hp, b.x + b.width/2, b.y + b.height/2); } }); }
    gameState.items.forEach(item => item.draw());
    gameState.balls.forEach(b => b.draw());
    gameState.particles.forEach(p => p.draw());
    gameState.lasers.forEach(l => l.draw());
    
    // Draw remaining respawns in bottom right
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`BALL LOSSES LEFT: ${gameState.respawnsLeft}`, canvas.width - 20, canvas.height - 20);
    
    if (gameState.currentItem) {
        let timeLeft = Math.ceil((gameState.itemTimer - Date.now()) / 1000);
        if (timeLeft > 0) { ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center'; ctx.fillText(`Effect Time: ${timeLeft}s`, canvas.width / 2, 60); }
    }
}
function gameLoop() { if (gameState.running) { update(); draw(); requestAnimationFrame(gameLoop); } }
function updateUI() { scoreEl.innerText = gameState.score; stageEl.innerText = gameState.stage; }
function updateAttacksUI() {
    attacksContainer.innerHTML = '';
    for (let i = 0; i < gameState.attacks; i++) {
        const attackIcon = document.createElement('div'); 
        attackIcon.className = 'attack-icon'; 
        attackIcon.style = "width:10px; height:20px; background-color:#0ff; border:1px solid #fff; box-shadow:0 0 8px #0ff; display:inline-block; margin-right:5px; border-radius:2px;";
        attacksContainer.appendChild(attackIcon);
    }
}

function fireLaser() {
    if (!gameState.running || gameState.attacks <= 0) return;
    
    gameState.attacks--;
    updateAttacksUI();
    
    const beamWidth = BLOCK_SIZE * 2;
    const beamX = gameState.paddleX + (gameState.currentPaddleWidth / 2) - (beamWidth / 2);
    
    gameState.lasers.push(new LaserBeam(beamX, beamWidth));
    
    // Play sound (using existing hit sound logic with custom values)
    if (audioCtx) {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(150, audioCtx.currentTime);
        o.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.5);
        g.gain.setValueAtTime(0.4, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
        o.connect(g);
        g.connect(audioCtx.destination);
        o.start();
        o.stop(audioCtx.currentTime + 0.5);
    }
    
    // Check collisions with blocks
    gameState.blocks.forEach(block => {
        if (block.active && block.x + block.width > beamX && block.x < beamX + beamWidth) {
            if (!block.active) return;
            block.hp -= 3;
            createExplosion(block.x + block.width / 2, block.y + block.height / 2, block.color);
            if (block.hp <= 0) {
                block.active = false;
                gameState.score += 100 * gameState.stage;
                createExplosion(block.x + block.width / 2, block.y + block.height / 2, '#fff');
                checkNeighboringBlocks(block.x, block.y);
            } else {
                block.color = getNeonColor(block.hp);
            }
        }
    });
    updateUI();
}

// --- PORTAL INTEGRATION ---
function exitToDashboard() {
    if (gameState.score > 0) {
        console.log('[Brick] Saving final score before exit:', gameState.score);
        fetch('/api/submit-score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ score: gameState.score, gameType: 'brick' })
        }).then(() => {
            window.location.href = '/dashboard';
        }).catch(() => {
            window.location.href = '/dashboard';
        });
    } else {
        window.location.href = '/dashboard';
    }
}

function submitScore(score) {
    console.log('Attempting to submit score:', score);
    fetch('/api/submit-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score, gameType: 'brick' })
    }).then(res => {
        if (!res.ok) {
            console.error('Score submission failed with status:', res.status);
            return res.text().then(text => { throw new Error(text) });
        }
        return res.json();
    }).then(data => {
        if (data.success) {
            console.log('Score submitted successfully:', data);
            if (window.updateLeaderboard) window.updateLeaderboard();
            
            // UI Update: Using the server's confirmed best_score or brick_best_score
            const bestEl = document.getElementById('my-best-score');
            if (bestEl && data.updatedScores && data.updatedScores.brick_best_score !== undefined) {
                bestEl.innerText = data.updatedScores.brick_best_score;
            } else if (bestEl && score > parseInt(bestEl.innerText || '0')) {
                bestEl.innerText = score;
            }
        } else {
            console.error('Score submission failed:', data.error);
        }
    }).catch(err => {
        console.error('Error submitting score:', err);
    });
}

function gameOver() {
    gameState.running = false;
    stopBrickBGM();
    gameOverScreen.style.display = "flex";
    stageSelectionDiv.classList.add('hidden');
    gameOverContentDiv.classList.remove('hidden');
    finalScoreEl.innerText = gameState.score;
    finalStageEl.innerText = gameState.stage;
    submitScore(gameState.score);
}
function gameWin() {
    gameState.running = false;
    stopBrickBGM();
    gameOverScreen.style.display = "flex";
    stageSelectionDiv.classList.add('hidden');
    gameOverContentDiv.classList.remove('hidden');
    finalScoreEl.innerText = gameState.score;
    finalStageEl.innerText = "20 (CLEAR)";
    gameTitle.innerText = "MISSION COMPLETE!";
    submitScore(gameState.score);
}

function setupStageButtons() {
    stageGrid.innerHTML = '';
    for (let i = 1; i <= 20; i++) {
        let btn = document.createElement('div'); btn.className = 'stage-btn'; btn.innerText = i;
        if (i === 1) btn.classList.add('current');
        btn.onclick = () => { document.querySelectorAll('.stage-btn').forEach(b => b.classList.remove('current')); btn.classList.add('current'); gameState.selectedStage = i; };
        stageGrid.appendChild(btn);
    }
    gameState.selectedStage = 1;
}

// --- INPUT HANDLING ---
window.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') gameState.keys.left = true; if (e.key === 'ArrowRight') gameState.keys.right = true; });
window.addEventListener('keyup', (e) => { if (e.key === 'ArrowLeft') gameState.keys.left = false; if (e.key === 'ArrowRight') gameState.keys.right = false; });
btnLeft.addEventListener('touchstart', (e) => { e.preventDefault(); gameState.keys.left = true; });
btnLeft.addEventListener('touchend', (e) => { e.preventDefault(); gameState.keys.left = false; });
btnRight.addEventListener('touchstart', (e) => { e.preventDefault(); gameState.keys.right = true; });
btnRight.addEventListener('touchend', (e) => { e.preventDefault(); gameState.keys.right = false; });
canvas.addEventListener('click', fireLaser);
canvas.addEventListener('touchmove', (e) => {
    e.preventDefault(); let touch = e.touches[0]; let rect = canvas.getBoundingClientRect();
    let x = touch.clientX - rect.left; let scaleX = canvas.width / rect.width;
    let mouseX = (x) * scaleX; gameState.paddleX = mouseX - gameState.currentPaddleWidth / 2;
    if (gameState.paddleX < 0) gameState.paddleX = 0; if (gameState.paddleX + gameState.currentPaddleWidth > canvas.width) gameState.paddleX = canvas.width - gameState.currentPaddleWidth;
}, { passive: false });

updateAttacksUI(); setupStageButtons(); draw();
function incrementAttempts() {
    fetch('/api/increment-attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game: 'brick' })
    }).then(res => res.json())
      .then(data => {
          if (data.success) {
              const el = document.getElementById('my-attempts');
              if (el) el.innerText = parseInt(el.innerText) + 1;
          }
      });
}

function initBrickAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => {
            startBrickBGM();
        });
    } else {
        startBrickBGM();
    }
}

startBtn.onclick = () => { initBrickAudio(); gameOverScreen.style.display = "none"; gameState.score = 0; gameState.attacks = 3; gameState.respawnsLeft = 10; gameState.respawning = false; gameState.startTime = Date.now(); initStage(gameState.selectedStage); gameState.running = true; gameLoop(); incrementAttempts(); };
restartBtn.onclick = () => { initBrickAudio(); gameOverScreen.style.display = "none"; gameState.score = 0; gameState.attacks = 3; gameState.respawnsLeft = 10; gameState.respawning = false; gameState.startTime = Date.now(); initStage(gameState.stage); gameState.running = true; gameLoop(); incrementAttempts(); };
menuBtn.onclick = () => { gameOverScreen.style.display = "flex"; gameOverContentDiv.classList.add('hidden'); stageSelectionDiv.classList.remove('hidden'); gameTitle.innerText = "NEON BREAKOUT"; };
