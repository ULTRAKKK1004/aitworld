require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const path = require('path');
const db = require('./database');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);
const io = new Server(server);

// Middleware
const isAuth = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  res.redirect('/');
};

const isPending = (req, res, next) => {
  if (req.user.role === 'PENDING') {
    return res.status(403).send('Your account is pending approval.');
  }
  next();
};

const isAdmin = (req, res, next) => {
  if (req.isAuthenticated() && req.user.role === 'ADMIN') {
    return next();
  }
  res.status(403).send('Unauthorized: Admin access only.');
};

app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'tor-ai-secret',
  resave: false,
  saveUninitialized: false
});
app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());

// Passport Config
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback",
    proxy: true
  },
  function(accessToken, refreshToken, profile, done) {
    const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
    const google_id = profile.id;

    try {
      let user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(google_id);

      if (!user) {
        const stmt = db.prepare('INSERT INTO users (google_id, email) VALUES (?, ?)');
        const info = stmt.run(google_id, email);
        user = { id: info.lastInsertRowid, google_id, email, username: null, best_score: 0, wins: 0, losses: 0 };
      }
      return done(null, user);
    } catch (err) {
      console.error('Database error in Google Strategy:', err);
      return done(err);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    done(null, user || null);
  } catch (err) {
    console.error('Database error in deserializeUser:', err);
    done(err);
  }
});

// Auth Routes
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/' }),
  function(req, res) {
    if (!req.user.username) {
      return res.redirect('/setup-username');
    }
    res.redirect('/dashboard');
  });

app.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) { return next(err); }
    res.redirect('/');
  });
});

// App Routes
app.get('/', (req, res) => {
  if (req.isAuthenticated()) return res.redirect('/dashboard');
  res.render('index');
});

app.get('/setup-username', isAuth, (req, res) => {
  res.render('setup-username');
});

app.post('/setup-username', isAuth, (req, res) => {
  const { username } = req.body;
  try {
    const stmt = db.prepare('UPDATE users SET username = ? WHERE id = ?');
    stmt.run(username, req.user.id);
    res.redirect('/dashboard');
  } catch (error) {
    res.render('setup-username', { error: 'Username already taken or invalid.' });
  }
});

app.get('/dashboard', isAuth, isPending, (req, res) => {
  if (!req.user.username) return res.redirect('/setup-username');
  res.render('dashboard', { user: req.user });
});

app.get('/games/brick-crasher', isAuth, isPending, (req, res) => {
  res.render('game-page', { user: req.user });
});

app.get('/games/airplane-shooter', isAuth, isPending, (req, res) => {
  res.render('airplane-shooter', { user: req.user });
});

app.get('/games/hero-quest', isAuth, isPending, (req, res) => {
  res.render('hero-quest', { user: req.user });
});

app.get('/games/mc-world', isAuth, isPending, (req, res) => {
  res.render('mc-world', { user: req.user });
});

app.get('/games/lift-rush', isAuth, isPending, (req, res) => {
  res.render('lift-rush', { user: req.user });
});

// Admin Routes
app.get('/admin', isAdmin, (req, res) => {
  const users = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
  const recentScores = db.prepare('SELECT s.*, u.username FROM scores s JOIN users u ON s.user_id = u.id ORDER BY s.created_at DESC LIMIT 50').all();
  res.render('admin', { user: req.user, users, recentScores });
});

app.post('/admin/update-role', isAdmin, (req, res) => {
  try {
    const { user_id, role } = req.body;
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, user_id);
    res.redirect('/admin');
  } catch (e) {
    console.error('Error updating role:', e);
    res.status(500).send('Failed to update role');
  }
});

app.post('/api/increment-attempts', isAuth, isPending, (req, res) => {
  const { game } = req.body;
  const user_id = req.user.id;
  if (game === 'brick') {
    db.prepare('UPDATE users SET brick_attempts = brick_attempts + 1 WHERE id = ?').run(user_id);
  } else if (game === 'airplane-shooter') {
    db.prepare('UPDATE users SET airplane_attempts = airplane_attempts + 1 WHERE id = ?').run(user_id);
  } else if (game === 'hero') {
    db.prepare('UPDATE users SET hero_attempts = hero_attempts + 1 WHERE id = ?').run(user_id);
  } else if (game === 'mc-world') {
    db.prepare('UPDATE users SET mc_world_attempts = mc_world_attempts + 1 WHERE id = ?').run(user_id);
  } else if (game === 'lift-rush') {
    db.prepare('UPDATE users SET lift_rush_attempts = lift_rush_attempts + 1 WHERE id = ?').run(user_id);
  }
  res.json({ success: true });
});

app.post('/api/mc-world/save', isAuth, isPending, (req, res) => {
  try {
    const { saveData, level, info, score } = req.body;
    const user_id = req.user ? req.user.id : null;
    
    if (!user_id) {
      console.error('[MC-World Save] Error: No user ID in session');
      return res.status(401).json({ success: false, error: 'User session lost' });
    }

    console.log(`[MC-World Save] User:${user_id}, Level:${level}, Score:${score}`);
    
    const jsonString = JSON.stringify(saveData);
    
    // Update basic save data
    const stmt = db.prepare('UPDATE users SET mc_world_save = ?, mc_world_level = ?, mc_world_info = ? WHERE id = ?');
    stmt.run(jsonString, level || 1, info || null, user_id);
    
    // Update best score separately for safety
    if (score !== undefined) {
      db.prepare('UPDATE users SET mc_world_best_score = MAX(IFNULL(mc_world_best_score, 0), ?) WHERE id = ?')
        .run(score, user_id);
    }
    
    res.json({ success: true });
  } catch(e) {
    console.error('[MC-World Save Error]', e);
    res.status(500).json({ success: false, error: e.message || 'Internal Server Error' });
  }
});

app.post('/api/mc-world/reset', isAuth, isPending, (req, res) => {
  const user_id = req.user.id;
  try {
    db.prepare('UPDATE users SET mc_world_save = NULL, mc_world_level = 1, mc_world_info = NULL, mc_world_best_score = 0 WHERE id = ?').run(user_id);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ success: false, error: 'Failed to reset data' });
  }
});

app.get('/api/mc-world/load', isAuth, isPending, (req, res) => {
  const user_id = req.user.id;
  try {
    const row = db.prepare('SELECT mc_world_save, mc_world_level, mc_world_info FROM users WHERE id = ?').get(user_id);
    if (row) {
      res.json({ 
        success: true, 
        saveData: row.mc_world_save ? JSON.parse(row.mc_world_save) : null,
        level: row.mc_world_level,
        info: row.mc_world_info
      });
    } else {
      res.json({ success: true, saveData: null, level: 1, info: null });
    }
  } catch(e) {
    res.status(500).json({ success: false, error: 'Failed to load data' });
  }
});

app.post('/admin/reset-data', isAdmin, (req, res) => {
  try {
    const { user_id } = req.body;
    db.prepare("UPDATE users SET best_score = 0, wins = 0, losses = 0, brick_attempts = 0, airplane_attempts = 0, hero_attempts = 0, mc_world_attempts = 0, lift_rush_attempts = 0, airplane_best_score = 0, lift_rush_best_score = 0, mc_world_best_score = 0, mc_world_save = NULL, mc_world_level = 1, mc_world_info = NULL WHERE id = ?").run(user_id);
    db.prepare('DELETE FROM scores WHERE user_id = ?').run(user_id);
    res.redirect('/admin');
  } catch (e) {
    console.error('Error resetting user data:', e);
    res.status(500).send('Failed to reset user data');
  }
});

// API Routes
app.post('/api/submit-score', isAuth, isPending, (req, res) => {
  try {
    const score = parseInt(req.body.score) || 0;
    const gameType = (req.body.gameType || 'general').trim();
    const user_id = req.user.id;

    console.log(`[Score Submit Request] User:${user_id}, Game:${gameType}, Score:${score}`);

    // 1. Insert into history
    const scoreInsert = db.prepare('INSERT INTO scores (user_id, score, game_type) VALUES (?, ?, ?)').run(user_id, score, gameType);
    console.log(`[Score Submit] History inserted. RowID: ${scoreInsert.lastInsertRowid}`);

    // 2. Update specific game's best score and recalculate everything in one go
    const updateQueries = {
      'airplane-shooter': 'UPDATE users SET airplane_best_score = MAX(COALESCE(airplane_best_score, 0), ?) WHERE id = ?',
      'brick': 'UPDATE users SET brick_best_score = MAX(COALESCE(brick_best_score, 0), ?) WHERE id = ?',
      'hero': 'UPDATE users SET hero_best_score = MAX(COALESCE(hero_best_score, 0), ?) WHERE id = ?',
      'lift-rush': 'UPDATE users SET lift_rush_best_score = MAX(COALESCE(lift_rush_best_score, 0), ?) WHERE id = ?',
      'mc-world': 'UPDATE users SET mc_world_best_score = MAX(COALESCE(mc_world_best_score, 0), ?) WHERE id = ?'
    };

    if (updateQueries[gameType]) {
      const result = db.prepare(updateQueries[gameType]).run(score, user_id);
      console.log(`[Score Submit] ${gameType} score updated. Changes: ${result.changes}`);
    }

    // 3. Sync global best_score and total_score
    db.prepare(`
      UPDATE users SET 
        best_score = MAX(
          COALESCE(airplane_best_score, 0), 
          COALESCE(brick_best_score, 0), 
          COALESCE(hero_best_score, 0), 
          COALESCE(lift_rush_best_score, 0), 
          COALESCE(mc_world_best_score, 0)
        ),
        total_score = (
          COALESCE(airplane_best_score, 0) + 
          COALESCE(brick_best_score, 0) + 
          COALESCE(hero_best_score, 0) + 
          COALESCE(lift_rush_best_score, 0) + 
          COALESCE(mc_world_best_score, 0)
        )
      WHERE id = ?
    `).run(user_id);

    console.log(`[Score Submit Success] User:${user_id} updated.`);
    res.json({ success: true });
  } catch (err) {
    console.error('[Score Submit Error]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/lift-rush-leaderboard', isAuth, isPending, (req, res) => {
  // Best score ranking (from users table)
  const bestTop10 = db.prepare('SELECT id, username, lift_rush_best_score as best_score FROM users WHERE username IS NOT NULL AND role != \'PENDING\' AND lift_rush_best_score > 0 ORDER BY lift_rush_best_score DESC LIMIT 10').all();
  const bestAllUsers = db.prepare('SELECT id, username, lift_rush_best_score as best_score FROM users WHERE username IS NOT NULL AND role != \'PENDING\' ORDER BY lift_rush_best_score DESC').all();
  const bestUserIndex = bestAllUsers.findIndex(u => u.id === req.user.id);
  const bestUserRank = bestUserIndex !== -1 ? bestUserIndex + 1 : null;
  
  // Current game score ranking (from scores table, lift-rush only)
  const currentScores = db.prepare(`
    SELECT user_id, MAX(score) as max_score 
    FROM scores 
    WHERE game_type = 'lift-rush' 
    GROUP BY user_id 
    ORDER BY max_score DESC
  `).all();
  
  const currentTop10 = currentScores.slice(0, 10).map((s, i) => {
    const user = db.prepare('SELECT username FROM users WHERE id = ?').get(s.user_id);
    return { rank: i + 1, username: user?.username, score: s.max_score, user_id: s.user_id };
  });
  
  const currentUserScore = currentScores.find(s => s.user_id === req.user.id);
  const currentUserRank = currentUserScore ? currentScores.findIndex(s => s.user_id === req.user.id) + 1 : null;
  
  // Get rivals for best score
  let bestRivals = [];
  if (bestUserRank) {
    const start = Math.max(0, bestUserIndex - 2);
    const end = Math.min(bestAllUsers.length, bestUserIndex + 3);
    bestRivals = bestAllUsers.slice(start, end).map((u, i) => ({
      ...u,
      rank: start + i + 1,
      isCurrent: u.id === req.user.id
    }));
  } else if (bestAllUsers.length > 0) {
    bestRivals = bestAllUsers.slice(0, 5).map((u, i) => ({
      ...u,
      rank: i + 1,
      isCurrent: false
    }));
  }
  
  // Get rivals for current score
  let currentRivals = [];
  if (currentUserRank) {
    const userIdx = currentScores.findIndex(s => s.user_id === req.user.id);
    const start = Math.max(0, userIdx - 2);
    const end = Math.min(currentScores.length, userIdx + 3);
    currentRivals = currentScores.slice(start, end).map((s, i) => {
      const user = db.prepare('SELECT username FROM users WHERE id = ?').get(s.user_id);
      return {
        rank: start + i + 1,
        username: user?.username,
        score: s.max_score,
        user_id: s.user_id,
        isCurrent: s.user_id === req.user.id
      };
    });
  } else if (currentScores.length > 0) {
    currentRivals = currentScores.slice(0, 5).map((s, i) => {
      const user = db.prepare('SELECT username FROM users WHERE id = ?').get(s.user_id);
      return { rank: i + 1, username: user?.username, score: s.max_score, user_id: s.user_id, isCurrent: false };
    });
  }
  
  const bestFirstPlace = bestTop10.length > 0 ? bestTop10[0] : null;
  const currentFirstPlace = currentTop10.length > 0 ? currentTop10[0] : null;

  res.json({ 
    bestScore: { top10: bestTop10, rivals: bestRivals, userRank: bestUserRank, firstPlace: bestFirstPlace, userBestScore: bestAllUsers[bestUserIndex]?.best_score || 0 },
    currentScore: { top10: currentTop10, rivals: currentRivals, userRank: currentUserRank, firstPlace: currentFirstPlace, userBestScore: currentUserScore?.max_score || 0 }
  });
});

app.get('/api/airplane-leaderboard', isAuth, isPending, (req, res) => {
  // Best score ranking (from users table)
  const bestTop10 = db.prepare('SELECT id, username, best_score FROM users WHERE username IS NOT NULL AND role != \'PENDING\' AND best_score > 0 ORDER BY best_score DESC LIMIT 10').all();
  const bestAllUsers = db.prepare('SELECT id, username, best_score FROM users WHERE username IS NOT NULL AND role != \'PENDING\' ORDER BY best_score DESC').all();
  const bestUserIndex = bestAllUsers.findIndex(u => u.id === req.user.id);
  const bestUserRank = bestUserIndex !== -1 ? bestUserIndex + 1 : null;
  
  // Current game score ranking (from scores table, airplane-shooter only)
  const currentScores = db.prepare(`
    SELECT user_id, MAX(score) as max_score 
    FROM scores 
    WHERE game_type = 'airplane-shooter' 
    GROUP BY user_id 
    ORDER BY max_score DESC
  `).all();
  
  const currentTop10 = currentScores.slice(0, 10).map((s, i) => {
    const user = db.prepare('SELECT username FROM users WHERE id = ?').get(s.user_id);
    return { rank: i + 1, username: user?.username, score: s.max_score, user_id: s.user_id };
  });
  
  const currentUserScore = currentScores.find(s => s.user_id === req.user.id);
  const currentUserRank = currentUserScore ? currentScores.findIndex(s => s.user_id === req.user.id) + 1 : null;
  
  // Get rivals for best score
  let bestRivals = [];
  if (bestUserRank) {
    const start = Math.max(0, bestUserIndex - 2);
    const end = Math.min(bestAllUsers.length, bestUserIndex + 3);
    bestRivals = bestAllUsers.slice(start, end).map((u, i) => ({
      ...u,
      rank: start + i + 1,
      isCurrent: u.id === req.user.id
    }));
  } else if (bestAllUsers.length > 0) {
    bestRivals = bestAllUsers.slice(0, 5).map((u, i) => ({
      ...u,
      rank: i + 1,
      isCurrent: false
    }));
  }
  
  // Get rivals for current score
  let currentRivals = [];
  if (currentUserRank) {
    const userIdx = currentScores.findIndex(s => s.user_id === req.user.id);
    const start = Math.max(0, userIdx - 2);
    const end = Math.min(currentScores.length, userIdx + 3);
    currentRivals = currentScores.slice(start, end).map((s, i) => {
      const user = db.prepare('SELECT username FROM users WHERE id = ?').get(s.user_id);
      return {
        rank: start + i + 1,
        username: user?.username,
        score: s.max_score,
        user_id: s.user_id,
        isCurrent: s.user_id === req.user.id
      };
    });
  } else if (currentScores.length > 0) {
    currentRivals = currentScores.slice(0, 5).map((s, i) => {
      const user = db.prepare('SELECT username FROM users WHERE id = ?').get(s.user_id);
      return { rank: i + 1, username: user?.username, score: s.max_score, user_id: s.user_id, isCurrent: false };
    });
  }
  
  const bestFirstPlace = bestTop10.length > 0 ? bestTop10[0] : null;
  const currentFirstPlace = currentTop10.length > 0 ? currentTop10[0] : null;

  res.json({ 
    bestScore: { top10: bestTop10, rivals: bestRivals, userRank: bestUserRank, firstPlace: bestFirstPlace, userBestScore: bestAllUsers[bestUserIndex]?.best_score || 0 },
    currentScore: { top10: currentTop10, rivals: currentRivals, userRank: currentUserRank, firstPlace: currentFirstPlace, userBestScore: currentUserScore?.max_score || 0 }
  });
});

app.get('/api/leaderboard', isAuth, isPending, (req, res) => {
  const top10 = db.prepare('SELECT username, best_score FROM users WHERE username IS NOT NULL AND role != \'PENDING\' ORDER BY best_score DESC LIMIT 10').all();
  const allUsers = db.prepare('SELECT id, username, best_score FROM users WHERE username IS NOT NULL AND role != \'PENDING\' ORDER BY best_score DESC').all();
  const userIndex = allUsers.findIndex(u => u.id === req.user.id);
  
  let rivals = [];
  if (userIndex !== -1) {
    const start = Math.max(0, userIndex - 2);
    const end = Math.min(allUsers.length, userIndex + 3);
    rivals = allUsers.slice(start, end).map((u, i) => ({
      ...u,
      rank: start + i + 1
    }));
  }

  res.json({ top10, rivals, userRank: userIndex + 1 });
});

// Socket.io for Fighting Game
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

io.on('connection', (socket) => {
  const session = socket.request.session;
  if (!session || !session.passport || !session.passport.user) {
    return; // Not authenticated
  }
  
  const userId = session.passport.user;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return;

  socket.on('record_result', ({ winner, loser }) => {
    if (winner === user.username) {
      db.prepare('UPDATE users SET wins = wins + 1 WHERE id = ?').run(userId);
    } else if (loser === user.username) {
      db.prepare('UPDATE users SET losses = losses + 1 WHERE id = ?').run(userId);
    }
    
    const updatedUser = db.prepare('SELECT wins, losses FROM users WHERE id = ?').get(userId);
    socket.emit('stats_update', { wins: updatedUser.wins, losses: updatedUser.losses });
  });
});

const PORT = process.env.PORT || 3500;
server.listen(PORT, () => {
  console.log(`[MC-World 2.0] Server running on http://localhost:${PORT}`);
});
