require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ─────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Serve frontend static files ────────────────────────────
app.use(express.static(path.join(__dirname, 'frontend')));

// ── API Routes ─────────────────────────────────────────────
const monitorsRouter = require('./api/routes');
app.use('/api/monitors', monitorsRouter);

// ── Health check ───────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ── Fallback: serve frontend for any unknown route ─────────
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// ── Start ──────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n Alamar Monitoring running at http://localhost:${PORT}\n`);
});
