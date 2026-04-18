const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Use parent database
const db = new Database(path.join(__dirname, '../data.db'));

app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Simple Auth Mock for standalone testing - in production use main app auth
const mockAuth = (req, res, next) => {
    // For standalone version, we might want a different auth or just a session
    req.user = { id: 1, username: 'online_user' }; 
    next();
};

app.get('/', (req, res) => {
    res.render('index', { user: { username: 'Guest' } });
});

app.post('/api/mc-world/save', mockAuth, (req, res) => {
    try {
        const { saveData, level, info, score } = req.body;
        const user_id = req.user.id;
        const jsonString = saveData ? JSON.stringify(saveData) : null;
        
        if (level !== undefined && level !== null) {
            db.prepare('UPDATE users SET mc_world_save = ?, mc_world_level = ?, mc_world_info = ? WHERE id = ?').run(jsonString, level, info || null, user_id);
        } else {
            db.prepare('UPDATE users SET mc_world_save = ?, mc_world_info = ? WHERE id = ?').run(jsonString, info || null, user_id);
        }
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/mc-world/load', mockAuth, (req, res) => {
    try {
        const user_id = req.user.id;
        const row = db.prepare('SELECT mc_world_save, mc_world_level, mc_world_info, mc_world_score_multiplier FROM users WHERE id = ?').get(user_id);
        const items = db.prepare(`
            SELECT si.item_key, up.quantity 
            FROM user_purchases up 
            JOIN shop_items si ON up.item_id = si.id 
            WHERE up.user_id = ? AND si.game_type = 'mc-world'
        `).all(user_id);

        if (row) {
            res.json({ 
                success: true, 
                saveData: (row.mc_world_save && row.mc_world_save.trim() !== "") ? JSON.parse(row.mc_world_save) : null,
                level: row.mc_world_level,
                info: row.mc_world_info,
                multiplier: row.mc_world_score_multiplier || 1.0,
                items: items
            });
        } else {
            res.json({ success: true, saveData: null, level: 1, info: null, multiplier: 1.0, items: [] });
        }
    } catch(e) {
        res.status(500).json({ success: false, error: 'Failed to load' });
    }
});

// Multiplayer logic
const players = {};
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    socket.on('join', (data) => {
        players[socket.id] = data;
        socket.broadcast.emit('playerJoined', { id: socket.id, ...data });
        socket.emit('currentPlayers', players);
    });

    socket.on('move', (data) => {
        if (players[socket.id]) {
            players[socket.id].position = data.position;
            players[socket.id].rotation = data.rotation;
            socket.broadcast.emit('playerMoved', { id: socket.id, ...data });
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('playerLeft', socket.id);
    });
});

const PORT = 3501;
server.listen(PORT, () => {
    console.log(`MC World Online running on http://localhost:${PORT}`);
});
