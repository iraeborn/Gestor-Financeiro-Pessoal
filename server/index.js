
import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pool, { initDb } from './db.js';
import { createAuditLog } from './services/audit.js';

// Import Routes
import authRoutes from './routes/auth.js';
import financeRoutes from './routes/finance.js';
import crmRoutes from './routes/crm.js';
import systemRoutes from './routes/system.js';
import servicesRoutes from './routes/services.js';
import billingRoutes from './routes/billing.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

// --- Socket.io Setup ---
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"], credentials: true },
  allowEIO3: true,
  pingTimeout: 60000
});

const logAudit = (poolInstance, userId, action, entity, entityId, details, previousState, changes, familyIdOverride) => {
    return createAuditLog(poolInstance, io, { userId, action, entity, entityId, details, previousState, changes, familyIdOverride });
};

io.on('connection', (socket) => {
  socket.on('join_family', (familyId) => {
    if (familyId) {
        socket.rooms.forEach(room => { if (room !== socket.id) socket.leave(room); });
        socket.join(String(familyId).trim());
    }
  });
});

app.use(cors());

// Webhook precisa do body RAW, os outros precisam de JSON
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

// Injeção de dependências nas rotas
app.use('/api/auth', authRoutes(logAudit));
app.use('/api', financeRoutes(logAudit));
app.use('/api', crmRoutes(logAudit));
app.use('/api', systemRoutes(logAudit));
app.use('/api', servicesRoutes(logAudit));
app.use('/api/billing', billingRoutes(logAudit));

const distPath = path.join(__dirname, '../dist');
const renderIndex = (req, res) => {
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        let content = fs.readFileSync(indexPath, 'utf8');
        content = content.replace("__GOOGLE_CLIENT_ID__", process.env.GOOGLE_CLIENT_ID || "");
        content = content.replace("__API_KEY__", process.env.API_KEY || "");
        // Injetar Stripe Pub Key
        content = content.replace("__STRIPE_PUB_KEY__", process.env.STRIPE_PUB_KEY || "pk_test_51STLRbLAvFlsDMQOwt5oI5CYByQ6NAHFAtVa6zAVI0EymayKr5PTxc9qPBeJYKHquPrJ82vFCJI91njENOkumf9v00FQimrTRe");
        res.send(content);
    } else {
        res.status(404).send('Aguardando build...');
    }
};

app.get('/', renderIndex);
app.use(express.static(distPath));
app.get('*', renderIndex);

const PORT = process.env.PORT || 8080;

initDb().then(() => {
    httpServer.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 [SERVER] Operacional na porta ${PORT}`);
    });
}).catch(err => {
    console.error("❌ [SERVER] Falha ao iniciar banco de dados:", err);
    process.exit(1);
});
