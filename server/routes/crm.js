
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

    // --- MODULE CLIENTS ---
    router.post('/modules/clients', authenticateToken, async (req, res) => {
        const { id, contactId, contactName, contactEmail, contactPhone, notes, birthDate, insurance, allergies, medications, moduleTag, odontogram, anamnesis, prescriptions, attachments, treatmentPlans } = req.body;
        try {
            const familyId = await getFamilyId(req.user.id);
            const clientId = id || crypto.randomUUID();
            const existingRes = await pool.query('SELECT id FROM service_clients WHERE id = $1', [clientId]);
            const isUpdate = existingRes.rows.length > 0;

            await pool.query(
                `INSERT INTO service_clients (id, contact_id, contact_name, contact_email, contact_phone, notes, birth_date, insurance, allergies, medications, module_tag, user_id, family_id, odontogram, anamnesis, prescriptions, attachments, treatment_plans)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
                 ON CONFLICT (id) DO UPDATE SET 
                    contact_id=$2, contact_name=$3, contact_email=$4, contact_phone=$5, 
                    notes=$6, birth_date=$7, insurance=$8, allergies=$9, medications=$10, 
                    module_tag=$11, odontogram=$14, anamnesis=$15, prescriptions=$16, attachments=$17, treatment_plans=$18, deleted_at=NULL`,
                [
                    clientId, sanitizeValue(contactId), contactName, contactEmail, contactPhone, 
                    notes, sanitizeValue(birthDate), insurance, allergies, medications, 
                    moduleTag || 'GENERAL', req.user.id, familyId,
                    JSON.stringify(odontogram || []),
                    JSON.stringify(anamnesis || {}),
                    JSON.stringify(prescriptions || []),
                    JSON.stringify(attachments || []),
                    JSON.stringify(treatmentPlans || [])
                ]
            );
            await logAudit(pool, req.user.id, isUpdate ? 'UPDATE' : 'CREATE', 'service_client', clientId, contactName);
            res.json({ success: true, id: clientId });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.delete('/modules/clients/:id', authenticateToken, async (req, res) => {
        try {
            const familyId = await getFamilyId(req.user.id);
            await pool.query('UPDATE service_clients SET deleted_at = NOW() WHERE id = $1 AND family_id = $2', [req.params.id, familyId]);
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // --- MODULE SERVICES ---
    router.post('/modules/services', authenticateToken, async (req, res) => {
        const { id, name, code, defaultPrice, defaultDuration, moduleTag, type, costPrice, unit, description, imageUrl, brand, items, isComposite } = req.body;
        try {
            const familyId = await getFamilyId(req.user.id);
            const itemId = id || crypto.randomUUID();
            const existingRes = await pool.query('SELECT id FROM module_services WHERE id = $1', [itemId]);
            const isUpdate = existingRes.rows.length > 0;

            await pool.query(
                `INSERT INTO module_services (id, name, code, default_price, default_duration, module_tag, user_id, family_id, type, cost_price, unit, description, image_url, brand, items, is_composite) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) 
                 ON CONFLICT (id) DO UPDATE SET 
                    name=$2, code=$3, default_price=$4, default_duration=$5, module_tag=$6, 
                    type=$9, cost_price=$10, unit=$11, description=$12, image_url=$13, brand=$14, 
                    items=$15, is_composite=$16, deleted_at=NULL`, 
                [
                    itemId, name, sanitizeValue(code), defaultPrice || 0, defaultDuration || 0, 
                    moduleTag || 'GENERAL', req.user.id, familyId, type || 'SERVICE', 
                    costPrice || 0, sanitizeValue(unit), sanitizeValue(description), 
                    sanitizeValue(imageUrl), sanitizeValue(brand), JSON.stringify(items || []), isComposite || false
                ]
            );
            await logAudit(pool, req.user.id, isUpdate ? 'UPDATE' : 'CREATE', 'service_item', itemId, name);
            res.json({ success: true, id: itemId });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.delete('/modules/services/:id', authenticateToken, async (req, res) => {
        try {
            const familyId = await getFamilyId(req.user.id);
            await pool.query('UPDATE module_services SET deleted_at = NOW() WHERE id = $1 AND family_id = $2', [req.params.id, familyId]);
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // --- MODULE APPOINTMENTS ---
    router.post('/modules/appointments', authenticateToken, async (req, res) => {
        const { id, clientId, date, status, notes, clinicalNotes, moduleTag, treatmentItems, isLocked } = req.body;
        try {
            const familyId = await getFamilyId(req.user.id);
            const apptId = id || crypto.randomUUID();
            const existingRes = await pool.query('SELECT id FROM service_appointments WHERE id = $1', [apptId]);
            const isUpdate = existingRes.rows.length > 0;

            await pool.query(
                `INSERT INTO service_appointments (id, client_id, treatment_items, date, status, notes, clinical_notes, module_tag, user_id, family_id, is_locked)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                 ON CONFLICT (id) DO UPDATE SET client_id=$2, treatment_items=$3, date=$4, status=$5, notes=$6, clinical_notes=$7, module_tag=$8, is_locked=$11, deleted_at=NULL`,
                [
                    apptId, clientId, JSON.stringify(treatmentItems || []), 
                    date, status || 'SCHEDULED', notes, clinicalNotes || '', 
                    moduleTag || 'GENERAL', req.user.id, familyId, isLocked || false
                ]
            );
            await logAudit(pool, req.user.id, isUpdate ? 'UPDATE' : 'CREATE', 'appointment', apptId, `Agenda: ${date}`);
            res.json({ success: true, id: apptId });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.delete('/modules/appointments/:id', authenticateToken, async (req, res) => {
        try {
            const familyId = await getFamilyId(req.user.id);
            await pool.query('UPDATE service_appointments SET deleted_at = NOW() WHERE id = $1 AND family_id = $2', [req.params.id, familyId]);
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // --- OPTICAL RX ---
    router.post('/optical/rx', authenticateToken, async (req, res) => {
        const rx = req.body;
        try {
            const familyId = await getFamilyId(req.user.id);
            const id = rx.id || crypto.randomUUID();
            const existingRes = await pool.query('SELECT id FROM optical_rxs WHERE id = $1', [id]);
            const isUpdate = existingRes.rows.length > 0;

            await pool.query(
                `INSERT INTO optical_rxs (
                    id, contact_id, professional_name, rx_date, expiration_date,
                    sphere_od_longe, cyl_od_longe, axis_od_longe,
                    sphere_od_perto, cyl_od_perto, axis_od_perto,
                    sphere_oe_longe, cyl_oe_longe, axis_oe_longe,
                    sphere_oe_perto, cyl_oe_perto, axis_oe_perto,
                    addition, dnp_od, dnp_oe, height_od, height_oe,
                    image_url, observations, user_id, family_id
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26
                ) ON CONFLICT (id) DO UPDATE SET
                    contact_id=$2, professional_name=$3, rx_date=$4, expiration_date=$5,
                    sphere_od_longe=$6, cyl_od_longe=$7, axis_od_longe=$8,
                    sphere_od_perto=$9, cyl_od_perto=$10, axis_od_perto=$11,
                    sphere_oe_longe=$12, cyl_oe_longe=$13, axis_oe_longe=$14,
                    sphere_oe_perto=$15, cyl_oe_perto=$16, axis_oe_perto=$17,
                    addition=$18, dnp_od=$19, dnp_oe=$20, height_od=$21, height_oe=$22,
                    image_url=$23, observations=$24, deleted_at=NULL`,
                [
                    id, rx.contactId, rx.professionalName, rx.rxDate, sanitizeValue(rx.expirationDate),
                    rx.sphereOdLonge, rx.cylOdLonge, rx.axisOdLonge,
                    rx.sphereOdPerto, rx.cylOdPerto, rx.axisOdPerto,
                    rx.sphereOeLonge, rx.cylOeLonge, rx.axisOeLonge,
                    rx.sphereOePerto, rx.cylOePerto, rx.axisOePerto,
                    rx.addition, rx.dnpOd, rx.dnpOe, rx.heightOd, rx.heightOe,
                    rx.imageUrl, rx.observations, req.user.id, familyId
                ]
            );

            await logAudit(pool, req.user.id, isUpdate ? 'UPDATE' : 'CREATE', 'optical_rx', id, `Receita: ${rx.contactName}`);
            res.json({ success: true, id });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.delete('/optical/rx/:id', authenticateToken, async (req, res) => {
        try {
            const familyId = await getFamilyId(req.user.id);
            await pool.query('UPDATE optical_rxs SET deleted_at = NOW() WHERE id = $1 AND family_id = $2', [req.params.id, familyId]);
            await logAudit(pool, req.user.id, 'DELETE', 'optical_rx', req.params.id, 'Receita removida');
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    return router;
}
