
import express from 'express';
import pool from '../db.js';
import crypto from 'crypto';
import { authenticateToken, updateAccountBalance, sanitizeValue } from '../middleware.js';

const router = express.Router();

export default function(logAudit) {
    router.get('/initial-data', authenticateToken, async (req, res) => {
        const userId = req.user.id;
        try {
            const userRes = await pool.query('SELECT family_id FROM users WHERE id = $1', [userId]);
            const activeFamilyId = userRes.rows[0]?.family_id || userId;

            const buildFilter = (alias = '') => {
                const prefix = alias ? `${alias}.` : '';
                return `(${prefix}family_id = $1 OR (${prefix}family_id IS NULL AND ${prefix}user_id = $1))`;
            };

            const accs = await pool.query(`SELECT * FROM accounts WHERE ${buildFilter()} AND deleted_at IS NULL`, [activeFamilyId]);
            
            const trans = await pool.query(`
                SELECT t.*, u.name as created_by_name 
                FROM transactions t 
                JOIN users u ON t.user_id = u.id 
                WHERE ${buildFilter('t')} AND t.deleted_at IS NULL 
                ORDER BY t.date DESC LIMIT 500
            `, [activeFamilyId]);

            const goals = await pool.query(`SELECT * FROM goals WHERE ${buildFilter()} AND deleted_at IS NULL`, [activeFamilyId]);
            const contacts = await pool.query(`SELECT * FROM contacts WHERE ${buildFilter()} AND deleted_at IS NULL`, [activeFamilyId]);
            let categories = await pool.query(`SELECT * FROM categories WHERE ${buildFilter()} AND deleted_at IS NULL`, [activeFamilyId]);
            
            const companyRes = await pool.query(`SELECT * FROM company_profiles WHERE user_id = $1`, [activeFamilyId]);
            
            const branches = await pool.query(`SELECT * FROM branches WHERE family_id = $1`, [activeFamilyId]);
            const costCenters = await pool.query(`SELECT * FROM cost_centers WHERE family_id = $1`, [activeFamilyId]);
            const departments = await pool.query(`SELECT * FROM departments WHERE family_id = $1`, [activeFamilyId]);
            const projects = await pool.query(`SELECT * FROM projects WHERE family_id = $1`, [activeFamilyId]);

            const srvItems = await pool.query(`SELECT * FROM module_services WHERE family_id = $1 AND deleted_at IS NULL`, [activeFamilyId]);

            const commOrders = await pool.query(`
                SELECT o.*, c.name as contact_name, u.name as created_by_name
                FROM commercial_orders o 
                LEFT JOIN contacts c ON o.contact_id = c.id 
                JOIN users u ON o.user_id = u.id
                WHERE ${buildFilter('o')} AND o.deleted_at IS NULL
            `, [activeFamilyId]);

            const serviceOrdersRes = await pool.query(`
                SELECT so.*, c.name as contact_name, u.name as created_by_name
                FROM service_orders so 
                LEFT JOIN contacts c ON so.contact_id = c.id 
                JOIN users u ON so.user_id = u.id
                WHERE ${buildFilter('so')} AND so.deleted_at IS NULL
            `, [activeFamilyId]);

            const contractsRes = await pool.query(`
                SELECT ct.*, c.name as contact_name, u.name as created_by_name
                FROM contracts ct 
                LEFT JOIN contacts c ON ct.contact_id = c.id 
                JOIN users u ON ct.user_id = u.id
                WHERE ${buildFilter('ct')} AND ct.deleted_at IS NULL
            `, [activeFamilyId]);

            const invoicesRes = await pool.query(`
                SELECT inv.*, c.name as contact_name 
                FROM invoices inv 
                LEFT JOIN contacts c ON inv.contact_id = c.id 
                WHERE ${buildFilter('inv')} AND inv.deleted_at IS NULL
            `, [activeFamilyId]);

            res.json({
                accounts: accs.rows.map(r => ({ ...r, balance: parseFloat(r.balance) })),
                transactions: trans.rows.map(r => ({ 
                    ...r, 
                    amount: parseFloat(r.amount), 
                    date: new Date(r.date).toISOString().split('T')[0],
                    createdByName: r.created_by_name 
                })),
                goals: goals.rows.map(r => ({ ...r, targetAmount: parseFloat(r.target_amount), currentAmount: parseFloat(r.current_amount) })),
                contacts: contacts.rows,
                categories: categories.rows,
                companyProfile: companyRes.rows[0] || null,
                branches: branches.rows,
                costCenters: costCenters.rows,
                departments: departments.rows,
                projects: projects.rows,
                serviceItems: srvItems.rows.map(r => ({
                    id: r.id,
                    name: r.name,
                    code: r.code,
                    type: r.type,
                    defaultPrice: parseFloat(r.default_price || 0),
                    costPrice: parseFloat(r.cost_price || 0),
                    unit: r.unit,
                    description: r.description,
                    moduleTag: r.module_tag,
                    imageUrl: r.image_url,
                    brand: r.brand
                })),
                serviceClients: [], 
                serviceAppointments: [],
                serviceOrders: serviceOrdersRes.rows.map(r => ({
                    ...r,
                    totalAmount: parseFloat(r.total_amount || 0),
                    contactName: r.contact_name,
                    createdByName: r.created_by_name,
                    startDate: r.start_date ? new Date(r.start_date).toISOString().split('T')[0] : null,
                    endDate: r.end_date ? new Date(r.end_date).toISOString().split('T')[0] : null
                })),
                commercialOrders: commOrders.rows.map(r => ({
                    id: r.id,
                    type: r.type,
                    description: r.description,
                    contactId: r.contact_id,
                    contactName: r.contact_name,
                    createdByName: r.created_by_name,
                    amount: parseFloat(r.amount || 0),
                    grossAmount: parseFloat(r.gross_amount || 0),
                    discountAmount: parseFloat(r.discount_amount || 0),
                    taxAmount: parseFloat(r.tax_amount || 0),
                    items: r.items || [],
                    date: new Date(r.date).toISOString().split('T')[0],
                    status: r.status,
                    transactionId: r.transaction_id
                })),
                contracts: contractsRes.rows.map(r => ({
                    ...r,
                    value: parseFloat(r.value || 0),
                    contactName: r.contact_name,
                    createdByName: r.created_by_name,
                    startDate: new Date(r.start_date).toISOString().split('T')[0],
                    endDate: r.end_date ? new Date(r.end_date).toISOString().split('T')[0] : null
                })),
                invoices: invoicesRes.rows.map(r => ({
                    ...r,
                    amount: parseFloat(r.amount || 0),
                    contactName: r.contact_name,
                    issueDate: new Date(r.issue_date).toISOString().split('T')[0]
                }))
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // --- TRANSACTIONS ---
    router.post('/transactions', authenticateToken, async (req, res) => {
        const t = req.body;
        const userId = req.user.id;
        const client = await pool.connect();
        try {
            const familyIdRes = await client.query('SELECT family_id FROM users WHERE id = $1', [userId]);
            const familyId = familyIdRes.rows[0]?.family_id || userId;
            
            await client.query('BEGIN');
            const id = t.id || crypto.randomUUID();

            const existingRes = await client.query('SELECT * FROM transactions WHERE id = $1', [id]);
            const isUpdate = existingRes.rows.length > 0;

            await client.query(
                `INSERT INTO transactions (id, description, amount, type, category, date, status, account_id, destination_account_id, contact_id, user_id, family_id, is_recurring, recurrence_frequency, recurrence_end_date)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                 ON CONFLICT (id) DO UPDATE SET description=$2, amount=$3, type=$4, category=$5, date=$6, status=$7, account_id=$8, destination_account_id=$9, contact_id=$10, family_id=$12`,
                [id, t.description, t.amount, t.type, t.category, t.date, t.status, t.accountId, t.destinationAccountId, t.contactId, userId, familyId, t.isRecurring, t.recurrenceFrequency, t.recurrenceEndDate]
            );

            if (t.status === 'PAID') {
                await updateAccountBalance(client, t.accountId, t.amount, t.type);
                if (t.type === 'TRANSFER' && t.destinationAccountId) {
                    await updateAccountBalance(client, t.destinationAccountId, t.amount, 'INCOME');
                }
            }
            
            await client.query('COMMIT');
            await logAudit(pool, userId, isUpdate ? 'UPDATE' : 'CREATE', 'transaction', id, t.description);
            res.json({ success: true, id });
        } catch (err) {
            await client.query('ROLLBACK');
            res.status(500).json({ error: err.message });
        } finally {
            client.release();
        }
    });

    router.delete('/transactions/:id', authenticateToken, async (req, res) => {
        try {
            const familyIdRes = await pool.query('SELECT family_id FROM users WHERE id = $1', [req.user.id]);
            const familyId = familyIdRes.rows[0]?.family_id;
            await pool.query(`UPDATE transactions SET deleted_at = NOW() WHERE id = $1 AND family_id = $2`, [req.params.id, familyId]);
            await logAudit(pool, req.user.id, 'DELETE', 'transaction', req.params.id, 'Transação removida');
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // --- ACCOUNTS ---
    router.post('/accounts', authenticateToken, async (req, res) => {
        const a = req.body;
        const userId = req.user.id;
        try {
            const familyIdRes = await pool.query('SELECT family_id FROM users WHERE id = $1', [userId]);
            const familyId = familyIdRes.rows[0]?.family_id || userId;
            const id = a.id || crypto.randomUUID();
            const existingRes = await pool.query('SELECT id FROM accounts WHERE id = $1', [id]);
            const isUpdate = existingRes.rows.length > 0;

            await pool.query(
                `INSERT INTO accounts (id, name, type, balance, credit_limit, closing_day, due_day, user_id, family_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 ON CONFLICT (id) DO UPDATE SET name=$2, type=$3, balance=$4, credit_limit=$5, closing_day=$6, due_day=$7`,
                [id, a.name, a.type, a.balance, a.creditLimit, a.closingDay, a.dueDay, userId, familyId]
            );
            await logAudit(pool, userId, isUpdate ? 'UPDATE' : 'CREATE', 'account', id, a.name);
            res.json({ success: true, id });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.delete('/accounts/:id', authenticateToken, async (req, res) => {
        try {
            await pool.query(`UPDATE accounts SET deleted_at = NOW() WHERE id = $1 AND family_id = (SELECT family_id FROM users WHERE id = $2)`, [req.params.id, req.user.id]);
            await logAudit(pool, req.user.id, 'DELETE', 'account', req.params.id, 'Conta removida');
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // --- CONTACTS ---
    router.post('/contacts', authenticateToken, async (req, res) => {
        const c = req.body;
        const userId = req.user.id;
        try {
            const familyIdRes = await pool.query('SELECT family_id FROM users WHERE id = $1', [userId]);
            const familyId = familyIdRes.rows[0]?.family_id || userId;
            const id = c.id || crypto.randomUUID();
            const existingRes = await pool.query('SELECT id FROM contacts WHERE id = $1', [id]);
            const isUpdate = existingRes.rows.length > 0;

            await pool.query(
                `INSERT INTO contacts (id, name, fantasy_name, type, email, phone, document, ie, im, pix_key, zip_code, street, number, neighborhood, city, state, is_defaulter, is_blocked, credit_limit, default_payment_method, default_payment_term, user_id, family_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
                 ON CONFLICT (id) DO UPDATE SET name=$2, fantasy_name=$3, type=$4, email=$5, phone=$6, document=$7, ie=$8, im=$9, pix_key=$10, zip_code=$11, street=$12, number=$13, neighborhood=$14, city=$15, state=$16, is_defaulter=$17, is_blocked=$18, credit_limit=$19, default_payment_method=$20, default_payment_term=$21, deleted_at=NULL`,
                [id, c.name, c.fantasyName, c.type, c.email, c.phone, c.document, c.ie, c.im, c.pixKey, c.zipCode, c.street, c.number, c.neighborhood, c.city, c.state, c.isDefaulter, c.isBlocked, c.creditLimit, c.defaultPaymentMethod, c.defaultPaymentTerm, userId, familyId]
            );
            await logAudit(pool, userId, isUpdate ? 'UPDATE' : 'CREATE', 'contact', id, c.name);
            res.json({ success: true, id });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.delete('/contacts/:id', authenticateToken, async (req, res) => {
        try {
            await pool.query(`UPDATE contacts SET deleted_at = NOW() WHERE id = $1 AND family_id = (SELECT family_id FROM users WHERE id = $2)`, [req.params.id, req.user.id]);
            await logAudit(pool, req.user.id, 'DELETE', 'contact', req.params.id, 'Contato removido');
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // --- CATEGORIES ---
    router.post('/categories', authenticateToken, async (req, res) => {
        const c = req.body;
        const userId = req.user.id;
        try {
            const familyIdRes = await pool.query('SELECT family_id FROM users WHERE id = $1', [userId]);
            const familyId = familyIdRes.rows[0]?.family_id || userId;
            const id = c.id || crypto.randomUUID();
            const existingRes = await pool.query('SELECT id FROM categories WHERE id = $1', [id]);
            const isUpdate = existingRes.rows.length > 0;

            await pool.query(
                `INSERT INTO categories (id, name, type, user_id, family_id)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (id) DO UPDATE SET name=$2, type=$3, deleted_at=NULL`,
                [id, c.name, c.type, userId, familyId]
            );
            await logAudit(pool, userId, isUpdate ? 'UPDATE' : 'CREATE', 'category', id, c.name);
            res.json({ success: true, id });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.delete('/categories/:id', authenticateToken, async (req, res) => {
        try {
            await pool.query(`UPDATE categories SET deleted_at = NOW() WHERE id = $1 AND family_id = (SELECT family_id FROM users WHERE id = $2)`, [req.params.id, req.user.id]);
            await logAudit(pool, req.user.id, 'DELETE', 'category', req.params.id, 'Categoria removida');
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // --- GOALS ---
    router.post('/goals', authenticateToken, async (req, res) => {
        const g = req.body;
        const userId = req.user.id;
        try {
            const familyIdRes = await pool.query('SELECT family_id FROM users WHERE id = $1', [userId]);
            const familyId = familyIdRes.rows[0]?.family_id || userId;
            const id = g.id || crypto.randomUUID();
            const existingRes = await pool.query('SELECT id FROM goals WHERE id = $1', [id]);
            const isUpdate = existingRes.rows.length > 0;

            await pool.query(
                `INSERT INTO goals (id, name, target_amount, current_amount, deadline, user_id, family_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (id) DO UPDATE SET name=$2, target_amount=$3, current_amount=$4, deadline=$5`,
                [id, g.name, g.targetAmount, g.currentAmount, sanitizeValue(g.deadline), userId, familyId]
            );
            await logAudit(pool, userId, isUpdate ? 'UPDATE' : 'CREATE', 'goal', id, g.name);
            res.json({ success: true, id });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.delete('/goals/:id', authenticateToken, async (req, res) => {
        try {
            await pool.query(`UPDATE goals SET deleted_at = NOW() WHERE id = $1 AND family_id = (SELECT family_id FROM users WHERE id = $2)`, [req.params.id, req.user.id]);
            await logAudit(pool, req.user.id, 'DELETE', 'goal', req.params.id, 'Meta removida');
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    return router;
}
