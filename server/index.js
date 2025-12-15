
import 'dotenv/config';
import express from 'express';
import { createServer } from 'http'; // Import http server
import { Server } from 'socket.io'; // Import Socket.io
import pg from 'pg';
const { Pool } = pg;
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app); // Wrap express in http server

// --- Socket.io Setup ---
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Em produção, restrinja isso para seu domínio
    methods: ["GET", "POST"]
  }
});

// Map para rastrear quais sockets pertencem a qual family_id
const userSocketMap = new Map(); // socketId -> { userId, familyId }

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // O cliente envia um evento 'join_family' ao conectar
  socket.on('join_family', (familyId) => {
    socket.join(familyId);
    console.log(`Socket ${socket.id} joined family room: ${familyId}`);
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// 1. Logger Middleware
app.use((req, res, next) => {
    console.log(`[Request] ${req.method} ${req.path}`);
    next();
});

app.use(cors());
app.use(express.json());

// --- Database Connection ---
let poolConfig;
if (process.env.INSTANCE_CONNECTION_NAME) {
  poolConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    host: `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`,
  };
} else {
  const connectionString = process.env.DATABASE_URL || 'postgres://admin:password123@localhost:5432/financer';
  poolConfig = {
    connectionString: connectionString,
  };
}

const pool = new Pool(poolConfig);

// Helper para Auditoria & BROADCAST SOCKET
const logAudit = async (client, userId, action, entity, entityId, details, previousState = null, changes = null) => {
    // 1. Persist Log
    await client.query(
        `INSERT INTO audit_logs (user_id, action, entity, entity_id, details, previous_state, changes) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, action, entity, entityId, details, previousState, changes]
    );

    // 2. Real-time Broadcast via WebSocket
    try {
        // Find the user's family_id to broadcast only to relevant members
        const res = await client.query('SELECT family_id FROM users WHERE id = $1', [userId]);
        const familyId = res.rows[0]?.family_id || userId;
        
        // Emit to everyone in the room EXCEPT the sender (optional, but good for reducing echo if client updates optimistically)
        // For simplicity in this app (Single Source of Truth), we broadcast to ALL including sender to force a clean refresh.
        io.to(familyId).emit('DATA_UPDATED', {
            action,
            entity,
            actorId: userId,
            timestamp: new Date()
        });
        console.log(`Broadcasted update to family ${familyId}`);
    } catch (e) {
        console.error("Socket broadcast error:", e);
    }
};

// Helper para calcular Diff entre objeto antigo (DB SnakeCase) e novo (Req Body CamelCase)
const calculateChanges = (oldObj, newObj, keyMap) => {
    if (!oldObj) return null;
    const changes = {};
    let hasChanges = false;

    for (const [bodyKey, dbKey] of Object.entries(keyMap)) {
        if (newObj[bodyKey] !== undefined) {
            let valOld = oldObj[dbKey];
            let valNew = newObj[bodyKey];

            if (valOld instanceof Date) valOld = valOld.toISOString().split('T')[0];
            
            if (typeof valOld === 'number' || !isNaN(Number(valOld))) valOld = String(valOld);
            if (typeof valNew === 'number' || !isNaN(Number(valNew))) valNew = String(valNew);
            
            if (!valOld && !valNew) continue;

            if (valOld != valNew) {
                changes[bodyKey] = { old: valOld, new: valNew };
                hasChanges = true;
            }
        }
    }
    return hasChanges ? changes : null;
};

// Helper para Atualizar Saldo da Conta
const updateAccountBalance = async (client, accountId, amount, type, isReversal = false) => {
    if (!accountId) return;
    let multiplier = 1;
    if (type === 'EXPENSE') multiplier = -1;
    if (isReversal) multiplier *= -1;
    const finalChange = amount * multiplier;
    await client.query(
        `UPDATE accounts SET balance = balance + $1 WHERE id = $2`,
        [finalChange, accountId]
    );
};

const sanitizeValue = (val) => {
    if (val === undefined || val === null) return null;
    if (typeof val === 'string' && val.trim() === '') return null;
    return val;
};

// --- NFC-e Parsers Logic ---
const extractAccessKey = (urlStr) => {
    try {
        const url = new URL(urlStr);
        let p = url.searchParams.get('p');
        if (p && p.includes('|')) p = p.split('|')[0];
        if (!p) {
            const match = urlStr.match(/\d{44}/);
            if (match) return match[0];
        }
        return p ? p.replace(/\D/g, '') : null;
    } catch (e) {
        const match = urlStr.match(/p=(\d{44})/);
        if (match) return match[1];
        return null;
    }
};

const detectPaymentMethod = (html) => {
    if (html.match(/Crédito|Cartão de Crédito/i)) return 'CREDIT';
    if (html.match(/Débito|Cartão de Débito/i)) return 'DEBIT';
    if (html.match(/Pix/i)) return 'PIX';
    if (html.match(/Dinheiro/i)) return 'CASH';
    return null;
};

const robustParser = (html) => {
    let amount = null;
    const amountPatterns = [
        /class=["'][^"']*linhaShade[^"']*["'][\s\S]*?class=["'][^"']*txtMax[^"']*["'][^>]*>\s*(?:<[^>]+>)*\s*(?:R\$\s*)?([\d\.,]+)/i,
        /class=["'][^"']*txtMax[^"']*["'][^>]*>\s*(?:<[^>]+>)*\s*(?:R\$\s*)?([\d\.,]+)/i,
        /Valor\s*a\s*Pagar[\s\S]*?(?:R\$\s*)?([\d\.,]+)/i
    ];
    for (const p of amountPatterns) {
        const m = html.match(p);
        if (m) { amount = m[1]; break; }
    }

    let merchant = null;
    const merchantPatterns = [
        /class=["'][^"']*txtTopo[^"']*["'][^>]*>\s*(?:<[^>]+>)*\s*([^<]+)/i,
        /id=["']lblNomeEmitente["'][^>]*>\s*([^<]+)/i,
        /Razão\s*Social[:\s]*<\/label>\s*<span>([^<]+)/i,
        /<h4[^>]*>\s*([^<]+)<\/h4>/i 
    ];
    for (const p of merchantPatterns) {
        const m = html.match(p);
        if (m) { merchant = m[1].replace(/<[^>]+>/g, '').trim(); break; }
    }

    let date = null;
    const datePatterns = [
        /<strong>\s*Emiss[ãa]o:\s*<\/strong>\s*(\d{2}\/\d{2}\/\d{4})/i,
        /(\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}:\d{2}/,
        /Data\s*de\s*Emissão.*?(\d{2}\/\d{2}\/\d{4})/i
    ];
    for (const p of datePatterns) {
        const m = html.match(p);
        if (m) { date = m[1]; break; }
    }

    return { amount, merchant, date, paymentType: detectPaymentMethod(html) };
};

const parsers = {
    '35': robustParser,
    '41': (html) => {
        const p = robustParser(html);
        if (p.amount) return p;
        const amountMatch = html.match(/Valor\s*Total.*?R\$\s*([\d\.,]+)/i);
        const merchantMatch = html.match(/id=["']u20["'][^>]*>([^<]+)<\/span>/i);
        const dateMatch = html.match(/(\d{2}\/\d{2}\/\d{4})\s+[\d:]+/);
        return {
            amount: amountMatch ? amountMatch[1] : null,
            merchant: merchantMatch ? merchantMatch[1].trim() : null,
            date: dateMatch ? dateMatch[1] : null,
            paymentType: detectPaymentMethod(html)
        };
    },
    'default': robustParser
};

// --- MIGRATIONS ---
pool.connect().then(async (client) => {
    console.log('DB Connected Successfully');
    try {
        await client.query(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password_hash TEXT, google_id TEXT, family_id TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, settings JSONB DEFAULT '{"includeCreditCardsInTotal": true}');`);
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'USER';`);
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS entity_type TEXT DEFAULT 'PF';`);
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'TRIAL';`);
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'TRIALING';`);
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP;`);

        await client.query(`CREATE TABLE IF NOT EXISTS contacts (id TEXT PRIMARY KEY, name TEXT NOT NULL, user_id TEXT REFERENCES users(id), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);
        await client.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS email TEXT;`);
        await client.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS phone TEXT;`);
        await client.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS document TEXT;`);
        await client.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS pix_key TEXT;`);

        await client.query(`CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT, user_id TEXT REFERENCES users(id), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);
        
        await client.query(`CREATE TABLE IF NOT EXISTS company_profiles (id TEXT PRIMARY KEY, trade_name TEXT, legal_name TEXT, cnpj TEXT, user_id TEXT REFERENCES users(id) UNIQUE);`);
        // Migrations for Extended PJ Fields
        await client.query(`ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS tax_regime TEXT;`);
        await client.query(`ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS cnae TEXT;`);
        await client.query(`ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS city TEXT;`);
        await client.query(`ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS state TEXT;`);
        await client.query(`ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS has_employees BOOLEAN DEFAULT FALSE;`);
        await client.query(`ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS issues_invoices BOOLEAN DEFAULT FALSE;`);
        
        // Novas colunas para endereço completo e contato (Endereço, Telefone, Email, CNAEs Secundários)
        await client.query(`ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS secondary_cnaes TEXT;`);
        await client.query(`ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS zip_code TEXT;`);
        await client.query(`ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS street TEXT;`);
        await client.query(`ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS number TEXT;`);
        await client.query(`ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS neighborhood TEXT;`);
        await client.query(`ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS phone TEXT;`);
        await client.query(`ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS email TEXT;`);

        await client.query(`CREATE TABLE IF NOT EXISTS branches (id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT, user_id TEXT REFERENCES users(id));`);
        await client.query(`CREATE TABLE IF NOT EXISTS cost_centers (id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT, user_id TEXT REFERENCES users(id));`);
        await client.query(`CREATE TABLE IF NOT EXISTS departments (id TEXT PRIMARY KEY, name TEXT NOT NULL, user_id TEXT REFERENCES users(id));`);
        await client.query(`CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, user_id TEXT REFERENCES users(id));`);

        await client.query(`CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT, balance DECIMAL(15,2) DEFAULT 0, user_id TEXT REFERENCES users(id), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);
        await client.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(15,2);`);
        await client.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS closing_day INTEGER;`);
        await client.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS due_day INTEGER;`);

        await client.query(`CREATE TABLE IF NOT EXISTS goals (id TEXT PRIMARY KEY, name TEXT NOT NULL, target_amount DECIMAL(15,2) NOT NULL, current_amount DECIMAL(15,2) NOT NULL, deadline DATE, user_id TEXT REFERENCES users(id), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);

        await client.query(`CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY, description TEXT NOT NULL, amount DECIMAL(15,2) NOT NULL, type TEXT NOT NULL, category TEXT NOT NULL, date DATE NOT NULL, status TEXT NOT NULL, account_id TEXT REFERENCES accounts(id) ON DELETE CASCADE, user_id TEXT REFERENCES users(id), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);
        await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS destination_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL;`);
        await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL;`);
        await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE;`);
        await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS recurrence_frequency TEXT;`);
        await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS recurrence_end_date DATE;`);
        await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS interest_rate DECIMAL(10,2) DEFAULT 0;`);
        await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL;`);
        await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS cost_center_id TEXT REFERENCES cost_centers(id) ON DELETE SET NULL;`);
        await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS department_id TEXT REFERENCES departments(id) ON DELETE SET NULL;`);
        await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS project_id TEXT REFERENCES projects(id) ON DELETE SET NULL;`);
        await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS classification TEXT DEFAULT 'STANDARD';`);
        await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS destination_branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL;`);
        await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL;`);
        await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS created_by TEXT REFERENCES users(id) ON DELETE SET NULL;`);
        await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS updated_by TEXT REFERENCES users(id) ON DELETE SET NULL;`);
        await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;`);

        await client.query(`CREATE TABLE IF NOT EXISTS audit_logs (id SERIAL PRIMARY KEY, user_id TEXT REFERENCES users(id), action TEXT NOT NULL, entity TEXT NOT NULL, entity_id TEXT NOT NULL, details TEXT, timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP, previous_state JSONB, changes JSONB);`);

        await client.query(`CREATE TABLE IF NOT EXISTS memberships (id SERIAL PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE CASCADE, family_id TEXT NOT NULL, role TEXT DEFAULT 'MEMBER', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, permissions JSONB DEFAULT '[]', UNIQUE(user_id, family_id));`);
        await client.query(`INSERT INTO memberships (user_id, family_id, role) SELECT id, family_id, 'ADMIN' FROM users WHERE family_id IS NOT NULL ON CONFLICT (user_id, family_id) DO NOTHING;`);

        await client.query(`CREATE TABLE IF NOT EXISTS invites (id SERIAL PRIMARY KEY, code TEXT NOT NULL, family_id TEXT NOT NULL, created_by TEXT NOT NULL, expires_at TIMESTAMP NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);

        // Generic Module Tables
        await client.query(`CREATE TABLE IF NOT EXISTS module_clients (id TEXT PRIMARY KEY, contact_id TEXT REFERENCES contacts(id) ON DELETE CASCADE, notes TEXT, birth_date DATE, module_tag TEXT DEFAULT 'GENERAL', user_id TEXT REFERENCES users(id), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, insurance TEXT, allergies TEXT, medications TEXT);`);
        await client.query(`CREATE TABLE IF NOT EXISTS module_services (id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT, default_price DECIMAL(15,2), module_tag TEXT DEFAULT 'GENERAL', user_id TEXT REFERENCES users(id), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);
        await client.query(`CREATE TABLE IF NOT EXISTS module_appointments (id TEXT PRIMARY KEY, client_id TEXT REFERENCES module_clients(id) ON DELETE CASCADE, service_id TEXT REFERENCES module_services(id) ON DELETE SET NULL, date TIMESTAMP NOT NULL, status TEXT DEFAULT 'SCHEDULED', notes TEXT, transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL, module_tag TEXT DEFAULT 'GENERAL', user_id TEXT REFERENCES users(id), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);

        // Soft Delete
        const tables = ['accounts', 'transactions', 'contacts', 'categories', 'goals', 'branches', 'cost_centers', 'departments', 'projects', 'module_clients', 'module_services', 'module_appointments'];
        for (const t of tables) {
            await client.query(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;`);
        }

        console.log('Migrations verified.');
    } catch (e) {
        console.error('Migration Error:', e.message);
    } finally {
        client.release();
    }
}).catch(err => console.error('DB Connection Error:', err));

// --- Configs ---
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "272556908691-3gnld5rsjj6cv2hspp96jt2fb3okkbhv.apps.googleusercontent.com";
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
const WHATSAPP_API_URL = "https://graph.facebook.com/v22.0/934237103105071/messages";
const WHATSAPP_TOKEN = "EAFpabmZBi0U0BQKRhGRsH8eVtgUPLNUoDi2mg2r8bDAj9vfBcolZC9CONlSdqFVug7FXrCKZCGsgxPiIUZBc2kIdnZBbnZAVZAJFOFRk4f3ZA3bsOwEyO87bzZBGwUY0Aj0aQTHq1mcYxHaebickk8ubQsz6G4Y0hnlIxcmj0WQFKasRy8KFLobi0torRxc2NzYE5Q17KToe24ngyadf2PdbRmfKahoO26mALs6yAMUTyiZBm9ufcIod9fipU8ZCzP0mBIqgmzClQtbonxa43kQ11CGTh7f1ZAxuDPwLlZCZCTZA8c3";

// --- Middleware ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.sendStatus(401);
  const token = authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

const familyCheckParam2 = `user_id IN (SELECT id FROM users WHERE family_id = (SELECT family_id FROM users WHERE id = $2))`;

// Helper: Get Workspaces for User
const getUserWorkspaces = async (userId) => {
    const res = await pool.query(`
        SELECT m.family_id as id, u.name as name, m.role, u.entity_type as "entityType", m.permissions
        FROM memberships m JOIN users u ON m.family_id = u.id WHERE m.user_id = $1
    `, [userId]);
    return res.rows;
};

// --- WHATSAPP LOGIC ---
const sendWhatsappMessage = async (to, templateName = 'jaspers_market_plain_text_v1') => {
    if (!to) return;
    const cleanPhone = to.replace(/\D/g, '');
    try {
        const response = await fetch(WHATSAPP_API_URL, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ messaging_product: "whatsapp", to: cleanPhone, type: "template", template: { name: templateName, language: { code: "en_US" } } })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || "Failed to send message");
        return data;
    } catch (e) { console.error("WhatsApp Exception:", e); throw e; }
};

// --- Routes ---

app.get('/api/health', async (req, res) => res.json({ status: 'OK' }));

app.post('/api/consult-cnpj', async (req, res) => {
    const { cnpj } = req.body;
    if (!cnpj) return res.status(400).json({ error: 'CNPJ obrigatório' });
    
    // BrasilAPI expects just numbers. Ensure it is a string first.
    const cleanCnpj = String(cnpj).replace(/\D/g, '');
    
    if (cleanCnpj.length !== 14) {
         return res.status(400).json({ error: 'CNPJ inválido (deve ter 14 dígitos)' });
    }

    try {
        console.log(`Consulting CNPJ: ${cleanCnpj}`);
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; FinManager/1.0;)'
            }
        });
        
        if (!response.ok) {
            console.error(`BrasilAPI Error: ${response.status} ${response.statusText}`);
            throw new Error("CNPJ não encontrado ou erro na BrasilAPI");
        }
        
        const data = await response.json();
        res.json(data);
    } catch (e) {
        console.error("Consult CNPJ Exception:", e);
        res.status(404).json({ error: e.message });
    }
});

app.post('/api/test-whatsapp', authenticateToken, async (req, res) => {
    const { phone } = req.body;
    try {
        const result = await sendWhatsappMessage(phone);
        res.json({ success: true, data: result });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Auth Routes
app.get('/api/auth/me', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const userRow = (await pool.query('SELECT * FROM users WHERE id = $1', [userId])).rows[0];
        if (!userRow) return res.status(404).json({ error: 'User not found' });
        const workspaces = await getUserWorkspaces(userId);
        const ownerRes = await pool.query('SELECT entity_type FROM users WHERE id = $1', [userRow.family_id]);
        const user = { 
            id: userRow.id, name: userRow.name, email: userRow.email, familyId: userRow.family_id,
            settings: userRow.settings, role: userRow.role, entityType: ownerRes.rows[0]?.entity_type || userRow.entity_type,
            plan: userRow.plan, status: userRow.status, trialEndsAt: userRow.trial_ends_at, workspaces
        };
        res.json({ user });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, entityType, plan, companyData } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const id = crypto.randomUUID();
    if ((await pool.query('SELECT * FROM users WHERE email = $1', [email])).rows.length > 0) return res.status(400).json({ error: 'Email já cadastrado' });
    
    const trialEndsAt = new Date(); trialEndsAt.setDate(trialEndsAt.getDate() + 15);
    const defaultSettings = { includeCreditCardsInTotal: true };

    await pool.query(
      `INSERT INTO users (id, name, email, password_hash, family_id, settings, role, entity_type, plan, status, trial_ends_at) VALUES ($1, $2, $3, $4, $1, $5, $6, $7, $8, $9, $10)`,
      [id, name, email, hashedPassword, defaultSettings, 'USER', entityType || 'PF', plan || 'TRIAL', 'TRIALING', trialEndsAt]
    );
    await pool.query('INSERT INTO memberships (user_id, family_id, role) VALUES ($1, $1, $2)', [id, 'ADMIN']);
    
    // If PJ and company data provided, create profile immediately
    if (entityType === 'PJ' && companyData) {
        await pool.query(
            `INSERT INTO company_profiles (
                id, trade_name, legal_name, cnpj, tax_regime, cnae, city, state, has_employees, issues_invoices, user_id,
                zip_code, street, number, neighborhood, phone, email, secondary_cnaes
            ) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
            [
                crypto.randomUUID(),
                companyData.tradeName || name, 
                companyData.legalName || name, 
                companyData.cnpj || '', 
                companyData.taxRegime || 'SIMPLES',
                companyData.cnae,
                companyData.city,
                companyData.state,
                companyData.hasEmployees || false,
                companyData.issuesInvoices || false,
                id,
                companyData.zipCode,
                companyData.street,
                companyData.number,
                companyData.neighborhood,
                companyData.phone,
                companyData.email,
                companyData.secondaryCnaes
            ]
        );
    }

    const workspaces = await getUserWorkspaces(id);
    const user = { id, name, email, familyId: id, settings: defaultSettings, role: 'USER', entityType: entityType || 'PF', plan: plan || 'TRIAL', status: 'TRIALING', trialEndsAt, workspaces };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
    await logAudit(pool, id, 'CREATE', 'user', id, `Novo usuário: ${name}`);
    res.json({ token, user });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const userRow = (await pool.query('SELECT * FROM users WHERE email = $1', [email])).rows[0];
    if (!userRow || !userRow.password_hash || !(await bcrypt.compare(password, userRow.password_hash))) return res.status(400).json({ error: 'Credenciais inválidas' });
    
    if (!userRow.family_id) { await pool.query('UPDATE users SET family_id = $1 WHERE id = $2', [userRow.id, userRow.id]); userRow.family_id = userRow.id; }
    await pool.query(`INSERT INTO memberships (user_id, family_id, role) VALUES ($1, $2, 'ADMIN') ON CONFLICT (user_id, family_id) DO NOTHING`, [userRow.id, userRow.family_id]);

    const workspaces = await getUserWorkspaces(userRow.id);
    const ownerRes = await pool.query('SELECT entity_type FROM users WHERE id = $1', [userRow.family_id]);
    const user = { 
        id: userRow.id, name: userRow.name, email: userRow.email, familyId: userRow.family_id,
        settings: userRow.settings || { includeCreditCardsInTotal: true }, role: userRow.role || 'USER', 
        entityType: ownerRes.rows[0]?.entity_type || userRow.entity_type, plan: userRow.plan, status: userRow.status, trialEndsAt: userRow.trial_ends_at, workspaces
    };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/google', async (req, res) => {
  const { token: credential } = req.body;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
    const { sub: googleId, email, name } = ticket.getPayload();
    let userRow = (await pool.query('SELECT * FROM users WHERE email = $1', [email])).rows[0];
    const defaultSettings = { includeCreditCardsInTotal: true };
    const trialEndsAt = new Date(); trialEndsAt.setDate(trialEndsAt.getDate() + 15);

    if (!userRow) {
       const id = crypto.randomUUID();
       await pool.query(`INSERT INTO users (id, name, email, google_id, family_id, settings, role, entity_type, plan, status, trial_ends_at) VALUES ($1, $2, $3, $4, $1, $5, 'USER', 'PF', 'TRIAL', 'TRIALING', $6)`, [id, name, email, googleId, defaultSettings, trialEndsAt]);
       await pool.query('INSERT INTO memberships (user_id, family_id, role) VALUES ($1, $1, $2)', [id, 'ADMIN']);
       userRow = { id, name, email, family_id: id, settings: defaultSettings, role: 'USER', entity_type: 'PF', plan: 'TRIAL', status: 'TRIALING', trial_ends_at: trialEndsAt };
       await logAudit(pool, id, 'CREATE', 'user', id, `Novo usuário Google: ${name}`);
    } else {
       if (!userRow.google_id) await pool.query('UPDATE users SET google_id = $1 WHERE id = $2', [googleId, userRow.id]);
       if (!userRow.family_id) { await pool.query('UPDATE users SET family_id = $1 WHERE id = $2', [userRow.id, userRow.id]); userRow.family_id = userRow.id; }
       await pool.query(`INSERT INTO memberships (user_id, family_id, role) VALUES ($1, $2, 'ADMIN') ON CONFLICT DO NOTHING`, [userRow.id, userRow.family_id]);
    }
    const workspaces = await getUserWorkspaces(userRow.id);
    const ownerRes = await pool.query('SELECT entity_type FROM users WHERE id = $1', [userRow.family_id]);
    const user = { 
        id: userRow.id, name: userRow.name, email: userRow.email, familyId: userRow.family_id,
        settings: userRow.settings || defaultSettings, role: userRow.role || 'USER',
        entityType: ownerRes.rows[0]?.entity_type || userRow.entity_type, plan: userRow.plan, status: userRow.status, trialEndsAt: userRow.trial_ends_at, workspaces
    };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user });
  } catch (err) { res.status(400).json({ error: 'Google Auth Error: ' + err.message }); }
});

app.post('/api/switch-context', authenticateToken, async (req, res) => {
    const { targetFamilyId } = req.body;
    const userId = req.user.id;
    try {
        if ((await pool.query('SELECT * FROM memberships WHERE user_id = $1 AND family_id = $2', [userId, targetFamilyId])).rows.length === 0) return res.status(403).json({ error: 'Acesso negado' });
        await pool.query('UPDATE users SET family_id = $1 WHERE id = $2', [targetFamilyId, userId]);
        
        const userRow = (await pool.query('SELECT * FROM users WHERE id = $1', [userId])).rows[0];
        const workspaces = await getUserWorkspaces(userId);
        const ownerRes = await pool.query('SELECT entity_type FROM users WHERE id = $1', [targetFamilyId]);
        
        const user = { 
            id: userRow.id, name: userRow.name, email: userRow.email, familyId: userRow.family_id,
            settings: userRow.settings, role: userRow.role, entityType: ownerRes.rows[0]?.entity_type || 'PF',
            plan: userRow.plan, status: userRow.status, trialEndsAt: userRow.trial_ends_at, workspaces
        };
        const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, token, user });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Profile & Settings
app.put('/api/profile', authenticateToken, async (req, res) => {
    const { name, email, currentPassword, newPassword } = req.body;
    const userId = req.user.id;
    try {
        const user = (await pool.query('SELECT * FROM users WHERE id = $1', [userId])).rows[0];
        let passwordHash = user.password_hash;
        if (newPassword) {
            if (!user.google_id) {
                if (!currentPassword || !(await bcrypt.compare(currentPassword, user.password_hash))) return res.status(400).json({ error: 'Senha atual incorreta.' });
            }
            passwordHash = await bcrypt.hash(newPassword, 10);
        }
        if (email !== user.email && (await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, userId])).rows.length > 0) return res.status(400).json({ error: 'Email já está em uso.' });

        await pool.query(`UPDATE users SET name = $1, email = $2, password_hash = $3 WHERE id = $4`, [name, email, passwordHash, userId]);
        
        // Return fresh user
        const updatedUser = (await pool.query('SELECT * FROM users WHERE id = $1', [userId])).rows[0];
        const workspaces = await getUserWorkspaces(userId);
        res.json({ user: { 
            id: updatedUser.id, name: updatedUser.name, email: updatedUser.email, familyId: updatedUser.family_id,
            settings: updatedUser.settings, role: updatedUser.role, entityType: updatedUser.entity_type, workspaces
        }});
        await logAudit(pool, userId, 'UPDATE', 'user', userId, 'Perfil atualizado');
    } catch (err) { res.status(500).json({ error: 'Erro ao atualizar perfil.' }); }
});

app.post('/api/settings', authenticateToken, async (req, res) => {
    const { settings } = req.body;
    try {
        await pool.query('UPDATE users SET settings = $1 WHERE id = $2', [settings, req.user.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Invites & Team
app.post('/api/invites', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const activeFamilyId = (await pool.query('SELECT family_id FROM users WHERE id = $1', [userId])).rows[0]?.family_id;
        if (!activeFamilyId) return res.status(400).json({error: "Usuário não tem contexto ativo"});
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        const expiresAt = new Date(); expiresAt.setHours(expiresAt.getHours() + 24);
        await pool.query(`INSERT INTO invites (code, family_id, created_by, expires_at) VALUES ($1, $2, $3, $4)`, [code, activeFamilyId, userId, expiresAt]);
        res.json({ code, expiresAt });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/invite/join', authenticateToken, async (req, res) => {
    const { code } = req.body;
    const userId = req.user.id;
    try {
        const invite = (await pool.query('SELECT * FROM invites WHERE code = $1 AND expires_at > NOW()', [code])).rows[0];
        if (!invite) return res.status(404).json({ error: 'Convite inválido ou expirado' });

        const defaultPermissions = JSON.stringify(['FIN_DASHBOARD', 'FIN_TRANSACTIONS', 'FIN_CALENDAR', 'FIN_ACCOUNTS', 'FIN_CARDS', 'FIN_GOALS', 'FIN_REPORTS', 'FIN_CATEGORIES', 'FIN_CONTACTS']);
        await pool.query(`INSERT INTO memberships (user_id, family_id, role, permissions) VALUES ($1, $2, 'MEMBER', $3) ON CONFLICT (user_id, family_id) DO UPDATE SET role = 'MEMBER', permissions = COALESCE(memberships.permissions, $3)`, [userId, invite.family_id, defaultPermissions]);
        await pool.query('UPDATE users SET family_id = $1 WHERE id = $2', [invite.family_id, userId]);
        
        const userRow = (await pool.query('SELECT * FROM users WHERE id = $1', [userId])).rows[0];
        const workspaces = await getUserWorkspaces(userId);
        const ownerRes = await pool.query('SELECT entity_type FROM users WHERE id = $1', [userRow.family_id]);
        
        const user = { id: userRow.id, name: userRow.name, email: userRow.email, familyId: userRow.family_id, settings: userRow.settings, role: userRow.role, entityType: ownerRes.rows[0]?.entity_type || 'PF', workspaces };
        const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, token, user });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/family/members', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const familyId = (await pool.query('SELECT family_id FROM users WHERE id = $1', [userId])).rows[0]?.family_id || userId;
        const members = await pool.query(`SELECT u.id, u.name, u.email, m.role, u.entity_type, m.permissions FROM users u JOIN memberships m ON u.id = m.user_id WHERE m.family_id = $1`, [familyId]);
        res.json(members.rows);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/family/members/:memberId', authenticateToken, async (req, res) => {
    const { role, permissions } = req.body;
    try {
        const familyId = (await pool.query('SELECT family_id FROM users WHERE id = $1', [req.user.id])).rows[0]?.family_id;
        const checkAdmin = await pool.query(`SELECT role FROM memberships WHERE user_id = $1 AND family_id = $2`, [req.user.id, familyId]);
        if (checkAdmin.rows[0]?.role !== 'ADMIN') return res.status(403).json({ error: 'Apenas administradores.' });
        await pool.query(`UPDATE memberships SET role = $1, permissions = $2 WHERE user_id = $3 AND family_id = $4`, [role, JSON.stringify(permissions || []), req.params.memberId, familyId]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/family/members/:memberId', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const memberId = req.params.memberId;
    if (userId === memberId) return res.status(400).json({ error: 'Não pode se remover.' });
    try {
        const familyId = (await pool.query('SELECT family_id FROM users WHERE id = $1', [userId])).rows[0]?.family_id;
        const checkAdmin = await pool.query(`SELECT role FROM memberships WHERE user_id = $1 AND family_id = $2`, [userId, familyId]);
        if (checkAdmin.rows[0]?.role !== 'ADMIN') return res.status(403).json({ error: 'Apenas administradores.' });
        await pool.query(`DELETE FROM memberships WHERE user_id = $1 AND family_id = $2`, [memberId, familyId]);
        await pool.query(`UPDATE users SET family_id = id WHERE id = $1 AND family_id = $2`, [memberId, familyId]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin Stats
app.get('/api/admin/stats', authenticateToken, async (req, res) => {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Acesso negado' });
    try {
        const totalUsers = (await pool.query('SELECT count(*) FROM users')).rows[0].count;
        const active = (await pool.query("SELECT count(*) FROM users WHERE status = 'ACTIVE'")).rows[0].count;
        const trial = (await pool.query("SELECT count(*) FROM users WHERE status = 'TRIALING'")).rows[0].count;
        const pf = (await pool.query("SELECT count(*) FROM users WHERE entity_type = 'PF'")).rows[0].count;
        const pj = (await pool.query("SELECT count(*) FROM users WHERE entity_type = 'PJ'")).rows[0].count;
        res.json({ totalUsers, active, trial, pf, pj, revenue: active * 29 });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/users', authenticateToken, async (req, res) => {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Acesso negado' });
    try {
        const users = await pool.query('SELECT id, name, email, entity_type, plan, status, created_at FROM users ORDER BY created_at DESC LIMIT 50');
        res.json(users.rows);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// Scraper
app.post('/api/scrape-nfce', authenticateToken, async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL é obrigatória' });
    try {
        const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' } });
        if (!response.ok) throw new Error(`Erro SEFAZ: ${response.status}`);
        const html = await response.text();
        const accessKey = extractAccessKey(url);
        const ufCode = accessKey && accessKey.length === 44 ? accessKey.substring(0, 2) : 'default';
        const parser = parsers[ufCode] || parsers['default'];
        const data = parser(html);
        
        let amount = data.amount ? data.amount.replace(/\./g, '').replace(',', '.') : null;
        let date = null;
        if (data.date) { const parts = data.date.split('/'); if (parts.length === 3) date = `${parts[2]}-${parts[1]}-${parts[0]}`; }

        if (!amount) return res.status(422).json({ error: 'Não foi possível ler o valor total.' });
        res.json({ amount: parseFloat(amount), date: date || new Date().toISOString().split('T')[0], merchant: data.merchant || 'Estabelecimento NFC-e', stateCode: ufCode, paymentType: data.paymentType });
    } catch (error) { res.status(500).json({ error: 'Erro ao processar nota.' }); }
});

// DATA Routes (Initial Data)
app.get('/api/initial-data', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const activeFamilyId = (await pool.query('SELECT family_id FROM users WHERE id = $1', [userId])).rows[0]?.family_id || userId;
        const familyFilter = `user_id IN (SELECT id FROM users WHERE family_id = $1)`;
        
        const accs = await pool.query(`SELECT * FROM accounts WHERE ${familyFilter} AND deleted_at IS NULL`, [activeFamilyId]);
        const trans = await pool.query(`SELECT t.*, uc.name as created_by_name FROM transactions t LEFT JOIN users uc ON t.created_by = uc.id WHERE t.${familyFilter} AND t.deleted_at IS NULL ORDER BY t.date DESC`, [activeFamilyId]);
        const goals = await pool.query(`SELECT * FROM goals WHERE ${familyFilter} AND deleted_at IS NULL`, [activeFamilyId]);
        const contacts = await pool.query(`SELECT * FROM contacts WHERE ${familyFilter} AND deleted_at IS NULL ORDER BY name ASC`, [activeFamilyId]);
        let categories = await pool.query(`SELECT * FROM categories WHERE ${familyFilter} AND deleted_at IS NULL ORDER BY name ASC`, [activeFamilyId]);
        
        // Fetch company profile with new fields (using * covers it, but mapping in front needs to match DB column names)
        const companyRes = await pool.query(`SELECT * FROM company_profiles WHERE user_id = $1`, [activeFamilyId]);
        
        const branches = await pool.query(`SELECT * FROM branches WHERE ${familyFilter} AND deleted_at IS NULL`, [activeFamilyId]);
        const costCenters = await pool.query(`SELECT * FROM cost_centers WHERE ${familyFilter} AND deleted_at IS NULL`, [activeFamilyId]);
        const departments = await pool.query(`SELECT * FROM departments WHERE ${familyFilter} AND deleted_at IS NULL`, [activeFamilyId]);
        const projects = await pool.query(`SELECT * FROM projects WHERE ${familyFilter} AND deleted_at IS NULL`, [activeFamilyId]);

        const clients = await pool.query(`SELECT mc.*, c.name as contact_name, c.email as contact_email, c.phone as contact_phone FROM module_clients mc JOIN contacts c ON mc.contact_id = c.id WHERE mc.${familyFilter} AND mc.deleted_at IS NULL`, [activeFamilyId]);
        const services = await pool.query(`SELECT * FROM module_services WHERE ${familyFilter} AND deleted_at IS NULL`, [activeFamilyId]);
        const appts = await pool.query(`SELECT ma.*, c.name as client_name, ms.name as service_name FROM module_appointments ma JOIN module_clients mc ON ma.client_id = mc.id JOIN contacts c ON mc.contact_id = c.id LEFT JOIN module_services ms ON ma.service_id = ms.id WHERE ma.${familyFilter} AND ma.deleted_at IS NULL ORDER BY ma.date ASC`, [activeFamilyId]);

        if (categories.rows.length === 0) {
            const defaults = [{ name: 'Alimentação', type: 'EXPENSE' }, { name: 'Moradia', type: 'EXPENSE' }, { name: 'Salário', type: 'INCOME' }];
            for (const c of defaults) await pool.query('INSERT INTO categories (id, name, type, user_id) VALUES ($1, $2, $3, $4)', [crypto.randomUUID(), c.name, c.type, activeFamilyId]);
            categories = await pool.query(`SELECT * FROM categories WHERE ${familyFilter} AND deleted_at IS NULL ORDER BY name ASC`, [activeFamilyId]);
        }

        res.json({
            accounts: accs.rows.map(r => ({ ...r, balance: parseFloat(r.balance), creditLimit: r.credit_limit ? parseFloat(r.credit_limit) : undefined, closingDay: r.closing_day, dueDay: r.due_day })),
            transactions: trans.rows.map(r => ({ ...r, amount: parseFloat(r.amount), date: new Date(r.date).toISOString().split('T')[0], recurrenceEndDate: r.recurrence_end_date ? new Date(r.recurrence_end_date).toISOString().split('T')[0] : undefined, interestRate: parseFloat(r.interest_rate), accountId: r.account_id, destinationAccountId: r.destination_account_id, contactId: r.contact_id, goalId: r.goal_id, branchId: r.branch_id, destinationBranchId: r.destination_branch_id, costCenterId: r.cost_center_id, departmentId: r.department_id, projectId: r.project_id, createdByName: r.created_by_name })),
            goals: goals.rows.map(r => ({ ...r, targetAmount: parseFloat(r.target_amount), currentAmount: parseFloat(r.current_amount), deadline: r.deadline ? new Date(r.deadline).toISOString().split('T')[0] : undefined })),
            contacts: contacts.rows.map(r => ({ id: r.id, name: r.name, email: r.email, phone: r.phone, document: r.document, pixKey: r.pix_key })),
            categories: categories.rows.map(r => ({ id: r.id, name: r.name, type: r.type })),
            companyProfile: companyRes.rows[0] ? { 
                id: companyRes.rows[0].id, 
                tradeName: companyRes.rows[0].trade_name, 
                legalName: companyRes.rows[0].legal_name, 
                cnpj: companyRes.rows[0].cnpj,
                taxRegime: companyRes.rows[0].tax_regime,
                cnae: companyRes.rows[0].cnae,
                city: companyRes.rows[0].city,
                state: companyRes.rows[0].state,
                hasEmployees: companyRes.rows[0].has_employees,
                issuesInvoices: companyRes.rows[0].issues_invoices,
                // Mapeamento dos novos campos
                zipCode: companyRes.rows[0].zip_code,
                street: companyRes.rows[0].street,
                number: companyRes.rows[0].number,
                neighborhood: companyRes.rows[0].neighborhood,
                phone: companyRes.rows[0].phone,
                email: companyRes.rows[0].email,
                secondaryCnaes: companyRes.rows[0].secondary_cnaes
            } : null,
            branches: branches.rows.map(r => ({ id: r.id, name: r.name, code: r.code })),
            costCenters: costCenters.rows.map(r => ({ id: r.id, name: r.name, code: r.code })),
            departments: departments.rows.map(r => ({ id: r.id, name: r.name })),
            projects: projects.rows.map(r => ({ id: r.id, name: r.name })),
            serviceClients: clients.rows.map(r => ({ id: r.id, contactId: r.contact_id, contactName: r.contact_name, contactEmail: r.contact_email, contactPhone: r.contact_phone, notes: r.notes, birthDate: r.birth_date ? new Date(r.birth_date).toISOString().split('T')[0] : undefined, insurance: r.insurance, allergies: r.allergies, medications: r.medications, moduleTag: r.module_tag })),
            serviceItems: services.rows.map(r => ({ id: r.id, name: r.name, code: r.code, defaultPrice: parseFloat(r.default_price), moduleTag: r.module_tag })),
            serviceAppointments: appts.rows.map(r => ({ id: r.id, clientId: r.client_id, clientName: r.client_name, serviceId: r.service_id, serviceName: r.service_name, date: r.date, status: r.status, notes: r.notes, transactionId: r.transaction_id, moduleTag: r.module_tag }))
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- CRUD Endpoints ---

app.post('/api/accounts', authenticateToken, async (req, res) => {
    const { id, name, type, balance, creditLimit, closingDay, dueDay } = req.body;
    try {
        const existing = (await pool.query('SELECT * FROM accounts WHERE id = $1', [id])).rows[0];
        const changes = calculateChanges(existing, req.body, { name: 'name', type: 'type', balance: 'balance', creditLimit: 'credit_limit', closingDay: 'closing_day', dueDay: 'due_day' });
        await pool.query(`INSERT INTO accounts (id, name, type, balance, user_id, credit_limit, closing_day, due_day) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO UPDATE SET name=$2, type=$3, balance=$4, credit_limit=$6, closing_day=$7, due_day=$8, deleted_at=NULL`, [id, name, type, balance, req.user.id, creditLimit||null, closingDay||null, dueDay||null]);
        await logAudit(pool, req.user.id, existing ? 'UPDATE' : 'CREATE', 'account', id, `Conta: ${name}`, existing, changes);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/accounts/:id', authenticateToken, async (req, res) => {
    try {
        const prev = (await pool.query('SELECT * FROM accounts WHERE id=$1', [req.params.id])).rows[0];
        await pool.query(`UPDATE accounts SET deleted_at = NOW() WHERE id = $1 AND ${familyCheckParam2}`, [req.params.id, req.user.id]);
        await logAudit(pool, req.user.id, 'DELETE', 'account', req.params.id, `Conta: ${prev?.name}`, prev);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/transactions', authenticateToken, async (req, res) => {
    const t = req.body; const u = req.user.id;
    try {
        const existing = (await pool.query('SELECT * FROM transactions WHERE id=$1', [t.id])).rows[0];
        const changes = calculateChanges(existing, t, { description: 'description', amount: 'amount', type: 'type', category: 'category', date: 'date', status: 'status', accountId: 'account_id', destinationAccountId: 'destination_account_id' });
        await pool.query(`INSERT INTO transactions (id, description, amount, type, category, date, status, account_id, destination_account_id, is_recurring, recurrence_frequency, recurrence_end_date, interest_rate, contact_id, goal_id, user_id, branch_id, cost_center_id, department_id, project_id, classification, destination_branch_id, created_by, updated_by, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $23, NOW()) ON CONFLICT (id) DO UPDATE SET description=$2, amount=$3, type=$4, category=$5, date=$6, status=$7, account_id=$8, destination_account_id=$9, is_recurring=$10, recurrence_frequency=$11, recurrence_end_date=$12, interest_rate=$13, contact_id=$14, goal_id=$15, branch_id=$17, cost_center_id=$18, department_id=$19, project_id=$20, classification=$21, destination_branch_id=$22, updated_by=$23, updated_at=NOW(), deleted_at=NULL`, 
        [t.id, t.description, t.amount, t.type, t.category, t.date, t.status, t.accountId, sanitizeValue(t.destinationAccountId), t.isRecurring, t.recurrenceFrequency, t.recurrenceEndDate, t.interestRate||0, sanitizeValue(t.contactId), sanitizeValue(t.goalId), u, sanitizeValue(t.branchId), sanitizeValue(t.costCenterId), sanitizeValue(t.departmentId), sanitizeValue(t.projectId), t.classification||'STANDARD', sanitizeValue(t.destinationBranchId), u]);
        
        if (t.goalId && t.status === 'PAID') {
            const diff = parseFloat(t.amount) - (existing && existing.goal_id === t.goalId ? parseFloat(existing.amount) : 0);
            await pool.query(`UPDATE goals SET current_amount = current_amount + $1 WHERE id = $2`, [diff, t.goalId]);
        }
        await logAudit(pool, u, existing ? 'UPDATE' : 'CREATE', 'transaction', t.id, `${t.type}: ${t.description}`, existing, changes);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/transactions/:id', authenticateToken, async (req, res) => {
    try {
        const prev = (await pool.query('SELECT * FROM transactions WHERE id=$1', [req.params.id])).rows[0];
        await pool.query(`UPDATE transactions SET deleted_at = NOW() WHERE id = $1 AND ${familyCheckParam2}`, [req.params.id, req.user.id]);
        if (prev && prev.goal_id && prev.status === 'PAID') await pool.query(`UPDATE goals SET current_amount = current_amount - $1 WHERE id = $2`, [prev.amount, prev.goal_id]);
        await logAudit(pool, req.user.id, 'DELETE', 'transaction', req.params.id, prev?.description, prev);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/contacts', authenticateToken, async (req, res) => {
    const { id, name, email, phone, document, pixKey } = req.body;
    try {
        const existing = (await pool.query('SELECT * FROM contacts WHERE id=$1', [id])).rows[0];
        const changes = calculateChanges(existing, req.body, { name: 'name', email: 'email', phone: 'phone', document: 'document', pixKey: 'pix_key' });
        await pool.query(`INSERT INTO contacts (id, name, user_id, email, phone, document, pix_key) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO UPDATE SET name=$2, email=$4, phone=$5, document=$6, pix_key=$7, deleted_at=NULL`, [id, name, req.user.id, sanitizeValue(email), sanitizeValue(phone), sanitizeValue(document), sanitizeValue(pixKey)]);
        await logAudit(pool, req.user.id, existing ? 'UPDATE' : 'CREATE', 'contact', id, name, existing, changes);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/contacts/:id', authenticateToken, async (req, res) => {
    try {
        const prev = (await pool.query('SELECT * FROM contacts WHERE id=$1', [req.params.id])).rows[0];
        await pool.query(`UPDATE contacts SET deleted_at = NOW() WHERE id = $1 AND ${familyCheckParam2}`, [req.params.id, req.user.id]);
        await logAudit(pool, req.user.id, 'DELETE', 'contact', req.params.id, prev?.name, prev);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/categories', authenticateToken, async (req, res) => {
    const { id, name, type } = req.body;
    try {
        const existing = (await pool.query('SELECT * FROM categories WHERE id=$1', [id])).rows[0];
        const changes = calculateChanges(existing, req.body, { name: 'name', type: 'type' });
        await pool.query(`INSERT INTO categories (id, name, type, user_id) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET name=$2, type=$3, deleted_at=NULL`, [id, name, type||null, req.user.id]);
        await logAudit(pool, req.user.id, existing ? 'UPDATE' : 'CREATE', 'category', id, name, existing, changes);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/categories/:id', authenticateToken, async (req, res) => {
    try {
        const prev = (await pool.query('SELECT * FROM categories WHERE id=$1', [req.params.id])).rows[0];
        await pool.query(`UPDATE categories SET deleted_at = NOW() WHERE id = $1 AND ${familyCheckParam2}`, [req.params.id, req.user.id]);
        await logAudit(pool, req.user.id, 'DELETE', 'category', req.params.id, prev?.name, prev);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/goals', authenticateToken, async (req, res) => {
    const { id, name, targetAmount, currentAmount, deadline } = req.body;
    try {
        const existing = (await pool.query('SELECT * FROM goals WHERE id=$1', [id])).rows[0];
        const changes = calculateChanges(existing, req.body, { name: 'name', targetAmount: 'target_amount', currentAmount: 'current_amount', deadline: 'deadline' });
        await pool.query(`INSERT INTO goals (id, name, target_amount, current_amount, deadline, user_id) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET name=$2, target_amount=$3, current_amount=$4, deadline=$5, deleted_at=NULL`, [id, name, targetAmount, currentAmount, deadline||null, req.user.id]);
        await logAudit(pool, req.user.id, existing ? 'UPDATE' : 'CREATE', 'goal', id, name, existing, changes);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/goals/:id', authenticateToken, async (req, res) => {
    try {
        const prev = (await pool.query('SELECT * FROM goals WHERE id=$1', [req.params.id])).rows[0];
        await pool.query(`UPDATE goals SET deleted_at = NOW() WHERE id = $1 AND ${familyCheckParam2}`, [req.params.id, req.user.id]);
        await logAudit(pool, req.user.id, 'DELETE', 'goal', req.params.id, prev?.name, prev);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// PJ Routes
app.post('/api/company', authenticateToken, async (req, res) => {
    const { id, tradeName, legalName, cnpj, taxRegime, cnae, city, state, hasEmployees, issuesInvoices, zipCode, street, number, neighborhood, phone, email, secondaryCnaes } = req.body;
    try {
        const familyId = (await pool.query('SELECT family_id FROM users WHERE id = $1', [req.user.id])).rows[0]?.family_id || req.user.id;
        const existing = (await pool.query('SELECT * FROM company_profiles WHERE user_id = $1', [familyId])).rows[0];
        const changes = calculateChanges(existing, req.body, { 
            tradeName: 'trade_name', 
            legalName: 'legal_name', 
            cnpj: 'cnpj', 
            taxRegime: 'tax_regime', 
            cnae: 'cnae',
            zipCode: 'zip_code',
            street: 'street',
            number: 'number',
            neighborhood: 'neighborhood',
            city: 'city',
            state: 'state',
            phone: 'phone',
            email: 'email',
            secondaryCnaes: 'secondary_cnaes'
        });
        
        await pool.query(
            `INSERT INTO company_profiles (
                id, trade_name, legal_name, cnpj, tax_regime, cnae, city, state, has_employees, issues_invoices, user_id,
                zip_code, street, number, neighborhood, phone, email, secondary_cnaes
            ) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) 
             ON CONFLICT (user_id) DO UPDATE SET 
                trade_name=$2, legal_name=$3, cnpj=$4, tax_regime=$5, cnae=$6, city=$7, state=$8, has_employees=$9, issues_invoices=$10,
                zip_code=$12, street=$13, number=$14, neighborhood=$15, phone=$16, email=$17, secondary_cnaes=$18`, 
            [
                id, tradeName, legalName, cnpj, taxRegime, cnae, city, state, hasEmployees, issuesInvoices, familyId,
                zipCode, street, number, neighborhood, phone, email, secondaryCnaes
            ]
        );
        await logAudit(pool, req.user.id, existing ? 'UPDATE' : 'CREATE', 'company', id, tradeName, existing, changes);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

const createPjEndpoints = (path, table, entity) => {
    app.post(`/api/${path}`, authenticateToken, async (req, res) => {
        const { id, name, code } = req.body;
        try {
            const existing = (await pool.query(`SELECT * FROM ${table} WHERE id=$1`, [id])).rows[0];
            const changes = calculateChanges(existing, req.body, { name: 'name', code: 'code' });
            if (code !== undefined) await pool.query(`INSERT INTO ${table} (id, name, code, user_id) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET name=$2, code=$3, deleted_at=NULL`, [id, name, code, req.user.id]);
            else await pool.query(`INSERT INTO ${table} (id, name, user_id) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET name=$2, deleted_at=NULL`, [id, name, req.user.id]);
            await logAudit(pool, req.user.id, existing ? 'UPDATE' : 'CREATE', entity, id, name, existing, changes);
            res.json({ success: true });
        } catch(err) { res.status(500).json({ error: err.message }); }
    });
    app.delete(`/api/${path}/:id`, authenticateToken, async (req, res) => {
        try {
            const prev = (await pool.query(`SELECT * FROM ${table} WHERE id=$1`, [req.params.id])).rows[0];
            await pool.query(`UPDATE ${table} SET deleted_at = NOW() WHERE id=$1 AND ${familyCheckParam2}`, [req.params.id, req.user.id]);
            await logAudit(pool, req.user.id, 'DELETE', entity, req.params.id, prev?.name, prev);
            res.json({ success: true });
        } catch(err) { res.status(500).json({ error: err.message }); }
    });
};
createPjEndpoints('branches', 'branches', 'branch');
createPjEndpoints('cost-centers', 'cost_centers', 'costCenter');
createPjEndpoints('departments', 'departments', 'department');
createPjEndpoints('projects', 'projects', 'project');

// Module Routes
app.post('/api/modules/clients', authenticateToken, async (req, res) => {
    const { id, contactId, notes, birthDate, moduleTag, insurance, allergies, medications } = req.body;
    try {
        await pool.query(`INSERT INTO module_clients (id, contact_id, notes, birth_date, module_tag, insurance, allergies, medications, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO UPDATE SET contact_id=$2, notes=$3, birth_date=$4, module_tag=$5, insurance=$6, allergies=$7, medications=$8, deleted_at=NULL`, [id, contactId, notes||'', sanitizeValue(birthDate), moduleTag||'GENERAL', sanitizeValue(insurance), sanitizeValue(allergies), sanitizeValue(medications), req.user.id]);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/modules/clients/:id', authenticateToken, async (req, res) => {
    try {
        await pool.query(`UPDATE module_clients SET deleted_at = NOW() WHERE id=$1 AND ${familyCheckParam2}`, [req.params.id, req.user.id]);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/modules/services', authenticateToken, async (req, res) => {
    const { id, name, code, defaultPrice, moduleTag } = req.body;
    try {
        await pool.query(`INSERT INTO module_services (id, name, code, default_price, module_tag, user_id) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET name=$2, code=$3, default_price=$4, module_tag=$5, deleted_at=NULL`, [id, name, sanitizeValue(code), defaultPrice||0, moduleTag||'GENERAL', req.user.id]);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/modules/services/:id', authenticateToken, async (req, res) => {
    try {
        await pool.query(`UPDATE module_services SET deleted_at = NOW() WHERE id=$1 AND ${familyCheckParam2}`, [req.params.id, req.user.id]);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/modules/appointments', authenticateToken, async (req, res) => {
    const { id, clientId, serviceId, date, status, notes, transactionId, moduleTag } = req.body;
    try {
        await pool.query(`INSERT INTO module_appointments (id, client_id, service_id, date, status, notes, transaction_id, module_tag, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO UPDATE SET client_id=$2, service_id=$3, date=$4, status=$5, notes=$6, transaction_id=$7, module_tag=$8, deleted_at=NULL`, [id, clientId, sanitizeValue(serviceId), date, status, notes, sanitizeValue(transactionId), moduleTag||'GENERAL', req.user.id]);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/modules/appointments/:id', authenticateToken, async (req, res) => {
    try {
        await pool.query(`UPDATE module_appointments SET deleted_at = NOW() WHERE id=$1 AND ${familyCheckParam2}`, [req.params.id, req.user.id]);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// Logs & Restore
app.get('/api/audit-logs', authenticateToken, async (req, res) => {
    try {
        const familyId = (await pool.query('SELECT family_id FROM users WHERE id = $1', [req.user.id])).rows[0]?.family_id || req.user.id;
        const logs = await pool.query(`SELECT al.*, u.name as user_name, CASE WHEN al.entity='transaction' THEN (SELECT deleted_at IS NOT NULL FROM transactions WHERE id=al.entity_id) WHEN al.entity='account' THEN (SELECT deleted_at IS NOT NULL FROM accounts WHERE id=al.entity_id) ELSE false END as is_deleted FROM audit_logs al JOIN users u ON al.user_id = u.id WHERE u.family_id = $1 ORDER BY al.timestamp DESC LIMIT 100`, [familyId]);
        res.json(logs.rows.map(r => ({ ...r, isDeleted: r.is_deleted, previousState: r.previous_state, changes: r.changes })));
    } catch(err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/restore', authenticateToken, async (req, res) => {
    const { entity, id } = req.body;
    const tableMap = { 'transaction': 'transactions', 'account': 'accounts', 'contact': 'contacts', 'category': 'categories', 'goal': 'goals' };
    const tableName = tableMap[entity];
    if (!tableName) return res.status(400).json({ error: 'Inválido' });
    try {
        const record = (await pool.query(`SELECT * FROM ${tableName} WHERE id=$1`, [id])).rows[0];
        await pool.query(`UPDATE ${tableName} SET deleted_at = NULL WHERE id=$1 AND ${familyCheckParam2}`, [id, req.user.id]);
        if (entity === 'transaction' && record && record.status === 'PAID') {
            if (record.type === 'TRANSFER') { if (record.account_id) await updateAccountBalance(pool, record.account_id, record.amount, 'EXPENSE'); if (record.destination_account_id) await updateAccountBalance(pool, record.destination_account_id, record.amount, 'INCOME'); }
            else await updateAccountBalance(pool, record.account_id, record.amount, record.type);
            if (record.goal_id) await pool.query(`UPDATE goals SET current_amount = current_amount + $1 WHERE id = $2`, [record.amount, record.goal_id]);
        }
        await logAudit(pool, req.user.id, 'RESTORE', entity, id, 'Registro restaurado', record);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/revert-change', authenticateToken, async (req, res) => {
    const { logId } = req.body;
    try {
        const log = (await pool.query('SELECT * FROM audit_logs WHERE id=$1', [logId])).rows[0];
        if (!log || !log.previous_state) return res.status(400).json({ error: 'Inválido' });
        const tableMap = { 'transaction': 'transactions', 'account': 'accounts', 'contact': 'contacts', 'category': 'categories' };
        const tableName = tableMap[log.entity];
        if (!tableName) return res.status(400).json({ error: 'Entidade desconhecida' });

        const currentState = (await pool.query(`SELECT * FROM ${tableName} WHERE id=$1`, [log.entity_id])).rows[0];
        const keys = Object.keys(log.previous_state).filter(k => !['id','user_id','created_at','updated_at','created_by'].includes(k));
        const setClause = keys.map((k,i) => `"${k}"=$${i+2}`).join(', ');
        await pool.query(`UPDATE ${tableName} SET ${setClause}, updated_at=NOW() WHERE id=$1`, [log.entity_id, ...keys.map(k => log.previous_state[k])]);

        if (log.entity === 'transaction' && currentState && log.previous_state.status === 'PAID') {
            if (currentState.account_id === log.previous_state.account_id) {
                const diff = parseFloat(currentState.amount) - parseFloat(log.previous_state.amount);
                await updateAccountBalance(pool, log.previous_state.account_id, diff, log.previous_state.type === 'INCOME' ? 'EXPENSE' : 'INCOME');
            }
            if (currentState.goal_id) await pool.query(`UPDATE goals SET current_amount = current_amount + $1 WHERE id=$2`, [parseFloat(log.previous_state.amount) - parseFloat(currentState.amount), currentState.goal_id]);
        }
        await logAudit(pool, req.user.id, 'REVERT', log.entity, log.entity_id, 'Reversão de alteração', currentState);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

app.all('/api/*', (req, res) => res.status(404).json({ error: `API route not found: ${req.method} ${req.path}` }));

const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath, { index: false }));
app.get('*', (req, res) => {
    const indexPath = path.join(distPath, 'index.html');
    if (!fs.existsSync(indexPath)) return res.status(500).send('Build not found. Run npm run build.');
    fs.readFile(indexPath, 'utf8', (err, htmlData) => {
        if (err) return res.status(500).send('Error');
        const envScript = `<script>window.GOOGLE_CLIENT_ID = "${GOOGLE_CLIENT_ID}";</script>`;
        res.send(htmlData.replace('</head>', `${envScript}</head>`));
    });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
