
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
    origin: "*", // Em produção, você pode restringir ao seu domínio
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true // Compatibilidade
});

// Disponibiliza o io para as rotas via req.app.get('io')
app.set('io', io);

io.on('connection', (socket) => {
  console.log(`[SOCKET] Conexão ativa: ${socket.id}`);
  
  socket.on('join_family', (familyId) => {
    if (familyId) {
        // Limpa participações anteriores para evitar duplicidade de mensagens
        socket.rooms.forEach(room => {
            if (room !== socket.id) socket.leave(room);
        });
        socket.join(familyId);
        console.log(`[SOCKET] Usuário ${socket.id} monitorando sala: ${familyId}`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[SOCKET] Conexão encerrada: ${socket.id}`);
  });
});

// Helper de Auditoria e Gatilho de Reatividade
const logAudit = async (pool, userId, action, entity, entityId, details, previousState = null, changes = null, familyIdOverride = null) => {
    try {
        // 1. Persistência no Banco
        await pool.query(
            `INSERT INTO audit_logs (user_id, action, entity, entity_id, details, previous_state, changes) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [userId, action, entity, entityId, details, previousState, changes]
        );

        // 2. Localização da Sala (Family ID)
        let targetFamilyId = familyIdOverride;
        if (!targetFamilyId && userId && userId !== 'EXTERNAL_CLIENT') {
            const res = await pool.query('SELECT family_id FROM users WHERE id = $1', [userId]);
            targetFamilyId = res.rows[0]?.family_id || userId;
        }

        // 3. Emissão em Tempo Real
        if (targetFamilyId) {
            console.log(`[REALTIME] Enviando sinal para sala ${targetFamilyId}: ${entity}.${action}`);
            io.to(targetFamilyId).emit('DATA_UPDATED', { 
                action, 
                entity, 
                entityId,
                actorId: userId, 
                timestamp: new Date() 
            });
        }
    } catch (e) { 
        console.error("[AUDIT ERROR]", e); 
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

// Middleware para injetar variáveis de ambiente no HTML em tempo de execução
app.get('/', (req, res) => {
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        let content = fs.readFileSync(indexPath, 'utf8');
        const googleId = process.env.GOOGLE_CLIENT_ID || "";
        content = content.replace("__GOOGLE_CLIENT_ID__", googleId);
        res.send(content);
    } else {
        res.status(404).send('Build não encontrado. Execute npm run build.');
    }
});

app.use(express.static(distPath));

// Fallback para SPA (Single Page Application)
app.get('*', (req, res) => {
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        let content = fs.readFileSync(indexPath, 'utf8');
        const googleId = process.env.GOOGLE_CLIENT_ID || "";
        content = content.replace("__GOOGLE_CLIENT_ID__", googleId);
        res.send(content);
    } else {
        res.status(404).send('Frontend indisponível.');
    }
});

const PORT = process.env.PORT || 8080;

httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 [SERVER] Operacional na porta ${PORT}`);
    initDb().then(() => {
        console.log("✅ [DB] Tabelas e migrações verificadas.");
    }).catch(err => {
        console.error("❌ [DB] Falha na conexão:", err);
    });
});
