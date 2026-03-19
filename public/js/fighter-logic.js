const socket = io();

// 1. 캐릭터 데이터 및 특성
const CHARACTERS = [
    { id: 'gunner', name: 'Gunner', color: '#7f8c8d', speed: 4.8, power: 1.1, jump: 12, special: 'SHELLING', info: '무기 인출 & 포격' },
    { id: 'fencer', name: 'Fencer', color: '#0984e3', speed: 5.8, power: 1.2, jump: 12, special: 'SWORD SWEEP', info: '장검 휘두르기' },
    { id: 'balloon', name: 'Balloon', color: '#e84393', speed: 4.2, power: 1.3, jump: 16, special: 'GIGA CRUSH', info: '튕기기 & 압살' },
    { id: 'ninja', name: 'Ninja', color: '#2d3436', speed: 7.2, power: 0.9, jump: 17, special: 'VANISH', info: '은신 무적' },
    { id: 'master', name: 'Qi Master', color: '#f1c40f', speed: 5.2, power: 1.2, jump: 18, special: 'HADOKEN', info: '거대 장풍' },
    { id: 'wrestler', name: 'Wrestler', color: '#d63031', speed: 4.8, power: 1.8, jump: 10, special: 'POWER SLAM', info: '잡아 던지기' },
    { id: 'muscle', name: 'Muscle', color: '#e67e22', speed: 3.8, power: 2.2, jump: 11, special: 'IMPACT PUNCH', info: '강력한 넉백' },
    { id: 'mage', name: 'Mage', color: '#9b59b6', speed: 4.2, power: 1.4, jump: 13, special: 'MAGIC ORB', info: '유도 마력탄' },
    { id: 'marine', name: 'Marine', color: '#2ecc71', speed: 7.8, power: 1.0, jump: 14, special: 'STORM DASH', info: '초고속 돌진' }
];

const PLATFORMS = [
    { x: 50, y: 300, w: 120, h: 10 }, { x: 630, y: 300, w: 120, h: 10 },
    { x: 200, y: 220, w: 150, h: 10 }, { x: 450, y: 220, w: 150, h: 10 },
    { x: 300, y: 130, w: 200, h: 10 }
];

class SoundEngine {
    constructor() { this.ctx = null; this.bgmInterval = null; }
    init() { 
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume().then(() => {
                console.log("AudioContext resumed");
                this.startBGM();
            });
        } else {
            this.startBGM();
        }
    }
    play(t) {
        if (!this.ctx) this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const now = this.ctx.currentTime;
        const o = this.ctx.createOscillator(); const g = this.ctx.createGain(); o.connect(g); g.connect(this.ctx.destination);
        if (t === 'punch') { o.type='square'; o.frequency.setValueAtTime(150, now); g.gain.setValueAtTime(0.1, now); o.start(); o.stop(now+0.08); }
        else if (t === 'hit') { this.noise(0.4, 0.1, 150); }
        else if (t === 'shoot') { o.type='sine'; o.frequency.setValueAtTime(800, now); o.frequency.exponentialRampToValueAtTime(100, now+0.1); g.gain.setValueAtTime(0.1, now); o.start(); o.stop(now+0.1); }
        else if (t === 'special') { o.type='sawtooth'; o.frequency.setValueAtTime(50, now); o.frequency.linearRampToValueAtTime(600, now+0.4); g.gain.setValueAtTime(0.2, now); o.start(); o.stop(now+0.4); }
    }
    noise(v, d, f) {
        if (!this.ctx) return;
        const b = this.ctx.createBuffer(1, this.ctx.sampleRate*d, this.ctx.sampleRate);
        const data = b.getChannelData(0); for(let i=0; i<data.length; i++) data[i]=Math.random()*2-1;
        const s = this.ctx.createBufferSource(); s.buffer = b;
        const g = this.ctx.createGain(); g.gain.setValueAtTime(v, this.ctx.currentTime);
        const fl = this.ctx.createBiquadFilter(); fl.type='lowpass'; fl.frequency.value=f;
        s.connect(fl); fl.connect(g); g.connect(this.ctx.destination); s.start();
    }
    startBGM() {
        if(this.bgmInterval) return;
        console.log("Starting Tense BGM");
        let step = 0;
        this.bgmInterval = setInterval(() => {
            if(!this.ctx || this.ctx.state !== 'running') return;
            
            // Fast, tense, and slightly annoying "taunting" melody
            // Using minor and diminished intervals for tension
            const baseNotes = [130.81, 138.59, 164.81, 174.61, 130.81, 123.47, 116.54, 123.47];
            const leadingNotes = [261.63, 277.18, 329.63, 349.23];
            
            const now = this.ctx.currentTime;
            const o = this.ctx.createOscillator(); 
            const g = this.ctx.createGain();
            
            // Toggle between bass and high "taunting" notes
            let freq = baseNotes[step % baseNotes.length];
            if (step % 4 === 0) freq = leadingNotes[Math.floor(Math.random() * leadingNotes.length)];
            
            o.type = (step % 2 === 0) ? 'sawtooth' : 'square'; // Aggressive wave types
            o.frequency.setValueAtTime(freq, now);
            
            // High volume (0.25)
            g.gain.setValueAtTime(0.25, now); 
            g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            
            o.connect(g); 
            g.connect(this.ctx.destination); 
            o.start(); 
            o.stop(now + 0.15);
            
            step++;
        }, 150); // Faster tempo (150ms) for more annoyance/tension
    }
}
const sounds = new SoundEngine();

let selectedChar = null, myUsername = currentUser.username, gameMode = '', currentRoom = '', isPlayer1 = true, p1, p2, gameLoopId;
const keys = {}, mobileKeys = { left:false, right:false, up:false, down:false, punch:false, kick:false, special:false };
let particles = [], screenShake = 0, arenaStarted = false, backAttackText = 0;

function createHitFX(x, y, color, size=10) { for(let i=0; i<size; i++) particles.push({ x, y, vx:(Math.random()-0.5)*20, vy:(Math.random()-0.5)*20, r:Math.random()*3+1, life:15, color }); screenShake = 12; }

class Fighter {
    constructor(x, y, charData, isP1, isLocal) {
        this.x=x; this.y=y; this.char=charData; this.isP1=isP1; this.isLocal=isLocal;
        this.width=70; this.height=165; this.velocity={x:0,y:0};
        this.health=100; this.skillPower=0; this.isAttacking=false; this.attackType=''; this.attackFrame=0;
        this.isCrouching=false; this.isJumping=false; this.isGuarding=false;
        this.facingRight=isP1; this.hitTimer=0; this.animTime=0; this.projectiles=[];
        this.isDown = false; this.fallTimer = 0; this.isStealth = false;
    }

    draw(ctx) {
        if (this.isStealth && Math.floor(this.animTime * 15) % 2 === 0) return;
        ctx.save(); this.animTime += 0.15;
        const breath = (this.char.id === 'balloon') ? Math.sin(this.animTime) * 12 : Math.sin(this.animTime) * 4;
        const walk = (Math.abs(this.velocity.x) > 0.1) ? Math.sin(this.animTime * 1.5) : 0;
        
        const sx = (Math.random()-0.5)*screenShake, sy = (Math.random()-0.5)*screenShake;
        ctx.translate(this.x + this.width/2 + sx, this.y + this.height + sy);
        if (!this.facingRight) ctx.scale(-1, 1);
        
        if (this.isDown) ctx.rotate(Math.PI/2);

        if(this.isLocal){
            ctx.save(); ctx.scale(this.facingRight?1:-1, 1); ctx.fillStyle='#f1c40f'; 
            ctx.beginPath(); ctx.moveTo(0,-this.height-50); ctx.lineTo(-10,-this.height-65); ctx.lineTo(10,-this.height-65); ctx.fill();
            ctx.restore();
        }

        const color = this.char.color, skin = '#f3c1a3', legY = this.isCrouching ? -40 : -65;

        // 다리
        ctx.lineWidth = 16; ctx.lineCap = 'round'; ctx.strokeStyle = color;
        const isGunnerShelling = (this.char.id === 'gunner' && this.attackType === 'special' && this.isAttacking);
        if(isGunnerShelling) { // 포격 자세: 무릎을 굽힘
            ctx.beginPath(); ctx.moveTo(-15, legY); ctx.lineTo(-25, 0); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(15, legY); ctx.lineTo(25, 0); ctx.stroke();
        } else if(this.isAttacking && this.attackType==='kick' && this.attackFrame>=5){
            ctx.beginPath(); ctx.moveTo(0,legY); ctx.lineTo(85, legY+15); ctx.stroke();
        } else {
            ctx.beginPath(); ctx.moveTo(0,legY); ctx.lineTo(walk * 25, 0); ctx.stroke();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 14;
            ctx.beginPath(); ctx.moveTo(0,legY); ctx.lineTo(-walk * 25, 0); ctx.stroke();
        }

        // 몸통
        ctx.translate(0, (this.isCrouching ? 40 : 0) + breath);
        ctx.fillStyle = color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
        const tH = this.isCrouching ? 50 : 90, tW = (this.char.id === 'balloon') ? 95 : 55;
        ctx.beginPath();
        if(this.char.id === 'balloon') ctx.arc(0, legY - tH/2, tW/2, 0, Math.PI*2);
        else if(ctx.roundRect) ctx.roundRect(-tW/2, legY - tH, tW, tH, 12);
        else ctx.rect(-tW/2, legY - tH, tW, tH);
        ctx.fill(); ctx.stroke();

        // 무기 및 기술 애니메이션 (강화)
        this.drawWeaponAdvanced(ctx, legY - tH + 20, color);

        // 머리
        const hy = legY - tH - 25;
        ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0, hy, 28, 0, Math.PI * 2); ctx.fill();
        this.drawFace(ctx, hy);

        ctx.restore();

        this.projectiles.forEach(p => {
            ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
        });
    }

    drawWeaponAdvanced(ctx, shY, color) {
        ctx.save();
        if(this.char.id === 'fencer') { // 검술사: 크게 휘두르기
            ctx.strokeStyle = '#bdc3c7'; ctx.lineWidth = 5;
            if(this.isAttacking) {
                const angle = (this.attackFrame / 20) * Math.PI - (Math.PI/2); // -90도에서 90도로 스윕
                ctx.rotate(angle);
                ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(120, 0); ctx.stroke();
                // 베기 효과
                ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 15;
                ctx.beginPath(); ctx.arc(0, 0, 120, -0.5, 0.5); ctx.stroke();
            } else {
                ctx.beginPath(); ctx.moveTo(10, shY); ctx.lineTo(100, shY-10); ctx.stroke();
            }
        } else if(this.char.id === 'gunner') { // 건너: 무기 인출 및 포격
            if(this.isAttacking) {
                if(this.attackFrame < 8) { // 주머니에서 꺼내는 중
                    ctx.fillStyle = '#333'; ctx.fillRect(0, shY + 10, 20, 10);
                } else { // 조준 및 사격
                    ctx.fillStyle = '#333'; ctx.fillRect(10, shY - 5, 40, 15);
                    if(this.attackFrame === 11) { // 총구 화염
                        ctx.fillStyle='#f1c40f'; ctx.beginPath(); ctx.arc(55, shY, 15, 0, Math.PI*2); ctx.fill();
                    }
                }
            }
        } else if(this.char.id === 'mage') {
            ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 6;
            ctx.beginPath(); ctx.moveTo(10, shY+20); ctx.lineTo(35, shY-65); ctx.stroke();
            ctx.fillStyle = '#9b59b6'; ctx.beginPath(); ctx.arc(35, shY-70, 15, 0, Math.PI*2); ctx.fill();
        }
        ctx.restore();
    }

    drawFace(ctx, hy) {
        ctx.lineWidth = 2; ctx.strokeStyle = '#000';
        if (this.hitTimer > 0) {
            ctx.beginPath(); ctx.moveTo(-10, hy-10); ctx.lineTo(10, hy+10); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(10, hy-10); ctx.lineTo(-10, hy+10); ctx.stroke();
            ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0, hy+15, 12, 0, Math.PI*2); ctx.fill();
        } else {
            ctx.fillStyle = '#000'; ctx.fillRect(8, hy-5, 5, 5);
            ctx.beginPath(); ctx.arc(0, hy+15, 10, 0, Math.PI); ctx.stroke();
        }
    }

    update() {
        if(this.fallTimer > 0) { this.fallTimer--; this.isDown = true; return; } else { this.isDown = false; }
        this.x += this.velocity.x; this.y += this.velocity.y;
        
        let onPlat = false;
        for(const p of PLATFORMS){ if(this.x+this.width > p.x && this.x < p.x+p.w && this.y+this.height >= p.y && this.y+this.height <= p.y+p.h+10){ this.y = p.y - this.height; this.velocity.y = 0; onPlat = true; break; } }
        
        if(!onPlat){
            if (this.y + this.height < 400) { this.velocity.y += 0.8; this.isJumping = true; }
            else { 
                if(this.char.id === 'balloon' && this.velocity.y > 5) { this.velocity.y = -this.velocity.y * 0.7; }
                else { this.velocity.y = 0; this.y = 400 - this.height; this.isJumping = false; }
            }
        } else { this.isJumping = false; }

        if(this.x<0)this.x=0; if(this.x+this.width>800)this.x=800-this.width;
        if(this.isAttacking){ this.attackFrame++; if(this.attackFrame>20){ this.isAttacking=false; this.attackFrame=0; } }
        if(this.hitTimer > 0) this.hitTimer--;
        this.skillPower += (this.isGuarding ? 1.5 : 0.4); if(this.skillPower > 100) this.skillPower = 100;
        
        this.projectiles.forEach((p,i)=>{ 
            p.x+=p.vx; p.y+=p.vy;
            if(p.type==='mage') { const dx = (isPlayer1 ? p2.x : p1.x) - p.x; p.vy += dx > 0 ? 0.05 : -0.05; }
            if(p.x<0||p.x>800||p.y>400)this.projectiles.splice(i,1); 
        });
    }

    attack(t) {
        if(!this.isAttacking && this.hitTimer===0 && !this.isGuarding && !this.isDown){
            if(t==='special' && this.skillPower < 100) return;
            this.isAttacking = true; this.attackType = t; this.attackFrame = 0;
            sounds.play(t==='special'?'special':'punch');
            if(t==='special'){
                this.skillPower = 0;
                if(this.char.id==='gunner') { sounds.play('shoot'); this.projectiles.push({x:this.x+(this.facingRight?80:-10), y:this.y+80, vx:this.facingRight?25:-25, vy:0, r:6, color:'#f1c40f', type:'bullet'}); }
                if(this.char.id==='master') { this.projectiles.push({x:this.x+(this.facingRight?80:-10), y:this.y+80, vx:this.facingRight?15:-15, vy:0, r:35, color:'#00d2d3', type:'qi'}); }
                if(this.char.id==='mage') { this.projectiles.push({x:this.x+(this.facingRight?80:-10), y:this.y+80, vx:this.facingRight?6:-6, vy:0, r:50, color:'#9b59b6', type:'mage'}); }
                if(this.char.id==='ninja') { this.isStealth = true; setTimeout(()=>this.isStealth=false, 3000); }
                if(['muscle','marine','tank'].includes(this.char.id)) this.velocity.x = this.facingRight?45:-45;
            }
        }
    }
}

// 🧠 AI 너프 (반응 속도 지연)
function updateAI(ai, target) {
    const d = target.x - ai.x;
    const absD = Math.abs(d);

    // 1. 반응 지연 (유저 공격 프레임이 10 이상일 때만 방어 시도)
    if (target.isAttacking && target.attackFrame > 10 && absD < 200) {
        if(Math.random()<0.4) { ai.isGuarding=true; if(target.attackType==='kick') ai.isCrouching=true; return; }
    } else { ai.isGuarding=false; ai.isCrouching=false; }

    // 2. 이동 및 공격 (더 인간적으로)
    if (absD > 160) {
        ai.velocity.x = d > 0 ? ai.char.speed * 0.7 : -ai.char.speed * 0.7;
        ai.facingRight = d > 0;
    } else {
        ai.velocity.x = 0;
        if(Math.random()<0.04) ai.attack(ai.skillPower>=100?'special':'punch');
    }
    if (target.y < ai.y - 80 && !ai.isJumping && Math.random()<0.05) ai.velocity.y = -ai.char.jump;
}

const canvas=document.getElementById('gameCanvas'), ctx=canvas.getContext('2d');

function checkCollision(a,b){
    if(b.isStealth) return false;
    const isBackAttack = (a.facingRight === b.facingRight);

    // 풍선 깔아뭉개기
    if(a.char.id==='balloon' && a.velocity.y > 3 && a.y+a.height < b.y+60 && Math.abs((a.x+35)-(b.x+35)) < 50) { b.health -= 25; b.fallTimer = 50; createHitFX(b.x+35, b.y, a.char.color, 25); sounds.play('hit'); a.velocity.y = -12; return; }

    a.projectiles.forEach((p,i)=>{ 
        if(p.x>b.x && p.x<b.x+b.width && p.y>b.y && p.y<b.y+b.height){
            if(!isBackAttack && b.isGuarding && b.isCrouching) return;
            let dmg = (p.type==='bullet') ? 15 : (p.type==='qi' ? 20 : 25);
            if(isBackAttack) { dmg *= 2; backAttackText = 30; }
            b.health -= dmg;
            if(p.type==='bullet') b.fallTimer=80; else if(p.type==='qi') b.velocity.x=p.vx*8;
            b.hitTimer=20; createHitFX(p.x,p.y,p.color, isBackAttack?30:20); sounds.play('hit'); a.projectiles.splice(i,1);
        }
    });

    if(!a.isAttacking || a.attackFrame<6 || a.attackFrame>16) return false;
    const reach = (a.char.id==='fencer' || a.attackType==='special') ? 140 : 85;
    const ax = a.facingRight ? a.x+a.width : a.x-reach, ay = a.y+(a.attackType==='punch'?50:100);
    if(!isBackAttack && b.isGuarding && (b.isCrouching || a.attackType==='punch')) return false;

    const hit = ax < b.x+b.width && ax+reach > b.x && ay < b.y+b.height && ay+40 > b.y;
    if(hit && b.hitTimer===0){
        let dmg = a.char.power*6; if(isBackAttack) { dmg *= 2; backAttackText = 30; }
        b.health -= dmg; b.hitTimer=15; createHitFX(ax+(a.facingRight?reach:0), ay, a.char.color, isBackAttack?25:15); sounds.play('hit'); b.velocity.x=a.facingRight?20:-20;
    }
}

function animate(){
    gameLoopId=requestAnimationFrame(animate); ctx.clearRect(0,0,800,400);
    ctx.fillStyle = '#34495e'; PLATFORMS.forEach(p => { ctx.fillRect(p.x, p.y, p.w, p.h); ctx.strokeStyle='#ecf0f1'; ctx.strokeRect(p.x,p.y,p.w,p.h); });
    const me=isPlayer1?p1:p2; me.velocity.x=0;
    me.isCrouching=(keys['ArrowDown']||keys['KeyS']||mobileKeys.down);
    me.isGuarding=(keys['KeyG']||mobileKeys.guard || me.isCrouching);
    if(!me.isGuarding && !me.isAttacking && me.hitTimer===0 && !me.isDown){
        const s = me.char.id==='marine'?1.8:1;
        if(keys['ArrowLeft']||keys['KeyA']||mobileKeys.left){ me.velocity.x=-me.char.speed*s; me.facingRight=false; }
        if(keys['ArrowRight']||keys['KeyD']||mobileKeys.right){ me.velocity.x=me.char.speed*s; me.facingRight=true; }
        if((keys['ArrowUp']||keys['KeyW']||mobileKeys.up)&&!me.isJumping){ me.velocity.y=-me.char.jump; me.velocity.x=(keys['ArrowLeft']||keys['KeyA']||mobileKeys.left)?-me.char.speed*2.5:(keys['ArrowRight']||keys['KeyD']||mobileKeys.right)?me.char.speed*2.5:(me.facingRight?me.char.speed:-me.char.speed); }
        if(keys['Space']||mobileKeys.punch) me.attack('punch');
        if(keys['KeyK']||mobileKeys.kick) me.attack('kick');
        if((keys['KeyL']||mobileKeys.special)&&me.skillPower>=100) me.attack('special');
    }
    if(gameMode==='ai') updateAI(p2, p1);
    p1.update(); p2.update(); checkCollision(p1,p2); checkCollision(p2,p1);
    particles.forEach((p,i)=>{ p.x+=p.vx; p.y+=p.vy; p.life--; if(p.life<=0)particles.splice(i,1); else { ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill(); } });
    if(screenShake>0) screenShake*=0.9;
    if(backAttackText > 0) { ctx.fillStyle = '#ff3e3e'; ctx.font = 'italic bold 40px Arial'; ctx.textAlign = 'center'; ctx.fillText("BACK ATTACK!! x2", 400, 100); backAttackText--; }
    document.getElementById('p1-health').style.width=Math.max(0,p1.health)+'%';
    document.getElementById('p2-health').style.width=Math.max(0,p2.health)+'%';
    document.getElementById('p1-skill').style.width=p1.skillPower+'%';
    document.getElementById('p2-skill').style.width=p2.skillPower+'%';
    p1.draw(ctx); p2.draw(ctx);
    if(p1.health<=0||p2.health<=0){ cancelAnimationFrame(gameLoopId); const win=p1.health<=0?p2:p1; const los=p1.health<=0?p1:p2; document.getElementById('game-over-msg').innerText=win.char.name+" WINS!"; socket.emit('record_result',{winner:win.isLocal?myUsername:'CPU',loser:los.isLocal?myUsername:'CPU'}); setTimeout(()=>{showScreen('lobby');initCharSelection();}, 3000); }
}

function showScreen(n) {
    document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
    const t = document.getElementById(n + '-screen');
    if (t) t.style.display = 'block';

    const overlay = document.getElementById('start-overlay');
    if (overlay) overlay.style.display = 'none';
}

window.initAudioAndStart = () => {
    console.log("initAudioAndStart called");
    if (arenaStarted) return;
    arenaStarted = true;
    
    showScreen('lobby');
    sounds.init();
    initCharSelection();
};

function incrementFighterAttempts() {
    fetch('/api/increment-attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game: 'fighter' })
    }).then(res => res.json())
      .then(data => {
          if (data.success) {
              const el = document.getElementById('my-attempts');
              if (el) el.innerText = parseInt(el.innerText) + 1;
          }
      });
}

window.startAIGame=()=>{
    if(!selectedChar) return;
    gameMode='ai';
    p1=new Fighter(100,300,selectedChar,true,true);
    p2=new Fighter(600,300,CHARACTERS[Math.floor(Math.random()*9)],false,false);
    showScreen('game');
    animate();
    incrementFighterAttempts();
};

socket.on('stats_update', d => { 
    document.getElementById('welcome-msg').innerText = `HI, ${myUsername}! 준비되셨나요?`; 
    const statsEl = document.getElementById('user-stats');
    if(statsEl) statsEl.innerText = `${d.wins}W ${d.losses}L`;
});

function initCharSelection() {
    console.log("initCharSelection called");
    const cg = document.getElementById('char-grid');
    if (!cg) return;
    cg.innerHTML = '';
    CHARACTERS.forEach(c => {
        const card = document.createElement('div');
        card.className = 'char-card';
        card.innerHTML = `<canvas id="icon-${c.id}" width="60" height="60" class="face-icon"></canvas><div class="char-name">${c.name}</div>`;
        card.onclick = () => {
            selectedChar = c;
            document.querySelectorAll('.char-card').forEach(el => el.classList.remove('selected'));
            card.classList.add('selected');
            document.getElementById('skill-description').innerText = `${c.special}: ${c.info}`;
            document.getElementById('ai-btn').disabled = false;
        };
        cg.appendChild(card);
        
        const canvas = document.getElementById(`icon-${c.id}`);
        if (canvas) {
            const ictx = canvas.getContext('2d');
            ictx.fillStyle = '#f3c1a3';
            ictx.beginPath();
            ictx.arc(30, 30, 25, 0, Math.PI * 2);
            ictx.fill();
            ictx.fillStyle = c.color;
            if (c.id === 'gunner') ictx.fillRect(5, 25, 50, 10);
            else if (c.id === 'fencer') { ictx.fillStyle = '#eee'; ictx.fillRect(5, 5, 10, 50); }
            else if (c.id === 'balloon') { /* Balloon icon logic if any */ }
            else if (c.id === 'ninja') { ictx.fillStyle = '#333'; ictx.fillRect(5, 20, 50, 15); }
            else if (c.id === 'mage') { ictx.beginPath(); ictx.moveTo(30, 0); ictx.lineTo(5, 25); ictx.lineTo(55, 25); ictx.fill(); }
            ictx.fillStyle = '#000';
            ictx.fillRect(20, 28, 4, 4);
            ictx.fillRect(36, 28, 4, 4);
        }
    });
}

window.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded: initCharSelection");
    initCharSelection();
});

const bind=(id,k)=>{
    const e=document.getElementById(id);
    if(e){
        e.addEventListener('touchstart',ev=>{ev.preventDefault();mobileKeys[k]=true;});
        e.addEventListener('touchend',ev=>{ev.preventDefault();mobileKeys[k]=false;});
    }
};
bind('btn-up','up');bind('btn-down','down');bind('btn-left','left');bind('btn-right','right');bind('btn-punch','punch');bind('btn-kick','kick');bind('btn-special','special');
window.addEventListener('keydown',e=>keys[e.code]=true);
window.addEventListener('keyup',e=>keys[e.code]=false);
