
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
        `CREATE TABLE IF NOT EXISTS memberships (user_id TEXT REFERENCES users(id), family_id TEXT, role TEXT DEFAULT 'MEMBER', permissions TEXT, PRIMARY KEY (user_id, family_id))`,
        `CREATE TABLE IF NOT EXISTS invites (code TEXT PRIMARY KEY, family_id TEXT, created_by TEXT REFERENCES users(id), expires_at TIMESTAMP, role_template TEXT DEFAULT 'MEMBER')`,
        `CREATE TABLE IF NOT EXISTS audit_logs (id SERIAL PRIMARY KEY, user_id TEXT, action TEXT, entity TEXT, entity_id TEXT, details TEXT, previous_state JSONB, changes JSONB, family_id TEXT, timestamp TIMESTAMP DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS notification_logs (id SERIAL PRIMARY KEY, status TEXT, channel TEXT, recipient TEXT, subject TEXT, content TEXT, user_id TEXT REFERENCES users(id), family_id TEXT, created_at TIMESTAMP DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, name TEXT, type TEXT, balance DECIMAL(15,2), user_id TEXT, family_id TEXT, created_at TIMESTAMP DEFAULT NOW(), deleted_at TIMESTAMP, credit_limit DECIMAL(15,2), closing_day INTEGER, due_day INTEGER)`,
        `CREATE TABLE IF NOT EXISTS contacts (id TEXT PRIMARY KEY, name TEXT, fantasy_name TEXT, type TEXT, email TEXT, phone TEXT, document TEXT, ie TEXT, im TEXT, pix_key TEXT, zip_code TEXT, street TEXT, number TEXT, neighborhood TEXT, city TEXT, state TEXT, user_id TEXT, family_id TEXT, created_at TIMESTAMP DEFAULT NOW(), deleted_at TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, name TEXT, type TEXT, user_id TEXT, family_id TEXT, created_at TIMESTAMP DEFAULT NOW(), deleted_at TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS service_items (id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT, type TEXT, user_id TEXT REFERENCES users(id), family_id TEXT, created_at TIMESTAMP DEFAULT NOW(), deleted_at TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY, description TEXT, amount DECIMAL(15,2), type TEXT, category TEXT, date DATE, status TEXT, account_id TEXT, destination_account_id TEXT, contact_id TEXT, user_id TEXT, family_id TEXT, is_recurring BOOLEAN, recurrence_frequency TEXT, recurrence_end_date DATE, interest_rate DECIMAL(10,2), created_at TIMESTAMP DEFAULT NOW(), deleted_at TIMESTAMP, goal_id TEXT, receipt_url TEXT, receipt_urls JSONB DEFAULT '[]', branch_id TEXT, cost_center_id TEXT, department_id TEXT, project_id TEXT, classification TEXT)`,
        `CREATE TABLE IF NOT EXISTS goals (id TEXT PRIMARY KEY, name TEXT, target_amount DECIMAL(15,2), current_amount DECIMAL(15,2), deadline DATE, user_id TEXT, family_id TEXT, created_at TIMESTAMP DEFAULT NOW(), deleted_at TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS company_profiles (id TEXT PRIMARY KEY, trade_name TEXT, legal_name TEXT, cnpj TEXT, family_id TEXT)`,
        `CREATE TABLE IF NOT EXISTS branches (id TEXT PRIMARY KEY, name TEXT, code TEXT, family_id TEXT, deleted_at TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS salespeople (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), family_id TEXT, branch_id TEXT, created_at TIMESTAMP DEFAULT NOW(), deleted_at TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS salesperson_schedules (id TEXT PRIMARY KEY, salesperson_id TEXT REFERENCES salespeople(id), date DATE NOT NULL, family_id TEXT, deleted_at TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS service_orders (id TEXT PRIMARY KEY, title TEXT NOT NULL, contact_id TEXT REFERENCES contacts(id), status TEXT NOT NULL, family_id TEXT, deleted_at TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS commercial_orders (id TEXT PRIMARY KEY, description TEXT NOT NULL, contact_id TEXT REFERENCES contacts(id), amount DECIMAL(15,2) NOT NULL, date DATE NOT NULL, status TEXT NOT NULL, family_id TEXT, deleted_at TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS optical_rxs (id TEXT PRIMARY KEY, contact_id TEXT REFERENCES contacts(id), rx_date DATE NOT NULL, family_id TEXT, deleted_at TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS laboratories (id TEXT PRIMARY KEY, name TEXT NOT NULL, family_id TEXT, deleted_at TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS service_clients (id TEXT PRIMARY KEY, contact_id TEXT REFERENCES contacts(id), family_id TEXT, deleted_at TIMESTAMP)`
    ];

    // 2. Migrações de Colunas (Garante que colunas novas sejam adicionadas a tabelas existentes)
    const migrationQueries = [
        // Contatos (Ótica e Crédito)
        `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_defaulter BOOLEAN DEFAULT FALSE`,
        `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE`,
        `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(15,2) DEFAULT 0`,
        `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS default_payment_method TEXT`,
        `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS default_payment_term INTEGER`,
        `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS optical_notes TEXT`,
        `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS brand_preference TEXT`,
        `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_consultation_date DATE`,
        `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS years_of_use INTEGER`,
        `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS optical_category TEXT`,
        
        // Itens de Serviço (Ótica)
        `ALTER TABLE service_items ADD COLUMN IF NOT EXISTS default_price DECIMAL(15,2) DEFAULT 0`,
        `ALTER TABLE service_items ADD COLUMN IF NOT EXISTS cost_price DECIMAL(15,2) DEFAULT 0`,
        `ALTER TABLE service_items ADD COLUMN IF NOT EXISTS module_tag TEXT`,
        `ALTER TABLE service_items ADD COLUMN IF NOT EXISTS default_duration INTEGER`,
        `ALTER TABLE service_items ADD COLUMN IF NOT EXISTS is_composite BOOLEAN DEFAULT FALSE`,
        `ALTER TABLE service_items ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'`,
        `ALTER TABLE service_items ADD COLUMN IF NOT EXISTS brand TEXT`,
        `ALTER TABLE service_items ADD COLUMN IF NOT EXISTS description TEXT`,
        `ALTER TABLE service_items ADD COLUMN IF NOT EXISTS image_url TEXT`,
        `ALTER TABLE service_items ADD COLUMN IF NOT EXISTS unit TEXT`,

        // Receitas RX (Campos técnicos)
        `ALTER TABLE optical_rxs ADD COLUMN IF NOT EXISTS professional_name TEXT`,
        `ALTER TABLE optical_rxs ADD COLUMN IF NOT EXISTS expiration_date DATE`,
        `ALTER TABLE optical_rxs ADD COLUMN IF NOT EXISTS sphere_od_longe DECIMAL(5,2)`,
        `ALTER TABLE optical_rxs ADD COLUMN IF NOT EXISTS cyl_od_longe DECIMAL(5,2)`,
        `ALTER TABLE optical_rxs ADD COLUMN IF NOT EXISTS axis_od_longe INTEGER`,
        `ALTER TABLE optical_rxs ADD COLUMN IF NOT EXISTS addition DECIMAL(5,2)`,
        `ALTER TABLE optical_rxs ADD COLUMN IF NOT EXISTS observations TEXT`,
        `ALTER TABLE optical_rxs ADD COLUMN IF NOT EXISTS branch_id TEXT`,
        `ALTER TABLE optical_rxs ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id)`,
        `ALTER TABLE optical_rxs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`,
        `ALTER TABLE optical_rxs ADD COLUMN IF NOT EXISTS sphere_od_perto DECIMAL(5,2)`,
        `ALTER TABLE optical_rxs ADD COLUMN IF NOT EXISTS cyl_od_perto DECIMAL(5,2)`,
        `ALTER TABLE optical_rxs ADD COLUMN IF NOT EXISTS axis_od_perto INTEGER`,
        `ALTER TABLE optical_rxs ADD COLUMN IF NOT EXISTS sphere_oe_longe DECIMAL(5,2)`,
        `ALTER TABLE optical_rxs ADD COLUMN IF NOT EXISTS cyl_oe_longe DECIMAL(5,2)`,
        `ALTER TABLE optical_rxs ADD COLUMN IF NOT EXISTS axis_oe_longe INTEGER`,
        `ALTER TABLE optical_rxs ADD COLUMN IF NOT EXISTS sphere_oe_perto DECIMAL(5,2)`,
        `ALTER TABLE optical_rxs ADD COLUMN IF NOT EXISTS cyl_oe_perto DECIMAL(5,2)`,
        `ALTER TABLE optical_rxs ADD COLUMN IF NOT EXISTS axis_oe_perto INTEGER`,
        `ALTER TABLE optical_rxs ADD COLUMN IF NOT EXISTS dnp_od DECIMAL(5,2)`,
        `ALTER TABLE optical_rxs ADD COLUMN IF NOT EXISTS dnp_oe DECIMAL(5,2)`,
        `ALTER TABLE optical_rxs ADD COLUMN IF NOT EXISTS height_od DECIMAL(5,2)`,
        `ALTER TABLE optical_rxs ADD COLUMN IF NOT EXISTS height_oe DECIMAL(5,2)`,
        `ALTER TABLE optical_rxs ADD COLUMN IF NOT EXISTS image_url TEXT`,
        `ALTER TABLE optical_rxs ADD COLUMN IF NOT EXISTS laboratory_id TEXT`,
        `ALTER TABLE optical_rxs ADD COLUMN IF NOT EXISTS lab_status TEXT`,
        `ALTER TABLE optical_rxs ADD COLUMN IF NOT EXISTS lab_sent_date DATE`,
        `ALTER TABLE optical_rxs ADD COLUMN IF NOT EXISTS lab_return_date DATE`,

        // Migrações adicionais para Laboratórios (Fix para erro de sincronização)
        `ALTER TABLE laboratories ADD COLUMN IF NOT EXISTS contact_person TEXT`,
        `ALTER TABLE laboratories ADD COLUMN IF NOT EXISTS email TEXT`,
        `ALTER TABLE laboratories ADD COLUMN IF NOT EXISTS phone TEXT`,
        `ALTER TABLE laboratories ADD COLUMN IF NOT EXISTS address TEXT`,
        `ALTER TABLE laboratories ADD COLUMN IF NOT EXISTS notes TEXT`,
        `ALTER TABLE laboratories ADD COLUMN IF NOT EXISTS preferred_communication TEXT`,
        `ALTER TABLE laboratories ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id)`,
        `ALTER TABLE laboratories ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`,

        // Migrações adicionais para Ordens de Serviço
        `ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS description TEXT`,
        `ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS total_amount DECIMAL(15,2) DEFAULT 0`,
        `ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS start_date DATE`,
        `ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS end_date DATE`,
        `ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'`,
        `ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS type TEXT`,
        `ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS origin TEXT`,
        `ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS priority TEXT`,
        `ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS opened_at TIMESTAMP`,
        `ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id)`,
        `ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS assignee_id TEXT`,
        `ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS rx_id TEXT`,
        `ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS branch_id TEXT`,
        `ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS module_tag TEXT`,

        // Migrações adicionais para Pedidos Comerciais
        `ALTER TABLE commercial_orders ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'`,
        `ALTER TABLE commercial_orders ADD COLUMN IF NOT EXISTS type TEXT`,
        `ALTER TABLE commercial_orders ADD COLUMN IF NOT EXISTS gross_amount DECIMAL(15,2) DEFAULT 0`,
        `ALTER TABLE commercial_orders ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(15,2) DEFAULT 0`,
        `ALTER TABLE commercial_orders ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(15,2) DEFAULT 0`,
        `ALTER TABLE commercial_orders ADD COLUMN IF NOT EXISTS transaction_id TEXT`,
        `ALTER TABLE commercial_orders ADD COLUMN IF NOT EXISTS assignee_id TEXT`,
        `ALTER TABLE commercial_orders ADD COLUMN IF NOT EXISTS rx_id TEXT`,
        `ALTER TABLE commercial_orders ADD COLUMN IF NOT EXISTS branch_id TEXT`,
        `ALTER TABLE commercial_orders ADD COLUMN IF NOT EXISTS module_tag TEXT`
    ];
    
    try {
        // Executa criação de tabelas
        for (const q of createQueries) { await pool.query(q); }
        // Executa migrações de colunas
        for (const q of migrationQueries) { await pool.query(q).catch(e => console.warn("Migration notice:", e.message)); }
        
        console.log("✅ [DATABASE] Tabelas e migrações operacionais prontas.");
    } catch (e) {
        console.error("❌ [DATABASE] Erro fatal na preparação:", e);
    }
};

export default pool;
