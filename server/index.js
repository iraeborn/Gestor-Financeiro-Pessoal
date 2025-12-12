
import 'dotenv/config';
import express from 'express';
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

// Helper para Auditoria
const logAudit = async (client, userId, action, entity, entityId, details, previousState = null) => {
    await client.query(
        `INSERT INTO audit_logs (user_id, action, entity, entity_id, details, previous_state) VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, action, entity, entityId, details, previousState]
    );
};

// Helper para Atualizar Saldo da Conta (Backend Side)
const updateAccountBalance = async (client, accountId, amount, type, isReversal = false) => {
    if (!accountId) return;
    
    // Se for estorno (reversal), inverte a lógica
    // INCOME normal: +saldo. Reversal: -saldo.
    // EXPENSE normal: -saldo. Reversal: +saldo.
    
    let multiplier = 1;
    if (type === 'EXPENSE') multiplier = -1;
    if (isReversal) multiplier *= -1; // Inverte o sinal

    const finalChange = amount * multiplier;

    await client.query(
        `UPDATE accounts SET balance = balance + $1 WHERE id = $2`,
        [finalChange, accountId]
    );
};

pool.connect()
  .then(async (client) => {
    console.log('DB Connected Successfully');
    // Migrations Automáticas
    try {
        // Base Tables
        await client.query(`CREATE TABLE IF NOT EXISTS contacts (id TEXT PRIMARY KEY, name TEXT NOT NULL, user_id TEXT REFERENCES users(id), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);
        await client.query(`CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT, user_id TEXT REFERENCES users(id), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);
        await client.query(`CREATE TABLE IF NOT EXISTS company_profiles (id TEXT PRIMARY KEY, trade_name TEXT, legal_name TEXT, cnpj TEXT, user_id TEXT REFERENCES users(id) UNIQUE);`);
        await client.query(`CREATE TABLE IF NOT EXISTS branches (id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT, user_id TEXT REFERENCES users(id));`);
        await client.query(`CREATE TABLE IF NOT EXISTS cost_centers (id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT, user_id TEXT REFERENCES users(id));`);
        await client.query(`CREATE TABLE IF NOT EXISTS departments (id TEXT PRIMARY KEY, name TEXT NOT NULL, user_id TEXT REFERENCES users(id));`);
        await client.query(`CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, user_id TEXT REFERENCES users(id));`);

        // SaaS Columns
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'USER';`);
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS entity_type TEXT DEFAULT 'PF';`);
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'TRIAL';`);
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'TRIALING';`);
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP;`);
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{"includeCreditCardsInTotal": true}';`);

        // Transaction Columns
        await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS destination_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL;`);
        await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS interest_rate DECIMAL(10,2) DEFAULT 0;`);
        await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL;`);
        await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL;`);
        await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS cost_center_id TEXT REFERENCES cost_centers(id) ON DELETE SET NULL;`);
        await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS department_id TEXT REFERENCES departments(id) ON DELETE SET NULL;`);
        await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS project_id TEXT REFERENCES projects(id) ON DELETE SET NULL;`);
        await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS classification TEXT DEFAULT 'STANDARD';`);
        await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS destination_branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL;`);
        
        // Audit Columns on Transaction
        await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS created_by TEXT REFERENCES users(id) ON DELETE SET NULL;`);
        await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS updated_by TEXT REFERENCES users(id) ON DELETE SET NULL;`);
        await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;`);

        // Accounts Columns
        await client.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(15,2);`);
        await client.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS closing_day INTEGER;`);
        await client.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS due_day INTEGER;`);

        // --- NEW: AUDIT & SOFT DELETE ---
        await client.query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id SERIAL PRIMARY KEY,
                user_id TEXT REFERENCES users(id),
                action TEXT NOT NULL, -- CREATE, UPDATE, DELETE, RESTORE
                entity TEXT NOT NULL, -- table name or entity type
                entity_id TEXT NOT NULL,
                details TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        await client.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS previous_state JSONB;`);

        // 2. Add deleted_at to ALL entities
        const tables = ['accounts', 'transactions', 'contacts', 'categories', 'goals', 'branches', 'cost_centers', 'departments', 'projects'];
        for (const t of tables) {
            await client.query(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;`);
        }

        console.log('Migrations verified.');
    } catch (e) {
        console.error('Migration Error:', e.message);
    } finally {
        client.release();
    }
  })
  .catch(err => console.error('DB Connection Error:', err));

// --- Configs ---
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "272556908691-3gnld5rsjj6cv2hspp96jt2fb3okkbhv.apps.googleusercontent.com";
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

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

const ensureFamilyId = async (userId) => {
    const res = await pool.query('SELECT family_id FROM users WHERE id = $1', [userId]);
    if (res.rows[0] && !res.rows[0].family_id) {
        await pool.query('UPDATE users SET family_id = $1 WHERE id = $1', [userId]);
        return userId;
    }
    return res.rows[0]?.family_id || userId;
};

const sanitizeValue = (val) => {
    if (val === undefined || val === null) return null;
    if (typeof val === 'string' && val.trim() === '') return null;
    return val;
};

// --- Routes ---

app.get('/api/health', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW() as now');
        res.json({ status: 'OK', database: 'Connected', timestamp: result.rows[0].now });
    } catch (err) {
        res.status(500).json({ status: 'ERROR', error: err.message });
    }
});

// --- Auth Routes ---
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, entityType, plan } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const id = crypto.randomUUID();
    
    const check = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (check.rows.length > 0) return res.status(400).json({ error: 'Email já cadastrado' });
    
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 15);
    
    const defaultSettings = { includeCreditCardsInTotal: true };
    const role = 'USER';
    const status = 'TRIALING';

    await pool.query(
      `INSERT INTO users 
       (id, name, email, password_hash, family_id, settings, role, entity_type, plan, status, trial_ends_at) 
       VALUES ($1, $2, $3, $4, $1, $5, $6, $7, $8, $9, $10)`,
      [id, name, email, hashedPassword, defaultSettings, role, entityType || 'PF', plan || 'TRIAL', status, trialEndsAt]
    );

    const user = { 
        id, name, email, familyId: id, settings: defaultSettings,
        role, entityType: entityType || 'PF', plan: plan || 'TRIAL', status, trialEndsAt 
    };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
    
    await logAudit(pool, id, 'CREATE', 'user', id, `Novo usuário: ${name}`);

    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const userRow = result.rows[0];
    if (!userRow || !userRow.password_hash) return res.status(400).json({ error: 'Login inválido' });
    
    const valid = await bcrypt.compare(password, userRow.password_hash);
    if (!valid) return res.status(400).json({ error: 'Senha incorreta' });
    
    let familyId = userRow.family_id;
    if (!familyId) {
        familyId = userRow.id;
        await pool.query('UPDATE users SET family_id = $1 WHERE id = $2', [familyId, userRow.id]);
    }

    const user = { 
        id: userRow.id, name: userRow.name, email: userRow.email, familyId,
        settings: userRow.settings || { includeCreditCardsInTotal: true },
        role: userRow.role || 'USER', entityType: userRow.entity_type,
        plan: userRow.plan, status: userRow.status, trialEndsAt: userRow.trial_ends_at
    };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/google', async (req, res) => {
  const { credential } = req.body;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name } = payload;
    
    let result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    let userRow = result.rows[0];
    const defaultSettings = { includeCreditCardsInTotal: true };
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 15);

    if (!userRow) {
       const id = crypto.randomUUID();
       await pool.query(
        `INSERT INTO users (id, name, email, google_id, family_id, settings, role, entity_type, plan, status, trial_ends_at) 
         VALUES ($1, $2, $3, $4, $1, $5, 'USER', 'PF', 'TRIAL', 'TRIALING', $6)`, 
        [id, name, email, googleId, defaultSettings, trialEndsAt]
       );
       userRow = { id, name, email, family_id: id, settings: defaultSettings, role: 'USER', entity_type: 'PF', plan: 'TRIAL', status: 'TRIALING', trial_ends_at: trialEndsAt };
       await logAudit(pool, id, 'CREATE', 'user', id, `Novo usuário Google: ${name}`);
    } else {
       if (!userRow.google_id) await pool.query('UPDATE users SET google_id = $1 WHERE id = $2', [googleId, userRow.id]);
       if (!userRow.family_id) {
           await pool.query('UPDATE users SET family_id = $1 WHERE id = $2', [userRow.id, userRow.id]);
           userRow.family_id = userRow.id;
       }
    }
    const user = { 
        id: userRow.id, name: userRow.name, email: userRow.email, familyId: userRow.family_id,
        settings: userRow.settings || defaultSettings, role: userRow.role || 'USER',
        entityType: userRow.entity_type, plan: userRow.plan, status: userRow.status, trialEndsAt: userRow.trial_ends_at
    };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user });
  } catch (err) {
    res.status(400).json({ error: 'Google Auth Error: ' + err.message });
  }
});

// --- Data Routes (Soft Delete Enabled) ---

const getFamilyCondition = `user_id IN (SELECT id FROM users WHERE family_id = (SELECT family_id FROM users WHERE id = $1))`;
const familyCheckParam2 = `user_id IN (SELECT id FROM users WHERE family_id = (SELECT family_id FROM users WHERE id = $2))`;

app.get('/api/initial-data', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const accs = await pool.query(`SELECT * FROM accounts WHERE ${getFamilyCondition} AND deleted_at IS NULL`, [userId]);
        
        const trans = await pool.query(`
            SELECT transactions.*, uc.name as created_by_name, uu.name as updated_by_name 
            FROM transactions 
            LEFT JOIN users uc ON transactions.created_by = uc.id
            LEFT JOIN users uu ON transactions.updated_by = uu.id
            WHERE transactions.user_id IN (SELECT id FROM users WHERE family_id = (SELECT family_id FROM users WHERE id = $1)) 
            AND transactions.deleted_at IS NULL
            ORDER BY transactions.date DESC
        `, [userId]);
        
        const goals = await pool.query(`SELECT * FROM goals WHERE ${getFamilyCondition} AND deleted_at IS NULL`, [userId]);
        const contacts = await pool.query(`SELECT * FROM contacts WHERE ${getFamilyCondition} AND deleted_at IS NULL ORDER BY name ASC`, [userId]);
        let categories = await pool.query(`SELECT * FROM categories WHERE ${getFamilyCondition} AND deleted_at IS NULL ORDER BY name ASC`, [userId]);

        const companyRes = await pool.query(`SELECT * FROM company_profiles WHERE user_id = $1`, [userId]);
        const branchesRes = await pool.query(`SELECT * FROM branches WHERE ${getFamilyCondition} AND deleted_at IS NULL`, [userId]);
        const costCentersRes = await pool.query(`SELECT * FROM cost_centers WHERE ${getFamilyCondition} AND deleted_at IS NULL`, [userId]);
        const departmentsRes = await pool.query(`SELECT * FROM departments WHERE ${getFamilyCondition} AND deleted_at IS NULL`, [userId]);
        const projectsRes = await pool.query(`SELECT * FROM projects WHERE ${getFamilyCondition} AND deleted_at IS NULL`, [userId]);

        if (categories.rows.length === 0) {
            const defaults = [
                { name: 'Alimentação', type: 'EXPENSE' }, { name: 'Moradia', type: 'EXPENSE' },
                { name: 'Transporte', type: 'EXPENSE' }, { name: 'Saúde', type: 'EXPENSE' },
                { name: 'Lazer', type: 'EXPENSE' }, { name: 'Salário', type: 'INCOME' },
                { name: 'Investimentos', type: 'EXPENSE' }, { name: 'Educação', type: 'EXPENSE' }
            ];
            for (const c of defaults) {
                const newId = crypto.randomUUID();
                await pool.query('INSERT INTO categories (id, name, type, user_id) VALUES ($1, $2, $3, $4)', [newId, c.name, c.type, userId]);
            }
            categories = await pool.query(`SELECT * FROM categories WHERE ${getFamilyCondition} AND deleted_at IS NULL ORDER BY name ASC`, [userId]);
        }

        res.json({
            accounts: accs.rows.map(r => ({ 
                id: r.id, name: r.name, type: r.type, balance: parseFloat(r.balance),
                creditLimit: r.credit_limit ? parseFloat(r.credit_limit) : undefined,
                closingDay: r.closing_day, dueDay: r.due_day
            })),
            transactions: trans.rows.map(r => ({
                id: r.id, description: r.description, amount: parseFloat(r.amount), type: r.type, 
                category: r.category, date: new Date(r.date).toISOString().split('T')[0], status: r.status, 
                accountId: r.account_id, destinationAccountId: r.destination_account_id,
                isRecurring: r.is_recurring, recurrenceFrequency: r.recurrence_frequency, 
                recurrenceEndDate: r.recurrence_end_date ? new Date(r.recurrence_end_date).toISOString().split('T')[0] : undefined,
                interestRate: r.interest_rate ? parseFloat(r.interest_rate) : 0,
                contactId: r.contact_id, branchId: r.branch_id, costCenterId: r.cost_center_id,
                departmentId: r.department_id, projectId: r.project_id,
                classification: r.classification, destinationBranchId: r.destination_branch_id,
                createdByName: r.created_by_name, updatedByName: r.updated_by_name,
                createdAt: r.created_at, updatedAt: r.updated_at
            })),
            goals: goals.rows.map(r => ({ 
                id: r.id, name: r.name, targetAmount: parseFloat(r.target_amount), 
                currentAmount: parseFloat(r.current_amount), deadline: r.deadline ? new Date(r.deadline).toISOString().split('T')[0] : undefined 
            })),
            contacts: contacts.rows.map(r => ({ id: r.id, name: r.name })),
            categories: categories.rows.map(r => ({ id: r.id, name: r.name, type: r.type })),
            
            companyProfile: companyRes.rows[0] ? {
                id: companyRes.rows[0].id, tradeName: companyRes.rows[0].trade_name,
                legalName: companyRes.rows[0].legal_name, cnpj: companyRes.rows[0].cnpj
            } : null,
            branches: branchesRes.rows.map(r => ({ id: r.id, name: r.name, code: r.code })),
            costCenters: costCentersRes.rows.map(r => ({ id: r.id, name: r.name, code: r.code })),
            departments: departmentsRes.rows.map(r => ({ id: r.id, name: r.name })),
            projects: projectsRes.rows.map(r => ({ id: r.id, name: r.name }))
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/accounts', authenticateToken, async (req, res) => {
    const { id, name, type, balance, creditLimit, closingDay, dueDay } = req.body;
    const userId = req.user.id;
    try {
        const existingRes = await pool.query('SELECT * FROM accounts WHERE id = $1', [id]);
        const existing = existingRes.rows[0];
        const action = existing ? 'UPDATE' : 'CREATE';
        
        await pool.query(
            `INSERT INTO accounts (id, name, type, balance, user_id, credit_limit, closing_day, due_day) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
             ON CONFLICT (id) DO UPDATE SET name = $2, type = $3, balance = $4, credit_limit = $6, closing_day = $7, due_day = $8, deleted_at = NULL`,
            [id, name, type, balance, userId, creditLimit || null, closingDay || null, dueDay || null]
        );
        
        await logAudit(pool, userId, action, 'account', id, `Conta: ${name}`, existing);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/accounts/:id', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const acc = await pool.query(`SELECT * FROM accounts WHERE id = $1`, [req.params.id]);
        const previousState = acc.rows[0];
        const name = previousState?.name || 'Desconhecida';
        
        await pool.query(`UPDATE accounts SET deleted_at = NOW() WHERE id = $1 AND ${familyCheckParam2}`, [req.params.id, userId]);
        await logAudit(pool, userId, 'DELETE', 'account', req.params.id, `Conta: ${name}`, previousState);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/contacts', authenticateToken, async (req, res) => {
    const { id, name } = req.body;
    const userId = req.user.id;
    try {
        const existingRes = await pool.query('SELECT * FROM contacts WHERE id = $1', [id]);
        const existing = existingRes.rows[0];
        const action = existing ? 'UPDATE' : 'CREATE';

        await pool.query(`INSERT INTO contacts (id, name, user_id) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET name=$2, deleted_at = NULL`, [id, name, userId]);
        await logAudit(pool, userId, action, 'contact', id, `Contato: ${name}`, existing);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/contacts/:id', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const ct = await pool.query(`SELECT * FROM contacts WHERE id = $1`, [req.params.id]);
        const previousState = ct.rows[0];
        const name = previousState?.name || 'Desconhecido';

        await pool.query(`UPDATE contacts SET deleted_at = NOW() WHERE id = $1 AND ${familyCheckParam2}`, [req.params.id, userId]);
        await logAudit(pool, userId, 'DELETE', 'contact', req.params.id, `Contato: ${name}`, previousState);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/transactions', authenticateToken, async (req, res) => {
    const t = req.body;
    const userId = req.user.id;
    try {
        const existingRes = await pool.query('SELECT * FROM transactions WHERE id = $1', [t.id]);
        const existing = existingRes.rows[0];
        const action = existing ? 'UPDATE' : 'CREATE';

        await pool.query(
            `INSERT INTO transactions (
                id, description, amount, type, category, date, status, account_id, destination_account_id, 
                is_recurring, recurrence_frequency, recurrence_end_date, interest_rate, contact_id, 
                user_id, branch_id, cost_center_id, department_id, project_id, classification, destination_branch_id,
                created_by, updated_by, updated_at
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $22, NOW())
             ON CONFLICT (id) DO UPDATE SET 
                description=$2, amount=$3, type=$4, category=$5, date=$6, status=$7, account_id=$8, destination_account_id=$9, 
                is_recurring=$10, recurrence_frequency=$11, recurrence_end_date=$12, interest_rate=$13, contact_id=$14, 
                branch_id=$16, cost_center_id=$17, department_id=$18, project_id=$19, classification=$20, destination_branch_id=$21,
                updated_by=$22, updated_at=NOW(), deleted_at=NULL`,
            [
                t.id, t.description, t.amount, t.type, t.category, t.date, t.status, t.accountId, 
                sanitizeValue(t.destinationAccountId), t.isRecurring, t.recurrenceFrequency, 
                t.recurrenceEndDate, t.interestRate || 0, sanitizeValue(t.contactId), userId,
                sanitizeValue(t.branchId), sanitizeValue(t.costCenterId), sanitizeValue(t.departmentId), sanitizeValue(t.projectId),
                t.classification || 'STANDARD', sanitizeValue(t.destinationBranchId),
                userId
            ]
        );
        await logAudit(pool, userId, action, 'transaction', t.id, `${t.type}: ${t.description} (R$ ${t.amount})`, existing);
        res.json({ success: true });
    } catch (err) {
        console.error('Error inserting transaction:', err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/transactions/:id', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const tx = await pool.query(`SELECT * FROM transactions WHERE id = $1`, [req.params.id]);
        const previousState = tx.rows[0];
        const desc = previousState ? `${previousState.description} (R$ ${previousState.amount})` : 'Transação';

        await pool.query(`UPDATE transactions SET deleted_at = NOW() WHERE id = $1 AND ${familyCheckParam2}`, [req.params.id, userId]);
        await logAudit(pool, userId, 'DELETE', 'transaction', req.params.id, desc, previousState);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Logs & Restore Routes
app.get('/api/audit-logs', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const logs = await pool.query(`
            SELECT al.*, u.name as user_name,
            CASE 
                WHEN al.entity = 'transaction' THEN (SELECT deleted_at IS NOT NULL FROM transactions WHERE id = al.entity_id)
                WHEN al.entity = 'account' THEN (SELECT deleted_at IS NOT NULL FROM accounts WHERE id = al.entity_id)
                WHEN al.entity = 'contact' THEN (SELECT deleted_at IS NOT NULL FROM contacts WHERE id = al.entity_id)
                WHEN al.entity = 'category' THEN (SELECT deleted_at IS NOT NULL FROM categories WHERE id = al.entity_id)
                ELSE false
            END as is_deleted
            FROM audit_logs al
            JOIN users u ON al.user_id = u.id
            WHERE u.family_id = (SELECT family_id FROM users WHERE id = $1)
            ORDER BY al.timestamp DESC
            LIMIT 100
        `, [userId]);
        
        res.json(logs.rows.map(r => ({
            id: r.id,
            action: r.action,
            entity: r.entity,
            entityId: r.entity_id,
            details: r.details,
            timestamp: r.timestamp,
            userId: r.user_id,
            userName: r.user_name,
            isDeleted: r.is_deleted,
            previousState: r.previous_state
        })));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/restore', authenticateToken, async (req, res) => {
    const { entity, id } = req.body;
    const userId = req.user.id;
    
    const tableMap = {
        'transaction': 'transactions',
        'account': 'accounts',
        'contact': 'contacts',
        'category': 'categories',
        'branch': 'branches',
        'costCenter': 'cost_centers',
        'department': 'departments',
        'project': 'projects'
    };

    const tableName = tableMap[entity];
    if (!tableName) return res.status(400).json({ error: 'Entidade inválida' });

    try {
        // Fetch current (deleted) state for log
        const current = await pool.query(`SELECT * FROM ${tableName} WHERE id = $1`, [id]);
        const record = current.rows[0];

        // Restore
        await pool.query(`UPDATE ${tableName} SET deleted_at = NULL WHERE id = $1 AND ${familyCheckParam2}`, [id, userId]);
        
        // --- LOGIC: RESTORE BALANCE IF TRANSACTION ---
        if (entity === 'transaction' && record && record.status === 'PAID') {
            if (record.type === 'TRANSFER') {
                if (record.account_id) await updateAccountBalance(pool, record.account_id, -record.amount, 'INCOME'); // Remove from Source? No, wait. Transfer out = Expense behavior. Balance -= Amount. Restore -> Balance -= Amount.
                // Logic: Transfer Out was deducted. Restore means deduct again? No. Restore means "Bring back the transaction".
                // If I deleted a transfer, the balance was reversed (frontend logic).
                // If I restore it, I need to re-apply the transfer.
                
                // Original Logic:
                // Transfer: Source -= Amount, Dest += Amount.
                // Delete: Source += Amount, Dest -= Amount.
                // Restore: Source -= Amount, Dest += Amount.
                if (record.account_id) await updateAccountBalance(pool, record.account_id, record.amount, 'EXPENSE'); 
                if (record.destination_account_id) await updateAccountBalance(pool, record.destination_account_id, record.amount, 'INCOME');
            } else {
                // Income: +Amount. Expense: -Amount.
                await updateAccountBalance(pool, record.account_id, record.amount, record.type);
            }
        }

        await logAudit(pool, userId, 'RESTORE', entity, id, `Registro restaurado via Auditoria`, record);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Endpoint to Revert an UPDATE change
app.post('/api/revert-change', authenticateToken, async (req, res) => {
    const { logId } = req.body;
    const userId = req.user.id;

    try {
        const logRes = await pool.query('SELECT * FROM audit_logs WHERE id = $1', [logId]);
        const log = logRes.rows[0];
        if (!log || !log.previous_state) return res.status(400).json({ error: 'Log inválido ou sem estado anterior.' });

        const tableMap = {
            'transaction': 'transactions',
            'account': 'accounts',
            'contact': 'contacts',
            'category': 'categories',
            'branch': 'branches',
            'costCenter': 'cost_centers',
            'department': 'departments',
            'project': 'projects'
        };
        const tableName = tableMap[log.entity];
        if (!tableName) return res.status(400).json({ error: 'Entidade desconhecida.' });

        const currentRes = await pool.query(`SELECT * FROM ${tableName} WHERE id = $1`, [log.entity_id]);
        const currentState = currentRes.rows[0];

        // --- SECURITY: Filter allowed keys ---
        const previousState = log.previous_state;
        const protectedColumns = ['id', 'user_id', 'created_at', 'updated_at', 'created_by'];
        const keys = Object.keys(previousState).filter(k => !protectedColumns.includes(k));
        
        if (keys.length === 0) return res.status(400).json({ error: 'Estado anterior vazio ou protegido.' });

        const setClause = keys.map((key, idx) => `"${key}" = $${idx + 2}`).join(', ');
        const values = keys.map(key => previousState[key]);
        
        const query = `UPDATE ${tableName} SET ${setClause}, updated_at = NOW() WHERE id = $1`;
        
        await pool.query(query, [log.entity_id, ...values]);

        // --- LOGIC: REVERT BALANCE IF TRANSACTION ---
        if (log.entity === 'transaction' && currentState && previousState.status === 'PAID') {
            // Logic: Reverse the CURRENT state effect, Apply the PREVIOUS state effect.
            // Simplified: Calculate Delta.
            // Assumption: Account ID did not change (too complex if it did).
            
            if (currentState.account_id === previousState.account_id) {
                const oldAmount = parseFloat(previousState.amount);
                const newAmount = parseFloat(currentState.amount); // The one being reverted FROM
                
                // If Expense: Balance was decreased by NewAmount. Needs to be increased by NewAmount, decreased by OldAmount.
                // Net change: Balance += (NewAmount - OldAmount).
                
                // If Income: Balance was increased by NewAmount. Needs to be decreased by NewAmount, increased by OldAmount.
                // Net change: Balance -= (NewAmount - OldAmount).
                
                if (previousState.type === 'EXPENSE') {
                    const diff = newAmount - oldAmount;
                    await updateAccountBalance(pool, previousState.account_id, diff, 'INCOME'); // Treat recovery as income
                } else if (previousState.type === 'INCOME') {
                    const diff = newAmount - oldAmount;
                    await updateAccountBalance(pool, previousState.account_id, diff, 'EXPENSE'); // Treat loss as expense
                }
            }
        }

        await logAudit(pool, userId, 'REVERT', log.entity, log.entity_id, `Reversão de alteração (Log #${logId})`, currentState);

        res.json({ success: true });
    } catch (err) {
        console.error("Revert Error", err);
        res.status(500).json({ error: err.message });
    }
});

const createPjEndpoints = (pathName, tableName, entityName) => {
    app.post(`/api/${pathName}`, authenticateToken, async (req, res) => {
        const { id, name, code } = req.body;
        const userId = req.user.id;
        try {
            const existingRes = await pool.query(`SELECT * FROM ${tableName} WHERE id = $1`, [id]);
            const existing = existingRes.rows[0];
            const action = existing ? 'UPDATE' : 'CREATE';
            
            if (code !== undefined) {
                await pool.query(`INSERT INTO ${tableName} (id, name, code, user_id) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET name=$2, code=$3, deleted_at=NULL`, [id, name, code, userId]);
            } else {
                await pool.query(`INSERT INTO ${tableName} (id, name, user_id) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET name=$2, deleted_at=NULL`, [id, name, userId]);
            }
            await logAudit(pool, userId, action, entityName, id, `${name}`, existing);
            res.json({ success: true });
        } catch(err) { res.status(500).json({ error: err.message }); }
    });
    
    app.delete(`/api/${pathName}/:id`, authenticateToken, async (req, res) => {
        const userId = req.user.id;
        try {
            const row = await pool.query(`SELECT * FROM ${tableName} WHERE id = $1`, [req.params.id]);
            await pool.query(`UPDATE ${tableName} SET deleted_at = NOW() WHERE id=$1 AND user_id=$2`, [req.params.id, userId]);
            await logAudit(pool, userId, 'DELETE', entityName, req.params.id, 'Item corporativo', row.rows[0]);
            res.json({ success: true });
        } catch(err) { res.status(500).json({ error: err.message }); }
    });
};

createPjEndpoints('branches', 'branches', 'branch');
createPjEndpoints('cost-centers', 'cost_centers', 'costCenter');
createPjEndpoints('departments', 'departments', 'department');
createPjEndpoints('projects', 'projects', 'project');

app.post('/api/categories', authenticateToken, async (req, res) => {
    const { id, name, type } = req.body;
    const userId = req.user.id;
    try {
        const existingRes = await pool.query('SELECT * FROM categories WHERE id = $1', [id]);
        const existing = existingRes.rows[0];
        const action = existing ? 'UPDATE' : 'CREATE';
        
        await pool.query(
            `INSERT INTO categories (id, name, type, user_id) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET name=$2, type=$3, deleted_at=NULL`,
            [id, name, type || null, userId]
        );
        await logAudit(pool, userId, action, 'category', id, name, existing);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/categories/:id', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const cat = await pool.query(`SELECT * FROM categories WHERE id = $1`, [req.params.id]);
        await pool.query(`UPDATE categories SET deleted_at = NOW() WHERE id = $1 AND ${familyCheckParam2}`, [req.params.id, userId]);
        await logAudit(pool, userId, 'DELETE', 'category', req.params.id, cat.rows[0]?.name, cat.rows[0]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.path}` });
});

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
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
