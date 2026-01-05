
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

/**
 * Helper para auditoria e broadcast em tempo real.
 */
const logAudit = (poolInstance, userId, action, entity, entityId, details, previousState, changes, familyIdOverride) => {
    return createAuditLog(poolInstance, io, { userId, action, entity, entityId, details, previousState, changes, familyIdOverride });
};

io.on('connection', (socket) => {
  console.log(`🔌 [SOCKET] Conexão estabelecida: ${socket.id}`);

  socket.on('join_family', (familyId) => {
    if (familyId) {
        const room = String(familyId).trim();
        
        // Antes de entrar em uma nova sala, sai de todas as outras (exceto a sua própria id)
        socket.rooms.forEach(r => {
            if (r !== socket.id) {
                socket.leave(r);
                console.log(`🚪 [ROOM_CHECK] Cliente ${socket.id} saiu da sala antiga: [${r}]`);
            }
        });
        
        socket.join(room);
        console.log(`🏠 [ROOM_CHECK] Cliente ${socket.id} ingressou com sucesso na sala do negócio: [${room}]`);
        
        // Confirmação para o cliente (útil para logs no front-end)
        socket.emit('joined_room', { room, timestamp: new Date() });
    } else {
        console.warn(`⚠️ [ROOM_CHECK] Cliente ${socket.id} tentou join_family sem fornecer um ID válido.`);
    }
  });

  socket.on('disconnect', (reason) => {
      console.log(`🔌 [SOCKET] Cliente desconectado: ${socket.id} | Motivo: ${reason}`);
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
app.use('/api', billingRoutes(logAudit));

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

const renderIndex = (req, res) => {
    const pathsToTry = [
        path.join(distPath, 'index.html'),
        path.join(rootPath, 'index.html')
    ];
    
    let indexPath = pathsToTry.find(p => fs.existsSync(p));

    if (indexPath) {
        let content = fs.readFileSync(indexPath, 'utf8');
        
        let googleId = process.env.GOOGLE_CLIENT_ID;
        if (!googleId || googleId === "" || googleId.includes("__GOOGLE_CLIENT_ID__")) {
            googleId = "272556908691-3gnld5rsjj6cv2hspp96jt2fb3okkbhv.apps.googleusercontent.com";
        }
        
        content = content.replace(/__GOOGLE_CLIENT_ID__/g, googleId);
        content = content.replace(/__API_KEY__/g, process.env.API_KEY || "");
        content = content.replace(/__PAGARME_ENC_KEY__/g, process.env.PAGARME_ENC_KEY || "");
        
        res.set({
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Content-Type': 'text/html; charset=utf-8'
        });

        res.send(content);
    } else {
        res.status(404).send('Sistema em inicialização...');
    }
};

app.get('/', renderIndex);
app.use(express.static(distPath, { ...staticOptions, index: false }));
app.use(express.static(publicPath, { ...staticOptions, index: false }));
app.use(express.static(rootPath, { ...staticOptions, index: false }));

app.get('*', (req, res) => {
    const isApiRequest = req.path.startsWith('/api/');
    if (isApiRequest) return res.status(404).end();
    renderIndex(req, res);
});

const PORT = process.env.PORT || 8080;

initDb().then(() => {
    httpServer.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 [SERVER] Sistema operacional na porta ${PORT}`);
    });
}).catch(err => {
    console.error("❌ [SERVER] Falha fatal no banco de dados:", err);
    process.exit(1);
});
