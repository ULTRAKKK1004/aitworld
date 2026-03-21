const fs = require('fs');
global.window = { AudioContext: class {}, webkitAudioContext: class {} };
global.document = { createElement: () => ({ getContext: () => ({ fillRect: ()=>{}, arc: ()=>{} }), width: 0, height: 0 }) };
global.Phaser = {
    Scene: class {},
    Physics: { Arcade: { Sprite: class {} } },
    Game: class { constructor() { this.events = { on: ()=>{} }; } },
    Scale: { FIT: 1, CENTER_BOTH: 1 }
};
const scripts = ['audio.js', 'assets.js', 'levels.js', 'entities.js', 'game.js'];
for (const s of scripts) {
    console.log("Evaluating", s);
    const code = fs.readFileSync('public/games/hero-quest/js/' + s, 'utf8');
    try {
        eval(code);
    } catch(e) {
        console.error("Error in", s, e);
    }
}
