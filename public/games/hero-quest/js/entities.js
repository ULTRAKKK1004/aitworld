class Player extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'hero');
        scene.add.existing(this); scene.physics.add.existing(this);
        this.setCollideWorldBounds(true); this.body.onWorldBounds = true;
        this.setDragX(8000); this.setMaxVelocity(600, 1200);
        this.health = 5; this.maxHealth = 5; this.mp = 10; this.maxMaxMP = 10;
        this.isInvulnerable = false; this.isRainbow = false; this.isMega = false;
        this.isReversed = false; this.scoreMultiplier = 1;
        this.baseSpeed = 500; this.speed = 500; this.jumpForce = -750; this.jumps = 0; this.maxJumps = 2;
        this.body.setSize(24, 32); this.body.setOffset(8, 8);
    }
    preUpdate(time, delta) {
        super.preUpdate(time, delta);
        if (this.body.blocked.down || this.body.touching.down) { this.jumps = 0; }
        if (this.mp < this.maxMaxMP) this.mp += 0.05;
        if (this.isRainbow) { this.setTint(Phaser.Display.Color.RandomRGB().color); }
        else if (this.isMega) { this.setTint(0xffa500); }
        else if (this.isInvulnerable) { this.setTint(0xff0000); }
        else { this.clearTint(); }
    }
    doJump() {
        if (this.jumps < this.maxJumps) {
            this.setVelocityY(this.jumpForce); this.jumps++; AudioSystem.playJump(); return true;
        }
        return false;
    }
    shoot() {
        if (this.mp < 2) return; this.mp -= 2;
        const p = this.scene.projectiles.create(this.x, this.y, 'fireball');
        if (p) {
            p.body.setAllowGravity(false);
            if (this.isMega) { p.setScale(2.5); p.setTint(0xff0000); p.setVelocityX(this.flipX ? -1200 : 1200); } 
            else { p.setVelocityX(this.flipX ? -850 : 850); }
            this.scene.time.delayedCall(1500, () => { if (p.active) p.destroy(); });
            AudioSystem.playHit();
        }
    }
    takeDamage(amount) {
        if (this.isInvulnerable || this.isRainbow) return false;
        this.health -= amount; AudioSystem.playPlayerHit();
        if (this.health <= 0) return true;
        this.isInvulnerable = true;
        this.scene.time.delayedCall(1500, () => { if (this.active) this.isInvulnerable = false; });
        return false;
    }
    heal(amount) { this.health = Math.min(this.maxHealth, this.health + amount); AudioSystem.playPowerup(); }
    applyRainbow() { this.isRainbow = true; this.speed = this.baseSpeed * 1.6; this.scene.time.delayedCall(10000, () => { if (this.active) { this.isRainbow = false; this.speed = this.baseSpeed; BGM.start(this.scene.levelData.musicTheme); } }); }
    applyMega() { this.isMega = true; this.scene.time.delayedCall(10000, () => { if (this.active) this.isMega = false; }); }
}

class Enemy extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, key, damage, score) {
        super(scene, x, y, key);
        scene.add.existing(this); scene.physics.add.existing(this);
        this.damage = damage; this.scoreValue = score;
        this.setCollideWorldBounds(true); this.body.onWorldBounds = true;
    }
    preUpdate(time, delta) {
        super.preUpdate(time, delta);
        if (this.y > 550) { this.scene.respawnEnemy(this); this.destroy(); }
    }
}

class PatrolEnemy extends Enemy {
    constructor(scene, x, y, lv) { super(scene, x, y, `enemy${lv}`, lv, lv * 100); this.speed = 130 + lv * 20; this.direction = 1; this.setVelocityX(this.speed); }
    preUpdate(time, delta) {
        super.preUpdate(time, delta);
        if (!this.active || !this.scene.player) return;
        const dist = Math.abs(this.scene.player.x - this.x);
        if (dist < 220) { this.setVelocityX(Math.cos(time / 180) * 250); }
        else { if (this.body.blocked.left) this.direction = 1; else if (this.body.blocked.right) this.direction = -1; this.setVelocityX(this.direction * this.speed); }
        this.setFlipX(this.body.velocity.x > 0);
    }
}

class MissileEnemy extends Enemy {
    constructor(scene, x, y) { super(scene, x, y, 'enemy3', 2, 350); scene.time.addEvent({ delay: 3000, callback: this.fire, callbackScope: this, loop: true }); }
    fire() { if (!this.active || !this.scene.player) return; const m = this.scene.enemyProjectiles.create(this.x, this.y, 'missile'); if (m) { m.body.setAllowGravity(false); this.scene.physics.moveToObject(m, this.scene.player, 250); m.setRotation(Phaser.Math.Angle.Between(this.x, this.y, this.scene.player.x, this.scene.player.y)); AudioSystem.playHit(); } }
}

class Boss extends Enemy {
    constructor(scene, x, y, key, hp, name) {
        super(scene, x, y, key, 3, hp * 250);
        this.hp = hp; this.maxHp = hp; this.bossName = name;
        this.setScale(1); 
        this.setOrigin(0.5, 0.8);
        this.scene.physics.add.existing(this);
        this.body.setImmovable(true);
        this.body.setAllowGravity(true);
        this.refreshBody();
        this.body.setSize(100, 100);
        this.body.setOffset(10, 10);
        
        // HP Bar Graphics
        this.hpBar = this.scene.add.graphics();
        this.updateHpBar();

        this.stateTimer = 0; this.currentState = 'idle'; this.isEnraged = false; this.isStunned = false;
        AudioSystem.playBossSpawn();
    }
    updateHpBar() {
        this.hpBar.clear();
        const width = 120; const height = 12;
        const x = this.x - width/2; const y = this.y - 140;
        // Background
        this.hpBar.fillStyle(0x000000, 0.7);
        this.hpBar.fillRect(x, y, width, height);
        // Fill
        const per = Math.max(0, this.hp / this.maxHp);
        const color = per > 0.5 ? 0x00ff00 : (per > 0.2 ? 0xffff00 : 0xff0000);
        this.hpBar.fillStyle(color, 1);
        this.hpBar.fillRect(x + 2, y + 2, (width - 4) * per, height - 4);
    }
    preUpdate(time, delta) {
        super.preUpdate(time, delta);
        if (!this.active || !this.scene.player) return;
        this.updateHpBar();
        if (this.isStunned) return;
        if (this.hp < this.maxHp * 0.35 && !this.isEnraged) { this.isEnraged = true; this.scene.showMessage("BOSS ENRAGED!"); }
        this.stateTimer += delta;
        const limit = this.isEnraged ? 700 : 1500;
        if (this.stateTimer > limit) {
            this.stateTimer = 0; const r = Math.random();
            this.currentState = r < 0.2 ? 'charge' : (r < 0.4 ? 'jump' : (r < 0.6 ? 'burst' : (r < 0.8 ? 'homing' : 'mines')));
        }
        if (this.currentState === 'charge') { this.setVelocityX((this.scene.player.x < this.x ? -1 : 1) * (this.isEnraged ? 800 : 500)); }
        else if (this.currentState === 'jump' && this.body.blocked.down) { this.setVelocityY(-1100); this.currentState = 'idle'; }
        else if (this.currentState === 'burst' && time % 300 < 30) this.burst();
        else if (this.currentState === 'homing' && time % 800 < 30) this.homing();
        else if (this.currentState === 'mines' && time % 1200 < 30) this.mine();
        this.setFlipX(this.body.velocity.x > 0);
    }
    burst() { for(let a=0; a<360; a+=30) { const p = this.scene.enemyProjectiles.create(this.x, this.y, 'fireball'); if(p){ p.setTint(0x00ffff); p.setScale(1.5); p.body.setAllowGravity(false); p.setVelocity(Math.cos(a*Math.PI/180)*400, Math.sin(a*Math.PI/180)*400); } } }
    homing() { const p = this.scene.enemyProjectiles.create(this.x, this.y, 'missile'); if(p){ p.setTint(0xff00ff); p.setScale(1.5); p.body.setAllowGravity(false); this.scene.physics.moveToObject(p, this.scene.player, 320); this.scene.time.addEvent({ delay: 100, repeat: 30, callback: () => { if(p.active && this.scene.player) this.scene.physics.moveToObject(p, this.scene.player, 320); }}); } }
    mine() { const m = this.scene.enemyProjectiles.create(this.x, this.y, 'mine'); if(m){ m.setScale(1.5); m.body.setBounce(0.8); m.setVelocity(Phaser.Math.Between(-400, 400), -500); } }
    takeDamage(amount, isStomp) {
        if (this.isStunned) return;
        const dmg = isStomp ? amount * 10 : amount * 2; 
        this.hp -= dmg; this.setTint(0xffffff);
        this.updateHpBar();
        if (isStomp) { this.isStunned = true; this.setVelocityX(0); this.scene.showMessage("STUNNED!"); this.scene.time.delayedCall(800, () => { if (this.active) this.isStunned = false; }); }
        else { this.scene.time.delayedCall(100, () => { if (this.active) this.clearTint(); }); }
        if (this.hp <= 0) { 
            this.hpBar.destroy();
            this.scene.unlockDoors(); 
            this.scene.addScore(this.scoreValue); 
            AudioSystem.playWin(); 
            this.scene.showMessage("BOSS DEFEATED! GATE OPENED!");
            this.destroy(); 
        }
    }
}

class Boss1 extends Boss { constructor(scene, x, y) { super(scene, x, y, 'boss1', 300, "Beast"); } }
class Boss2 extends Boss { constructor(scene, x, y) { super(scene, x, y, 'boss2', 500, "Giant"); } }
class Boss3 extends Boss { constructor(scene, x, y) { super(scene, x, y, 'boss3', 800, "Worm"); } }
class MidBoss extends Boss { constructor(scene, x, y) { super(scene, x, y, 'boss_mid', 1200, "Knight"); } }
class FinalBoss extends Boss { constructor(scene, x, y) { super(scene, x, y, 'boss_final', 2500, "Lord"); } }

class ItemBox extends Phaser.Physics.Arcade.Sprite { constructor(scene, x, y) { super(scene, x, y, 'item_box'); scene.add.existing(this); scene.physics.add.existing(this, true); this.isEmpty = false; } hit() { if (this.isEmpty) return; this.isEmpty = true; this.setTint(0x555555); this.scene.spawnRandomItem(this.x, this.y - 32); } }
class Brick extends Phaser.Physics.Arcade.Sprite { constructor(scene, x, y) { super(scene, x, y, 'brick'); scene.add.existing(this); scene.physics.add.existing(this, true); } hit() { AudioSystem.playBreakBrick(); this.scene.addScore(50); this.destroy(); } }
class Chest extends Phaser.Physics.Arcade.Sprite { constructor(scene, x, y) { super(scene, x, y, 'chest'); scene.add.existing(this); scene.physics.add.existing(this, true); this.isOpen = false; } open() { if (this.isOpen) return; this.isOpen = true; this.setTexture('chest_open'); this.scene.spawnRandomItem(this.x, this.y - 40); } }
class Door extends Phaser.Physics.Arcade.Sprite { constructor(scene, x, y) { super(scene, x, y, 'door'); scene.add.existing(this); scene.physics.add.existing(this, true); } }
class ChaserEnemy extends Enemy { constructor(scene, x, y) { super(scene, x, y, 'enemy2', 2, 350); this.speed = 260; } preUpdate(time, delta) { super.preUpdate(time, delta); if (!this.active || !this.scene.player) return; if (Math.abs(this.scene.player.x - this.x) < 500) this.setVelocityX((this.scene.player.x < this.x ? -1 : 1) * this.speed); else this.setVelocityX(0); this.setFlipX(this.body.velocity.x > 0); } }
class CloudEnemy extends Enemy { constructor(scene, x, y) { super(scene, x, y, 'cloud', 1, 200); this.body.setAllowGravity(false); scene.time.addEvent({ delay: 2000, callback: this.dropSpike, callbackScope: this, loop: true }); } preUpdate(time, delta) { super.preUpdate(time, delta); if (!this.active || !this.scene.player) return; this.x += (this.scene.player.x - this.x) * 0.04; this.y += (this.scene.player.y - 220 - this.y) * 0.04; } dropSpike() { if (!this.active || !this.scene.player) return; const s = this.scene.enemyProjectiles.create(this.x, this.y + 20, 'fireball'); if (s) s.body.setAllowGravity(true); AudioSystem.playHit(); } }
class SunEnemy extends Enemy { constructor(scene, x, y) { super(scene, x, y, 'sun', 2, 450); this.body.setAllowGravity(false); this.startY = y; } preUpdate(time, delta) { super.preUpdate(time, delta); if (!this.active || !this.scene.player) return; this.x += Math.cos(time / 400) * 6; this.y = this.startY + Math.sin(time / 400) * 200; } }

class Item extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, key, type) { super(scene, x, y, key); scene.add.existing(this); scene.physics.add.existing(this); this.itemType = type; this.setBounce(0.6); this.setVelocity(Phaser.Math.Between(-150, 150), -400); }
    collect(p) {
        let msg = "";
        switch(this.itemType) {
            case 'health': p.heal(1); msg = "HP+1"; break;
            case 'invincible': p.applyRainbow(); BGM.start('invincible'); msg = "INVINCIBLE!"; break;
            case 'score': let pts = Phaser.Math.Between(500, 5000); this.scene.addScore(pts); msg = `+${pts}`; break;
            case 'life': GameState.playerLives++; msg = "LIFE+1"; break;
            case 'reverse': p.isReversed = true; this.scene.time.delayedCall(5000, () => { if(p.active) p.isReversed = false; }); msg = "REVERSED!"; break;
            case 'double': p.scoreMultiplier = 2; this.scene.time.delayedCall(10000, () => { if(p.active) p.scoreMultiplier = 1; }); msg = "X2 SCORE!"; break;
            case 'mega': p.applyMega(); msg = "MEGA SHOT!"; break;
        }
        this.scene.showMessage(msg); AudioSystem.playPowerup(); this.destroy();
    }
}
