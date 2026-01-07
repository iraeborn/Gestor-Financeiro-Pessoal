
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
                await pool.query(`UPDATE accounts SET deleted_at = NOW() WHERE id = $1 AND family_id = $2`, [payload.id, familyId]);
                await logAudit(pool, userId, 'DELETE', 'account', payload.id, `Exclusão de conta`);
            } else {
                const query = `
                    INSERT INTO accounts (id, user_id, family_id, name, type, balance, credit_limit, closing_day, due_day)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    ON CONFLICT (id) DO UPDATE SET 
                        name=EXCLUDED.name, type=EXCLUDED.type, balance=EXCLUDED.balance, 
                        credit_limit=EXCLUDED.credit_limit, closing_day=EXCLUDED.closing_day, 
                        due_day=EXCLUDED.due_day, deleted_at=NULL`;
                
                await pool.query(query, [
                    payload.id, userId, familyId, payload.name, payload.type, 
                    Number(payload.balance) || 0, sanitizeValue(payload.creditLimit),
                    sanitizeValue(payload.closingDay), sanitizeValue(payload.dueDay)
                ]);
                await logAudit(pool, userId, 'SAVE', 'account', payload.id, payload.name);
            }
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });
    return router;
}
