
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
app.use(cors());
app.use(express.json());

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

pool.connect()
  .then(() => console.log('DB Connected'))
  .catch(err => console.error('DB Connection Error:', err));

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "272556908691-3gnld5rsjj6cv2hspp96jt2fb3okkbhv.apps.googleusercontent.com";
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- Helpers ---
const ensureFamilyId = async (userId) => {
    // Se o usuário não tem família, ele cria a própria (family_id = user_id)
    const res = await pool.query('SELECT family_id FROM users WHERE id = $1', [userId]);
    if (res.rows[0] && !res.rows[0].family_id) {
        await pool.query('UPDATE users SET family_id = $1 WHERE id = $1', [userId]);
        return userId;
    }
    return res.rows[0]?.family_id || userId;
};

// --- Auth Routes ---

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const id = crypto.randomUUID();
    const check = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (check.rows.length > 0) return res.status(400).json({ error: 'Email já cadastrado' });

    // Novo usuário cria sua própria família inicialmente
    await pool.query(
      'INSERT INTO users (id, name, email, password_hash, family_id) VALUES ($1, $2, $3, $4, $1)',
      [id, name, email, hashedPassword]
    );

    const user = { id, name, email, familyId: id };
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

    // Garante que existe family_id
    let familyId = userRow.family_id;
    if (!familyId) {
        familyId = userRow.id;
        await pool.query('UPDATE users SET family_id = $1 WHERE id = $2', [familyId, userRow.id]);
    }

    const user = { id: userRow.id, name: userRow.name, email: userRow.email, familyId };
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

    if (!userRow) {
       const id = crypto.randomUUID();
       // Novo usuário Google também cria sua família
       await pool.query('INSERT INTO users (id, name, email, google_id, family_id) VALUES ($1, $2, $3, $4, $1)', [id, name, email, googleId]);
       userRow = { id, name, email, family_id: id };
    } else {
       if (!userRow.google_id) await pool.query('UPDATE users SET google_id = $1 WHERE id = $2', [googleId, userRow.id]);
       if (!userRow.family_id) {
           await pool.query('UPDATE users SET family_id = $1 WHERE id = $2', [userRow.id, userRow.id]);
           userRow.family_id = userRow.id;
       }
    }

    const user = { id: userRow.id, name: userRow.name, email: userRow.email, familyId: userRow.family_id };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user });
  } catch (err) {
    res.status(400).json({ error: 'Google Auth Error: ' + err.message });
  }
});

// --- Collaboration Routes ---

app.post('/api/invite/create', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const familyId = await ensureFamilyId(userId);
        
        // Gera código de 6 caracteres
        const code = crypto.randomBytes(3).toString('hex').toUpperCase();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

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

        // Atualiza a família do usuário
        await pool.query('UPDATE users SET family_id = $1 WHERE id = $2', [invite.family_id, userId]);

        // Retorna novo token com familyId atualizado
        const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
        const userRow = userRes.rows[0];
        
        const user = { id: userRow.id, name: userRow.name, email: userRow.email, familyId: userRow.family_id };
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

// --- Data Routes (Filtrados por Família) ---

// Essa condição garante que eu veja dados de todos que tem o mesmo family_id que eu
const getFamilyCondition = `user_id IN (SELECT id FROM users WHERE family_id = (SELECT family_id FROM users WHERE id = $1))`;

app.get('/api/initial-data', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const accs = await pool.query(`SELECT * FROM accounts WHERE ${getFamilyCondition}`, [userId]);
        const trans = await pool.query(`SELECT * FROM transactions WHERE ${getFamilyCondition} ORDER BY date DESC`, [userId]);
        const goals = await pool.query(`SELECT * FROM goals WHERE ${getFamilyCondition}`, [userId]);

        res.json({
            accounts: accs.rows.map(r => ({ id: r.id, name: r.name, type: r.type, balance: parseFloat(r.balance) })),
            transactions: trans.rows.map(r => ({
                id: r.id, description: r.description, amount: parseFloat(r.amount), type: r.type, 
                category: r.category, date: new Date(r.date).toISOString().split('T')[0], status: r.status, 
                accountId: r.account_id, isRecurring: r.is_recurring, recurrenceFrequency: r.recurrence_frequency, 
                recurrenceEndDate: r.recurrence_end_date ? new Date(r.recurrence_end_date).toISOString().split('T')[0] : undefined
            })),
            goals: goals.rows.map(r => ({ 
                id: r.id, name: r.name, targetAmount: parseFloat(r.target_amount), 
                currentAmount: parseFloat(r.current_amount), deadline: r.deadline ? new Date(r.deadline).toISOString().split('T')[0] : undefined 
            }))
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/accounts', authenticateToken, async (req, res) => {
    const { id, name, type, balance } = req.body;
    const userId = req.user.id;
    try {
        await pool.query(
            `INSERT INTO accounts (id, name, type, balance, user_id) VALUES ($1, $2, $3, $4, $5) 
             ON CONFLICT (id) DO UPDATE SET name = $2, type = $3, balance = $4`,
            [id, name, type, balance, userId]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/accounts/:id', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        await pool.query(`DELETE FROM accounts WHERE id = $1 AND ${getFamilyCondition}`, [req.params.id, userId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/transactions', authenticateToken, async (req, res) => {
    const t = req.body;
    const userId = req.user.id;
    try {
        await pool.query(
            `INSERT INTO transactions (id, description, amount, type, category, date, status, account_id, is_recurring, recurrence_frequency, recurrence_end_date, user_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             ON CONFLICT (id) DO UPDATE SET 
                description=$2, amount=$3, type=$4, category=$5, date=$6, status=$7, account_id=$8, is_recurring=$9, recurrence_frequency=$10, recurrence_end_date=$11`,
            [t.id, t.description, t.amount, t.type, t.category, t.date, t.status, t.accountId, t.isRecurring, t.recurrenceFrequency, t.recurrenceEndDate, userId]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/transactions/:id', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        await pool.query(`DELETE FROM transactions WHERE id = $1 AND ${getFamilyCondition}`, [req.params.id, userId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Serve Frontend
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath, { index: false }));
app.get('*', (req, res) => {
    const indexPath = path.join(distPath, 'index.html');
    if (!fs.existsSync(indexPath)) return res.status(500).send('Run npm run build');
    fs.readFile(indexPath, 'utf8', (err, htmlData) => {
        if (err) return res.status(500).send('Error');
        const envScript = `<script>window.GOOGLE_CLIENT_ID = "${GOOGLE_CLIENT_ID}";</script>`;
        res.send(htmlData.replace('</head>', `${envScript}</head>`));
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server port ${PORT}`));
