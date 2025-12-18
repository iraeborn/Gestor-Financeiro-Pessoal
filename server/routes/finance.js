
import express from 'express';
import pool from '../db.js';
import crypto from 'crypto';
import { authenticateToken, updateAccountBalance } from '../middleware.js';

const router = express.Router();

export default function(logAudit) {
    router.get('/initial-data', authenticateToken, async (req, res) => {
        const userId = req.user.id;
        try {
            const userRes = await pool.query('SELECT family_id FROM users WHERE id = $1', [userId]);
            const activeFamilyId = userRes.rows[0]?.family_id || userId;

            // Filtro inteligente: Busca pelo activeFamilyId OU pelo próprio userId caso o family_id ainda esteja nulo (resiliência)
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

            const serviceOrders = await pool.query(`
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
                serviceOrders: serviceOrders.rows.map(r => ({
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

    router.post('/transactions', authenticateToken, async (req, res) => {
        const t = req.body;
        const userId = req.user.id;
        const client = await pool.connect();
        try {
            const familyIdRes = await client.query('SELECT family_id FROM users WHERE id = $1', [userId]);
            const familyId = familyIdRes.rows[0]?.family_id || userId;
            
            await client.query('BEGIN');
            const id = t.id || crypto.randomUUID();

            if (t.id) {
                const check = await client.query('SELECT family_id FROM transactions WHERE id=$1', [t.id]);
                if (check.rows.length > 0 && check.rows[0].family_id !== familyId) {
                    throw new Error("Transação não pertence a este ambiente.");
                }
            }

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
            res.json({ success: true, id });
        } catch (err) {
            await client.query('ROLLBACK');
            res.status(500).json({ error: err.message });
        } finally {
            client.release();
        }
    });

    return router;
}
