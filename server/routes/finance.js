
import express from 'express';
import pool from '../db.js';
import crypto from 'crypto';
import { authenticateToken, updateAccountBalance, sanitizeValue } from '../middleware.js';

const router = express.Router();

const numericFields = [
    'balance', 'amount', 'target_amount', 'current_amount', 
    'total_amount', 'gross_amount', 'discount_amount', 'tax_amount',
    'value', 'unit_price', 'total_price', 'cost_price', 'credit_limit',
    'interest_rate', 'commission_rate',
    'sphere_od_longe', 'cyl_od_longe', 'sphere_oe_longe', 'cyl_oe_longe',
    'sphere_od_perto', 'cyl_od_perto', 'sphere_oe_perto', 'cyl_oe_perto',
    'addition', 'dnp_od', 'dnp_oe', 'height_od', 'height_oe'
];

// Lista de campos que são apenas para visualização no Frontend (JOINs) e não devem ser persistidos
const VIEW_ONLY_FIELDS = [
    'name', 'email', 'branchName', 'contactName', 'assigneeName', 'createdByName', 'clientName'
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
    router.get('/initial-data', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const userRes = await pool.query('SELECT family_id, role FROM users WHERE id = $1', [userId]);
            const familyId = userRes.rows[0]?.family_id || userId;
            const userRole = userRes.rows[0]?.role;
            const isSalesperson = userRole === 'SALES_OPTICAL';

            const queryDefs = {
                accounts: ['SELECT id, name, type, CASE WHEN $2 = true THEN 0 ELSE balance END as balance FROM accounts WHERE family_id = $1 AND deleted_at IS NULL', [familyId, isSalesperson]],
                transactions: isSalesperson 
                    ? ['SELECT t.*, u.name as created_by_name FROM transactions t LEFT JOIN users u ON t.user_id = u.id WHERE t.family_id = $1 AND t.user_id = $2 AND t.deleted_at IS NULL ORDER BY t.date DESC', [familyId, userId]]
                    : ['SELECT t.*, u.name as created_by_name FROM transactions t LEFT JOIN users u ON t.user_id = u.id WHERE t.family_id = $1 AND t.deleted_at IS NULL ORDER BY t.date DESC', [familyId]],
                contacts: ['SELECT * FROM contacts WHERE family_id = $1 AND deleted_at IS NULL', [familyId]],
                categories: ['SELECT * FROM categories WHERE family_id = $1 AND deleted_at IS NULL', [familyId]],
                branches: ['SELECT * FROM branches WHERE family_id = $1 AND deleted_at IS NULL', [familyId]],
                salespeople: ['SELECT s.*, u.name, u.email, b.name as branch_name FROM salespeople s JOIN users u ON s.user_id = u.id LEFT JOIN branches b ON s.branch_id = b.id WHERE s.family_id = $1 AND s.deleted_at IS NULL', [familyId]],
                serviceOrders: ['SELECT * FROM service_orders WHERE family_id = $1 AND deleted_at IS NULL', [familyId]],
                commercialOrders: ['SELECT * FROM commercial_orders WHERE family_id = $1 AND deleted_at IS NULL', [familyId]],
                opticalRxs: ['SELECT * FROM optical_rxs WHERE family_id = $1 AND deleted_at IS NULL', [familyId]],
                laboratories: ['SELECT * FROM laboratories WHERE family_id = $1 AND deleted_at IS NULL', [familyId]],
                goals: isSalesperson ? ['SELECT id, name, 0 as target_amount, 0 as current_amount, NULL as deadline FROM goals LIMIT 0', []] : ['SELECT * FROM goals WHERE family_id = $1 AND deleted_at IS NULL', [familyId]]
            };

            const results = {};
            for (const key of Object.keys(queryDefs)) {
                const resDb = await pool.query(queryDefs[key][0], queryDefs[key][1]);
                results[key] = resDb.rows.map(r => mapToFrontend(r));
            }
            
            res.json(results);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/sync/process', authenticateToken, async (req, res) => {
        const { action, store, payload } = req.body;
        const userId = req.user.id;
        const client = await pool.connect();
        
        try {
            const familyIdRes = await pool.query('SELECT family_id FROM users WHERE id = $1', [userId]);
            const familyId = familyIdRes.rows[0].family_id || userId;
            await client.query('BEGIN');

            const tableMap = {
                'accounts': 'accounts', 'transactions': 'transactions', 'goals': 'goals',
                'contacts': 'contacts', 'categories': 'categories', 'branches': 'branches',
                'serviceOrders': 'service_orders', 'commercialOrders': 'commercial_orders',
                'opticalRxs': 'optical_rxs', 'salespeople': 'salespeople', 'laboratories': 'laboratories'
            };

            const tableName = tableMap[store];
            if (!tableName) throw new Error(`Loja ${store} não mapeada.`);

            if (action === 'DELETE') {
                await client.query(`UPDATE ${tableName} SET deleted_at = NOW() WHERE id = $1 AND family_id = $2`, [payload.id, familyId]);
            } else if (action === 'SAVE') {
                payload.userId = userId;
                payload.familyId = familyId;

                const fields = Object.keys(payload).filter(k => {
                    // Ignora IDs e metadados internos
                    if (['id', 'userId', 'familyId'].includes(k) || k.startsWith('_')) return false;
                    
                    // Se for a tabela salespeople, ignoramos explicitamente campos de visualização do usuário/filial
                    if (tableName === 'salespeople' && ['name', 'email', 'branchName'].includes(k)) return false;
                    
                    // Se for optical_rxs, ignoramos contactName
                    if (tableName === 'optical_rxs' && k === 'contactName') return false;
                    
                    // Se for transactions, ignoramos createdByName
                    if (tableName === 'transactions' && k === 'createdByName') return false;

                    return true;
                });

                const snakeFields = fields.map(f => f.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`));
                
                const query = `INSERT INTO ${tableName} (id, user_id, family_id, ${snakeFields.join(', ')}) 
                               VALUES ($1, $2, $3, ${fields.map((_, i) => `$${i + 4}`).join(', ')}) 
                               ON CONFLICT (id) DO UPDATE SET ${snakeFields.map((f, i) => `${f} = $${i + 4}`).join(', ')}, deleted_at = NULL`;
                
                const values = [payload.id, userId, familyId, ...fields.map(f => (typeof payload[f] === 'object' && payload[f] !== null) ? JSON.stringify(payload[f]) : sanitizeValue(payload[f]))];
                await client.query(query, values);
            }

            await client.query('COMMIT');
            res.json({ success: true });
        } catch (err) {
            await client.query('ROLLBACK');
            console.error(`[SYNC ERROR] Table: ${tableName || store}`, err);
            res.status(500).json({ error: err.message });
        } finally {
            client.release();
        }
    });

    return router;
}
