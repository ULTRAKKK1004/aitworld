var LevelData = []; // Legacy support if needed

var LevelThemes = [
    { name: "Grasslands", bgColor: "#87CEEB", groundTile: "ground_grass", musicTheme: "grass" },
    { name: "Scorched Desert", bgColor: "#F4A460", groundTile: "ground_sand", musicTheme: "grass" },
    { name: "Frozen Tundra", bgColor: "#E0FFFF", groundTile: "ground_ice", musicTheme: "grass" },
    { name: "Volcanic Pit", bgColor: "#4B0000", groundTile: "ground_volcano", musicTheme: "dark" },
    { name: "Ancient Forest", bgColor: "#2E8B57", groundTile: "ground_dirt", musicTheme: "dark" },
    { name: "Sky Palace", bgColor: "#00BFFF", groundTile: "platform", musicTheme: "grass" },
    { name: "Deep Caves", bgColor: "#1A1A1A", groundTile: "ground_boss", musicTheme: "dark" }
];

var LevelGenerator = {
    generate(stage) {
        if (stage % 3 === 0) return this.generateBossLevel(stage);
        
        const themeIndex = Math.floor((stage - 1) / 3) % LevelThemes.length;
        const theme = LevelThemes[themeIndex] || LevelThemes[0];
        const width = Math.floor(300 + stage * 70); // Reduced width (70% of original)
        const height = 15;
        let layout = Array(height).fill().map(() => Array(width).fill(' '));

        // Basic boundaries
        for(let x=0; x<width; x++) { layout[0][x] = '#'; }
        for(let y=0; y<height; y++) { layout[y][0] = '#'; layout[y][width-1] = '#'; }

        // Ground with gaps (Significant difficulty increase)
        let gapRemaining = 0;
        for(let x=1; x<width-1; x++) {
            if (gapRemaining > 0) {
                gapRemaining--;
                continue;
            }

            const gapChance = 0.08 + (stage * 0.02); // Faster gap probability increase
            if (x > 15 && x < width-15 && Math.random() < gapChance) {
                gapRemaining = Math.floor(Math.random() * 4) + 2; 
                continue;
            }

            layout[height-1][x] = '#';
        }

        // Platforms & Obstacles
        for(let x=5; x<width-15; x+=6) {
            let ry = Math.floor(Math.random() * 5) + 5;
            let rw = Math.floor(Math.random() * 4) + 3;
            let hasItem = Math.random() < 0.2; 
            let itemX = x + Math.floor(rw/2);

            for(let i=0; i<rw; i++) {
                if (x+i < width-10) {
                    if (hasItem && x+i === itemX) {
                        layout[ry][x+i] = (Math.random() < 0.5 ? '?' : 'B');
                    } else {
                        layout[ry][x+i] = '-';
                    }
                }
            }
        }

        // Bonus Entrances
        if (Math.random() < 0.3) {
            let bx = Math.floor(Math.random() * (width - 20)) + 10;
            layout[height-2][bx] = 'O'; 
        }

        // Entities
        layout[height-2][5] = '@'; 
        layout[height-2][width-5] = 'E'; 

        const enemyTypes = ['1', '2', '3', 'M', 'F', 'W', 'U', 'S', 'b', 'v', 'g', 'H', 'w']; 
        const availableEnemies = enemyTypes.slice(0, Math.min(enemyTypes.length, 3 + Math.floor(stage/2))); 

        for(let x=15; x<width-15; x+=10) {
            if (Math.random() < 0.35 + (stage * 0.03)) { 
                let et = availableEnemies[Math.floor(Math.random() * availableEnemies.length)];
                let ey = (et === 'W' || et === 'U' || et === 'b' || et === 'H') ? 1 : height-2; 
                if (layout[ey][x] === ' ') layout[ey][x] = et;
            }
        }

        return {
            stage: stage,
            name: `${theme.name} - Stage ${stage}`,
            bgColor: theme.bgColor,
            groundTile: theme.groundTile,
            musicTheme: theme.musicTheme,
            layout: layout.map(row => row.join(''))
        };
    },

    generateBossLevel(stage) {
        const bossIdx = Math.max(0, Math.floor(stage / 3) - 1) % 5;
        const bosses = ['4', '5', '6', '7', '8'];
        const bossChar = bosses[bossIdx];
        const width = 120;
        const height = 15;
        let layout = Array(height).fill().map(() => Array(width).fill(' '));
        
        for(let x=0; x<width; x++) { layout[0][x] = '#'; layout[height-1][x] = '#'; }
        for(let y=0; y<height; y++) { layout[y][0] = '#'; layout[y][width-1] = '#'; }

        layout[height-2][10] = '@';
        layout[height-2][width-20] = bossChar;
        layout[height-2][width-5] = 'E';
        layout[height-2][width-6] = 'D'; 

        return {
            stage: stage,
            name: `BOSS BATTLE ${Math.floor(stage/3)}`,
            bgColor: "#220000",
            groundTile: "ground_boss",
            musicTheme: "boss",
            layout: layout.map(row => row.join(''))
        };
    },

    generateBonus(type, stage) {
        const s = Math.max(1, stage || 1);
        const width = 120; // Longer bonus
        const height = 15;
        let layout = Array(height).fill().map(() => Array(width).fill(' '));
        for(let x=0; x<width; x++) { layout[0][x] = '#'; layout[height-2][x] = '#'; }
        for(let y=0; y<height; y++) { layout[y][0] = '#'; layout[y][width-1] = '#'; }

        // Sky bonus only: many items, high platforms
        for(let x=5; x<width-5; x+=4) {
            let ry = Math.floor(Math.random() * 5) + 3;
            layout[ry][x] = '?';
            // Remove the platform directly below the item box
            layout[ry+2][x] = '-'; 
        }

        layout[height-4][5] = '@';
        layout[height-4][width-5] = 'E';

        return {
            stage: stage,
            isBonus: true,
            name: "Sky Heaven",
            bgColor: "#87CEEB",
            groundTile: "platform",
            musicTheme: "grass",
            layout: layout.map(row => row.join(''))
        };
    }
};
