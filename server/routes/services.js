
import express from 'express';
import pool from '../db.js';
import crypto from 'crypto';
import { authenticateToken, calculateChanges, sanitizeValue, familyCheckParam2 } from '../middleware.js';
import { sendEmail } from '../services/email.js';

const router = express.Router();

export default function(logAudit) {

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

            if (orderRes.rows.length === 0) {
                return res.status(404).json({ error: "Este orçamento não existe ou foi removido." });
            }

            const order = orderRes.rows[0];

            if (['CANCELED', 'REJECTED', 'CANCELADA'].includes(order.status)) {
                return res.status(403).json({ error: "Este orçamento não está mais disponível para visualização." });
            }

            if (typeof order.items === 'string') order.items = JSON.parse(order.items);
            res.json(order);
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.post('/services/public/order/:token/status', async (req, res) => {
        const { token } = req.params;
        const { status, notes } = req.body;
        try {
            // Busca a ordem para pegar o ID interno e o family_id para notificação
            const orderRes = await pool.query('SELECT id, family_id, status FROM commercial_orders WHERE access_token = $1 AND deleted_at IS NULL', [token]);
            if (orderRes.rows.length === 0) return res.status(404).json({ error: "Orçamento não encontrado." });

            const order = orderRes.rows[0];
            
            if (['CONFIRMED', 'CANCELED'].includes(order.status)) {
                return res.status(400).json({ error: "Este orçamento já foi processado e não pode mais ser alterado." });
            }

            // Executa a atualização
            await pool.query('UPDATE commercial_orders SET status = $1 WHERE id = $2', [status, order.id]);
            
            // Dispara reatividade para o gestor através do family_id capturado anteriormente
            await logAudit(pool, 'EXTERNAL_CLIENT', 'UPDATE', 'order', order.id, `Status alterado via portal: ${status}`, null, null, order.family_id);
            
            res.json({ success: true });
        } catch (err) { 
            console.error("Public Status Update Error:", err);
            res.status(500).json({ error: err.message }); 
        }
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
                const subject = `Proposta Comercial: ${order.description}`;
                const items = Array.isArray(order.items) ? order.items : (typeof order.items === 'string' ? JSON.parse(order.items) : []);
                
                const itemsHtml = items.map(i => `
                    <tr>
                        <td style="padding: 12px 10px; border-bottom: 1px solid #f1f5f9; color: #1e293b;">${i.description}</td>
                        <td style="padding: 12px 10px; border-bottom: 1px solid #f1f5f9; text-align: center; color: #64748b;">${i.quantity}</td>
                        <td style="padding: 12px 10px; border-bottom: 1px solid #f1f5f9; text-align: right; color: #64748b;">R$ ${Number(i.unitPrice).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                        <td style="padding: 12px 10px; border-bottom: 1px solid #f1f5f9; text-align: right; color: #0f172a; font-weight: bold;">R$ ${Number(i.totalPrice).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                    </tr>
                `).join('');

                const body = `
                    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 20px; color: #334155;">
                        <h2 style="color: #4f46e5; margin-bottom: 5px;">Olá, ${contact.name}!</h2>
                        <p style="font-size: 16px; margin-top: 0;">Enviamos a proposta solicitada para sua análise.</p>
                        
                        <div style="background: #f8fafc; padding: 20px; border-radius: 12px; margin: 25px 0; border: 1px solid #f1f5f9;">
                            <strong style="display: block; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px;">Referência</strong>
                            <span style="font-size: 18px; font-weight: bold; color: #1e293b;">${order.description}</span>
                            <div style="margin-top: 10px; font-size: 13px; color: #94a3b8;">Data de emissão: ${new Date(order.date).toLocaleDateString('pt-BR')}</div>
                        </div>

                        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 14px;">
                            <thead>
                                <tr style="background: #f1f5f9;">
                                    <th style="padding: 12px 10px; text-align: left; border-radius: 8px 0 0 8px; color: #475569;">Item</th>
                                    <th style="padding: 12px 10px; text-align: center; color: #475569;">Qtd</th>
                                    <th style="padding: 12px 10px; text-align: right; color: #475569;">Unit.</th>
                                    <th style="padding: 12px 10px; text-align: right; border-radius: 0 8px 8px 0; color: #475569;">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itemsHtml}
                            </tbody>
                        </table>

                        <div style="text-align: right; margin-bottom: 40px; padding: 20px; background: #eef2ff; border-radius: 12px;">
                            <span style="color: #4338ca; font-size: 13px; font-weight: bold; text-transform: uppercase;">Investimento Total</span><br>
                            <strong style="color: #4f46e5; font-size: 32px;">R$ ${Number(order.amount).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
                        </div>

                        <div style="text-align: center;">
                            <p style="font-size: 14px; color: #64748b; margin-bottom: 20px;">Você pode aprovar esta proposta online com um clique:</p>
                            <a href="${publicUrl}" style="display: inline-block; background: #4f46e5; color: white; padding: 18px 40px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 16px; box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.3);">Visualizar e Aprovar</a>
                        </div>
                        
                        <p style="color: #94a3b8; font-size: 11px; margin-top: 50px; text-align: center; border-top: 1px solid #f1f5f9; pt: 20px;">
                            Este é um documento digital seguro gerado por FinManager Pro.<br>
                            Link válido enquanto a proposta estiver ativa.
                        </p>
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
