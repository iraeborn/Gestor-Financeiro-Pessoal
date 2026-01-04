
import express from 'express';
import pool from '../db.js';
import crypto from 'crypto';
import multer from 'multer';
import { authenticateToken, updateAccountBalance, sanitizeValue } from '../middleware.js';
import { uploadFiles } from '../services/storage.js';

const router = express.Router();
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } 
});

const numericFields = [
    'balance', 'amount', 'target_amount', 'current_amount', 
    'total_amount', 'gross_amount', 'discount_amount', 'tax_amount',
    'value', 'unit_price', 'total_price', 'cost_price', 'credit_limit',
    'interest_rate'
];

const mapToFrontend = (row) => {
    if (!row) return row;
    const newRow = {};
    for (const key in row) {
        const camelKey = key.replace(/([-_][a-z])/ig, ($1) => $1.toUpperCase().replace('-', '').replace('_', ''));
        let value = row[key];
        if (numericFields.includes(key)) value = value === null ? 0 : Number(value);
        if (value instanceof Date) value = value.toISOString().split('T')[0];
        newRow[camelKey] = value;
    }
    return newRow;
};

export default function(logAudit) {

    const getFamilyId = async (userId) => {
        const res = await pool.query('SELECT family_id FROM users WHERE id = $1', [userId]);
        return res.rows[0]?.family_id || userId;
    };

    router.post('/sync/process', authenticateToken, async (req, res) => {
        const { action, store, payload } = req.body;
        const userId = req.user.id;
        const client = await pool.connect();
        
        try {
            const familyId = await getFamilyId(userId);
            await client.query('BEGIN');

            const tableMap = {
                'accounts': 'accounts', 'transactions': 'transactions', 'goals': 'goals',
                'contacts': 'contacts', 'categories': 'categories', 'branches': 'branches',
                'costCenters': 'cost_centers', 'departments': 'departments', 'projects': 'projects',
                'serviceClients': 'service_clients', 'serviceItems': 'module_services',
                'serviceAppointments': 'service_appointments', 'serviceOrders': 'service_orders',
                'commercialOrders': 'commercial_orders', 'contracts': 'contracts', 'invoices': 'invoices',
                'opticalRxs': 'optical_rxs'
            };

            const tableName = tableMap[store];
            if (!tableName) throw new Error(`Loja ${store} não suportada.`);

            // SEGURANÇA MULTI-TENANT: Verifica se o ID pertence à mesma família antes de qualquer alteração
            if (payload.id) {
                const ownership = await client.query(`SELECT family_id FROM ${tableName} WHERE id = $1`, [payload.id]);
                if (ownership.rows.length > 0 && ownership.rows[0].family_id !== familyId) {
                    throw new Error("Acesso negado: Tentativa de modificação cross-tenant detectada.");
                }
            }

            if (action === 'DELETE') {
                await client.query(`UPDATE ${tableName} SET deleted_at = NOW() WHERE id = $1 AND family_id = $2`, [payload.id, familyId]);
                if (store === 'transactions') {
                    const tRes = await client.query('SELECT * FROM transactions WHERE id = $1 AND family_id = $2', [payload.id, familyId]);
                    const t = tRes.rows[0];
                    if (t && t.status === 'PAID') {
                        await updateAccountBalance(client, t.account_id, t.amount, t.type, true);
                        if (t.type === 'TRANSFER' && t.destination_account_id) await updateAccountBalance(client, t.destination_account_id, t.amount, 'INCOME', true);
                    }
                }
            } else if (action === 'SAVE') {
                if (store === 'transactions') {
                    const id = payload.id;
                    const existingRes = await client.query('SELECT * FROM transactions WHERE id = $1 AND family_id = $2', [id, familyId]);
                    const oldT = existingRes.rows[0];

                    if (oldT && oldT.status === 'PAID') {
                        await updateAccountBalance(client, oldT.account_id, oldT.amount, oldT.type, true);
                        if (oldT.type === 'TRANSFER' && oldT.destination_account_id) await updateAccountBalance(client, oldT.destination_account_id, oldT.amount, 'INCOME', true);
                    }

                    await client.query(
                        `INSERT INTO transactions (id, description, amount, type, category, date, status, account_id, destination_account_id, contact_id, goal_id, user_id, family_id, is_recurring, recurrence_frequency, recurrence_end_date, receipt_urls, branch_id)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
                         ON CONFLICT (id) DO UPDATE SET 
                            description=$2, amount=$3, type=$4, category=$5, date=$6, status=$7, 
                            account_id=$8, destination_account_id=$9, contact_id=$10, goal_id=$11, 
                            family_id=$13, is_recurring=$14, recurrence_frequency=$15, recurrence_end_date=$16, receipt_urls=$17, branch_id=$18, deleted_at=NULL`,
                        [id, payload.description, payload.amount, payload.type, payload.category, payload.date, payload.status, payload.accountId, sanitizeValue(payload.destinationAccountId), sanitizeValue(payload.contactId), sanitizeValue(payload.goalId), userId, familyId, payload.isRecurring || false, sanitizeValue(payload.recurrenceFrequency), sanitizeValue(payload.recurrenceEndDate), JSON.stringify(payload.receiptUrls || []), sanitizeValue(payload.branchId)]
                    );

                    if (payload.status === 'PAID') {
                        await updateAccountBalance(client, payload.accountId, payload.amount, payload.type);
                        if (payload.type === 'TRANSFER' && payload.destinationAccountId) await updateAccountBalance(client, payload.destinationAccountId, payload.amount, 'INCOME');
                    }
                } else if (store === 'accounts') {
                    await client.query(
                        `INSERT INTO accounts (id, name, type, balance, credit_limit, closing_day, due_day, user_id, family_id)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                         ON CONFLICT (id) DO UPDATE SET name=$2, type=$3, balance=$4, credit_limit=$5, closing_day=$6, due_day=$7, deleted_at=NULL`,
                        [payload.id, payload.name, payload.type, payload.balance, payload.creditLimit, payload.closingDay, payload.dueDay, userId, familyId]
                    );
                } else {
                    const fields = Object.keys(payload).filter(k => k !== 'id' && !k.startsWith('_'));
                    const snakeFields = fields.map(f => f.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`));
                    const query = `INSERT INTO ${tableName} (id, family_id, ${snakeFields.join(', ')}) VALUES ($1, $2, ${fields.map((_, i) => `$${i + 3}`).join(', ')}) ON CONFLICT (id) DO UPDATE SET ${snakeFields.map((f, i) => `${f} = $${i + 3}`).join(', ')}, deleted_at = NULL`;
                    const values = [payload.id, familyId, ...fields.map(f => (typeof payload[f] === 'object' && payload[f] !== null) ? JSON.stringify(payload[f]) : sanitizeValue(payload[f]))];
                    await client.query(query, values);
                }
            }

            await client.query('COMMIT');
            res.json({ success: true });
        } catch (err) {
            await client.query('ROLLBACK');
            res.status(500).json({ error: err.message });
        } finally {
            client.release();
        }
    });

    router.get('/initial-data', authenticateToken, async (req, res) => {
        try {
            const familyId = await getFamilyId(req.user.id);
            const queryDefs = {
                accounts: ['SELECT *, family_id FROM accounts WHERE family_id = $1 AND deleted_at IS NULL', [familyId]],
                transactions: ['SELECT t.*, u.name as created_by_name FROM transactions t JOIN users u ON t.user_id = u.id WHERE t.family_id = $1 AND t.deleted_at IS NULL ORDER BY t.date DESC', [familyId]],
                goals: ['SELECT *, family_id FROM goals WHERE family_id = $1 AND deleted_at IS NULL', [familyId]],
                contacts: ['SELECT *, family_id FROM contacts WHERE family_id = $1 AND deleted_at IS NULL', [familyId]],
                categories: ['SELECT *, family_id FROM categories WHERE family_id = $1 AND deleted_at IS NULL', [familyId]],
                companyProfile: ['SELECT *, family_id FROM company_profiles WHERE family_id = $1', [familyId]],
                branches: ['SELECT *, family_id FROM branches WHERE family_id = $1 AND deleted_at IS NULL', [familyId]],
                costCenters: ['SELECT *, family_id FROM cost_centers WHERE family_id = $1 AND deleted_at IS NULL', [familyId]],
                departments: ['SELECT *, family_id FROM departments WHERE family_id = $1 AND deleted_at IS NULL', [familyId]],
                projects: ['SELECT *, family_id FROM projects WHERE family_id = $1 AND deleted_at IS NULL', [familyId]],
                serviceClients: ['SELECT *, family_id FROM service_clients WHERE family_id = $1 AND deleted_at IS NULL', [familyId]],
                serviceItems: ['SELECT *, family_id FROM module_services WHERE family_id = $1 AND deleted_at IS NULL', [familyId]],
                serviceAppointments: ['SELECT sa.*, sc.contact_name as client_name, ms.name as service_name FROM service_appointments sa LEFT JOIN service_clients sc ON sa.client_id = sc.id LEFT JOIN module_services ms ON sa.service_id = ms.id WHERE sa.family_id = $1 AND sa.deleted_at IS NULL', [familyId]],
                serviceOrders: ['SELECT *, family_id FROM service_orders WHERE family_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC', [familyId]],
                commercialOrders: ['SELECT o.*, c.name as contact_name FROM commercial_orders o LEFT JOIN contacts c ON o.contact_id = c.id WHERE o.family_id = $1 AND o.deleted_at IS NULL ORDER BY o.date DESC', [familyId]],
                contracts: ['SELECT ct.*, c.name as contact_name FROM contracts ct LEFT JOIN contacts c ON ct.contact_id = c.id WHERE ct.family_id = $1 AND ct.deleted_at IS NULL', [familyId]],
                invoices: ['SELECT i.*, c.name as contact_name FROM invoices i LEFT JOIN contacts c ON i.contact_id = c.id WHERE i.family_id = $1 AND i.deleted_at IS NULL ORDER BY i.issue_date DESC', [familyId]],
                opticalRxs: ['SELECT *, family_id FROM optical_rxs WHERE family_id = $1 AND deleted_at IS NULL', [familyId]]
            };

            const results = {};
            for (const key of Object.keys(queryDefs)) {
                const resDb = await pool.query(queryDefs[key][0], queryDefs[key][1]);
                results[key] = key === 'companyProfile' ? mapToFrontend(resDb.rows[0]) : resDb.rows.map(r => mapToFrontend(r));
            }
            res.json(results);
        } catch (err) {
            res.status(500).json({ error: "Falha ao puxar dados isolados: " + err.message });
        }
    });

    return router;
}
