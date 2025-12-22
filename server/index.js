
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
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true,
  pingTimeout: 60000
});

app.set('io', io);

io.on('connection', (socket) => {
  console.log(`[SOCKET] Novo cliente conectado: ${socket.id}`);
  
  socket.on('join_family', (familyId) => {
    if (familyId) {
        const roomName = String(familyId).trim();
        socket.rooms.forEach(room => {
            if (room !== socket.id) socket.leave(room);
        });
        socket.join(roomName);
        console.log(`[SOCKET] Cliente ${socket.id} sintonizado na sala: ${roomName}`);
    }
  });

  socket.on('disconnect', (reason) => {
    console.log(`[SOCKET] Cliente desconectado (${socket.id}): ${reason}`);
  });
});

/**
 * logAudit - Centralizador de Logs e Disparador de Reatividade
 */
const logAudit = async (pool, userId, action, entity, entityId, details, previousState = null, changes = null, familyIdOverride = null) => {
    // 1. Gravação no Banco (Isolada em try/catch para não quebrar o socket)
    try {
        await pool.query(
            `INSERT INTO audit_logs (user_id, action, entity, entity_id, details, previous_state, changes) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [userId, action, entity, entityId, details, previousState, changes]
        );
    } catch (dbErr) {
        console.error("[REALTIME DB LOG ERROR] Falha ao gravar log no banco, mas prosseguindo com socket:", dbErr.message);
    }

    // 2. Determinação do Alvo (Target Room) e Emissão
    try {
        let targetRoom = null;
        if (familyIdOverride) {
            targetRoom = String(familyIdOverride).trim();
        } else if (userId && userId !== 'EXTERNAL_CLIENT') {
            const res = await pool.query('SELECT family_id FROM users WHERE id = $1', [userId]);
            targetRoom = res.rows[0]?.family_id ? String(res.rows[0].family_id).trim() : String(userId).trim();
        }

        if (targetRoom) {
            console.log(`[REALTIME] >>> BROADCAST para sala [${targetRoom}] | Ação: ${action} | Entidade: ${entity}`);
            io.to(targetRoom).emit('DATA_UPDATED', { 
                action, 
                entity, 
                entityId,
                actorId: userId, 
                timestamp: new Date() 
            });
        }
    } catch (e) { 
        console.error("[REALTIME EMIT ERROR]", e); 
    }
};

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes(logAudit));
app.use('/api', financeRoutes(logAudit));
app.use('/api', crmRoutes(logAudit));
app.use('/api', systemRoutes(logAudit));
app.use('/api', servicesRoutes(logAudit));

const distPath = path.join(__dirname, '../dist');

const renderIndex = (req, res) => {
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        let content = fs.readFileSync(indexPath, 'utf8');
        const googleId = process.env.GOOGLE_CLIENT_ID || "";
        content = content.replace("__GOOGLE_CLIENT_ID__", googleId);
        res.send(content);
    } else {
        res.status(404).send('Aguardando build...');
    }
};

app.get('/', renderIndex);
app.use(express.static(distPath));
app.get('*', renderIndex);

const PORT = process.env.PORT || 8080;
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 [SERVER] Operacional na porta ${PORT}`);
    initDb().then(() => console.log("✅ [DB] Sincronizado."));
});
