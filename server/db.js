
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
    connectionTimeoutMillis: 10000, // Aumentado para 10s para evitar 503 por timeout de conexão
  };
}

const pool = new Pool(poolConfig);

export const initDb = async () => {
    const queries = [
        `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT, email TEXT UNIQUE, password_hash TEXT, google_id TEXT, family_id TEXT, created_at TIMESTAMP DEFAULT NOW(), settings JSONB, role TEXT, entity_type TEXT, plan TEXT, status TEXT, trial_ends_at TIMESTAMP, stripe_customer_id TEXT, stripe_subscription_id TEXT)`,
        `CREATE TABLE IF NOT EXISTS memberships (user_id TEXT REFERENCES users(id), family_id TEXT, role TEXT DEFAULT 'MEMBER', permissions TEXT, PRIMARY KEY (user_id, family_id))`,
        `CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, name TEXT, type TEXT, balance DECIMAL(15,2), user_id TEXT, family_id TEXT, created_at TIMESTAMP DEFAULT NOW(), deleted_at TIMESTAMP, credit_limit DECIMAL(15,2), closing_day INTEGER, due_day INTEGER)`,
        `CREATE TABLE IF NOT EXISTS contacts (
            id TEXT PRIMARY KEY, name TEXT, fantasy_name TEXT, type TEXT, email TEXT, phone TEXT, document TEXT, ie TEXT, im TEXT, pix_key TEXT, zip_code TEXT, street TEXT, number TEXT, neighborhood TEXT, city TEXT, state TEXT, 
            is_defaulter BOOLEAN DEFAULT FALSE, 
            is_blocked BOOLEAN DEFAULT FALSE, 
            credit_limit DECIMAL(15,2) DEFAULT 0, 
            default_payment_method TEXT, 
            default_payment_term INTEGER, 
            optical_notes TEXT,
            brand_preference TEXT,
            last_consultation_date DATE,
            years_of_use INTEGER,
            optical_category TEXT,
            user_id TEXT, family_id TEXT, created_at TIMESTAMP DEFAULT NOW(), deleted_at TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, name TEXT, type TEXT, user_id TEXT, family_id TEXT, created_at TIMESTAMP DEFAULT NOW(), deleted_at TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY, description TEXT, amount DECIMAL(15,2), type TEXT, category TEXT, date DATE, status TEXT, account_id TEXT, destination_account_id TEXT, contact_id TEXT, user_id TEXT, family_id TEXT, is_recurring BOOLEAN, recurrence_frequency TEXT, recurrence_end_date DATE, interest_rate DECIMAL(10,2), created_at TIMESTAMP DEFAULT NOW(), deleted_at TIMESTAMP, goal_id TEXT, receipt_url TEXT, receipt_urls JSONB DEFAULT '[]', branch_id TEXT, cost_center_id TEXT, department_id TEXT, project_id TEXT, classification TEXT)`,
        `CREATE TABLE IF NOT EXISTS goals (id TEXT PRIMARY KEY, name TEXT, target_amount DECIMAL(15,2), current_amount DECIMAL(15,2), deadline DATE, user_id TEXT, family_id TEXT, created_at TIMESTAMP DEFAULT NOW(), deleted_at TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS company_profiles (id TEXT PRIMARY KEY, trade_name TEXT, legal_name TEXT, cnpj TEXT, tax_regime TEXT, cnae TEXT, city TEXT, state TEXT, has_employees BOOLEAN, issues_invoices BOOLEAN, user_id TEXT, family_id TEXT, zip_code TEXT, street TEXT, number TEXT, neighborhood TEXT, phone TEXT, email TEXT, secondary_cnaes TEXT)`,
        `CREATE TABLE IF NOT EXISTS branches (id TEXT PRIMARY KEY, name TEXT, code TEXT, city TEXT, phone TEXT, color TEXT, is_active BOOLEAN DEFAULT TRUE, family_id TEXT, deleted_at TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS salespeople (
            id TEXT PRIMARY KEY,
            user_id TEXT REFERENCES users(id),
            family_id TEXT,
            branch_id TEXT REFERENCES branches(id),
            commission_rate DECIMAL(5,2) DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW(),
            deleted_at TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS salesperson_schedules (
            id TEXT PRIMARY KEY,
            salesperson_id TEXT REFERENCES salespeople(id),
            branch_id TEXT REFERENCES branches(id),
            date DATE NOT NULL,
            shift TEXT DEFAULT 'FULL',
            notes TEXT,
            user_id TEXT REFERENCES users(id),
            family_id TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            deleted_at TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT PRIMARY KEY,
            sender_id TEXT REFERENCES users(id),
            sender_name TEXT,
            receiver_id TEXT,
            family_id TEXT,
            content TEXT,
            type TEXT DEFAULT 'TEXT',
            attachment_url TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            is_read BOOLEAN DEFAULT FALSE
        )`,
        `CREATE TABLE IF NOT EXISTS service_orders (
            id TEXT PRIMARY KEY,
            number SERIAL,
            title TEXT NOT NULL,
            description TEXT,
            contact_id TEXT REFERENCES contacts(id),
            status TEXT NOT NULL,
            total_amount DECIMAL(15,2) DEFAULT 0,
            start_date DATE,
            end_date DATE,
            items TEXT,
            type TEXT,
            origin TEXT,
            priority TEXT,
            opened_at TIMESTAMP,
            user_id TEXT REFERENCES users(id),
            family_id TEXT,
            module_tag TEXT,
            assignee_id TEXT,
            rx_id TEXT,
            branch_id TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            deleted_at TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS commercial_orders (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            description TEXT NOT NULL,
            contact_id TEXT REFERENCES contacts(id),
            amount DECIMAL(15,2) NOT NULL,
            date DATE NOT NULL,
            status TEXT NOT NULL,
            transaction_id TEXT,
            gross_amount DECIMAL(15,2) DEFAULT 0,
            discount_amount DECIMAL(15,2) DEFAULT 0,
            tax_amount DECIMAL(15,2) DEFAULT 0,
            items TEXT,
            user_id TEXT REFERENCES users(id),
            family_id TEXT,
            module_tag TEXT,
            rx_id TEXT,
            branch_id TEXT,
            assignee_id TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            deleted_at TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS optical_rxs (
            id TEXT PRIMARY KEY,
            contact_id TEXT REFERENCES contacts(id),
            professional_name TEXT,
            rx_date DATE NOT NULL,
            expiration_date DATE,
            sphere_od_longe DECIMAL(5,2),
            cyl_od_longe DECIMAL(5,2),
            axis_od_longe INTEGER,
            addition DECIMAL(5,2),
            observations TEXT,
            branch_id TEXT,
            user_id TEXT REFERENCES users(id),
            family_id TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            deleted_at TIMESTAMP,
            sphere_od_perto DECIMAL(5,2),
            cyl_od_perto DECIMAL(5,2),
            axis_od_perto INTEGER,
            sphere_oe_longe DECIMAL(5,2),
            cyl_oe_longe DECIMAL(5,2),
            axis_oe_longe INTEGER,
            sphere_oe_perto DECIMAL(5,2),
            cyl_oe_perto DECIMAL(5,2),
            axis_oe_perto INTEGER,
            dnp_od DECIMAL(5,2),
            dnp_oe DECIMAL(5,2),
            height_od DECIMAL(5,2),
            height_oe DECIMAL(5,2),
            image_url TEXT,
            laboratory_id TEXT,
            lab_status TEXT,
            lab_sent_date DATE,
            lab_return_date DATE
        )`,
        `CREATE TABLE IF NOT EXISTS laboratories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            contact_person TEXT,
            email TEXT,
            phone TEXT,
            address TEXT,
            notes TEXT,
            user_id TEXT REFERENCES users(id),
            family_id TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            deleted_at TIMESTAMP
        )`
    ];
    
    try {
        for (const q of queries) { await pool.query(q); }
        console.log("✅ [DATABASE] Tabelas de evolução preparadas.");
    } catch (e) {
        console.error("❌ [DATABASE] Erro na preparação:", e);
    }
};

export default pool;
