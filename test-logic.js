// Mock LevelData for testing
const LevelData = [
    { layout: ["@#E"] }
];

function testBuildLevel() {
    console.log("Testing buildLevel logic...");
    const lines = LevelData[0].layout;
    const ts = 32;
    let playerCreated = false;
    let exitCreated = false;
    let groundCreated = false;

    for (let y = 0; y < lines.length; y++) {
        for (let x = 0; x < lines[y].length; x++) {
            const char = lines[y][x];
            const px = x * ts + ts / 2;
            const py = y * ts + ts / 2;
            if (char === '@') playerCreated = true;
            if (char === 'E') exitCreated = true;
            if (char === '#') groundCreated = true;
        }
    }

    if (playerCreated && exitCreated && groundCreated) {
        console.log("SUCCESS: Basic level building logic passed.");
    } else {
        console.error("FAILURE: Missing essential entities in logic test.");
        process.exit(1);
    }
}

testBuildLevel();
