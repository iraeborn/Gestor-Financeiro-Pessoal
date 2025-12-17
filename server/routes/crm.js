
import express from 'express';
import pool from '../db.js';
import { authenticateToken, calculateChanges, sanitizeValue, familyCheckParam2 } from '../middleware.js';

const router = express.Router();

export default function(logAudit) {

    // --- HELPER ---
    const getFamilyId = async (userId) => {
        const res = await pool.query('SELECT family_id FROM users WHERE id = $1', [userId]);
        return res.rows[0]?.family_id || userId;
    };

    // --- CONTACTS ---
    router.post('/contacts', authenticateToken, async (req, res) => {
        const { 
            id, name, email, phone, document, pixKey, type, 
            fantasyName, ie, im, zipCode, street, number, neighborhood, city, state,
            isDefaulter, isBlocked, creditLimit, defaultPaymentMethod, defaultPaymentTerm
        } = req.body;
        
        try {
            const familyId = await getFamilyId(req.user.id);
            
            // Schema Migration Lazy: Ensure columns exist
            await pool.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS family_id TEXT`);
            await pool.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS fantasy_name TEXT`);
            await pool.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'PF'`);
            await pool.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ie TEXT`);
            await pool.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS im TEXT`);
            await pool.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS zip_code TEXT`);
            await pool.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS street TEXT`);
            await pool.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS number TEXT`);
            await pool.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS neighborhood TEXT`);
            await pool.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS city TEXT`);
            await pool.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS state TEXT`);
            await pool.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_defaulter BOOLEAN DEFAULT FALSE`);
            await pool.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE`);
            await pool.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(15,2) DEFAULT 0`);
            await pool.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS default_payment_method TEXT`);
            await pool.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS default_payment_term INTEGER`);

            const existing = (await pool.query('SELECT * FROM contacts WHERE id=$1', [id])).rows[0];
            const changes = calculateChanges(existing, req.body, { 
                name: 'name', email: 'email', phone: 'phone', document: 'document', pixKey: 'pix_key',
                type: 'type', creditLimit: 'credit_limit', isDefaulter: 'is_defaulter', isBlocked: 'is_blocked' 
            });
            
            await pool.query(
                `INSERT INTO contacts (
                    id, name, user_id, family_id, email, phone, document, pix_key,
                    fantasy_name, type, ie, im, zip_code, street, number, neighborhood, city, state,
                    is_defaulter, is_blocked, credit_limit, default_payment_method, default_payment_term
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23) 
                ON CONFLICT (id) DO UPDATE SET 
                    name=$2, email=$5, phone=$6, document=$7, pix_key=$8,
                    fantasy_name=$9, type=$10, ie=$11, im=$12, zip_code=$13, street=$14, number=$15, neighborhood=$16, city=$17, state=$18,
                    is_defaulter=$19, is_blocked=$20, credit_limit=$21, default_payment_method=$22, default_payment_term=$23,
                    deleted_at=NULL`, 
                [
                    id, name, req.user.id, familyId, sanitizeValue(email), sanitizeValue(phone), sanitizeValue(document), sanitizeValue(pixKey),
                    sanitizeValue(fantasyName), type || 'PF', sanitizeValue(ie), sanitizeValue(im), 
                    sanitizeValue(zipCode), sanitizeValue(street), sanitizeValue(number), sanitizeValue(neighborhood), sanitizeValue(city), sanitizeValue(state),
                    isDefaulter || false, isBlocked || false, creditLimit || 0, sanitizeValue(defaultPaymentMethod), defaultPaymentTerm || 0
                ]
            );
            
            await logAudit(pool, req.user.id, existing ? 'UPDATE' : 'CREATE', 'contact', id, name, existing, changes);
            res.json({ success: true });
        } catch(err) { res.status(500).json({ error: err.message }); }
    });
    router.delete('/contacts/:id', authenticateToken, async (req, res) => {
        try {
            const prev = (await pool.query('SELECT * FROM contacts WHERE id=$1', [req.params.id])).rows[0];
            await pool.query(`UPDATE contacts SET deleted_at = NOW() WHERE id = $1 AND (user_id = $2 OR family_id = (SELECT family_id FROM users WHERE id = $2))`, [req.params.id, req.user.id]);
            await logAudit(pool, req.user.id, 'DELETE', 'contact', req.params.id, prev?.name, prev);
            res.json({ success: true });
        } catch(err) { res.status(500).json({ error: err.message }); }
    });

    // --- COMPANY ---
    router.post('/company', authenticateToken, async (req, res) => {
        const { id, tradeName, legalName, cnpj, taxRegime, cnae, city, state, hasEmployees, issuesInvoices, zipCode, street, number, neighborhood, phone, email, secondaryCnaes } = req.body;
        try {
            const familyId = (await pool.query('SELECT family_id FROM users WHERE id = $1', [req.user.id])).rows[0]?.family_id || req.user.id;
            const existing = (await pool.query('SELECT * FROM company_profiles WHERE user_id = $1', [familyId])).rows[0];
            const changes = calculateChanges(existing, req.body, { tradeName: 'trade_name', legalName: 'legal_name', cnpj: 'cnpj', taxRegime: 'tax_regime', cnae: 'cnae' });
            
            await pool.query(
                `INSERT INTO company_profiles (
                    id, trade_name, legal_name, cnpj, tax_regime, cnae, city, state, has_employees, issues_invoices, user_id,
                    zip_code, street, number, neighborhood, phone, email, secondary_cnaes
                ) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) 
                 ON CONFLICT (user_id) DO UPDATE SET 
                    trade_name=$2, legal_name=$3, cnpj=$4, tax_regime=$5, cnae=$6, city=$7, state=$8, has_employees=$9, issues_invoices=$10,
                    zip_code=$12, street=$13, number=$14, neighborhood=$15, phone=$16, email=$17, secondary_cnaes=$18`, 
                [
                    id, tradeName, legalName, cnpj, taxRegime, cnae, city, state, hasEmployees, issuesInvoices, familyId,
                    zipCode, street, number, neighborhood, phone, email, secondaryCnaes
                ]
            );
            await logAudit(pool, req.user.id, existing ? 'UPDATE' : 'CREATE', 'company', id, tradeName, existing, changes);
            res.json({ success: true });
        } catch(err) { res.status(500).json({ error: err.message }); }
    });

    const createPjEndpoints = (path, table, entity) => {
        router.post(`/${path}`, authenticateToken, async (req, res) => {
            const { id, name, code } = req.body;
            try {
                const familyId = await getFamilyId(req.user.id);
                // Ensure column exists
                try { await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS family_id TEXT`); } catch(e) {}

                const existing = (await pool.query(`SELECT * FROM ${table} WHERE id=$1`, [id])).rows[0];
                const changes = calculateChanges(existing, req.body, { name: 'name', code: 'code' });
                
                if (code !== undefined) {
                    await pool.query(`INSERT INTO ${table} (id, name, code, user_id, family_id) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO UPDATE SET name=$2, code=$3, deleted_at=NULL`, [id, name, code, req.user.id, familyId]);
                } else {
                    await pool.query(`INSERT INTO ${table} (id, name, user_id, family_id) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET name=$2, deleted_at=NULL`, [id, name, req.user.id, familyId]);
                }
                
                await logAudit(pool, req.user.id, existing ? 'UPDATE' : 'CREATE', entity, id, name, existing, changes);
                res.json({ success: true });
            } catch(err) { res.status(500).json({ error: err.message }); }
        });
        router.delete(`/${path}/:id`, authenticateToken, async (req, res) => {
            try {
                const prev = (await pool.query(`SELECT * FROM ${table} WHERE id=$1`, [req.params.id])).rows[0];
                await pool.query(`UPDATE ${table} SET deleted_at = NOW() WHERE id=$1 AND ${familyCheckParam2}`, [req.params.id, req.user.id]);
                await logAudit(pool, req.user.id, 'DELETE', entity, req.params.id, prev?.name, prev);
                res.json({ success: true });
            } catch(err) { res.status(500).json({ error: err.message }); }
        });
    };
    createPjEndpoints('branches', 'branches', 'branch');
    createPjEndpoints('cost-centers', 'cost_centers', 'costCenter');
    createPjEndpoints('departments', 'departments', 'department');
    createPjEndpoints('projects', 'projects', 'project');

    // --- MODULES ---
    router.post('/modules/clients', authenticateToken, async (req, res) => {
        const { id, contactId, notes, birthDate, moduleTag, insurance, allergies, medications } = req.body;
        try {
            const familyId = await getFamilyId(req.user.id);
            await pool.query(`ALTER TABLE module_clients ADD COLUMN IF NOT EXISTS family_id TEXT`);
            await pool.query(`INSERT INTO module_clients (id, contact_id, notes, birth_date, module_tag, insurance, allergies, medications, user_id, family_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (id) DO UPDATE SET contact_id=$2, notes=$3, birth_date=$4, module_tag=$5, insurance=$6, allergies=$7, medications=$8, deleted_at=NULL`, [id, contactId, notes||'', sanitizeValue(birthDate), moduleTag||'GENERAL', sanitizeValue(insurance), sanitizeValue(allergies), sanitizeValue(medications), req.user.id, familyId]);
            res.json({ success: true });
        } catch(err) { res.status(500).json({ error: err.message }); }
    });
    router.delete('/modules/clients/:id', authenticateToken, async (req, res) => {
        try {
            await pool.query(`UPDATE module_clients SET deleted_at = NOW() WHERE id=$1 AND ${familyCheckParam2}`, [req.params.id, req.user.id]);
            res.json({ success: true });
        } catch(err) { res.status(500).json({ error: err.message }); }
    });
    
    router.post('/modules/services', authenticateToken, async (req, res) => {
        const { id, name, code, defaultPrice, moduleTag } = req.body;
        try {
            const familyId = await getFamilyId(req.user.id);
            await pool.query(`ALTER TABLE module_services ADD COLUMN IF NOT EXISTS family_id TEXT`);
            await pool.query(`INSERT INTO module_services (id, name, code, default_price, module_tag, user_id, family_id) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO UPDATE SET name=$2, code=$3, default_price=$4, module_tag=$5, deleted_at=NULL`, [id, name, sanitizeValue(code), defaultPrice||0, moduleTag||'GENERAL', req.user.id, familyId]);
            res.json({ success: true });
        } catch(err) { res.status(500).json({ error: err.message }); }
    });
    router.delete('/modules/services/:id', authenticateToken, async (req, res) => {
        try {
            await pool.query(`UPDATE module_services SET deleted_at = NOW() WHERE id=$1 AND ${familyCheckParam2}`, [req.params.id, req.user.id]);
            res.json({ success: true });
        } catch(err) { res.status(500).json({ error: err.message }); }
    });
    
    router.post('/modules/appointments', authenticateToken, async (req, res) => {
        const { id, clientId, serviceId, date, status, notes, transactionId, moduleTag } = req.body;
        try {
            const familyId = await getFamilyId(req.user.id);
            await pool.query(`ALTER TABLE module_appointments ADD COLUMN IF NOT EXISTS family_id TEXT`);
            await pool.query(`INSERT INTO module_appointments (id, client_id, service_id, date, status, notes, transaction_id, module_tag, user_id, family_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (id) DO UPDATE SET client_id=$2, service_id=$3, date=$4, status=$5, notes=$6, transaction_id=$7, module_tag=$8, deleted_at=NULL`, [id, clientId, sanitizeValue(serviceId), date, status, notes, sanitizeValue(transactionId), moduleTag||'GENERAL', req.user.id, familyId]);
            res.json({ success: true });
        } catch(err) { res.status(500).json({ error: err.message }); }
    });
    router.delete('/modules/appointments/:id', authenticateToken, async (req, res) => {
        try {
            await pool.query(`UPDATE module_appointments SET deleted_at = NOW() WHERE id=$1 AND ${familyCheckParam2}`, [req.params.id, req.user.id]);
            res.json({ success: true });
        } catch(err) { res.status(500).json({ error: err.message }); }
    });

    return router;
}
