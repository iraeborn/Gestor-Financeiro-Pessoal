
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
    'prisma_od_longe', 'prisma_oe_longe',
    'addition', 'dnp_od', 'dnp_oe', 'height_od', 'height_oe', 'axis_od_longe', 'axis_oe_longe', 'axis_od_perto', 'axis_oe_perto',
    'years_of_use', 'default_payment_term'
];

const mapToFrontend = (row) => {
    if (!row) return row;
    const newRow = {};
    for (const key in row) {
        const camelKey = key.replace(/([-_][a-z])/ig, ($1) => $1.toUpperCase().replace('-', '').replace('_', ''));
        let value = row[key];
        if (numericFields.includes(key)) {
            value = value === null ? 0 : Number(value);
        }
        if (value instanceof Date) {
            value = value.toISOString().split('T')[0];
        }
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
                accounts: ['SELECT * FROM accounts WHERE family_id = $1 AND deleted_at IS NULL', [familyId]],
                transactions: isSalesperson 
                    ? ['SELECT t.*, u.name as created_by_name FROM transactions t LEFT JOIN users u ON t.user_id = u.id WHERE t.family_id = $1 AND t.user_id = $2 AND t.deleted_at IS NULL ORDER BY t.date DESC', [familyId, userId]]
                    : ['SELECT t.*, u.name as created_by_name FROM transactions t LEFT JOIN users u ON t.user_id = u.id WHERE t.family_id = $1 AND t.deleted_at IS NULL ORDER BY t.date DESC', [familyId]],
                contacts: ['SELECT *, family_id FROM contacts WHERE family_id = $1 AND deleted_at IS NULL ORDER BY name ASC', [familyId]],
                categories: ['SELECT *, family_id FROM categories WHERE family_id = $1 AND deleted_at IS NULL', [familyId]],
                serviceItems: ['SELECT *, family_id FROM service_items WHERE family_id = $1 AND deleted_at IS NULL', [familyId]],
                branches: ['SELECT *, family_id FROM branches WHERE family_id = $1 AND deleted_at IS NULL', [familyId]],
                salespeople: ['SELECT s.*, u.name, u.email, b.name as branch_name FROM salespeople s LEFT JOIN users u ON s.user_id = u.id LEFT JOIN branches b ON s.branch_id = b.id WHERE s.family_id = $1 AND s.deleted_at IS NULL ORDER BY u.name ASC', [familyId]],
                salespersonSchedules: ['SELECT sch.*, u.name as salesperson_name, b.name as branch_name FROM salesperson_schedules sch LEFT JOIN salespeople s ON sch.salesperson_id = s.id LEFT JOIN users u ON s.user_id = u.id LEFT JOIN branches b ON sch.branch_id = b.id WHERE sch.family_id = $1 AND sch.deleted_at IS NULL ORDER BY sch.date DESC', [familyId]],
                serviceOrders: ['SELECT *, family_id FROM service_orders WHERE family_id = $1 AND deleted_at IS NULL', [familyId]],
                commercialOrders: ['SELECT *, family_id FROM commercial_orders WHERE family_id = $1 AND deleted_at IS NULL', [familyId]],
                opticalRxs: ['SELECT rx.*, c.name as contact_name FROM optical_rxs rx LEFT JOIN contacts c ON rx.contact_id = c.id WHERE rx.family_id = $1 AND rx.deleted_at IS NULL ORDER BY rx.rx_date DESC', [familyId]],
                laboratories: ['SELECT *, family_id FROM laboratories WHERE family_id = $1 AND deleted_at IS NULL ORDER BY name ASC', [familyId]],
                goals: ['SELECT *, family_id FROM goals WHERE family_id = $1 AND deleted_at IS NULL', [familyId]],
                serviceClients: ['SELECT *, family_id FROM service_clients WHERE family_id = $1 AND deleted_at IS NULL', [familyId]]
            };

            const results = {};
            for (const key of Object.keys(queryDefs)) {
                const resDb = await pool.query(queryDefs[key][0], queryDefs[key][1]);
                results[key] = resDb.rows.map(r => mapToFrontend(r));
            }
            res.json(results);
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // Rota legada de fallback para stores ainda não migradas para controllers próprios
    router.post('/sync/process', authenticateToken, async (req, res) => {
        const { action, store, payload } = req.body;
        const userId = req.user.id;
        try {
            const familyIdRes = await pool.query('SELECT family_id FROM users WHERE id = $1', [userId]);
            const familyId = familyIdRes.rows[0]?.family_id || userId;

            const tableMap = {
                'accounts': 'accounts', 'goals': 'goals', 'categories': 'categories', 
                'branches': 'branches', 'serviceItems': 'service_items', 
                'serviceOrders': 'service_orders', 'commercialOrders': 'commercial_orders', 
                'opticalRxs': 'optical_rxs', 'salespeople': 'salespeople', 
                'laboratories': 'laboratories', 'salespersonSchedules': 'salesperson_schedules', 
                'serviceClients': 'service_clients'
            };

            const tableName = tableMap[store];
            if (!tableName) throw new Error(`Loja ${store} não mapeada ou já migrada.`);

            if (action === 'DELETE') {
                await pool.query(`UPDATE ${tableName} SET deleted_at = NOW() WHERE id = $1 AND family_id = $2`, [payload.id, familyId]);
            } else {
                // Lógica de INSERT genérica simplificada (ON CONFLICT)
                const fields = Object.keys(payload).filter(k => !k.startsWith('_') && !['id', 'familyId', 'family_id'].includes(k));
                const snakeFields = fields.map(f => f.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`));
                const placeholders = fields.map((_, i) => `$${i + 4}`).join(', ');
                const updateStr = snakeFields.map((f, i) => `${f} = $${i + 4}`).join(', ');

                const query = `INSERT INTO ${tableName} (id, user_id, family_id, ${snakeFields.join(', ')}) 
                               VALUES ($1, $2, $3, ${placeholders}) 
                               ON CONFLICT (id) DO UPDATE SET ${updateStr}, deleted_at = NULL`;
                
                const values = [payload.id, userId, familyId, ...fields.map(f => payload[f])];
                await pool.query(query, values);
            }
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    return router;
}
