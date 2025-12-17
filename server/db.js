
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
        `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT, email TEXT UNIQUE, password_hash TEXT, google_id TEXT, family_id TEXT, created_at TIMESTAMP DEFAULT NOW(), settings JSONB)`,
        `CREATE TABLE IF NOT EXISTS memberships (user_id TEXT REFERENCES users(id), family_id TEXT, role TEXT DEFAULT 'MEMBER', permissions TEXT, PRIMARY KEY (user_id, family_id))`,
        `CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, name TEXT, type TEXT, balance DECIMAL, user_id TEXT, family_id TEXT, created_at TIMESTAMP DEFAULT NOW(), deleted_at TIMESTAMP)`,
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
            description TEXT,
            image_url TEXT,
            brand TEXT,
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
            total_amount DECIMAL(15,2), 
            start_date DATE, 
            end_date DATE, 
            user_id TEXT, 
            family_id TEXT, 
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
        console.log("✅ [DATABASE] Estrutura comercial verificada.");
    } catch (e) {
        console.error("❌ [DATABASE] Erro na inicialização:", e);
    }
};

export default pool;
