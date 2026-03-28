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
    brick_attempts INTEGER DEFAULT 0,
    airplane_attempts INTEGER DEFAULT 0,
    hero_attempts INTEGER DEFAULT 0,
    mc_world_attempts INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    score INTEGER,
    game_type TEXT DEFAULT 'general',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Add airplane_best_score column if not exists
try {
  db.prepare('ALTER TABLE users ADD COLUMN airplane_best_score INTEGER DEFAULT 0').run();
} catch (e) {
  // Column already exists
}

module.exports = db;
