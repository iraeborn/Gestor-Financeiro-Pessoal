
import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pool, { initDb } from './db.js';

// Import Routes
import authRoutes from './routes/auth.js';
import financeRoutes from './routes/finance.js';
import crmRoutes from './routes/crm.js';
import systemRoutes from './routes/system.js';
import servicesRoutes from './routes/services.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

// --- Socket.io Setup ---
const io = new Server(httpServer, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  socket.on('join_family', (familyId) => {
    socket.join(familyId);
  });
});

// Helper para Auditoria
const logAudit = async (pool, userId, action, entity, entityId, details, previousState = null, changes = null) => {
    await pool.query(
        `INSERT INTO audit_logs (user_id, action, entity, entity_id, details, previous_state, changes) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, action, entity, entityId, details, previousState, changes]
    );
    try {
        const res = await pool.query('SELECT family_id FROM users WHERE id = $1', [userId]);
        const familyId = res.rows[0]?.family_id || userId;
        io.to(familyId).emit('DATA_UPDATED', { action, entity, actorId: userId, timestamp: new Date() });
    } catch (e) { console.error(e); }
};

app.use(cors());
app.use(express.json());

// --- ROUTES ---
app.get('/api/health', (req, res) => res.json({ status: 'OK' }));
app.use('/api/auth', authRoutes(logAudit));
app.use('/api', financeRoutes(logAudit));
app.use('/api', crmRoutes(logAudit));
app.use('/api', systemRoutes(logAudit));
app.use('/api', servicesRoutes(logAudit));

// Static Files
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath, { index: false }));
app.get('*', (req, res) => {
    const indexPath = path.join(distPath, 'index.html');
    if (!fs.existsSync(indexPath)) return res.status(500).send('Build not found.');
    fs.readFile(indexPath, 'utf8', (err, htmlData) => {
        if (err) return res.status(500).send('Error');
        const envScript = `<script>window.GOOGLE_CLIENT_ID = "${process.env.GOOGLE_CLIENT_ID}";</script>`;
        res.send(htmlData.replace('</head>', `${envScript}</head>`));
    });
});

const PORT = process.env.PORT || 8080;

initDb().then(() => {
    // Escutando explicitamente em 0.0.0.0 para Cloud Run
    httpServer.listen(PORT, '0.0.0.0', () => {
        console.log(`Gestor Financeiro rodando em: http://0.0.0.0:${PORT}`);
    });
});
