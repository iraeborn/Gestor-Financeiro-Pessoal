
import express from 'express';
import pool from '../db.js';
import { authenticateToken, sanitizeValue } from '../middleware.js';

const router = express.Router();

export default function(logAudit) {
    
    // Helper local para obter o family_id
    const getFamilyId = async (userId) => {
        const res = await pool.query('SELECT family_id FROM users WHERE id = $1', [userId]);
        return res.rows[0]?.family_id || userId;
    };

    // Rota para Clientes do Módulo de Serviços
    router.post('/modules/clients', authenticateToken, async (req, res) => {
        const { id, contactId, contactName, contactEmail, contactPhone, notes, birthDate, insurance, allergies, medications, moduleTag } = req.body;
        try {
            const familyId = await getFamilyId(req.user.id);
            const existingRes = await pool.query('SELECT id FROM service_clients WHERE id = $1', [id]);
            const isUpdate = existingRes.rows.length > 0;

            await pool.query(
                `INSERT INTO service_clients (id, contact_id, contact_name, contact_email, contact_phone, notes, birth_date, insurance, allergies, medications, module_tag, user_id, family_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                 ON CONFLICT (id) DO UPDATE SET 
                    contact_id=$2, contact_name=$3, contact_email=$4, contact_phone=$5, 
                    notes=$6, birth_date=$7, insurance=$8, allergies=$9, medications=$10, 
                    module_tag=$11, deleted_at=NULL`,
                [id, sanitizeValue(contactId), contactName, contactEmail, contactPhone, notes, sanitizeValue(birthDate), insurance, allergies, medications, moduleTag || 'GENERAL', req.user.id, familyId]
            );
            await logAudit(pool, req.user.id, isUpdate ? 'UPDATE' : 'CREATE', 'service_client', id, contactName);
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // Rota para Catálogo de Itens (Produtos/Serviços)
    router.post('/modules/services', authenticateToken, async (req, res) => {
        const { id, name, code, defaultPrice, moduleTag, type, costPrice, unit, description, imageUrl, brand } = req.body;
        try {
            const familyId = await getFamilyId(req.user.id);
            const existingRes = await pool.query('SELECT id FROM module_services WHERE id = $1', [id]);
            const isUpdate = existingRes.rows.length > 0;

            await pool.query(
                `INSERT INTO module_services (id, name, code, default_price, module_tag, user_id, family_id, type, cost_price, unit, description, image_url, brand) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
                 ON CONFLICT (id) DO UPDATE SET name=$2, code=$3, default_price=$4, module_tag=$5, type=$8, cost_price=$9, unit=$10, description=$11, image_url=$12, brand=$13, deleted_at=NULL`, 
                [id, name, sanitizeValue(code), defaultPrice || 0, moduleTag || 'GENERAL', req.user.id, familyId, type || 'SERVICE', costPrice || 0, sanitizeValue(unit), sanitizeValue(description), sanitizeValue(imageUrl), sanitizeValue(brand)]
            );
            await logAudit(pool, req.user.id, isUpdate ? 'UPDATE' : 'CREATE', 'service_item', id, name);
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // Rota para Agendamentos
    router.post('/modules/appointments', authenticateToken, async (req, res) => {
        const { id, clientId, serviceId, date, status, notes, moduleTag } = req.body;
        try {
            const familyId = await getFamilyId(req.user.id);
            const existingRes = await pool.query('SELECT id FROM service_appointments WHERE id = $1', [id]);
            const isUpdate = existingRes.rows.length > 0;

            await pool.query(
                `INSERT INTO service_appointments (id, client_id, service_id, date, status, notes, module_tag, user_id, family_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 ON CONFLICT (id) DO UPDATE SET client_id=$2, service_id=$3, date=$4, status=$5, notes=$6, module_tag=$7, deleted_at=NULL`,
                [id, clientId, sanitizeValue(serviceId), date, status || 'SCHEDULED', notes, moduleTag || 'GENERAL', req.user.id, familyId]
            );
            await logAudit(pool, req.user.id, isUpdate ? 'UPDATE' : 'CREATE', 'appointment', id, `Agenda: ${date}`);
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    return router;
}
