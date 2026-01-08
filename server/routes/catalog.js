
import express from 'express';
import pool from '../db.js';
import { authenticateToken, sanitizeValue } from '../middleware.js';
import crypto from 'crypto';

const router = express.Router();

export default function(logAudit) {
    // Sincronização do Item do Catálogo
    router.post('/sync', authenticateToken, async (req, res) => {
        const { action, payload } = req.body;
        const userId = req.user.id;
        
        // Fallback caso o envelope não venha estruturado (resiliência)
        const finalAction = action || 'SAVE';
        const finalPayload = payload || req.body;

        try {
            const familyIdRes = await pool.query('SELECT family_id FROM users WHERE id = $1', [userId]);
            const familyId = familyIdRes.rows[0]?.family_id || userId;

            if (finalAction === 'DELETE') {
                await pool.query(`UPDATE service_items SET deleted_at = NOW() WHERE id = $1 AND family_id = $2`, [finalPayload.id, familyId]);
                await logAudit(pool, userId, 'DELETE', 'catalog_item', finalPayload.id, `Exclusão: ${finalPayload.name}`);
            } else {
                const query = `
                    INSERT INTO service_items (
                        id, user_id, family_id, name, code, type, category, branch_id, stock_quantity,
                        warranty_enabled, warranty_days, is_free_allowed, auto_generate_os,
                        unit, brand, description, image_url, default_price, cost_price, module_tag,
                        is_composite, items, variation_attributes, skus
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
                    ON CONFLICT (id) DO UPDATE SET 
                        name=EXCLUDED.name, 
                        code=EXCLUDED.code, 
                        type=EXCLUDED.type, 
                        category=EXCLUDED.category,
                        branch_id=EXCLUDED.branch_id, 
                        stock_quantity=EXCLUDED.stock_quantity,
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
                        skus=EXCLUDED.skus`;
                
                await pool.query(query, [
                    finalPayload.id, userId, familyId, finalPayload.name, sanitizeValue(finalPayload.code), finalPayload.type, 
                    sanitizeValue(finalPayload.category), sanitizeValue(finalPayload.branchId), Number(finalPayload.stockQuantity) || 0,
                    finalPayload.warrantyEnabled ?? false, Number(finalPayload.warrantyDays) || 0,
                    finalPayload.isFreeAllowed ?? false, finalPayload.autoGenerateOS ?? false,
                    sanitizeValue(finalPayload.unit), sanitizeValue(finalPayload.brand), sanitizeValue(finalPayload.description),
                    sanitizeValue(finalPayload.imageUrl), Number(finalPayload.defaultPrice) || 0, Number(finalPayload.costPrice) || 0,
                    sanitizeValue(finalPayload.moduleTag), finalPayload.isComposite ?? false, JSON.stringify(finalPayload.items || []),
                    JSON.stringify(finalPayload.variationAttributes || []), JSON.stringify(finalPayload.skus || [])
                ]);
                await logAudit(pool, userId, 'SAVE', 'catalog_item', finalPayload.id, finalPayload.name);
            }
            res.json({ success: true });
        } catch (err) { 
            console.error("[CATALOG SYNC ERROR]", err.message);
            res.status(500).json({ error: err.message }); 
        }
    });

    // Transferência de Estoque
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
            if (itemRes.rows.length === 0) throw new Error("Item não encontrado.");
            const item = itemRes.rows[0];

            if (Number(item.stock_quantity) < Number(quantity)) {
                throw new Error(`Saldo insuficiente na origem. Disponível: ${item.stock_quantity}`);
            }

            await client.query(
                `UPDATE service_items SET stock_quantity = stock_quantity - $1 WHERE id = $2 AND family_id = $3`,
                [quantity, serviceItemId, familyId]
            );

            await client.query(
                `INSERT INTO stock_transfers (id, service_item_id, from_branch_id, to_branch_id, quantity, date, notes, user_id, family_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [id || crypto.randomUUID(), serviceItemId, fromBranchId, toBranchId, quantity, date, notes, userId, familyId]
            );

            await client.query('COMMIT');
            await logAudit(pool, userId, 'STOCK_TRANSFER', 'catalog_item', serviceItemId, `Transferência de ${quantity} un de "${item.name}"`);
            res.json({ success: true });
        } catch (err) {
            await client.query('ROLLBACK');
            res.status(500).json({ error: err.message });
        } finally { client.release(); }
    });

    return router;
}
