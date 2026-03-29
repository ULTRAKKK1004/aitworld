import * as THREE from 'three';

class Monster {
    constructor(scene, playerPos, playerLevel) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.level = Math.max(1, playerLevel + Math.floor(Math.random() * 3) - 1);
        this.hp = this.level * 10;
        this.maxHp = this.hp;
        this.speed = 2;
        this.damage = this.level * 2;
        this.aggroRange = 15;
        this.attackRange = 1.5;
        this.state = 'ROAM';
        this.velocity = new THREE.Vector3();
        this.cooldown = 0;
        
        // UI Sprite for HP and Level
        this.uiSprite = this.createUISprite();
        this.uiSprite.position.y = 2.0;
        this.group.add(this.uiSprite);

        const angle = Math.random() * Math.PI * 2;
        const dist = 30 + Math.random() * 20;
        this.group.position.set(playerPos.x + Math.cos(angle)*dist, 50, playerPos.z + Math.sin(angle)*dist);
        this.group.userData = { monster: this };
        this.scene.add(this.group);
    }

    createUISprite() {
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        this.updateCanvas(ctx, canvas);
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(2, 0.5, 1);
        sprite.userData.ctx = ctx;
        sprite.userData.canvas = canvas;
        return sprite;
    }

    updateCanvas(ctx, canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // BG
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(10, 10, 236, 44);
        // HP Bar
        const hpWidth = (this.hp / this.maxHp) * 220;
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(18, 30, hpWidth, 15);
        // Text
        ctx.fillStyle = 'white';
        ctx.font = 'bold 20px Arial';
        ctx.fillText(`Lv.${this.level} Monster`, 20, 25);
    }

    takeDamage(amount) {
        this.hp -= amount;
        this.state = 'CHASE';
        this.updateCanvas(this.uiSprite.userData.ctx, this.uiSprite.userData.canvas);
        this.uiSprite.material.map.needsUpdate = true;

        this.group.traverse(c => {
            if(c.material && c !== this.uiSprite) {
                const old = c.material.emissive?.getHex() || 0;
                c.material.emissive?.setHex(0xff0000);
                setTimeout(() => c.material && c.material.emissive?.setHex(old), 100);
            }
        });
        if(this.hp <= 0) {
            this.scene.remove(this.group);
            return true;
        }
        return false;
    }

    update(delta, player, chunkManager) {
        if(this.cooldown > 0) this.cooldown -= delta;

        const distToPlayer = this.group.position.distanceTo(player.position);
        if (distToPlayer < this.aggroRange) this.state = 'CHASE';

        if (this.state === 'CHASE') {
            if (distToPlayer <= this.attackRange) {
                this.state = 'ATTACK';
            } else {
                const dir = new THREE.Vector3().subVectors(player.position, this.group.position);
                dir.y = 0; dir.normalize();
                this.group.position.add(dir.multiplyScalar(this.speed * delta));
                this.group.lookAt(player.position.x, this.group.position.y, player.position.z);
            }
        } else if (this.state === 'ATTACK') {
            if (distToPlayer > this.attackRange) {
                this.state = 'CHASE';
            } else if (this.cooldown <= 0) {
                player.takeDamage(this.damage);
                this.cooldown = 1.0;
            }
        } else if (this.state === 'ROAM') {
            if (Math.random() < 0.01) {
                this.velocity.set((Math.random()-0.5), 0, (Math.random()-0.5)).normalize().multiplyScalar(this.speed * 0.5);
                this.group.lookAt(this.group.position.x + this.velocity.x, this.group.position.y, this.group.position.z + this.velocity.z);
            }
            this.group.position.addScaledVector(this.velocity, delta);
        }

        // Keep Grounded
        let groundY = -10;
        const gx = Math.floor(this.group.position.x);
        const gz = Math.floor(this.group.position.z);
        for (let y = 63; y >= 0; y--) {
            const v = chunkManager.getVoxelGlobal(gx, y, gz);
            if (v !== 0 && v !== 11) { // 11 is water
                groundY = y + 1;
                break;
            }
        }
        this.group.position.y = THREE.MathUtils.lerp(this.group.position.y, groundY, 0.2);
        if (this.group.position.y < -10) this.hp = 0;
    }
}

export class Pacman extends Monster {
    constructor(scene, playerPos, playerLevel) {
        super(scene, playerPos, playerLevel);
        this.speed = 3;
        this.hp = this.level * 15;
        this.maxHp = this.hp;
        const mat = new THREE.MeshLambertMaterial({color: 0xffff00});
        const geo = new THREE.SphereGeometry(0.6, 16, 16, 0, Math.PI * 1.8);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.y = Math.PI / 2;
        mesh.position.y = 0.6;
        this.group.add(mesh);
        this.updateCanvas(this.uiSprite.userData.ctx, this.uiSprite.userData.canvas);
    }
}

export class Sunflower extends Monster {
    constructor(scene, playerPos, playerLevel) {
        super(scene, playerPos, playerLevel);
        this.speed = 1;
        this.hp = this.level * 8;
        this.maxHp = this.hp;
        this.attackRange = 10;
        this.aggroRange = 12;
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1), new THREE.MeshLambertMaterial({color: 0x2ecc71}));
        stem.position.y = 0.5;
        const head = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.2), new THREE.MeshLambertMaterial({color: 0x8B4513}));
        head.rotation.x = Math.PI/2; head.position.y = 1.0;
        const petals = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.1, 8, 12), new THREE.MeshLambertMaterial({color: 0xf1c40f}));
        petals.position.y = 1.0; petals.rotation.x = Math.PI/2;
        this.group.add(stem, head, petals);
        this.updateCanvas(this.uiSprite.userData.ctx, this.uiSprite.userData.canvas);
    }
}

export class Stickman extends Monster {
    constructor(scene, playerPos, playerLevel) {
        super(scene, playerPos, playerLevel);
        this.speed = 4.5;
        this.damage = this.level * 3;
        const mat = new THREE.MeshLambertMaterial({color: 0x111111});
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8), mat); body.position.y = 0.4;
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.2), mat); head.position.y = 0.9;
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6), mat); arm.position.set(0.2, 0.5, 0); arm.rotation.z = Math.PI/4;
        const sword = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8), new THREE.MeshLambertMaterial({color: 0xcccccc}));
        sword.position.set(0.4, 0.8, 0.2); sword.rotation.x = Math.PI/4;
        this.group.add(body, head, arm, sword);
        this.updateCanvas(this.uiSprite.userData.ctx, this.uiSprite.userData.canvas);
    }
}

export class MonsterManager {
    constructor(scene) {
        this.scene = scene;
        this.monsters = [];
    }

    spawn(playerPos, playerLevel) {
        if(this.monsters.length > 20) return;
        const r = Math.random();
        let m;
        if (r < 0.33) m = new Pacman(this.scene, playerPos, playerLevel);
        else if (r < 0.66) m = new Sunflower(this.scene, playerPos, playerLevel);
        else m = new Stickman(this.scene, playerPos, playerLevel);
        this.monsters.push(m);
    }

    update(delta, player, chunkManager) {
        for (let i = this.monsters.length - 1; i >= 0; i--) {
            const m = this.monsters[i];
            m.update(delta, player, chunkManager);
            if (m.hp <= 0) {
                this.monsters.splice(i, 1);
                // Drop rewards
                player.addItem('sticks', 1 + Math.floor(Math.random() * 2));
                if(Math.random() < 0.3) player.addItem('fruit', 1);
                if(Math.random() < 0.2) player.addItem('herbs', 1);
                player.addXp(m.level * 20);
                player.score += m.level * 50;
            }
        }
    }
}
