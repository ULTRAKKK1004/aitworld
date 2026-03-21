const fs = require('fs');

const generateLevel = (stage, type) => {
    const width = 120 + stage * 30;
    const height = 15;
    let layout = Array(height).fill("").map(() => Array(width).fill(" "));

    // Ground
    for (let x = 0; x < width; x++) {
        layout[height - 1][x] = "#";
        layout[height - 2][x] = "#";
    }

    // Borders
    for(let y=0; y<height; y++){ layout[y][0] = "#"; layout[y][width-1] = "#"; }

    layout[height - 3][width - 3] = "E";
    layout[height - 3][2] = "@";

    if (type === "boss") {
        layout[height - 3][Math.floor(width / 2)] = (stage === 10) ? "8" : (stage === 8 ? "5" : "4");
        if(stage === 10) layout[height - 3][Math.floor(width / 2) + 2] = "P";
    } else {
        for (let x = 10; x < width - 15; x++) {
            // 정밀 점프가 필요한 넓은 낭떠러지 (2~3칸)
            if (Math.random() < 0.12) {
                const pitWidth = Math.floor(Math.random() * 2) + 2;
                for(let p=0; p<pitWidth; p++) {
                    layout[height - 1][x+p] = " ";
                    layout[height - 2][x+p] = " ";
                }
                x += pitWidth + 2;
                continue;
            }
            
            if (Math.random() < 0.3) {
                let h = height - 5 - Math.floor(Math.random() * 3);
                let len = 4 + Math.floor(Math.random() * 4);
                for (let i = 0; i < len; i++) {
                    if (x + i < width - 10) layout[h][x + i] = Math.random() < 0.15 ? "?" : (Math.random() < 0.2 ? "B" : "-");
                }
                x += len;
            }

            if (layout[height - 1][x] === "#" && Math.random() < 0.2) {
                let r = Math.random();
                if (r < 0.4) layout[height - 3][x] = "1"; // Patrol
                else if (r < 0.7) layout[height - 3][x] = "M"; // Missile Enemy
                else layout[height - 3][x] = "F"; // Chaser
            }

            if (Math.random() < 0.06) layout[height - 9][x] = Math.random() < 0.5 ? "W" : "U";
        }
    }
    return layout.map(row => row.join(""));
};

const stages = [];
for (let i = 1; i <= 10; i++) {
    let type = (i === 4 || i === 8 || i === 10) ? "boss" : "normal";
    let bgColors = ["#87CEEB", "#2E8B57", "#F4A460", "#2F4F4F", "#191970", "#8B0000"];
    let tiles = ["ground_grass", "ground_dirt", "ground_sand", "ground_swamp", "ground_ice", "ground_volcano"];
    let themeIdx = (i - 1) % bgColors.length;
    stages.push({
        stage: i,
        name: type === "boss" ? `EXTREME BOSS` : `World ${i}`,
        bgColor: type === "boss" ? "#220000" : bgColors[themeIdx],
        groundTile: type === "boss" ? "ground_boss" : tiles[themeIdx],
        musicTheme: type === "boss" ? "boss" : (i % 2 === 0 ? "dark" : "grass"),
        layout: generateLevel(i, type)
    });
}

const fileContent = `var LevelData = ${JSON.stringify(stages, null, 4)};`;
fs.writeFileSync('public/games/hero-quest/js/levels.js', fileContent);
console.log("levels.js updated with wider pits and missile enemies!");
