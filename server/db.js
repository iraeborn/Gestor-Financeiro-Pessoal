
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
    connectionTimeoutMillis: 5000,
  };
}

const pool = new Pool(poolConfig);

export const initDb = async () => {
    const queries = [
        `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT, email TEXT UNIQUE, password_hash TEXT, google_id TEXT, family_id TEXT, created_at TIMESTAMP DEFAULT NOW(), settings JSONB, role TEXT, entity_type TEXT, plan TEXT, status TEXT, trial_ends_at TIMESTAMP, stripe_customer_id TEXT, stripe_subscription_id TEXT)`,
        `CREATE TABLE IF NOT EXISTS memberships (user_id TEXT REFERENCES users(id), family_id TEXT, role TEXT DEFAULT 'MEMBER', permissions TEXT, PRIMARY KEY (user_id, family_id))`,
        `CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, name TEXT, type TEXT, balance DECIMAL(15,2), user_id TEXT, family_id TEXT, created_at TIMESTAMP DEFAULT NOW(), deleted_at TIMESTAMP, credit_limit DECIMAL(15,2), closing_day INTEGER, due_day INTEGER)`,
        `CREATE TABLE IF NOT EXISTS contacts (id TEXT PRIMARY KEY, name TEXT, fantasy_name TEXT, type TEXT, email TEXT, phone TEXT, document TEXT, ie TEXT, im TEXT, pix_key TEXT, zip_code TEXT, street TEXT, number TEXT, neighborhood TEXT, city TEXT, state TEXT, is_defaulter BOOLEAN, is_blocked BOOLEAN, credit_limit DECIMAL(15,2), default_payment_method TEXT, default_payment_term INTEGER, user_id TEXT, family_id TEXT, created_at TIMESTAMP DEFAULT NOW(), deleted_at TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, name TEXT, type TEXT, user_id TEXT, family_id TEXT, created_at TIMESTAMP DEFAULT NOW(), deleted_at TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY, description TEXT, amount DECIMAL(15,2), type TEXT, category TEXT, date DATE, status TEXT, account_id TEXT, destination_account_id TEXT, contact_id TEXT, user_id TEXT, family_id TEXT, is_recurring BOOLEAN, recurrence_frequency TEXT, recurrence_end_date DATE, interest_rate DECIMAL(10,2), created_at TIMESTAMP DEFAULT NOW(), deleted_at TIMESTAMP, goal_id TEXT, receipt_url TEXT, receipt_urls JSONB DEFAULT '[]', branch_id TEXT, cost_center_id TEXT, department_id TEXT, project_id TEXT)`,
        `CREATE TABLE IF NOT EXISTS goals (id TEXT PRIMARY KEY, name TEXT, target_amount DECIMAL(15,2), current_amount DECIMAL(15,2), deadline DATE, user_id TEXT, family_id TEXT, created_at TIMESTAMP DEFAULT NOW(), deleted_at TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS company_profiles (id TEXT PRIMARY KEY, trade_name TEXT, legal_name TEXT, cnpj TEXT, tax_regime TEXT, cnae TEXT, city TEXT, state TEXT, has_employees BOOLEAN, issues_invoices BOOLEAN, user_id TEXT, family_id TEXT, zip_code TEXT, street TEXT, number TEXT, neighborhood TEXT, phone TEXT, email TEXT, secondary_cnaes TEXT)`,
        `CREATE TABLE IF NOT EXISTS branches (id TEXT PRIMARY KEY, name TEXT, code TEXT, city TEXT, phone TEXT, color TEXT, is_active BOOLEAN DEFAULT TRUE, family_id TEXT, deleted_at TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS cost_centers (id TEXT PRIMARY KEY, name TEXT, code TEXT, family_id TEXT, deleted_at TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS departments (id TEXT PRIMARY KEY, name TEXT, family_id TEXT, deleted_at TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, name TEXT, family_id TEXT, deleted_at TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS module_services (id TEXT PRIMARY KEY, name TEXT, code TEXT, default_price DECIMAL(15,2), module_tag TEXT, user_id TEXT, family_id TEXT, type TEXT DEFAULT 'SERVICE', cost_price DECIMAL(15,2), unit TEXT, default_duration INTEGER DEFAULT 0, description TEXT, image_url TEXT, brand TEXT, items JSONB DEFAULT '[]', is_composite BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT NOW(), deleted_at TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS commercial_orders (id TEXT PRIMARY KEY, type TEXT, description TEXT, contact_id TEXT, amount DECIMAL(15,2), gross_amount DECIMAL(15,2), discount_amount DECIMAL(15,2), tax_amount DECIMAL(15,2), items JSONB DEFAULT '[]', date DATE, status TEXT, transaction_id TEXT, user_id TEXT, family_id TEXT, access_token TEXT, branch_id TEXT, rx_id TEXT, assignee_id TEXT, assignee_name TEXT, created_at TIMESTAMP DEFAULT NOW(), deleted_at TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS service_orders (id TEXT PRIMARY KEY, number SERIAL, title TEXT, description TEXT, contact_id TEXT, status TEXT, total_amount DECIMAL(15,2) DEFAULT 0, start_date DATE, end_date DATE, user_id TEXT, family_id TEXT, type TEXT, origin TEXT, priority TEXT, opened_at TIMESTAMP DEFAULT NOW(), items JSONB DEFAULT '[]', branch_id TEXT, rx_id TEXT, assignee_id TEXT, assignee_name TEXT, created_at TIMESTAMP DEFAULT NOW(), deleted_at TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS service_clients (id TEXT PRIMARY KEY, contact_id TEXT, contact_name TEXT, contact_email TEXT, contact_phone TEXT, notes TEXT, birth_date TEXT, insurance TEXT, allergies TEXT, medications TEXT, module_tag TEXT, user_id TEXT, family_id TEXT, odontogram JSONB DEFAULT '[]', anamnesis JSONB DEFAULT '{}', prescriptions JSONB DEFAULT '[]', attachments JSONB DEFAULT '[]', treatment_plans JSONB DEFAULT '[]', deleted_at TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS service_appointments (id TEXT PRIMARY KEY, client_id TEXT, service_id TEXT, tooth INTEGER, teeth JSONB DEFAULT '[]', treatment_items JSONB DEFAULT '[]', date TEXT, status TEXT, notes TEXT, clinical_notes TEXT, module_tag TEXT, user_id TEXT, family_id TEXT, is_locked BOOLEAN DEFAULT FALSE, branch_id TEXT, deleted_at TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS contracts (id TEXT PRIMARY KEY, title TEXT, contact_id TEXT, value DECIMAL(15,2), start_date DATE, end_date DATE, status TEXT, billing_day INTEGER, user_id TEXT, family_id TEXT, created_at TIMESTAMP DEFAULT NOW(), deleted_at TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS invoices (id TEXT PRIMARY KEY, number TEXT, series TEXT, type TEXT, amount DECIMAL(15,2), issue_date DATE, status TEXT, contact_id TEXT, description TEXT, items JSONB DEFAULT '[]', file_url TEXT, order_id TEXT, service_order_id TEXT, user_id TEXT, family_id TEXT, created_at TIMESTAMP DEFAULT NOW(), deleted_at TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS audit_logs (id SERIAL PRIMARY KEY, user_id TEXT, action TEXT, entity TEXT, entity_id TEXT, details TEXT, timestamp TIMESTAMP DEFAULT NOW(), previous_state JSONB, changes JSONB, family_id TEXT)`,
        `CREATE TABLE IF NOT EXISTS optical_rxs (
            id TEXT PRIMARY KEY,
            contact_id TEXT REFERENCES contacts(id),
            professional_name TEXT,
            rx_date DATE NOT NULL,
            expiration_date DATE,
            sphere_od_longe DECIMAL(5,2),
            cyl_od_longe DECIMAL(5,2),
            axis_od_longe INTEGER,
            sphere_od_perto DECIMAL(5,2),
            cyl_od_perto DECIMAL(5,2),
            axis_od_perto INTEGER,
            sphere_oe_longe DECIMAL(5,2),
            cyl_oe_longe DECIMAL(5,2),
            axis_oe_longe INTEGER,
            sphere_oe_perto DECIMAL(5,2),
            cyl_oe_perto DECIMAL(5,2),
            axis_oe_perto INTEGER,
            addition DECIMAL(5,2),
            dnp_od DECIMAL(5,2),
            dnp_oe DECIMAL(5,2),
            height_od DECIMAL(5,2),
            height_oe DECIMAL(5,2),
            image_url TEXT,
            observations TEXT,
            branch_id TEXT,
            user_id TEXT REFERENCES users(id),
            family_id TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            deleted_at TIMESTAMP
        )`
    ];
    
    try {
        for (const q of queries) { await pool.query(q); }

        const migrations = [
            `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS family_id TEXT`,
            `CREATE INDEX IF NOT EXISTS idx_audit_family ON audit_logs(family_id)`,
            `CREATE INDEX IF NOT EXISTS idx_users_family ON users(family_id)`,
            `CREATE INDEX IF NOT EXISTS idx_acc_family ON accounts(family_id)`,
            `CREATE INDEX IF NOT EXISTS idx_trans_family ON transactions(family_id)`,
            `CREATE INDEX IF NOT EXISTS idx_contacts_family ON contacts(family_id)`,
            // Garantir que logs órfãos recebam o family_id do usuário que os criou (retroatividade)
            `UPDATE audit_logs al SET family_id = u.family_id FROM users u WHERE al.user_id = u.id AND al.family_id IS NULL`
        ];

        for (const m of migrations) {
            try { await pool.query(m); } catch (e) {}
        }

        console.log("✅ [DATABASE] Multi-tenancy Isolation Hardened.");
    } catch (e) {
        console.error("❌ [DATABASE] Erro na inicialização:", e);
    }
};

export default pool;
