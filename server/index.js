
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
const logAudit = async (client, userId, action, entity, entityId, details, previousState = null, changes = null) => {
    await client.query(
        `INSERT INTO audit_logs (user_id, action, entity, entity_id, details, previous_state, changes) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, action, entity, entityId, details, previousState, changes]
    );
};

// Helper para calcular Diff entre objeto antigo (DB SnakeCase) e novo (Req Body CamelCase)
const calculateChanges = (oldObj, newObj, keyMap) => {
    if (!oldObj) return null;
    const changes = {};
    let hasChanges = false;

    for (const [bodyKey, dbKey] of Object.entries(keyMap)) {
        if (newObj[bodyKey] !== undefined) {
            // Normalização básica para comparação (datas e números)
            let valOld = oldObj[dbKey];
            let valNew = newObj[bodyKey];

            // Tratar datas (DB vem como Date obj, Body vem como string YYYY-MM-DD)
            if (valOld instanceof Date) valOld = valOld.toISOString().split('T')[0];
            
            // Tratar números (DB vem como string ou number dependendo do driver, Body vem como string ou number)
            if (typeof valOld === 'number' || !isNaN(Number(valOld))) valOld = String(valOld);
            if (typeof valNew === 'number' || !isNaN(Number(valNew))) valNew = String(valNew);
            
            // Ignorar null vs undefined se for vazio
            if (!valOld && !valNew) continue;

            if (valOld != valNew) {
                // Salva o nome amigável (chave do frontend)
                changes[bodyKey] = { old: valOld, new: valNew };
                hasChanges = true;
            }
        }
    }
    return hasChanges ? changes : null;
};

// Helper para Atualizar Saldo da Conta (Backend Side)
const updateAccountBalance = async (client, accountId, amount, type, isReversal = false) => {
    if (!accountId) return;
    let multiplier = 1;
    if (type === 'EXPENSE') multiplier = -1;
    if (isReversal) multiplier *= -1; // Inverte o sinal
    const finalChange = amount * multiplier;
    await client.query(
        `UPDATE accounts SET balance = balance + $1 WHERE id = $2`,
        [finalChange, accountId]
    );
};

// Helper para sanitizar valores opcionais (strings vazias viram null)
const sanitizeValue = (val) => {
    if (val === undefined || val === null) return null;
    if (typeof val === 'string' && val.trim() === '') return null;
    return val;
};

// --- NFC-e Parsers Logic ---

// Helper to extract numeric key from URL parameter 'p' or query
const extractAccessKey = (urlStr) => {
    try {
        const url = new URL(urlStr);
        // Tenta pegar o parâmetro 'p' (comum em SP, RS, etc)
        let p = url.searchParams.get('p');
        // Se 'p' contiver pipes (formato novo QR Code 2.0), pega a primeira parte
        if (p && p.includes('|')) {
            p = p.split('|')[0];
        }
        
        // Se não achou 'p', tenta ver se a chave está na path (alguns estados)
        if (!p) {
            // Lógica de fallback: procurar sequência de 44 dígitos na string completa
            const match = urlStr.match(/\d{44}/);
            if (match) return match[0];
        }
        
        // Limpa caracteres não numéricos se existirem (ex: espaços)
        return p ? p.replace(/\D/g, '') : null;
    } catch (e) {
        // Fallback para string pura
        const match = urlStr.match(/p=(\d{44})/);
        if (match) return match[1];
        const matchPipe = urlStr.match(/p=(\d{44})\|/);
        if (matchPipe) return matchPipe[1];
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

// Função unificada de parsing robusto
const robustParser = (html) => {
    // 1. Valor Total
    // Regex ajustado para permitir espaços (\s*) entre o fechamento da tag > e o número.
    // Também permite tags aninhadas opcionais (?:<[^>]+>)* antes do número.
    let amount = null;
    const amountPatterns = [
        // Prioridade SP: class "totalNumb" ou "txtMax"
        // Ex: <span class="totalNumb txtMax">\n 24,14</span>
        /class=["'][^"']*(?:totalNumb|txtMax)[^"']*["'][^>]*>\s*(?:<[^>]+>)*\s*(?:R\$\s*)?([\d\.,]+)/i, 
        
        // ID comum
        /id=["']lblValorTotal["'][^>]*>\s*(?:<[^>]+>)*\s*(?:R\$\s*)?([\d\.,]+)/i,
        
        // Texto "Valor a Pagar" seguido de número
        /Valor\s*a\s*Pagar[\s\S]*?(?:R\$\s*)?([\d\.,]+)/i,
        
        // Fallback simples span totalNumb
        /<span[^>]*class="totalNumb"[^>]*>\s*([\d\.,]+)/i
    ];
    for (const p of amountPatterns) {
        const m = html.match(p);
        if (m) { amount = m[1]; break; }
    }

    // 2. Estabelecimento (Favorecido)
    // Regex ajustado para txtTopo com suporte a quebras de linha
    let merchant = null;
    const merchantPatterns = [
        /class=["'][^"']*txtTopo[^"']*["'][^>]*>\s*(?:<[^>]+>)*\s*([^<]+)/i, // Prioridade do usuário
        /id=["']lblNomeEmitente["'][^>]*>\s*([^<]+)/i,
        /Razão\s*Social[:\s]*<\/label>\s*<span>([^<]+)/i,
        /<div[^>]*class="txtTopo"[^>]*>\s*([^<]+)<\/div>/i,
        /<h4[^>]*>\s*([^<]+)<\/h4>/i 
    ];
    for (const p of merchantPatterns) {
        const m = html.match(p);
        if (m) { 
            merchant = m[1].replace(/<[^>]+>/g, '').trim(); 
            break; 
        }
    }

    // 3. Data
    // Prioridade para a estrutura <strong> Emissão: </strong> ...
    let date = null;
    const datePatterns = [
        /<strong>\s*Emiss[ãa]o:\s*<\/strong>\s*(\d{2}\/\d{2}\/\d{4})/i, // Prioridade do usuário
        /(\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}:\d{2}/,
        /Data\s*de\s*Emissão.*?(\d{2}\/\d{2}\/\d{4})/i
    ];
    for (const p of datePatterns) {
        const m = html.match(p);
        if (m) { date = m[1]; break; }
    }

    return {
        amount,
        merchant,
        date,
        paymentType: detectPaymentMethod(html)
    };
};

const parsers = {
    // São Paulo (35) - Usa robustParser agora
    '35': robustParser,
    
    // Paraná (41) - Mantemos específico com fallback
    '41': (html) => {
        const p = robustParser(html);
        if (p.amount) return p;
        
        // Fallback antigo específico do PR
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
    
    // Genérico
    'default': robustParser
};

pool.connect()
  .then(async (client) => {
    console.log('DB Connected Successfully');
    // Migrations Automáticas
    try {
        // Base Tables
        await client.query(`CREATE TABLE IF NOT EXISTS contacts (id TEXT PRIMARY KEY, name TEXT NOT NULL, user_id TEXT REFERENCES users(id), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);
        // Contacts Columns Extension (Centralized Info)
        await client.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS email TEXT;`);
        await client.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS phone TEXT;`);
        await client.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS document TEXT;`); // CPF/CNPJ
        await client.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS pix_key TEXT;`);

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
        // NEW: Goal Link
        await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL;`);
        
        // Audit Columns
        await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS created_by TEXT REFERENCES users(id) ON DELETE SET NULL;`);
        await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS updated_by TEXT REFERENCES users(id) ON DELETE SET NULL;`);
        await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;`);

        // Accounts Columns
        await client.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(15,2);`);
        await client.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS closing_day INTEGER;`);
        await client.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS due_day INTEGER;`);

        // Audit Logs Table
        await client.query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id SERIAL PRIMARY KEY,
                user_id TEXT REFERENCES users(id),
                action TEXT NOT NULL, 
                entity TEXT NOT NULL, 
                entity_id TEXT NOT NULL,
                details TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                previous_state JSONB
            );
        `);
        // Add changes column for diffs
        await client.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS changes JSONB;`);

        // --- MEMBERSHIPS ---
        await client.query(`
            CREATE TABLE IF NOT EXISTS memberships (
                id SERIAL PRIMARY KEY,
                user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
                family_id TEXT NOT NULL, -- The workspace ID (usually the owner's user_id)
                role TEXT DEFAULT 'MEMBER',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, family_id)
            );
        `);
        // Add permissions column for RBAC
        await client.query(`ALTER TABLE memberships ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]';`);

        // MIGRATION: Ensure all existing users have a membership to their own family_id
        await client.query(`
            INSERT INTO memberships (user_id, family_id, role)
            SELECT id, family_id, 'ADMIN' FROM users 
            WHERE family_id IS NOT NULL
            ON CONFLICT (user_id, family_id) DO NOTHING;
        `);

        // --- GENERIC MODULE TABLES ---
        await client.query(`
            CREATE TABLE IF NOT EXISTS module_clients (
                id TEXT PRIMARY KEY,
                contact_id TEXT REFERENCES contacts(id) ON DELETE CASCADE,
                notes TEXT, -- Anamnese/Prontuário/Detalhes
                birth_date DATE,
                module_tag TEXT NOT NULL DEFAULT 'GENERAL', -- ODONTO, PHYSIO, ETC
                user_id TEXT REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        // Clinical Columns
        await client.query(`ALTER TABLE module_clients ADD COLUMN IF NOT EXISTS insurance TEXT;`);
        await client.query(`ALTER TABLE module_clients ADD COLUMN IF NOT EXISTS allergies TEXT;`);
        await client.query(`ALTER TABLE module_clients ADD COLUMN IF NOT EXISTS medications TEXT;`);

        await client.query(`
            CREATE TABLE IF NOT EXISTS module_services (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                code TEXT,
                default_price DECIMAL(15,2),
                module_tag TEXT NOT NULL DEFAULT 'GENERAL',
                user_id TEXT REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS module_appointments (
                id TEXT PRIMARY KEY,
                client_id TEXT REFERENCES module_clients(id) ON DELETE CASCADE,
                service_id TEXT REFERENCES module_services(id) ON DELETE SET NULL,
                date TIMESTAMP NOT NULL,
                status TEXT DEFAULT 'SCHEDULED', -- SCHEDULED, COMPLETED, CANCELED
                notes TEXT,
                transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
                module_tag TEXT NOT NULL DEFAULT 'GENERAL',
                user_id TEXT REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Add module_tag column if missing (for migrations from previous step)
        await client.query(`ALTER TABLE module_clients ADD COLUMN IF NOT EXISTS module_tag TEXT DEFAULT 'GENERAL';`);
        await client.query(`ALTER TABLE module_services ADD COLUMN IF NOT EXISTS module_tag TEXT DEFAULT 'GENERAL';`);
        await client.query(`ALTER TABLE module_appointments ADD COLUMN IF NOT EXISTS module_tag TEXT DEFAULT 'GENERAL';`);

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

const getFamilyCondition = `user_id IN (SELECT id FROM users WHERE family_id = (SELECT family_id FROM users WHERE id = $1))`;
const familyCheckParam2 = `user_id IN (SELECT id FROM users WHERE family_id = (SELECT family_id FROM users WHERE id = $2))`;

// Helper: Get Workspaces for User
const getUserWorkspaces = async (userId) => {
    const res = await pool.query(`
        SELECT 
            m.family_id as id, 
            u.name as name, 
            m.role,
            u.entity_type as "entityType",
            m.permissions
        FROM memberships m
        JOIN users u ON m.family_id = u.id
        WHERE m.user_id = $1
    `, [userId]);
    return res.rows;
};

// --- Routes ---

app.get('/api/health', async (req, res) => {
    res.json({ status: 'OK' });
});

// --- SCRAPER ROUTE (Enhanced) ---
app.post('/api/scrape-nfce', authenticateToken, async (req, res) => {
    const { url } = req.body;
    
    if (!url) return res.status(400).json({ error: 'URL é obrigatória' });

    console.log(`[Scraper] Iniciando scraping para: ${url}`);

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!response.ok) {
            console.error(`[Scraper] Falha no acesso: ${response.status} ${response.statusText}`);
            throw new Error(`Erro ao acessar SEFAZ: ${response.status}`);
        }

        const html = await response.text();

        // 1. Identificar Estado pela Chave de Acesso
        const accessKey = extractAccessKey(url);
        let ufCode = 'default';
        
        if (accessKey && accessKey.length === 44) {
            ufCode = accessKey.substring(0, 2); // Primeiros 2 dígitos são o código da UF
        }

        console.log(`[Scraper] Key: ${accessKey}, UF: ${ufCode}`);

        // 2. Selecionar Parser
        const parser = parsers[ufCode] || parsers['default'];
        
        // 3. Executar Parser
        const data = parser(html);

        // 4. Normalização Final
        let amount = data.amount;
        if (amount) {
            // Remove pontos de milhar e troca vírgula por ponto
            amount = amount.replace(/\./g, '').replace(',', '.');
        }

        let date = null;
        if (data.date) {
            // Convert DD/MM/YYYY to YYYY-MM-DD
            const parts = data.date.split('/');
            if (parts.length === 3) {
                date = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
        }

        if (!amount) {
            console.warn(`[Scraper] Valor não encontrado. Parser usado: ${ufCode}`);
            // Mudança Importante: Retornar 422 (Unprocessable Entity) em vez de 404 para distinguir de "Rota não encontrada"
            return res.status(422).json({ error: 'Não foi possível ler o valor total da nota. O layout da SEFAZ pode ter mudado ou o QR Code é inválido.' });
        }

        res.json({
            amount: parseFloat(amount),
            date: date || new Date().toISOString().split('T')[0],
            merchant: data.merchant || 'Estabelecimento NFC-e',
            stateCode: ufCode,
            paymentType: data.paymentType
        });

    } catch (error) {
        console.error("[Scraper] Exception:", error);
        res.status(500).json({ error: 'Erro ao processar link da nota fiscal. Tente inserir manualmente.' });
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

    // Register User
    await pool.query(
      `INSERT INTO users 
       (id, name, email, password_hash, family_id, settings, role, entity_type, plan, status, trial_ends_at) 
       VALUES ($1, $2, $3, $4, $1, $5, $6, $7, $8, $9, $10)`,
      [id, name, email, hashedPassword, defaultSettings, 'USER', entityType || 'PF', plan || 'TRIAL', 'TRIALING', trialEndsAt]
    );

    // Create default membership (Admin has full permissions implicitly, but we can set empty array)
    await pool.query('INSERT INTO memberships (user_id, family_id, role) VALUES ($1, $1, $2)', [id, 'ADMIN']);

    const workspaces = await getUserWorkspaces(id);

    const user = { 
        id, name, email, familyId: id, settings: defaultSettings,
        role: 'USER', entityType: entityType || 'PF', plan: plan || 'TRIAL', status: 'TRIALING', trialEndsAt,
        workspaces
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
    
    // Ensure membership exists for current family (migration fallback)
    if (!userRow.family_id) {
        await pool.query('UPDATE users SET family_id = $1 WHERE id = $2', [userRow.id, userRow.id]);
        userRow.family_id = userRow.id;
    }
    await pool.query(`
        INSERT INTO memberships (user_id, family_id, role)
        VALUES ($1, $2, 'ADMIN')
        ON CONFLICT (user_id, family_id) DO NOTHING
    `, [userRow.id, userRow.family_id]);

    const workspaces = await getUserWorkspaces(userRow.id);
    
    // Determine active entity type based on active family owner
    const ownerRes = await pool.query('SELECT entity_type FROM users WHERE id = $1', [userRow.family_id]);
    const activeEntityType = ownerRes.rows[0]?.entity_type || userRow.entity_type;

    const user = { 
        id: userRow.id, name: userRow.name, email: userRow.email, familyId: userRow.family_id,
        settings: userRow.settings || { includeCreditCardsInTotal: true },
        role: userRow.role || 'USER', entityType: activeEntityType,
        plan: userRow.plan, status: userRow.status, trialEndsAt: userRow.trial_ends_at,
        workspaces
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
       await pool.query('INSERT INTO memberships (user_id, family_id, role) VALUES ($1, $1, $2)', [id, 'ADMIN']);
       userRow = { id, name, email, family_id: id, settings: defaultSettings, role: 'USER', entity_type: 'PF', plan: 'TRIAL', status: 'TRIALING', trial_ends_at: trialEndsAt };
       await logAudit(pool, id, 'CREATE', 'user', id, `Novo usuário Google: ${name}`);
    } else {
       if (!userRow.google_id) await pool.query('UPDATE users SET google_id = $1 WHERE id = $2', [googleId, userRow.id]);
       if (!userRow.family_id) {
           await pool.query('UPDATE users SET family_id = $1 WHERE id = $2', [userRow.id, userRow.id]);
           userRow.family_id = userRow.id;
       }
       // Ensure membership
       await pool.query(`INSERT INTO memberships (user_id, family_id, role) VALUES ($1, $2, 'ADMIN') ON CONFLICT DO NOTHING`, [userRow.id, userRow.family_id]);
    }

    const workspaces = await getUserWorkspaces(userRow.id);
    const ownerRes = await pool.query('SELECT entity_type FROM users WHERE id = $1', [userRow.family_id]);
    const activeEntityType = ownerRes.rows[0]?.entity_type || userRow.entity_type;

    const user = { 
        id: userRow.id, name: userRow.name, email: userRow.email, familyId: userRow.family_id,
        settings: userRow.settings || defaultSettings, role: userRow.role || 'USER',
        entityType: activeEntityType, plan: userRow.plan, status: userRow.status, trialEndsAt: userRow.trial_ends_at,
        workspaces
    };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user });
  } catch (err) {
    res.status(400).json({ error: 'Google Auth Error: ' + err.message });
  }
});

// --- Context Switch Route ---
app.post('/api/switch-context', authenticateToken, async (req, res) => {
    const { targetFamilyId } = req.body;
    const userId = req.user.id;

    try {
        // Verify membership
        const check = await pool.query('SELECT * FROM memberships WHERE user_id = $1 AND family_id = $2', [userId, targetFamilyId]);
        if (check.rows.length === 0) {
            return res.status(403).json({ error: 'Você não tem acesso a esta conta.' });
        }

        // Update active context
        await pool.query('UPDATE users SET family_id = $1 WHERE id = $2', [targetFamilyId, userId]);

        // Fetch new active user state
        const userRow = (await pool.query('SELECT * FROM users WHERE id = $1', [userId])).rows[0];
        const workspaces = await getUserWorkspaces(userId);
        
        // Active entity type
        const ownerRes = await pool.query('SELECT entity_type FROM users WHERE id = $1', [targetFamilyId]);
        const activeEntityType = ownerRes.rows[0]?.entity_type || 'PF';

        const user = { 
            id: userRow.id, name: userRow.name, email: userRow.email, familyId: userRow.family_id,
            settings: userRow.settings, role: userRow.role, 
            entityType: activeEntityType, // Important: Switch context means potential switch of Features
            plan: userRow.plan, status: userRow.status, trialEndsAt: userRow.trial_ends_at,
            workspaces
        };
        const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });

        res.json({ success: true, token, user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/invite/join', authenticateToken, async (req, res) => {
    const { code } = req.body;
    const userId = req.user.id;
    try {
        const inviteRes = await pool.query('SELECT * FROM invites WHERE code = $1 AND expires_at > NOW()', [code]);
        const invite = inviteRes.rows[0];
        
        if (!invite) return res.status(404).json({ error: 'Convite inválido ou expirado' });

        // Add to memberships
        await pool.query(`
            INSERT INTO memberships (user_id, family_id, role) 
            VALUES ($1, $2, 'MEMBER') 
            ON CONFLICT (user_id, family_id) DO NOTHING
        `, [userId, invite.family_id]);

        // Switch user to this family immediately? Yes, standard flow.
        await pool.query('UPDATE users SET family_id = $1 WHERE id = $2', [invite.family_id, userId]);
        await pool.query('DELETE FROM invites WHERE id = $1', [invite.id]); // Consume invite? Or allow multiple? Assuming single use or expiry based. Code suggests reusable until expiry, but let's delete for security if needed. Actually let's keep it until expiry for multi-invite links, or delete if one-time. Let's assume one-time usage for safety.
        await pool.query('DELETE FROM invites WHERE code = $1', [code]);

        // Return updated user
        const userRow = (await pool.query('SELECT * FROM users WHERE id = $1', [userId])).rows[0];
        const workspaces = await getUserWorkspaces(userId);
        const ownerRes = await pool.query('SELECT entity_type FROM users WHERE id = $1', [userRow.family_id]);
        
        const user = { 
            id: userRow.id, name: userRow.name, email: userRow.email, familyId: userRow.family_id,
            settings: userRow.settings, role: userRow.role, entityType: ownerRes.rows[0]?.entity_type || 'PF',
            plan: userRow.plan, status: userRow.status, trialEndsAt: userRow.trial_ends_at,
            workspaces
        };
        const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });

        res.json({ success: true, token, user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ... (Rest of existing routes unchanged, ensure getFamilyCondition is used) ...

app.get('/api/initial-data', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const currentUserRes = await pool.query('SELECT family_id, entity_type FROM users WHERE id = $1', [userId]);
        const activeFamilyId = currentUserRes.rows[0]?.family_id || userId;
        
        const familyFilter = `user_id IN (SELECT id FROM users WHERE family_id = $1)`;
        
        const accs = await pool.query(`SELECT * FROM accounts WHERE ${familyFilter} AND deleted_at IS NULL`, [activeFamilyId]);
        
        const trans = await pool.query(`
            SELECT transactions.*, uc.name as created_by_name, uu.name as updated_by_name 
            FROM transactions 
            LEFT JOIN users uc ON transactions.created_by = uc.id
            LEFT JOIN users uu ON transactions.updated_by = uu.id
            WHERE transactions.${familyFilter} 
            AND transactions.deleted_at IS NULL
            ORDER BY transactions.date DESC
        `, [activeFamilyId]);
        
        const goals = await pool.query(`SELECT * FROM goals WHERE ${familyFilter} AND deleted_at IS NULL`, [activeFamilyId]);
        
        // Contacts now have extended fields
        const contacts = await pool.query(`SELECT * FROM contacts WHERE ${familyFilter} AND deleted_at IS NULL ORDER BY name ASC`, [activeFamilyId]);
        
        let categories = await pool.query(`SELECT * FROM categories WHERE ${familyFilter} AND deleted_at IS NULL ORDER BY name ASC`, [activeFamilyId]);

        const companyRes = await pool.query(`SELECT * FROM company_profiles WHERE user_id = $1`, [activeFamilyId]); // Company profile linked to Family Owner (Family ID)
        const branchesRes = await pool.query(`SELECT * FROM branches WHERE ${familyFilter} AND deleted_at IS NULL`, [activeFamilyId]);
        const costCentersRes = await pool.query(`SELECT * FROM cost_centers WHERE ${familyFilter} AND deleted_at IS NULL`, [activeFamilyId]);
        const departmentsRes = await pool.query(`SELECT * FROM departments WHERE ${familyFilter} AND deleted_at IS NULL`, [activeFamilyId]);
        const projectsRes = await pool.query(`SELECT * FROM projects WHERE ${familyFilter} AND deleted_at IS NULL`, [activeFamilyId]);

        // Generic Module Data (renamed from Odonto)
        const clientsRes = await pool.query(`
            SELECT mc.*, c.name as contact_name, c.email as contact_email, c.phone as contact_phone
            FROM module_clients mc 
            JOIN contacts c ON mc.contact_id = c.id
            WHERE mc.${familyFilter} AND mc.deleted_at IS NULL
        `, [activeFamilyId]);
        const servicesRes = await pool.query(`SELECT * FROM module_services WHERE ${familyFilter} AND deleted_at IS NULL`, [activeFamilyId]);
        const appointmentsRes = await pool.query(`
            SELECT ma.*, c.name as client_name, ms.name as service_name
            FROM module_appointments ma
            JOIN module_clients mc ON ma.client_id = mc.id
            JOIN contacts c ON mc.contact_id = c.id
            LEFT JOIN module_services ms ON ma.service_id = ms.id
            WHERE ma.${familyFilter} AND ma.deleted_at IS NULL
            ORDER BY ma.date ASC
        `, [activeFamilyId]);

        if (categories.rows.length === 0) {
            const defaults = [
                { name: 'Alimentação', type: 'EXPENSE' }, { name: 'Moradia', type: 'EXPENSE' },
                { name: 'Transporte', type: 'EXPENSE' }, { name: 'Saúde', type: 'EXPENSE' },
                { name: 'Lazer', type: 'EXPENSE' }, { name: 'Salário', type: 'INCOME' },
                { name: 'Investimentos', type: 'EXPENSE' }, { name: 'Educação', type: 'EXPENSE' }
            ];
            for (const c of defaults) {
                const newId = crypto.randomUUID();
                await pool.query('INSERT INTO categories (id, name, type, user_id) VALUES ($1, $2, $3, $4)', [newId, c.name, c.type, activeFamilyId]);
            }
            categories = await pool.query(`SELECT * FROM categories WHERE ${familyFilter} AND deleted_at IS NULL ORDER BY name ASC`, [activeFamilyId]);
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
                goalId: r.goal_id,
                createdByName: r.created_by_name, updatedByName: r.updated_by_name,
                createdAt: r.created_at, updatedAt: r.updated_at
            })),
            goals: goals.rows.map(r => ({ 
                id: r.id, name: r.name, targetAmount: parseFloat(r.target_amount), 
                currentAmount: parseFloat(r.current_amount), deadline: r.deadline ? new Date(r.deadline).toISOString().split('T')[0] : undefined 
            })),
            contacts: contacts.rows.map(r => ({ 
                id: r.id, name: r.name, email: r.email, phone: r.phone, document: r.document, pixKey: r.pix_key 
            })),
            categories: categories.rows.map(r => ({ id: r.id, name: r.name, type: r.type })),
            
            companyProfile: companyRes.rows[0] ? {
                id: companyRes.rows[0].id, tradeName: companyRes.rows[0].trade_name,
                legalName: companyRes.rows[0].legal_name, cnpj: companyRes.rows[0].cnpj
            } : null,
            branches: branchesRes.rows.map(r => ({ id: r.id, name: r.name, code: r.code })),
            costCenters: costCentersRes.rows.map(r => ({ id: r.id, name: r.name, code: r.code })),
            departments: departmentsRes.rows.map(r => ({ id: r.id, name: r.name })),
            projects: projectsRes.rows.map(r => ({ id: r.id, name: r.name })),
            
            // Generic Module Mapping
            serviceClients: clientsRes.rows.map(r => ({
                id: r.id, contactId: r.contact_id, contactName: r.contact_name, 
                contactEmail: r.contact_email, contactPhone: r.contact_phone,
                notes: r.notes, birthDate: r.birth_date ? new Date(r.birth_date).toISOString().split('T')[0] : undefined,
                insurance: r.insurance, allergies: r.allergies, medications: r.medications,
                moduleTag: r.module_tag
            })),
            serviceItems: servicesRes.rows.map(r => ({
                id: r.id, name: r.name, code: r.code, defaultPrice: parseFloat(r.default_price),
                moduleTag: r.module_tag
            })),
            serviceAppointments: appointmentsRes.rows.map(r => ({
                id: r.id, clientId: r.client_id, clientName: r.client_name,
                serviceId: r.service_id, serviceName: r.service_name,
                date: r.date, status: r.status, notes: r.notes, transactionId: r.transaction_id,
                moduleTag: r.module_tag
            }))
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
        
        const changes = calculateChanges(existing, req.body, {
            name: 'name',
            type: 'type',
            balance: 'balance',
            creditLimit: 'credit_limit',
            closingDay: 'closing_day',
            dueDay: 'due_day'
        });

        await pool.query(
            `INSERT INTO accounts (id, name, type, balance, user_id, credit_limit, closing_day, due_day) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
             ON CONFLICT (id) DO UPDATE SET name = $2, type = $3, balance = $4, credit_limit = $6, closing_day = $7, due_day = $8, deleted_at = NULL`,
            [id, name, type, balance, userId, creditLimit || null, closingDay || null, dueDay || null]
        );
        
        await logAudit(pool, userId, action, 'account', id, `Conta: ${name}`, existing, changes);
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
    const { id, name, email, phone, document, pixKey } = req.body;
    const userId = req.user.id;
    try {
        const existingRes = await pool.query('SELECT * FROM contacts WHERE id = $1', [id]);
        const existing = existingRes.rows[0];
        const action = existing ? 'UPDATE' : 'CREATE';

        const changes = calculateChanges(existing, req.body, { 
            name: 'name', email: 'email', phone: 'phone', document: 'document', pixKey: 'pix_key' 
        });

        await pool.query(
            `INSERT INTO contacts (id, name, user_id, email, phone, document, pix_key) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) 
             ON CONFLICT (id) DO UPDATE SET name=$2, email=$4, phone=$5, document=$6, pix_key=$7, deleted_at = NULL`, 
            [id, name, userId, sanitizeValue(email), sanitizeValue(phone), sanitizeValue(document), sanitizeValue(pixKey)]
        );
        await logAudit(pool, userId, action, 'contact', id, `Contato: ${name}`, existing, changes);
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

// ... (Transactions and other routes mostly unchanged) ...

app.post('/api/transactions', authenticateToken, async (req, res) => {
    const t = req.body;
    const userId = req.user.id;
    try {
        const existingRes = await pool.query('SELECT * FROM transactions WHERE id = $1', [t.id]);
        const existing = existingRes.rows[0];
        const action = existing ? 'UPDATE' : 'CREATE';

        // Map CamelCase Body to SnakeCase DB
        const changes = calculateChanges(existing, t, {
            description: 'description',
            amount: 'amount',
            type: 'type',
            category: 'category',
            date: 'date',
            status: 'status',
            accountId: 'account_id',
            destinationAccountId: 'destination_account_id',
            interestRate: 'interest_rate',
            contactId: 'contact_id',
            goalId: 'goal_id',
            branchId: 'branch_id',
            costCenterId: 'cost_center_id',
            departmentId: 'department_id',
            projectId: 'project_id',
            classification: 'classification',
            destinationBranchId: 'destination_branch_id'
        });

        await pool.query(
            `INSERT INTO transactions (
                id, description, amount, type, category, date, status, account_id, destination_account_id, 
                is_recurring, recurrence_frequency, recurrence_end_date, interest_rate, contact_id, goal_id,
                user_id, branch_id, cost_center_id, department_id, project_id, classification, destination_branch_id,
                created_by, updated_by, updated_at
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $23, NOW())
             ON CONFLICT (id) DO UPDATE SET 
                description=$2, amount=$3, type=$4, category=$5, date=$6, status=$7, account_id=$8, destination_account_id=$9, 
                is_recurring=$10, recurrence_frequency=$11, recurrence_end_date=$12, interest_rate=$13, contact_id=$14, goal_id=$15,
                branch_id=$17, cost_center_id=$18, department_id=$19, project_id=$20, classification=$21, destination_branch_id=$22,
                updated_by=$23, updated_at=NOW(), deleted_at=NULL`,
            [
                t.id, t.description, t.amount, t.type, t.category, t.date, t.status, t.accountId, 
                sanitizeValue(t.destinationAccountId), t.isRecurring, t.recurrenceFrequency, 
                t.recurrenceEndDate, t.interestRate || 0, sanitizeValue(t.contactId), sanitizeValue(t.goalId),
                userId,
                sanitizeValue(t.branchId), sanitizeValue(t.costCenterId), sanitizeValue(t.departmentId), sanitizeValue(t.projectId),
                t.classification || 'STANDARD', sanitizeValue(t.destinationBranchId),
                userId
            ]
        );

        // Auto-update Goal current_amount if linked
        if (t.goalId && t.status === 'PAID') {
            const amountToAdd = parseFloat(t.amount);
            // If it's a new transaction (CREATE), we add the full amount
            // If it's an update (UPDATE), we need to diff. But simplest logic for MVP is:
            // "Goals view calculates sum of linked transactions" OR "We update current_amount here".
            // Since `goals` table has a `current_amount` column, we update it.
            
            if (action === 'CREATE') {
                await pool.query(`UPDATE goals SET current_amount = current_amount + $1 WHERE id = $2`, [amountToAdd, t.goalId]);
            } else if (action === 'UPDATE' && existing) {
                // Adjust difference
                const oldAmount = existing.goal_id === t.goalId ? parseFloat(existing.amount) : 0;
                const diff = amountToAdd - oldAmount;
                await pool.query(`UPDATE goals SET current_amount = current_amount + $1 WHERE id = $2`, [diff, t.goalId]);
                
                // If goal changed (unlikely in this UI but possible), we'd need to handle removing from old goal. Keeping simple.
            }
        }

        await logAudit(pool, userId, action, 'transaction', t.id, `${t.type}: ${t.description} (R$ ${t.amount})`, existing, changes);
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
        
        // Reverse Goal Amount if linked
        if (previousState && previousState.goal_id && previousState.status === 'PAID') {
             await pool.query(`UPDATE goals SET current_amount = current_amount - $1 WHERE id = $2`, [previousState.amount, previousState.goal_id]);
        }

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
            previousState: r.previous_state,
            changes: r.changes
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
        const current = await pool.query(`SELECT * FROM ${tableName} WHERE id = $1`, [id]);
        const record = current.rows[0];

        await pool.query(`UPDATE ${tableName} SET deleted_at = NULL WHERE id = $1 AND ${familyCheckParam2}`, [id, userId]);
        
        if (entity === 'transaction' && record && record.status === 'PAID') {
            if (record.type === 'TRANSFER') {
                if (record.account_id) await updateAccountBalance(pool, record.account_id, record.amount, 'EXPENSE'); 
                if (record.destination_account_id) await updateAccountBalance(pool, record.destination_account_id, record.amount, 'INCOME');
            } else {
                await updateAccountBalance(pool, record.account_id, record.amount, record.type);
            }
            
            // Restore Goal Amount
            if (record.goal_id) {
                await pool.query(`UPDATE goals SET current_amount = current_amount + $1 WHERE id = $2`, [record.amount, record.goal_id]);
            }
        }

        await logAudit(pool, userId, 'RESTORE', entity, id, `Registro restaurado via Auditoria`, record);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

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

        const previousState = log.previous_state;
        const protectedColumns = ['id', 'user_id', 'created_at', 'updated_at', 'created_by'];
        const keys = Object.keys(previousState).filter(k => !protectedColumns.includes(k));
        
        if (keys.length === 0) return res.status(400).json({ error: 'Estado anterior vazio ou protegido.' });

        const setClause = keys.map((key, idx) => `"${key}" = $${idx + 2}`).join(', ');
        const values = keys.map(key => previousState[key]);
        
        const query = `UPDATE ${tableName} SET ${setClause}, updated_at = NOW() WHERE id = $1`;
        
        await pool.query(query, [log.entity_id, ...values]);

        if (log.entity === 'transaction' && currentState && previousState.status === 'PAID') {
            // Revert Account Balances
            if (currentState.account_id === previousState.account_id) {
                const oldAmount = parseFloat(previousState.amount);
                const newAmount = parseFloat(currentState.amount); 
                
                if (previousState.type === 'EXPENSE') {
                    const diff = newAmount - oldAmount;
                    await updateAccountBalance(pool, previousState.account_id, diff, 'INCOME'); 
                } else if (previousState.type === 'INCOME') {
                    const diff = newAmount - oldAmount;
                    await updateAccountBalance(pool, previousState.account_id, diff, 'EXPENSE'); 
                }
            }
            
            // Revert Goal Amounts if applicable
            if (currentState.goal_id === previousState.goal_id && currentState.goal_id) {
                 const oldAmount = parseFloat(previousState.amount);
                 const newAmount = parseFloat(currentState.amount);
                 // If reverting means going back to OLD amount
                 const diff = oldAmount - newAmount; // Logic might be complex, simplified for now
                 await pool.query(`UPDATE goals SET current_amount = current_amount + $1 WHERE id = $2`, [diff, currentState.goal_id]);
            }
        }

        await logAudit(pool, userId, 'REVERT', log.entity, log.entity_id, `Reversão de alteração (Log #${logId})`, currentState);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- GOALS ROUTES ---
app.post('/api/goals', authenticateToken, async (req, res) => {
    const { id, name, targetAmount, currentAmount, deadline } = req.body;
    const userId = req.user.id;
    try {
        const existingRes = await pool.query('SELECT * FROM goals WHERE id = $1', [id]);
        const existing = existingRes.rows[0];
        const action = existing ? 'UPDATE' : 'CREATE';

        const changes = calculateChanges(existing, req.body, { 
            name: 'name', targetAmount: 'target_amount', currentAmount: 'current_amount', deadline: 'deadline' 
        });

        await pool.query(
            `INSERT INTO goals (id, name, target_amount, current_amount, deadline, user_id) 
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO UPDATE SET 
                name = $2, target_amount = $3, current_amount = $4, deadline = $5, deleted_at = NULL`,
            [id, name, targetAmount, currentAmount, deadline || null, userId]
        );
        
        await logAudit(pool, userId, action, 'goal', id, `Meta: ${name}`, existing, changes);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/goals/:id', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const row = await pool.query(`SELECT * FROM goals WHERE id = $1`, [req.params.id]);
        const previousState = row.rows[0];
        
        await pool.query(`UPDATE goals SET deleted_at = NOW() WHERE id = $1 AND ${familyCheckParam2}`, [req.params.id, userId]);
        await logAudit(pool, userId, 'DELETE', 'goal', req.params.id, `Meta: ${previousState?.name}`, previousState);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

const createPjEndpoints = (pathName, tableName, entityName) => {
    app.post(`/api/${pathName}`, authenticateToken, async (req, res) => {
        const { id, name, code } = req.body;
        const userId = req.user.id;
        try {
            const existingRes = await pool.query(`SELECT * FROM ${tableName} WHERE id = $1`, [id]);
            const existing = existingRes.rows[0];
            const action = existing ? 'UPDATE' : 'CREATE';
            
            const changes = calculateChanges(existing, req.body, { name: 'name', code: 'code' });

            if (code !== undefined) {
                await pool.query(`INSERT INTO ${tableName} (id, name, code, user_id) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET name=$2, code=$3, deleted_at=NULL`, [id, name, code, userId]);
            } else {
                await pool.query(`INSERT INTO ${tableName} (id, name, user_id) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET name=$2, deleted_at=NULL`, [id, name, userId]);
            }
            await logAudit(pool, userId, action, entityName, id, `${name}`, existing, changes);
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
        
        const changes = calculateChanges(existing, req.body, { name: 'name', type: 'type' });

        await pool.query(
            `INSERT INTO categories (id, name, type, user_id) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET name=$2, type=$3, deleted_at=NULL`,
            [id, name, type || null, userId]
        );
        await logAudit(pool, userId, action, 'category', id, name, existing, changes);
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

// Admin Route example (optional)
app.get('/api/admin/invite/create', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const activeFamilyId = (await pool.query('SELECT family_id FROM users WHERE id = $1', [userId])).rows[0]?.family_id;
    
    if (!activeFamilyId) return res.status(400).json({error: "Usuário não tem contexto ativo"});

    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await pool.query(
        `INSERT INTO invites (code, family_id, created_by, expires_at) VALUES ($1, $2, $3, $4)`,
        [code, activeFamilyId, userId, expiresAt]
    );
    res.json({ code, expiresAt });
});

// --- NEW ROUTE: Get Family Members ---
app.get('/api/family/members', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const activeFamilyIdRes = await pool.query('SELECT family_id FROM users WHERE id = $1', [userId]);
        const familyId = activeFamilyIdRes.rows[0]?.family_id || userId;

        const members = await pool.query(`
            SELECT u.id, u.name, u.email, m.role, u.entity_type, m.permissions
            FROM users u
            JOIN memberships m ON u.id = m.user_id
            WHERE m.family_id = $1
        `, [familyId]);

        res.json(members.rows);
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/family/members/:memberId', authenticateToken, async (req, res) => {
    const { role, permissions } = req.body;
    const memberId = req.params.memberId;
    const userId = req.user.id;

    try {
        // Check if current user is ADMIN of the family
        const activeFamilyIdRes = await pool.query('SELECT family_id FROM users WHERE id = $1', [userId]);
        const familyId = activeFamilyIdRes.rows[0]?.family_id;

        const checkAdmin = await pool.query(`SELECT role FROM memberships WHERE user_id = $1 AND family_id = $2`, [userId, familyId]);
        if (checkAdmin.rows[0]?.role !== 'ADMIN') return res.status(403).json({ error: 'Apenas administradores podem gerenciar membros.' });

        await pool.query(`
            UPDATE memberships SET role = $1, permissions = $2
            WHERE user_id = $3 AND family_id = $4
        `, [role, JSON.stringify(permissions || []), memberId, familyId]);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/family/members/:memberId', authenticateToken, async (req, res) => {
    const memberId = req.params.memberId;
    const userId = req.user.id;

    try {
        const activeFamilyIdRes = await pool.query('SELECT family_id FROM users WHERE id = $1', [userId]);
        const familyId = activeFamilyIdRes.rows[0]?.family_id;

        const checkAdmin = await pool.query(`SELECT role FROM memberships WHERE user_id = $1 AND family_id = $2`, [userId, familyId]);
        if (checkAdmin.rows[0]?.role !== 'ADMIN') return res.status(403).json({ error: 'Apenas administradores podem remover membros.' });

        if (userId === memberId) return res.status(400).json({ error: 'Você não pode remover a si mesmo.' });

        await pool.query(`DELETE FROM memberships WHERE user_id = $1 AND family_id = $2`, [memberId, familyId]);
        
        // Reset user's family_id to their own ID if they were in this family
        await pool.query(`UPDATE users SET family_id = id WHERE id = $1 AND family_id = $2`, [memberId, familyId]);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- GENERIC MODULE ROUTES (Replaced Odonto) ---

app.post('/api/modules/clients', authenticateToken, async (req, res) => {
    const { id, contactId, notes, birthDate, moduleTag, insurance, allergies, medications } = req.body;
    const userId = req.user.id;
    try {
        await pool.query(
            `INSERT INTO module_clients (id, contact_id, notes, birth_date, module_tag, insurance, allergies, medications, user_id) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
             ON CONFLICT (id) DO UPDATE SET contact_id=$2, notes=$3, birth_date=$4, module_tag=$5, insurance=$6, allergies=$7, medications=$8, deleted_at=NULL`,
            [
                id, contactId, notes || '', sanitizeValue(birthDate), moduleTag || 'GENERAL', 
                sanitizeValue(insurance), sanitizeValue(allergies), sanitizeValue(medications), userId
            ]
        );
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/modules/clients/:id', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        await pool.query(`UPDATE module_clients SET deleted_at = NOW() WHERE id=$1 AND user_id=$2`, [req.params.id, userId]);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/modules/services', authenticateToken, async (req, res) => {
    const { id, name, code, defaultPrice, moduleTag } = req.body;
    const userId = req.user.id;
    try {
        await pool.query(
            `INSERT INTO module_services (id, name, code, default_price, module_tag, user_id)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO UPDATE SET name=$2, code=$3, default_price=$4, module_tag=$5, deleted_at=NULL`,
            [id, name, sanitizeValue(code), defaultPrice || 0, moduleTag || 'GENERAL', userId]
        );
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/modules/services/:id', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        await pool.query(`UPDATE module_services SET deleted_at = NOW() WHERE id=$1 AND user_id=$2`, [req.params.id, userId]);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/modules/appointments', authenticateToken, async (req, res) => {
    const { id, clientId, serviceId, date, status, notes, transactionId, moduleTag } = req.body;
    const userId = req.user.id;
    try {
        await pool.query(
            `INSERT INTO module_appointments (id, client_id, service_id, date, status, notes, transaction_id, module_tag, user_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (id) DO UPDATE SET client_id=$2, service_id=$3, date=$4, status=$5, notes=$6, transaction_id=$7, module_tag=$8, deleted_at=NULL`,
            [id, clientId, sanitizeValue(serviceId), date, status, notes, sanitizeValue(transactionId), moduleTag || 'GENERAL', userId]
        );
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/modules/appointments/:id', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        await pool.query(`UPDATE module_appointments SET deleted_at = NOW() WHERE id=$1 AND user_id=$2`, [req.params.id, userId]);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
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
