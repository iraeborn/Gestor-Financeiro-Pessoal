
import express from 'express';
import pool from '../db.js';
import { authenticateToken, sanitizeValue } from '../middleware.js';

const router = express.Router();

export default function(logAudit) {
    router.post('/sync', authenticateToken, async (req, res) => {
        const { action, payload } = req.body;
        const userId = req.user.id;
        try {
            const familyIdRes = await pool.query('SELECT family_id FROM users WHERE id = $1', [userId]);
            const familyId = familyIdRes.rows[0]?.family_id || userId;

            if (action === 'DELETE') {
                await pool.query(`UPDATE commercial_orders SET deleted_at = NOW() WHERE id = $1 AND family_id = $2`, [payload.id, familyId]);
                await logAudit(pool, userId, 'DELETE', 'order', payload.id, `Exclusão de pedido`);
            } else {
                const query = `
                    INSERT INTO commercial_orders (
                        id, user_id, family_id, description, contact_id, amount, date, status, 
                        account_id, items, type, gross_amount, discount_amount, tax_amount, 
                        transaction_id, assignee_id, rx_id, branch_id, module_tag
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
                    ON CONFLICT (id) DO UPDATE SET 
                        description=EXCLUDED.description, contact_id=EXCLUDED.contact_id, amount=EXCLUDED.amount, 
                        date=EXCLUDED.date, status=EXCLUDED.status, account_id=EXCLUDED.account_id, 
                        items=EXCLUDED.items, type=EXCLUDED.type, gross_amount=EXCLUDED.gross_amount, 
                        discount_amount=EXCLUDED.discount_amount, transaction_id=EXCLUDED.transaction_id, 
                        assignee_id=EXCLUDED.assignee_id, rx_id=EXCLUDED.rx_id, branch_id=EXCLUDED.branch_id, 
                        deleted_at=NULL`;
                
                await pool.query(query, [
                    payload.id, userId, familyId, payload.description, sanitizeValue(payload.contactId), 
                    Number(payload.amount), payload.date, payload.status, sanitizeValue(payload.accountId), 
                    JSON.stringify(payload.items || []), payload.type || 'SALE', 
                    Number(payload.grossAmount || payload.amount), Number(payload.discountAmount || 0), 
                    Number(payload.taxAmount || 0), sanitizeValue(payload.transactionId), 
                    sanitizeValue(payload.assigneeId), sanitizeValue(payload.rxId), 
                    sanitizeValue(payload.branchId), sanitizeValue(payload.moduleTag)
                ]);
                await logAudit(pool, userId, 'SAVE', 'order', payload.id, payload.description);
            }
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });
    return router;
}
