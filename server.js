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
  secret: process.env.SESSION_SECRET || 'ai-tworld-secret',
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

app.get('/games/fighter', isAuth, isPending, (req, res) => {
  res.render('fighter', { user: req.user });
});

// Admin Routes
app.get('/admin', isAdmin, (req, res) => {
  const users = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
  const recentScores = db.prepare('SELECT s.*, u.username FROM scores s JOIN users u ON s.user_id = u.id ORDER BY s.created_at DESC LIMIT 50').all();
  res.render('admin', { user: req.user, users, recentScores });
});

app.post('/admin/update-role', isAdmin, (req, res) => {
  const { user_id, role } = req.body;
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, user_id);
  res.redirect('/admin');
});

app.post('/api/increment-attempts', isAuth, isPending, (req, res) => {
  const { game } = req.body;
  const user_id = req.user.id;
  if (game === 'brick') {
    db.prepare('UPDATE users SET brick_attempts = brick_attempts + 1 WHERE id = ?').run(user_id);
  } else if (game === 'fighter') {
    db.prepare('UPDATE users SET fighter_attempts = fighter_attempts + 1 WHERE id = ?').run(user_id);
  }
  res.json({ success: true });
});

app.post('/admin/reset-data', isAdmin, (req, res) => {
  const { user_id } = req.body;
  db.prepare('UPDATE users SET best_score = 0, wins = 0, losses = 0, brick_attempts = 0, fighter_attempts = 0 WHERE id = ?').run(user_id);
  db.prepare('DELETE FROM scores WHERE user_id = ?').run(user_id);
  res.redirect('/admin');
});

// API Routes
app.post('/api/submit-score', isAuth, isPending, (req, res) => {
  const { score } = req.body;
  const user_id = req.user.id;

  db.prepare('INSERT INTO scores (user_id, score) VALUES (?, ?)').run(user_id, score);

  if (score > req.user.best_score) {
    db.prepare('UPDATE users SET best_score = ? WHERE id = ?').run(score, user_id);
  }

  res.json({ success: true });
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
  console.log(`Server running on http://localhost:${PORT}`);
});
