
import express from 'express';
import pool from '../db.js';
import { authenticateToken, sanitizeValue } from '../middleware.js';

const router = express.Router();

// Campos numéricos técnicos da receita que precisam de conversão
const rxNumericFields = [
    'sphere_od_longe', 'cyl_od_longe', 'axis_od_longe', 'prisma_od_longe',
    'sphere_oe_longe', 'cyl_oe_longe', 'axis_oe_longe', 'prisma_oe_longe',
    'sphere_od_perto', 'cyl_od_perto', 'axis_od_perto',
    'sphere_oe_perto', 'cyl_oe_perto', 'axis_oe_perto',
    'addition', 'dnp_od', 'dnp_oe', 'height_od', 'height_oe'
];

export default function(logAudit) {
    router.post('/sync', authenticateToken, async (req, res) => {
        const { action, payload } = req.body;
        const userId = req.user.id;
        
        try {
            const familyIdRes = await pool.query('SELECT family_id FROM users WHERE id = $1', [userId]);
            const familyId = familyIdRes.rows[0]?.family_id || userId;

            if (action === 'DELETE') {
                await pool.query(
                    `UPDATE optical_rxs SET deleted_at = NOW() WHERE id = $1 AND family_id = $2`,
                    [payload.id, familyId]
                );
                await logAudit(pool, userId, 'DELETE', 'optical_rx', payload.id, `Exclusão de Receita`);
            } else {
                // Mapeamento dinâmico de CamelCase para snake_case
                const fields = Object.keys(payload).filter(k => 
                    !k.startsWith('_') && 
                    !['id', 'familyId', 'family_id', 'contactName'].includes(k)
                );

                const snakeFields = fields.map(f => f.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`));
                const placeholders = fields.map((_, i) => `$${i + 4}`).join(', ');
                const updateStr = snakeFields.map((f, i) => `${f} = $${i + 4}`).join(', ');

                const query = `
                    INSERT INTO optical_rxs (id, user_id, family_id, ${snakeFields.join(', ')})
                    VALUES ($1, $2, $3, ${placeholders})
                    ON CONFLICT (id) DO UPDATE SET ${updateStr}, deleted_at = NULL`;

                const values = [
                    payload.id, 
                    userId, 
                    familyId, 
                    ...fields.map(f => {
                        const dbField = f.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`);
                        let val = payload[f];
                        if (rxNumericFields.includes(dbField)) return val === '' ? null : Number(val);
                        return sanitizeValue(val);
                    })
                ];

                await pool.query(query, values);
                await logAudit(pool, userId, 'SAVE', 'optical_rx', payload.id, `Receita de ${payload.contactName || 'paciente'}`);
            }
            res.json({ success: true });
        } catch (err) {
            console.error("[RX SYNC ERROR]", err.message);
            res.status(500).json({ error: err.message });
        }
    });
    return router;
}
