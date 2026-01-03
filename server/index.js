
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

// --- Static Files Logic ---
// Priorizamos a raiz do projeto e a pasta dist para servir index.tsx e assets corretamente
const rootPath = path.join(__dirname, '..');
const distPath = path.join(__dirname, '../dist');

const renderIndex = (req, res) => {
    const indexPath = fs.existsSync(path.join(distPath, 'index.html')) 
        ? path.join(distPath, 'index.html') 
        : path.join(rootPath, 'index.html');

    if (fs.existsSync(indexPath)) {
        let content = fs.readFileSync(indexPath, 'utf8');
        content = content.replace("__GOOGLE_CLIENT_ID__", process.env.GOOGLE_CLIENT_ID || "");
        content = content.replace("__API_KEY__", process.env.API_KEY || "");
        content = content.replace("__STRIPE_PUB_KEY__", process.env.STRIPE_PUB_KEY || "");
        res.send(content);
    } else {
        res.status(404).send('Aguardando inicialização do sistema...');
    }
};

// Serve arquivos estáticos da raiz (necessário para index.tsx e módulos em dev/sandbox)
app.use(express.static(rootPath));
app.use(express.static(distPath));

app.get('/', renderIndex);
app.get('*', (req, res, next) => {
    // Se a requisição for por um arquivo (tem extensão), e não foi encontrado pelo static, retorna 404
    if (path.extname(req.path)) {
        return res.status(404).end();
    }
    // Caso contrário, serve o index.html para o roteamento do React (SPA)
    renderIndex(req, res);
});

const PORT = process.env.PORT || 8080;

initDb().then(() => {
    httpServer.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 [SERVER] Operacional na porta ${PORT}`);
    });
}).catch(err => {
    console.error("❌ [SERVER] Falha ao iniciar banco de dados:", err);
    process.exit(1);
});
