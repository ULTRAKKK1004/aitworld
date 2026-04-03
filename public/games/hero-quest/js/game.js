var multiTouchInitialized = false;
var GameState = { currentStage: 1, playerHP: 5, playerMaxHP: 5, playerLives: 3, score: 0, playerSpeed: 350 };

class BootScene extends Phaser.Scene {
    constructor() { super('BootScene'); }
    create() {
        this.add.text(this.cameras.main.centerX, this.cameras.main.centerY, 'Loading Core Engines...', { fontSize: '24px', fill: '#fff' }).setOrigin(0.5);
        this.time.delayedCall(100, () => {
            try {
                AssetGenerator.generateAll(this);
                if (this.input.maxPointers < 4) this.input.addPointer(3);
                multiTouchInitialized = true;
                this.scene.start('MenuScene');
            } catch(e) { console.error("Boot Error:", e); this.scene.start('MenuScene'); }
        });
    }
}

class MenuScene extends Phaser.Scene {
    constructor() { super('MenuScene'); }
    create() {
        const resumeAudio = () => { let ctx = getAudioContext(); if (ctx && ctx.state === 'suspended') ctx.resume(); };
        this.input.once('pointerdown', resumeAudio);
        this.cameras.main.setBackgroundColor('#87CEEB');
        this.add.rectangle(0, 300, 800, 200, 0x228B22).setOrigin(0, 0);
        this.add.text(this.cameras.main.centerX, 100, "SUPER HERO QUEST DX", { fontSize: '56px', fill: '#FFD700', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5);
        const startBtn = this.add.text(this.cameras.main.centerX, 300, "[ START GAME ]", { fontSize: '36px', fill: '#0f0', stroke: '#000', strokeThickness: 4 })
            .setOrigin(0.5).setInteractive().on('pointerup', () => {
                resumeAudio(); GameState.currentStage = 1; GameState.score = 0; GameState.playerHP = 5; GameState.playerLives = 3;
                fetch('/api/increment-attempts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game: 'hero' }) }).catch(() => {});
                this.scene.start('GameScene');
            });
        this.tweens.add({ targets: startBtn, scaleX: 1.1, scaleY: 1.1, duration: 500, yoyo: true, loop: -1 });
    }
}

class GameScene extends Phaser.Scene {
    constructor() { super('GameScene'); }
    create() {
        this.isDying = false; this.isTransitioning = false;
        this.levelData = LevelData[GameState.currentStage - 1];
        if (!this.levelData) { this.scene.start('VictoryScene'); return; }
        this.cameras.main.setBackgroundColor(this.levelData.bgColor);
        try { BGM.start(this.levelData.musicTheme); } catch(e) {}
        
        this.platforms = this.physics.add.staticGroup();
        this.bricks = this.physics.add.staticGroup();
        this.itemBoxes = this.physics.add.staticGroup();
        this.enemies = this.physics.add.group();
        this.flyingEnemies = this.physics.add.group();
        this.chests = this.physics.add.group();
        this.items = this.physics.add.group();
        this.exits = this.physics.add.staticGroup();
        this.doors = this.physics.add.staticGroup();
        this.projectiles = this.physics.add.group(); 
        this.enemyProjectiles = this.physics.add.group();
        
        this.boss = null; this.player = null; this.princess = null; this.timeLimit = 400;

        this.createParallaxBackground();
        this.buildLevel();
        if (!this.player) this.player = new Player(this, 100, 200);
        this.player.health = GameState.playerHP;

        const worldWidth = Math.max(800, this.levelData.layout[0].length * 32);
        this.physics.world.setBounds(0, 0, worldWidth, 480);
        this.physics.world.setBoundsCollision(true, true, true, false);

        this.physics.add.collider(this.player, this.platforms);
        this.physics.add.collider(this.player, this.bricks, (p, b) => { if (p.body.touching.up) b.hit(); });
        this.physics.add.collider(this.player, this.itemBoxes, (p, b) => { if (p.body.touching.up) b.hit(); });
        this.physics.add.collider(this.enemies, this.platforms);
        this.physics.add.collider(this.items, this.platforms);
        this.physics.add.collider(this.projectiles, this.platforms, (p) => p.destroy());
        this.physics.add.collider(this.enemyProjectiles, this.platforms, (p) => p.destroy());
        this.physics.add.collider(this.player, this.doors);

        this.physics.add.overlap(this.player, this.enemies, this.hitEnemy, null, this);
        this.physics.add.overlap(this.player, this.flyingEnemies, this.hitEnemy, null, this);
        this.physics.add.overlap(this.player, this.enemyProjectiles, this.hitProjectile, null, this);
        this.physics.add.overlap(this.player, this.chests, (p, c) => c.open(), null, this);
        this.physics.add.overlap(this.player, this.items, (p, i) => i.collect(p), null, this);
        this.physics.add.overlap(this.player, this.exits, this.reachExit, null, this);
        if (this.princess) this.physics.add.overlap(this.player, this.princess, () => this.winGame(), null, this);
        
        this.physics.add.overlap(this.projectiles, this.enemies, (proj, enemy) => {
            if (enemy instanceof Boss) { enemy.takeDamage(1, false); }
            else { this.addScore(enemy.scoreValue); enemy.destroy(); }
            if (!this.player.isMega) proj.destroy();
        });

        this.cameras.main.setBounds(0, 0, worldWidth, 480);
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        
        this.cursors = this.input.keyboard.createCursorKeys();
        this.fireKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
        this.setupUI(); this.setupMobileControls();
        this.timeLimitTimer = this.time.addEvent({ delay: 1000, loop: true, callback: () => { this.timeLimit--; this.updateHUD(); if (this.timeLimit <= 0) this.die(); } });
        
        // 간헐적 구름 괴물 스폰 루프
        this.scheduleCloudMonster();

        // 보스 스테이지일 경우 주기적으로 일반 적들 스폰
        if (this.levelData.name.includes("BOSS")) {
            this.time.addEvent({
                delay: 3000,
                callback: this.spawnBossStageMinions,
                callbackScope: this,
                loop: true
            });
        }
    }

    scheduleCloudMonster() {
        if (this.isDying) return;
        this.time.delayedCall(Phaser.Math.Between(5000, 15000), () => {
            if (!this.isDying) {
                this.spawnCloudMonster();
                this.scheduleCloudMonster();
            }
        });
    }

    spawnCloudMonster() {
        if (this.isDying || !this.player) return;
        const rx = this.player.x + (Math.random() < 0.5 ? -600 : 600);
        const ry = 100;
        this.flyingEnemies.add(new CloudEnemy(this, rx, ry));
    }

    spawnBossStageMinions() {
        if (this.isDying || !this.player || !this.boss || !this.boss.active) return;
        if (this.enemies.countActive(true) > 20) return;

        const rx = this.player.x + (Math.random() < 0.5 ? -500 : 500);
        const ry = 100;
        
        // 지금까지 등장한 모든 적들 중 랜덤 스폰
        const enemyTypes = [1, 2, 3, 'M', 'F', 'U'];
        const type = enemyTypes[Phaser.Math.Between(0, Math.min(enemyTypes.length - 1, GameState.currentStage))];
        
        let newEnemy;
        if (type === 1 || type === 2 || type === 3) newEnemy = new PatrolEnemy(this, rx, ry, type);
        else if (type === 'M') newEnemy = new MissileEnemy(this, rx, ry);
        else if (type === 'F') newEnemy = new ChaserEnemy(this, rx, ry);
        else if (type === 'U') newEnemy = new SunEnemy(this, rx, ry);
        
        if (newEnemy) {
            if (type === 'U') this.flyingEnemies.add(newEnemy);
            else this.enemies.add(newEnemy);
        }
    }

    createParallaxBackground() {
        const width = this.levelData.layout[0].length * 32;
        for(let i=0; i<width; i+=400) {
            let cloud = this.add.graphics({x: i, y: Phaser.Math.Between(50, 150)});
            cloud.fillStyle(0xffffff, 0.5); cloud.fillCircle(0, 0, 30); cloud.fillCircle(20, -10, 40); cloud.setScrollFactor(0.2);
            let mountain = this.add.graphics({x: i + 200, y: 480});
            mountain.fillStyle(0x228B22, 0.4); mountain.fillTriangle(-150, 0, 0, -200, 150, 0); mountain.setScrollFactor(0.5);
        }
    }

    buildLevel() {
        const lines = this.levelData.layout; const ts = 32;
        for (let y = 0; y < lines.length; y++) {
            for (let x = 0; x < lines[y].length; x++) {
                const char = lines[y][x]; const px = x * ts + 16; const py = y * ts + 16;
                if (char === '#') this.platforms.create(px, py, this.levelData.groundTile);
                else if (char === '-') this.platforms.create(px, py, 'platform');
                else if (char === 'B') this.bricks.add(new Brick(this, px, py));
                else if (char === '?') this.itemBoxes.add(new ItemBox(this, px, py));
                else if (char === '1') this.enemies.add(new PatrolEnemy(this, px, py, 1));
                else if (char === '2') this.enemies.add(new PatrolEnemy(this, px, py, 2));
                else if (char === '3') this.enemies.add(new PatrolEnemy(this, px, py, 3));
                else if (char === 'M') this.enemies.add(new MissileEnemy(this, px, py));
                else if (char === 'F') this.enemies.add(new ChaserEnemy(this, px, py));
                else if (char === 'W') this.flyingEnemies.add(new CloudEnemy(this, px, py));
                else if (char === 'U') this.flyingEnemies.add(new SunEnemy(this, px, py));
                else if (char === 'C') this.chests.add(new Chest(this, px, py));
                else if (char === 'D') this.doors.add(new Door(this, px, py));
                else if (char === 'E') this.exits.add(this.physics.add.staticSprite(px, py - 30, 'door'));
                else if (char === 'P') this.princess = this.physics.add.staticSprite(px, py, 'princess');
                else if (char === '@') this.player = new Player(this, px, py);
                else if (['4','5','6','7','8'].includes(char)) {
                    let b = null;
                    if (char === '4') b = new Boss1(this, px, py);
                    else if (char === '5') b = new Boss2(this, px, py);
                    else if (char === '6') b = new Boss3(this, px, py);
                    else if (char === '7') b = new MidBoss(this, px, py);
                    else if (char === '8') b = new FinalBoss(this, px, py);
                    if (b) { this.enemies.add(b); this.boss = b; }
                    for(let i=-2; i<=2; i++) { if (i !== 0) { 
                        this.itemBoxes.add(new ItemBox(this, px + i*150, py - 150)); 
                    } }
                }
            }
        }
    }

    respawnEnemy(oldEnemy) {
        if (this.enemies.countActive(true) > 15) return;
        this.time.delayedCall(3000, () => {
            if (!this.isDying && this.player) {
                const rx = this.player.x + (Math.random() < 0.5 ? -500 : 500);
                const ry = 100;
                
                const enemyTypes = [1, 2, 3, 'M', 'F', 'U'];
                const maxIndex = Math.min(enemyTypes.length - 1, Math.floor(GameState.currentStage / 1.5));
                const type = enemyTypes[Phaser.Math.Between(0, maxIndex)];
                
                let newEnemy;
                if (typeof type === 'number') newEnemy = new PatrolEnemy(this, rx, ry, type);
                else if (type === 'M') newEnemy = new MissileEnemy(this, rx, ry);
                else if (type === 'F') newEnemy = new ChaserEnemy(this, rx, ry);
                else if (type === 'U') newEnemy = new SunEnemy(this, rx, ry);
                
                if (newEnemy) {
                    if (type === 'U') this.flyingEnemies.add(newEnemy);
                    else this.enemies.add(newEnemy);
                }
            }
        });
    }

    spawnRandomItem(x, y) {
        const types = ['health', 'invincible', 'score', 'life', 'reverse', 'double', 'mega'];
        const type = types[Phaser.Math.Between(0, types.length-1)];
        this.items.add(new Item(this, x, y, 'item_' + type, type));
    }

    addScore(pts) { GameState.score += pts * (this.player ? this.player.scoreMultiplier : 1); this.updateHUD(); }
    setupUI() { this.hudText = this.add.text(10, 10, '', { fontSize: '18px', fill: '#fff', stroke: '#000', strokeThickness: 4 }).setScrollFactor(0).setDepth(100); this.updateHUD(); }
    updateHUD() { if (this.player) this.hudText.setText(`HP:${this.player.health} | MP:${Math.floor(this.player.mp)} | LIVES:${GameState.playerLives} | STAGE:${GameState.currentStage} | SCORE:${GameState.score}`); }
    showMessage(text) { let m = this.add.text(this.cameras.main.centerX, 150, text, { fontSize: '32px', fill: '#ff0', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5).setScrollFactor(0).setDepth(101); this.tweens.add({ targets: m, y: 100, alpha: 0, duration: 1500, onComplete: () => m.destroy() }); }

    setupMobileControls() {
        if (!this.sys.game.device.input.touch && !this.sys.game.device.input.mspointer) return;
        const cw = this.cameras.main.width; const ch = this.cameras.main.height;
        const createZone = (x, y, w, h, flag, label, color) => {
            let z = this.add.rectangle(x, y, w, h, color, 0.2).setScrollFactor(0).setDepth(90).setInteractive();
            this.add.text(x, y, label, {fontSize:'32px', fill:'#fff', stroke:'#000', strokeThickness:4}).setOrigin(0.5).setScrollFactor(0).setDepth(91);
            z.on('pointerdown', () => this[flag] = true); z.on('pointerup', () => this[flag] = false); z.on('pointerout', () => this[flag] = false);
        };
        createZone(80, ch * 0.9 - 80, 140, 140, 'btnLeft', '◀', 0xffffff); createZone(240, ch * 0.9 - 80, 140, 140, 'btnRight', '▶', 0xffffff);
        createZone(cw - 240, ch * 0.9 - 80, 140, 140, 'btnFire', 'A', 0xff0000); createZone(cw - 80, ch * 0.9 - 80, 140, 140, 'btnJump', 'B', 0x00ff00);
    }

    update() {
        if (!this.player || !this.player.active || this.isDying || this.isTransitioning) return;
        if (this.player.y > 480) { this.die(); return; }
        let moveX = 0; let L = this.cursors.left.isDown || this.btnLeft; let R = this.cursors.right.isDown || this.btnRight;
        if (this.player.isReversed) { let t = L; L = R; R = t; }
        if (L) { moveX = -this.player.speed * 20; this.player.setFlipX(true); } else if (R) { moveX = this.player.speed * 20; this.player.setFlipX(false); }
        this.player.setAccelerationX(moveX);
        if ((this.cursors.up.isDown || this.cursors.space.isDown || this.btnJump) && !this.jumpKeyPressed) { this.player.doJump(); this.jumpKeyPressed = true; }
        else if (!(this.cursors.up.isDown || this.cursors.space.isDown || this.btnJump)) this.jumpKeyPressed = false;
        if ((this.fireKey.isDown || this.btnFire) && !this.fireKeyPressed) { this.player.shoot(); this.fireKeyPressed = true; }
        else if (!(this.fireKey.isDown || this.btnFire)) this.fireKeyPressed = false;
    }

    hitBrick(p, b) { if (p.body.touching.up && b.body.touching.down) b.hit(); else if (p.body.touching.left || p.body.touching.right) if (Math.abs(p.body.velocity.x) > 100) AudioSystem.playWallBump(); }
    hitItemBox(p, b) { if (p.body.touching.up && b.body.touching.down) b.hit(); }
    hitEnemy(p, e) {
        if (!e || !e.active || this.isDying || this.isTransitioning) return;
        if (p.isRainbow) { this.addScore(e.scoreValue * 2); AudioSystem.playEnemyHit(); e.destroy(); return; }
        const isStomping = p.body.velocity.y > 0 && p.y < (e.y - 10);
        if (isStomping) {
            if (e instanceof Boss) { e.takeDamage(1, true); p.setVelocityY(-600); }
            else { this.addScore(e.scoreValue); AudioSystem.playEnemyHit(); e.destroy(); p.setVelocityY(-500); p.jumps = 1; }
        } else if (!p.isInvulnerable) if (p.takeDamage(e.damage || 1)) this.die();
    }
    hitProjectile(p, pr) { if (this.isDying || this.isTransitioning) return; pr.destroy(); if (p.takeDamage(1)) this.die(); }
    unlockDoors() { this.doors.getChildren().forEach(d => { this.tweens.add({ targets: d, alpha: 0.3, y: d.y - 64, duration: 1000 }); if (d.body) d.body.enable = false; }); }
    reachExit(p, e) { if (this.isTransitioning) return; if (this.boss && this.boss.active) { this.showMessage("Defeat the Boss!"); return; } this.isTransitioning = true; GameState.playerHP = this.player.health; this.addScore(this.timeLimit * 10); AudioSystem.playWin(); try { BGM.stop(); } catch(e) {} this.cameras.main.fade(1000, 0, 0, 0, false, (cam, pct) => { if (pct === 1) { GameState.currentStage++; this.scene.start('GameScene'); } }); }
    die() {
        if (this.isDying) return; this.isDying = true; GameState.playerLives--; GameState.playerHP = 5; 
        try { this.physics.world.pause(); if (this.player.body) this.physics.world.disable(this.player); BGM.stop(); AudioSystem.playDeath(); this.player.setTint(0xff0000); } catch(e) {}
        this.tweens.add({ targets: this.player, y: this.player.y - 120, duration: 450, ease: 'Cubic.easeOut', onComplete: () => { this.tweens.add({ targets: this.player, y: 650, duration: 700, ease: 'Cubic.easeIn', onComplete: () => { if (GameState.playerLives > 0) this.scene.restart(); else this.scene.start('GameOverScene'); } }); } });
    }
    winGame() { BGM.stop(); AudioSystem.playWin(); this.scene.start('VictoryScene'); }
}

class GameOverScene extends Phaser.Scene {
    constructor() { super('GameOverScene'); }
    create() {
        this.cameras.main.setBackgroundColor('#8b0000');
        this.add.text(this.cameras.main.centerX, 120, "GAME OVER", { fontSize: '64px', fill: '#fff', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5);
        this.add.text(this.cameras.main.centerX, 200, `FINAL SCORE: ${GameState.score}`, { fontSize: '32px', fill: '#ff0' }).setOrigin(0.5);
        this.add.text(this.cameras.main.centerX, 250, `STAGE: ${GameState.currentStage}`, { fontSize: '24px', fill: '#fff' }).setOrigin(0.5);
        console.log('[Hero-Quest] Submitting score:', GameState.score);
        fetch('/api/submit-score', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ score: GameState.score, gameType: 'hero', stage: GameState.currentStage }) 
        }).then(r => r.json()).then(d => {
            console.log('[Hero-Quest] Submit success:', d);
            const bestEl = document.getElementById('my-best-score');
            if (bestEl && GameState.score > parseInt(bestEl.innerText || '0')) {
                bestEl.innerText = GameState.score;
            }
        }).catch(e => console.error('[Hero-Quest] Submit failed:', e));
        
        const savedStage = GameState.currentStage;
        
        const continueBtn = this.add.text(this.cameras.main.centerX, 340, "[ CONTINUE FROM STAGE " + savedStage + " ]", { fontSize: '24px', fill: '#0ff' }).setOrigin(0.5).setInteractive().on('pointerup', () => {
            GameState.playerLives = 3;
            GameState.playerHP = 5;
            GameState.score = 0;
            this.scene.start('GameScene');
        });
        
        const menuBtn = this.add.text(this.cameras.main.centerX, 400, "[ BACK TO MENU ]", { fontSize: '24px', fill: '#0f0' }).setOrigin(0.5).setInteractive().on('pointerup', () => this.scene.start('MenuScene'));
    }
}

class VictoryScene extends Phaser.Scene {
    constructor() { super('VictoryScene'); }
    create() {
        this.cameras.main.setBackgroundColor('#006400');
        this.add.text(this.cameras.main.centerX, 150, "PRINCESS SAVED!", { fontSize: '48px', fill: '#FFD700', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5);
        this.add.text(this.cameras.main.centerX, 250, `ULTIMATE SCORE: ${GameState.score}`, { fontSize: '32px', fill: '#fff' }).setOrigin(0.5);
        console.log('[Hero-Quest] Submitting score:', GameState.score);
        fetch('/api/submit-score', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ score: GameState.score, gameType: 'hero', stage: GameState.currentStage }) 
        }).then(r => r.json()).then(d => {
            console.log('[Hero-Quest] Submit success:', d);
            const bestEl = document.getElementById('my-best-score');
            if (bestEl && GameState.score > parseInt(bestEl.innerText || '0')) {
                bestEl.innerText = GameState.score;
            }
        }).catch(e => console.error('[Hero-Quest] Submit failed:', e));
        this.add.text(this.cameras.main.centerX, 350, "[ PLAY AGAIN ]", { fontSize: '28px', fill: '#0f0' }).setOrigin(0.5).setInteractive().on('pointerup', () => this.scene.start('MenuScene'));
    }
}

const config = { type: Phaser.AUTO, width: 800, height: 480, parent: 'game-container', pixelArt: false, input: { activePointers: 4 }, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, physics: { default: 'arcade', arcade: { gravity: { y: 1400 }, debug: false } }, scene: [BootScene, MenuScene, GameScene, GameOverScene, VictoryScene] };
const game = new Phaser.Game(config);
game.events.on('ready', () => zzfxX = game.sound.context);
