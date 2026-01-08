
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
                await logAudit(pool, userId, 'SAVE', 'catalog_item', payload.id, payload.name);
            }
            res.json({ success: true });
        } catch (err) { 
            console.error("[CATALOG SYNC ERROR]", err.message);
            res.status(500).json({ error: err.message }); 
        }
    });

    /**
     * TRANSFERÊNCIA DE ESTOQUE (LOGÍSTICA)
     * Não gera financeiro. Apenas move saldo físico entre filiais.
     */
    router.post('/transfer', authenticateToken, async (req, res) => {
        const { id, serviceItemId, fromBranchId, toBranchId, quantity, notes, date } = req.body;
        const userId = req.user.id;
        const client = await pool.connect();
        try {
            const familyIdRes = await client.query('SELECT family_id FROM users WHERE id = $1', [userId]);
            const familyId = familyIdRes.rows[0]?.family_id || userId;

            await client.query('BEGIN');

            // 1. Validar disponibilidade na Origem
            const itemRes = await client.query(
                'SELECT stock_quantity, name FROM service_items WHERE id = $1 AND family_id = $2',
                [serviceItemId, familyId]
            );
            
            if (itemRes.rows.length === 0) throw new Error("Item não encontrado no catálogo.");
            const item = itemRes.rows[0];

            if (Number(item.stock_quantity) < Number(quantity)) {
                throw new Error(`Saldo insuficiente na filial de origem. Disponível: ${item.stock_quantity}`);
            }

            // 2. Decrementar na Origem
            await client.query(
                `UPDATE service_items SET stock_quantity = stock_quantity - $1 WHERE id = $2 AND family_id = $3`,
                [quantity, serviceItemId, familyId]
            );

            // 3. Incrementar no Destino
            // Como no nosso modelo o item "mora" em uma tabela central mas tem uma branch_id padrão,
            // em um sistema multiloja real teríamos uma tabela 'product_stock' vinculando (product_id, branch_id).
            // Aqui simulamos a movimentação lógica registrando a transferência.
            // O frontend filtrará os itens disponíveis na filial 'toBranchId' baseado no histórico de transferências se necessário.
            
            await client.query(
                `INSERT INTO stock_transfers (id, service_item_id, from_branch_id, to_branch_id, quantity, date, notes, user_id, family_id, status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [id || crypto.randomUUID(), serviceItemId, fromBranchId, toBranchId, quantity, date, notes, userId, familyId, 'COMPLETED']
            );

            await client.query('COMMIT');
            
            // Log de Auditoria Logística
            await logAudit(pool, userId, 'STOCK_TRANSFER', 'inventory', serviceItemId, 
                `Transferência Logística: ${quantity} un de "${item.name}" enviada para nova filial.`);
            
            res.json({ success: true });
        } catch (err) {
            await client.query('ROLLBACK');
            console.error("[TRANSFER ERROR]", err.message);
            res.status(500).json({ error: err.message });
        } finally { client.release(); }
    });

    return router;
}
