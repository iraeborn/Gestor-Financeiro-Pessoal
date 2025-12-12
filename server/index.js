
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
  // Cloud Run Connection (Unix Socket)
  console.log('Connecting via Cloud SQL Socket:', process.env.INSTANCE_CONNECTION_NAME);
  poolConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    host: `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`,
  };
} else {
  // Local Connection (TCP)
  console.log('Connecting via TCP (Local)');
  const connectionString = process.env.DATABASE_URL || 'postgres://admin:password123@localhost:5432/financer';
  poolConfig = {
    connectionString: connectionString,
  };
}

const pool = new Pool(poolConfig);

pool.connect()
  .then(async (client) => {
    console.log('DB Connected Successfully');
    // Migrations Automáticas
    try {
        // Core Tables
        await client.query(`CREATE TABLE IF NOT EXISTS contacts (id TEXT PRIMARY KEY, name TEXT NOT NULL, user_id TEXT REFERENCES users(id), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);
        await client.query(`CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT, user_id TEXT REFERENCES users(id), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);
        
        // PJ Tables
        await client.query(`CREATE TABLE IF NOT EXISTS company_profiles (id TEXT PRIMARY KEY, trade_name TEXT, legal_name TEXT, cnpj TEXT, user_id TEXT REFERENCES users(id) UNIQUE);`);
        await client.query(`CREATE TABLE IF NOT EXISTS branches (id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT, user_id TEXT REFERENCES users(id));`);
        await client.query(`CREATE TABLE IF NOT EXISTS cost_centers (id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT, user_id TEXT REFERENCES users(id));`);
        await client.query(`CREATE TABLE IF NOT EXISTS departments (id TEXT PRIMARY KEY, name TEXT NOT NULL, user_id TEXT REFERENCES users(id));`);
        await client.query(`CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, user_id TEXT REFERENCES users(id));`);

        // Updates to Users Table for SaaS
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'USER';`);
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS entity_type TEXT DEFAULT 'PF';`);
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'TRIAL';`);
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'TRIALING';`);
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP;`);
        
        // Updates to Transactions
        await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS destination_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL;`);
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{"includeCreditCardsInTotal": true}';`);
        await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS interest_rate DECIMAL(10,2) DEFAULT 0;`);
        await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL;`);
        
        // PJ Fields in Transactions
        await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL;`);
        await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS cost_center_id TEXT REFERENCES cost_centers(id) ON DELETE SET NULL;`);
        await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS department_id TEXT REFERENCES departments(id) ON DELETE SET NULL;`);
        await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS project_id TEXT REFERENCES projects(id) ON DELETE SET NULL;`);
        
        // New Fields for Advance/Cash Replenishment
        await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS classification TEXT DEFAULT 'STANDARD';`);
        await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS destination_branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL;`);

        // Updates to Accounts
        await client.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(15,2);`);
        await client.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS closing_day INTEGER;`);
        await client.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS due_day INTEGER;`);
        
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

const requireAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'ADMIN') {
        next();
    } else {
        res.status(403).json({ error: 'Acesso negado: Requer privilégios de Administrador' });
    }
};

// --- Helpers ---
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
    
    // Check existing
    const check = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (check.rows.length > 0) return res.status(400).json({ error: 'Email já cadastrado' });
    
    // Trial Logic (15 dias)
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 15);
    
    const defaultSettings = { includeCreditCardsInTotal: true };
    const role = 'USER'; // Default is USER. Admin must be set manually in DB for now.
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
    
    // Ensure family ID
    let familyId = userRow.family_id;
    if (!familyId) {
        familyId = userRow.id;
        await pool.query('UPDATE users SET family_id = $1 WHERE id = $2', [familyId, userRow.id]);
    }

    const user = { 
        id: userRow.id, 
        name: userRow.name, 
        email: userRow.email, 
        familyId,
        settings: userRow.settings || { includeCreditCardsInTotal: true },
        role: userRow.role || 'USER',
        entityType: userRow.entity_type,
        plan: userRow.plan,
        status: userRow.status,
        trialEndsAt: userRow.trial_ends_at,
        createdAt: userRow.created_at
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
       // Default Google Registration assumes PF
       await pool.query(
        `INSERT INTO users (id, name, email, google_id, family_id, settings, role, entity_type, plan, status, trial_ends_at) 
         VALUES ($1, $2, $3, $4, $1, $5, 'USER', 'PF', 'TRIAL', 'TRIALING', $6)`, 
        [id, name, email, googleId, defaultSettings, trialEndsAt]
       );
       userRow = { 
           id, name, email, family_id: id, settings: defaultSettings,
           role: 'USER', entity_type: 'PF', plan: 'TRIAL', status: 'TRIALING', trial_ends_at: trialEndsAt
        };
    } else {
       if (!userRow.google_id) await pool.query('UPDATE users SET google_id = $1 WHERE id = $2', [googleId, userRow.id]);
       if (!userRow.family_id) {
           await pool.query('UPDATE users SET family_id = $1 WHERE id = $2', [userRow.id, userRow.id]);
           userRow.family_id = userRow.id;
       }
    }
    const user = { 
        id: userRow.id, 
        name: userRow.name, 
        email: userRow.email, 
        familyId: userRow.family_id,
        settings: userRow.settings || defaultSettings,
        role: userRow.role || 'USER',
        entityType: userRow.entity_type,
        plan: userRow.plan,
        status: userRow.status,
        trialEndsAt: userRow.trial_ends_at
    };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user });
  } catch (err) {
    res.status(400).json({ error: 'Google Auth Error: ' + err.message });
  }
});

// --- Admin Routes ---
app.get('/api/admin/stats', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const usersCount = await pool.query('SELECT COUNT(*) FROM users');
        const activeUsers = await pool.query("SELECT COUNT(*) FROM users WHERE status = 'ACTIVE'");
        const trialUsers = await pool.query("SELECT COUNT(*) FROM users WHERE status = 'TRIALING'");
        const pfUsers = await pool.query("SELECT COUNT(*) FROM users WHERE entity_type = 'PF'");
        const pjUsers = await pool.query("SELECT COUNT(*) FROM users WHERE entity_type = 'PJ'");
        
        // Mock Revenue Calculation based on plans
        const yearlyPlans = await pool.query("SELECT COUNT(*) FROM users WHERE plan = 'YEARLY'");
        const monthlyPlans = await pool.query("SELECT COUNT(*) FROM users WHERE plan = 'MONTHLY'");
        
        // Assuming R$29/mo and R$290/yr
        const revenue = (parseInt(monthlyPlans.rows[0].count) * 29) + (parseInt(yearlyPlans.rows[0].count) * 290);

        res.json({
            totalUsers: parseInt(usersCount.rows[0].count),
            active: parseInt(activeUsers.rows[0].count),
            trial: parseInt(trialUsers.rows[0].count),
            pf: parseInt(pfUsers.rows[0].count),
            pj: parseInt(pjUsers.rows[0].count),
            revenue: revenue
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const users = await pool.query('SELECT id, name, email, role, entity_type, plan, status, created_at FROM users ORDER BY created_at DESC LIMIT 50');
        res.json(users.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Standard App Routes (Same as before) ---
// ... keeping existing app logic ...

app.post('/api/settings', authenticateToken, async (req, res) => {
    const { settings } = req.body;
    const userId = req.user.id;
    try {
        await pool.query('UPDATE users SET settings = $1 WHERE id = $2', [settings, userId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/invite/create', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const familyId = await ensureFamilyId(userId);
        const code = crypto.randomBytes(3).toString('hex').toUpperCase();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); 
        await pool.query('INSERT INTO invites (code, family_id, created_by, expires_at) VALUES ($1, $2, $3, $4)', 
            [code, familyId, userId, expiresAt]);
        res.json({ code, expiresAt });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/invite/join', authenticateToken, async (req, res) => {
    const { code } = req.body;
    const userId = req.user.id;
    try {
        const inviteRes = await pool.query('SELECT * FROM invites WHERE code = $1', [code]);
        const invite = inviteRes.rows[0];
        if (!invite) return res.status(404).json({ error: 'Código inválido' });
        if (new Date() > new Date(invite.expires_at)) return res.status(400).json({ error: 'Código expirado' });
        await pool.query('UPDATE users SET family_id = $1 WHERE id = $2', [invite.family_id, userId]);
        
        // Re-fetch user to update token
        const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
        const userRow = userRes.rows[0];
        const user = { 
            id: userRow.id, 
            name: userRow.name, 
            email: userRow.email, 
            familyId: userRow.family_id,
            settings: userRow.settings,
            role: userRow.role,
            entityType: userRow.entity_type,
            plan: userRow.plan,
            status: userRow.status
        };
        const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, user, token });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/family/members', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const familyId = await ensureFamilyId(userId);
        const members = await pool.query('SELECT id, name, email FROM users WHERE family_id = $1', [familyId]);
        res.json(members.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Helper for Family Query
const getFamilyCondition = `user_id IN (SELECT id FROM users WHERE family_id = (SELECT family_id FROM users WHERE id = $1))`;

app.get('/api/initial-data', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const accs = await pool.query(`SELECT * FROM accounts WHERE ${getFamilyCondition}`, [userId]);
        const trans = await pool.query(`SELECT * FROM transactions WHERE ${getFamilyCondition} ORDER BY date DESC`, [userId]);
        const goals = await pool.query(`SELECT * FROM goals WHERE ${getFamilyCondition}`, [userId]);
        const contacts = await pool.query(`SELECT * FROM contacts WHERE ${getFamilyCondition} ORDER BY name ASC`, [userId]);
        let categories = await pool.query(`SELECT * FROM categories WHERE ${getFamilyCondition} ORDER BY name ASC`, [userId]);

        // PJ Data Fetch
        const companyRes = await pool.query(`SELECT * FROM company_profiles WHERE user_id = $1`, [userId]);
        const branchesRes = await pool.query(`SELECT * FROM branches WHERE ${getFamilyCondition}`, [userId]);
        const costCentersRes = await pool.query(`SELECT * FROM cost_centers WHERE ${getFamilyCondition}`, [userId]);
        const departmentsRes = await pool.query(`SELECT * FROM departments WHERE ${getFamilyCondition}`, [userId]);
        const projectsRes = await pool.query(`SELECT * FROM projects WHERE ${getFamilyCondition}`, [userId]);

        if (categories.rows.length === 0) {
            const defaults = [
                { name: 'Alimentação', type: 'EXPENSE' },
                { name: 'Moradia', type: 'EXPENSE' },
                { name: 'Transporte', type: 'EXPENSE' },
                { name: 'Saúde', type: 'EXPENSE' },
                { name: 'Lazer', type: 'EXPENSE' },
                { name: 'Salário', type: 'INCOME' },
                { name: 'Investimentos', type: 'EXPENSE' },
                { name: 'Educação', type: 'EXPENSE' }
            ];
            for (const c of defaults) {
                const newId = crypto.randomUUID();
                await pool.query(
                    'INSERT INTO categories (id, name, type, user_id) VALUES ($1, $2, $3, $4)', 
                    [newId, c.name, c.type, userId]
                );
            }
            categories = await pool.query(`SELECT * FROM categories WHERE ${getFamilyCondition} ORDER BY name ASC`, [userId]);
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
                contactId: r.contact_id,
                branchId: r.branch_id,
                costCenterId: r.cost_center_id,
                departmentId: r.department_id,
                projectId: r.project_id,
                classification: r.classification,
                destinationBranchId: r.destination_branch_id
            })),
            goals: goals.rows.map(r => ({ 
                id: r.id, name: r.name, targetAmount: parseFloat(r.target_amount), 
                currentAmount: parseFloat(r.current_amount), deadline: r.deadline ? new Date(r.deadline).toISOString().split('T')[0] : undefined 
            })),
            contacts: contacts.rows.map(r => ({ id: r.id, name: r.name })),
            categories: categories.rows.map(r => ({ id: r.id, name: r.name, type: r.type })),
            
            // PJ Data
            companyProfile: companyRes.rows[0] ? {
                id: companyRes.rows[0].id,
                tradeName: companyRes.rows[0].trade_name,
                legalName: companyRes.rows[0].legal_name,
                cnpj: companyRes.rows[0].cnpj
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
        await pool.query(
            `INSERT INTO accounts (id, name, type, balance, user_id, credit_limit, closing_day, due_day) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
             ON CONFLICT (id) DO UPDATE SET name = $2, type = $3, balance = $4, credit_limit = $6, closing_day = $7, due_day = $8`,
            [id, name, type, balance, userId, creditLimit || null, closingDay || null, dueDay || null]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/accounts/:id', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        await pool.query(
            `DELETE FROM accounts WHERE id = $1 AND user_id IN (SELECT id FROM users WHERE family_id = (SELECT family_id FROM users WHERE id = $2))`, 
            [req.params.id, userId]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/contacts', authenticateToken, async (req, res) => {
    const { id, name } = req.body;
    const userId = req.user.id;
    try {
        await pool.query(
            `INSERT INTO contacts (id, name, user_id) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET name=$2`,
            [id, name, userId]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/contacts/:id', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        await pool.query(
            `DELETE FROM contacts WHERE id = $1 AND user_id IN (SELECT id FROM users WHERE family_id = (SELECT family_id FROM users WHERE id = $2))`,
            [req.params.id, userId]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/categories', authenticateToken, async (req, res) => {
    const { id, name, type } = req.body;
    const userId = req.user.id;
    try {
        await pool.query(
            `INSERT INTO categories (id, name, type, user_id) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET name=$2, type=$3`,
            [id, name, type || null, userId]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/categories/:id', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        await pool.query(
            `DELETE FROM categories WHERE id = $1 AND user_id IN (SELECT id FROM users WHERE family_id = (SELECT family_id FROM users WHERE id = $2))`,
            [req.params.id, userId]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- PJ Routes ---

// Company Profile
app.post('/api/company', authenticateToken, async (req, res) => {
    const { id, tradeName, legalName, cnpj } = req.body;
    const userId = req.user.id;
    try {
        await pool.query(
            `INSERT INTO company_profiles (id, trade_name, legal_name, cnpj, user_id) VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (id) DO UPDATE SET trade_name=$2, legal_name=$3, cnpj=$4`,
            [id, tradeName, legalName, cnpj, userId]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Branches
app.post('/api/branches', authenticateToken, async (req, res) => {
    const { id, name, code } = req.body;
    const userId = req.user.id;
    try {
        await pool.query(
            `INSERT INTO branches (id, name, code, user_id) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET name=$2, code=$3`,
            [id, name, code, userId]
        );
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/branches/:id', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        await pool.query(`DELETE FROM branches WHERE id=$1 AND user_id=$2`, [req.params.id, userId]);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// Cost Centers
app.post('/api/cost-centers', authenticateToken, async (req, res) => {
    const { id, name, code } = req.body;
    const userId = req.user.id;
    try {
        await pool.query(
            `INSERT INTO cost_centers (id, name, code, user_id) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET name=$2, code=$3`,
            [id, name, code, userId]
        );
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/cost-centers/:id', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        await pool.query(`DELETE FROM cost_centers WHERE id=$1 AND user_id=$2`, [req.params.id, userId]);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// Departments
app.post('/api/departments', authenticateToken, async (req, res) => {
    const { id, name } = req.body;
    const userId = req.user.id;
    try {
        await pool.query(
            `INSERT INTO departments (id, name, user_id) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET name=$2`,
            [id, name, userId]
        );
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/departments/:id', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        await pool.query(`DELETE FROM departments WHERE id=$1 AND user_id=$2`, [req.params.id, userId]);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// Projects
app.post('/api/projects', authenticateToken, async (req, res) => {
    const { id, name } = req.body;
    const userId = req.user.id;
    try {
        await pool.query(
            `INSERT INTO projects (id, name, user_id) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET name=$2`,
            [id, name, userId]
        );
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/projects/:id', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        await pool.query(`DELETE FROM projects WHERE id=$1 AND user_id=$2`, [req.params.id, userId]);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/transactions', authenticateToken, async (req, res) => {
    const t = req.body;
    const userId = req.user.id;
    try {
        await pool.query(
            `INSERT INTO transactions (
                id, description, amount, type, category, date, status, account_id, destination_account_id, 
                is_recurring, recurrence_frequency, recurrence_end_date, interest_rate, contact_id, 
                user_id, branch_id, cost_center_id, department_id, project_id, classification, destination_branch_id
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
             ON CONFLICT (id) DO UPDATE SET 
                description=$2, amount=$3, type=$4, category=$5, date=$6, status=$7, account_id=$8, destination_account_id=$9, 
                is_recurring=$10, recurrence_frequency=$11, recurrence_end_date=$12, interest_rate=$13, contact_id=$14, 
                branch_id=$16, cost_center_id=$17, department_id=$18, project_id=$19, classification=$20, destination_branch_id=$21`,
            [
                t.id, t.description, t.amount, t.type, t.category, t.date, t.status, t.accountId, 
                sanitizeValue(t.destinationAccountId), t.isRecurring, t.recurrenceFrequency, 
                t.recurrenceEndDate, t.interestRate || 0, sanitizeValue(t.contactId), userId,
                sanitizeValue(t.branchId), sanitizeValue(t.costCenterId), sanitizeValue(t.departmentId), sanitizeValue(t.projectId),
                t.classification || 'STANDARD', sanitizeValue(t.destinationBranchId)
            ]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Error inserting transaction:', err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/transactions/:id', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        await pool.query(
            `DELETE FROM transactions WHERE id = $1 AND user_id IN (SELECT id FROM users WHERE family_id = (SELECT family_id FROM users WHERE id = $2))`,
            [req.params.id, userId]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
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
