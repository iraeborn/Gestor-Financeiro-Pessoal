
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

// Campos que devem ser tratados como números
const numericFields = [
    'balance', 'amount', 'target_amount', 'current_amount', 
    'total_amount', 'gross_amount', 'discount_amount', 'tax_amount',
    'value', 'unit_price', 'total_price', 'cost_price', 'credit_limit',
    'interest_rate'
];

/**
 * Converte um objeto com chaves snake_case para camelCase
 * e garante que campos decimais sejam números.
 */
const mapToFrontend = (row) => {
    if (!row) return row;
    const newRow = {};
    
    for (const key in row) {
        // Converte snake_case para camelCase
        const camelKey = key.replace(/([-_][a-z])/ig, ($1) => {
            return $1.toUpperCase().replace('-', '').replace('_', '');
        });

        let value = row[key];

        // Trata campos numéricos (DECIMAL no PG vem como string)
        if (numericFields.includes(key)) {
            value = value === null ? 0 : Number(value);
        }

        // Trata datas para string limpa YYYY-MM-DD se necessário
        if (value instanceof Date) {
            value = value.toISOString().split('T')[0];
        }

        newRow[camelKey] = value;
    }
    return newRow;
};

export default function(logAudit) {

    const getFamilyId = async (userId) => {
        const res = await pool.query('SELECT family_id FROM users WHERE id = $1', [userId]);
        return res.rows[0]?.family_id || userId;
    };

    router.get('/initial-data', authenticateToken, async (req, res) => {
        console.log(`[API] Carregando initial-data para o usuário ${req.user.id}`);
        try {
            const familyId = await getFamilyId(req.user.id);
            
            const queryDefs = {
                accounts: ['SELECT * FROM accounts WHERE family_id = $1 AND deleted_at IS NULL', [familyId]],
                transactions: ['SELECT t.*, u.name as created_by_name FROM transactions t JOIN users u ON t.user_id = u.id WHERE t.family_id = $1 AND t.deleted_at IS NULL ORDER BY t.date DESC', [familyId]],
                goals: ['SELECT * FROM goals WHERE family_id = $1 AND deleted_at IS NULL', [familyId]],
                contacts: ['SELECT * FROM contacts WHERE family_id = $1 AND deleted_at IS NULL', [familyId]],
                categories: ['SELECT * FROM categories WHERE family_id = $1 AND deleted_at IS NULL', [familyId]],
                companyProfile: ['SELECT * FROM company_profiles WHERE family_id = $1', [familyId]],
                branches: ['SELECT * FROM branches WHERE family_id = $1 AND deleted_at IS NULL', [familyId]],
                costCenters: ['SELECT * FROM cost_centers WHERE family_id = $1 AND deleted_at IS NULL', [familyId]],
                departments: ['SELECT * FROM departments WHERE family_id = $1 AND deleted_at IS NULL', [familyId]],
                projects: ['SELECT * FROM projects WHERE family_id = $1 AND deleted_at IS NULL', [familyId]],
                serviceClients: ['SELECT * FROM service_clients WHERE family_id = $1 AND deleted_at IS NULL', [familyId]],
                serviceItems: ['SELECT * FROM module_services WHERE family_id = $1 AND deleted_at IS NULL', [familyId]],
                serviceAppointments: ['SELECT sa.*, sc.contact_name as client_name, ms.name as service_name FROM service_appointments sa LEFT JOIN service_clients sc ON sa.client_id = sc.id LEFT JOIN module_services ms ON sa.service_id = ms.id WHERE sa.family_id = $1 AND sa.deleted_at IS NULL', [familyId]],
                serviceOrders: ['SELECT * FROM service_orders WHERE family_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC', [familyId]],
                commercialOrders: ['SELECT o.*, c.name as contact_name FROM commercial_orders o LEFT JOIN contacts c ON o.contact_id = c.id WHERE o.family_id = $1 AND o.deleted_at IS NULL ORDER BY o.date DESC', [familyId]],
                contracts: ['SELECT ct.*, c.name as contact_name FROM contracts ct LEFT JOIN contacts c ON ct.contact_id = c.id WHERE ct.family_id = $1 AND ct.deleted_at IS NULL', [familyId]],
                invoices: ['SELECT i.*, c.name as contact_name FROM invoices i LEFT JOIN contacts c ON i.contact_id = c.id WHERE i.family_id = $1 AND i.deleted_at IS NULL ORDER BY i.issue_date DESC', [familyId]]
            };

            const results = {};
            const keys = Object.keys(queryDefs);
            
            const promises = keys.map(key => pool.query(queryDefs[key][0], queryDefs[key][1]));
            const settledResults = await Promise.all(promises);

            settledResults.forEach((result, idx) => {
                const key = keys[idx];
                if (key === 'companyProfile') {
                    results[key] = mapToFrontend(result.rows[0]) || null;
                } else {
                    results[key] = result.rows.map(r => mapToFrontend(r));
                }
            });

            console.log(`[API] Initial-data mapeado e enviado com sucesso.`);
            res.json(results);
        } catch (err) {
            console.error("❌ [API ERROR] Erro fatal em initial-data:", err);
            res.status(500).json({ error: "Erro de sincronização: " + err.message });
        }
    });
    
    router.post('/transactions', authenticateToken, async (req, res) => {
        const t = req.body;
        const userId = req.user.id;
        const client = await pool.connect();
        try {
            const familyId = await getFamilyId(userId);
            await client.query('BEGIN');
            const id = t.id || crypto.randomUUID();
            const existingRes = await client.query('SELECT * FROM transactions WHERE id = $1', [id]);
            const isUpdate = existingRes.rows.length > 0;

            await client.query(
                `INSERT INTO transactions (id, description, amount, type, category, date, status, account_id, destination_account_id, contact_id, goal_id, user_id, family_id, is_recurring, recurrence_frequency, recurrence_end_date, receipt_urls)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                 ON CONFLICT (id) DO UPDATE SET 
                    description=$2, amount=$3, type=$4, category=$5, date=$6, status=$7, 
                    account_id=$8, destination_account_id=$9, contact_id=$10, goal_id=$11, 
                    family_id=$13, is_recurring=$14, recurrence_frequency=$15, recurrence_end_date=$16, receipt_urls=$17`,
                [
                    id, t.description, t.amount, t.type, t.category, t.date, t.status, 
                    t.accountId, sanitizeValue(t.destinationAccountId), sanitizeValue(t.contactId), 
                    sanitizeValue(t.goalId), userId, familyId, t.isRecurring || false,
                    sanitizeValue(t.recurrenceFrequency), sanitizeValue(t.recurrenceEndDate),
                    JSON.stringify(t.receiptUrls || [])
                ]
            );

            if (t.status === 'PAID') {
                await updateAccountBalance(client, t.accountId, t.amount, t.type);
                if (t.type === 'TRANSFER' && t.destinationAccountId) await updateAccountBalance(client, t.destinationAccountId, t.amount, 'INCOME');
            }
            
            await client.query('COMMIT');
            await logAudit(pool, userId, isUpdate ? 'UPDATE' : 'CREATE', 'transaction', id, t.description);
            res.json({ success: true, id });
        } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); } finally { client.release(); }
    });

    router.delete('/transactions/:id', authenticateToken, async (req, res) => {
        const userId = req.user.id;
        const client = await pool.connect();
        try {
            const familyId = await getFamilyId(userId);
            await client.query('BEGIN');
            
            const tRes = await client.query('SELECT * FROM transactions WHERE id = $1 AND family_id = $2', [req.params.id, familyId]);
            if (tRes.rows.length === 0) return res.status(404).json({ error: 'Transação não encontrada' });
            
            const t = tRes.rows[0];
            
            if (t.status === 'PAID') {
                await updateAccountBalance(client, t.account_id, t.amount, t.type, true);
                if (t.type === 'TRANSFER' && t.destination_account_id) {
                    await updateAccountBalance(client, t.destination_account_id, t.amount, 'INCOME', true);
                }
            }

            await client.query('UPDATE transactions SET deleted_at = NOW() WHERE id = $1', [req.params.id]);
            await client.query('COMMIT');
            await logAudit(pool, userId, 'DELETE', 'transaction', req.params.id, t.description);
            res.json({ success: true });
        } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); } finally { client.release(); }
    });

    router.post('/accounts', authenticateToken, async (req, res) => {
        const a = req.body;
        try {
            const familyId = await getFamilyId(req.user.id);
            await pool.query(
                `INSERT INTO accounts (id, name, type, balance, credit_limit, closing_day, due_day, user_id, family_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 ON CONFLICT (id) DO UPDATE SET name=$2, type=$3, balance=$4, credit_limit=$5, closing_day=$6, due_day=$7, deleted_at=NULL`,
                [a.id || crypto.randomUUID(), a.name, a.type, a.balance, a.creditLimit, a.closingDay, a.dueDay, req.user.id, familyId]
            );
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.delete('/accounts/:id', authenticateToken, async (req, res) => {
        try {
            const familyId = await getFamilyId(req.user.id);
            await pool.query('UPDATE accounts SET deleted_at = NOW() WHERE id = $1 AND family_id = $2', [req.params.id, familyId]);
            await logAudit(pool, req.user.id, 'DELETE', 'account', req.params.id, 'Conta removida');
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.post('/categories', authenticateToken, async (req, res) => {
        const c = req.body;
        try {
            const familyId = await getFamilyId(req.user.id);
            await pool.query(
                `INSERT INTO categories (id, name, type, user_id, family_id)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (id) DO UPDATE SET name=$2, type=$3, deleted_at=NULL`,
                [c.id || crypto.randomUUID(), c.name, c.type, req.user.id, familyId]
            );
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.delete('/categories/:id', authenticateToken, async (req, res) => {
        try {
            const familyId = await getFamilyId(req.user.id);
            await pool.query('UPDATE categories SET deleted_at = NOW() WHERE id = $1 AND family_id = $2', [req.params.id, familyId]);
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.post('/goals', authenticateToken, async (req, res) => {
        const g = req.body;
        try {
            const familyId = await getFamilyId(req.user.id);
            await pool.query(
                `INSERT INTO goals (id, name, target_amount, current_amount, deadline, user_id, family_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (id) DO UPDATE SET name=$2, target_amount=$3, current_amount=$4, deadline=$5, deleted_at=NULL`,
                [g.id || crypto.randomUUID(), g.name, g.targetAmount, g.currentAmount, g.deadline, req.user.id, familyId]
            );
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.delete('/goals/:id', authenticateToken, async (req, res) => {
        try {
            const familyId = await getFamilyId(req.user.id);
            await pool.query('UPDATE goals SET deleted_at = NOW() WHERE id = $1 AND family_id = $2', [req.params.id, familyId]);
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.post('/upload', authenticateToken, upload.array('files'), async (req, res) => {
        try {
            const urls = await uploadFiles(req.files, req.user.id);
            res.json({ urls });
        } catch (err) { 
            res.status(500).json({ error: err.message }); 
        }
    });

    return router;
}
