// Hero's Quest DX Final Asset Engine
var AssetGenerator = {
    generateAll(scene) {
        try {
            console.log("AssetGenerator: Re-building all textures...");
            // Hero
            this.draw(scene, 'hero', 40, 40, (ctx) => {
                ctx.fillStyle = '#0055FF'; ctx.fillRect(8, 12, 24, 24);
                ctx.fillStyle = '#FFE4C4'; ctx.fillRect(12, 8, 20, 16);
                ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(26, 14, 3, 0, 7); ctx.fill();
                ctx.fillStyle = '#FF2222'; ctx.fillRect(10, 2, 24, 8);
            });
            // Princess
            this.draw(scene, 'princess', 40, 40, (ctx) => {
                ctx.fillStyle = '#FF69B4'; ctx.beginPath(); ctx.moveTo(20, 10); ctx.lineTo(5, 38); ctx.lineTo(35, 38); ctx.fill();
                ctx.fillStyle = '#FFE4C4'; ctx.beginPath(); ctx.arc(20, 15, 8, 0, 7); ctx.fill();
                ctx.fillStyle = '#FFD700'; ctx.beginPath(); ctx.moveTo(15, 8); ctx.lineTo(20, 2); ctx.lineTo(25, 8); ctx.fill();
            });
            // Regular Enemies
            const drawE = (k, c, eyeColor = '#fff') => this.draw(scene, k, 40, 40, (ctx) => {
                ctx.fillStyle = c; 
                // Draw a more complex body than just a circle
                ctx.beginPath();
                ctx.moveTo(20, 10);
                ctx.bezierCurveTo(35, 10, 35, 35, 20, 35);
                ctx.bezierCurveTo(5, 35, 5, 10, 20, 10);
                ctx.fill();
                // Eyes
                ctx.fillStyle = eyeColor;
                ctx.beginPath(); ctx.arc(15, 18, 4, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(25, 18, 4, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#000';
                ctx.beginPath(); ctx.arc(15, 18, 2, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(25, 18, 2, 0, Math.PI*2); ctx.fill();
            });
            drawE('enemy1', '#8B4513'); drawE('enemy2', '#00AA00'); drawE('enemy3', '#FF0000');
            
            // New Diverse Enemies
            // Slime-like
            this.draw(scene, 'slime', 40, 40, (ctx) => {
                ctx.fillStyle = '#00FF7F'; ctx.beginPath();
                ctx.moveTo(5, 35); ctx.quadraticCurveTo(20, 5, 35, 35); ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(15, 25, 3, 0, 7); ctx.arc(25, 25, 3, 0, 7); ctx.fill();
            });
            // Bat-like (Flying)
            this.draw(scene, 'bat', 40, 40, (ctx) => {
                ctx.fillStyle = '#4B0082'; ctx.beginPath();
                ctx.moveTo(20, 15); ctx.lineTo(5, 10); ctx.lineTo(10, 25); ctx.lineTo(20, 20);
                ctx.lineTo(30, 25); ctx.lineTo(35, 10); ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#FF0000'; ctx.beginPath(); ctx.arc(17, 18, 2, 0, 7); ctx.arc(23, 18, 2, 0, 7); ctx.fill();
            });
            // Bird-like (Flying)
            this.draw(scene, 'bird', 40, 40, (ctx) => {
                ctx.fillStyle = '#FFD700'; ctx.beginPath(); ctx.arc(20, 20, 12, 0, 7); ctx.fill();
                ctx.fillStyle = '#FF4500'; ctx.beginPath(); ctx.moveTo(25, 18); ctx.lineTo(35, 20); ctx.lineTo(25, 22); ctx.fill();
                ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(18, 17, 2, 0, 7); ctx.fill();
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(10, 20); ctx.lineTo(5, 10); ctx.stroke();
            });
            // Dragon-like (Mini Boss or Strong Enemy)
            this.draw(scene, 'dragon', 60, 60, (ctx) => {
                ctx.fillStyle = '#FF0000'; ctx.beginPath(); ctx.moveTo(10, 50); ctx.lineTo(30, 10); ctx.lineTo(50, 50); ctx.fill();
                ctx.fillStyle = '#FFA500'; ctx.beginPath(); ctx.arc(30, 25, 15, 0, 7); ctx.fill();
                ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(25, 20, 3, 0, 7); ctx.arc(35, 20, 3, 0, 7); ctx.fill();
                ctx.fillStyle = '#FFFF00'; ctx.beginPath(); ctx.moveTo(30, 30); ctx.lineTo(45, 35); ctx.lineTo(30, 40); ctx.fill();
            });

            // Scary Organic Bosses (120x120)
            const drawScaryBoss = (k, primaryColor, eyeColor, featureType) => this.draw(scene, k, 120, 120, (ctx) => {
                const center = 60;
                // Body (Organic blob shape)
                ctx.fillStyle = primaryColor;
                ctx.beginPath();
                ctx.moveTo(center + 40, center);
                for (let a = 0; a < Math.PI * 2; a += 0.4) {
                    const r = 40 + Math.sin(a * 5) * 10;
                    ctx.lineTo(center + Math.cos(a) * r, center + Math.sin(a) * r);
                }
                ctx.closePath(); ctx.fill();
                ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.stroke();

                // Features
                if (featureType === 'spikes') {
                    ctx.fillStyle = '#ccc';
                    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
                        ctx.beginPath();
                        ctx.moveTo(center + Math.cos(a) * 45, center + Math.sin(a) * 45);
                        ctx.lineTo(center + Math.cos(a) * 60, center + Math.sin(a) * 60);
                        ctx.lineTo(center + Math.cos(a + 0.2) * 45, center + Math.sin(a + 0.2) * 45);
                        ctx.fill();
                    }
                } else if (featureType === 'tentacles') {
                    ctx.strokeStyle = primaryColor; ctx.lineWidth = 8;
                    for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
                        ctx.beginPath();
                        ctx.moveTo(center + Math.cos(a) * 40, center + Math.sin(a) * 40);
                        ctx.quadraticCurveTo(center + Math.cos(a) * 80, center + Math.sin(a + 0.5) * 80, center + Math.cos(a + 0.2) * 55, center + Math.sin(a + 0.2) * 55);
                        ctx.stroke();
                    }
                } else { // 'aura' or 'glow'
                    ctx.shadowBlur = 15; ctx.shadowColor = eyeColor;
                    ctx.strokeStyle = eyeColor; ctx.lineWidth = 4;
                    ctx.beginPath(); ctx.arc(center, center, 55, 0, Math.PI * 2); ctx.stroke();
                    ctx.shadowBlur = 0;
                }

                // Eyes (Glowing & Menacing)
                ctx.fillStyle = '#fff';
                ctx.beginPath(); ctx.ellipse(center - 15, center - 10, 12, 8, 0.2, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.ellipse(center + 15, center - 10, 12, 8, -0.2, 0, Math.PI * 2); ctx.fill();
                
                ctx.fillStyle = eyeColor;
                ctx.beginPath(); ctx.arc(center - 15, center - 10, 5, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(center + 15, center - 10, 5, 0, Math.PI * 2); ctx.fill();

                // Mouth
                ctx.fillStyle = '#300';
                ctx.beginPath();
                ctx.moveTo(center - 20, center + 15);
                ctx.quadraticCurveTo(center, center + 35, center + 20, center + 15);
                ctx.lineTo(center + 15, center + 12);
                ctx.lineTo(center - 15, center + 12);
                ctx.closePath(); ctx.fill();
                
                // Teeth
                ctx.fillStyle = '#fff';
                for(let i=-15; i<=15; i+=10) {
                    ctx.beginPath(); ctx.moveTo(center + i, center + 15); ctx.lineTo(center + i + 3, center + 22); ctx.lineTo(center + i + 6, center + 15); ctx.fill();
                }
            });

            drawScaryBoss('boss1', '#2d5a27', '#ff0000', 'spikes');
            drawScaryBoss('boss2', '#3b5998', '#ffff00', 'tentacles');
            drawScaryBoss('boss3', '#8b4513', '#00ff00', 'spikes');
            drawScaryBoss('boss_mid', '#4b0082', '#ff00ff', 'aura');
            drawScaryBoss('boss_final', '#1a1a1a', '#ff0000', 'aura');
            // Projectiles & Traps
            this.draw(scene, 'missile', 30, 20, (ctx) => { ctx.fillStyle = '#f00'; ctx.fillRect(0, 5, 20, 10); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(20, 5); ctx.lineTo(30, 10); ctx.lineTo(20, 15); ctx.fill(); });
            this.draw(scene, 'mine', 24, 24, (ctx) => { ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(12, 12, 10, 0, 7); ctx.fill(); ctx.fillStyle = '#f00'; ctx.beginPath(); ctx.arc(12, 12, 4, 0, 7); ctx.fill(); });
            this.draw(scene, 'item_box', 32, 32, (ctx) => { ctx.fillStyle = '#FFD700'; ctx.fillRect(0, 0, 32, 32); ctx.fillStyle = '#000'; ctx.font = 'bold 24px Arial'; ctx.fillText('?', 8, 25); });
            this.draw(scene, 'brick', 32, 32, (ctx) => { ctx.fillStyle = '#8B4513'; ctx.fillRect(0, 0, 32, 32); ctx.strokeStyle = '#000'; ctx.strokeRect(0, 0, 32, 32); });
            this.draw(scene, 'pipe', 64, 64, (ctx) => {
                ctx.fillStyle = '#008000'; ctx.fillRect(10, 20, 44, 44);
                ctx.fillStyle = '#006400'; ctx.fillRect(5, 0, 54, 20);
                ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.strokeRect(10, 20, 44, 44); ctx.strokeRect(5, 0, 54, 20);
            });
            this.draw(scene, 'portal', 64, 64, (ctx) => {
                const grad = ctx.createRadialGradient(32, 32, 5, 32, 32, 30);
                grad.addColorStop(0, '#fff'); grad.addColorStop(0.5, '#00f'); grad.addColorStop(1, '#000');
                ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(32, 32, 30, 0, 7); ctx.fill();
            });
            this.draw(scene, 'door', 80, 100, (ctx) => { ctx.fillStyle = '#4A2E1B'; ctx.fillRect(0, 0, 80, 100); ctx.fillStyle = '#8B4513'; ctx.fillRect(8, 8, 64, 92); });
            this.draw(scene, 'fireball', 24, 24, (ctx) => { ctx.fillStyle = '#FF4500'; ctx.beginPath(); ctx.arc(12, 12, 10, 0, 7); ctx.fill(); });
            this.draw(scene, 'cloud', 50, 40, (ctx) => { ctx.fillStyle = '#eee'; ctx.beginPath(); ctx.arc(15, 25, 12, 0, 7); ctx.arc(25, 15, 15, 0, 7); ctx.arc(35, 25, 12, 0, 7); ctx.fill(); });
            this.draw(scene, 'sun', 40, 40, (ctx) => { ctx.fillStyle = '#FF4500'; ctx.beginPath(); ctx.arc(20, 20, 15, 0, 7); ctx.fill(); ctx.strokeStyle = '#FF0'; ctx.lineWidth = 3; ctx.stroke(); });
            // Special Items
            const drawSI = (k, c, t) => this.draw(scene, k, 32, 32, (ctx) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(16, 16, 14, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = 'bold 16px Arial'; ctx.fillText(t, 8, 22); });
            drawSI('item_health', '#FF69B4', 'H'); drawSI('item_invincible', '#FFFF00', 'I'); drawSI('item_life', '#00FF00', 'L'); drawSI('item_mega', '#FF4500', 'M'); drawSI('item_score', '#00FFFF', '$'); drawSI('item_double', '#FFA500', 'X2'); drawSI('item_reverse', '#8A2BE2', 'R');
            this.draw(scene, 'coin', 32, 32, (ctx) => { ctx.fillStyle = '#FFD700'; ctx.beginPath(); ctx.arc(16, 16, 10, 0, 7); ctx.fill(); });
            const drawT = (k, c1, c2) => this.draw(scene, k, 32, 32, (ctx) => { ctx.fillStyle = c1; ctx.fillRect(0, 0, 32, 32); ctx.strokeStyle = c2; ctx.strokeRect(1, 1, 30, 30); });
            drawT('ground_grass', '#228B22', '#145A14'); drawT('ground_dirt', '#6B4226', '#4A2E1B'); drawT('ground_sand', '#EDC9AF', '#D1A882'); drawT('ground_ice', '#A5F2F3', '#7AC2C3'); drawT('ground_volcano', '#333', '#111'); drawT('ground_boss', '#4A0000', '#220000'); drawT('platform', '#8B4513', '#5C2D0C');
        } catch (e) { console.error("Asset Engine Error:", e); }
    },
    draw(scene, key, w, h, callback) {
        if (scene.textures.exists(key)) scene.textures.remove(key); // 중복 방지
        const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d'); callback(ctx); scene.textures.addCanvas(key, canvas);
    }
};
