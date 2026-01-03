
import express from 'express';
import pool from '../db.js';
import crypto from 'crypto';
import { authenticateToken, sanitizeValue } from '../middleware.js';

const router = express.Router();

export default function(logAudit) {

    const getFamilyId = async (userId) => {
        const res = await pool.query('SELECT family_id FROM users WHERE id = $1', [userId]);
        return res.rows[0]?.family_id || userId;
    };

    router.post('/services/os', authenticateToken, async (req, res) => {
        const os = req.body;
        try {
            const familyId = await getFamilyId(req.user.id);
            const ownershipRes = await pool.query('SELECT family_id FROM service_orders WHERE id = $1', [os.id]);
            if (ownershipRes.rows.length > 0 && ownershipRes.rows[0].family_id !== familyId) {
                return res.status(403).json({ error: "Propriedade de OS inválida." });
            }

            await pool.query(
                `INSERT INTO service_orders (id, title, description, contact_id, status, total_amount, start_date, end_date, items, type, origin, priority, opened_at, user_id, family_id) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) 
                 ON CONFLICT (id) DO UPDATE SET title=$2, status=$5, total_amount=$6, deleted_at=NULL`,
                [os.id, os.title, os.description, sanitizeValue(os.contactId), os.status, os.totalAmount || 0, sanitizeValue(os.startDate), sanitizeValue(os.endDate), JSON.stringify(os.items || []), os.type, os.origin, os.priority, sanitizeValue(os.openedAt), req.user.id, familyId]
            );
            await logAudit(pool, req.user.id, ownershipRes.rows.length > 0 ? 'UPDATE' : 'CREATE', 'os', os.id, os.title);
            res.json({ success: true });
        } catch(err) { res.status(500).json({ error: err.message }); }
    });

    router.delete('/services/os/:id', authenticateToken, async (req, res) => {
        try {
            const familyId = await getFamilyId(req.user.id);
            await pool.query(`UPDATE service_orders SET deleted_at = NOW() WHERE id=$1 AND family_id=$2`, [req.params.id, familyId]);
            res.json({ success: true });
        } catch(err) { res.status(500).json({ error: err.message }); }
    });

    return router;
}
