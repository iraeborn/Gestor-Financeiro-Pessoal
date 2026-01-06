
import express from 'express';
import pool from '../db.js';
import crypto from 'crypto';
import { authenticateToken, updateAccountBalance, sanitizeValue } from '../middleware.js';

const router = express.Router();

// Campos que devem ser tratados como números decimais/inteiros para evitar erros de tipo no PostgreSQL ou string no Frontend
const numericFields = [
    'balance', 'amount', 'target_amount', 'current_amount', 
    'total_amount', 'gross_amount', 'discount_amount', 'tax_amount',
    'value', 'unit_price', 'total_price', 'cost_price', 'credit_limit',
    'interest_rate', 'commission_rate', 'default_price', 'default_duration',
    'sphere_od_longe', 'cyl_od_longe', 'sphere_oe_longe', 'cyl_oe_longe',
    'sphere_od_perto', 'cyl_od_perto', 'sphere_oe_perto', 'cyl_oe_perto',
    'addition', 'dnp_od', 'dnp_oe', 'height_od', 'height_oe', 'axis_od_longe', 'axis_oe_longe', 'axis_od_perto', 'axis_oe_perto'
];

const mapToFrontend = (row) => {
    if (!row) return row;
    const newRow = {};
    for (const key in row) {
        // Converte snake_case do banco para camelCase do frontend
        const camelKey = key.replace(/([-_][a-z])/ig, ($1) => $1.toUpperCase().replace('-', '').replace('_', ''));
        let value = row[key];
        
        // Conversão numérica para evitar strings "123.45" no JS
        if (numericFields.includes(key)) {
            value = value === null ? 0 : Number(value);
        }
        
        // Datas do Postgres vem como objeto Date, convertemos para YYYY-MM-DD
        if (value instanceof Date) {
            value = value.toISOString().split('T')[0];
        }
        
        newRow[camelKey] = value;
    }
    // Garantia de mapeamento de IDs de família (o filtro do frontend depende disso)
    if (row.family_id && !newRow.familyId) {
        newRow.familyId = row.family_id;
    }
    return newRow;
};

export default function(logAudit) {
    /**
     * Puxa todos os dados ativos do negócio/família do usuário para hidratar o banco local (IndexedDB)
     */
    router.get('/initial-data', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const userRes = await pool.query('SELECT family_id, role FROM users WHERE id = $1', [userId]);
            const familyId = userRes.rows[0]?.family_id || userId;
            const userRole = userRes.rows[0]?.role;
            const isSalesperson = userRole === 'SALES_OPTICAL';

            // Definições de Queries para todas as entidades operacionais
            const queryDefs = {
                accounts: ['SELECT * FROM accounts WHERE family_id = $1 AND deleted_at IS NULL', [familyId]],
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
                opticalRxs: ['SELECT rx.*, c.name as contact_name FROM optical_rxs rx LEFT JOIN contacts c ON rx.contact_id = c.id WHERE rx.family_id = $1 AND rx.deleted_at IS NULL', [familyId]],
                laboratories: ['SELECT *, family_id FROM laboratories WHERE family_id = $1 AND deleted_at IS NULL', [familyId]],
                goals: ['SELECT *, family_id FROM goals WHERE family_id = $1 AND deleted_at IS NULL', [familyId]],
                serviceClients: ['SELECT *, family_id FROM service_clients WHERE family_id = $1 AND deleted_at IS NULL', [familyId]]
            };

            const results = {};
            for (const key of Object.keys(queryDefs)) {
                const resDb = await pool.query(queryDefs[key][0], queryDefs[key][1]);
                results[key] = resDb.rows.map(r => mapToFrontend(r));
            }
            
            res.json(results);
        } catch (err) {
            console.error("Initial data load error:", err);
            res.status(500).json({ error: err.message });
        }
    });

    /**
     * Processa itens da fila de sincronização (OFFLINE -> ONLINE)
     */
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
                'accounts': 'accounts', 
                'transactions': 'transactions', 
                'goals': 'goals',
                'contacts': 'contacts', 
                'categories': 'categories', 
                'branches': 'branches',
                'serviceItems': 'service_items',
                'serviceOrders': 'service_orders', 
                'commercialOrders': 'commercial_orders',
                'opticalRxs': 'optical_rxs', 
                'salespeople': 'salespeople', 
                'laboratories': 'laboratories',
                'salespersonSchedules': 'salesperson_schedules',
                'serviceClients': 'service_clients'
            };

            const tableName = tableMap[store];
            if (!tableName) throw new Error(`Loja ${store} não mapeada no servidor.`);

            if (action === 'DELETE') {
                await client.query(`UPDATE ${tableName} SET deleted_at = NOW() WHERE id = $1 AND family_id = $2`, [payload.id, familyId]);
            } else if (action === 'SAVE') {
                // Filtramos campos que não devem ir para o banco físico (metadados de exibição)
                const fields = Object.keys(payload).filter(k => {
                    const lowerK = k.toLowerCase();
                    if (['id', 'userid', 'familyid', 'user_id', 'family_id'].includes(lowerK) || k.startsWith('_')) return false;
                    if (['deletedat', 'deleted_at', 'createdat', 'created_at', 'updatedat', 'updated_at'].includes(lowerK)) return false;
                    if (k.endsWith('Name') || k.endsWith('Label')) return false;
                    return true;
                });

                const snakeFields = fields.map(f => f.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`));
                const placeholders = fields.map((_, i) => `$${i + 4}`).join(', ');
                const updateStr = snakeFields.map((f, i) => `${f} = $${i + 4}`).join(', ');

                const query = `INSERT INTO ${tableName} (id, user_id, family_id, ${snakeFields.join(', ')}) 
                               VALUES ($1, $2, $3, ${placeholders}) 
                               ON CONFLICT (id) DO UPDATE SET ${updateStr}, deleted_at = NULL`;
                
                const values = [
                    payload.id, 
                    userId, 
                    familyId, 
                    ...fields.map(f => {
                        let val = payload[f];
                        if (typeof val === 'object' && val !== null) return JSON.stringify(val);
                        
                        // Conversão de volta para número se for um campo numérico conhecido
                        const physicalField = f.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`);
                        if (numericFields.includes(physicalField)) {
                            return val === null || val === undefined || val === '' ? 0 : Number(val);
                        }
                        
                        return sanitizeValue(val);
                    })
                ];
                
                await client.query(query, values);

                // Lógica Especial: Atualização de Saldo Bancário em Tempo Real
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
