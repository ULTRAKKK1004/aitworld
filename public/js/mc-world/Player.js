import * as THREE from 'three';

export class PlayerData {
    constructor() {
        this.level = 1;
        this.xp = 0;
        this.hp = 20;
        this.maxHp = 20;
        this.mp = 10;
        this.maxMp = 10;
        this.inventory = { sticks: 0, wood: 0, fruit: 0, herbs: 0, health_potion: 0, dmg_booster: 0 };
        this.weapons = { stick: 1, bow: 0, sword: 0 };
        this.dmgBoost = 1.0;
        this.dmgBoostTimer = 0;
        this.lastVillage = { x: 16, z: 16 };
        this.position = new THREE.Vector3(16, 60, 16);
        this.score = 0;
        this.info = "";
        this.idleTime = 0;
        this.lastPos = new THREE.Vector3();
    }

    update(delta, isInSafeZone) {
        if (this.dmgBoostTimer > 0) {
            this.dmgBoostTimer -= delta;
            if (this.dmgBoostTimer <= 0) {
                this.dmgBoost = 1.0;
                this.showNotification("Damage boost expired.");
            }
        }
        // Idle detection
        if (this.position.distanceTo(this.lastPos) < 0.1) {
            this.idleTime += delta;
        } else {
            this.idleTime = 0;
            this.lastPos.copy(this.position);
        }

        // HP Recovery: 3 HP/sec if idle (> 2s) or in safe zone
        if (this.idleTime > 2 || isInSafeZone) {
            if (this.hp < this.maxHp) {
                this.hp = Math.min(this.maxHp, this.hp + 3 * delta);
                this.updateUI();
            }
        }
    }

    addXp(amount) {
        this.xp += (amount || 0);
        this.showFloatingText(`+${Math.floor(amount)} EXP`, '#f1c40f');
        const xpNeeded = this.level * 100;
        if (this.xp >= xpNeeded) {
            this.xp -= xpNeeded;
            this.level++;
            this.maxHp += 10;
            this.maxMp += 5;
            this.hp = this.maxHp;
            this.mp = this.maxMp;
            this.showNotification("LEVEL UP! HP & MP Recovered.");
        }
        this.updateUI();
    }

    takeDamage(amount) {
        this.hp -= (amount || 0);
        this.flashDamageEffect();
        this.showFloatingText(`-${Math.floor(amount)} HP`, '#e74c3c');
        if (this.hp <= 0) {
            this.die();
        }
        this.updateUI();
    }

    useMp(amount) {
        if (this.mp >= amount) {
            this.mp -= amount;
            this.updateUI();
            return true;
        }
        return false;
    }

    flashDamageEffect() {
        const overlay = document.getElementById('damage-overlay');
        if (overlay) {
            overlay.style.background = 'rgba(255,0,0,0.3)';
            setTimeout(() => { if(overlay) overlay.style.background = 'rgba(255,0,0,0)'; }, 200);
        }
    }

    showFloatingText(text, color) {
        const el = document.createElement('div');
        el.innerText = text;
        el.style.position = 'absolute';
        el.style.top = '50%';
        el.style.left = '50%';
        el.style.transform = 'translate(-50%, -50%)';
        el.style.color = color || 'white';
        el.style.fontSize = '24px';
        el.style.fontWeight = 'bold';
        el.style.pointerEvents = 'none';
        el.style.zIndex = '1000';
        el.style.textShadow = '2px 2px #000';
        document.body.appendChild(el);
        const start = Date.now();
        const anim = () => {
            const elapsed = Date.now() - start;
            const progress = elapsed / 1000;
            if (progress < 1) {
                el.style.top = (50 - progress * 20) + '%';
                el.style.opacity = 1 - progress;
                requestAnimationFrame(anim);
            } else { el.remove(); }
        };
        anim();
    }

    addItem(type, amount = 1) {
        if (this.inventory[type] !== undefined) {
            this.inventory[type] += amount;
        } else {
            this.inventory[type] = amount;
        }
        
        // Auto-consume basic resources if HP/MP low
        if (type === 'fruit' && this.hp < this.maxHp * 0.5) {
            this.useItem('fruit');
        } else if (type === 'herbs' && this.mp < this.maxMp * 0.3) {
            this.useItem('herbs');
        }
        this.updateUI();
    }

    useItem(type) {
        if (!this.inventory[type] || this.inventory[type] <= 0) return;

        if (type === 'fruit') {
            this.heal(5);
            this.inventory.fruit--;
            this.showFloatingText("+5 HP", "#2ecc71");
        } else if (type === 'health_potion') {
            this.heal(30);
            this.inventory.health_potion--;
            this.showFloatingText("+30 HP", "#ff00ff");
        } else if (type === 'dmg_booster') {
            this.dmgBoost = 2.0;
            this.dmgBoostTimer = 30; // 30 seconds
            this.inventory.dmg_booster--;
            this.showNotification("DAMAGE BOOST ACTIVATED (2x)!");
            this.showFloatingText("ATK UP!", "#f1c40f");
        } else if (type === 'herbs') {
            this.mp = Math.min(this.maxMp, this.mp + 15);
            this.inventory.herbs--;
            this.showFloatingText("+15 MP", "#3498db");
        }
        this.updateUI();
        if (window.audioManager) window.audioManager.playSFX('jump'); 
    }

    heal(amount) {
        this.hp = Math.min(this.maxHp, this.hp + (amount || 0));
        this.updateUI();
    }

    upgradeWeapon(type) {
        const currentTier = this.weapons[type] || 0;
        let reqLevel = 0, reqSticks = 0, reqWood = 0;
        if (type === 'sword') {
            reqLevel = currentTier === 0 ? 3 : (currentTier + 1) * 5;
            reqSticks = currentTier === 0 ? 10 : (currentTier + 1) * 15;
            reqWood = currentTier === 0 ? 0 : currentTier * 5;
        } else if (type === 'bow') {
            reqLevel = currentTier === 0 ? 5 : (currentTier + 1) * 7;
            reqSticks = currentTier === 0 ? 20 : (currentTier + 1) * 20;
            reqWood = currentTier === 0 ? 0 : currentTier * 5;
        }
        if (this.level >= reqLevel && this.inventory.sticks >= reqSticks && (this.inventory.wood || 0) >= reqWood) {
            this.inventory.sticks -= reqSticks;
            this.inventory.wood = Math.max(0, (this.inventory.wood || 0) - reqWood);
            this.weapons[type] = (this.weapons[type] || 0) + 1;
            const tierNames = ["Locked", "Wooden", "Stone", "Iron", "Gold", "Diamond"];
            const name = tierNames[this.weapons[type]] || "Epic";
            this.showNotification(`${type.toUpperCase()} UPGRADED TO ${name}!`);
            this.updateUI();
            return true;
        } else {
            this.showNotification(`Req: Lv.${reqLevel}, Sticks:${reqSticks}, Wood:${reqWood}`);
            return false;
        }
    }

    die() {
        this.hp = this.maxHp;
        this.mp = this.maxMp;
        this.teleportToSafe();
        this.showNotification("YOU FAINTED! Respawning...");
        if (window.audioManager) window.audioManager.playDefeat();
    }

    teleportToSafe() {
        const spawnPos = new THREE.Vector3(16, 60, 16);
        this.position.copy(spawnPos);
        if (window.gameControls && window.gameControls.getObject) {
            const obj = window.gameControls.getObject();
            if (obj && obj.position) obj.position.copy(spawnPos);
        }
    }

    updateUI() {
        const hpBar = document.getElementById('hp-bar');
        const mpBar = document.getElementById('mp-bar');
        const expBar = document.getElementById('exp-bar');
        const levelEl = document.getElementById('player-level');
        const scoreEl = document.getElementById('score-val');
        
        if(hpBar) hpBar.style.width = `${Math.max(0, (this.hp / this.maxHp) * 100)}%`;
        if(mpBar) mpBar.style.width = `${Math.max(0, (this.mp / this.maxMp) * 100)}%`;
        
        const xpNeeded = this.level * 100;
        if(expBar) expBar.style.width = `${Math.min(100, (this.xp / xpNeeded) * 100)}%`;
        
        if(levelEl) levelEl.innerText = this.level;
        if(scoreEl) scoreEl.innerText = Math.floor(this.score);

        const invSticks = document.getElementById('inv-sticks');
        const invWood = document.getElementById('inv-wood');
        const invFruit = document.getElementById('inv-fruit');
        const invHerbs = document.getElementById('inv-herbs');
        const invLevel = document.getElementById('inv-level');
        const bowLevel = document.getElementById('bow-level');
        const swordLevel = document.getElementById('sword-level');

        if(invSticks) invSticks.innerText = this.inventory.sticks || 0;
        if(invWood) invWood.innerText = this.inventory.wood || 0;
        if(invFruit) invFruit.innerText = this.inventory.fruit || 0;
        if(invHerbs) invHerbs.innerText = this.inventory.herbs || 0;
        const invHealthPotion = document.getElementById('inv-health-potion');
        const invDmgBooster = document.getElementById('inv-dmg-booster');
        if(invHealthPotion) invHealthPotion.innerText = this.inventory.health_potion || 0;
        if(invDmgBooster) invDmgBooster.innerText = this.inventory.dmg_booster || 0;
        if(invLevel) invLevel.innerText = this.level;
        
        const tierNames = ["Locked", "Wooden", "Stone", "Iron", "Gold", "Diamond"];
        if(bowLevel) bowLevel.innerText = tierNames[this.weapons.bow] || "Epic " + this.weapons.bow;
        if(swordLevel) swordLevel.innerText = tierNames[this.weapons.sword] || "Epic " + this.weapons.sword;
    }

    showNotification(msg) {
        const notif = document.createElement('div');
        notif.style.position = 'absolute';
        notif.style.top = '25%';
        notif.style.left = '50%';
        notif.style.transform = 'translate(-50%, -50%)';
        notif.style.color = '#fff';
        notif.style.background = 'rgba(0,0,0,0.85)';
        notif.style.padding = '12px 24px';
        notif.style.borderRadius = '8px';
        notif.style.zIndex = '1000';
        notif.style.fontWeight = 'bold';
        notif.style.border = '2px solid #3498db';
        notif.innerText = msg;
        document.body.appendChild(notif);
        setTimeout(() => { if(notif) notif.remove(); }, 3000);
    }

    async save() {
        if(window.gameControls && window.gameControls.getObject) {
            const p = window.gameControls.getObject().position;
            if (p) this.position.set(p.x, p.y, p.z);
        }

        // Generate inventory summary for admin info
        const inv = this.inventory || {};
        this.info = `S:${inv.sticks||0}, W:${inv.wood||0}, F:${inv.fruit||0}, H:${inv.herbs||0}, HP:${inv.health_potion||0}, DB:${inv.dmg_booster||0}`;

        const dataToSave = {
            level: this.level,
            xp: this.xp,
            hp: this.hp,
            maxHp: this.maxHp,
            mp: this.mp,
            maxMp: this.maxMp,
            inventory: this.inventory,
            weapons: this.weapons,
            lastVillage: this.lastVillage,
            position: { x: this.position.x, y: this.position.y, z: this.position.z },
            score: this.score,
            info: this.info
        };

        try {
            console.log("Saving data:", dataToSave);
            const response = await fetch('/api/mc-world/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    saveData: dataToSave, 
                    level: this.level,
                    info: this.info,
                    score: Math.floor(this.score)
                })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error("Save failed (HTTP " + response.status + "):", errorText);
                alert("Save Failed (HTTP " + response.status + "): " + errorText);
                return;
            }

            const result = await response.json();
            if (result.success) {
                console.log("Save successful");
            } else {
                console.error("Save failed server-side:", result.error);
                alert("Save Failed: " + result.error);
            }
            
            // Also update high score
            await fetch('/api/submit-score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    score: Math.floor(this.score),
                    gameType: 'mc-world'
                })
            });
        } catch(e) {
            console.error("Save failed (Fetch Error):", e);
            alert("Save Connection Error: " + e.message);
        }
    }

    async load() {
        try {
            console.log("Loading data from server...");
            const res = await fetch('/api/mc-world/load');
            const data = await res.json();
            if (data.success) {
                console.log("Load response data:", data);
                if (data.saveData) {
                    const s = data.saveData;
                    if (s.level) this.level = s.level;
                    if (s.xp !== undefined) this.xp = s.xp;
                    if (s.hp !== undefined) this.hp = s.hp;
                    if (s.maxHp) this.maxHp = s.maxHp;
                    if (s.mp !== undefined) this.mp = s.mp;
                    if (s.maxMp) this.maxMp = s.maxMp;
                    if (s.inventory) this.inventory = s.inventory;
                    if (s.weapons) this.weapons = s.weapons;
                    if (s.lastVillage) this.lastVillage = s.lastVillage;
                    if (s.score !== undefined) this.score = s.score;
                    
                    if (s.position) {
                        this.position.set(s.position.x, s.position.y, s.position.z);
                        console.log("Position restored:", this.position);
                    }
                }
                
                // Final override if server has specific level/info
                if (data.level) this.level = data.level;
                if (data.info) this.info = data.info;
                
                console.log("Load complete. Level:", this.level, "Score:", this.score);
            }
        } catch(e) {
            console.error("Load failed:", e);
        }
        this.updateUI();
    }
}
