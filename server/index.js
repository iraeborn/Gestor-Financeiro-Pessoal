
require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// --- Database Configuration ---
let poolConfig;

// Verifica se estamos no ambiente Google Cloud Run com Cloud SQL
if (process.env.INSTANCE_CONNECTION_NAME) {
  console.log("Configurando conexão via Cloud SQL Socket...");
  poolConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    host: `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`, // Caminho do Socket Unix
    // Não precisa de porta para socket unix
  };
} else {
  // Ambiente Local ou Conexão TCP padrão
  console.log("Configurando conexão via TCP/URL Padrão...");
  const connectionString = process.env.DATABASE_URL || 'postgres://admin:password123@localhost:5432/financer';
  poolConfig = {
    connectionString: connectionString,
  };
}

const pool = new Pool(poolConfig);

// Testar conexão ao iniciar
pool.connect()
  .then(() => console.log('Conectado ao Banco de Dados com sucesso!'))
  .catch(err => console.error('Erro ao conectar ao Banco de Dados:', err));

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

if (!GOOGLE_CLIENT_ID) {
  console.warn("AVISO: GOOGLE_CLIENT_ID não está definido. O login com Google não funcionará.");
}

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// --- Middleware ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- Mappers ---
const mapAccount = (row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    balance: parseFloat(row.balance)
});

const mapTransaction = (row) => ({
    id: row.id,
    description: row.description,
    amount: parseFloat(row.amount),
    type: row.type,
    category: row.category,
    date: row.date.toISOString().split('T')[0],
    status: row.status,
    accountId: row.account_id,
    isRecurring: row.is_recurring,
    recurrenceFrequency: row.recurrence_frequency,
    recurrenceEndDate: row.recurrence_end_date ? row.recurrence_end_date.toISOString().split('T')[0] : undefined
});

const mapGoal = (row) => ({
    id: row.id,
    name: row.name,
    targetAmount: parseFloat(row.target_amount),
    currentAmount: parseFloat(row.current_amount),
    deadline: row.deadline ? row.deadline.toISOString().split('T')[0] : undefined
});

// --- Auth Routes ---

// 1. Registro Email/Senha
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const id = crypto.randomUUID();
    
    // Check if exists
    const check = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (check.rows.length > 0) return res.status(400).json({ error: 'Email já cadastrado' });

    await pool.query(
      'INSERT INTO users (id, name, email, password_hash) VALUES ($1, $2, $3, $4)',
      [id, name, email, hashedPassword]
    );

    const user = { id, name, email };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Login Email/Senha
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const userRow = result.rows[0];

    if (!userRow || !userRow.password_hash) {
      return res.status(400).json({ error: 'Usuário não encontrado ou login inválido' });
    }

    const valid = await bcrypt.compare(password, userRow.password_hash);
    if (!valid) return res.status(400).json({ error: 'Senha incorreta' });

    const user = { id: userRow.id, name: userRow.name, email: userRow.email };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 3. Login com Google
app.post('/api/auth/google', async (req, res) => {
  const { credential } = req.body; // O token JWT retornado pelo Google
  try {
    if (!GOOGLE_CLIENT_ID) {
        throw new Error("GOOGLE_CLIENT_ID não configurado no servidor");
    }

    // Verifica o token com o Google
    const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID, 
    });
    const payload = ticket.getPayload();
    
    const googleId = payload.sub;
    const email = payload.email;
    const name = payload.name;

    // Procura ou cria usuário
    let result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    let userRow = result.rows[0];

    if (!userRow) {
       // Create new user linked to Google
       const id = crypto.randomUUID();
       await pool.query(
         'INSERT INTO users (id, name, email, google_id) VALUES ($1, $2, $3, $4)',
         [id, name, email, googleId]
       );
       userRow = { id, name, email };
    } else {
       // Update Google ID if not present
       if (!userRow.google_id) {
         await pool.query('UPDATE users SET google_id = $1 WHERE id = $2', [googleId, userRow.id]);
       }
    }

    const user = { id: userRow.id, name: userRow.name, email: userRow.email };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, user });

  } catch (err) {
    console.error("Google Auth Error:", err);
    res.status(400).json({ error: 'Falha na autenticação com Google: ' + err.message });
  }
});


// --- Protected Data Routes ---

app.get('/api/initial-data', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const accs = await pool.query('SELECT * FROM accounts WHERE user_id = $1', [userId]);
        const trans = await pool.query('SELECT * FROM transactions WHERE user_id = $1 ORDER BY date DESC', [userId]);
        const goals = await pool.query('SELECT * FROM goals WHERE user_id = $1', [userId]);

        res.json({
            accounts: accs.rows.map(mapAccount),
            transactions: trans.rows.map(mapTransaction),
            goals: goals.rows.map(mapGoal)
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
            `INSERT INTO accounts (id, name, type, balance, user_id) 
             VALUES ($1, $2, $3, $4, $5) 
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
        await pool.query('DELETE FROM accounts WHERE id = $1 AND user_id = $2', [req.params.id, userId]);
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
        await pool.query('DELETE FROM transactions WHERE id = $1 AND user_id = $2', [req.params.id, userId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Static Files & Frontend Serving (SPA Support) ---

// Serve static assets from the dist folder (built React app)
const distPath = path.join(__dirname, '../dist');

// IMPORTANT: { index: false } ensures that requests to '/' do not automatically serve index.html
// This allows the route below (app.get('*')) to handle it and inject the environment variables.
app.use(express.static(distPath, { index: false }));

// Catch-all route to serve index.html for any unknown paths (React Router support)
// AND inject environment variables
app.get('*', (req, res) => {
    const indexPath = path.join(distPath, 'index.html');
    
    // If index.html doesn't exist (e.g. forgot to build), error out
    if (!fs.existsSync(indexPath)) {
        return res.status(500).send('Frontend build not found. Run npm run build.');
    }

    // Read index.html
    fs.readFile(indexPath, 'utf8', (err, htmlData) => {
        if (err) {
            console.error('Error reading index.html', err);
            return res.status(500).send('Error loading frontend.');
        }

        // Inject GOOGLE_CLIENT_ID into window object
        const envScript = `
          <script>
            window.GOOGLE_CLIENT_ID = "${GOOGLE_CLIENT_ID || ''}";
          </script>
        `;
        
        // Inject right before </head>
        const finalHtml = htmlData.replace('</head>', `${envScript}</head>`);
        
        res.send(finalHtml);
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
