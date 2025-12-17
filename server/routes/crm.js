
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

    // Rota para Clientes do Módulo de Serviços (Lazy Table Creation)
    router.post('/modules/clients', authenticateToken, async (req, res) => {
        const { id, contactId, contactName, contactEmail, contactPhone, notes, birthDate, insurance, allergies, medications, moduleTag } = req.body;
        try {
            const familyId = await getFamilyId(req.user.id);
            // Garantir que a tabela existe (Lazy Migration)
            await pool.query(`
                CREATE TABLE IF NOT EXISTS service_clients (
                    id TEXT PRIMARY KEY,
                    contact_id TEXT REFERENCES contacts(id),
                    contact_name TEXT,
                    contact_email TEXT,
                    contact_phone TEXT,
                    notes TEXT,
                    birth_date DATE,
                    insurance TEXT,
                    allergies TEXT,
                    medications TEXT,
                    module_tag TEXT,
                    user_id TEXT REFERENCES users(id),
                    family_id TEXT,
                    created_at TIMESTAMP DEFAULT NOW(),
                    deleted_at TIMESTAMP
                )
            `);

            await pool.query(
                `INSERT INTO service_clients (id, contact_id, contact_name, contact_email, contact_phone, notes, birth_date, insurance, allergies, medications, module_tag, user_id, family_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                 ON CONFLICT (id) DO UPDATE SET 
                    contact_id=$2, contact_name=$3, contact_email=$4, contact_phone=$5, 
                    notes=$6, birth_date=$7, insurance=$8, allergies=$9, medications=$10, 
                    module_tag=$11, deleted_at=NULL`,
                [id, sanitizeValue(contactId), contactName, contactEmail, contactPhone, notes, sanitizeValue(birthDate), insurance, allergies, medications, moduleTag || 'GENERAL', req.user.id, familyId]
            );
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // Rota para Catálogo de Itens (Produtos/Serviços)
    router.post('/modules/services', authenticateToken, async (req, res) => {
        const { id, name, code, defaultPrice, moduleTag, type, costPrice, unit, description, imageUrl, brand } = req.body;
        try {
            const familyId = await getFamilyId(req.user.id);
            
            // Garantir tabela e colunas (Lazy Migration)
            await pool.query(`CREATE TABLE IF NOT EXISTS module_services (id TEXT PRIMARY KEY, name TEXT, code TEXT, default_price DECIMAL(15,2), module_tag TEXT, user_id TEXT, family_id TEXT, created_at TIMESTAMP DEFAULT NOW(), deleted_at TIMESTAMP)`);
            await pool.query(`ALTER TABLE module_services ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'SERVICE'`);
            await pool.query(`ALTER TABLE module_services ADD COLUMN IF NOT EXISTS cost_price DECIMAL(15,2)`);
            await pool.query(`ALTER TABLE module_services ADD COLUMN IF NOT EXISTS unit TEXT`);
            await pool.query(`ALTER TABLE module_services ADD COLUMN IF NOT EXISTS description TEXT`);
            await pool.query(`ALTER TABLE module_services ADD COLUMN IF NOT EXISTS image_url TEXT`);
            await pool.query(`ALTER TABLE module_services ADD COLUMN IF NOT EXISTS brand TEXT`);

            await pool.query(
                `INSERT INTO module_services (id, name, code, default_price, module_tag, user_id, family_id, type, cost_price, unit, description, image_url, brand) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
                 ON CONFLICT (id) DO UPDATE SET name=$2, code=$3, default_price=$4, module_tag=$5, type=$8, cost_price=$9, unit=$10, description=$11, image_url=$12, brand=$13, deleted_at=NULL`, 
                [id, name, sanitizeValue(code), defaultPrice || 0, moduleTag || 'GENERAL', req.user.id, familyId, type || 'SERVICE', costPrice || 0, sanitizeValue(unit), sanitizeValue(description), sanitizeValue(imageUrl), sanitizeValue(brand)]
            );
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // Rota para Agendamentos
    router.post('/modules/appointments', authenticateToken, async (req, res) => {
        const { id, clientId, serviceId, date, status, notes, moduleTag } = req.body;
        try {
            const familyId = await getFamilyId(req.user.id);
            await pool.query(`
                CREATE TABLE IF NOT EXISTS service_appointments (
                    id TEXT PRIMARY KEY,
                    client_id TEXT,
                    service_id TEXT,
                    date TIMESTAMP,
                    status TEXT,
                    notes TEXT,
                    module_tag TEXT,
                    user_id TEXT,
                    family_id TEXT,
                    created_at TIMESTAMP DEFAULT NOW(),
                    deleted_at TIMESTAMP
                )
            `);

            await pool.query(
                `INSERT INTO service_appointments (id, client_id, service_id, date, status, notes, module_tag, user_id, family_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 ON CONFLICT (id) DO UPDATE SET client_id=$2, service_id=$3, date=$4, status=$5, notes=$6, module_tag=$7, deleted_at=NULL`,
                [id, clientId, sanitizeValue(serviceId), date, status || 'SCHEDULED', notes, moduleTag || 'GENERAL', req.user.id, familyId]
            );
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    return router;
}
