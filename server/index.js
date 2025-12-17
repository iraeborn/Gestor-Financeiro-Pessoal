
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
  cors: { origin: "*", methods: ["GET", "POST"] }
});

io.on('connection', (socket) => {
  socket.on('join_family', (familyId) => {
    socket.join(familyId);
  });
});

// Helper para Auditoria
const logAudit = async (pool, userId, action, entity, entityId, details, previousState = null, changes = null) => {
    try {
        await pool.query(
            `INSERT INTO audit_logs (user_id, action, entity, entity_id, details, previous_state, changes) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [userId, action, entity, entityId, details, previousState, changes]
        );
        const res = await pool.query('SELECT family_id FROM users WHERE id = $1', [userId]);
        const familyId = res.rows[0]?.family_id || userId;
        io.to(familyId).emit('DATA_UPDATED', { action, entity, actorId: userId, timestamp: new Date() });
    } catch (e) { console.error("Audit error:", e); }
};

app.use(cors());
app.use(express.json());

// --- HEALTH CHECK ---
app.get('/api/health', (req, res) => res.status(200).json({ status: 'UP', timestamp: new Date() }));

// --- ROUTES ---
app.use('/api/auth', authRoutes(logAudit));
app.use('/api', financeRoutes(logAudit));
app.use('/api', crmRoutes(logAudit));
app.use('/api', systemRoutes(logAudit));
app.use('/api', servicesRoutes(logAudit));

// --- STATIC FILES ---
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        // Se o build do frontend falhou ou não existe, avisa ao invés de crashar
        res.status(404).send('Frontend não encontrado. Verifique se o processo de build (npm run build) foi concluído com sucesso.');
    }
});

const PORT = process.env.PORT || 8080;

// INICIALIZAÇÃO CRÍTICA: Escutar a porta IMEDIATAMENTE.
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 [SERVIDOR] Rodando na porta ${PORT}`);
    
    // Inicialização do banco ocorre em paralelo para não bloquear o health check do Cloud Run
    initDb().then(() => {
        console.log("✅ [DB] Conexão e tabelas verificadas.");
    }).catch(err => {
        console.error("❌ [DB] Falha crítica na conexão inicial:", err);
    });
});
