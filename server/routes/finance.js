
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
                    results[key] = result.rows[0] || null;
                } else {
                    results[key] = result.rows.map(r => {
                        if (r.created_by_name) r.createdByName = r.created_by_name;
                        return r;
                    });
                }
            });

            console.log(`[API] Initial-data carregado com sucesso para ${familyId}`);
            res.json(results);
        } catch (err) {
            console.error("❌ [API ERROR] Erro fatal em initial-data:", err);
            res.status(500).json({ 
                error: "Erro de sincronização: " + err.message,
                details: "O servidor não conseguiu consolidar seus dados. Verifique a estrutura do banco." 
            });
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
                `INSERT INTO transactions (id, description, amount, type, category, date, status, account_id, destination_account_id, contact_id, goal_id, user_id, family_id, is_recurring, receipt_urls)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                 ON CONFLICT (id) DO UPDATE SET description=$2, amount=$3, type=$4, category=$5, date=$6, status=$7, account_id=$8, destination_account_id=$9, contact_id=$10, goal_id=$11, family_id=$13, receipt_urls=$15`,
                [id, t.description, t.amount, t.type, t.category, t.date, t.status, t.accountId, sanitizeValue(t.destinationAccountId), sanitizeValue(t.contactId), sanitizeValue(t.goalId), userId, familyId, t.isRecurring || false, JSON.stringify(t.receiptUrls || [])]
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
