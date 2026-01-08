
import pg from 'pg';
const { Pool } = pg;

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
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };
}

const pool = new Pool(poolConfig);

export const initDb = async () => {
    // 1. Criação das tabelas base
    const createQueries = [
        `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT, email TEXT UNIQUE, password_hash TEXT, google_id TEXT, family_id TEXT, created_at TIMESTAMP DEFAULT NOW(), settings JSONB, role TEXT, entity_type TEXT, plan TEXT, status TEXT, trial_ends_at TIMESTAMP, stripe_customer_id TEXT, stripe_subscription_id TEXT)`,
        `CREATE TABLE IF NOT EXISTS memberships (user_id TEXT REFERENCES users(id), family_id TEXT, role TEXT DEFAULT 'MEMBER', permissions TEXT, contact_id TEXT, PRIMARY KEY (user_id, family_id))`,
        `CREATE TABLE IF NOT EXISTS invites (code TEXT PRIMARY KEY, family_id TEXT, created_by TEXT REFERENCES users(id), expires_at TIMESTAMP, role_template TEXT DEFAULT 'MEMBER')`,
        `CREATE TABLE IF NOT EXISTS audit_logs (id SERIAL PRIMARY KEY, user_id TEXT, action TEXT, entity TEXT, entity_id TEXT, details TEXT, previous_state JSONB, changes JSONB, family_id TEXT, timestamp TIMESTAMP DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS notification_logs (id SERIAL PRIMARY KEY, status TEXT, channel TEXT, recipient TEXT, subject TEXT, content TEXT, user_id TEXT REFERENCES users(id), family_id TEXT, created_at TIMESTAMP DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, name TEXT, type TEXT, balance DECIMAL(15,2), user_id TEXT, family_id TEXT, created_at TIMESTAMP DEFAULT NOW(), deleted_at TIMESTAMP, credit_limit DECIMAL(15,2), closing_day INTEGER, due_day INTEGER)`,
        `CREATE TABLE IF NOT EXISTS contacts (id TEXT PRIMARY KEY, name TEXT, fantasy_name TEXT, type TEXT, email TEXT, phone TEXT, document TEXT, ie TEXT, im TEXT, pix_key TEXT, zip_code TEXT, street TEXT, number TEXT, complement TEXT, neighborhood TEXT, city TEXT, state TEXT, external_id TEXT, user_id TEXT, family_id TEXT, created_at TIMESTAMP DEFAULT NOW(), deleted_at TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, name TEXT, type TEXT, user_id TEXT, family_id TEXT, created_at TIMESTAMP DEFAULT NOW(), deleted_at TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS service_items (id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT, type TEXT, user_id TEXT REFERENCES users(id), family_id TEXT, created_at TIMESTAMP DEFAULT NOW(), deleted_at TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY, description TEXT, amount DECIMAL(15,2), type TEXT, category TEXT, date DATE, status TEXT, account_id TEXT, destination_account_id TEXT, contact_id TEXT, user_id TEXT, family_id TEXT, is_recurring BOOLEAN, recurrence_frequency TEXT, recurrence_end_date DATE, interest_rate DECIMAL(10,2), created_at TIMESTAMP DEFAULT NOW(), deleted_at TIMESTAMP, goal_id TEXT, receipt_url TEXT, receipt_urls JSONB DEFAULT '[]', branch_id TEXT, cost_center_id TEXT, department_id TEXT, project_id TEXT, classification TEXT)`,
        `CREATE TABLE IF NOT EXISTS goals (id TEXT PRIMARY KEY, name TEXT, target_amount DECIMAL(15,2), current_amount DECIMAL(15,2), deadline DATE, user_id TEXT, family_id TEXT, created_at TIMESTAMP DEFAULT NOW(), deleted_at TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS company_profiles (id TEXT PRIMARY KEY, trade_name TEXT, legal_name TEXT, cnpj TEXT, family_id TEXT)`,
        `CREATE TABLE IF NOT EXISTS branches (id TEXT PRIMARY KEY, name TEXT, code TEXT, family_id TEXT, deleted_at TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS salespeople (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), family_id TEXT, branch_id TEXT, created_at TIMESTAMP DEFAULT NOW(), deleted_at TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS salesperson_schedules (id TEXT PRIMARY KEY, salesperson_id TEXT REFERENCES salespeople(id), date DATE NOT NULL, family_id TEXT, deleted_at TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS service_orders (id TEXT PRIMARY KEY, title TEXT NOT NULL, contact_id TEXT REFERENCES contacts(id), status TEXT NOT NULL, family_id TEXT, deleted_at TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS commercial_orders (id TEXT PRIMARY KEY, description TEXT NOT NULL, contact_id TEXT REFERENCES contacts(id), amount DECIMAL(15,2) NOT NULL, date DATE NOT NULL, status TEXT NOT NULL, family_id TEXT, deleted_at TIMESTAMP, account_id TEXT)`,
        `CREATE TABLE IF NOT EXISTS optical_rxs (id TEXT PRIMARY KEY, contact_id TEXT REFERENCES contacts(id), rx_date DATE NOT NULL, family_id TEXT, deleted_at TIMESTAMP, status TEXT DEFAULT 'PENDING')`,
        `CREATE TABLE IF NOT EXISTS laboratories (id TEXT PRIMARY KEY, name TEXT NOT NULL, family_id TEXT, deleted_at TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS service_clients (id TEXT PRIMARY KEY, contact_id TEXT REFERENCES contacts(id), family_id TEXT, deleted_at TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS stock_transfers (id TEXT PRIMARY KEY, service_item_id TEXT, from_branch_id TEXT, to_branch_id TEXT, quantity DECIMAL(15,2), date DATE, notes TEXT, user_id TEXT, family_id TEXT, created_at TIMESTAMP DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS chat_messages (id TEXT PRIMARY KEY, sender_id TEXT, sender_name TEXT, receiver_id TEXT, family_id TEXT, content TEXT, type TEXT, attachment_url TEXT, created_at TIMESTAMP DEFAULT NOW())`
    ];

    // 2. Migrações de Colunas
    const migrationQueries = [
        `ALTER TABLE memberships ADD COLUMN IF NOT EXISTS contact_id TEXT`,
        `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS external_id TEXT`,
        `ALTER TABLE commercial_orders ADD COLUMN IF NOT EXISTS account_id TEXT`,
        `ALTER TABLE commercial_orders ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'`,
        `ALTER TABLE commercial_orders ADD COLUMN IF NOT EXISTS type TEXT`,
        `ALTER TABLE branches ADD COLUMN IF NOT EXISTS user_id TEXT`,
        `ALTER TABLE branches ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE`,
        `ALTER TABLE branches ADD COLUMN IF NOT EXISTS city TEXT`,
        `ALTER TABLE branches ADD COLUMN IF NOT EXISTS color TEXT`,
        // Migrações para Catálogo (Service Items)
        `ALTER TABLE service_items ADD COLUMN IF NOT EXISTS category TEXT`,
        `ALTER TABLE service_items ADD COLUMN IF NOT EXISTS branch_id TEXT`,
        `ALTER TABLE service_items ADD COLUMN IF NOT EXISTS stock_quantity DECIMAL(15,2) DEFAULT 0`,
        `ALTER TABLE service_items ADD COLUMN IF NOT EXISTS warranty_enabled BOOLEAN DEFAULT FALSE`,
        `ALTER TABLE service_items ADD COLUMN IF NOT EXISTS warranty_days INTEGER DEFAULT 0`,
        `ALTER TABLE service_items ADD COLUMN IF NOT EXISTS is_free_allowed BOOLEAN DEFAULT FALSE`,
        `ALTER TABLE service_items ADD COLUMN IF NOT EXISTS auto_generate_os BOOLEAN DEFAULT FALSE`,
        `ALTER TABLE service_items ADD COLUMN IF NOT EXISTS unit TEXT`,
        `ALTER TABLE service_items ADD COLUMN IF NOT EXISTS brand TEXT`,
        `ALTER TABLE service_items ADD COLUMN IF NOT EXISTS description TEXT`,
        `ALTER TABLE service_items ADD COLUMN IF NOT EXISTS image_url TEXT`,
        `ALTER TABLE service_items ADD COLUMN IF NOT EXISTS default_price DECIMAL(15,2) DEFAULT 0`,
        `ALTER TABLE service_items ADD COLUMN IF NOT EXISTS cost_price DECIMAL(15,2) DEFAULT 0`,
        `ALTER TABLE service_items ADD COLUMN IF NOT EXISTS module_tag TEXT`,
        `ALTER TABLE service_items ADD COLUMN IF NOT EXISTS is_composite BOOLEAN DEFAULT FALSE`,
        `ALTER TABLE service_items ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'`
    ];
    
    try {
        for (const q of createQueries) { await pool.query(q); }
        for (const q of migrationQueries) { await pool.query(q).catch(e => console.warn("Migration notice:", e.message)); }
        console.log("✅ [DATABASE] Tabelas e migrações operacionais prontas.");
    } catch (e) {
        console.error("❌ [DATABASE] Erro fatal na preparação:", e);
    }
};

export default pool;
