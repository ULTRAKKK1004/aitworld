import * as THREE from 'three';

class Monster {
    constructor(scene, playerPos, playerLevel) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.level = Math.max(1, (playerLevel || 1) + Math.floor(Math.random() * 3) - 1);
        this.hp = this.level * 10;
        this.maxHp = this.hp;
        this.mp = this.level * 5;
        this.maxMp = this.mp;
        this.speed = 2.5;
        this.damage = this.level * 2;
        this.aggroRange = 18;
        this.attackRange = 4.0; 
        this.stoppingDistance = 2.8;
        this.state = 'ROAM';
        this.spawnPoint = null; 
        this.velocity = new THREE.Vector3();
        this.cooldown = 0;
        this.lungeTimer = 0;
        
        this.uiSprite = this.createUISprite();
        this.uiSprite.position.y = 2.5;
        this.group.add(this.uiSprite);

        const markerGeo = new THREE.SphereGeometry(0.8, 8, 8);
        const markerMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        this.marker = new THREE.Mesh(markerGeo, markerMat);
        this.marker.position.y = 5; 
        this.marker.layers.set(1); 
        this.group.add(this.marker);

        const angle = Math.random() * Math.PI * 2;
        const dist = 30 + Math.random() * 20;
        const px = playerPos ? playerPos.x : 0;
        const pz = playerPos ? playerPos.z : 0;
        this.group.position.set(px + Math.cos(angle)*dist, 50, pz + Math.sin(angle)*dist);
        this.spawnPoint = this.group.position.clone();
        this.group.userData = { monster: this };
        this.scene.add(this.group);
    }

    createUISprite() {
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 80;
        const ctx = canvas.getContext('2d');
        this.updateCanvas(ctx, canvas);
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(2, 0.6, 1);
        sprite.userData.ctx = ctx;
        sprite.userData.canvas = canvas;
        return sprite;
    }

    updateCanvas(ctx, canvas) {
        if (!ctx || !canvas) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(10, 5, 236, 65);
        const hpWidth = (this.hp / this.maxHp) * 220;
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(18, 30, Math.max(0, hpWidth), 12);
        const mpWidth = (this.mp / this.maxMp) * 220;
        ctx.fillStyle = '#3498db';
        ctx.fillRect(18, 45, Math.max(0, mpWidth), 8);
        ctx.fillStyle = 'white';
        ctx.font = 'bold 18px Arial';
        ctx.fillText(`Lv.${this.level} ${this.constructor.name}`, 20, 25);
    }

    takeDamage(amount) {
        if (!this.group || this.hp <= 0) return false;
        this.hp -= (amount || 0);
        this.state = 'CHASE'; 
        
        if (this.uiSprite && this.uiSprite.userData) {
            this.updateCanvas(this.uiSprite.userData.ctx, this.uiSprite.userData.canvas);
            if (this.uiSprite.material && this.uiSprite.material.map) {
                this.uiSprite.material.map.needsUpdate = true;
            }
        }
        
        this.group.traverse(c => {
            if(c && c.isMesh && c !== this.uiSprite && c !== this.marker) {
                const materials = Array.isArray(c.material) ? c.material : [c.material];
                materials.forEach(mat => {
                    if (mat && mat.emissive && mat.emissive.isColor) {
                        const oldColor = mat.emissive.clone();
                        mat.emissive.setHex(0xff0000);
                        setTimeout(() => {
                            if (mat && mat.emissive && mat.emissive.isColor) mat.emissive.copy(oldColor);
                        }, 150);
                    }
                });
            }
        });

        if(this.hp <= 0) {
            this.scene.remove(this.group);
            return true;
        }
        return false;
    }

    update(delta, player, chunkManager) {
        if(!this.group || this.hp <= 0 || !player || !this.spawnPoint) return;
        if(this.cooldown > 0) this.cooldown -= delta;
        
        const dx = player.position.x - this.group.position.x;
        const dz = player.position.z - this.group.position.z;
        const dist2D = Math.sqrt(dx * dx + dz * dz);
        const distFromSpawn = this.group.position.distanceTo(this.spawnPoint);
        const maxChaseDist = this.aggroRange * 3;

        const isInVillage = (pos) => {
            if (!chunkManager) return false;
            const cx = Math.floor(pos.x / chunkManager.chunkSize);
            const cz = Math.floor(pos.z / chunkManager.chunkSize);
            return !!chunkManager.getVillage(cx, cz);
        };

        const playerInVillage = isInVillage(player.position);

        if (this.state === 'ROAM') {
            if (dist2D < this.aggroRange && !playerInVillage) this.state = 'CHASE';
        } else if (this.state === 'CHASE' || this.state === 'ATTACK') {
            if (distFromSpawn > maxChaseDist || playerInVillage || dist2D > this.aggroRange * 1.5) this.state = 'RETURN';
        }

        const walkCycle = Math.sin(Date.now() * 0.01) * 0.3;
        this.group.children.forEach(c => {
            if (c.name === 'legL') c.rotation.x = walkCycle;
            if (c.name === 'legR') c.rotation.x = -walkCycle;
        });

        if (this.state === 'RETURN') {
            const dir = new THREE.Vector3().subVectors(this.spawnPoint, this.group.position);
            dir.y = 0;
            const d = dir.length();
            if (d < 1) this.state = 'ROAM';
            else {
                dir.normalize();
                this.group.position.addScaledVector(dir, this.speed * delta);
                this.group.lookAt(this.spawnPoint.x, this.group.position.y, this.spawnPoint.z);
            }
        } else if (this.state === 'CHASE') {
            if (dist2D <= this.attackRange) {
                this.state = 'ATTACK';
            } else {
                const dir = new THREE.Vector3(dx, 0, dz).normalize();
                const step = dir.multiplyScalar(this.speed * delta);
                const nextPos = this.group.position.clone().add(step);
                if (isInVillage(nextPos)) this.state = 'RETURN';
                else {
                    if (dist2D > this.stoppingDistance) this.group.position.copy(nextPos);
                    this.group.lookAt(player.position.x, this.group.position.y, player.position.z);
                }
            }
        } else if (this.state === 'ATTACK') {
            const dy = Math.abs(player.position.y - this.group.position.y);
            if (dist2D > this.attackRange + 1.2 || dy > 4.0) this.state = 'CHASE';
            else {
                this.group.lookAt(player.position.x, this.group.position.y, player.position.z);
                if (this.cooldown <= 0) {
                    player.takeDamage(this.damage);
                    this.cooldown = 1.5;
                    this.lungeTimer = 0.3;
                }
            }
        } else if (this.state === 'ROAM') {
            if (Math.random() < 0.01) {
                this.velocity.set((Math.random()-0.5), 0, (Math.random()-0.5)).normalize().multiplyScalar(this.speed * 0.5);
                if (this.velocity.lengthSq() > 0) {
                    this.group.lookAt(this.group.position.x + this.velocity.x, this.group.position.y, this.group.position.z + this.velocity.z);
                }
            }
            const nextPos = this.group.position.clone().addScaledVector(this.velocity, delta);
            if (!isInVillage(nextPos) && nextPos.distanceTo(this.spawnPoint) < this.aggroRange * 1.5) {
                this.group.position.copy(nextPos);
            } else {
                this.velocity.negate();
            }
        }

        if (this.lungeTimer > 0) {
            this.lungeTimer -= delta;
            const dir = new THREE.Vector3(dx, 0, dz).normalize();
            const step = dir.multiplyScalar(this.speed * 0.8 * delta);
            const nextPos = this.group.position.clone().add(step);
            if (!isInVillage(nextPos) && dist2D > this.stoppingDistance - 0.5) {
                this.group.position.copy(nextPos);
            }
            this.group.position.y += Math.sin(this.lungeTimer * Math.PI / 0.3) * 0.3;
        }

        let groundY = -10;
        let inWater = false;
        const gx = Math.floor(this.group.position.x);
        const gz = Math.floor(this.group.position.z);
        if (chunkManager) {
            for (let y = 63; y >= 0; y--) {
                const v = chunkManager.getVoxelGlobal(gx, y, gz);
                if (v === 11) inWater = true;
                if (v !== 0 && v !== 11) { groundY = y + 1; inWater = false; break; }
            }
        }
        if (inWater && groundY < 10) { 
            this.hp -= delta * 15; 
            this.group.position.y = THREE.MathUtils.lerp(this.group.position.y, 9.2, 0.1); 
        } else if (this.lungeTimer <= 0) {
            this.group.position.y = THREE.MathUtils.lerp(this.group.position.y, groundY, 0.2);
        }
        if (this.group.position.y < -10) this.hp = 0;
    }
}

class Pika extends Monster {
    constructor(scene, playerPos, playerLevel) {
        super(scene, playerPos, playerLevel);
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.4), new THREE.MeshLambertMaterial({color: 0xffff00}));
        body.position.y = 0.5;
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), new THREE.MeshLambertMaterial({color: 0xffff00}));
        head.position.set(0, 0.9, 0.05);
        const earL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.35, 0.1), new THREE.MeshLambertMaterial({color: 0x000000}));
        earL.position.set(-0.15, 1.25, 0.05);
        const earR = earL.clone(); earR.position.x = 0.15;
        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.2), new THREE.MeshLambertMaterial({color: 0x8B4513}));
        tail.position.set(0, 0.4, -0.3); tail.rotation.x = Math.PI/4;
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 0.15), new THREE.MeshLambertMaterial({color: 0xffff00}));
        const fl = leg.clone(); fl.position.set(-0.2, 0.1, 0.15); fl.name = 'legL';
        const fr = leg.clone(); fr.position.set(0.2, 0.1, 0.15); fr.name = 'legR';
        const bl = leg.clone(); bl.position.set(-0.2, 0.1, -0.15); bl.name = 'legL';
        const br = leg.clone(); br.position.set(0.2, 0.1, -0.15); br.name = 'legR';
        this.group.add(body, head, earL, earR, tail, fl, fr, bl, br);
        if (this.uiSprite && this.uiSprite.userData) {
            this.updateCanvas(this.uiSprite.userData.ctx, this.uiSprite.userData.canvas);
        }
    }
}

class Bulba extends Monster {
    constructor(scene, playerPos, playerLevel) {
        super(scene, playerPos, playerLevel);
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.7), new THREE.MeshLambertMaterial({color: 0x40E0D0}));
        body.position.y = 0.35;
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.4, 0.45), new THREE.MeshLambertMaterial({color: 0x40E0D0}));
        head.position.set(0, 0.6, 0.2);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), new THREE.MeshLambertMaterial({color: 0x32CD32}));
        bulb.scale.y = 1.2; bulb.position.set(0, 0.7, -0.1);
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.25, 0.2), new THREE.MeshLambertMaterial({color: 0x40E0D0}));
        const fl = leg.clone(); fl.position.set(-0.3, 0.125, 0.3); fl.name = 'legL';
        const fr = leg.clone(); fr.position.set(0.3, 0.125, 0.3); fr.name = 'legR';
        const bl = leg.clone(); bl.position.set(-0.3, 0.125, -0.3); bl.name = 'legL';
        const br = leg.clone(); br.position.set(0.3, 0.125, -0.3); br.name = 'legR';
        this.group.add(body, head, bulb, fl, fr, bl, br);
        if (this.uiSprite && this.uiSprite.userData) {
            this.updateCanvas(this.uiSprite.userData.ctx, this.uiSprite.userData.canvas);
        }
    }
}

class Char extends Monster {
    constructor(scene, playerPos, playerLevel) {
        super(scene, playerPos, playerLevel);
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.4), new THREE.MeshLambertMaterial({color: 0xFFA500}));
        body.position.y = 0.55;
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), new THREE.MeshLambertMaterial({color: 0xFFA500}));
        head.position.set(0, 1.05, 0.1);
        const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.12, 0.7), new THREE.MeshLambertMaterial({color: 0xFFA500}));
        tail.rotation.x = -Math.PI/3; tail.position.set(0, 0.3, -0.4);
        const flame = new THREE.Mesh(new THREE.SphereGeometry(0.12), new THREE.MeshBasicMaterial({color: 0xff4500}));
        flame.position.set(0, 0.1, -0.7);
        const wing = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.05), new THREE.MeshLambertMaterial({color: 0x006400}));
        wing.position.set(0, 0.8, -0.2);
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.2), new THREE.MeshLambertMaterial({color: 0xFFA500}));
        const ll = leg.clone(); ll.position.set(-0.2, 0.15, 0); ll.name = 'legL';
        const lr = leg.clone(); lr.position.set(0.2, 0.15, 0); lr.name = 'legR';
        this.group.add(body, head, tail, flame, wing, ll, lr);
        if (this.uiSprite && this.uiSprite.userData) {
            this.updateCanvas(this.uiSprite.userData.ctx, this.uiSprite.userData.canvas);
        }
    }
}

export class BeholderBoss extends Monster {
    constructor(scene, playerPos, playerLevel) {
        super(scene, playerPos, playerLevel);
        this.level = (playerLevel || 1) + 5;
        this.hp = this.level * 60;
        this.maxHp = this.hp;
        this.mp = this.level * 20;
        this.maxMp = this.mp;
        this.speed = 1.0;
        this.damage = this.level * 4;
        this.aggroRange = 60;
        this.attackRange = 25; 
        this.group.scale.set(4, 4, 4);
        this.uiSprite.position.y = 2.5;
        this.spawnPoint = this.group.position.clone();
        const body = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 16), new THREE.MeshLambertMaterial({color: 0x800080}));
        body.position.y = 1.0;
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), new THREE.MeshBasicMaterial({color: 0xffffff}));
        eye.position.set(0, 1.2, 0.8);
        const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), new THREE.MeshBasicMaterial({color: 0xff0000}));
        pupil.position.set(0, 1.2, 1.15);
        this.group.add(body, eye, pupil);
        for(let i=0; i<6; i++) {
            const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.1, 0.8), body.material);
            const angle = (i / 6) * Math.PI * 2;
            stalk.position.set(Math.cos(angle)*0.8, 1.8, Math.sin(angle)*0.8);
            stalk.rotation.x = Math.PI/4;
            this.group.add(stalk);
        }
        if (this.uiSprite && this.uiSprite.userData) {
            this.updateCanvas(this.uiSprite.userData.ctx, this.uiSprite.userData.canvas);
        }
    }

    update(delta, player, chunkManager) {
        if(!this.group || this.hp <= 0 || !player || !this.spawnPoint) return;
        if(this.cooldown > 0) this.cooldown -= delta;
        const dx = player.position.x - this.group.position.x;
        const dz = player.position.z - this.group.position.z;
        const dist2D = Math.sqrt(dx * dx + dz * dz);
        const distFromSpawn = this.group.position.distanceTo(this.spawnPoint);
        const maxChaseDist = this.aggroRange * 2;

        const isInVillage = (pos) => {
            if (!chunkManager) return false;
            const cx = Math.floor(pos.x / chunkManager.chunkSize);
            const cz = Math.floor(pos.z / chunkManager.chunkSize);
            return !!chunkManager.getVillage(cx, cz);
        };

        const playerInVillage = isInVillage(player.position);

        if (this.state === 'ROAM') {
            if (dist2D < this.aggroRange && !playerInVillage) this.state = 'CHASE';
        } else if (this.state === 'CHASE' || this.state === 'ATTACK') {
            if (distFromSpawn > maxChaseDist || playerInVillage) this.state = 'RETURN';
        }

        if (this.state === 'RETURN') {
            const dir = new THREE.Vector3().subVectors(this.spawnPoint, this.group.position);
            dir.y = 0;
            const d = dir.length();
            if (d < 2) this.state = 'ROAM';
            else {
                dir.normalize();
                this.group.position.addScaledVector(dir, this.speed * 2 * delta);
                this.group.lookAt(this.spawnPoint.x, this.group.position.y, this.spawnPoint.z);
            }
        } else if (this.state === 'CHASE') {
            if (dist2D <= this.attackRange) {
                this.state = 'ATTACK';
            } else {
                const dir = new THREE.Vector3(dx, 0, dz).normalize();
                const step = dir.multiplyScalar(this.speed * delta);
                const nextPos = this.group.position.clone().add(step);
                if (isInVillage(nextPos)) this.state = 'RETURN';
                else {
                    this.group.position.copy(nextPos);
                    this.group.lookAt(player.position.x, this.group.position.y, player.position.z);
                }
            }
        } else if (this.state === 'ATTACK') {
            if (dist2D > this.attackRange + 5) this.state = 'CHASE';
            else if (this.cooldown <= 0) {
                player.takeDamage(this.damage);
                this.cooldown = 2.5;
                if (window.shakeScreen) window.shakeScreen(0.5);
            }
        }
        
        let groundY = 10;
        const gx = Math.floor(this.group.position.x), gz = Math.floor(this.group.position.z);
        if (chunkManager) {
            for (let y = 63; y >= 0; y--) {
                const v = chunkManager.getVoxelGlobal(gx, y, gz);
                if (v !== 0 && v !== 11) { groundY = Math.max(groundY, y + 1); break; }
            }
        }
        this.group.position.y = THREE.MathUtils.lerp(this.group.position.y, groundY + 4 + Math.sin(Date.now() * 0.002) * 1.5, 0.1);
    }
}

export class DroppedItem {
    constructor(scene, type, pos) {
        this.scene = scene;
        this.type = type;
        this.group = new THREE.Group();
        this.group.position.copy(pos);
        this.group.position.y += 0.5;
        let visual;
        if (type === 'sticks') {
            visual = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6), new THREE.MeshLambertMaterial({color: 0x8B4513}));
            visual.rotation.z = Math.PI/4;
        } else if (type === 'wood') visual = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.4), new THREE.MeshLambertMaterial({color: 0xe67e22}));
        else if (type === 'fruit') visual = new THREE.Mesh(new THREE.SphereGeometry(0.15), new THREE.MeshLambertMaterial({color: 0xe74c3c}));
        else if (type === 'health_potion') visual = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 0.3), new THREE.MeshLambertMaterial({color: 0xff00ff}));
        else if (type === 'dmg_booster') visual = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), new THREE.MeshLambertMaterial({color: 0xf1c40f}));
        else if (type === 'weapon_atk_plus') visual = new THREE.Mesh(new THREE.TetrahedronGeometry(0.2), new THREE.MeshLambertMaterial({color: 0xff3300}));
        else if (type === 'atk_range_plus') visual = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4), new THREE.MeshLambertMaterial({color: 0x00ffff}));
        else if (type === 'user_def_plus') visual = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.1), new THREE.MeshLambertMaterial({color: 0x0000ff}));
        else if (type === 'user_atk_plus') visual = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.4, 4), new THREE.MeshLambertMaterial({color: 0xff9900}));
        else visual = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.05, 8, 8), new THREE.MeshLambertMaterial({color: 0x2ecc71}));
        this.group.add(visual);
        this.group.add(new THREE.PointLight(visual.material.color, 0.5, 2));
        this.scene.add(this.group);
    }
    update(delta) {
        if (!this.group) return;
        this.group.rotation.y += delta * 3;
        this.group.position.y += Math.sin(Date.now() * 0.005) * 0.005;
    }
}

export class MonsterManager {
    constructor(scene) {
        this.scene = scene;
        this.monsters = [];
        this.droppedItems = [];
        this.bossTimer = 0;
    }
    spawn(playerPos, playerLevel) {
        if(this.monsters.length > 25) return;
        const r = Math.random();
        let m;
        if (r < 0.33) m = new Pika(this.scene, playerPos, playerLevel);
        else if (r < 0.66) m = new Bulba(this.scene, playerPos, playerLevel);
        else m = new Char(this.scene, playerPos, playerLevel);
        this.monsters.push(m);
    }
    spawnBoss(playerPos, playerLevel) {
        this.monsters.push(new BeholderBoss(this.scene, playerPos, playerLevel));
    }
    update(delta, player, chunkManager) {
        if (!player || !chunkManager) return;
        this.bossTimer += delta;
        if (this.bossTimer >= 180) { 
            this.spawnBoss(player.position, player.level);
            this.bossTimer = 0;
            player.showNotification("A MULTI-EYED BEHOLDER HAS SPAWNED!");
        }
        for (let i = this.monsters.length - 1; i >= 0; i--) {
            const m = this.monsters[i];
            if (!m) continue;
            m.update(delta, player, chunkManager);
            if (m.hp <= 0) {
                const types = ['sticks', 'wood', 'fruit', 'herbs', 'health_potion', 'dmg_booster', 'weapon_atk_plus', 'atk_range_plus', 'user_def_plus', 'user_atk_plus'];
                // To drop them "많이" (frequently), we can add multiple weights or increase count.
                // The prompt says "많이 넣어주고", so let's increase drop count significantly.
                const count = (m instanceof BeholderBoss ? 30 : 6); 
                for(let k=0; k<count; k++) {
                    const offset = new THREE.Vector3((Math.random()-0.5)*2.5, 0, (Math.random()-0.5)*2.5);
                    this.droppedItems.push(new DroppedItem(this.scene, types[Math.floor(Math.random()*types.length)], m.group.position.clone().add(offset)));
                }
                player.addXp(m.level * 25);
                player.score += m.level * 100;
                if (window.audioManager) window.audioManager.playVictory();
                this.monsters.splice(i, 1);
            }
        }
        for (let i = this.droppedItems.length - 1; i >= 0; i--) {
            const item = this.droppedItems[i];
            if (!item || !item.group) continue;
            item.update(delta);
            
            // Magnet effect: float towards player if close
            const dist = item.group.position.distanceTo(player.position);
            if (dist < 10) {
                const dir = new THREE.Vector3().subVectors(player.position, item.group.position).normalize();
                item.group.position.addScaledVector(dir, 8 * delta); // Magnet speed
            }

            if (dist < 2.5) { // Increased pickup range
                player.addItem(item.type, 1);
                player.showFloatingText(`+1 ${item.type}`, '#2ecc71');
                this.scene.remove(item.group);
                this.droppedItems.splice(i, 1);
            }
        }
    }
}
