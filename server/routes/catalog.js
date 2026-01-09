
import express from 'express';
import pool from '../db.js';
import { authenticateToken, sanitizeValue } from '../middleware.js';
import crypto from 'crypto';

const router = express.Router();

export default function(logAudit) {
    // Sincronização do Item do Catálogo
    router.post('/sync', authenticateToken, async (req, res) => {
        let { action, payload } = req.body;
        const userId = req.user.id;
        
        if (!action && !payload) {
            action = 'SAVE';
            payload = req.body;
        }

        if (!payload || !payload.id) {
            return res.status(400).json({ error: "O payload do item é obrigatório e deve conter um ID válido." });
        }

        try {
            const familyIdRes = await pool.query('SELECT family_id FROM users WHERE id = $1', [userId]);
            const familyId = familyIdRes.rows[0]?.family_id || userId;

            if (action === 'DELETE') {
                await pool.query(`UPDATE service_items SET deleted_at = NOW() WHERE id = $1 AND family_id = $2`, [payload.id, familyId]);
                await logAudit(pool, userId, 'DELETE', 'catalog_item', payload.id, `Exclusão: ${payload.name}`);
            } else {
                // REGRA DE OURO: stock_quantity não é atualizado livremente no SAVE se o item já existe.
                // Apenas novos itens podem tel um saldo inicial.
                const checkRes = await pool.query('SELECT id, stock_quantity FROM service_items WHERE id = $1', [payload.id]);
                const isNew = checkRes.rows.length === 0;

                const query = `
                    INSERT INTO service_items (
                        id, user_id, family_id, name, code, type, category, categories, branch_id, stock_quantity,
                        warranty_enabled, warranty_days, is_free_allowed, auto_generate_os,
                        unit, brand, description, image_url, default_price, cost_price, module_tag,
                        is_composite, items, variation_attributes, skus
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
                    ON CONFLICT (id) DO UPDATE SET 
                        name=EXCLUDED.name, 
                        code=EXCLUDED.code, 
                        type=EXCLUDED.type, 
                        category=EXCLUDED.category,
                        categories=EXCLUDED.categories,
                        branch_id=EXCLUDED.branch_id, 
                        warranty_enabled=EXCLUDED.warranty_enabled, 
                        warranty_days=EXCLUDED.warranty_days,
                        is_free_allowed=EXCLUDED.is_free_allowed, 
                        auto_generate_os=EXCLUDED.auto_generate_os,
                        unit=EXCLUDED.unit, 
                        brand=EXCLUDED.brand, 
                        description=EXCLUDED.description,
                        image_url=EXCLUDED.image_url, 
                        default_price=EXCLUDED.default_price, 
                        cost_price=EXCLUDED.cost_price, 
                        deleted_at=NULL,
                        variation_attributes=EXCLUDED.variation_attributes, 
                        skus=EXCLUDED.skus` + 
                        (isNew ? `, stock_quantity=EXCLUDED.stock_quantity` : ``);
                
                await pool.query(query, [
                    payload.id, userId, familyId, payload.name, sanitizeValue(payload.code), payload.type, 
                    sanitizeValue(Array.isArray(payload.categories) ? payload.categories[0] : payload.category), 
                    JSON.stringify(payload.categories || []),
                    sanitizeValue(payload.branchId), Number(payload.stockQuantity) || 0,
                    payload.warrantyEnabled ?? false, Number(payload.warrantyDays) || 0,
                    payload.isFreeAllowed ?? false, payload.autoGenerateOS ?? false,
                    sanitizeValue(payload.unit), sanitizeValue(payload.brand), sanitizeValue(payload.description),
                    sanitizeValue(payload.imageUrl), Number(payload.defaultPrice) || 0, Number(payload.costPrice) || 0,
                    sanitizeValue(payload.moduleTag), payload.isComposite ?? false, JSON.stringify(payload.items || []),
                    JSON.stringify(payload.variationAttributes || []), JSON.stringify(payload.skus || [])
                ]);

                // Se for novo e tiver saldo, registramos o evento de "Ajuste de Saldo Inicial"
                if (isNew && Number(payload.stockQuantity) > 0) {
                    await pool.query(
                        `INSERT INTO inventory_events (id, service_item_id, type, quantity, branch_id, date, notes, user_id, family_id)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                        [crypto.randomUUID(), payload.id, 'ADJUSTMENT_ADD', payload.stockQuantity, payload.branchId, new Date(), 'Saldo inicial de cadastro', userId, familyId]
                    );
                }

                await logAudit(pool, userId, 'SAVE', 'catalog_item', payload.id, payload.name);
            }
            res.json({ success: true });
        } catch (err) { 
            console.error("[CATALOG SYNC ERROR]", err.message);
            res.status(500).json({ error: err.message }); 
        }
    });

    // Novo endpoint para registrar eventos de inventário (Ajustes manuais)
    router.post('/inventory/event', authenticateToken, async (req, res) => {
        const { serviceItemId, type, quantity, branchId, notes, costUnitPrice } = req.body;
        const userId = req.user.id;
        const client = await pool.connect();
        try {
            const familyIdRes = await client.query('SELECT family_id FROM users WHERE id = $1', [userId]);
            const familyId = familyIdRes.rows[0]?.family_id || userId;

            await client.query('BEGIN');

            const multiplier = ['SALE', 'TRANSFER_OUT', 'ADJUSTMENT_REMOVE'].includes(type) ? -1 : 1;
            const finalQuantityChange = Number(quantity) * multiplier;

            // 1. Registra o Evento
            const eventId = crypto.randomUUID();
            await client.query(
                `INSERT INTO inventory_events (id, service_item_id, type, quantity, branch_id, date, notes, user_id, cost_unit_price, family_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [eventId, serviceItemId, type, quantity, branchId, new Date(), notes, userId, costUnitPrice, familyId]
            );

            // 2. Atualiza o Cache de Saldo no Item
            await client.query(
                `UPDATE service_items SET stock_quantity = stock_quantity + $1 WHERE id = $2 AND family_id = $3`,
                [finalQuantityChange, serviceItemId, familyId]
            );

            await client.query('COMMIT');
            await logAudit(pool, userId, 'INVENTORY_CHANGE', 'catalog_item', serviceItemId, `Movimentação de estoque: ${type} (${quantity})`);
            res.json({ success: true, eventId });
        } catch (e) {
            await client.query('ROLLBACK');
            res.status(500).json({ error: e.message });
        } finally { client.release(); }
    });

    // Endpoint para buscar histórico de um item
    router.get('/inventory/history/:itemId', authenticateToken, async (req, res) => {
        try {
            const userRes = await pool.query('SELECT family_id FROM users WHERE id = $1', [req.user.id]);
            const familyId = userRes.rows[0]?.family_id || req.user.id;
            const history = await pool.query(
                `SELECT ie.*, u.name as user_name, b.name as branch_name 
                 FROM inventory_events ie 
                 LEFT JOIN users u ON ie.user_id = u.id 
                 LEFT JOIN branches b ON ie.branch_id = b.id
                 WHERE ie.service_item_id = $1 AND ie.family_id = $2 
                 ORDER BY ie.created_at DESC LIMIT 100`,
                [req.params.itemId, familyId]
            );
            
            // Fix: Map query results to camelCase to match frontend type expectations (InventoryEvent interface)
            const mappedHistory = history.rows.map(row => {
                const newRow = {};
                for (const key in row) {
                    const camelKey = key.replace(/([-_][a-z])/ig, ($1) => $1.toUpperCase().replace('-', '').replace('_', ''));
                    newRow[camelKey] = row[key];
                }
                return newRow;
            });

            res.json(mappedHistory);
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.post('/transfer', authenticateToken, async (req, res) => {
        const { id, serviceItemId, fromBranchId, toBranchId, quantity, notes, date } = req.body;
        const userId = req.user.id;
        const client = await pool.connect();
        try {
            const familyIdRes = await client.query('SELECT family_id FROM users WHERE id = $1', [userId]);
            const familyId = familyIdRes.rows[0]?.family_id || userId;

            await client.query('BEGIN');

            const itemRes = await client.query(
                'SELECT stock_quantity, name FROM service_items WHERE id = $1 AND family_id = $2',
                [serviceItemId, familyId]
            );
            
            if (itemRes.rows.length === 0) throw new Error("Item não encontrado no catálogo.");
            const item = itemRes.rows[0];

            if (Number(item.stock_quantity) < Number(quantity)) {
                throw new Error(`Saldo insuficiente na filial de origem. Disponível: ${item.stock_quantity}`);
            }

            // Registra os eventos de saída e entrada para rastreabilidade
            await client.query(
                `INSERT INTO inventory_events (id, service_item_id, type, quantity, branch_id, date, notes, user_id, family_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [crypto.randomUUID(), serviceItemId, 'TRANSFER_OUT', quantity, fromBranchId, date, `Transferência para filial destino. ${notes || ''}`, userId, familyId]
            );
            
            await client.query(
                `INSERT INTO inventory_events (id, service_item_id, type, quantity, branch_id, date, notes, user_id, family_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [crypto.randomUUID(), serviceItemId, 'TRANSFER_IN', quantity, toBranchId, date, `Recebimento de transferência. ${notes || ''}`, userId, familyId]
            );

            await client.query(
                `UPDATE service_items SET stock_quantity = stock_quantity - $1 WHERE id = $2 AND family_id = $3`,
                [quantity, serviceItemId, familyId]
            );

            await client.query(
                `INSERT INTO stock_transfers (id, service_item_id, from_branch_id, to_branch_id, quantity, date, notes, user_id, family_id, status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [id || crypto.randomUUID(), serviceItemId, fromBranchId, toBranchId, quantity, date, notes, userId, familyId, 'COMPLETED']
            );

            await client.query('COMMIT');
            await logAudit(pool, userId, 'STOCK_TRANSFER', 'inventory', serviceItemId, 
                `Transferência Logística: ${quantity} un de "${item.name}" enviada para nova filial.`);
            
            res.json({ success: true });
        } catch (err) {
            await client.query('ROLLBACK');
            res.status(500).json({ error: err.message });
        } finally { client.release(); }
    });

    return router;
}
