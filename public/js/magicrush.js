const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score-display');
const stageDisplay = document.getElementById('stage-display');
const bestScoreDisplay = document.getElementById('best-score');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const tapArea = document.getElementById('tap-area');
const windIndicator = document.getElementById('wind-indicator');
const windArrow = document.getElementById('wind-arrow');
const windPowerDisplay = document.getElementById('wind-power');
const comboDisplay = document.getElementById('combo-display');
const comboValue = document.getElementById('combo-value');
const tauntMsg = document.getElementById('taunt-msg');

let gameLoop;
let isPlaying = false;
let frameCount = 0;
let score = 0;
let stage = 1;
let baseSpeed = 5;
let combo = 1;
let comboTimer = 0;

// Physics & Wind
let gravity = 0.35; // Reduced to 70% of 0.5
let windForce = 0;
let nextWindChange = 100;

// Player
const player = {
    x: 100,
    y: 0,
    width: 40,
    height: 20,
    vy: 0,
    jumpPower: -8,
    angle: 0
};

// Entities
let obstacles = [];
let particles = [];
let missiles = [];
let buildings = [];
let stars = [];

// Colors
const C_CYAN = '#0ff';
const C_PINK = '#f0f';
const C_YELLOW = '#ff0';
const C_RED = '#f00';

function resize() {
    // Restore full viewport dimensions
    const vWidth = window.innerWidth;
    const vHeight = window.innerHeight;
    
    canvas.width = vWidth;
    canvas.height = vHeight;
    
    // Ensure player stays within bounds
    if (!isPlaying) {
        player.y = canvas.height / 2;
        drawInitialBackground();
    }
}
window.addEventListener('resize', () => {
    setTimeout(resize, 250);
});
resize();

function initGame() {
    score = 0;
    stage = 1;
    baseSpeed = 5;
    combo = 1;
    comboTimer = 0;
    frameCount = 0;
    windForce = 0;
    nextWindChange = 120;
    
    player.y = canvas.height / 2;
    player.vy = 0;
    player.angle = 0;
    
    obstacles = [];
    particles = [];
    missiles = [];
    buildings = [];
    
    // Init environment
    for(let i=0; i<50; i++) {
        stars.push({ x: Math.random()*canvas.width, y: Math.random()*canvas.height, size: Math.random()*2, speed: Math.random()*0.5+0.1 });
    }
    for(let i=0; i<10; i++) {
        addBuilding(canvas.width * Math.random());
    }
    
    updateHUD();
    hideCombo();
    
    isPlaying = true;
    startScreen.style.display = 'none';
    gameOverScreen.style.display = 'none';
    
    // Submit attempt
    fetch('/api/increment-attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game: 'paper_rush' })
    }).catch(e => console.error(e));

    gameLoop = requestAnimationFrame(update);
}

function update() {
    if (!isPlaying) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    handleWind();
    updateEnvironment();
    updatePlayer();
    handleSpawns();
    updateEntities();
    checkCollisions();
    
    drawEnvironment();
    drawEntities();
    drawPlayer();
    drawParticles();
    
    // Score & Stage logic
    score += (baseSpeed / 10) * combo;
    if (score > stage * 2000) {
        stage++;
        baseSpeed += 1;
        createParticles(player.x, player.y, 30, C_YELLOW);
    }
    
    // Combo decay
    if (combo > 1) {
        comboTimer--;
        if (comboTimer <= 0) {
            combo = 1;
            hideCombo();
        }
    }
    
    updateHUD();
    
    frameCount++;
    gameLoop = requestAnimationFrame(update);
}

function handleWind() {
    if (frameCount > nextWindChange) {
        // -3 to 3 wind force
        let targetWind = (Math.random() * 6) - 3;
        // Make extreme winds more common in higher stages
        if (stage > 3 && Math.random() > 0.5) targetWind = (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 2 + 2);
        
        windForce = targetWind;
        nextWindChange = frameCount + 120 + Math.random() * 120;
        
        // Update Indicator
        windPowerDisplay.innerText = Math.abs(windForce).toFixed(1);
        if (windForce < -0.5) { // Up
            windIndicator.style.borderColor = C_CYAN;
            windIndicator.style.color = C_CYAN;
            windArrow.className = 'fas fa-arrow-up';
        } else if (windForce > 0.5) { // Down
            windIndicator.style.borderColor = C_RED;
            windIndicator.style.color = C_RED;
            windArrow.className = 'fas fa-arrow-down';
        } else { // Neutral
            windIndicator.style.borderColor = '#aaa';
            windIndicator.style.color = '#aaa';
            windArrow.className = 'fas fa-minus';
            windPowerDisplay.innerText = '0.0';
            windForce = 0;
        }
    }
}

function updatePlayer() {
    player.vy += gravity + (windForce * 0.1);
    player.y += player.vy;
    
    // Rotation based on velocity
    player.angle = Math.min(Math.max(player.vy * 0.05, -0.5), 0.5);
    
    // Limits
    if (player.y < 0) { player.y = 0; player.vy = 0; }
    if (player.y > canvas.height) { gameOver(); }
    
    // Trail
    if (frameCount % 3 === 0) {
        particles.push({
            x: player.x, y: player.y,
            vx: -baseSpeed, vy: (Math.random()-0.5)*2,
            life: 1, color: C_CYAN, size: 2
        });
    }
}

function jump() {
    if (!isPlaying) return;
    player.vy = player.jumpPower;
    createParticles(player.x, player.y + player.height/2, 5, C_CYAN);
}

function handleSpawns() {
    // Spawn rates scale with stage
    let spawnRate = Math.max(30, 90 - (stage * 5));
    
    if (frameCount % spawnRate === 0) {
        let type = Math.random();
        if (type < 0.3) spawnSpike();
        else if (type < 0.6) spawnMonster();
        else if (type < 0.8) spawnTrap();
        else spawnSunflower();
    }
}

function spawnSpike() {
    let isTop = Math.random() > 0.5;
    let h = 100 + Math.random() * (canvas.height / 3);
    obstacles.push({
        type: 'spike',
        x: canvas.width,
        y: isTop ? 0 : canvas.height - h,
        width: 40,
        height: h,
        color: C_RED,
        passed: false
    });
}

function spawnMonster() {
    obstacles.push({
        type: 'monster',
        x: canvas.width,
        y: Math.random() * (canvas.height - 100) + 50,
        width: 40,
        height: 40,
        vy: (Math.random() - 0.5) * 4,
        color: C_PINK,
        baseY: Math.random() * (canvas.height - 100) + 50,
        time: Math.random() * 100,
        passed: false
    });
}

function spawnTrap() {
    obstacles.push({
        type: 'trap',
        x: canvas.width,
        y: Math.random() * (canvas.height - 100) + 50,
        width: 30,
        height: 30,
        rot: 0,
        color: C_YELLOW,
        passed: false
    });
}

function spawnSunflower() {
    let isTop = Math.random() > 0.5;
    obstacles.push({
        type: 'sunflower',
        x: canvas.width,
        y: isTop ? 0 : canvas.height - 50,
        width: 50,
        height: 50,
        isTop: isTop,
        lastShot: frameCount,
        color: '#0f0',
        passed: false
    });
}

function fireMissile(x, y, targetX, targetY) {
    let angle = Math.atan2(targetY - y, targetX - x);
    missiles.push({
        x: x, y: y,
        vx: Math.cos(angle) * (baseSpeed * 1.5),
        vy: Math.sin(angle) * (baseSpeed * 1.5),
        width: 20, height: 10,
        angle: angle,
        color: '#f80'
    });
}

function updateEntities() {
    // Obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        let obs = obstacles[i];
        obs.x -= baseSpeed;
        
        if (obs.type === 'monster') {
            obs.time += 0.05;
            obs.y = obs.baseY + Math.sin(obs.time) * 100;
        } else if (obs.type === 'trap') {
            obs.rot += 0.1;
        } else if (obs.type === 'sunflower') {
            if (frameCount - obs.lastShot > 120 && obs.x < canvas.width - 100) {
                fireMissile(obs.x + obs.width/2, obs.y + obs.height/2, player.x, player.y);
                obs.lastShot = frameCount;
            }
        }
        
        // Near miss logic
        if (!obs.passed && obs.x + obs.width < player.x) {
            obs.passed = true;
            let dist = Math.hypot((obs.x+obs.width/2) - player.x, (obs.y+obs.height/2) - player.y);
            if (dist < 150) {
                combo++;
                comboTimer = 180;
                showCombo();
                createParticles(player.x, player.y, 10, C_YELLOW);
            }
        }
        
        if (obs.x + obs.width < 0) obstacles.splice(i, 1);
    }
    
    // Missiles
    for (let i = missiles.length - 1; i >= 0; i--) {
        let m = missiles[i];
        m.x += m.vx - (baseSpeed * 0.5); // relative to background
        m.y += m.vy;
        
        // Add trail
        particles.push({ x: m.x, y: m.y, vx: 0, vy: 0, life: 1, color: m.color, size: 2 });
        
        if (m.x < -100 || m.x > canvas.width + 100 || m.y < -100 || m.y > canvas.height + 100) {
            missiles.splice(i, 1);
        }
    }
}

function checkCollisions() {
    let px = player.x - player.width/2 + 10;
    let py = player.y - player.height/2 + 5;
    let pw = player.width - 20;
    let ph = player.height - 10;
    
    const rectIntersect = (x1,y1,w1,h1, x2,y2,w2,h2) => {
        return x2 < x1+w1 && x2+w2 > x1 && y2 < y1+h1 && y2+h2 > y1;
    };
    
    for (let obs of obstacles) {
        if (rectIntersect(px, py, pw, ph, obs.x, obs.y, obs.width, obs.height)) {
            gameOver();
            return;
        }
    }
    
    for (let m of missiles) {
        if (rectIntersect(px, py, pw, ph, m.x, m.y, m.width, m.height)) {
            gameOver();
            return;
        }
    }
}

function createParticles(x, y, count, color) {
    for(let i=0; i<count; i++) {
        particles.push({
            x: x, y: y,
            vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10,
            life: 1, color: color, size: Math.random()*3+1
        });
    }
}

function updateEnvironment() {
    for (let s of stars) {
        s.x -= s.speed * (baseSpeed/5);
        if (s.x < 0) s.x = canvas.width;
    }
    
    for (let i = buildings.length-1; i>=0; i--) {
        buildings[i].x -= baseSpeed * 0.3;
        if (buildings[i].x + buildings[i].width < 0) {
            buildings.splice(i, 1);
            addBuilding(canvas.width);
        }
    }
}

function addBuilding(x) {
    buildings.push({
        x: x,
        width: 50 + Math.random()*100,
        height: 50 + Math.random()*200,
        color: `hsl(${200 + Math.random()*50}, 50%, 10%)`
    });
}

function drawEnvironment() {
    // Stars
    ctx.fillStyle = '#fff';
    for (let s of stars) {
        ctx.globalAlpha = Math.random() * 0.5 + 0.5;
        ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    ctx.globalAlpha = 1;
    
    // Buildings
    for (let b of buildings) {
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x, canvas.height - b.height, b.width, b.height);
        ctx.strokeStyle = C_CYAN;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.2;
        ctx.strokeRect(b.x, canvas.height - b.height, b.width, b.height);
        ctx.globalAlpha = 1;
    }
    
    // Speed lines
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    for(let i=0; i<5; i++) {
        let y = (frameCount * 5 + i * (canvas.height/5)) % canvas.height;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
}

function drawEntities() {
    // Obstacles
    for (let obs of obstacles) {
        ctx.save();
        ctx.translate(obs.x + obs.width/2, obs.y + obs.height/2);
        
        ctx.shadowBlur = 15;
        ctx.shadowColor = obs.color;
        
        if (obs.type === 'spike') {
            ctx.fillStyle = obs.color;
            ctx.beginPath();
            if (obs.y === 0) {
                ctx.moveTo(-obs.width/2, -obs.height/2);
                ctx.lineTo(obs.width/2, -obs.height/2);
                ctx.lineTo(0, obs.height/2);
            } else {
                ctx.moveTo(-obs.width/2, obs.height/2);
                ctx.lineTo(obs.width/2, obs.height/2);
                ctx.lineTo(0, -obs.height/2);
            }
            ctx.fill();
        } else if (obs.type === 'monster') {
            ctx.fillStyle = obs.color;
            ctx.beginPath();
            ctx.arc(0, 0, obs.width/2, 0, Math.PI*2);
            ctx.fill();
            // Eye
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(-5, -5, 5, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#000';
            ctx.beginPath(); ctx.arc(-5, -5, 2, 0, Math.PI*2); ctx.fill();
        } else if (obs.type === 'trap') {
            ctx.rotate(obs.rot);
            ctx.strokeStyle = obs.color;
            ctx.lineWidth = 3;
            ctx.strokeRect(-obs.width/2, -obs.height/2, obs.width, obs.height);
            ctx.beginPath();
            ctx.moveTo(-obs.width/2, -obs.height/2);
            ctx.lineTo(obs.width/2, obs.height/2);
            ctx.stroke();
        } else if (obs.type === 'sunflower') {
            ctx.fillStyle = obs.color;
            ctx.fillRect(-obs.width/2, -obs.height/2, obs.width, obs.height);
            ctx.fillStyle = C_RED;
            ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI*2); ctx.fill();
        }
        
        ctx.restore();
    }
    
    // Missiles
    for (let m of missiles) {
        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.rotate(m.angle);
        ctx.fillStyle = m.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = m.color;
        ctx.fillRect(-m.width/2, -m.height/2, m.width, m.height);
        ctx.restore();
    }
}

function drawPlayer() {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);
    
    ctx.shadowBlur = 20;
    ctx.shadowColor = C_CYAN;
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = C_CYAN;
    ctx.lineWidth = 2;
    
    // Draw paper airplane shape
    ctx.beginPath();
    ctx.moveTo(player.width/2, 0); // Nose
    ctx.lineTo(-player.width/2, player.height/2); // Bottom wing
    ctx.lineTo(-player.width/4, 0); // Inner fold
    ctx.lineTo(-player.width/2, -player.height/2); // Top wing
    ctx.closePath();
    
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}

function drawParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.05;
        
        if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
        }
        
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
}

function drawInitialBackground() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Add grid
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1;
    for(let i=0; i<canvas.width; i+=50) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,canvas.height); ctx.stroke(); }
    for(let i=0; i<canvas.height; i+=50) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(canvas.width,i); ctx.stroke(); }
}

function updateHUD() {
    scoreDisplay.innerText = Math.floor(score);
    stageDisplay.innerText = stage;
}

function showCombo() {
    comboValue.innerText = combo;
    comboDisplay.style.display = 'block';
    comboDisplay.style.transform = 'scale(1.5)';
    setTimeout(() => { comboDisplay.style.transform = 'scale(1)'; }, 100);
}

function hideCombo() {
    comboDisplay.style.display = 'none';
}

function gameOver() {
    isPlaying = false;
    cancelAnimationFrame(gameLoop);
    
    createParticles(player.x, player.y, 50, C_RED);
    drawParticles(); // Draw explosion once
    
    document.getElementById('final-stage').innerText = stage;
    document.getElementById('final-score').innerText = Math.floor(score);
    
    let taunts = [
        "종이비행기 조종이 처음이신가요?",
        "바람을 탓하지 마세요.",
        "조금 더 집중해볼까요?",
        "손가락이 미끄러졌나요?",
        "사이버펑크의 벽은 높습니다.",
        "다시 하면 더 잘할 수 있어요... 아마도?"
    ];
    if (stage > 5) taunts = ["제법이네요, 하지만 여기까지입니다.", "인간의 한계인가요?", "아깝네요! 다시 도전하세요!"];
    tauntMsg.innerText = taunts[Math.floor(Math.random() * taunts.length)];
    
    gameOverScreen.style.display = 'flex';
    
    submitScore(Math.floor(score));
    fetchLeaderboard('end');
}

function submitScore(finalScore) {
    if (finalScore > GAME_USER.bestScore) {
        bestScoreDisplay.innerText = finalScore;
        GAME_USER.bestScore = finalScore;
    }
    
    fetch('/api/submit-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: finalScore, gameType: 'paper_rush' })
    }).catch(e => console.error('Submit score error:', e));
}

function fetchLeaderboard(context) {
    const targetId = context === 'start' ? 'start-rank-info' : 'end-rank-info';
    const target = document.getElementById(targetId);
    
    fetch('/api/leaderboard?gameType=paper_rush')
        .then(res => res.json())
        .then(data => {
            let html = `<div style="color:${C_YELLOW}; font-weight:bold; margin-bottom:10px;">GLOBAL TOP</div>`;
            html += `<div class="rivals-list">`;
            
            // Show top 3 + rivals
            data.top10.slice(0, 3).forEach((u, i) => {
                html += `<div class="rival-item">#${i+1} ${u.username}: ${u.best_score}</div>`;
            });
            
            if (data.rivals && data.rivals.length > 0) {
                html += `<div style="margin:10px 0; color:#888;">--- RIVALS ---</div>`;
                data.rivals.forEach(r => {
                    html += `<div class="rival-item ${r.id === GAME_USER.id ? 'current' : ''}">#${r.rank} ${r.username}: ${r.best_score}</div>`;
                });
            }
            
            html += `</div>`;
            target.innerHTML = html;
        })
        .catch(err => {
            target.innerHTML = 'Failed to load leaderboard.';
        });
}

// Input Handlers
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        if (!isPlaying && gameOverScreen.style.display === 'none' && startScreen.style.display === 'none') {
            // Do nothing if overlays are up
        } else {
            jump();
        }
    }
});

tapArea.addEventListener('touchstart', (e) => {
    e.preventDefault();
    jump();
}, {passive: false});

tapArea.addEventListener('mousedown', (e) => {
    if (e.button === 0) jump();
});

document.getElementById('start-btn').addEventListener('click', initGame);
document.getElementById('restart-btn').addEventListener('click', initGame);

// Initial setup
drawInitialBackground();
fetchLeaderboard('start');
