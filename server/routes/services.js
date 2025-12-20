
import express from 'express';
import pool from '../db.js';
import crypto from 'crypto';
import { authenticateToken, calculateChanges, sanitizeValue, familyCheckParam2 } from '../middleware.js';
import { sendEmail } from '../services/email.js';

const router = express.Router();

export default function(logAudit) {

    // --- HELPER ---
    const getFamilyId = async (userId) => {
        const res = await pool.query('SELECT family_id FROM users WHERE id = $1', [userId]);
        return res.rows[0]?.family_id || userId;
    };

    // --- PUBLIC ACCESS ROUTES ---

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

            if (orderRes.rows.length === 0) return res.status(404).json({ error: "Orçamento não encontrado ou link expirado." });

            const order = orderRes.rows[0];
            if (typeof order.items === 'string') order.items = JSON.parse(order.items);

            res.json(order);
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.post('/services/public/order/:token/status', async (req, res) => {
        const { token } = req.params;
        const { status, notes } = req.body;
        try {
            const orderRes = await pool.query('SELECT id, family_id, description FROM commercial_orders WHERE access_token = $1', [token]);
            if (orderRes.rows.length === 0) return res.status(404).json({ error: "Inválido." });

            const orderId = orderRes.rows[0].id;
            await pool.query('UPDATE commercial_orders SET status = $1 WHERE id = $2', [status, orderId]);
            await logAudit(pool, 'EXTERNAL_CLIENT', 'UPDATE', 'order', orderId, `Status alterado via link público: ${status} (${notes || ''})`);
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // --- PROTECTED ROUTES ---

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
                const subject = `Orçamento: ${order.description}`;
                const items = Array.isArray(order.items) ? order.items : (typeof order.items === 'string' ? JSON.parse(order.items) : []);
                
                const itemsHtml = items.map(i => `
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;">${i.description}</td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${i.quantity}</td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">R$ ${Number(i.unitPrice).toFixed(2)}</td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;"><strong>R$ ${Number(i.totalPrice).toFixed(2)}</strong></td>
                    </tr>
                `).join('');

                const body = `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                        <h2 style="color: #4f46e5;">Olá, ${contact.name}!</h2>
                        <p>Temos um novo orçamento disponível para sua análise:</p>
                        
                        <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
                            <strong>Descrição:</strong> ${order.description}<br>
                            <strong>Data:</strong> ${new Date(order.date).toLocaleDateString('pt-BR')}
                        </div>

                        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
                            <thead>
                                <tr style="background: #f3f4f6; color: #374151;">
                                    <th style="padding: 10px; text-align: left;">Item</th>
                                    <th style="padding: 10px; text-align: center;">Qtd</th>
                                    <th style="padding: 10px; text-align: right;">Unit.</th>
                                    <th style="padding: 10px; text-align: right;">Subtotal</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itemsHtml}
                            </tbody>
                        </table>

                        <div style="text-align: right; font-size: 18px; margin-bottom: 30px;">
                            <span style="color: #6b7280; font-size: 14px;">Total da Proposta:</span><br>
                            <strong style="color: #4f46e5; font-size: 24px;">R$ ${Number(order.amount).toFixed(2)}</strong>
                        </div>

                        <p>Você pode visualizar mais detalhes e aprovar online clicando no botão abaixo:</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${publicUrl}" style="display: inline-block; background: #4f46e5; color: white; padding: 15px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.4);">Acessar Portal do Cliente</a>
                        </div>
                        <p style="color: #9ca3af; font-size: 11px; margin-top: 40px; text-align: center;">Este link é seguro e exclusivo. Processado por FinManager Pro.</p>
                    </div>
                `;
                await sendEmail(contact.email, subject, body, body);
            }

            res.json({ url: publicUrl, token });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // --- SERVICE ORDERS (OS) ---
    router.post('/services/os', authenticateToken, async (req, res) => {
        const { id, title, description, contactId, status, totalAmount, startDate, endDate, items, type, origin, priority, openedAt } = req.body;
        try {
            const familyId = await getFamilyId(req.user.id);
            const existing = (await pool.query('SELECT * FROM service_orders WHERE id=$1', [id])).rows[0];
            if (existing && existing.family_id !== familyId) return res.status(403).json({ error: "Acesso negado." });

            await pool.query(
                `INSERT INTO service_orders (id, title, description, contact_id, status, total_amount, start_date, end_date, items, type, origin, priority, opened_at, user_id, family_id, created_at) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW()) 
                 ON CONFLICT (id) DO UPDATE SET title=$2, description=$3, contact_id=$4, status=$5, total_amount=$6, start_date=$7, end_date=$8, items=$9, type=$10, origin=$11, priority=$12, opened_at=$13, deleted_at=NULL`,
                [id, title, description, sanitizeValue(contactId), status, totalAmount || 0, sanitizeValue(startDate), sanitizeValue(endDate), JSON.stringify(items || []), type, origin, priority, sanitizeValue(openedAt), req.user.id, familyId]
            );
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

    // --- COMMERCIAL ORDERS ---
    router.post('/services/orders', authenticateToken, async (req, res) => {
        const { id, type, description, contactId, amount, grossAmount, discountAmount, taxAmount, items, date, status, transactionId } = req.body;
        try {
            const familyId = await getFamilyId(req.user.id);
            const existing = (await pool.query('SELECT * FROM commercial_orders WHERE id=$1', [id])).rows[0];
            if (existing && existing.family_id !== familyId) return res.status(403).json({ error: "Acesso negado." });

            await pool.query(
                `INSERT INTO commercial_orders (id, type, description, contact_id, amount, gross_amount, discount_amount, tax_amount, items, date, status, transaction_id, user_id, family_id, created_at) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW()) 
                 ON CONFLICT (id) DO UPDATE SET type=$2, description=$3, contact_id=$4, amount=$5, gross_amount=$6, discount_amount=$7, tax_amount=$8, items=$9, date=$10, status=$11, transaction_id=$12, deleted_at=NULL`,
                [id, type, description, sanitizeValue(contactId), amount || 0, grossAmount || 0, discountAmount || 0, taxAmount || 0, JSON.stringify(items || []), date, status, sanitizeValue(transactionId), req.user.id, familyId]
            );
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
