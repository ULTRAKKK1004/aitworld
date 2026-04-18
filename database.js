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
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%S', 'now', 'localtime'))
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
addColumn('users', 'magicrush_best_score', 'INTEGER NOT NULL DEFAULT 0');
addColumn('users', 'total_score', 'INTEGER NOT NULL DEFAULT 0');
addColumn('users', 'brick_attempts', 'INTEGER NOT NULL DEFAULT 0');
addColumn('users', 'airplane_attempts', 'INTEGER NOT NULL DEFAULT 0');
addColumn('users', 'hero_attempts', 'INTEGER NOT NULL DEFAULT 0');
addColumn('users', 'mc_world_attempts', 'INTEGER NOT NULL DEFAULT 0');
addColumn('users', 'magicrush_attempts', 'INTEGER NOT NULL DEFAULT 0');
addColumn('users', 'paper_rush_best_score', 'INTEGER NOT NULL DEFAULT 0');
addColumn('users', 'paper_rush_attempts', 'INTEGER NOT NULL DEFAULT 0');
addColumn('users', 'airplane_save', 'TEXT');
addColumn('users', 'airplane_level', 'INTEGER NOT NULL DEFAULT 1');
addColumn('users', 'airplane_shield', 'INTEGER NOT NULL DEFAULT 0');

// Data migration
db.exec(`
  UPDATE users SET 
    airplane_best_score = CAST(IFNULL(airplane_best_score, 0) AS INTEGER),
    brick_best_score = CAST(IFNULL(brick_best_score, 0) AS INTEGER),
    hero_best_score = CAST(IFNULL(hero_best_score, 0) AS INTEGER),
    mc_world_best_score = CAST(IFNULL(mc_world_best_score, 0) AS INTEGER),
    paper_rush_best_score = CAST(IFNULL(paper_rush_best_score, 0) AS INTEGER),
    best_score = CAST(IFNULL(best_score, 0) AS INTEGER),
    total_score = CAST(IFNULL(total_score, 0) AS INTEGER),
    brick_attempts = CAST(IFNULL(brick_attempts, 0) AS INTEGER),
    airplane_attempts = CAST(IFNULL(airplane_attempts, 0) AS INTEGER),
    hero_attempts = CAST(IFNULL(hero_attempts, 0) AS INTEGER),
    mc_world_attempts = CAST(IFNULL(mc_world_attempts, 0) AS INTEGER),
    paper_rush_attempts = CAST(IFNULL(paper_rush_attempts, 0) AS INTEGER),
    wins = CAST(IFNULL(wins, 0) AS INTEGER),
    losses = CAST(IFNULL(losses, 0) AS INTEGER)
`);


module.exports = db;
