import * as THREE from 'three';

export class PlayerData {
    constructor() {
        this.level = 1;
        this.xp = 0;
        this.hp = 20;
        this.maxHp = 20;
        this.mp = 10;
        this.maxMp = 10;
        this.inventory = { sticks: 0, wood: 0, fruit: 0, herbs: 0, health_potion: 0, dmg_booster: 0, weapon_atk_plus: 0, atk_range_plus: 0, user_def_plus: 0, user_atk_plus: 0 };
        this.weapons = { stick: 1, bow: 0, sword: 0 };
        this.dmgBoost = 1.0;
        this.dmgBoostTimer = 0;
        this.bonusWeapAtk = 0;
        this.bonusAtkRange = 0;
        this.bonusDef = 0;
        this.bonusUserAtk = 0;
        this.lastVillage = { x: 16, z: 16 };
        this.position = new THREE.Vector3(16, 60, 16);
        this.score = 0;
        this.scoreMultiplier = 1.0;
        this.purchasedItems = [];
        this.deathCount = 0;
        this.info = "";
        this.idleTime = 0;
        this.lastPos = new THREE.Vector3();
        this.loaded = false;
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
            
            // Level up bonus score
            const bonus = this.level * 5000;
            this.score += bonus;
            this.showNotification(`LEVEL UP! +${bonus} Bonus Score!`);
            
            if ((this.level - 1) % 10 === 0 && this.level > 1) {
                this.bonusWeapAtk = 0;
                this.bonusAtkRange = 0;
                this.bonusDef = 0;
                this.bonusUserAtk = 0;
                this.showNotification("Stat bonuses reset for new tier!");
            }
        }
        this.updateUI();
    }

    takeDamage(amount) {
        let finalAmount = Math.max(1, (amount || 0) - (this.bonusDef || 0));
        this.hp -= finalAmount;
        this.flashDamageEffect();
        this.showFloatingText(`-${Math.floor(finalAmount)} HP`, '#e74c3c');
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
        
        // Item pickup score scaling
        const itemScore = 10 * (1 + this.level * 0.1);
        this.score += itemScore;

        // Auto-consume basic resources if HP/MP low
        if (type === 'fruit' && this.hp < this.maxHp * 0.5) {
            this.useItem('fruit');
        } else if (type === 'herbs' && this.mp < this.maxMp * 0.3) {
            this.useItem('herbs');
        } else if (['weapon_atk_plus', 'atk_range_plus', 'user_def_plus', 'user_atk_plus'].includes(type)) {
            this.useItem(type);
        }
        this.updateUI();
    }

    applyStatItem(statName, itemName) {
        let currentStat = this[statName] || 0;
        let success = true;

        if (this.level >= 20) {
            let chance = 0.5;
            if (this.level >= 30 && currentStat >= 7) {
                chance = Math.max(0.1, chance - (currentStat - 6) * 0.1);
            }
            if (Math.random() > chance) {
                success = false;
            }
        } else {
            let maxLimit = (this.level <= 10) ? 3 : 5;
            if (currentStat >= maxLimit) {
                this.showNotification(`Limit (${maxLimit}) reached for Lv.${this.level}`);
                return false;
            }
        }

        if (success) {
            this[statName] = currentStat + 1;
            this.showFloatingText(`${itemName} SUCCESS! (+${this[statName]})`, '#00ff00');
        } else {
            this.showFloatingText(`${itemName} FAILED!`, '#ff0000');
        }
        return true;
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
        } else if (type === 'weapon_atk_plus') {
            if (this.applyStatItem('bonusWeapAtk', 'Weap Atk+')) this.inventory[type]--;
        } else if (type === 'atk_range_plus') {
            if (this.applyStatItem('bonusAtkRange', 'Range+')) this.inventory[type]--;
        } else if (type === 'user_def_plus') {
            if (this.applyStatItem('bonusDef', 'Def+')) this.inventory[type]--;
        } else if (type === 'user_atk_plus') {
            if (this.applyStatItem('bonusUserAtk', 'User Atk+')) this.inventory[type]--;
        }
        this.updateUI();
        if (window.audioManager) window.audioManager.playSFX('jump'); 
    }

    heal(amount) {
        this.hp = Math.min(this.maxHp, this.hp + (amount || 0));
        this.updateUI();
    }

    getWeaponName(type) {
        const tier = this.weapons[type] || 0;
        if (tier === 0) return "Locked";
        if (type === 'bow') {
            if (tier <= 3) return `활 +${tier}`;
            if (tier <= 6) return `강한활 +${tier-3}`;
            if (tier <= 9) return `조총 +${tier-6}`;
            if (tier <= 12) return `권총 +${tier-9}`;
            if (tier <= 15) return `장총 +${tier-12}`;
            return `바주카포 +${tier-15}`;
        } else if (type === 'sword') {
            if (tier <= 3) return `검 +${tier}`;
            if (tier <= 6) return `장검 +${tier-3}`;
            if (tier <= 9) return `전사의검 +${tier-6}`;
            if (tier <= 12) return `전사의 장검 +${tier-9}`;
            if (tier <= 15) return `전사의 쌍검 +${tier-12}`;
            if (tier <= 18) return `전자검 +${tier-15}`;
            return `레이저검 +${tier-18}`;
        }
        return `Level ${tier}`;
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
            const name = this.getWeaponName(type);
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
        
        this.deathCount++;
        let penaltyMsg = "YOU FAINTED! Respawning...";
        
        if (this.deathCount >= 10) {
            this.score = 0;
            this.deathCount = 0;
            penaltyMsg = "10 DEATHS: SCORE RESET TO 0!";
        } else if (this.level >= 40) {
            this.level = Math.max(39, this.level - 1);
            this.xp = 0;
            penaltyMsg = `LEVEL DOWN! (Deaths: ${this.deathCount}/10)`;
        } else if (this.level >= 30) {
            this.xp = 0;
            penaltyMsg = `XP RESET! (Deaths: ${this.deathCount}/10)`;
        } else if (this.level >= 20) {
            this.xp = Math.floor(this.xp * 0.3);
            penaltyMsg = `70% XP LOST! (Deaths: ${this.deathCount}/10)`;
        } else if (this.level >= 10) {
            this.xp = Math.floor(this.xp * 0.5);
            penaltyMsg = `50% XP LOST! (Deaths: ${this.deathCount}/10)`;
        } else {
            penaltyMsg = `YOU FAINTED! (Deaths: ${this.deathCount}/10)`;
        }

        this.showNotification(penaltyMsg);
        if (window.audioManager) window.audioManager.playDefeat();
        this.updateUI();
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
        
        if(bowLevel) bowLevel.innerText = this.getWeaponName('bow');
        if(swordLevel) swordLevel.innerText = this.getWeaponName('sword');
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
        if (!this.loaded) {
            console.log("Skipping save: Data not yet loaded.");
            return;
        }

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
            if (!res.ok) {
                console.error("Load failed with status:", res.status);
                return;
            }
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
                if (data.multiplier) this.scoreMultiplier = data.multiplier;
                if (data.items) {
                    this.purchasedItems = data.items;
                    let itemsApplied = [];
                    // Auto-apply specific items if needed
                    data.items.forEach(item => {
                        if (item.item_key === 'mc_tnt_pack') {
                            this.inventory.tnt = (this.inventory.tnt || 0) + (item.quantity * 5);
                            itemsApplied.push(`TNT x${item.quantity * 5}`);
                        } else if (item.item_key === 'mc_seeds') {
                            this.inventory.herbs = (this.inventory.herbs || 0) + (item.quantity * 10);
                            itemsApplied.push(`Seeds x${item.quantity * 10}`);
                        }
                    });
                    if (itemsApplied.length > 0) {
                        setTimeout(() => this.showNotification("Shop Items Applied: " + itemsApplied.join(", ")), 1500);
                    }
                }
                
                console.log("Load complete. Level:", this.level, "Score:", this.score, "Multiplier:", this.scoreMultiplier);
            }
        } catch(e) {
            console.error("Load failed:", e);
        }
        this.loaded = true;
        this.updateUI();
    }
}
