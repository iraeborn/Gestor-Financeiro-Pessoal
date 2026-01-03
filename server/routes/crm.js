
import express from 'express';
import pool from '../db.js';
import { authenticateToken, sanitizeValue } from '../middleware.js';
import crypto from 'crypto';

const router = express.Router();

export default function(logAudit) {
    
    const getFamilyId = async (userId) => {
        const res = await pool.query('SELECT family_id FROM users WHERE id = $1', [userId]);
        return res.rows[0]?.family_id || userId;
    };

    router.post('/modules/clients', authenticateToken, async (req, res) => {
        const c = req.body;
        try {
            const familyId = await getFamilyId(req.user.id);
            const id = c.id || crypto.randomUUID();
            
            const ownershipRes = await pool.query('SELECT family_id FROM service_clients WHERE id = $1', [id]);
            if (ownershipRes.rows.length > 0 && ownershipRes.rows[0].family_id !== familyId) {
                return res.status(403).json({ error: "Propriedade de registro inválida." });
            }

            await pool.query(
                `INSERT INTO service_clients (id, contact_id, contact_name, contact_email, contact_phone, notes, birth_date, insurance, allergies, medications, module_tag, user_id, family_id, odontogram, anamnesis, prescriptions, attachments, treatment_plans)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
                 ON CONFLICT (id) DO UPDATE SET contact_id=$2, contact_name=$3, contact_email=$4, contact_phone=$5, notes=$6, birth_date=$7, deleted_at=NULL`,
                [id, sanitizeValue(c.contactId), c.contactName, c.contactEmail, c.contactPhone, c.notes, sanitizeValue(c.birthDate), c.insurance, c.allergies, c.medications, c.moduleTag || 'GENERAL', req.user.id, familyId, JSON.stringify(c.odontogram || []), JSON.stringify(c.anamnesis || {}), JSON.stringify(c.prescriptions || []), JSON.stringify(c.attachments || []), JSON.stringify(c.treatmentPlans || [])]
            );
            await logAudit(pool, req.user.id, ownershipRes.rows.length > 0 ? 'UPDATE' : 'CREATE', 'service_client', id, c.contactName);
            res.json({ success: true, id });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.delete('/modules/clients/:id', authenticateToken, async (req, res) => {
        try {
            const familyId = await getFamilyId(req.user.id);
            await pool.query('UPDATE service_clients SET deleted_at = NOW() WHERE id = $1 AND family_id = $2', [req.params.id, familyId]);
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.post('/optical/rx', authenticateToken, async (req, res) => {
        const rx = req.body;
        try {
            const familyId = await getFamilyId(req.user.id);
            const id = rx.id || crypto.randomUUID();
            
            const ownershipRes = await pool.query('SELECT family_id FROM optical_rxs WHERE id = $1', [id]);
            if (ownershipRes.rows.length > 0 && ownershipRes.rows[0].family_id !== familyId) {
                return res.status(403).json({ error: "Propriedade de RX inválida." });
            }

            await pool.query(
                `INSERT INTO optical_rxs (id, contact_id, professional_name, rx_date, expiration_date, sphere_od_longe, cyl_od_longe, axis_od_longe, sphere_oe_longe, cyl_oe_longe, axis_oe_longe, user_id, family_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                 ON CONFLICT (id) DO UPDATE SET contact_id=$2, professional_name=$3, rx_date=$4, deleted_at=NULL`,
                [id, rx.contactId, rx.professionalName, rx.rxDate, sanitizeValue(rx.expirationDate), rx.sphereOdLonge, rx.cylOdLonge, rx.axisOdLonge, rx.sphereOeLonge, rx.cylOeLonge, rx.axisOeLonge, req.user.id, familyId]
            );

            await logAudit(pool, req.user.id, ownershipRes.rows.length > 0 ? 'UPDATE' : 'CREATE', 'optical_rx', id, `RX: ${rx.contactName}`);
            res.json({ success: true, id });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    return router;
}
