export class PlayerData {
    constructor() {
        this.level = 1;
        this.xp = 0;
        this.hp = 20;
        this.maxHp = 20;
        this.inventory = { sticks: 0, wood: 0, fruit: 0, herbs: 0 };
        this.weapons = { stick: 1, bow: 0, sword: 0 };
        this.lastVillage = { x: 0, z: 0 };
        this.position = { x: 0, y: 25, z: 0 };
        this.score = 0;
    }

    addXp(amount) {
        this.xp += amount;
        if (this.xp >= this.level * 100) {
            this.xp -= this.level * 100;
            this.level++;
            this.maxHp += 10;
            this.hp = this.maxHp;
            this.updateUI();
            this.showNotification("LEVEL UP! HP Increased.");
        }
    }

    takeDamage(amount) {
        this.hp -= amount;
        if (this.hp <= 0) {
            this.die();
        }
        this.updateUI();
    }

    addItem(type, amount = 1) {
        if (this.inventory[type] !== undefined) {
            this.inventory[type] += amount;
        } else {
            this.inventory[type] = amount;
        }
        this.updateUI();
    }

    upgradeWeapon(type) {
        let currentTier = this.weapons[type];
        let reqLevel = 0;
        let reqSticks = 0;
        let reqWood = 0;

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
            this.inventory.wood -= reqWood;
            this.weapons[type]++;
            this.updateUI();
            const tierNames = ["Locked", "Wooden", "Stone", "Iron", "Gold", "Diamond"];
            const name = tierNames[this.weapons[type]] || "Epic";
            this.showNotification(`${type.toUpperCase()} UPGRADED TO ${name}!`);
            return true;
        } else {
            this.showNotification(`Req: Lv.${reqLevel}, Sticks:${reqSticks}, Wood:${reqWood}`);
            return false;
        }
    }

    die() {
        this.hp = this.maxHp;
        this.position = { x: this.lastVillage.x, y: 25, z: this.lastVillage.z };
        if (window.gameControls) {
            window.gameControls.getObject().position.set(this.position.x, this.position.y, this.position.z);
        }
        this.showNotification("YOU DIED. Respawning at safe zone...");
    }

    updateUI() {
        const hpBar = document.getElementById('hp-bar');
        const levelEl = document.getElementById('player-level');
        const scoreEl = document.getElementById('score-val');
        const missionText = document.getElementById('mission-text');
        
        if(hpBar) hpBar.style.width = `${Math.max(0, (this.hp / this.maxHp) * 100)}%`;
        if(levelEl) levelEl.innerText = this.level;
        if(scoreEl) scoreEl.innerText = this.score;

        // Inventory UI updates
        const invSticks = document.getElementById('inv-sticks');
        const invWood = document.getElementById('inv-wood');
        const invFruit = document.getElementById('inv-fruit');
        const invHerbs = document.getElementById('inv-herbs');
        const invLevel = document.getElementById('inv-level');
        const bowLevel = document.getElementById('bow-level');
        const swordLevel = document.getElementById('sword-level');

        if(invSticks) invSticks.innerText = this.inventory.sticks;
        if(invWood) invWood.innerText = this.inventory.wood || 0;
        if(invFruit) invFruit.innerText = this.inventory.fruit || 0;
        if(invHerbs) invHerbs.innerText = this.inventory.herbs || 0;
        if(invLevel) invLevel.innerText = this.level;
        
        const tierNames = ["Locked", "Wooden", "Stone", "Iron", "Gold", "Diamond"];
        if(bowLevel) bowLevel.innerText = tierNames[this.weapons.bow] || "Epic " + this.weapons.bow;
        if(swordLevel) swordLevel.innerText = tierNames[this.weapons.sword] || "Epic " + this.weapons.sword;

        if(missionText) {
            if(this.weapons.sword === 0) missionText.innerText = "Mission: Reach Lv.3 and collect 10 sticks!";
            else if(this.inventory.wood < 5) missionText.innerText = "Mission: Plant logs (4) to grow wood/fruit!";
            else if(this.weapons.bow === 0) missionText.innerText = "Mission: Reach Lv.5 and collect 20 sticks!";
            else missionText.innerText = "Explore the villages and build your base!";
        }
    }

    showNotification(msg) {
        const notif = document.createElement('div');
        notif.className = 'game-notification';
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
        notif.style.pointerEvents = 'none';
        notif.innerText = msg;
        document.body.appendChild(notif);
        setTimeout(() => notif.remove(), 3000);
    }

    async save() {
        if(window.gameControls) {
            const p = window.gameControls.getObject().position;
            this.position = { x: p.x, y: p.y, z: p.z };
        }
        try {
            await fetch('/api/mc-world/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ saveData: this })
            });
        } catch(e) {}
    }

    async load() {
        try {
            const res = await fetch('/api/mc-world/load');
            const data = await res.json();
            if (data.success && data.saveData) {
                if(!data.saveData.inventory) data.saveData.inventory = { sticks: 0, wood: 0, fruit: 0, herbs: 0 };
                if(!data.saveData.weapons) data.saveData.weapons = { stick: 1, bow: 0, sword: 0 };
                Object.assign(this, data.saveData);
            }
        } catch(e) {}
        this.updateUI();
    }
}
