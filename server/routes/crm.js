
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

    // --- CONTACTS ---
    router.post('/contacts', authenticateToken, async (req, res) => {
        const { id, name, fantasyName, type, email, phone, document, ie, im, pixKey, zipCode, street, number, neighborhood, city, state, isDefaulter, isBlocked, creditLimit, defaultPaymentMethod, defaultPaymentTerm } = req.body;
        try {
            const familyId = await getFamilyId(req.user.id);
            const contactId = id || crypto.randomUUID();
            const existing = (await pool.query('SELECT * FROM contacts WHERE id = $1', [contactId])).rows[0];

            await pool.query(
                `INSERT INTO contacts (
                    id, name, fantasy_name, type, email, phone, document, ie, im, pix_key, 
                    zip_code, street, number, neighborhood, city, state, 
                    is_defaulter, is_blocked, credit_limit, default_payment_method, default_payment_term,
                    user_id, family_id, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, NOW())
                ON CONFLICT (id) DO UPDATE SET 
                    name=$2, fantasy_name=$3, type=$4, email=$5, phone=$6, document=$7, ie=$8, im=$9, pix_key=$10,
                    zip_code=$11, street=$12, number=$13, neighborhood=$14, city=$15, state=$16,
                    is_defaulter=$17, is_blocked=$18, credit_limit=$19, default_payment_method=$20, default_payment_term=$21,
                    deleted_at=NULL`,
                [
                    contactId, name, sanitizeValue(fantasyName), type, sanitizeValue(email), sanitizeValue(phone), sanitizeValue(document), 
                    sanitizeValue(ie), sanitizeValue(im), sanitizeValue(pixKey), sanitizeValue(zipCode), sanitizeValue(street), 
                    sanitizeValue(number), sanitizeValue(neighborhood), sanitizeValue(city), sanitizeValue(state),
                    isDefaulter || false, isBlocked || false, creditLimit || 0, sanitizeValue(defaultPaymentMethod), defaultPaymentTerm || 0,
                    req.user.id, familyId
                ]
            );

            await logAudit(pool, req.user.id, existing ? 'UPDATE' : 'CREATE', 'contact', contactId, name);
            res.json({ success: true, id: contactId });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.delete('/contacts/:id', authenticateToken, async (req, res) => {
        try {
            const familyId = await getFamilyId(req.user.id);
            await pool.query('UPDATE contacts SET deleted_at = NOW() WHERE id = $1 AND family_id = $2', [req.params.id, familyId]);
            await logAudit(pool, req.user.id, 'DELETE', 'contact', req.params.id, 'Contato removido');
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // --- MODULE CLIENTS ---
    router.post('/modules/clients', authenticateToken, async (req, res) => {
        const { id, contactId, contactName, contactEmail, contactPhone, notes, birthDate, insurance, allergies, medications, moduleTag, odontogram, anamnesis, prescriptions, attachments } = req.body;
        try {
            const familyId = await getFamilyId(req.user.id);
            const clientId = id || crypto.randomUUID();
            const existingRes = await pool.query('SELECT id FROM service_clients WHERE id = $1', [clientId]);
            const isUpdate = existingRes.rows.length > 0;

            await pool.query(
                `INSERT INTO service_clients (id, contact_id, contact_name, contact_email, contact_phone, notes, birth_date, insurance, allergies, medications, module_tag, user_id, family_id, odontogram, anamnesis, prescriptions, attachments)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                 ON CONFLICT (id) DO UPDATE SET 
                    contact_id=$2, contact_name=$3, contact_email=$4, contact_phone=$5, 
                    notes=$6, birth_date=$7, insurance=$8, allergies=$9, medications=$10, 
                    module_tag=$11, odontogram=$14, anamnesis=$15, prescriptions=$16, attachments=$17, deleted_at=NULL`,
                [
                    clientId, 
                    sanitizeValue(contactId), 
                    contactName, 
                    contactEmail, 
                    contactPhone, 
                    notes, 
                    sanitizeValue(birthDate), 
                    insurance, 
                    allergies, 
                    medications, 
                    moduleTag || 'GENERAL', 
                    req.user.id, 
                    familyId,
                    JSON.stringify(odontogram || []),
                    JSON.stringify(anamnesis || {}),
                    JSON.stringify(prescriptions || []),
                    JSON.stringify(attachments || [])
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
                    apptId, 
                    clientId, 
                    JSON.stringify(treatmentItems || []), 
                    date, 
                    status || 'SCHEDULED', 
                    notes, 
                    clinicalNotes || '', 
                    moduleTag || 'GENERAL', 
                    req.user.id, 
                    familyId, 
                    isLocked || false
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

    return router;
}
