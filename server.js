const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID;
const DATA_DIR = isRailway ? '/data' : __dirname;
const DB_PATH = path.join(DATA_DIR, 'db.json');

if (isRailway && !fs.existsSync(DB_PATH)) {
    const seedPath = path.join(__dirname, 'db.json');
    if (fs.existsSync(seedPath)) {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.copyFileSync(seedPath, DB_PATH);
    }
}

app.use(cors());
// Increased limit for large cells objects
app.use(express.json({ limit: '50mb' }));

app.use(express.static(path.join(__dirname, 'frontend/dist')));

const readDB = () => {
    try {
        if (!fs.existsSync(DB_PATH)) return {};
        const data = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('[DB] Error reading from', DB_PATH, ':', err);
        return {};
    }
};

const writeDB = (data) => {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
        console.log('[DB] Data successfully written to', DB_PATH);
    } catch (err) {
        console.error('[DB] Error writing to', DB_PATH, ':', err);
    }
};

app.get('/api/data', (req, res) => {
    res.json(readDB());
});

app.post('/api/data', (req, res) => {
    const { activeUser, cells, sleepGoal, movementGoal } = req.body;
    const db = readDB();
    
    if (activeUser) {
        if (!db.userData) db.userData = {};
        if (!db.userData[activeUser]) db.userData[activeUser] = {};
        if (cells !== undefined) db.userData[activeUser].cells = cells;
        if (sleepGoal !== undefined) db.userData[activeUser].sleepGoal = sleepGoal;
        if (movementGoal !== undefined) db.userData[activeUser].movementGoal = movementGoal;
    } else {
        // Fallback for old behaviour
        if (cells !== undefined) db.cells = cells;
        if (sleepGoal !== undefined) db.sleepGoal = sleepGoal;
        if (movementGoal !== undefined) db.movementGoal = movementGoal;
    }
    
    writeDB(db);
    res.status(200).json({ message: 'Data saved successfully' });
});

app.post('/api/users', (req, res) => {
    console.log('[POST /api/users] Request received. Body:', JSON.stringify(req.body));
    const { user } = req.body;
    const db = readDB();

    if (!db.users) db.users = [];
    if (user && !db.users.includes(user)) {
        db.users.push(user);
        console.log('[POST /api/users] New user added:', user);
    } else if (user) {
        console.log('[POST /api/users] User already exists, skipping:', user);
    } else {
        console.warn('[POST /api/users] No user value provided in request body.');
    }

    writeDB(db);
    res.status(200).json({ message: 'User saved successfully' });
});

app.post('/api/activities', (req, res) => {
    console.log('[POST /api/activities] Request received. Body:', JSON.stringify(req.body));
    const { activity } = req.body;
    const db = readDB();

    if (!db.activities) db.activities = [];
    if (activity && !db.activities.includes(activity)) {
        db.activities.push(activity);
        console.log('[POST /api/activities] New activity added:', activity);
    } else if (activity) {
        console.log('[POST /api/activities] Activity already exists, skipping:', activity);
    } else {
        console.warn('[POST /api/activities] No activity value provided in request body.');
    }

    writeDB(db);
    res.status(200).json({ message: 'Activity saved successfully' });
});

app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/')) {
        res.sendFile(path.join(__dirname, 'frontend/dist', 'index.html'));
    }
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
