var multiTouchInitialized = false;
var GameState = { 
    currentStage: 1, 
    playerHP: 5, 
    playerMaxHP: 5, 
    playerLives: 3, 
    score: 0, 
    playerSpeed: 500, 
    manaRegen: 0.05,
    maxJumps: 2,
    hasShield: 0,
    isMega: false, 
    isReversed: false, 
    scoreMultiplier: 1 
};

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
        console.log("MenuScene Created");
        const resumeAudio = () => { 
            let ctx = getAudioContext(); 
            if (ctx && ctx.state === 'suspended') {
                ctx.resume().catch(e => console.error("Audio Resume Error:", e));
            }
        };
        
        this.cameras.main.setBackgroundColor('#87CEEB');
        this.add.rectangle(0, 0, 800, 480, 0x87CEEB).setOrigin(0, 0).setDepth(0).setInteractive().on('pointerdown', () => resumeAudio());

        this.add.rectangle(0, 300, 800, 200, 0x228B22).setOrigin(0, 0).setDepth(1);
        this.add.text(this.cameras.main.centerX, 100, "SUPER HERO QUEST DX", { fontSize: '56px', fill: '#FFD700', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5).setDepth(2);
        
        const startBtn = this.add.text(this.cameras.main.centerX, 280, "[ START GAME ]", { fontSize: '36px', fill: '#0f0', stroke: '#000', strokeThickness: 4 })
            .setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(1000);

        const startGame = async () => {
            console.log("Starting Game...");
            resumeAudio();
            
            GameState.currentStage = 1; GameState.score = 0; GameState.playerLives = 3;
            GameState.isMega = false; GameState.isReversed = false; GameState.scoreMultiplier = 1;
            GameState.items = { hero_revive: 0, hero_mana_potion: 0 }; // Initialize with 0

            this.scene.start('GameScene');

            // Fetch user stats and items
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 1500);
                const res = await fetch('/api/hero/load', { signal: controller.signal });
                clearTimeout(timeoutId);
                const data = await res.json();
                if (data.success) {
                    const stats = data.stats;
                    GameState.playerMaxHP = stats.hero_hp || 5;
                    GameState.playerHP = GameState.playerMaxHP;
                    GameState.manaRegen = stats.hero_mana_regen || 0.05;
                    GameState.playerSpeed = stats.hero_speed || 500;
                    GameState.maxJumps = stats.hero_max_jumps || 2;
                    GameState.hasShield = stats.hero_shield || 0;

                    if (data.items) {
                        data.items.forEach(item => {
                            GameState.items[item.item_key] = item.quantity;
                        });
                    }
                }
            } catch (e) { console.warn("Background data load failed:", e); }
            
            fetch('/api/increment-attempts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game: 'hero' }) }).catch(() => {});
        };

        startBtn.on('pointerdown', startGame);
        
        this.tweens.add({ targets: startBtn, scaleX: 1.1, scaleY: 1.1, duration: 500, yoyo: true, loop: -1 });

        const backBtn = this.add.text(this.cameras.main.centerX, 380, "[ BACK TO DASHBOARD ]", { fontSize: '24px', fill: '#fff', stroke: '#000', strokeThickness: 3 })
            .setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(1000);
            
        backBtn.on('pointerdown', () => {
            console.log("Back Button Clicked");
            window.location.href = '/dashboard';
        });
    }
}

class GameScene extends Phaser.Scene {
    constructor() { super('GameScene'); }
    init(data) {
        this.bonusLevelData = data ? data.bonus : null;
        // Ensure audio context is resumed
        let ctx = getAudioContext();
        if (ctx && ctx.state === 'suspended') ctx.resume();
    }
    create() {
        this.isDying = false; this.isTransitioning = false;
        this.cameras.main.resetFX(); 
        
        if (this.bonusLevelData) {
            this.levelData = this.bonusLevelData;
            this.timeLimit = 15; // 15s limit for bonus
        } else {
            this.levelData = LevelGenerator.generate(GameState.currentStage);
            this.timeLimit = 100;
        }
        
        if (GameState.currentStage > 100) { this.scene.start('VictoryScene'); return; }
        
        const bgColor = this.levelData.bgColor || '#87CEEB';
        this.cameras.main.setBackgroundColor(bgColor);
        try { BGM.start(this.levelData.musicTheme || 'grass'); } catch(e) {}
        
        this.platforms = this.physics.add.staticGroup();
        this.bricks = this.physics.add.staticGroup();
        this.itemBoxes = this.physics.add.staticGroup();
        this.enemies = this.physics.add.group();
        this.flyingEnemies = this.physics.add.group();
        this.chests = this.physics.add.group();
        this.items = this.physics.add.group();
        this.exits = this.physics.add.staticGroup();
        this.doors = this.physics.add.staticGroup();
        this.bonusEntrances = this.physics.add.staticGroup();
        this.projectiles = this.physics.add.group(); 
        this.enemyProjectiles = this.physics.add.group();
        
        this.boss = null; this.player = null; this.princess = null;

        this.createParallaxBackground();
        this.buildLevel();
        
        // Handle returning to original place from bonus
        if (!this.player) {
            const startX = (GameState.returnPos && !this.levelData.isBonus) ? GameState.returnPos.x : 100;
            const startY = (GameState.returnPos && !this.levelData.isBonus) ? GameState.returnPos.y : 200;
            this.player = new Player(this, startX, startY);
            GameState.returnPos = null; // Clear
        }
        this.player.health = GameState.playerHP;

        const worldWidth = Math.max(800, this.levelData.layout[0].length * 32);
        this.physics.world.setBounds(0, 0, worldWidth, 480);
        this.physics.world.setBoundsCollision(true, true, true, false);

        this.physics.add.collider(this.player, this.platforms);
        this.physics.add.collider(this.player, this.bricks, (p, b) => { 
            if (b.body.touching.down || (p.y > b.y && Math.abs(p.x - b.x) < 40)) {
                this.tweens.add({ targets: b, scaleX: 1.2, scaleY: 1.2, duration: 50, yoyo: true });
                b.hit(); 
            }
        });
        this.physics.add.collider(this.player, this.itemBoxes, (p, b) => { 
            if (b.body.touching.down || (p.y > b.y && Math.abs(p.x - b.x) < 40)) {
                this.tweens.add({ targets: b, scaleX: 1.2, scaleY: 1.2, duration: 50, yoyo: true });
                b.hit(); 
            }
        });
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
        this.physics.add.overlap(this.player, this.bonusEntrances, this.enterBonus, null, this);
        if (this.princess) this.physics.add.overlap(this.player, this.princess, () => this.winGame(), null, this);
        
        this.physics.add.overlap(this.projectiles, this.enemies, (proj, enemy) => {
            if (enemy.takeDamage) {
                const isDead = enemy.takeDamage(this.player.isMega ? 3 : 1);
                if (isDead && !(enemy instanceof Boss)) this.addScore(enemy.scoreValue);
            } else {
                enemy.destroy();
            }
            if (!this.player.isMega) proj.destroy();
        });

        this.physics.add.overlap(this.projectiles, this.flyingEnemies, (proj, enemy) => {
            if (enemy.takeDamage) {
                const isDead = enemy.takeDamage(this.player.isMega ? 3 : 1);
                if (isDead) this.addScore(enemy.scoreValue);
            } else {
                enemy.destroy();
            }
            if (!this.player.isMega) proj.destroy();
        });

        this.cameras.main.setBounds(0, 0, worldWidth, 480);
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        
        this.cursors = this.input.keyboard.createCursorKeys();
        this.fireKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
        this.setupUI(); this.setupMobileControls();
        this.timeLimitTimer = this.time.addEvent({ delay: 1000, loop: true, callback: () => { 
            this.timeLimit--; 
            this.updateHUD(); 
            if (this.timeLimit <= 0) {
                this.showMessage("TIME UP!");
                this.die(); 
            } 
        } });
        
        this.scheduleCloudMonster();

        if (this.levelData.name && this.levelData.name.includes("BOSS")) {
            this.showMessage("BOSS FIGHT! STOMP ON HEAD!");
            this.time.addEvent({ delay: 3000, callback: this.spawnBossStageMinions, callbackScope: this, loop: true });
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
        if (this.enemies.countActive(true) > 10) return;
        const rx = this.player.x + (Math.random() < 0.5 ? -500 : 500);
        const ry = 100;
        const enemyTypes = ['1', '2', '3', 'S', 'b'];
        const type = enemyTypes[Phaser.Math.Between(0, enemyTypes.length - 1)];
        let newEnemy;
        if (['1', '2', '3'].includes(type)) newEnemy = new PatrolEnemy(this, rx, ry, parseInt(type));
        else if (type === 'S') newEnemy = new SlimeEnemy(this, rx, ry);
        else if (type === 'b') newEnemy = new BatEnemy(this, rx, ry);
        if (newEnemy) {
            if (type === 'b') this.flyingEnemies.add(newEnemy);
            else this.enemies.add(newEnemy);
        }
    }

    createParallaxBackground() {
        if (!this.levelData || !this.levelData.layout || !this.levelData.layout[0]) return;
        const width = this.levelData.layout[0].length * 32;
        let theme = "Grasslands"; 
        
        if (this.levelData.name) {
            theme = this.levelData.name.split(' - ')[0] || "Grasslands";
        }
        
        if (theme === "Sky Heaven") theme = "Sky Palace";
        if (theme.startsWith("BOSS BATTLE")) theme = "Deep Caves";

        for(let i=0; i<width; i+=300) {
            if (theme === "Grasslands" || theme === "Ancient Forest" || theme === "Sky Palace") {
                let cloud = this.add.graphics({x: i + Math.random() * 100, y: Phaser.Math.Between(50, 150)});
                cloud.fillStyle(0xffffff, 0.4); 
                cloud.fillCircle(0, 0, 30); cloud.fillCircle(20, -10, 40); cloud.fillCircle(40, 0, 30);
                cloud.setScrollFactor(0.1);
            } else if (theme === "Scorched Desert") {
                let sun = this.add.graphics().setPosition(i + 150, 80);
                sun.fillStyle(0xFFD700, 0.2);
                sun.fillCircle(0, 0, 60);
                sun.fillStyle(0xFF8C00, 0.4);
                sun.fillCircle(0, 0, 40);
                sun.setScrollFactor(0.05);
            } else if (theme === "Volcanic Pit" || theme === "Deep Caves" || theme === "Frozen Tundra") {
                let smoke = this.add.graphics({x: i + Math.random() * 100, y: Phaser.Math.Between(50, 200)});
                smoke.fillStyle(theme === "Deep Caves" ? 0x000000 : (theme === "Frozen Tundra" ? 0xffffff : 0x333333), 0.3); 
                smoke.fillCircle(0, 0, 40); smoke.fillCircle(20, 20, 30);
                smoke.setScrollFactor(0.15);
            }

            let midG = this.add.graphics().setPosition(i + 150, 480);
            if (theme === "Grasslands") midG.fillStyle(0x228B22, 0.4).fillTriangle(-150, 0, 0, -200, 150, 0);
            else if (theme === "Scorched Desert") {
                midG.fillStyle(0xD2B48C, 0.5);
                midG.beginPath();
                midG.moveTo(-200, 0);
                midG.quadraticCurveTo(0, -100, 200, 0);
                midG.closePath();
                midG.fillPath();
            }
            else if (theme === "Frozen Tundra") { midG.fillStyle(0xFFFFFF, 0.6).fillTriangle(-100, 0, 0, -250, 100, 0); midG.fillStyle(0xE0FFFF, 0.4).fillTriangle(-150, 0, 0, -180, 150, 0); }
            else if (theme === "Volcanic Pit") { midG.fillStyle(0x4B0000, 0.6).fillTriangle(-120, 0, 0, -150, 120, 0); midG.fillStyle(0xFF4500, 0.3).fillTriangle(-60, 0, 0, -80, 60, 0); }
            else if (theme === "Ancient Forest") { midG.fillStyle(0x004400, 0.5); for(let j=0; j<3; j++) { midG.fillRect(-20 + j*10, -150, 15, 150); midG.fillCircle(j*10, -150, 40); } }
            else if (theme === "Sky Palace") { midG.fillStyle(0xFFFFFF, 0.7).fillEllipse(0, -100, 100, 40); midG.fillStyle(0xADD8E6, 0.5).fillEllipse(50, -120, 80, 30); }
            else if (theme === "Deep Caves") { midG.fillStyle(0x1a1a1a, 0.8).fillTriangle(-60, 0, 0, -120, 60, 0); let stalG = this.add.graphics({x: i + 250, y: 0}).fillStyle(0x111111, 0.8).fillTriangle(-40, 0, 0, 100, 40, 0).setScrollFactor(0.4); }
            midG.setScrollFactor(0.4);
        }
    }

    buildLevel() {
        if (!this.levelData || !this.levelData.layout) return;
        const lines = this.levelData.layout; const ts = 32;
        for (let y = 0; y < lines.length; y++) {
            if (!lines[y]) continue;
            for (let x = 0; x < lines[y].length; x++) {
                const char = lines[y][x]; const px = x * ts + 16; 
                // Platforms/Tiles use center origin (+16)
                if (char === '#') this.platforms.create(px, y * ts + 16, this.levelData.groundTile || 'ground_grass');
                else if (char === '-') this.platforms.create(px, y * ts + 16, 'platform');
                
                // Entities use bottom origin (+32)
                const py = (y + 1) * ts;
                if (char === 'B') this.bricks.add(new Brick(this, px, py - 16)); // Bricks are tiles, use center
                else if (char === '?') this.itemBoxes.add(new ItemBox(this, px, py - 16));
                else if (char === '1' || char === '2' || char === '3') this.enemies.add(new PatrolEnemy(this, px, py, parseInt(char)));
                else if (char === 'M') this.enemies.add(new MissileEnemy(this, px, py));
                else if (char === 'F') this.enemies.add(new ChaserEnemy(this, px, py));
                else if (char === 'W') this.flyingEnemies.add(new CloudEnemy(this, px, py - 16));
                else if (char === 'U') this.flyingEnemies.add(new SunEnemy(this, px, py - 16));
                else if (char === 'S') this.enemies.add(new SlimeEnemy(this, px, py));
                else if (char === 'b') this.flyingEnemies.add(new BatEnemy(this, px, py - 16));
                else if (char === 'v') this.flyingEnemies.add(new BirdEnemy(this, px, py - 16));
                else if (char === 'g') this.enemies.add(new DragonEnemy(this, px, py));
                else if (char === 'H') this.flyingEnemies.add(new SunflowerEnemy(this, px, py - 32)); // Top stuck
                else if (char === 'w') this.enemies.add(new WormEnemy(this, px, py));
                else if (char === 'O') this.bonusEntrances.add(new BonusEntrance(this, px, py, 'portal', 'sky'));
                else if (char === 'C') this.chests.add(new Chest(this, px, py));
                else if (char === 'D') this.doors.add(new Door(this, px, py));
                else if (char === 'E') this.exits.add(this.physics.add.staticSprite(px, py, 'door').setOrigin(0.5, 1));
                else if (char === 'P') this.princess = this.physics.add.staticSprite(px, py, 'princess').setOrigin(0.5, 1);
                else if (char === '@') this.player = new Player(this, px, py);
                else if (['4','5','6','7','8'].includes(char)) {
                    let b = (char === '4') ? new Boss1(this, px, py) : (char === '5') ? new Boss2(this, px, py) : (char === '6') ? new Boss3(this, px, py) : (char === '7') ? new MidBoss(this, px, py) : new FinalBoss(this, px, py);
                    if (b) { this.enemies.add(b); this.boss = b; }
                    for(let i=-2; i<=2; i++) { if (i !== 0) { this.itemBoxes.add(new ItemBox(this, px + i*150, py - 182)); } }
                }
            }
        }
    }

    enterBonus(p, entrance) {
        if (this.isTransitioning) return;
        this.isTransitioning = true;
        this.showMessage("ENTERING BONUS STAGE!");
        AudioSystem.playPowerup();
        
        // Save current position
        GameState.returnPos = { x: this.player.x, y: this.player.y };

        const bonusData = LevelGenerator.generateBonus(entrance.targetStage, GameState.currentStage);
        
        this.cameras.main.fade(800, 255, 255, 255, false);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.restart({ bonus: bonusData });
        });
    }

    respawnEnemy(oldEnemy) {
        if (this.enemies.countActive(true) > 15) return;
        this.time.delayedCall(3000, () => {
            if (!this.isDying && this.player) {
                const rx = this.player.x + (Math.random() < 0.5 ? -500 : 500);
                const ry = 100;
                const enemyTypes = ['1', '2', '3', 'M', 'F', 'U', 'S', 'b', 'v'];
                const maxIndex = Math.min(enemyTypes.length - 1, Math.floor(GameState.currentStage / 5) + 3);
                const type = enemyTypes[Phaser.Math.Between(0, maxIndex)];
                
                let newEnemy;
                if (type === '1' || type === '2' || type === '3') newEnemy = new PatrolEnemy(this, rx, ry, parseInt(type));
                else if (type === 'M') newEnemy = new MissileEnemy(this, rx, ry);
                else if (type === 'F') newEnemy = new ChaserEnemy(this, rx, ry);
                else if (type === 'U') newEnemy = new SunEnemy(this, rx, ry);
                else if (type === 'S') newEnemy = new SlimeEnemy(this, rx, ry);
                else if (type === 'b') newEnemy = new BatEnemy(this, rx, ry);
                else if (type === 'v') newEnemy = new BirdEnemy(this, rx, ry);
                
                if (newEnemy) {
                    if (['U', 'b', 'v'].includes(type)) this.flyingEnemies.add(newEnemy);
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
    
    createParticles(x, y, color) {
        for (let i = 0; i < 8; i++) {
            let p = this.add.rectangle(x, y, 8, 8, color).setDepth(50);
            this.physics.add.existing(p);
            p.body.setVelocity(Phaser.Math.Between(-200, 200), Phaser.Math.Between(-400, -100));
            this.tweens.add({ targets: p, alpha: 0, scale: 0, duration: 600, onComplete: () => p.destroy() });
        }
    }

    setupUI() { 
        this.hudText = this.add.text(10, 10, '', { fontSize: '18px', fill: '#fff', stroke: '#000', strokeThickness: 4 }).setScrollFactor(0).setDepth(100); 
        this.timerText = this.add.text(790, 10, '', { fontSize: '24px', fill: '#ff0', stroke: '#000', strokeThickness: 4 }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);
        this.updateHUD(); 
    }
    updateHUD() { 
        if (this.player) {
            this.hudText.setText(`HP:${this.player.health} | MP:${Math.floor(this.player.mp)} | LIVES:${GameState.playerLives} | STAGE:${GameState.currentStage} | SCORE:${GameState.score}`); 
            this.timerText.setText(`TIME: ${Math.max(0, this.timeLimit)}`);
        }
    }
    showMessage(text) { let m = this.add.text(this.cameras.main.centerX, 150, text, { fontSize: '32px', fill: '#ff0', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5).setScrollFactor(0).setDepth(101); this.tweens.add({ targets: m, y: 100, alpha: 0, duration: 1500, onComplete: () => m.destroy() }); }

    async useShopItemSilent(itemKey) {
        if (!GameState.items || GameState.items[itemKey] <= 0) return false;
        GameState.items[itemKey]--;
        try {
            await fetch('/api/shop/consume', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemKey })
            });
            return true;
        } catch (e) { console.error("Item consumption sync failed:", e); return false; }
    }

    setupMobileControls() {
        if (!this.sys.game.device.input.touch && !this.sys.game.device.input.mspointer) return;
        const cw = this.cameras.main.width; const ch = this.cameras.main.height;
        const createZone = (x, y, radius, flag, label, color) => {
            let z = this.add.circle(x, y, radius, color, 0.3).setScrollFactor(0).setDepth(90).setInteractive();
            z.setStrokeStyle(2, 0xffffff, 0.8);
            this.add.text(x, y, label, {fontSize:'32px', fill:'#fff', stroke:'#000', strokeThickness:4}).setOrigin(0.5).setScrollFactor(0).setDepth(91);
            z.on('pointerdown', () => this[flag] = true); z.on('pointerup', () => this[flag] = false); z.on('pointerout', () => this[flag] = false);
        };
        const r = 65;
        createZone(80, ch * 0.9 - 80, r, 'btnLeft', '◀', 0x333333); 
        createZone(220, ch * 0.9 - 80, r, 'btnRight', '▶', 0x333333);
        createZone(cw - 220, ch * 0.9 - 80, r, 'btnFire', 'A', 0xff0000); 
        createZone(cw - 80, ch * 0.9 - 80, r, 'btnJump', 'B', 0x00ff00);
    }

    update() {
        if (!this.player || !this.player.active || this.isDying || this.isTransitioning) return;
        if (this.player.y > 480) { 
            this.player.setVelocityY(0);
            this.player.setAccelerationX(0);
            this.die(); 
            return; 
        }

        // Auto-use Mana Potion if low
        if (this.player.mp < 2 && GameState.items && GameState.items.hero_mana_potion > 0) {
            this.useShopItemSilent('hero_mana_potion').then(success => {
                if (success) {
                    this.player.mp = this.player.maxMaxMP;
                    this.showMessage("MANA POTION USED!");
                    AudioSystem.playPowerup();
                    this.updateHUD();
                }
            });
        }

        let moveX = 0; let L = this.cursors.left.isDown || this.btnLeft; let R = this.cursors.right.isDown || this.btnRight;
        if (this.player.isReversed) { let t = L; L = R; R = t; }
        if (L) { moveX = -this.player.speed * 33; this.player.setFlipX(true); } else if (R) { moveX = this.player.speed * 33; this.player.setFlipX(false); }
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
        
        // Rainbow (Invincibility) effect handling
        if (p.isRainbow) { 
            if (e instanceof Boss) {
                e.takeDamage(20, false);
                p.setVelocityY(-500); 
            } else {
                if (e.takeDamage) e.takeDamage(10);
                else e.destroy();
            }
            return; 
        }

        const isStomping = p.body.velocity.y > 0 && p.y < (e.y - 10);
        if (isStomping) {
            if (e.takeDamage) {
                const isDead = e.takeDamage(e instanceof Boss ? 1 : 10); // Stomp is very strong for normal enemies
                if (isDead) { p.setVelocityY(-500); p.jumps = 1; }
                else { p.setVelocityY(-600); }
            } else {
                e.destroy();
                p.setVelocityY(-500);
            }
        } else if (!p.isInvulnerable) if (p.takeDamage(e.damage || 1)) this.die();
    }
    hitProjectile(p, pr) { if (this.isDying || this.isTransitioning) return; pr.destroy(); if (p.takeDamage(1)) this.die(); }
    unlockDoors() { this.doors.getChildren().forEach(d => { this.tweens.add({ targets: d, alpha: 0.3, y: d.y - 64, duration: 1000 }); if (d.body) d.body.enable = false; }); }
    reachExit(p, e) { 
        if (this.isTransitioning) return; 
        if (this.boss && this.boss.active) { this.showMessage("Defeat the Boss!"); return; } 
        this.isTransitioning = true; 
        
        if (this.player) {
            GameState.playerHP = this.player.health; 
            GameState.isMega = this.player.isMega;
            GameState.isReversed = this.player.isReversed;
            GameState.scoreMultiplier = this.player.scoreMultiplier;
        }

        this.addScore(this.timeLimit * 10); AudioSystem.playWin(); try { BGM.stop(); } catch(e) {} 
        
        this.cameras.main.fade(1000, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            // If it was a bonus level, don't increment the stage number
            if (this.levelData && !this.levelData.isBonus) {
                GameState.currentStage++;
            }
            this.scene.start('GameScene', { bonus: null }); 
        });
    }
    async die() {
        if (this.isDying) return; this.isDying = true; 

        // Try using Resurrection Stone if available
        const usedStone = await this.useShopItemSilent('hero_revive');
        if (usedStone) {
            this.showMessage("RESURRECTION STONE USED!");
            AudioSystem.playPowerup();
            this.player.health = this.player.maxHealth;
            this.player.setTint(0x00ffff);
            
            // Move player to nearest safe ground
            this.respawnOnSafeGround();

            this.time.delayedCall(1000, () => {
                this.player.clearTint();
                this.isDying = false;
            });
            return;
        }

        GameState.playerLives--; GameState.playerHP = 5; 
        GameState.isMega = false; GameState.isReversed = false; GameState.scoreMultiplier = 1;
        try { this.physics.world.pause(); if (this.player.body) this.physics.world.disable(this.player); BGM.stop(); AudioSystem.playDeath(); this.player.setTint(0xff0000); } catch(e) {}
        this.tweens.add({ targets: this.player, y: this.player.y - 120, duration: 450, ease: 'Cubic.easeOut', onComplete: () => { this.tweens.add({ targets: this.player, y: 650, duration: 700, ease: 'Cubic.easeIn', onComplete: () => { if (GameState.playerLives > 0) this.scene.restart(); else this.scene.start('GameOverScene'); } }); } });
    }

    respawnOnSafeGround() {
        if (!this.player) return;
        
        const ts = 32;
        const px = Math.max(0, Math.min(Math.floor(this.player.x / ts), this.levelData.layout[0].length - 1));
        const layout = this.levelData.layout;
        const height = layout.length;
        const width = layout[0].length;

        // Search for ground in current column from top to bottom
        let found = false;
        const findGroundInColumn = (x) => {
            // Prefer finding ground at a reasonable height (not too close to top or bottom)
            for (let y = 1; y < height - 1; y++) {
                if (layout[y][x] === '#' || layout[y][x] === '-') {
                    // Check if space above is clear
                    if (y > 0 && layout[y-1][x] === ' ') {
                        this.player.setPosition(x * ts + 16, (y - 1) * ts - 16);
                        return true;
                    }
                }
            }
            return false;
        };

        if (findGroundInColumn(px)) {
            found = true;
        } else {
            // Search nearby columns
            for (let d = 1; d < 20; d++) {
                for (let dir of [-1, 1]) {
                    let nx = px + d * dir;
                    if (nx >= 0 && nx < width) {
                        if (findGroundInColumn(nx)) {
                            found = true;
                            break;
                        }
                    }
                }
                if (found) break;
            }
        }

        // Final fallback: start of level
        if (!found) {
            this.player.setPosition(100, 200);
        }
        
        this.player.setVelocity(0, 0);
        this.player.setAcceleration(0, 0);
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
            if (bestEl && d.updatedScores && d.updatedScores.hero_best_score !== undefined) {
                bestEl.innerText = d.updatedScores.hero_best_score;
            } else if (bestEl && GameState.score > parseInt(bestEl.innerText || '0')) {
                bestEl.innerText = GameState.score;
            }
        }).catch(e => console.error('[Hero-Quest] Submit failed:', e));
        
        const savedStage = GameState.currentStage;
        
        const continueBtn = this.add.text(this.cameras.main.centerX, 340, "[ CONTINUE FROM STAGE " + savedStage + " ]", { fontSize: '24px', fill: '#0ff' }).setOrigin(0.5).setInteractive().on('pointerup', () => {
            GameState.playerLives = 3;
            GameState.playerHP = 5;
            GameState.score = 0;
            GameState.isMega = false;
            GameState.isReversed = false;
            GameState.scoreMultiplier = 1;
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
            if (bestEl && d.updatedScores && d.updatedScores.hero_best_score !== undefined) {
                bestEl.innerText = d.updatedScores.hero_best_score;
            } else if (bestEl && GameState.score > parseInt(bestEl.innerText || '0')) {
                bestEl.innerText = GameState.score;
            }
        }).catch(e => console.error('[Hero-Quest] Submit failed:', e));
        this.add.text(this.cameras.main.centerX, 350, "[ PLAY AGAIN ]", { fontSize: '28px', fill: '#0f0' }).setOrigin(0.5).setInteractive().on('pointerup', () => this.scene.start('MenuScene'));
    }
}

const config = { 
    type: Phaser.AUTO, 
    parent: 'game-container', 
    pixelArt: false, 
    input: { activePointers: 4 }, 
    scale: { 
        mode: Phaser.Scale.FIT, 
        width: 800,
        height: 480
    }, 
    physics: { 
        default: 'arcade', 
        arcade: { gravity: { y: 1400 }, debug: false } 
    }, 
    scene: [BootScene, MenuScene, GameScene, GameOverScene, VictoryScene] 
};
const game = new Phaser.Game(config);
window.game = game;
game.events.on('ready', () => zzfxX = game.sound.context);
