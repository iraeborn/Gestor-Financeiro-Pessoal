
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
  console.log(`🔌 [SOCKET] Conexão ativa: ${socket.id}`);

  socket.on('join_family', (familyId) => {
    if (familyId) {
        const room = String(familyId).trim();
        socket.rooms.forEach(r => { if (r !== socket.id) socket.leave(r); });
        socket.join(room);
        socket.emit('joined_room', { room, timestamp: new Date() });
    }
  });

  // SISTEMA DE CHAT REALTIME
  socket.on('SEND_MESSAGE', async (msg) => {
      if (!msg.familyId) return;
      const room = String(msg.familyId).trim();
      
      try {
          const id = msg.id || Date.now().toString();
          // Persistência no banco
          await pool.query(
              `INSERT INTO chat_messages (id, sender_id, sender_name, receiver_id, family_id, content, type, attachment_url)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [id, msg.senderId, msg.senderName, msg.receiverId || null, room, msg.content, msg.type || 'TEXT', msg.attachmentUrl || null]
          );

          // Broadcast para a sala (incluindo o remetente para confirmação visual)
          io.to(room).emit('NEW_MESSAGE', { ...msg, id, createdAt: new Date() });
      } catch (e) {
          console.error("[CHAT ERROR] Falha ao processar mensagem:", e.message);
      }
  });

  socket.on('disconnect', (reason) => {
      console.log(`🔌 [SOCKET] Cliente desconectado: ${socket.id}`);
  });
});

app.use(cors());
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

// Injeção de dependências nas rotas
app.use('/api/auth', authRoutes(logAudit));
app.use('/api', financeRoutes(logAudit));
app.use('/api', crmRoutes(logAudit));
app.use('/api', systemRoutes(logAudit));
app.use('/api', servicesRoutes(logAudit));
app.use('/api', billingRoutes(logAudit));

// Rota de Histórico de Chat
app.get('/api/chat/history', async (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.sendStatus(401);
    const familyId = req.query.familyId;
    try {
        const history = await pool.query(
            `SELECT * FROM chat_messages WHERE family_id = $1 ORDER BY created_at ASC LIMIT 200`,
            [familyId]
        );
        res.json(history.rows.map(r => ({
            id: r.id,
            senderId: r.sender_id,
            senderName: r.sender_name,
            receiverId: r.receiver_id,
            familyId: r.family_id,
            content: r.content,
            type: r.type,
            attachmentUrl: r.attachment_url,
            createdAt: r.created_at
        })));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

const renderIndex = (req, res) => {
    const indexPath = [path.join(process.cwd(), 'dist/index.html'), path.join(process.cwd(), 'index.html')].find(p => fs.existsSync(p));
    if (indexPath) {
        let content = fs.readFileSync(indexPath, 'utf8');
        content = content.replace(/__GOOGLE_CLIENT_ID__/g, process.env.GOOGLE_CLIENT_ID || "272556908691-3gnld5rsjj6cv2hspp96jt2fb3okkbhv.apps.googleusercontent.com");
        content = content.replace(/__API_KEY__/g, process.env.API_KEY || "");
        res.send(content);
    } else res.status(404).send('Sistema em inicialização...');
};

app.get('/', renderIndex);
app.use(express.static(path.join(process.cwd(), 'dist')));
app.get('*', (req, res) => { if (!req.path.startsWith('/api/')) renderIndex(req, res); else res.sendStatus(404); });

initDb().then(() => httpServer.listen(process.env.PORT || 8080, '0.0.0.0', () => console.log(`🚀 [SERVER] Operacional`)));
