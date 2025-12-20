
import express from 'express';
import pool from '../db.js';
import crypto from 'crypto';
import { authenticateToken, sanitizeValue } from '../middleware.js';
import { sendEmail } from '../services/email.js';

const router = express.Router();

export default function(logAudit) {

    const getFamilyId = async (userId) => {
        const res = await pool.query('SELECT family_id FROM users WHERE id = $1', [userId]);
        return res.rows[0]?.family_id || userId;
    };

    // --- PUBLIC ACCESS ROUTES (Área do Cliente) ---

    router.get('/services/public/order/:token', async (req, res) => {
        try {
            const { token } = req.params;
            const orderRes = await pool.query(`
                SELECT o.*, c.name as contact_name, u.name as company_name, cp.trade_name, cp.phone as company_phone, cp.email as company_email
                FROM commercial_orders o
                LEFT JOIN contacts c ON o.contact_id = c.id
                JOIN users u ON o.user_id = u.id
                LEFT JOIN company_profiles cp ON o.family_id = cp.user_id
                WHERE o.access_token = $1 AND o.deleted_at IS NULL
            `, [token]);

            if (orderRes.rows.length === 0) {
                return res.status(404).json({ error: "Orçamento não encontrado ou expirado." });
            }

            const order = orderRes.rows[0];
            if (typeof order.items === 'string') order.items = JSON.parse(order.items);
            res.json(order);
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.post('/services/public/order/:token/status', async (req, res) => {
        const { token } = req.params;
        const { status } = req.body;
        try {
            // Busca o family_id da ordem para saber quem notificar
            const orderRes = await pool.query('SELECT id, family_id, status, description FROM commercial_orders WHERE access_token = $1 AND deleted_at IS NULL', [token]);
            if (orderRes.rows.length === 0) return res.status(404).json({ error: "Orçamento não encontrado." });

            const order = orderRes.rows[0];
            
            // Impede alterações se já estiver finalizado
            if (['CONFIRMED', 'CANCELED'].includes(order.status)) {
                return res.status(400).json({ error: "Este documento já foi processado." });
            }

            // Atualiza o banco
            await pool.query('UPDATE commercial_orders SET status = $1 WHERE id = $2', [status, order.id]);
            
            // GATILHO DE REATIVIDADE: 
            // O sinal é enviado para a sala do 'family_id' da ordem, que é onde o gestor está ouvindo.
            await logAudit(pool, 'EXTERNAL_CLIENT', 'UPDATE', 'order', order.id, `Cliente respondeu ao orçamento: ${status}`, null, null, order.family_id);
            
            res.json({ success: true });
        } catch (err) { 
            console.error("Public Portal Error:", err);
            res.status(500).json({ error: err.message }); 
        }
    });

    // --- PROTECTED ROUTES (Dashboard do Gestor) ---

    router.post('/services/orders/:id/share', authenticateToken, async (req, res) => {
        const { channel } = req.body;
        try {
            const familyId = await getFamilyId(req.user.id);
            const orderRes = await pool.query('SELECT * FROM commercial_orders WHERE id = $1 AND family_id = $2', [req.params.id, familyId]);
            if (orderRes.rows.length === 0) return res.status(404).json({ error: "Pedido não encontrado." });
            
            const order = orderRes.rows[0];
            let token = order.access_token;
            if (!token) {
                token = crypto.randomBytes(16).toString('hex');
                await pool.query('UPDATE commercial_orders SET access_token = $1 WHERE id = $2', [token, req.params.id]);
            }

            const publicUrl = `${req.get('origin')}?orderToken=${token}`;
            const contactRes = await pool.query('SELECT * FROM contacts WHERE id = $1', [order.contact_id]);
            const contact = contactRes.rows[0];

            if (channel === 'EMAIL' && contact?.email) {
                const subject = `Proposta Comercial: ${order.description}`;
                const body = `<div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 500px;">
                    <h2>Olá, ${contact.name}!</h2>
                    <p>Sua proposta para <strong>${order.description}</strong> está pronta.</p>
                    <p>Valor total: <strong>R$ ${Number(order.amount).toLocaleString('pt-BR')}</strong></p>
                    <a href="${publicUrl}" style="background: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Ver e Aprovar Online</a>
                </div>`;
                await sendEmail(contact.email, subject, body, body);
            }

            res.json({ url: publicUrl, token });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.post('/services/os', authenticateToken, async (req, res) => {
        const { id, title, description, contactId, status, totalAmount, startDate, endDate, items, type, origin, priority, openedAt } = req.body;
        try {
            const familyId = await getFamilyId(req.user.id);
            const existing = (await pool.query('SELECT id FROM service_orders WHERE id=$1', [id])).rows[0];

            await pool.query(
                `INSERT INTO service_orders (id, title, description, contact_id, status, total_amount, start_date, end_date, items, type, origin, priority, opened_at, user_id, family_id) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) 
                 ON CONFLICT (id) DO UPDATE SET title=$2, description=$3, contact_id=$4, status=$5, total_amount=$6, start_date=$7, end_date=$8, items=$9, type=$10, origin=$11, priority=$12, opened_at=$13, deleted_at=NULL`,
                [id, title, description, sanitizeValue(contactId), status, totalAmount || 0, sanitizeValue(startDate), sanitizeValue(endDate), JSON.stringify(items || []), type, origin, priority, sanitizeValue(openedAt), req.user.id, familyId]
            );
            
            await logAudit(pool, req.user.id, existing ? 'UPDATE' : 'CREATE', 'os', id, title);
            res.json({ success: true });
        } catch(err) { res.status(500).json({ error: err.message }); }
    });

    router.delete('/services/os/:id', authenticateToken, async (req, res) => {
        try {
            const familyId = await getFamilyId(req.user.id);
            await pool.query(`UPDATE service_orders SET deleted_at = NOW() WHERE id=$1 AND family_id=$2`, [req.params.id, familyId]);
            await logAudit(pool, req.user.id, 'DELETE', 'os', req.params.id, 'OS removida');
            res.json({ success: true });
        } catch(err) { res.status(500).json({ error: err.message }); }
    });

    router.post('/services/orders', authenticateToken, async (req, res) => {
        const { id, type, description, contactId, amount, grossAmount, discountAmount, taxAmount, items, date, status, transactionId } = req.body;
        try {
            const familyId = await getFamilyId(req.user.id);
            const existing = (await pool.query('SELECT id FROM commercial_orders WHERE id=$1', [id])).rows[0];

            await pool.query(
                `INSERT INTO commercial_orders (id, type, description, contact_id, amount, gross_amount, discount_amount, tax_amount, items, date, status, transaction_id, user_id, family_id) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) 
                 ON CONFLICT (id) DO UPDATE SET type=$2, description=$3, contact_id=$4, amount=$5, gross_amount=$6, discount_amount=$7, tax_amount=$8, items=$9, date=$10, status=$11, transaction_id=$12, deleted_at=NULL`,
                [id, type, description, sanitizeValue(contactId), amount || 0, grossAmount || 0, discountAmount || 0, taxAmount || 0, JSON.stringify(items || []), date, status, sanitizeValue(transactionId), req.user.id, familyId]
            );
            
            await logAudit(pool, req.user.id, existing ? 'UPDATE' : 'CREATE', 'order', id, description);
            res.json({ success: true });
        } catch(err) { res.status(500).json({ error: err.message }); }
    });

    router.delete('/services/orders/:id', authenticateToken, async (req, res) => {
        try {
            const familyId = await getFamilyId(req.user.id);
            await pool.query(`UPDATE commercial_orders SET deleted_at = NOW() WHERE id=$1 AND family_id=$2`, [req.params.id, familyId]);
            await logAudit(pool, req.user.id, 'DELETE', 'order', req.params.id, 'Venda removida');
            res.json({ success: true });
        } catch(err) { res.status(500).json({ error: err.message }); }
    });

    router.post('/services/contracts', authenticateToken, async (req, res) => {
        const { id, title, contactId, value, startDate, endDate, status, billingDay } = req.body;
        try {
            const familyId = await getFamilyId(req.user.id);
            const existing = (await pool.query('SELECT id FROM contracts WHERE id=$1', [id])).rows[0];
            await pool.query(
                `INSERT INTO contracts (id, title, contact_id, value, start_date, end_date, status, billing_day, user_id, family_id) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
                 ON CONFLICT (id) DO UPDATE SET title=$2, contact_id=$3, value=$4, start_date=$5, end_date=$6, status=$7, billing_day=$8, deleted_at=NULL`,
                [id, title, sanitizeValue(contactId), value || 0, startDate, sanitizeValue(endDate), status, billingDay || null, req.user.id, familyId]
            );
            await logAudit(pool, req.user.id, existing ? 'UPDATE' : 'CREATE', 'contract', id, title);
            res.json({ success: true });
        } catch(err) { res.status(500).json({ error: err.message }); }
    });

    router.post('/services/invoices', authenticateToken, async (req, res) => {
        const { id, number, series, type, amount, issueDate, status, contactId, fileUrl } = req.body;
        try {
            const familyId = await getFamilyId(req.user.id);
            const existing = (await pool.query('SELECT id FROM invoices WHERE id=$1', [id])).rows[0];
            await pool.query(
                `INSERT INTO invoices (id, number, series, type, amount, issue_date, status, contact_id, file_url, user_id, family_id) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
                 ON CONFLICT (id) DO UPDATE SET number=$2, series=$3, type=$4, amount=$5, issue_date=$6, status=$7, contact_id=$8, file_url=$9, deleted_at=NULL`,
                [id, number, series, type, amount || 0, issueDate, status, sanitizeValue(contactId), fileUrl, req.user.id, familyId]
            );
            await logAudit(pool, req.user.id, existing ? 'UPDATE' : 'CREATE', 'invoice', id, `NF ${number}`);
            res.json({ success: true });
        } catch(err) { res.status(500).json({ error: err.message }); }
    });

    return router;
}
