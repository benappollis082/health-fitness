const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'db.json');

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
        console.error('Error reading DB:', err);
        return {};
    }
};

const writeDB = (data) => {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
        console.error('Error writing DB:', err);
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

app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/')) {
        res.sendFile(path.join(__dirname, 'frontend/dist', 'index.html'));
    }
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
