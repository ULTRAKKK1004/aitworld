require('dotenv').config();
process.env.TZ = 'Asia/Seoul';
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

const checkEventMode = (req, res, next) => {
  try {
    const eventActivation = db.prepare('SELECT value FROM settings WHERE key = ?').get('event_activation');
    if (eventActivation && eventActivation.value === 'true' && req.user && req.user.role !== 'ADMIN') {
      return res.redirect('/event-notice');
    }
  } catch (err) {
    console.error('Error checking event mode:', err);
  }
  next();
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
        // Re-fetch to get all columns with default values (best_score, etc)
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
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

app.get('/setup-username', isAuth, checkEventMode, (req, res) => {
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

app.get('/dashboard', isAuth, isPending, checkEventMode, (req, res) => {
  if (!req.user.username) return res.redirect('/setup-username');
  res.render('dashboard', { user: req.user });
});

app.get('/event-notice', isAuth, isPending, (req, res) => {
  // If event mode is OFF, redirect back to dashboard
  const eventActivation = db.prepare('SELECT value FROM settings WHERE key = ?').get('event_activation');
  if (!eventActivation || eventActivation.value === 'false' || (req.user && req.user.role === 'ADMIN')) {
    return res.redirect('/dashboard');
  }
  res.render('event-notice', { user: req.user });
});

app.get('/games/brick-crasher', isAuth, isPending, checkEventMode, (req, res) => {
  res.render('game-page', { user: req.user });
});

app.get('/games/airplane-shooter', isAuth, isPending, checkEventMode, (req, res) => {
  res.render('airplane-shooter', { user: req.user });
});

app.get('/games/hero-quest', isAuth, isPending, checkEventMode, (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.render('hero-quest', { user: req.user });
});

app.get('/games/mc-world', isAuth, isPending, checkEventMode, (req, res) => {
  res.render('mc-world', { user: req.user });
});

app.get('/games/magicrush', isAuth, isPending, checkEventMode, (req, res) => {
  res.render('magicrush', { user: req.user });
});

// Scoreboard Route
app.get('/scoreboard', isAuth, isPending, (req, res) => {
  const userId = req.user.id;
  const isAdminView = req.query.view === 'all' && req.user.role === 'ADMIN';

  const getRankings = (orderByField) => {
    // 1. Get Top 10
    const top10 = db.prepare(`
      SELECT id, username, email, best_score, total_score, ${orderByField} as score,
      RANK() OVER (ORDER BY ${orderByField} DESC) as rank
      FROM users 
      WHERE username IS NOT NULL AND ${orderByField} > 0
      ORDER BY ${orderByField} DESC 
      LIMIT 10
    `).all();

    // 2. Get User's Rank
    const userRankInfo = db.prepare(`
      SELECT rank FROM (
        SELECT id, RANK() OVER (ORDER BY ${orderByField} DESC) as rank
        FROM users
        WHERE username IS NOT NULL
      ) WHERE id = ?
    `).get(userId);

    let context = [];
    if (userRankInfo) {
      const userRank = userRankInfo.rank;
      // 3. Get Context (3 above, user, 3 below)
      context = db.prepare(`
        SELECT * FROM (
          SELECT id, username, email, best_score, total_score, ${orderByField} as score,
          RANK() OVER (ORDER BY ${orderByField} DESC) as rank
          FROM users
          WHERE username IS NOT NULL
        )
        WHERE rank BETWEEN ? AND ?
        ORDER BY rank ASC
      `).all(Math.max(1, userRank - 3), userRank + 3);
    }

    // 4. Get All (for Admin)
    let all = [];
    if (isAdminView) {
      all = db.prepare(`
        SELECT id, username, email, best_score, total_score, ${orderByField} as score,
        RANK() OVER (ORDER BY ${orderByField} DESC) as rank
        FROM users
        WHERE username IS NOT NULL
        ORDER BY ${orderByField} DESC
      `).all();
    }

    return { top10, context, all };
  };

  const bestScoreRankings = getRankings('best_score');
  const totalScoreRankings = getRankings('total_score');
  
  const gRankings = [
    { title: '벽돌 깨기', field: 'brick_best_score', icon: 'fa-th', rankings: getRankings('brick_best_score') },
    { title: '비행기 슈팅', field: 'airplane_best_score', icon: 'fa-plane', rankings: getRankings('airplane_best_score') },
    { title: '용사 퀘스트', field: 'hero_best_score', icon: 'fa-shield-alt', rankings: getRankings('hero_best_score') },
    { title: 'MC 월드', field: 'mc_world_best_score', icon: 'fa-cube', rankings: getRankings('mc_world_best_score') },
    { title: '매직 러쉬', field: 'paper_rush_best_score', icon: 'fa-bolt', rankings: getRankings('paper_rush_best_score') }
  ];

  console.log(`[Scoreboard] Serving request for user: ${userId}, gameRankings count: ${gRankings.length}`);

  res.render('scoreboard', {
    user: req.user,
    bestScoreRankings: bestScoreRankings,
    totalScoreRankings: totalScoreRankings,
    gameRankings: gRankings,
    isAdminView: isAdminView
  });
});

// Admin Routes
app.get('/admin', isAdmin, (req, res) => {
  const users = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
  const recentScores = db.prepare('SELECT s.*, u.username FROM scores s JOIN users u ON s.user_id = u.id ORDER BY s.created_at DESC LIMIT 50').all();
  const eventActivation = db.prepare('SELECT value FROM settings WHERE key = ?').get('event_activation');
  res.render('admin', { user: req.user, users, recentScores, eventActivation: eventActivation?.value === 'true' });
});

app.post('/admin/update-settings', isAdmin, (req, res) => {
  try {
    const { event_activation } = req.body;
    const value = event_activation === 'on' ? 'true' : 'false';
    db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(value, 'event_activation');
    res.redirect('/admin');
  } catch (e) {
    console.error('Error updating settings:', e);
    res.status(500).send('Failed to update settings');
  }
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
  } else if (game === 'magicrush' || game === 'paper_rush') {
    db.prepare('UPDATE users SET paper_rush_attempts = paper_rush_attempts + 1 WHERE id = ?').run(user_id);
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

    // Sync global best_score and total_score
    db.prepare(`
      UPDATE users SET 
        best_score = MAX(
          COALESCE(airplane_best_score, 0), 
          COALESCE(brick_best_score, 0), 
          COALESCE(hero_best_score, 0), 
          COALESCE(mc_world_best_score, 0),
          COALESCE(paper_rush_best_score, 0)
        ),
        total_score = (
          COALESCE(airplane_best_score, 0) + 
          COALESCE(brick_best_score, 0) + 
          COALESCE(hero_best_score, 0) + 
          COALESCE(mc_world_best_score, 0) +
          COALESCE(paper_rush_best_score, 0)
        )
      WHERE id = ?
    `).run(user_id);
    
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
    
    // Sync global best_score and total_score
    db.prepare(`
      UPDATE users SET 
        best_score = MAX(
          COALESCE(airplane_best_score, 0), 
          COALESCE(brick_best_score, 0), 
          COALESCE(hero_best_score, 0), 
          COALESCE(mc_world_best_score, 0),
          COALESCE(paper_rush_best_score, 0)
        ),
        total_score = (
          COALESCE(airplane_best_score, 0) + 
          COALESCE(brick_best_score, 0) + 
          COALESCE(hero_best_score, 0) + 
          COALESCE(mc_world_best_score, 0) +
          COALESCE(paper_rush_best_score, 0)
        )
      WHERE id = ?
    `).run(user_id);

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
    db.prepare("UPDATE users SET best_score = 0, total_score = 0, wins = 0, losses = 0, brick_attempts = 0, airplane_attempts = 0, hero_attempts = 0, mc_world_attempts = 0, paper_rush_attempts = 0, airplane_best_score = 0, mc_world_best_score = 0, brick_best_score = 0, hero_best_score = 0, paper_rush_best_score = 0, mc_world_save = NULL, mc_world_level = 1, mc_world_info = NULL WHERE id = ?").run(user_id);
    db.prepare('DELETE FROM scores WHERE user_id = ?').run(user_id);
    res.redirect('/admin');
  } catch (e) {
    console.error('Error resetting user data:', e);
    res.status(500).send('Failed to reset user data');
  }
});

app.post('/admin/delete-user', isAdmin, (req, res) => {
  try {
    const { user_id } = req.body;
    
    // Prevent admin from deleting themselves
    if (parseInt(user_id) === req.user.id) {
      return res.status(400).send('Cannot delete your own account.');
    }

    // 1. Delete associated scores
    db.prepare('DELETE FROM scores WHERE user_id = ?').run(user_id);
    // 2. Delete user
    db.prepare('DELETE FROM users WHERE id = ?').run(user_id);
    
    res.redirect('/admin');
  } catch (e) {
    console.error('Error deleting user:', e);
    res.status(500).send('Failed to delete user');
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

    // 2. Update specific game's best score
    const gameColumnMap = {
      'airplane-shooter': 'airplane_best_score',
      'brick': 'brick_best_score',
      'hero': 'hero_best_score',
      'mc-world': 'mc_world_best_score',
      'magicrush': 'paper_rush_best_score',
      'paper_rush': 'paper_rush_best_score'
    };

    const targetColumn = gameColumnMap[gameType];
    if (targetColumn) {
      // Step A: Update the individual game's best score
      db.prepare(`
        UPDATE users SET 
          ${targetColumn} = MAX(CAST(IFNULL(${targetColumn}, 0) AS INTEGER), CAST(? AS INTEGER))
        WHERE id = ?
      `).run(score, user_id);
    }

    // Step B: Update global best_score and total_score using the newly updated individual scores
    db.prepare(`
      UPDATE users SET 
        best_score = MAX(
          CAST(IFNULL(airplane_best_score, 0) AS INTEGER), 
          CAST(IFNULL(brick_best_score, 0) AS INTEGER), 
          CAST(IFNULL(hero_best_score, 0) AS INTEGER), 
          CAST(IFNULL(mc_world_best_score, 0) AS INTEGER),
          CAST(IFNULL(paper_rush_best_score, 0) AS INTEGER)
        ),
        total_score = (
          CAST(IFNULL(airplane_best_score, 0) AS INTEGER) + 
          CAST(IFNULL(brick_best_score, 0) AS INTEGER) + 
          CAST(IFNULL(hero_best_score, 0) AS INTEGER) + 
          CAST(IFNULL(mc_world_best_score, 0) AS INTEGER) +
          CAST(IFNULL(paper_rush_best_score, 0) AS INTEGER)
        )
      WHERE id = ?
    `).run(user_id);

    // 4. CRITICAL: Refresh session data from DB
    // This ensures that req.user used in EJS templates has the latest brick_best_score and total_score
    const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(user_id);
    if (updatedUser) {
      // Manually update the passport session user object
      req.login(updatedUser, (err) => {
        if (err) console.error('[Session Refresh Error]', err);
        console.log(`[Score Submit Success] User:${user_id} session refreshed.`);
        res.json({ success: true, updatedScores: {
          best_score: updatedUser.best_score,
          total_score: updatedUser.total_score,
          brick_best_score: updatedUser.brick_best_score,
          airplane_best_score: updatedUser.airplane_best_score,
          hero_best_score: updatedUser.hero_best_score,
          mc_world_best_score: updatedUser.mc_world_best_score
        }});
      });
    } else {
      res.json({ success: true });
    }
  } catch (err) {
    console.error('[Score Submit Error]', err);
    res.status(500).json({ success: false, error: err.message });
  }
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
  const gameType = (req.query.gameType || 'general').trim();
  const gameColumnMap = {
    'airplane-shooter': 'airplane_best_score',
    'brick': 'brick_best_score',
    'hero': 'hero_best_score',
    'mc-world': 'mc_world_best_score',
    'magicrush': 'paper_rush_best_score',
    'paper_rush': 'paper_rush_best_score'
  };  const targetColumn = gameColumnMap[gameType] || 'best_score';

  const top10 = db.prepare(`SELECT username, ${targetColumn} as best_score FROM users WHERE username IS NOT NULL AND role != 'PENDING' AND ${targetColumn} > 0 ORDER BY ${targetColumn} DESC LIMIT 10`).all();
  const allUsers = db.prepare(`SELECT id, username, ${targetColumn} as best_score FROM users WHERE username IS NOT NULL AND role != 'PENDING' ORDER BY ${targetColumn} DESC`).all();
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
