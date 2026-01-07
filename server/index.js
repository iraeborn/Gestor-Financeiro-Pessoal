
import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import pool, { initDb } from './db.js';
import { createAuditLog } from './services/audit.js';
import { uploadFiles } from './services/storage.js';

// Import Routes
import authRoutes from './routes/auth.js';
import financeRoutes from './routes/finance.js';
import transactionRoutes from './routes/transactions.js';
import contactRoutes from './routes/contacts.js';
import accountRoutes from './routes/accounts.js';
import opticalRoutes from './routes/optical.js';
import orderRoutes from './routes/orders.js';
import goalRoutes from './routes/goals.js'; // Nova rota
import crmRoutes from './routes/crm.js';
import systemRoutes from './routes/system.js';
import servicesRoutes from './routes/services.js';
import billingRoutes from './routes/billing.js';
import { authenticateToken } from './middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const upload = multer({ storage: multer.memoryStorage() });

const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"], credentials: true },
  allowEIO3: true,
  pingTimeout: 60000
});

const logAudit = (poolInstance, userId, action, entity, entityId, details, previousState, changes, familyIdOverride) => {
    return createAuditLog(poolInstance, io, { userId, action, entity, entityId, details, previousState, changes, familyIdOverride });
};

const connectedSockets = new Map();

io.on('connection', (socket) => {
  socket.on('join_family', (data) => {
    const familyId = typeof data === 'object' ? data.familyId : data;
    const userId = typeof data === 'object' ? data.userId : null;
    if (familyId) {
        const room = String(familyId).trim();
        socket.join(room);
        if (userId) {
            socket.join(userId);
            connectedSockets.set(socket.id, { userId, familyId: room });
            socket.to(room).emit('USER_STATUS', { userId, status: 'ONLINE' });
            const onlineInRoom = Array.from(connectedSockets.values()).filter(u => u.familyId === room).map(u => u.userId);
            socket.emit('ONLINE_LIST', [...new Set(onlineInRoom)]);
        }
    }
  });

  socket.on('SEND_MESSAGE', async (msg) => {
      if (!msg.familyId) return;
      const room = String(msg.familyId).trim();
      try {
          const id = msg.id || Date.now().toString();
          await pool.query(
              `INSERT INTO chat_messages (id, sender_id, sender_name, receiver_id, family_id, content, type, attachment_url)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [id, msg.senderId, msg.senderName, msg.receiverId || null, room, msg.content, msg.type || 'TEXT', msg.attachmentUrl || null]
          );
          const payload = { ...msg, id, createdAt: new Date() };
          if (msg.receiverId) io.to(msg.receiverId).to(msg.senderId).emit('NEW_MESSAGE', payload);
          else io.to(room).emit('NEW_MESSAGE', payload);
      } catch (e) { console.error("[CHAT ERROR]", e.message); }
  });

  socket.on('disconnect', () => {
      const socketData = connectedSockets.get(socket.id);
      if (socketData) {
          const { userId, familyId } = socketData;
          connectedSockets.delete(socket.id);
          const isStillOnline = Array.from(connectedSockets.values()).some(s => s.userId === userId);
          if (!isStillOnline) io.to(familyId).emit('USER_STATUS', { userId, status: 'OFFLINE' });
      }
  });
});

app.use(cors());
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

app.post('/api/upload', authenticateToken, upload.array('files'), async (req, res) => {
    try {
        const urls = await uploadFiles(req.files, req.user.id);
        res.json({ urls });
    } catch (err) { res.status(500).json({ error: "Falha no upload: " + err.message }); }
});

app.use('/api/auth', authRoutes(logAudit));
app.use('/api', financeRoutes(logAudit));
app.use('/api/transactions', transactionRoutes(logAudit));
app.use('/api/contacts', contactRoutes(logAudit));
app.use('/api/accounts', accountRoutes(logAudit));
app.use('/api/optical-rxs', opticalRoutes(logAudit));
app.use('/api/orders', orderRoutes(logAudit));
app.use('/api/goals', goalRoutes(logAudit)); // Nova rota registrada
app.use('/api', crmRoutes(logAudit));
app.use('/api', systemRoutes(logAudit));
app.use('/api', servicesRoutes(logAudit));
app.use('/api', billingRoutes(logAudit));

const renderIndex = (req, res) => {
    const indexPath = [path.join(process.cwd(), 'dist/index.html'), path.join(process.cwd(), 'index.html')].find(p => fs.existsSync(p));
    if (indexPath) {
        let content = fs.readFileSync(indexPath, 'utf8');
        content = content.replace(/__GOOGLE_CLIENT_ID__/g, process.env.GOOGLE_CLIENT_ID || "");
        content = content.replace(/__API_KEY__/g, process.env.API_KEY || "");
        res.send(content);
    } else res.status(404).send('Sistema em inicialização...');
};

app.get('/', renderIndex);
app.use(express.static(path.join(process.cwd(), 'dist')));
app.get('*', (req, res) => { if (!req.path.startsWith('/api/')) renderIndex(req, res); else res.sendStatus(404); });

initDb().then(() => httpServer.listen(process.env.PORT || 8080, '0.0.0.0', () => console.log(`🚀 [SERVER] Operacional`)));
