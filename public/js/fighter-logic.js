// 0. Global Setup
const socket = (typeof io !== 'undefined') ? io() : null;

// 1. 다채로운 캐릭터 데이터 (3D 렌더링 지원)
const CHARACTERS = [
    { id: 'vanguard', name: 'Vanguard', color: '#00f2ff', speed: 5.5, power: 1.0, jump: 14, special: 'CYBER SLASH', info: '사이버 빔 소드 공격' },
    { id: 'wraith', name: 'Wraith', color: '#ff0055', speed: 8.0, power: 0.8, jump: 16, special: 'VOID STEP', info: '무적 은신 및 대시' },
    { id: 'colossus', name: 'Colossus', color: '#95a5a6', speed: 3.5, power: 2.5, jump: 10, special: 'GROUND SMASH', info: '육중한 주먹 강타' },
    { id: 'volt', name: 'Volt', color: '#f1c40f', speed: 6.0, power: 1.1, jump: 14, special: 'PLASMA BOLT', info: '전기 구체 발사' },
    { id: 'reaper', name: 'Reaper', color: '#8e44ad', speed: 5.0, power: 1.4, jump: 13, special: 'SOUL DRAIN', info: '거대 낫 & 체력 흡수' },
    { id: 'glitch', name: 'Glitch', color: '#2ecc71', speed: 6.5, power: 1.2, jump: 15, special: 'ERROR 404', info: '무작위 순간이동' },
    { id: 'monk', name: 'Monk', color: '#e67e22', speed: 5.8, power: 1.0, jump: 18, special: 'DRAGON KICK', info: '기공권 및 공중기' },
    { id: 'cyber', name: 'Cyber', color: '#1abc9c', speed: 5.2, power: 1.3, jump: 13, special: 'LASER BEAM', info: '팔 캐논 레이저' },
    { id: 'phantom', name: 'Phantom', color: '#ffffff', speed: 7.0, power: 0.9, jump: 15, special: 'MIRROR IMAGE', info: '잔상 환영 이동' }
];

const PLATFORMS = [
    { x: 50, y: 300, w: 150, h: 12 }, { x: 600, y: 300, w: 150, h: 12 },
    { x: 250, y: 200, w: 300, h: 12 }
];

// 2. 사운드 엔진
class SoundEngine {
    constructor() { this.ctx = null; this.bgmInterval = null; }
    init() { 
        try {
            if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            if (this.ctx.state === 'suspended') this.ctx.resume();
            this.startBGM();
        } catch(e) {}
    }
    play(t) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const now = this.ctx.currentTime;
        const o = this.ctx.createOscillator(); const g = this.ctx.createGain(); o.connect(g); g.connect(this.ctx.destination);
        if (t === 'punch') { o.type='square'; o.frequency.setValueAtTime(200, now); g.gain.setValueAtTime(0.1, now); o.start(); o.stop(now+0.05); }
        else if (t === 'hit') { this.noise(0.3, 0.08, 200); }
        else if (t === 'special') { o.type='sawtooth'; o.frequency.setValueAtTime(100, now); o.frequency.exponentialRampToValueAtTime(1000, now+0.3); g.gain.setValueAtTime(0.2, now); o.start(); o.stop(now+0.3); }
    }
    noise(v, d, f) {
        const b = this.ctx.createBuffer(1, this.ctx.sampleRate*d, this.ctx.sampleRate);
        const data = b.getChannelData(0); for(let i=0; i<data.length; i++) data[i]=Math.random()*2-1;
        const s = this.ctx.createBufferSource(); s.buffer = b;
        const g = this.ctx.createGain(); g.gain.setValueAtTime(v, this.ctx.currentTime);
        const fl = this.ctx.createBiquadFilter(); fl.type='lowpass'; fl.frequency.value=f;
        s.connect(fl); fl.connect(g); g.connect(this.ctx.destination); s.start();
    }
    startBGM() {
        if(this.bgmInterval) return;
        let step = 0;
        this.bgmInterval = setInterval(() => {
            if(!this.ctx || this.ctx.state !== 'running') return;
            const now = this.ctx.currentTime;
            
            // Frantic, high-pitched taunting melody
            // Using a mix of high chromatic jumps and a fast "laughing" rhythm
            const tauntMelody = [523.25, 659.25, 783.99, 932.33, 880.00, 698.46, 587.33, 493.88]; 
            const bassline = [65.41, 65.41, 82.41, 98.00]; // Low C pulses
            
            // Main Melody (High & Chirpy)
            const o1 = this.ctx.createOscillator();
            const g1 = this.ctx.createGain();
            o1.type = (step % 4 === 0) ? 'sawtooth' : 'square';
            o1.frequency.setValueAtTime(tauntMelody[step % tauntMelody.length], now);
            g1.gain.setValueAtTime(0.08, now);
            g1.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            o1.connect(g1); g1.connect(this.ctx.destination);
            o1.start(); o1.stop(now + 0.1);

            // Bass Pulse (Punchy)
            if (step % 2 === 0) {
                const o2 = this.ctx.createOscillator();
                const g2 = this.ctx.createGain();
                o2.type = 'triangle';
                o2.frequency.setValueAtTime(bassline[Math.floor(step/2) % bassline.length], now);
                g2.gain.setValueAtTime(0.15, now);
                g2.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
                o2.connect(g2); g2.connect(this.ctx.destination);
                o2.start(); o2.stop(now + 0.12);
            }
            
            step++;
        }, 120); // Faster tempo (120ms) for maximum annoyance/tension
    }
}
const sounds = new SoundEngine();

// 3. 파이터 클래스 (3D 효과 & 물리 최적화)
class Fighter {
    constructor(x, y, charData, isP1, isLocal) {
        this.x=x; this.y=y; this.char=charData; this.isP1=isP1; this.isLocal=isLocal;
        this.width=60; this.height=130; this.velocity={x:0,y:0};
        this.health=100; this.skillPower=0; this.isAttacking=false; this.attackType=''; this.attackFrame=0;
        this.isJumping=false; this.facingRight=isP1; this.hitTimer=0; this.animTime=0;
        this.projectiles=[]; this.isStealth=false;
    }

    draw(ctx) {
        if (this.isStealth && Math.floor(Date.now() / 100) % 2 === 0) return;
        ctx.save();
        this.animTime += 0.15;
        const bounce = Math.sin(this.animTime) * 4;
        const walk = Math.abs(this.velocity.x) > 0.1 ? Math.sin(this.animTime * 1.5) * 12 : 0;

        ctx.translate(this.x + this.width/2, this.y + this.height);
        if (!this.facingRight) ctx.scale(-1, 1);

        // Legs (3D Shading)
        [ {x:-10, w:walk}, {x:10, w:-walk} ].forEach(leg => {
            const grad = ctx.createLinearGradient(leg.x-6, 0, leg.x+6, 0);
            grad.addColorStop(0, '#222'); grad.addColorStop(0.5, this.char.color); grad.addColorStop(1, '#222');
            ctx.strokeStyle = grad; ctx.lineWidth = 14; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(leg.x, -40); ctx.lineTo(leg.x + leg.w, 0); ctx.stroke();
        });

        // Body (3D Deep Gradient)
        ctx.translate(0, bounce);
        const bodyGrad = ctx.createLinearGradient(-30, 0, 30, 0);
        bodyGrad.addColorStop(0, '#111'); bodyGrad.addColorStop(0.5, this.char.color); bodyGrad.addColorStop(1, '#111');
        ctx.fillStyle = bodyGrad;
        ctx.shadowBlur = 25; ctx.shadowColor = this.char.color;
        if(ctx.roundRect) ctx.roundRect(-30, -110, 60, 85, 12); else ctx.rect(-30, -110, 60, 85);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2; ctx.stroke();

        // Highlighting
        ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(-25, -105, 12, 75);

        // Weapons
        this.drawWeapon(ctx);

        // Head (Radial Shading)
        const headGrad = ctx.createRadialGradient(-10, -145, 5, 0, -135, 25);
        headGrad.addColorStop(0, '#f9d5c0'); headGrad.addColorStop(1, '#c49a80');
        ctx.fillStyle = headGrad;
        ctx.beginPath(); ctx.arc(0, -135, 28, 0, Math.PI*2); ctx.fill();
        ctx.stroke();
        
        // Eyes
        ctx.shadowBlur = 15; ctx.shadowColor = this.hitTimer > 0 ? '#f00' : '#fff';
        ctx.fillStyle = this.hitTimer > 0 ? '#f00' : '#fff';
        ctx.fillRect(6, -142, 8, 8); ctx.fillRect(-14, -142, 8, 8);

        ctx.restore();
    }

    drawWeapon(ctx) {
        ctx.save();
        const atkProgress = this.isAttacking ? Math.sin((this.attackFrame/15) * Math.PI) : 0;
        if(this.char.id === 'vanguard') {
            const angle = atkProgress * 1.5; ctx.rotate(angle);
            const swordGrad = ctx.createLinearGradient(20, -80, 90, -80);
            swordGrad.addColorStop(0, '#fff'); swordGrad.addColorStop(1, this.char.color);
            ctx.strokeStyle = swordGrad; ctx.lineWidth = 12;
            ctx.beginPath(); ctx.moveTo(20, -80); ctx.lineTo(90, -80); ctx.stroke();
        } else if(this.char.id === 'reaper') {
            const angle = atkProgress * 2; ctx.rotate(angle);
            ctx.strokeStyle = '#222'; ctx.lineWidth = 6;
            ctx.beginPath(); ctx.moveTo(10, -60); ctx.lineTo(10, -160); ctx.stroke();
            const scytheGrad = ctx.createLinearGradient(10, -160, 85, -130);
            scytheGrad.addColorStop(0, this.char.color); scytheGrad.addColorStop(1, '#111');
            ctx.strokeStyle = scytheGrad; ctx.lineWidth = 14;
            ctx.beginPath(); ctx.moveTo(10, -160); ctx.quadraticCurveTo(50, -160, 85, -130); ctx.stroke();
        } else if(this.char.id === 'colossus') {
            const punch = atkProgress * 60;
            const fistGrad = ctx.createRadialGradient(25+punch, -90, 5, 25+punch, -90, 20);
            fistGrad.addColorStop(0, '#888'); fistGrad.addColorStop(1, '#333');
            ctx.fillStyle = fistGrad; ctx.fillRect(10 + punch, -105, 45, 45); ctx.strokeRect(10 + punch, -105, 45, 45);
        } else if(this.char.id === 'cyber') {
            ctx.fillStyle = '#222'; ctx.fillRect(15, -95, 50, 35);
            if(this.isAttacking && this.attackFrame > 5) {
                const laserGrad = ctx.createRadialGradient(65, -80, 2, 65, -80, 25);
                laserGrad.addColorStop(0, '#fff'); laserGrad.addColorStop(1, this.char.color);
                ctx.fillStyle = laserGrad; ctx.beginPath(); ctx.arc(65, -80, 25 * atkProgress, 0, Math.PI*2); ctx.fill();
            }
        } else {
            const swing = atkProgress * 45;
            ctx.strokeStyle = '#f3c1a3'; ctx.lineWidth = 14;
            ctx.beginPath(); ctx.moveTo(15, -80); ctx.lineTo(45 + swing, -80 + swing/2); ctx.stroke();
        }
        ctx.restore();
    }

    update() {
        this.x += this.velocity.x; this.y += this.velocity.y;
        let onPlat = false;
        PLATFORMS.forEach(p => {
            if(this.x+this.width > p.x && this.x < p.x+p.w && this.y+this.height >= p.y && this.y+this.height <= p.y+p.h+10){
                this.y = p.y - this.height; this.velocity.y = 0; onPlat = true;
            }
        });
        if(!onPlat) {
            if (this.y + this.height < 400) { this.velocity.y += 0.8; this.isJumping = true; }
            else { this.velocity.y = 0; this.y = 400 - this.height; this.isJumping = false; }
        } else { this.isJumping = false; }
        if(this.x < 0) this.x = 0; if(this.x + this.width > 800) this.x = 800 - this.width;
        if(this.isAttacking) { this.attackFrame++; if(this.attackFrame > 15) { this.isAttacking = false; this.attackFrame = 0; } }
        if(this.hitTimer > 0) this.hitTimer--;
        this.skillPower += 0.4; if(this.skillPower > 100) this.skillPower = 100;
        this.projectiles.forEach((p, i) => { p.x += p.vx; p.y += p.vy; if(p.x < -100 || p.x > 900 || p.y < -100 || p.y > 500) this.projectiles.splice(i, 1); });
    }

    attack(t) {
        if(!this.isAttacking && this.hitTimer === 0) {
            if(t === 'special' && this.skillPower < 100) return;
            this.isAttacking = true; this.attackType = t; this.attackFrame = 0;
            if(t === 'special') { this.skillPower = 0; screenShake = 25; this.executeSpecial(); }
            sounds.play(t === 'special' ? 'special' : 'punch');
        }
    }

    executeSpecial() {
        if(this.char.id === 'volt') this.projectiles.push({x:this.x + (this.facingRight?60:-20), y:this.y+50, vx:this.facingRight?15:-15, vy:0, r:20, color:this.char.color});
        else if(this.char.id === 'cyber') this.projectiles.push({x:this.x + (this.facingRight?60:-20), y:this.y+50, vx:this.facingRight?30:-30, vy:0, r:12, color:this.char.color});
        else if(this.char.id === 'wraith') { this.isStealth = true; setTimeout(()=>this.isStealth=false, 2500); this.velocity.x = this.facingRight ? 50 : -50; }
        else if(this.char.id === 'glitch') { this.x = Math.random() * 700; this.y = 100; }
    }
}

// 4. 게임 엔진
let particles = [], screenShake = 0, arenaStarted = false, selectedChar = null, gameMode = '', p1, p2, gameLoopId;
const inputs = { left:false, right:false, up:false, punch:false, kick:false, special:false };
const myUsername = (typeof currentUser !== 'undefined') ? currentUser.username : "Guest";

function createHitFX(x, y, color) {
    for(let i=0; i<15; i++) particles.push({ x, y, vx:(Math.random()-0.5)*20, vy:(Math.random()-0.5)*20, life:25, color, r:Math.random()*7+3 });
    screenShake = 15;
}

function checkCollision(a, b) {
    a.projectiles.forEach((p, i) => {
        if(!b.isStealth && p.x > b.x && p.x < b.x + b.width && p.y > b.y && p.y < b.y + b.height) {
            b.health -= 18; b.hitTimer = 15; createHitFX(p.x, p.y, p.color); a.projectiles.splice(i, 1); sounds.play('hit');
        }
    });
    if(!a.isAttacking || a.attackFrame < 5 || a.attackFrame > 12 || b.isStealth) return;
    const range = a.attackType === 'special' ? 140 : 80;
    const ax = a.facingRight ? a.x + a.width : a.x - range;
    if(ax < b.x + b.width && ax + range > b.x && a.y < b.y + b.height && a.y + a.height > b.y) {
        if(b.hitTimer === 0) {
            let dmg = a.char.power * (a.attackType === 'special' ? 30 : 9);
            b.health -= dmg; b.hitTimer = 12;
            if(a.char.id === 'reaper') a.health = Math.min(100, a.health + 5);
            sounds.play('hit'); createHitFX(b.x + b.width/2, b.y + b.height/2, a.char.color);
        }
    }
}

function animate() {
    gameLoopId = requestAnimationFrame(animate);
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 800, 400);
    
    ctx.fillStyle = '#0a0a0c'; ctx.fillRect(0,0,800,400);
    ctx.strokeStyle = 'rgba(0, 242, 255, 0.05)';
    for(let i=0; i<800; i+=40) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,400); ctx.stroke(); }
    ctx.fillStyle = '#1a1a1e'; PLATFORMS.forEach(p => ctx.fillRect(p.x, p.y, p.w, p.h));

    if(screenShake > 0) { ctx.save(); ctx.translate((Math.random()-0.5)*screenShake, (Math.random()-0.5)*screenShake); screenShake *= 0.9; }
    
    // Process Inputs (Simultaneous Handling)
    p1.velocity.x = 0;
    if(inputs.left) { p1.velocity.x = -p1.char.speed; p1.facingRight = false; }
    if(inputs.right) { p1.velocity.x = p1.char.speed; p1.facingRight = true; }
    if(inputs.up && !p1.isJumping) p1.velocity.y = -p1.char.jump;
    if(inputs.punch) p1.attack('punch');
    if(inputs.kick) p1.attack('kick');
    if(inputs.special) p1.attack('special');

    if(gameMode === 'ai') {
        const dist = p1.x - p2.x;
        if(Math.abs(dist) > 110) { p2.velocity.x = dist > 0 ? p2.char.speed * 0.6 : -p2.char.speed * 0.6; p2.facingRight = dist > 0; }
        else { p2.velocity.x = 0; if(Math.random() < 0.04) p2.attack('punch'); }
    }

    p1.update(); p2.update();
    checkCollision(p1, p2); checkCollision(p2, p1);
    p1.draw(ctx); p2.draw(ctx);

    [p1, p2].forEach(f => {
        f.projectiles.forEach(p => {
            ctx.fillStyle = p.color; ctx.shadowBlur = 20; ctx.shadowColor = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
        });
    });

    if(screenShake > 0) ctx.restore();

    particles.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy; p.life--;
        if(p.life <= 0) particles.splice(i, 1);
        else { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill(); }
    });

    document.getElementById('p1-health').style.width = Math.max(0, p1.health) + '%';
    document.getElementById('p2-health').style.width = Math.max(0, p2.health) + '%';
    document.getElementById('p1-skill').style.width = p1.skillPower + '%';
    document.getElementById('p2-skill').style.width = p2.skillPower + '%';

    if(p1.health <= 0 || p2.health <= 0) {
        cancelAnimationFrame(gameLoopId);
        arenaStarted = false;
        const winner = p1.health > 0 ? myUsername : 'CPU';
        const loser = p1.health > 0 ? 'CPU' : myUsername;
        document.getElementById('game-over-msg').innerText = (p1.health > 0 ? p1.char.name : p2.char.name) + " WINS!";
        if(socket) socket.emit('record_result', { winner, loser });
        setTimeout(() => showScreen('lobby'), 3000);
    }
}

// 5. 인프라
window.initAudioAndStart = function() {
    if (arenaStarted) return;
    showScreen('lobby');
    arenaStarted = true;
    sounds.init();
    initCharSelection();
};

window.startAIGame = function() {
    if(!selectedChar) return;
    gameMode = 'ai';
    p1 = new Fighter(100, 300, selectedChar, true, true);
    p2 = new Fighter(600, 300, CHARACTERS[Math.floor(Math.random()*CHARACTERS.length)], false, false);
    showScreen('game');
    animate();
    incrementFighterAttempts();
};

window.showScreen = function(n) {
    document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
    const t = document.getElementById(n + '-screen');
    if (t) t.style.display = 'flex';
    document.getElementById('start-overlay').style.display = 'none';
    if(n === 'lobby') initCharSelection();
};

function initCharSelection() {
    const cg = document.getElementById('char-grid');
    if (!cg) return;
    cg.innerHTML = '';
    CHARACTERS.forEach(c => {
        const card = document.createElement('div');
        card.className = 'char-card' + (selectedChar && selectedChar.id === c.id ? ' selected' : '');
        const canvasId = `icon-${c.id}`;
        card.innerHTML = `<canvas id="${canvasId}" width="80" height="80" class="face-icon"></canvas><div class="char-name">${c.name}</div>`;
        card.onclick = () => {
            selectedChar = c;
            document.querySelectorAll('.char-card').forEach(el => el.classList.remove('selected'));
            card.classList.add('selected');
            document.getElementById('skill-description').innerText = `${c.special}: ${c.info}`;
            document.getElementById('ai-btn').disabled = false;
        };
        cg.appendChild(card);
        setTimeout(() => {
            const canvas = document.getElementById(canvasId);
            if(canvas) {
                const ictx = canvas.getContext('2d');
                ictx.shadowBlur = 15; ictx.shadowColor = c.color;
                const grad = ictx.createRadialGradient(40, 40, 5, 40, 40, 30);
                grad.addColorStop(0, c.color); grad.addColorStop(1, '#000');
                ictx.fillStyle = grad; ictx.beginPath(); ictx.arc(40,40,30,0,Math.PI*2); ictx.fill();
                ictx.fillStyle = '#fff'; ictx.fillRect(30,35,6,6); ictx.fillRect(44,35,6,6);
            }
        }, 0);
    });
}

function incrementFighterAttempts() {
    fetch('/api/increment-attempts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game: 'fighter' }) })
    .then(res => res.json()).then(d => { if(d.success) { 
        const el = document.getElementById('my-attempts');
        if(el) el.innerText = parseInt(el.innerText) + 1;
    }}).catch(e => {});
}

if(socket) {
    socket.on('stats_update', d => {
        const el = document.getElementById('user-stats');
        if(el) el.innerText = `${d.wins}W ${d.losses}L`;
    });
}

// Improved Input Handler (Simultaneous Support)
const updateInput = (k, v) => {
    if(['ArrowLeft','KeyA'].includes(k)) inputs.left = v;
    if(['ArrowRight','KeyD'].includes(k)) inputs.right = v;
    if(['ArrowUp','KeyW','KeyW'].includes(k)) inputs.up = v;
    if(k === 'Space') inputs.punch = v;
    if(k === 'KeyK') inputs.kick = v;
    if(k === 'KeyL') inputs.special = v;
};

window.addEventListener('keydown', e => updateInput(e.code, true));
window.addEventListener('keyup', e => updateInput(e.code, false));

const bind = (id, k) => {
    const e = document.getElementById(id);
    if(e) {
        const set = (v) => { inputs[k] = v; };
        e.addEventListener('touchstart', ev => { ev.preventDefault(); set(true); });
        e.addEventListener('touchend', ev => { ev.preventDefault(); set(false); });
        e.addEventListener('mousedown', () => set(true));
        e.addEventListener('mouseup', () => set(false));
        e.addEventListener('mouseleave', () => set(false));
    }
};
bind('btn-up','up'); bind('btn-left','left'); bind('btn-right','right'); bind('btn-punch','punch'); bind('btn-kick','kick'); bind('btn-special','special');

document.addEventListener('DOMContentLoaded', initCharSelection);
