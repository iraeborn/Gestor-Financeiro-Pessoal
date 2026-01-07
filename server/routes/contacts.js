
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
                await pool.query(`UPDATE contacts SET deleted_at = NOW() WHERE id = $1 AND family_id = $2`, [payload.id, familyId]);
                await logAudit(pool, userId, 'DELETE', 'contact', payload.id, `Exclusão de contato`);
            } else {
                const query = `
                    INSERT INTO contacts (id, user_id, family_id, name, type, email, phone, document, fantasy_name, zip_code, street, number, neighborhood, city, state)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                    ON CONFLICT (id) DO UPDATE SET 
                        name=EXCLUDED.name, type=EXCLUDED.type, email=EXCLUDED.email, phone=EXCLUDED.phone, 
                        document=EXCLUDED.document, fantasy_name=EXCLUDED.fantasy_name, deleted_at=NULL`;
                
                await pool.query(query, [
                    payload.id, userId, familyId, payload.name, payload.type, payload.email, payload.phone, 
                    payload.document, payload.fantasyName, payload.zipCode, payload.street, payload.number, 
                    payload.neighborhood, payload.city, payload.state
                ]);
                await logAudit(pool, userId, 'SAVE', 'contact', payload.id, payload.name);
            }
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });
    return router;
}
