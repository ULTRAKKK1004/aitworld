const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'data.db'));

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    google_id TEXT UNIQUE,
    email TEXT,
    username TEXT UNIQUE,
    role TEXT DEFAULT 'GENERAL', -- PENDING, GENERAL, ADMIN
    best_score INTEGER DEFAULT 0,
    airplane_best_score INTEGER DEFAULT 0,
    brick_best_score INTEGER DEFAULT 0,
    hero_best_score INTEGER DEFAULT 0,
    paper_rush_best_score INTEGER DEFAULT 0,
    mc_world_best_score INTEGER DEFAULT 0,
    total_score INTEGER DEFAULT 0,
    brick_attempts INTEGER DEFAULT 0,
    airplane_attempts INTEGER DEFAULT 0,
    hero_attempts INTEGER DEFAULT 0,
    mc_world_attempts INTEGER DEFAULT 0,
    paper_rush_attempts INTEGER DEFAULT 0,
    mc_world_save TEXT,
    mc_world_level INTEGER DEFAULT 1,
    mc_world_info TEXT,
    airplane_save TEXT,
    airplane_level INTEGER DEFAULT 1,
    airplane_shield INTEGER DEFAULT 0,
    airplane_score_multiplier REAL DEFAULT 1.0,
    airplane_item TEXT DEFAULT 'basic',
    airplane_missile_multiplier REAL DEFAULT 1.0,
    brick_paddle_multiplier REAL DEFAULT 1.0,
    brick_score_multiplier REAL DEFAULT 1.0,
    brick_item TEXT DEFAULT 'basic',
    brick_ball_damage INTEGER DEFAULT 1,
    brick_respawns INTEGER DEFAULT 10,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    total_spent INTEGER DEFAULT 0,
    gacha_draws_used INTEGER DEFAULT 0,
    hero_score_multiplier REAL DEFAULT 1.0,
    mc_world_score_multiplier REAL DEFAULT 1.0,
    created_at DATETIME DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%S', 'now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS shop_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price INTEGER NOT NULL,
    game_type TEXT, -- airplane, brick, hero, etc.
    item_key TEXT UNIQUE, -- internal identifier
    category TEXT DEFAULT 'consumable' -- consumable, permanent
  );

  CREATE TABLE IF NOT EXISTS user_purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    item_id INTEGER,
    quantity INTEGER DEFAULT 1,
    purchased_at DATETIME DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (item_id) REFERENCES shop_items(id)
  );

  CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    score INTEGER,
    game_type TEXT DEFAULT 'general',
    created_at DATETIME DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Initialize default settings
const initSettings = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
initSettings.run('event_activation', 'false');

// Helper for adding columns safely
function addColumn(table, column, type) {
  try {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`).run();
    console.log(`[DB] Column ${column} added to ${table}.`);
  } catch (e) {
    if (e.message.includes('duplicate column name')) {
      // Column already exists
    } else {
      console.error(`[DB Error] Failed to add column ${column}:`, e.message);
    }
  }
}

// Ensure all columns exist
addColumn('users', 'airplane_best_score', 'INTEGER NOT NULL DEFAULT 0');
addColumn('users', 'brick_best_score', 'INTEGER NOT NULL DEFAULT 0');
addColumn('users', 'hero_best_score', 'INTEGER NOT NULL DEFAULT 0');
addColumn('users', 'mc_world_best_score', 'INTEGER NOT NULL DEFAULT 0');
addColumn('users', 'mc_world_attempts', 'INTEGER NOT NULL DEFAULT 0');
addColumn('users', 'mc_world_save', 'TEXT');
addColumn('users', 'mc_world_level', 'INTEGER DEFAULT 1');
addColumn('users', 'mc_world_info', 'TEXT');
addColumn('users', 'magicrush_best_score', 'INTEGER NOT NULL DEFAULT 0');
addColumn('users', 'magicrush_attempts', 'INTEGER NOT NULL DEFAULT 0');
addColumn('users', 'paper_rush_best_score', 'INTEGER NOT NULL DEFAULT 0');
addColumn('users', 'paper_rush_attempts', 'INTEGER NOT NULL DEFAULT 0');
addColumn('users', 'paper_rush_level', 'INTEGER NOT NULL DEFAULT 1');
addColumn('users', 'paper_rush_shield', 'INTEGER NOT NULL DEFAULT 0');
addColumn('users', 'paper_rush_multiplier', 'INTEGER NOT NULL DEFAULT 1');
addColumn('users', 'paper_rush_platform', 'INTEGER NOT NULL DEFAULT 0');
addColumn('users', 'airplane_save', 'TEXT');
addColumn('users', 'airplane_level', 'INTEGER NOT NULL DEFAULT 1');
addColumn('users', 'airplane_shield', 'INTEGER NOT NULL DEFAULT 0');
addColumn('users', 'brick_paddle_multiplier', 'REAL DEFAULT 1.0');
addColumn('users', 'brick_score_multiplier', 'REAL DEFAULT 1.0');
addColumn('users', 'brick_item', "TEXT DEFAULT 'basic'");
addColumn('users', 'brick_ball_damage', 'INTEGER DEFAULT 1');
addColumn('users', 'airplane_shield', 'INTEGER NOT NULL DEFAULT 0');
addColumn('users', 'airplane_score_multiplier', 'REAL DEFAULT 1.0');
addColumn('users', 'airplane_item', "TEXT DEFAULT 'basic'");
addColumn('users', 'airplane_missile_multiplier', 'REAL DEFAULT 1.0');
addColumn('users', 'hero_hp', 'INTEGER DEFAULT 5');
addColumn('users', 'hero_mana_regen', 'REAL DEFAULT 0.05');
addColumn('users', 'hero_speed', 'INTEGER DEFAULT 500');
addColumn('users', 'hero_max_jumps', 'INTEGER DEFAULT 2');
addColumn('users', 'hero_shield', 'INTEGER DEFAULT 0');
addColumn('users', 'total_spent', 'INTEGER DEFAULT 0');
addColumn('users', 'gacha_draws_used', 'INTEGER DEFAULT 0');
addColumn('users', 'hero_score_multiplier', 'REAL DEFAULT 1.0');
addColumn('users', 'mc_world_score_multiplier', 'REAL DEFAULT 1.0');
addColumn('users', 'brick_ball_level', 'INTEGER DEFAULT 1');
addColumn('users', 'brick_ball_bonus_damage', 'INTEGER DEFAULT 0');

// Initial Shop Items
const items = [
  // Airplane Items
  ['HP Potion (Airplane)', 'Restores HP in Airplane Shooter', 500, 'airplane-shooter', 'airplane_hp_potion', 'consumable'],
  ['Shield Battery', 'Gives extra shield for Airplane', 1000, 'airplane-shooter', 'airplane_shield', 'consumable'],
  
  // Brick Crasher Items
  ['Extra Ball', 'One more ball for Brick Crasher', 300, 'brick', 'brick_extra_ball', 'consumable'],
  ['Wide Paddle', 'Increases paddle width for one game', 800, 'brick', 'brick_wide_paddle', 'consumable'],
  ['Giant Ball Upgrade', 'Increases Ball Level and Damage (+1 Damage per level, max +5)', 5000, 'brick', 'brick_giant_ball', 'permanent'],
  
  // Hero Quest Items
  ['Mana Potion', 'Restores Mana for Hero Quest', 600, 'hero', 'hero_mana_potion', 'consumable'],
  ['Resurrection Stone', 'Respawn where you died', 2000, 'hero', 'hero_revive', 'consumable'],
  
  // MC World Items
  ['TNT Block (x5)', 'Pack of 5 explosive blocks', 1500, 'mc-world', 'mc_tnt_pack', 'consumable'],
  ['Magic Seeds', 'Fast growing special plants', 700, 'mc-world', 'mc_seeds', 'consumable'],
  ['Golden Sword', 'Tier 5 Sword from the start', 3000, 'mc-world', 'mc_gold_sword', 'permanent'],
  ['Dragon Bow', 'Tier 5 Bow from the start', 3000, 'mc-world', 'mc_dragon_bow', 'permanent'],
  ['Warrior Sword', 'Tier 7 Sword from the start', 10000, 'mc-world', 'mc_warrior_sword', 'permanent'],
  ['Musket', 'Tier 7 Bow from the start', 1000000, 'mc-world', 'mc_musket', 'permanent'],
  ['Warrior Long Sword', 'Tier 10 Sword from the start', 30000, 'mc-world', 'mc_warrior_long_sword', 'permanent'],
  ['Pistol', 'Tier 10 Bow from the start', 20000000, 'mc-world', 'mc_pistol', 'permanent'],
  ['Warrior Dual Swords', 'Tier 13 Sword from the start', 80000, 'mc-world', 'mc_warrior_dual_swords', 'permanent'],
  ['Rifle', 'Tier 13 Bow from the start', 50000000, 'mc-world', 'mc_rifle', 'permanent'],
  ['Electronic Sword', 'Tier 16 Sword from the start', 200000, 'mc-world', 'mc_electronic_sword', 'permanent'],
  ['Bazooka', 'Tier 16 Bow from the start', 100000000, 'mc-world', 'mc_bazooka', 'permanent'],
  ['Laser Sword', 'Tier 19 Sword from the start', 300000000, 'mc-world', 'mc_laser_sword', 'permanent'],
  ['Weapon Atk Scroll', 'Increases weapon attack bonus by 1', 1200, 'mc-world', 'mc_atk_scroll', 'consumable'],
  ['Attack Range Scroll', 'Increases attack range bonus by 1', 1000, 'mc-world', 'mc_range_scroll', 'consumable'],
  ['Defense Scroll', 'Increases defense bonus by 1', 1000, 'mc-world', 'mc_def_scroll', 'consumable'],

  // Paper Rush Items
  ['Wind Boost', 'Extra lift in Paper Rush', 400, 'paper_rush', 'paper_wind_boost', 'consumable'],
  ['Golden Glider', 'Increases score multiplier permanently', 15000, 'paper_rush', 'paper_golden_glider', 'permanent']
];

const insertItem = db.prepare('INSERT OR IGNORE INTO shop_items (name, description, price, game_type, item_key, category) VALUES (?, ?, ?, ?, ?, ?)');
items.forEach(item => insertItem.run(...item));

// Data migration
db.exec(`
  UPDATE users SET 
    airplane_best_score = CAST(IFNULL(airplane_best_score, 0) AS INTEGER),
    airplane_score_multiplier = CAST(IFNULL(airplane_score_multiplier, 1.0) AS REAL),
    airplane_item = IFNULL(airplane_item, 'basic'),
    airplane_missile_multiplier = CAST(IFNULL(airplane_missile_multiplier, 1.0) AS REAL),
    brick_best_score = CAST(IFNULL(brick_best_score, 0) AS INTEGER),

    brick_paddle_multiplier = CAST(IFNULL(brick_paddle_multiplier, 1.0) AS REAL),
    brick_score_multiplier = CAST(IFNULL(brick_score_multiplier, 1.0) AS REAL),
    brick_item = IFNULL(brick_item, 'basic'),
    brick_ball_damage = CAST(IFNULL(brick_ball_damage, 1) AS INTEGER),
    brick_respawns = CAST(IFNULL(brick_respawns, 10) AS INTEGER),
    hero_best_score = CAST(IFNULL(hero_best_score, 0) AS INTEGER),
    hero_hp = CAST(IFNULL(hero_hp, 5) AS INTEGER),
    hero_mana_regen = CAST(IFNULL(hero_mana_regen, 0.05) AS REAL),
    hero_speed = CAST(IFNULL(hero_speed, 500) AS INTEGER),
    hero_max_jumps = CAST(IFNULL(hero_max_jumps, 2) AS INTEGER),
    hero_shield = CAST(IFNULL(hero_shield, 0) AS INTEGER),
    mc_world_best_score = CAST(IFNULL(mc_world_best_score, 0) AS INTEGER),
    mc_world_level = CAST(IFNULL(mc_world_level, 1) AS INTEGER),
    mc_world_attempts = CAST(IFNULL(mc_world_attempts, 0) AS INTEGER),
    magicrush_best_score = CAST(IFNULL(magicrush_best_score, 0) AS INTEGER),
    magicrush_attempts = CAST(IFNULL(magicrush_attempts, 0) AS INTEGER),
    paper_rush_best_score = CAST(IFNULL(paper_rush_best_score, 0) AS INTEGER),
    paper_rush_level = CAST(IFNULL(paper_rush_level, 1) AS INTEGER),
    paper_rush_shield = CAST(IFNULL(paper_rush_shield, 0) AS INTEGER),
    paper_rush_multiplier = CAST(IFNULL(paper_rush_multiplier, 1) AS INTEGER),
    paper_rush_platform = CAST(IFNULL(paper_rush_platform, 0) AS INTEGER),
    best_score = CAST(IFNULL(best_score, 0) AS INTEGER),
    total_score = CAST(IFNULL(total_score, 0) AS INTEGER),
    brick_attempts = CAST(IFNULL(brick_attempts, 0) AS INTEGER),
    airplane_attempts = CAST(IFNULL(airplane_attempts, 0) AS INTEGER),
    hero_attempts = CAST(IFNULL(hero_attempts, 0) AS INTEGER),
    paper_rush_attempts = CAST(IFNULL(paper_rush_attempts, 0) AS INTEGER),
    wins = CAST(IFNULL(wins, 0) AS INTEGER),
    losses = CAST(IFNULL(losses, 0) AS INTEGER),
    total_spent = CAST(IFNULL(total_spent, 0) AS INTEGER),
    brick_ball_level = CAST(IFNULL(brick_ball_level, 1) AS INTEGER),
    brick_ball_bonus_damage = CAST(IFNULL(brick_ball_bonus_damage, 0) AS INTEGER)
`);


module.exports = db;
