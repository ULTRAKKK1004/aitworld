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
        if (stage % 10 === 0) return this.generateBossLevel(stage);
        
        const theme = LevelThemes[Math.floor((stage - 1) / 5) % LevelThemes.length];
        const width = 400 + stage * 50; // Significant increase in width
        const height = 15;
        let layout = Array(height).fill().map(() => Array(width).fill(' '));

        // Basic boundaries (Top and Sides only)
        for(let x=0; x<width; x++) { layout[0][x] = '#'; }
        for(let y=0; y<height; y++) { layout[y][0] = '#'; layout[y][width-1] = '#'; }

        // Ground with gaps (One block lower to allow more jump space)
        for(let x=1; x<width-1; x++) {
            if (x > 10 && x < width-10 && Math.random() < 0.15) {
                // Gap - goes all the way down
            } else {
                layout[height-2][x] = '#';
                layout[height-3][x] = '#';
            }
        }

        // Platforms & Obstacles
        for(let x=5; x<width-15; x+=6) {
            let ry = Math.floor(Math.random() * 5) + 5;
            let rw = Math.floor(Math.random() * 4) + 3;
            let hasItem = Math.random() < 0.3;
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
            layout[height-4][bx] = 'O'; // Portal to Bonus
        }
        if (Math.random() < 0.2) {
            let bx = Math.floor(Math.random() * (width - 20)) + 10;
            layout[height-4][bx] = 'I'; // Pipe to Underground
        }

        // Entities
        layout[height-4][5] = '@'; // Player start
        layout[height-4][width-5] = 'E'; // Exit

        const enemyTypes = ['1', '2', '3', 'M', 'F', 'W', 'U', 'S', 'b', 'v', 'g']; 
        // 1-3: Patrol, M: Missile, F: Chaser, W: Cloud, U: Sun, S: Slime, b: Bat, v: Bird, g: Dragon
        const availableEnemies = enemyTypes.slice(0, Math.min(enemyTypes.length, 3 + Math.floor(stage/5)));

        for(let x=15; x<width-15; x+=10) {
            if (Math.random() < 0.4 + (stage * 0.005)) {
                let et = availableEnemies[Math.floor(Math.random() * availableEnemies.length)];
                let ey = (et === 'W' || et === 'U' || et === 'b') ? 4 : height-4;
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
        const bossIndex = (stage / 10) % 5;
        const bosses = ['4', '5', '6', '7', '8'];
        const bossChar = bosses[Math.floor(bossIndex)];
        const width = 150; // Slightly wider boss room
        const height = 15;
        let layout = Array(height).fill().map(() => Array(width).fill(' '));
        
        for(let x=0; x<width; x++) { layout[0][x] = '#'; layout[height-2][x] = '#'; layout[height-3][x] = '#'; }
        for(let y=0; y<height; y++) { layout[y][0] = '#'; layout[y][width-1] = '#'; }

        layout[height-4][10] = '@';
        layout[height-4][width-20] = bossChar;
        layout[height-4][width-5] = 'E';
        layout[height-4][width-6] = 'D'; // Door

        return {
            stage: stage,
            name: `BOSS BATTLE ${stage/10}`,
            bgColor: "#220000",
            groundTile: "ground_boss",
            musicTheme: "boss",
            layout: layout.map(row => row.join(''))
        };
    },

    generateBonus(type, stage) {
        const width = 120; // Longer bonus
        const height = 15;
        let layout = Array(height).fill().map(() => Array(width).fill(' '));
        for(let x=0; x<width; x++) { layout[0][x] = '#'; layout[height-2][x] = '#'; }
        for(let y=0; y<height; y++) { layout[y][0] = '#'; layout[y][width-1] = '#'; }

        if (type === 'sky') {
            // Sky bonus: many items, high platforms
            for(let x=5; x<width-5; x+=4) {
                let ry = Math.floor(Math.random() * 6) + 3;
                layout[ry][x] = '?';
                layout[ry+1][x] = '-';
            }
        } else {
            // Underground bonus: many bricks, chests
            for(let x=5; x<width-5; x+=3) {
                for(let y=4; y<height-3; y+=3) {
                    if (Math.random() < 0.6) layout[y][x] = 'B';
                    if (Math.random() < 0.2) layout[y][x] = 'C';
                }
            }
        }

        layout[height-4][5] = '@';
        layout[height-4][width-5] = 'E';

        return {
            stage: stage,
            isBonus: true,
            name: type === 'sky' ? "Sky Heaven" : "Hidden Treasury",
            bgColor: type === 'sky' ? "#87CEEB" : "#111111",
            groundTile: type === 'sky' ? "platform" : "ground_dirt",
            musicTheme: "grass",
            layout: layout.map(row => row.join(''))
        };
    }
};
