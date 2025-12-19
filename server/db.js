
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
  };
}

const pool = new Pool(poolConfig);

export const initDb = async () => {
    const queries = [
        // Core Tables
        `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT, email TEXT UNIQUE, password_hash TEXT, google_id TEXT, family_id TEXT, created_at TIMESTAMP DEFAULT NOW(), settings JSONB, role TEXT, entity_type TEXT, plan TEXT, status TEXT, trial_ends_at TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS memberships (user_id TEXT REFERENCES users(id), family_id TEXT, role TEXT DEFAULT 'MEMBER', permissions TEXT, PRIMARY KEY (user_id, family_id))`,
        `CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, name TEXT, type TEXT, balance DECIMAL, user_id TEXT, family_id TEXT, created_at TIMESTAMP DEFAULT NOW(), deleted_at TIMESTAMP, credit_limit DECIMAL, closing_day INTEGER, due_day INTEGER)`,
        `CREATE TABLE IF NOT EXISTS contacts (id TEXT PRIMARY KEY, name TEXT, fantasy_name TEXT, type TEXT, email TEXT, phone TEXT, document TEXT, ie TEXT, im TEXT, pix_key TEXT, zip_code TEXT, street TEXT, number TEXT, neighborhood TEXT, city TEXT, state TEXT, is_defaulter BOOLEAN, is_blocked BOOLEAN, credit_limit DECIMAL, default_payment_method TEXT, default_payment_term INTEGER, user_id TEXT, family_id TEXT, created_at TIMESTAMP DEFAULT NOW(), deleted_at TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, name TEXT, type TEXT, user_id TEXT, family_id TEXT, created_at TIMESTAMP DEFAULT NOW(), deleted_at TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY, description TEXT, amount DECIMAL, type TEXT, category TEXT, date DATE, status TEXT, account_id TEXT, destination_account_id TEXT, contact_id TEXT, user_id TEXT, family_id TEXT, is_recurring BOOLEAN, recurrence_frequency TEXT, recurrence_end_date DATE, interest_rate DECIMAL, created_at TIMESTAMP DEFAULT NOW(), deleted_at TIMESTAMP, goal_id TEXT, receipt_url TEXT, receipt_urls JSONB DEFAULT '[]')`,
        `CREATE TABLE IF NOT EXISTS goals (id TEXT PRIMARY KEY, name TEXT, target_amount DECIMAL, current_amount DECIMAL, deadline DATE, user_id TEXT, family_id TEXT, created_at TIMESTAMP DEFAULT NOW(), deleted_at TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS company_profiles (id TEXT PRIMARY KEY, trade_name TEXT, legal_name TEXT, cnpj TEXT, tax_regime TEXT, cnae TEXT, city TEXT, state TEXT, has_employees BOOLEAN, issues_invoices BOOLEAN, user_id TEXT, zip_code TEXT, street TEXT, number TEXT, neighborhood TEXT, phone TEXT, email TEXT, secondary_cnaes TEXT)`,
        `CREATE TABLE IF NOT EXISTS branches (id TEXT PRIMARY KEY, name TEXT, code TEXT, family_id TEXT)`,
        `CREATE TABLE IF NOT EXISTS cost_centers (id TEXT PRIMARY KEY, name TEXT, code TEXT, family_id TEXT)`,
        `CREATE TABLE IF NOT EXISTS departments (id TEXT PRIMARY KEY, name TEXT, family_id TEXT)`,
        `CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, name TEXT, family_id TEXT)`,
        `CREATE TABLE IF NOT EXISTS module_services (
            id TEXT PRIMARY KEY, 
            name TEXT, 
            code TEXT, 
            default_price DECIMAL(15,2), 
            module_tag TEXT, 
            user_id TEXT, 
            family_id TEXT, 
            type TEXT DEFAULT 'SERVICE',
            cost_price DECIMAL(15,2),
            unit TEXT,
            default_duration INTEGER DEFAULT 0,
            description TEXT,
            image_url TEXT,
            brand TEXT,
            items JSONB DEFAULT '[]',
            created_at TIMESTAMP DEFAULT NOW(), 
            deleted_at TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS commercial_orders (
            id TEXT PRIMARY KEY, 
            type TEXT, 
            description TEXT, 
            contact_id TEXT, 
            amount DECIMAL(15,2), 
            gross_amount DECIMAL(15,2), 
            discount_amount DECIMAL(15,2), 
            tax_amount DECIMAL(15,2), 
            items JSONB DEFAULT '[]',
            date DATE, 
            status TEXT, 
            transaction_id TEXT, 
            user_id TEXT, 
            family_id TEXT, 
            created_at TIMESTAMP DEFAULT NOW(), 
            deleted_at TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS service_orders (
            id TEXT PRIMARY KEY, 
            number SERIAL, 
            title TEXT, 
            description TEXT, 
            contact_id TEXT, 
            status TEXT, 
            total_amount DECIMAL(15,2) DEFAULT 0, 
            start_date DATE, 
            end_date DATE, 
            user_id TEXT, 
            family_id TEXT, 
            type TEXT,
            origin TEXT,
            priority TEXT,
            opened_at TIMESTAMP DEFAULT NOW(),
            items JSONB DEFAULT '[]',
            created_at TIMESTAMP DEFAULT NOW(), 
            deleted_at TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS contracts (
            id TEXT PRIMARY KEY, 
            title TEXT, 
            contact_id TEXT, 
            value DECIMAL(15,2), 
            start_date DATE, 
            end_date DATE, 
            status TEXT, 
            billing_day INTEGER, 
            user_id TEXT, 
            family_id TEXT, 
            created_at TIMESTAMP DEFAULT NOW(), 
            deleted_at TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS invoices (
            id TEXT PRIMARY KEY, 
            number TEXT, 
            series TEXT, 
            type TEXT, 
            amount DECIMAL(15,2), 
            issue_date DATE, 
            status TEXT, 
            contact_id TEXT, 
            file_url TEXT, 
            user_id TEXT, 
            family_id TEXT, 
            created_at TIMESTAMP DEFAULT NOW(), 
            deleted_at TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS audit_logs (id SERIAL PRIMARY KEY, user_id TEXT, action TEXT, entity TEXT, entity_id TEXT, details TEXT, timestamp TIMESTAMP DEFAULT NOW(), previous_state JSONB, changes JSONB)`
    ];
    
    try {
        for (const q of queries) {
            await pool.query(q);
        }

        // Migração Incremental
        const alterQueries = [
            `ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS type TEXT`,
            `ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS origin TEXT`,
            `ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS priority TEXT`,
            `ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS opened_at TIMESTAMP DEFAULT NOW()`,
            `ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'`,
            `ALTER TABLE module_services ADD COLUMN IF NOT EXISTS default_duration INTEGER DEFAULT 0`,
            `ALTER TABLE module_services ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'`,
            `ALTER TABLE module_services ADD COLUMN IF NOT EXISTS cost_price DECIMAL(15,2) DEFAULT 0`
        ];

        for (const q of alterQueries) {
            try { await pool.query(q); } catch (e) {}
        }

        console.log("✅ [DATABASE] Estrutura verificada e sincronizada.");
    } catch (e) {
        console.error("❌ [DATABASE] Erro na inicialização:", e);
    }
};

export default pool;
