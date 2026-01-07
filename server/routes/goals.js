
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
                await pool.query(`UPDATE goals SET deleted_at = NOW() WHERE id = $1 AND family_id = $2`, [payload.id, familyId]);
                await logAudit(pool, userId, 'DELETE', 'goal', payload.id, `Exclusão da meta: ${payload.name}`);
            } else {
                // Tratamento explícito para evitar o erro de "column specified more than once"
                const query = `
                    INSERT INTO goals (id, user_id, family_id, name, target_amount, current_amount, deadline)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    ON CONFLICT (id) DO UPDATE SET 
                        name=EXCLUDED.name, 
                        target_amount=EXCLUDED.target_amount, 
                        current_amount=EXCLUDED.current_amount, 
                        deadline=EXCLUDED.deadline, 
                        deleted_at=NULL`;
                
                await pool.query(query, [
                    payload.id, 
                    userId, 
                    familyId, 
                    payload.name, 
                    Number(payload.targetAmount) || 0,
                    Number(payload.currentAmount || payload.current_amount) || 0, // Resolve a duplicidade do payload
                    sanitizeValue(payload.deadline)
                ]);
                await logAudit(pool, userId, 'SAVE', 'goal', payload.id, payload.name);
            }
            res.json({ success: true });
        } catch (err) { 
            console.error("[GOALS SYNC ERROR]", err.message);
            res.status(500).json({ error: err.message }); 
        }
    });
    return router;
}
