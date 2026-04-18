/**
 * Tactical Airplane Shooter 1987
 * Enhanced Core Game Logic - V2 (Fixed Initialization & Multi-touch)
 */

let canvas, ctx;
let scoreEl, stageEl, livesEl, hpFillEl, weaponEl, shieldEl, magicEl, startScreen, gameOverScreen;

const victoryMessages = [
    "적들은 당신의 위대함을 알았습니다!",
    "하늘 위의 영웅, 이제 휴식을 취해도 좋습니다!",
    "전투는 끝났지만 영예는 영원합니다!",
    "적군을 격파했습니다 - 우리의 승리입니다!",
    "전투영웅이라는 칭호가 어울립니다!",
    "적기들을 모조리 격추했습니다!",
    "승리의 영광이 당신에게 돌아왔습니다!"
];

const defeatMessages = [
    "아쉬움이 남습니다... 다시 한 번 도전해보세요!",
    "적군이 강했습니다. 분발하겠습니다!",
    "패배는 성공의 어머니다 - 다시 일어나세요!",
    "아직 전사의 길이 멀군요...",
    "적들에게 보여준 용기에 감사를드립니다!",
    "다음엔 반드시 승리하겠습니다!",
    "오늘의 패배는 내일의 승리입니다!"
];

// Game State
let gameActive = false;
let score = 0;
let stage = 1;
let lives = 3;
let hp = 100;
let weaponLevel = 1; 
let shieldLayers = 0;
let magicCount = 0;
let frameCount = 0;
let startTime = 0;

// Entities
let player;
let enemies = [];
let enemyBullets = [];
let items = [];
let explosions = [];
let backgroundStars = [];

const Colors = {
    player: '#3498db',
    enemy: '#e74c3c',
    bullet: '#f1c40f',
    enemyBullet: '#ff00ff',
    item: '#2ecc71',
    bg1: '#0a0f1a', // Deeper Blue
    bg2: '#1a1a2e', // Darker Fleet
    bg3: '#16213e', // Midnight Mainland
    bg4: '#0f3460'  // Darkest Island
};

// Touch Input State
const touchState = {
    joystick: { active: false, x: 0, y: 0, startX: 0, startY: 0, identifier: null },
    shooting: false
};

// Initialize DOM Elements
function initDOMElements() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    scoreEl = document.getElementById('score');
    stageEl = document.getElementById('stage');
    livesEl = document.getElementById('lives');
    hpFillEl = document.getElementById('hp-fill');
    weaponEl = document.getElementById('weapon-type');
    shieldEl = document.getElementById('shield-status');
    magicEl = document.getElementById('magic-indicator');
    startScreen = document.getElementById('start-screen');
    gameOverScreen = document.getElementById('game-over-screen');
    
    setTimeout(resize, 100);
}

function resize() {
    if (!canvas) return;
    const gameArea = document.getElementById('game-area');
    if (gameArea) {
        canvas.width = gameArea.clientWidth;
        canvas.height = gameArea.clientHeight;
    } else {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight * 0.6;
    }
}

window.addEventListener('resize', resize);

// Input Handling
const keys = {};
window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);

// Prevent pinch-to-zoom on iOS
document.addEventListener('gesturestart', function (e) {
    e.preventDefault();
});

function initTouchControls() {
    const joyZone = document.getElementById('joystick-zone');
    const joyStick = document.getElementById('joystick-stick');
    const btnShoot = document.getElementById('btn-shoot-touch');
    const btnMagic = document.getElementById('btn-magic-touch');

    if (!joyZone) return;

    const handleTouch = (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            
            // Joystick logic (Left half of screen)
            if (touch.clientX < window.innerWidth / 2) {
                if (e.type === 'touchstart') {
                    touchState.joystick.active = true;
                    touchState.joystick.startX = touch.clientX;
                    touchState.joystick.startY = touch.clientY;
                    touchState.joystick.identifier = touch.identifier;
                } else if (e.type === 'touchmove' && touchState.joystick.active && touch.identifier === touchState.joystick.identifier) {
                    let dx = touch.clientX - touchState.joystick.startX;
                    let dy = touch.clientY - touchState.joystick.startY;
                    const maxDist = 60;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist > maxDist) {
                        dx = (dx / dist) * maxDist;
                        dy = (dy / dist) * maxDist;
                    }
                    touchState.joystick.x = dx / maxDist;
                    touchState.joystick.y = dy / maxDist;
                    joyStick.style.transform = `translate(${dx}px, ${dy}px)`;
                } else if ((e.type === 'touchend' || e.type === 'touchcancel') && touch.identifier === touchState.joystick.identifier) {
                    touchState.joystick.active = false;
                    touchState.joystick.x = 0;
                    touchState.joystick.y = 0;
                    joyStick.style.transform = `translate(0, 0)`;
                }
            }
        }
    };

    joyZone.addEventListener('touchstart', handleTouch, { passive: false });
    window.addEventListener('touchmove', handleTouch, { passive: false });
    window.addEventListener('touchend', handleTouch);
    window.addEventListener('touchcancel', handleTouch);

    btnShoot.addEventListener('touchstart', (e) => {
        touchState.shooting = true;
        e.preventDefault();
    }, { passive: false });
    btnShoot.addEventListener('touchend', (e) => {
        touchState.shooting = false;
        e.preventDefault();
    }, { passive: false });

    btnMagic.addEventListener('touchstart', (e) => {
        if (player && magicCount > 0) player.useMagic();
        e.preventDefault();
    }, { passive: false });
}

class Player {
    constructor() {
        this.width = 40;
        this.height = 30;
        this.x = canvas.width / 2 - this.width / 2;
        this.y = canvas.height * 0.8;
        this.speed = 7;
        this.bullets = [];
        this.lastShot = 0;
        this.shotDelay = 180;
    }

    update() {
        if (keys['ArrowUp'] || keys['KeyW']) this.y -= this.speed;
        if (keys['ArrowDown'] || keys['KeyS']) this.y += this.speed;
        if (keys['ArrowLeft'] || keys['KeyA']) this.x -= this.speed;
        if (keys['ArrowRight'] || keys['KeyD']) this.x += this.speed;

        if (touchState.joystick.active) {
            this.x += touchState.joystick.x * this.speed;
            this.y += touchState.joystick.y * this.speed;
        }

        this.x = Math.max(0, Math.min(canvas.width - this.width, this.x));
        
        // 1-minute crash prevention at the bottom
        const oneMinute = 60000;
        const isProtected = (Date.now() - startTime < oneMinute);
        if (isProtected) {
            this.y = Math.max(0, Math.min(canvas.height - this.height - 20, this.y));
        } else {
            this.y = Math.max(0, Math.min(canvas.height - this.height, this.y));
            if (this.y >= canvas.height - this.height) {
                takeDamage(5); // Small damage for touching bottom after 1 min
            }
        }

        const now = Date.now();
        if ((keys['Space'] || keys['Enter'] || touchState.shooting) && now - this.lastShot > this.shotDelay) {
            this.shoot();
            this.lastShot = now;
        }

        if ((keys['KeyX'] || keys['KeyM']) && magicCount > 0) this.useMagic();

        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            b.y -= b.speed;
            if (b.vx) b.x += b.vx;
            if (b.y < -20 || b.x < -20 || b.x > canvas.width + 20) this.bullets.splice(i, 1);
        }
    }

    shoot() {
        playSFX('shoot');
        const bSpeed = 14;
        const bWidth = 8; // Doubled from 4
        if (weaponLevel === 1) {
            this.bullets.push({ x: this.x + 16, y: this.y, speed: bSpeed, width: bWidth, height: 16 });
        } else if (weaponLevel === 2) {
            this.bullets.push({ x: this.x + 2, y: this.y, speed: bSpeed, width: bWidth, height: 16 });
            this.bullets.push({ x: this.x + 30, y: this.y, speed: bSpeed, width: bWidth, height: 16 });
        } else {
            this.bullets.push({ x: this.x + 16, y: this.y, speed: bSpeed, width: bWidth, height: 16, vx: 0 });
            this.bullets.push({ x: this.x + 2, y: this.y, speed: bSpeed, width: bWidth, height: 16, vx: -2 });
            this.bullets.push({ x: this.x + 30, y: this.y, speed: bSpeed, width: bWidth, height: 16, vx: 2 });
        }
    }

    useMagic() {
        if (magicCount <= 0) return;
        magicCount--;
        if (magicCount <= 0) {
            magicEl.style.display = 'none';
        }
        updateMagicButton();
        playSFX('magic');
        showSkullEffect();
        enemies.forEach(e => {
            e.hp = 0;
            createExplosion(e.x + e.width/2, e.y + e.height/2);
            score += 100 * 20;
        });
        enemyBullets = [];
        updateHUD();
    }

    draw() {
        // Player HP Bar above plane
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(this.x, this.y - 15, 40, 6);
        ctx.fillStyle = hp < 30 ? '#ff0000' : '#00ff00';
        ctx.fillRect(this.x, this.y - 15, 40 * (hp / 100), 6);

        // Player Plane (Retro detail)
        ctx.fillStyle = Colors.player;
        ctx.fillRect(this.x + 16, this.y, 8, 30); // Body
        ctx.fillRect(this.x, this.y + 12, 40, 6);  // Main Wings
        ctx.fillStyle = '#2980b9';
        ctx.fillRect(this.x + 8, this.y + 25, 24, 4); // Tail Wings
        ctx.fillStyle = '#fff';
        ctx.fillRect(this.x + 18, this.y + 6, 4, 6); // Cockpit

        if (shieldLayers > 0) {
            for (let i = 0; i < shieldLayers; i++) {
                ctx.strokeStyle = `hsla(${(180 + i * 30) % 360}, 100%, 50%, 0.8)`;
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.arc(this.x + 20, this.y + 15, 32 + i * 5 + Math.sin(frameCount * 0.1) * 2, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
                
                ctx.globalAlpha = 0.05;
                ctx.fillStyle = '#0ff';
                ctx.fill();
                ctx.globalAlpha = 1.0;
            }
        }

        // Bullets (Thick Neon Cyan with Bright Core)
        this.bullets.forEach(b => {
            ctx.save();
            
            // Strong Neon Cyan Glow
            ctx.shadowBlur = 25;
            ctx.shadowColor = '#00ffff';
            
            // Main Bullet Body (Cyan)
            ctx.fillStyle = '#00ffff';
            ctx.beginPath();
            ctx.roundRect(b.x, b.y, b.width, b.height, 4);
            ctx.fill();
            
            // Bright Inner Core (White)
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.roundRect(b.x + 2, b.y + 2, b.width - 4, b.height - 4, 2);
            ctx.fill();
            
            // Electric Sparkle
            if (frameCount % 3 === 0) {
                ctx.fillStyle = '#fff';
                ctx.fillRect(b.x + Math.random() * b.width, b.y + b.height, 2, 2);
            }
            
            ctx.restore();
        });
    }
}

// Exit and save score
function exitToDashboard() {
    if (score > 0) {
        console.log('[Airplane] Saving final score before exit:', score);
        fetch('/api/submit-score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ score: score, gameType: 'airplane-shooter' })
        }).then(() => {
            window.location.href = '/dashboard';
        }).catch(() => {
            window.location.href = '/dashboard';
        });
    } else {
        window.location.href = '/dashboard';
    }
}

class Enemy {
    constructor(type, stage) {
        this.type = type;
        this.width = 44;
        this.height = 44;
        this.x = Math.random() * (canvas.width - this.width);
        this.y = -60;
        this.maxHp = 1 + Math.floor(stage / 3);
        this.hp = this.maxHp;
        // Increased base speed and scaling (original 2.2 -> 2.5, 0.16 -> 0.2)
        this.speed = (2.5 + (stage * 0.2)) * 1.3;
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = this.speed;
        this.colorHue = Math.random() * 360; // For colorful effects
        
        if (type === 'charger') this.speed *= 1.8;
        if (type === 'suction') { this.hp *= 3.5; this.maxHp *= 3.5; this.speed *= 0.55; }
        if (type === 'exploder') { this.hp *= 1.8; this.maxHp *= 1.8; this.speed *= 0.75; }
    }

    update(player) {
        if (this.type === 'charger') {
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            this.vx = (dx / dist) * this.speed;
            this.vy = (dy / dist) * this.speed;
        } else if (this.type === 'suction') {
            const dx = this.x + this.width/2 - (player.x + player.width/2);
            const dy = this.y + this.height/2 - (player.y + player.height/2);
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < 320) {
                const pull = (1 - dist / 320) * 4.5;
                player.x += (dx / dist) * pull;
                player.y += (dy / dist) * pull;
            }
        }

        this.x += this.vx;
        this.y += this.vy;

        if (this.type === 'missile' && frameCount % 60 === 0 && Math.random() < 0.35) {
            enemyBullets.push({ x: this.x + 20, y: this.y + 40, vx: 0, vy: 6.5, width: 4, height: 12 });
        }

        player.bullets.forEach((b, i) => {
            if (b.x < this.x + this.width && b.x + b.width > this.x &&
                b.y < this.y + this.height && b.y + b.height > this.y) {
                this.hp--;
                player.bullets.splice(i, 1);
                if (this.hp <= 0) this.die();
            }
        });

        if (this.x < player.x + player.width && this.x + this.width > player.x &&
            this.y < player.y + player.height && this.y + this.height > player.y) {
            takeDamage(20);
            this.hp = 0;
            this.die();
        }
    }

    die() {
        createExplosion(this.x + this.width/2, this.y + this.height/2);
        if (this.type === 'exploder') {
            for(let i=0; i<12; i++) {
                const angle = (i / 12) * Math.PI * 2;
                enemyBullets.push({
                    x: this.x + this.width/2, y: this.y + this.height/2,
                    vx: Math.cos(angle) * 5, vy: Math.sin(angle) * 5,
                    width: 6, height: 6
                });
            }
        }
        score += 50 * stage * 20;
        if (Math.random() < 0.18) spawnItem(this.x, this.y);
        updateHUD();
    }

    draw() {
        // Enemy HP Bar
        if (this.hp < this.maxHp) {
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(this.x, this.y - 12, this.width, 5);
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(this.x, this.y - 12, this.width * (this.hp / this.maxHp), 5);
        }

        ctx.save();
        ctx.translate(this.x + this.width/2, this.y + this.height/2);
        
        if (this.type === 'missile') {
            // Missile Flame
            const flameHeight = 15 + Math.sin(frameCount * 0.5) * 5;
            let flameGrad = ctx.createLinearGradient(0, 20, 0, 20 + flameHeight);
            flameGrad.addColorStop(0, '#ffcc00');
            flameGrad.addColorStop(0.5, '#ff6600');
            flameGrad.addColorStop(1, 'rgba(255, 0, 0, 0)');
            ctx.fillStyle = flameGrad;
            ctx.beginPath();
            ctx.moveTo(-6, 20); ctx.lineTo(6, 20); ctx.lineTo(0, 20 + flameHeight); ctx.closePath(); ctx.fill();

            // Missile Body
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#f00';
            ctx.fillStyle = '#444';
            ctx.fillRect(-6, -22, 12, 44);
            
            // Neon Stripes
            ctx.fillStyle = `hsl(${frameCount % 360}, 100%, 50%)`;
            ctx.fillRect(-6, -10, 12, 2);
            ctx.fillRect(-6, 5, 12, 2);

            ctx.fillStyle = '#96281b';
            ctx.beginPath();
            ctx.moveTo(-22, 0); ctx.lineTo(22, 0); ctx.lineTo(10, 15); ctx.lineTo(-10, 15); ctx.closePath(); ctx.fill();
            
            // Cockpit/Tip
            ctx.fillStyle = '#f39c12';
            ctx.fillRect(-4, -24, 8, 4);
        } else if (this.type === 'charger') {
            // Thruster Glow
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#ff3300';
            ctx.fillStyle = '#ff3300';
            ctx.beginPath();
            ctx.arc(0, -10, 15 + Math.sin(frameCount * 0.8) * 5, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#d35400';
            ctx.beginPath();
            ctx.moveTo(0, 24); ctx.lineTo(22, -15); ctx.lineTo(0, -25); ctx.lineTo(-22, -15); ctx.closePath(); ctx.fill();
            
            // Decorative Lights
            ctx.fillStyle = frameCount % 10 < 5 ? '#00ffff' : '#ffffff';
            ctx.fillRect(-12, -5, 4, 4); ctx.fillRect(8, -5, 4, 4);
            
            ctx.fillStyle = '#ff0000'; 
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#f00';
            ctx.fillRect(-9, -4, 2, 2); ctx.fillRect(7, -4, 2, 2);
        } else if (this.type === 'suction') {
            let s = 1 + Math.sin(frameCount * 0.15) * 0.12;
            ctx.scale(s, s);
            ctx.rotate(frameCount * 0.05);
            
            // Outer Swirl
            for(let i=0; i<3; i++) {
                ctx.rotate(Math.PI * 2 / 3);
                let swirl = ctx.createRadialGradient(15, 0, 0, 15, 0, 15);
                swirl.addColorStop(0, `hsla(${(frameCount*2 + i*120)%360}, 100%, 50%, 0.8)`);
                swirl.addColorStop(1, 'transparent');
                ctx.fillStyle = swirl;
                ctx.beginPath(); ctx.arc(15, 0, 15, 0, Math.PI*2); ctx.fill();
            }

            let g = ctx.createRadialGradient(0,0,0,0,0,22);
            g.addColorStop(0, '#000'); g.addColorStop(0.4, '#4b0082'); g.addColorStop(0.8, '#9400d3'); g.addColorStop(1, '#0ff');
            ctx.fillStyle = g;
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#9400d3';
            ctx.beginPath(); ctx.arc(0,0,22,0,Math.PI*2); ctx.fill();
            
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.setLineDash([3,3]); ctx.stroke(); ctx.setLineDash([]);
        } else if (this.type === 'exploder') {
            ctx.rotate(frameCount * 0.02);
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#ff00ff';
            
            // Complex polygon
            ctx.fillStyle = '#2c3e50';
            ctx.beginPath();
            for(let i=0; i<12; i++) {
                let r = i % 2 === 0 ? 25 : 15;
                let a = (i/12)*Math.PI*2; 
                ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
            }
            ctx.closePath(); ctx.fill();
            
            // Pulsing core
            let coreSize = 10 + Math.sin(frameCount * 0.2) * 4;
            let coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, coreSize);
            coreGrad.addColorStop(0, '#fff');
            coreGrad.addColorStop(0.5, '#f0f');
            coreGrad.addColorStop(1, '#800080');
            ctx.fillStyle = coreGrad;
            ctx.beginPath(); ctx.arc(0,0,coreSize,0,Math.PI*2); ctx.fill();
            
            // Rotating lights
            for(let i=0; i<4; i++) {
                ctx.rotate(Math.PI / 2);
                ctx.fillStyle = frameCount % 20 < 10 ? '#ff0000' : '#ffff00';
                ctx.beginPath(); ctx.arc(18, 0, 3, 0, Math.PI*2); ctx.fill();
            }
        }
        ctx.restore();
    }
}

class Item {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.width = 24; this.height = 24;
        this.vy = 2;
        const types = ['L', 'H', 'W', 'S', 'M'];
        this.type = types[Math.floor(Math.random() * types.length)];
    }

    update(player) {
        this.y += this.vy;
        if (this.x < player.x + player.width && this.x + this.width > player.x &&
            this.y < player.y + player.height && this.y + this.height > player.y) {
            this.collect();
            return true;
        }
        return this.y > canvas.height;
    }

    collect() {
        playSFX('item');
        if (this.type === 'L') lives++;
        else if (this.type === 'H') hp = Math.min(100, hp + 40);
        else if (this.type === 'W') { weaponLevel++; weaponEl.innerText = weaponLevel >= 3 ? 'SPREAD' : 'DOUBLE'; }
        else if (this.type === 'S') { shieldLayers++; shieldEl.innerText = 'x' + shieldLayers; }
        else if (this.type === 'M') { magicCount++; magicEl.style.display = 'block'; magicEl.innerText = 'x' + magicCount; updateMagicButton(); }
        updateHUD();
    }

    draw() {
        ctx.fillStyle = Colors.item;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.fillStyle = '#000';
        ctx.font = 'bold 16px Arial';
        ctx.fillText(this.type, this.x + 6, this.y + 18);
    }
}

function initBackground() {
    backgroundStars = [];
    for (let i = 0; i < 80; i++) {
        backgroundStars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2 + 1,
            speed: Math.random() * 4 + 2
        });
    }
}

function updateBackground() {
    if (!ctx) return;
    const stageGroup = Math.ceil(stage / 5); 
    const bgs = [Colors.bg1, Colors.bg2, Colors.bg3, Colors.bg4];
    ctx.fillStyle = bgs[Math.min(3, stageGroup - 1)];
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.globalAlpha = 0.25;
    ctx.fillStyle = stageGroup === 1 ? '#2980b9' : (stageGroup === 2 ? '#34495e' : (stageGroup === 3 ? '#1c2833' : '#4a235a'));
    for(let i=0; i< stageGroup * 4; i++) {
        let y = (frameCount * (0.4 + i*0.1) + i * 180) % (canvas.height + 200) - 100;
        let x = (i * 200) % canvas.width;
        ctx.beginPath(); ctx.arc(x, y, 70 + i*12, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    ctx.fillStyle = '#fff';
    backgroundStars.forEach(s => {
        s.y += s.speed;
        if (s.y > canvas.height) s.y = -10;
        ctx.fillRect(s.x, s.y, s.size, s.size);
    });

    if (stageGroup >= 3 && frameCount % 400 < 8) {
        ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

function takeDamage(amount) {
    if (shieldLayers > 0) {
        shieldLayers--;
        shieldEl.innerText = shieldLayers > 0 ? 'x' + shieldLayers : 'OFF';
        playSFX('shield_break');
        return;
    }
    hp -= amount;
    playSFX('damage');
    if (hp <= 0) {
        lives--;
        hp = 100;
        if (lives <= 0) endGame();
    }
    updateHUD();
}

function updateHUD() {
    if (scoreEl) scoreEl.innerText = score.toString().padStart(6, '0');
    if (stageEl) stageEl.innerText = `${stage}/100`;
    if (livesEl) livesEl.innerText = lives;
    if (shieldEl) shieldEl.innerText = shieldLayers > 0 ? 'x' + shieldLayers : 'OFF';
    if (magicEl) magicEl.innerText = magicCount > 0 ? 'x' + magicCount : '';
    if (hpFillEl) {
        hpFillEl.style.width = `${hp}%`;
        hpFillEl.style.backgroundColor = hp < 30 ? '#ff0000' : (hp < 60 ? '#ffff00' : '#00ff00');
    }
}

function updateMagicButton() {
    const btnMagic = document.getElementById('btn-magic-touch');
    const indicator = document.getElementById('magic-indicator');
    if (magicCount > 0) {
        if (btnMagic) btnMagic.classList.add('active');
        if (indicator) {
            indicator.style.display = 'block';
            indicator.innerText = 'MAGIC: x' + magicCount;
        }
    } else {
        if (btnMagic) btnMagic.classList.remove('active');
        if (indicator) indicator.style.display = 'none';
    }
}

function createExplosion(x, y) {
    playSFX('explode');
    for (let i = 0; i < 20; i++) {
        explosions.push({
            x, y, vx: (Math.random() - 0.5) * 14, vy: (Math.random() - 0.5) * 14,
            life: 30, color: Math.random() > 0.5 ? '#ff4500' : '#ffff00'
        });
    }
}

let skullEffect = { active: false, timer: 0, maxTimer: 45 };
function showSkullEffect() {
    skullEffect.active = true;
    skullEffect.timer = 0;
}

function drawSkullEffect() {
    if (!skullEffect.active) return;
    skullEffect.timer++;
    
    const progress = skullEffect.timer / skullEffect.maxTimer;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    ctx.save();
    
    if (progress < 0.3) {
        const flash = progress / 0.3;
        ctx.fillStyle = `rgba(255, 255, 255, ${flash})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    const scale = progress < 0.5 ? progress * 2 : 2 - (progress - 0.5) * 2;
    const alpha = progress < 0.7 ? 1 : 1 - (progress - 0.7) / 0.3;
    
    ctx.globalAlpha = alpha;
    ctx.translate(centerX, centerY);
    ctx.scale(scale, scale);
    
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 30;
    
    ctx.beginPath();
    ctx.arc(0, -20, 50, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.beginPath();
    ctx.ellipse(0, 40, 40, 50, 0, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#000';
    
    ctx.beginPath();
    ctx.ellipse(-18, -25, 12, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(18, -25, 12, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(-15, 10);
    ctx.lineTo(-5, 25);
    ctx.lineTo(0, 15);
    ctx.lineTo(5, 25);
    ctx.lineTo(15, 10);
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
    
    if (skullEffect.timer >= skullEffect.maxTimer) {
        skullEffect.active = false;
    }
}

function spawnItem(x, y) { items.push(new Item(x, y)); }

function spawnEnemy() {
    const types = ['missile', 'missile', 'charger'];
    if (stage >= 3) types.push('exploder');
    if (stage > 7) types.push('suction');
    const type = types[Math.floor(Math.random() * types.length)];
    enemies.push(new Enemy(type, stage));
}

function endGame() {
    gameActive = false;
    if (bgmInterval) clearInterval(bgmInterval);
    if (gameOverScreen) gameOverScreen.style.display = 'flex';
    const fs = document.getElementById('final-score');
    if (fs) fs.innerText = score;
    
    fetch('/api/submit-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: score, gameType: 'airplane-shooter' })
    });
    
    const resultTitle = document.getElementById('result-title');
    const resultMsg = document.getElementById('result-msg');
    
    if (score >= stage * 5000 || score >= 10000) {
        if (resultTitle) resultTitle.innerText = 'MISSION COMPLETE!';
        if (resultMsg) resultMsg.innerText = victoryMessages[Math.floor(Math.random() * victoryMessages.length)];
        playSFX('stage_up');
    } else {
        if (resultTitle) resultTitle.innerText = 'MISSION FAILED';
        if (resultMsg) resultMsg.innerText = defeatMessages[Math.floor(Math.random() * defeatMessages.length)];
    }
    
    loadAirplaneRank('end-rank-info');
}

let currentRankData = null;
function loadAirplaneRank(elementId) {
    const container = document.getElementById(elementId);
    if (!container) return;
    
    fetch('/api/airplane-leaderboard')
        .then(res => res.json())
        .then(data => {
            currentRankData = data;
            let html = '';
            
            // Best Score Ranking
            html += '<div class="rank-section">';
            html += '<div class="rank-title">🏆 최고점수 순위 🏆</div>';
            if (data.bestScore && data.bestScore.firstPlace) {
                html += `<div class="top-score">1위: ${data.bestScore.firstPlace.username} - ${data.bestScore.firstPlace.best_score.toLocaleString()}점</div>`;
            }
            if (data.bestScore && data.bestScore.userRank) {
                html += `<div class="my-rank">내 순위: ${data.bestScore.userRank}위 (${data.bestScore.userBestScore.toLocaleString()}점)</div>`;
            } else {
                html += '<div class="my-rank">순위권 진입 가능!</div>';
            }
            if (data.bestScore && data.bestScore.rivals && data.bestScore.rivals.length > 0) {
                html += '<div class="rivals-list">';
                data.bestScore.rivals.forEach(rival => {
                    html += `<div class="rival-item ${rival.isCurrent ? 'current' : ''}">${rival.rank}위 - ${rival.username}: ${(rival.best_score || 0).toLocaleString()}점</div>`;
                });
                html += '</div>';
            }
            html += '</div>';
            
            // Current Game Score Ranking
            html += '<div class="rank-section" style="margin-top: 15px;">';
            html += '<div class="rank-title" style="color: #0ff;">🎯 이번 게임 순위 🎯</div>';
            if (data.currentScore && data.currentScore.firstPlace) {
                html += `<div class="top-score" style="color: #0ff;">1위: ${data.currentScore.firstPlace.username} - ${data.currentScore.firstPlace.score.toLocaleString()}점</div>`;
            }
            if (data.currentScore && data.currentScore.userRank) {
                html += `<div class="my-rank" style="color: #0ff;">내 순위: ${data.currentScore.userRank}위 (${data.currentScore.userBestScore.toLocaleString()}점)</div>`;
            } else {
                html += '<div class="my-rank" style="color: #0ff;">순위권 진입 가능!</div>';
            }
            if (data.currentScore && data.currentScore.rivals && data.currentScore.rivals.length > 0) {
                html += '<div class="rivals-list">';
                data.currentScore.rivals.forEach(rival => {
                    html += `<div class="rival-item ${rival.isCurrent ? 'current' : ''}">${rival.rank}위 - ${rival.username}: ${(rival.score || 0).toLocaleString()}점</div>`;
                });
                html += '</div>';
            }
            html += '</div>';
            
            container.innerHTML = html;
        })
        .catch(() => {
            container.innerHTML = '<div style="color: #888;">순위 정보를 불러올 수 없습니다</div>';
        });
}

function loop() {
    if (!gameActive) return;
    frameCount++;

    updateBackground();
    player.update();
    player.draw();

    if (frameCount % Math.max(8, 40 - stage * 2) === 0) spawnEnemy();

    // Adjusted for 20x score
    if (score > stage * 5000 * 20 && stage < 100) {
        stage++;
        playSFX('stage_up');
        updateHUD();
    }

    // Protection bar drawing
    const oneMinute = 60000;
    const isProtected = (Date.now() - startTime < oneMinute);
    if (isProtected) {
        const timeLeft = 1 - (Date.now() - startTime) / oneMinute;
        ctx.fillStyle = `rgba(0, 255, 255, ${0.2 * timeLeft})`;
        ctx.fillRect(0, canvas.height - 10, canvas.width, 10);
        ctx.strokeStyle = '#0ff';
        ctx.lineWidth = 1;
        ctx.setLineDash([10, 5]);
        ctx.beginPath();
        ctx.moveTo(0, canvas.height - 15);
        ctx.lineTo(canvas.width, canvas.height - 15);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        e.update(player);
        e.draw();
        if (e.y > canvas.height + 60 || e.hp <= 0) enemies.splice(i, 1);
    }

    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const b = enemyBullets[i];
        b.x += b.vx || 0;
        b.y += b.vy;
        
        ctx.save();
        // Powerful Red Glow
        ctx.shadowBlur = 25;
        ctx.shadowColor = '#ff0000';
        
        // Pulsating gradient
        let flicker = Math.sin(frameCount * 0.2) * 5;
        let grad = ctx.createRadialGradient(b.x + b.width/2, b.y + b.height/2, 1, b.x + b.width/2, b.y + b.height/2, b.width);
        grad.addColorStop(0, '#fff');
        grad.addColorStop(0.4, '#f00');
        grad.addColorStop(1, 'rgba(255, 0, 0, 0)');
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(b.x + b.width/2, b.y + b.height/2, b.width/2 + 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Outer ring
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        ctx.restore();
        
        if (b.x < player.x + player.width && b.x + b.width > player.x &&
            b.y < player.y + player.height && b.y + b.height > player.y) {
            takeDamage(10);
            enemyBullets.splice(i, 1);
        } else if (b.y > canvas.height + 20 || b.y < -20 || b.x < -20 || b.x > canvas.width + 20) {
            enemyBullets.splice(i, 1);
        }
    }

    for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        if (item.update(player)) items.splice(i, 1);
        else item.draw();
    }

    for (let i = explosions.length - 1; i >= 0; i--) {
        const ex = explosions[i];
        ex.x += ex.vx; ex.y += ex.vy;
        ex.life--;
        ctx.save();
        ctx.fillStyle = ex.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = ex.color;
        ctx.fillRect(ex.x, ex.y, 5, 5);
        ctx.restore();
        if (ex.life <= 0) explosions.splice(i, 1);
    }

    drawSkullEffect();

    requestAnimationFrame(loop);
}

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let bgmInterval = null;
function playSFX(type) {
    if (audioCtx.state === 'suspended') return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;

    if (type === 'shoot') {
        osc.type = 'square'; osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.1);
        gain.gain.setValueAtTime(0.05, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.start(); osc.stop(now + 0.1);
    } else if (type === 'explode') {
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(10, now + 0.3);
        gain.gain.setValueAtTime(0.2, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(); osc.stop(now + 0.3);
    } else if (type === 'item') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1760, now + 0.1);
        gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.start(); osc.stop(now + 0.1);
    } else if (type === 'damage') {
        osc.type = 'triangle'; osc.frequency.setValueAtTime(220, now);
        gain.gain.setValueAtTime(0.2, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.start(); osc.stop(now + 0.1);
    } else if (type === 'shield_break') {
        osc.type = 'square'; osc.frequency.setValueAtTime(220, now);
        gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(); osc.stop(now + 0.2);
    } else if (type === 'magic') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(110, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.6);
        gain.gain.setValueAtTime(0.3, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc.start(); osc.stop(now + 0.6);
    } else if (type === 'stage_up') {
        [523, 659, 784, 1046].forEach((f, idx) => {
            const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
            o.connect(g); g.connect(audioCtx.destination);
            o.frequency.setValueAtTime(f, now + idx * 0.1);
            g.gain.setValueAtTime(0.1, now + idx * 0.1);
            g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.1);
            o.start(now + idx * 0.1); o.stop(now + idx * 0.1 + 0.1);
        });
    }
}

let bgmOscillators = [];
function startBGM() {
    if (bgmInterval) clearInterval(bgmInterval);
    bgmOscillators.forEach(o => { try { o.stop(); } catch(e) {} });
    bgmOscillators = [];
    
    const bpm = 150;
    const beatInterval = 60000 / bpm;
    
    bgmInterval = setInterval(() => {
        if (!gameActive) return;
        const now = audioCtx.currentTime;
        
        // Driving bass rhythm
        const bassOsc = audioCtx.createOscillator();
        const bassGain = audioCtx.createGain();
        bassOsc.connect(bassGain);
        bassGain.connect(audioCtx.destination);
        bassOsc.type = 'square';
        const bassFreq = [55, 55, 73.42, 55][(Math.floor(frameCount / 4) % 4)];
        bassOsc.frequency.setValueAtTime(bassFreq, now);
        bassGain.gain.setValueAtTime(0.15, now);
        bassGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        bassOsc.start(now);
        bassOsc.stop(now + 0.1);
        bgmOscillators.push(bassOsc);
        
        // Lead melody with stage-based variation
        if (frameCount % 2 === 0) {
            const leadOsc = audioCtx.createOscillator();
            const leadGain = audioCtx.createGain();
            leadOsc.connect(leadGain);
            leadGain.connect(audioCtx.destination);
            leadOsc.type = 'sawtooth';
            const baseNotes = [
                [220, 261.63, 329.63, 392],
                [261.63, 329.63, 392, 523.25],
                [329.63, 392, 523.25, 659.25],
                [392, 523.25, 659.25, 783.99]
            ];
            const noteSet = baseNotes[Math.min(3, Math.floor((stage - 1) / 5))];
            const noteIndex = Math.floor(frameCount / 8) % 4;
            const freq = noteSet[noteIndex] * (1 + (stage - 1) * 0.05);
            leadOsc.frequency.setValueAtTime(freq, now);
            leadGain.gain.setValueAtTime(0.06, now);
            leadGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            leadOsc.start(now);
            leadOsc.stop(now + 0.15);
            bgmOscillators.push(leadOsc);
        }
        
        // Hi-hat accent
        if (frameCount % 4 === 0) {
            const hihatOsc = audioCtx.createOscillator();
            const hihatGain = audioCtx.createGain();
            hihatOsc.connect(hihatGain);
            hihatGain.connect(audioCtx.destination);
            hihatOsc.type = 'square';
            hihatOsc.frequency.setValueAtTime(8000, now);
            hihatGain.gain.setValueAtTime(0.03, now);
            hihatGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
            hihatOsc.start(now);
            hihatOsc.stop(now + 0.03);
            bgmOscillators.push(hihatOsc);
        }
    }, 125);
}

function startGame() {
    if (!canvas) initDOMElements();
    audioCtx.resume().then(() => {
        startBGM();
    });
    if (startScreen) startScreen.style.display = 'none';
    gameActive = true;
    startTime = Date.now();
    player = new Player();
    enemies = []; enemyBullets = []; items = []; explosions = [];
    score = 0; stage = 3; lives = 3; hp = 100; weaponLevel = 1;
    shieldLayers = 0;
    magicCount = 0;
    initBackground();
    initTouchControls();
    updateHUD();
    updateMagicButton();
    fetch('/api/increment-attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game: 'airplane-shooter' })
    });
    loop();
}

window.onload = function() {
    initDOMElements();
};
