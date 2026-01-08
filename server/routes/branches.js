
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
                await pool.query(`UPDATE branches SET deleted_at = NOW() WHERE id = $1 AND family_id = $2`, [payload.id, familyId]);
                await logAudit(pool, userId, 'DELETE', 'branch', payload.id, `Exclusão de filial`);
            } else {
                const query = `
                    INSERT INTO branches (id, user_id, family_id, name, code, is_active, city, address, phone, color)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    ON CONFLICT (id) DO UPDATE SET 
                        name=EXCLUDED.name, code=EXCLUDED.code, is_active=EXCLUDED.is_active, 
                        city=EXCLUDED.city, address=EXCLUDED.address, phone=EXCLUDED.phone, 
                        color=EXCLUDED.color, deleted_at=NULL`;
                
                await pool.query(query, [
                    payload.id, userId, familyId, payload.name, sanitizeValue(payload.code), 
                    payload.isActive ?? true, sanitizeValue(payload.city), sanitizeValue(payload.address),
                    sanitizeValue(payload.phone), sanitizeValue(payload.color)
                ]);
                await logAudit(pool, userId, 'SAVE', 'branch', payload.id, payload.name);
            }
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });
    return router;
}
