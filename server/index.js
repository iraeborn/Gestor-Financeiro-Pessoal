
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

// --- Socket.io Setup (Production Ready) ---
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true
});

app.set('io', io);

io.on('connection', (socket) => {
  console.log(`[SOCKET] Nova conexão detectada: ${socket.id}`);
  
  socket.on('join_family', (familyId) => {
    if (familyId) {
        const roomName = String(familyId);
        // Garante que o socket está em apenas uma sala de família por vez
        socket.rooms.forEach(room => {
            if (room !== socket.id) socket.leave(room);
        });
        socket.join(roomName);
        console.log(`[SOCKET] Cliente ${socket.id} vinculado à sala (Ambiente): ${roomName}`);
    }
  });

  socket.on('disconnect', (reason) => {
    console.log(`[SOCKET] Conexão encerrada (${socket.id}): ${reason}`);
  });
});

/**
 * Helper de Auditoria e Gatilho de Reatividade
 * @param {string} familyIdOverride - Crucial para EXTERNAL_CLIENT, pois define a sala de destino sem precisar consultar a tabela users.
 */
const logAudit = async (pool, userId, action, entity, entityId, details, previousState = null, changes = null, familyIdOverride = null) => {
    try {
        // 1. Gravação do Log no Banco (userId pode ser 'EXTERNAL_CLIENT' pois a coluna é TEXT)
        await pool.query(
            `INSERT INTO audit_logs (user_id, action, entity, entity_id, details, previous_state, changes) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [userId, action, entity, entityId, details, previousState, changes]
        );

        // 2. Definição do Destino (Sala de Família/Ambiente)
        let targetRoom = familyIdOverride ? String(familyIdOverride) : null;
        
        // Se não informado o override e não for cliente externo, tenta descobrir pelo usuário logado
        if (!targetRoom && userId && userId !== 'EXTERNAL_CLIENT') {
            const res = await pool.query('SELECT family_id FROM users WHERE id = $1', [userId]);
            targetRoom = res.rows[0]?.family_id ? String(res.rows[0].family_id) : String(userId);
        }

        // 3. Emissão do Sinal de Reatividade
        if (targetRoom) {
            console.log(`[REALTIME] SINAL ENVIADO -> Sala: ${targetRoom} | Ator: ${userId} | Entidade: ${entity}`);
            io.to(targetRoom).emit('DATA_UPDATED', { 
                action, 
                entity, 
                entityId,
                actorId: userId, 
                timestamp: new Date() 
            });
        } else {
            console.warn(`[REALTIME] AVISO: Nenhuma sala identificada para broadcast de ${entity}.${action}`);
        }
    } catch (e) { 
        console.error("[REALTIME ERROR] Falha no processo de sinalização:", e); 
    }
};

app.use(cors());
app.use(express.json());

// --- ROUTES ---
app.use('/api/auth', authRoutes(logAudit));
app.use('/api', financeRoutes(logAudit));
app.use('/api', crmRoutes(logAudit));
app.use('/api', systemRoutes(logAudit));
app.use('/api', servicesRoutes(logAudit));

// --- STATIC FILES ---
const distPath = path.join(__dirname, '../dist');

app.get('/', (req, res) => {
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        let content = fs.readFileSync(indexPath, 'utf8');
        const googleId = process.env.GOOGLE_CLIENT_ID || "";
        content = content.replace("__GOOGLE_CLIENT_ID__", googleId);
        res.send(content);
    } else {
        res.status(404).send('Frontend não encontrado.');
    }
});

app.use(express.static(distPath));

app.get('*', (req, res) => {
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        let content = fs.readFileSync(indexPath, 'utf8');
        const googleId = process.env.GOOGLE_CLIENT_ID || "";
        content = content.replace("__GOOGLE_CLIENT_ID__", googleId);
        res.send(content);
    } else {
        res.status(404).send('Frontend não encontrado.');
    }
});

const PORT = process.env.PORT || 8080;

httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 [SERVER] Rodando na porta ${PORT}`);
    initDb().then(() => {
        console.log("✅ [DB] Estrutura OK.");
    }).catch(err => {
        console.error("❌ [DB] Erro crítico:", err);
    });
});
