// Hero's Quest DX - High Quality Audio Engine
var zzfxX;
var zzfxV = 0.5; 
var zzfxR = 44100;

const getAudioContext = () => {
    if (window.game && window.game.sound && window.game.sound.context) zzfxX = window.game.sound.context;
    if (!zzfxX) { try { zzfxX = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){} }
    return zzfxX;
};

var zzfx = (p=1, k=.05, b=220, e=0, r=0, t=.1, q=0, D=1, u=0, y=0, v=0, z=0, l=0, E=0, A=0, f_in=0, c=0, w=1, m=0, B=0) => {
    let ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    let M=Math,R=zzfxR,v2=b*=M.PI*2/R,t2=e*=R,l2=t*=R,q2=q*=R,d=r*=R,u2=y*=M.PI*2/R,v3=v*=M.PI*2/R,z2=z*=M.PI*2/R,j=0,n=0,p2=0,i=0,a=0,f=1,s,h=M.max(1, t2+d+l2+q2)|0,x=new Float32Array(h);
    let z3 = 0; s = D * 2 - 1; if (s > 0.9) s = 0.9; if (s < -0.9) s = -0.9;
    for(;i<h;i++){
        if(++n > M.random()*k*R){ n=0; if (D < 0.5) p2 = M.sin(j); else p2 = M.sin(j) > s ? 1 : -1; }
        a = i < t2 ? i / t2 : i < t2 + d ? 1 : i < h - q2 ? 1 - (i - t2 - d) / l2 : 0;
        f = i < h - q2 ? 1 - f_in + f_in * M.cos((i - t2 - d) / l2 * M.PI) : 1;
        j += v2 += v3; if (z2) j += M.sin(z3 += z2) * u2;
        x[i] = a * f * p2 * zzfxV * p * 0.5;
    }
    let b2 = ctx.createBuffer(1, h, R); b2.getChannelData(0).set(x);
    let s2 = ctx.createBufferSource(); s2.buffer = b2; s2.connect(ctx.destination);
    s2.start(ctx.currentTime); return s2;
};

var AudioSystem = {
    playJump: () => { zzfx(1.2, 0.05, 400, 0.05, 0, 0.1, 0, 0.2); },
    playHit: () => { zzfx(1, 0.05, 600, 0, 0, 0.05, 0, 1, 0, 0, 800); }, 
    playEnemyHit: () => { zzfx(1, 0.01, 300, 0, 0, 0.1, 0, 0.5); }, 
    playPlayerHit: () => { zzfx(1.5, 0.1, 150, 0.1, 0.1, 0.4, 1, 0.8, 40, 50); }, 
    playTrap: () => { zzfx(2, 0.1, 100, 0.2, 0.3, 0.8, 2, 0.8, 30, 40); }, 
    playCoin: () => { zzfx(1, 0.01, 1200, 0.01, 0, 0.2, 0, 0.1, 0, 0, 500); }, 
    playPowerup: () => { zzfx(1.2, 0.05, 600, 0.1, 0.2, 0.6, 0, 0.5, 10); },
    playWin: () => { zzfx(1.2, 0.1, 523, 0.2, 0.2, 0.6, 0, 0.3, 0, 0, 523); },
    playStep: () => { zzfx(0.05, 0.01, 150, 0, 0, 0.02, 0, 0.1); },
    playBreakBrick: () => { zzfx(1.5, 0.05, 200, 0, 0.05, 0.1, 0, 1, 0, 0, -200); },
    playDeath: () => {
        const notes = [440, 440, 392, 349, 329, 293, 261]; 
        notes.forEach((freq, i) => { setTimeout(() => { zzfx(0.7, 0.05, freq, 0.05, 0.05, 0.3, 0, 0.2); }, i * 150); });
    },
    playBossSpawn: () => { zzfx(2, 0.5, 100, 0.5, 0.5, 1.5, 0, 1, -20, 0, -50); }
};

var MusicGenerator = class {
    constructor() { this.ctx = null; this.isPlaying = false; this.notes = []; this.currentNoteIndex = 0; this.nextNoteTime = 0; this.interval = null; }
    start(theme) {
        this.ctx = getAudioContext(); if (!this.ctx) return;
        if (this.isPlaying) this.stop(); this.isPlaying = true;
        if (theme === 'grass') { this.notes = [523.25, 659.25, 783.99, 659.25]; this.tempo = 500; } 
        else if (theme === 'dark') { this.notes = [261.63, 311.13, 392.00, 311.13]; this.tempo = 400; } 
        else if (theme === 'boss') { this.notes = [200, 250, 200, 150]; this.tempo = 700; } 
        else { this.notes = [440, 554.37, 659.25, 554.37]; this.tempo = 450; }
        this.currentNoteIndex = 0; this.nextNoteTime = this.ctx.currentTime + 0.1;
        this.scheduleNotes();
    }
    scheduleNotes() {
        if (!this.isPlaying) return;
        const schedule = () => {
            if (!this.isPlaying || !this.ctx) return;
            while (this.nextNoteTime < this.ctx.currentTime + 0.2) {
                this.playNote(this.notes[this.currentNoteIndex], this.nextNoteTime);
                this.nextNoteTime += (60.0 / this.tempo);
                this.currentNoteIndex = (this.currentNoteIndex + 1) % this.notes.length;
            }
            this.interval = setTimeout(schedule, 50);
        };
        schedule();
    }
    playNote(freq, time) {
        if (!this.ctx) return;
        try {
            const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
            osc.type = 'triangle'; osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.4, time); // 배경음악 볼륨 대폭 상향
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.start(time); osc.stop(time + 0.2);
        } catch(e) {}
    }
    stop() { this.isPlaying = false; if (this.interval) clearTimeout(this.interval); this.interval = null; }
};
var BGM = new MusicGenerator();
