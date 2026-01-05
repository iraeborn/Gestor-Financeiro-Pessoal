
import express from 'express';
import pool from '../db.js';
import crypto from 'crypto';
import { authenticateToken, updateAccountBalance, sanitizeValue } from '../middleware.js';

const router = express.Router();

const numericFields = [
    'balance', 'amount', 'target_amount', 'current_amount', 
    'total_amount', 'gross_amount', 'discount_amount', 'tax_amount',
    'value', 'unit_price', 'total_price', 'cost_price', 'credit_limit',
    'interest_rate', 'commission_rate', 'default_price', 'default_duration',
    'sphere_od_longe', 'cyl_od_longe', 'sphere_oe_longe', 'cyl_oe_longe',
    'sphere_od_perto', 'cyl_od_perto', 'sphere_oe_perto', 'cyl_oe_perto',
    'addition', 'dnp_od', 'dnp_oe', 'height_od', 'height_oe'
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
    if (row.family_id && !newRow.familyId) {
        newRow.familyId = row.family_id;
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
                accounts: ['SELECT id, name, type, family_id, CASE WHEN $2 = true THEN 0 ELSE balance END as balance FROM accounts WHERE family_id = $1 AND deleted_at IS NULL', [familyId, isSalesperson]],
                transactions: isSalesperson 
                    ? ['SELECT t.*, u.name as created_by_name FROM transactions t LEFT JOIN users u ON t.user_id = u.id WHERE t.family_id = $1 AND t.user_id = $2 AND t.deleted_at IS NULL ORDER BY t.date DESC', [familyId, userId]]
                    : ['SELECT t.*, u.name as created_by_name FROM transactions t LEFT JOIN users u ON t.user_id = u.id WHERE t.family_id = $1 AND t.deleted_at IS NULL ORDER BY t.date DESC', [familyId]],
                contacts: ['SELECT *, family_id FROM contacts WHERE family_id = $1 AND deleted_at IS NULL', [familyId]],
                categories: ['SELECT *, family_id FROM categories WHERE family_id = $1 AND deleted_at IS NULL', [familyId]],
                serviceItems: ['SELECT *, family_id FROM service_items WHERE family_id = $1 AND deleted_at IS NULL', [familyId]],
                branches: ['SELECT *, family_id FROM branches WHERE family_id = $1 AND deleted_at IS NULL', [familyId]],
                salespeople: ['SELECT s.*, u.name, u.email, b.name as branch_name FROM salespeople s LEFT JOIN users u ON s.user_id = u.id LEFT JOIN branches b ON s.branch_id = b.id WHERE s.family_id = $1 AND s.deleted_at IS NULL', [familyId]],
                salespersonSchedules: ['SELECT sch.*, u.name as salesperson_name, b.name as branch_name FROM salesperson_schedules sch LEFT JOIN salespeople s ON sch.salesperson_id = s.id LEFT JOIN users u ON s.user_id = u.id LEFT JOIN branches b ON sch.branch_id = b.id WHERE sch.family_id = $1 AND sch.deleted_at IS NULL', [familyId]],
                serviceOrders: ['SELECT *, family_id FROM service_orders WHERE family_id = $1 AND deleted_at IS NULL', [familyId]],
                commercialOrders: ['SELECT *, family_id FROM commercial_orders WHERE family_id = $1 AND deleted_at IS NULL', [familyId]],
                opticalRxs: ['SELECT *, family_id FROM optical_rxs WHERE family_id = $1 AND deleted_at IS NULL', [familyId]],
                laboratories: ['SELECT *, family_id FROM laboratories WHERE family_id = $1 AND deleted_at IS NULL', [familyId]],
                goals: isSalesperson ? ['SELECT id, name, 0 as target_amount, 0 as current_amount, family_id, NULL as deadline FROM goals LIMIT 0', []] : ['SELECT *, family_id FROM goals WHERE family_id = $1 AND deleted_at IS NULL', [familyId]]
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

    router.post('/sync/process', authenticateToken, async (req, res, next) => {
        const { action, store, payload } = req.body;
        const userId = req.user.id;
        let client;
        
        try {
            client = await pool.connect();
            const familyIdRes = await client.query('SELECT family_id FROM users WHERE id = $1', [userId]);
            const familyId = familyIdRes.rows[0]?.family_id || userId;
            
            await client.query('BEGIN');

            const tableMap = {
                'accounts': 'accounts', 'transactions': 'transactions', 'goals': 'goals',
                'contacts': 'contacts', 'categories': 'categories', 'branches': 'branches',
                'serviceItems': 'service_items',
                'serviceOrders': 'service_orders', 'commercialOrders': 'commercial_orders',
                'opticalRxs': 'optical_rxs', 'salespeople': 'salespeople', 'laboratories': 'laboratories',
                'salespersonSchedules': 'salesperson_schedules'
            };

            const tableName = tableMap[store];
            if (!tableName) throw new Error(`Loja ${store} não mapeada.`);

            if (action === 'DELETE') {
                await client.query(`UPDATE ${tableName} SET deleted_at = NOW() WHERE id = $1 AND family_id = $2`, [payload.id, familyId]);
            } else if (action === 'SAVE') {
                const fields = Object.keys(payload).filter(k => {
                    const lowerK = k.toLowerCase();
                    if (['id', 'userid', 'familyid', 'user_id', 'family_id'].includes(lowerK) || k.startsWith('_')) return false;
                    if (['deletedat', 'deleted_at', 'createdat', 'created_at', 'updatedat', 'updated_at', 'createdby', 'created_by', 'updatedby', 'updated_by'].includes(lowerK)) return false;
                    
                    if (k === 'name') return ['accounts', 'contacts', 'categories', 'branches', 'laboratories', 'goals', 'service_items'].includes(tableName);
                    if (k === 'email') return ['contacts', 'laboratories'].includes(tableName);
                    if (k.endsWith('Name') || k.endsWith('Label') || ['createdByName', 'accountName', 'salespersonName', 'branchName', 'contactName'].includes(k)) return false;
                    
                    return true;
                });

                const snakeFields = fields.map(f => f.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`));
                const placeholders = fields.map((_, i) => `$${i + 4}`).join(', ');
                const updateStr = snakeFields.map((f, i) => `${f} = $${i + 4}`).join(', ');

                const targetUserId = (tableName === 'salespeople' && (payload.userId || payload.user_id)) 
                                    ? (payload.userId || payload.user_id) 
                                    : userId;

                const query = `INSERT INTO ${tableName} (id, user_id, family_id, ${snakeFields.join(', ')}) 
                               VALUES ($1, $2, $3, ${placeholders}) 
                               ON CONFLICT (id) DO UPDATE SET ${updateStr}, deleted_at = NULL`;
                
                const values = [
                    payload.id, 
                    targetUserId, 
                    familyId, 
                    ...fields.map(f => {
                        let val = payload[f];
                        if (typeof val === 'object' && val !== null) return JSON.stringify(val);
                        const physicalField = f.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`);
                        if (numericFields.includes(physicalField)) return Number(val) || 0;
                        return sanitizeValue(val);
                    })
                ];
                
                await client.query(query, values);

                if (tableName === 'transactions' && payload.status === 'PAID') {
                    const amount = Number(payload.amount);
                    if (payload.type === 'TRANSFER') {
                        await updateAccountBalance(client, payload.accountId, amount, 'EXPENSE');
                        if (payload.destinationAccountId) {
                            await updateAccountBalance(client, payload.destinationAccountId, amount, 'INCOME');
                        }
                    } else {
                        await updateAccountBalance(client, payload.accountId, amount, payload.type);
                    }
                }
            }

            await client.query('COMMIT');
            res.json({ success: true });
        } catch (err) {
            if (client) await client.query('ROLLBACK').catch(e => console.error("Rollback error", e));
            console.error(`[SYNC ERROR] Store: ${store} | Error: ${err.message}`);
            res.status(500).json({ error: err.message });
        } finally {
            if (client) client.release();
        }
    });

    return router;
}
