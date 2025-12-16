
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
        // Core Tables (Ensure minimum existence)
        `CREATE TABLE IF NOT EXISTS service_orders (id TEXT PRIMARY KEY, number SERIAL, title TEXT, description TEXT, contact_id TEXT, status TEXT, total_amount DECIMAL, start_date DATE, end_date DATE, user_id TEXT, family_id TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, deleted_at TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS contracts (id TEXT PRIMARY KEY, title TEXT, contact_id TEXT, value DECIMAL, start_date DATE, end_date DATE, status TEXT, billing_day INTEGER, user_id TEXT, family_id TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, deleted_at TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS commercial_orders (id TEXT PRIMARY KEY, type TEXT, description TEXT, contact_id TEXT, amount DECIMAL, date DATE, status TEXT, transaction_id TEXT, user_id TEXT, family_id TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, deleted_at TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS invoices (id TEXT PRIMARY KEY, number TEXT, series TEXT, type TEXT, amount DECIMAL, issue_date DATE, status TEXT, contact_id TEXT, file_url TEXT, user_id TEXT, family_id TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, deleted_at TIMESTAMP)`,
        // Ensure Membership Table
        `CREATE TABLE IF NOT EXISTS memberships (user_id TEXT REFERENCES users(id), family_id TEXT, role TEXT DEFAULT 'MEMBER', permissions TEXT, PRIMARY KEY (user_id, family_id))`
    ];
    
    try {
        for (const q of queries) {
            await pool.query(q);
        }
        console.log("Database tables initialized.");
    } catch (e) {
        console.error("Error initializing database tables:", e);
    }
};

export default pool;
