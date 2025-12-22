
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
            // Buscamos a ordem e garantimos o ID do Workspace (family_id do dono)
            const orderRes = await pool.query(`
                SELECT o.*, c.name as contact_name, u.name as company_name, 
                       cp.trade_name, cp.phone as company_phone, cp.email as company_email,
                       u.family_id as workspace_id
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
            
            // Garantimos que o workspace_id seja o ID do dono se o family_id for nulo
            order.workspace_id = order.workspace_id || order.user_id;
            
            res.json(order);
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.post('/services/public/order/:token/status', async (req, res) => {
        const { token } = req.params;
        const { status } = req.body;
        try {
            const orderRes = await pool.query(`
                SELECT o.id, o.family_id, o.user_id, o.status, u.family_id as owner_workspace 
                FROM commercial_orders o 
                JOIN users u ON o.user_id = u.id
                WHERE o.access_token = $1 AND o.deleted_at IS NULL
            `, [token]);

            if (orderRes.rows.length === 0) return res.status(404).json({ error: "Orçamento não encontrado." });

            const order = orderRes.rows[0];
            if (['CONFIRMED', 'CANCELED'].includes(order.status)) {
                return res.status(400).json({ error: "Esta proposta já foi finalizada." });
            }

            await pool.query('UPDATE commercial_orders SET status = $1 WHERE id = $2', [status, order.id]);
            
            // O targetRoom deve ser o ID do Workspace (Dono)
            const targetRoom = order.owner_workspace || order.family_id || order.user_id;

            await logAudit(pool, 'EXTERNAL_CLIENT', 'UPDATE', 'order', order.id, `Cliente alterou status para: ${status}`, null, null, targetRoom);
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
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
            const companyRes = await pool.query('SELECT trade_name FROM company_profiles WHERE user_id = $1', [familyId]);
            const companyName = companyRes.rows[0]?.trade_name || req.user.name;

            if (channel === 'EMAIL') {
                if (!contact?.email) {
                    return res.status(400).json({ error: "O contato selecionado não possui um e-mail cadastrado." });
                }

                const subject = `Proposta Comercial: ${order.description}`;
                const amountFormatted = Number(order.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                
                const plainText = `Olá, ${contact.name}! Sua proposta para ${order.description} no valor de ${amountFormatted} está pronta. Acesse em: ${publicUrl}`;
                
                const html = `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; color: #1e293b;">
                    <div style="background-color: #4f46e5; padding: 32px; text-align: center; color: white;">
                        <h1 style="margin: 0; font-size: 24px;">Proposta Comercial</h1>
                        <p style="margin-top: 8px; opacity: 0.9;">Enviado por ${companyName}</p>
                    </div>
                    <div style="padding: 32px;">
                        <h2 style="margin: 0 0 16px 0; font-size: 20px;">Olá, ${contact.name}!</h2>
                        <p style="font-size: 16px; line-height: 24px;">Sua proposta referente a <strong>${order.description}</strong> já está disponível para análise.</p>
                        
                        <div style="background-color: #f8fafc; border-radius: 12px; padding: 20px; margin: 24px 0; text-align: center;">
                            <span style="display: block; font-size: 14px; text-transform: uppercase; color: #64748b; font-weight: bold; margin-bottom: 4px;">Valor Total</span>
                            <span style="font-size: 28px; font-weight: 800; color: #0f172a;">${amountFormatted}</span>
                        </div>

                        <div style="text-align: center; margin: 32px 0;">
                            <a href="${publicUrl}" style="background-color: #4f46e5; color: white; padding: 16px 32px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 16px; display: inline-block;">Visualizar e Responder Agora</a>
                        </div>

                        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 32px 0;" />
                        <p style="font-size: 12px; color: #94a3b8; text-align: center;">Este link de acesso é exclusivo para você. A validade desta proposta é de 7 dias.</p>
                    </div>
                </div>`;

                await sendEmail(contact.email, subject, plainText, html);
            }

            res.json({ url: publicUrl, token });
        } catch (err) { 
            console.error("Share Error:", err);
            res.status(500).json({ error: err.message }); 
        }
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
