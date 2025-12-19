
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

    // --- SERVICE ORDERS (OS) ---
    router.post('/services/os', authenticateToken, async (req, res) => {
        const { id, title, description, contactId, status, totalAmount, startDate, endDate, items, type, origin, priority, openedAt } = req.body;
        try {
            const familyId = await getFamilyId(req.user.id);
            
            // Verifica se o registro existe e se pertence à família
            const existing = (await pool.query('SELECT * FROM service_orders WHERE id=$1', [id])).rows[0];
            if (existing && existing.family_id !== familyId) {
                return res.status(403).json({ error: "Acesso negado ao registro." });
            }

            const changes = calculateChanges(existing, req.body, { title: 'title', status: 'status', totalAmount: 'total_amount' });

            await pool.query(
                `INSERT INTO service_orders (
                    id, title, description, contact_id, status, total_amount, 
                    start_date, end_date, items, type, origin, priority, opened_at,
                    user_id, family_id, created_at
                ) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW()) 
                 ON CONFLICT (id) DO UPDATE SET 
                    title=$2, description=$3, contact_id=$4, status=$5, total_amount=$6, 
                    start_date=$7, end_date=$8, items=$9, type=$10, origin=$11, 
                    priority=$12, opened_at=$13, deleted_at=NULL`,
                [
                    id, title, description, sanitizeValue(contactId), status, totalAmount || 0, 
                    sanitizeValue(startDate), sanitizeValue(endDate), JSON.stringify(items || []),
                    type, origin, priority, sanitizeValue(openedAt),
                    req.user.id, familyId
                ]
            );
            
            await logAudit(pool, req.user.id, existing ? 'UPDATE' : 'CREATE', 'service_order', id, title, existing, changes);
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

    // --- COMMERCIAL ORDERS (Sales/Purchases) ---
    router.post('/services/orders', authenticateToken, async (req, res) => {
        const { id, type, description, contactId, amount, grossAmount, discountAmount, taxAmount, items, date, status, transactionId } = req.body;
        try {
            const familyId = await getFamilyId(req.user.id);
            
            const existing = (await pool.query('SELECT * FROM commercial_orders WHERE id=$1', [id])).rows[0];
            if (existing && existing.family_id !== familyId) {
                return res.status(403).json({ error: "Acesso negado ao pedido." });
            }

            await pool.query(
                `INSERT INTO commercial_orders (id, type, description, contact_id, amount, gross_amount, discount_amount, tax_amount, items, date, status, transaction_id, user_id, family_id, created_at) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW()) 
                 ON CONFLICT (id) DO UPDATE SET type=$2, description=$3, contact_id=$4, amount=$5, gross_amount=$6, discount_amount=$7, tax_amount=$8, items=$9, date=$10, status=$11, transaction_id=$12, deleted_at=NULL`,
                [id, type, description, sanitizeValue(contactId), amount || 0, grossAmount || 0, discountAmount || 0, taxAmount || 0, JSON.stringify(items || []), date, status, sanitizeValue(transactionId), req.user.id, familyId]
            );
            await logAudit(pool, req.user.id, existing ? 'UPDATE' : 'CREATE', 'order', id, `${type}: ${description}`, existing);
            res.json({ success: true });
        } catch(err) { res.status(500).json({ error: err.message }); }
    });

    router.delete('/services/orders/:id', authenticateToken, async (req, res) => {
        try {
            const familyId = await getFamilyId(req.user.id);
            await pool.query(`UPDATE commercial_orders SET deleted_at = NOW() WHERE id=$1 AND family_id=$2`, [req.params.id, familyId]);
            res.json({ success: true });
        } catch(err) { res.status(500).json({ error: err.message }); }
    });

    // --- CONTRACTS ---
    router.post('/services/contracts', authenticateToken, async (req, res) => {
        const { id, title, contactId, value, startDate, endDate, status, billingDay } = req.body;
        try {
            const familyId = await getFamilyId(req.user.id);
            const existing = (await pool.query('SELECT * FROM contracts WHERE id=$1', [id])).rows[0];
            if (existing && existing.family_id !== familyId) return res.status(403).json({ error: "Acesso negado." });

            await pool.query(
                `INSERT INTO contracts (id, title, contact_id, value, start_date, end_date, status, billing_day, user_id, family_id, created_at) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()) 
                 ON CONFLICT (id) DO UPDATE SET title=$2, contact_id=$3, value=$4, start_date=$5, end_date=$6, status=$7, billing_day=$8, deleted_at=NULL`,
                [id, title, sanitizeValue(contactId), value || 0, startDate, sanitizeValue(endDate), status, billingDay || null, req.user.id, familyId]
            );
            await logAudit(pool, req.user.id, existing ? 'UPDATE' : 'CREATE', 'contract', id, title, existing);
            res.json({ success: true });
        } catch(err) { res.status(500).json({ error: err.message }); }
    });

    // --- INVOICES ---
    router.post('/services/invoices', authenticateToken, async (req, res) => {
        const { id, number, series, type, amount, issueDate, status, contactId, fileUrl } = req.body;
        try {
            const familyId = await getFamilyId(req.user.id);
            const existing = (await pool.query('SELECT * FROM invoices WHERE id=$1', [id])).rows[0];
            if (existing && existing.family_id !== familyId) return res.status(403).json({ error: "Acesso negado." });

            await pool.query(
                `INSERT INTO invoices (id, number, series, type, amount, issue_date, status, contact_id, file_url, user_id, family_id, created_at) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW()) 
                 ON CONFLICT (id) DO UPDATE SET number=$2, series=$3, type=$4, amount=$5, issue_date=$6, status=$7, contact_id=$8, file_url=$9, deleted_at=NULL`,
                [id, number, series, type, amount || 0, issueDate, status, sanitizeValue(contactId), fileUrl, req.user.id, familyId]
            );
            res.json({ success: true });
        } catch(err) { res.status(500).json({ error: err.message }); }
    });

    return router;
}
