
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
const rootPath = process.cwd();
const distPath = path.join(rootPath, 'dist');
const publicPath = path.join(rootPath, 'public');

const staticOptions = {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        }
        if (filePath.endsWith('.json')) {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
        }
        if (filePath.endsWith('sw.js')) {
            res.setHeader('Content-Type', 'application/javascript');
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        }
    }
};

// Ordem de busca: 1. Compilados (dist), 2. Públicos, 3. Raiz
app.use(express.static(distPath, staticOptions));
app.use(express.static(publicPath, staticOptions));
app.use(express.static(rootPath, staticOptions));

const renderIndex = (req, res) => {
    const pathsToTry = [
        path.join(distPath, 'index.html'),
        path.join(rootPath, 'index.html')
    ];
    
    let indexPath = pathsToTry.find(p => fs.existsSync(p));

    if (indexPath) {
        let content = fs.readFileSync(indexPath, 'utf8');
        
        // Garante que o Client ID seja injetado corretamente ou use um fallback funcional
        let googleId = process.env.GOOGLE_CLIENT_ID;
        if (!googleId || googleId === "" || googleId.includes("__GOOGLE_CLIENT_ID__")) {
            googleId = "272556908691-3gnld5rsjj6cv2hspp96jt2fb3okkbhv.apps.googleusercontent.com";
        }
        
        content = content.replace("__GOOGLE_CLIENT_ID__", googleId);
        content = content.replace("__API_KEY__", process.env.API_KEY || "");
        content = content.replace("__PAGARME_ENC_KEY__", process.env.PAGARME_ENC_KEY || "");
        
        res.send(content);
    } else {
        res.status(404).send('Aguardando inicialização do sistema (index.html não encontrado)...');
    }
};

app.get('/', renderIndex);

app.get('*', (req, res) => {
    const isApiRequest = req.path.startsWith('/api/');
    const hasExtension = path.extname(req.path) !== '';

    // Se pedir um arquivo com extensão que não foi pego no static, é 404
    if (isApiRequest || hasExtension) {
        return res.status(404).end();
    }
    
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
