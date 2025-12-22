
import express from 'express';
import pool from '../db.js';
import crypto from 'crypto';
import multer from 'multer';
import { authenticateToken, sanitizeValue } from '../middleware.js';
import { sendEmail } from '../services/email.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

export default function(logAudit) {

    const getFamilyId = async (userId) => {
        const res = await pool.query('SELECT family_id FROM users WHERE id = $1', [userId]);
        return res.rows[0]?.family_id || userId;
    };

    // --- ROTAS PÚBLICAS (Acesso via Token, sem Login) ---
    
    router.get('/public/order/:token', async (req, res) => {
        const { token } = req.params;
        try {
            const orderRes = await pool.query(`
                SELECT 
                    o.*, 
                    c.name as contact_name, 
                    c.email as contact_email,
                    u.name as owner_name,
                    cp.trade_name,
                    cp.legal_name as company_name,
                    cp.phone as company_phone,
                    cp.email as company_email
                FROM commercial_orders o
                LEFT JOIN contacts c ON o.contact_id = c.id
                JOIN users u ON o.user_id = u.id
                LEFT JOIN company_profiles cp ON o.family_id = cp.user_id
                WHERE o.access_token = $1 AND o.deleted_at IS NULL
            `, [token]);

            if (orderRes.rows.length === 0) {
                return res.status(404).json({ error: "Orçamento não encontrado ou link expirado." });
            }

            const order = orderRes.rows[0];
            // Sanitização de itens (JSON string -> Object)
            if (typeof order.items === 'string') {
                try { order.items = JSON.parse(order.items); } catch (e) { order.items = []; }
            }

            res.json(order);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/public/order/:token/status', async (req, res) => {
        const { token } = req.params;
        const { status, notes } = req.body;
        try {
            const orderRes = await pool.query('SELECT id, description, family_id, contact_id FROM commercial_orders WHERE access_token = $1', [token]);
            if (orderRes.rows.length === 0) return res.status(404).json({ error: "Orçamento inválido." });

            const order = orderRes.rows[0];
            
            await pool.query(
                'UPDATE commercial_orders SET status = $1 WHERE id = $2',
                [status, order.id]
            );

            // Log de Auditoria e Gatilho Real-time (Socket)
            await logAudit(
                pool, 
                'EXTERNAL_CLIENT', 
                'UPDATE', 
                'order', 
                order.id, 
                `Cliente respondeu orçamento: ${status}`, 
                null, 
                { status: status },
                order.family_id // Envia para a sala da empresa dona do orçamento
            );

            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // --- XML IMPORT ---
    router.post('/invoices/import-xml', authenticateToken, upload.single('xml'), async (req, res) => {
        try {
            if (!req.file) return res.status(400).json({ error: "Arquivo não enviado." });
            
            const xmlContent = req.file.buffer.toString('utf-8');
            
            // Parser Robusto via Regex para múltiplos padrões (NFe e NFSe)
            const extract = (tag, content) => {
                const match = content.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
                return match ? match[1].trim() : null;
            };

            const sanitizeFloat = (str) => {
                if (!str) return "0";
                // Remove R$, espaços, pontos de milhar e converte vírgula decimal para ponto
                let clean = str.replace(/[R\$\s]/g, '');
                if (clean.includes(',') && clean.includes('.')) {
                    clean = clean.replace(/\./g, ''); // Remove separador de milhar
                }
                clean = clean.replace(',', '.');
                return clean;
            };

            // 1. Número da Nota
            const number = extract('nNF', xmlContent) || extract('nNFSe', xmlContent) || extract('Numero', xmlContent);
            
            // 2. Série
            const series = extract('serie', xmlContent) || extract('Serie', xmlContent);
            
            // 3. Valor (Busca agressiva por tags de valor)
            const amountStr = extract('vNF', xmlContent) || 
                              extract('vLiq', xmlContent) || 
                              extract('vServ', xmlContent) || 
                              extract('vServicos', xmlContent) || 
                              extract('vLiquido', xmlContent) ||
                              extract('ValorServicos', xmlContent) ||
                              extract('ValorLiquido', xmlContent) ||
                              extract('ValorTotal', xmlContent);
            
            const parsedAmount = parseFloat(sanitizeFloat(amountStr));

            // 4. Data de Emissão
            const dateStr = extract('dhEmi', xmlContent) || extract('dEmi', xmlContent) || extract('dhProc', xmlContent) || extract('DataEmissao', xmlContent);
            
            // 5. Descrição
            const description = extract('xDescServ', xmlContent) || extract('Discriminacao', xmlContent) || 'Importado via XML';

            // 6. Tomador (Destinatário)
            const tomaBlock = xmlContent.match(/<toma[^>]*>([\s\S]*?)<\/toma>/i) || 
                              xmlContent.match(/<dest[^>]*>([\s\S]*?)<\/dest>/i) ||
                              xmlContent.match(/<Tomador[^>]*>([\s\S]*?)<\/Tomador>/i);
            
            let customerName = 'Importado via XML';
            let customerDoc = '';

            if (tomaBlock) {
                customerName = extract('xNome', tomaBlock[1]) || extract('RazaoSocial', tomaBlock[1]) || customerName;
                customerDoc = extract('CNPJ', tomaBlock[1]) || extract('CPF', tomaBlock[1]) || extract('Cnpj', tomaBlock[1]) || extract('Cpf', tomaBlock[1]) || '';
            }

            // 7. Extração de Itens
            const items = [];

            if (xmlContent.includes('NFSe') || xmlContent.includes('infNFSe')) {
                const vServValue = parseFloat(sanitizeFloat(extract('vServ', xmlContent) || extract('vServicos', xmlContent) || extract('ValorServicos', xmlContent) || amountStr));
                items.push({
                    id: crypto.randomUUID(),
                    description: description.substring(0, 100),
                    quantity: 1,
                    unitPrice: vServValue,
                    totalPrice: vServValue,
                    isBillable: true
                });
            } else {
                const detMatches = xmlContent.match(/<det[^>]*>([\s\S]*?)<\/det>/gi);
                if (detMatches) {
                    detMatches.forEach(detHtml => {
                        const prodMatch = detHtml.match(/<prod>([\s\S]*?)<\/prod>/i);
                        if (prodMatch) {
                            const p = prodMatch[1];
                            const q = parseFloat(sanitizeFloat(extract('qCom', p) || '1'));
                            const v = parseFloat(sanitizeFloat(extract('vUnCom', p) || '0'));
                            items.push({
                                id: crypto.randomUUID(),
                                code: extract('cProd', p),
                                description: extract('xProd', p),
                                quantity: q,
                                unitPrice: v,
                                totalPrice: q * v,
                                isBillable: true
                            });
                        }
                    });
                }
            }
            
            if (isNaN(parsedAmount) || parsedAmount === 0) {
                return res.status(422).json({ error: "Não foi possível identificar o valor da nota no XML. Verifique se o arquivo é uma nota fiscal eletrônica válida." });
            }

            res.json({
                number: number,
                series: series,
                amount: parsedAmount,
                issueDate: dateStr ? dateStr.substring(0, 10) : new Date().toISOString().split('T')[0],
                contactName: customerName,
                contactDoc: customerDoc,
                description: description,
                items: items,
                status: 'ISSUED'
            });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // --- CRUD ROUTES ---
    router.post('/orders/:id/share', authenticateToken, async (req, res) => {
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
            if (channel === 'EMAIL' && contact?.email) {
                const amountFormatted = Number(order.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                const subject = `Proposta Comercial: ${order.description}`;
                const html = `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; color: #1e293b;"><div style="background-color: #4f46e5; padding: 32px; text-align: center; color: white;"><h1 style="margin: 0; font-size: 24px;">Proposta Comercial</h1><p style="margin-top: 8px; opacity: 0.9;">Enviado por ${companyName}</p></div><div style="padding: 32px;"><h2 style="margin: 0 0 16px 0; font-size: 20px;">Olá, ${contact.name}!</h2><p style="font-size: 16px; line-height: 24px;">Sua proposta referente a <strong>${order.description}</strong> já está disponível para análise.</p><div style="background-color: #f8fafc; border-radius: 12px; padding: 20px; margin: 24px 0; text-align: center;"><span style="display: block; font-size: 14px; text-transform: uppercase; color: #64748b; font-weight: bold; margin-bottom: 4px;">Valor Total</span><span style="font-size: 28px; font-weight: 800; color: #0f172a;">${amountFormatted}</span></div><div style="text-align: center; margin: 32px 0;"><a href="${publicUrl}" style="background-color: #4f46e5; color: white; padding: 16px 32px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 16px; display: inline-block;">Visualizar e Responder Agora</a></div><hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 32px 0;" /><p style="font-size: 12px; color: #94a3b8; text-align: center;">Este link de acesso é exclusivo para você. A validade desta proposta é de 7 dias.</p></div></div>`;
                await sendEmail(contact.email, subject, `Acesse sua proposta: ${publicUrl}`, html);
            }
            res.json({ url: publicUrl, token });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.post('/os', authenticateToken, async (req, res) => {
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

    router.delete('/os/:id', authenticateToken, async (req, res) => {
        try {
            const familyId = await getFamilyId(req.user.id);
            await pool.query(`UPDATE service_orders SET deleted_at = NOW() WHERE id=$1 AND family_id=$2`, [req.params.id, familyId]);
            await logAudit(pool, req.user.id, 'DELETE', 'os', req.params.id, 'OS removida');
            res.json({ success: true });
        } catch(err) { res.status(500).json({ error: err.message }); }
    });

    router.post('/orders', authenticateToken, async (req, res) => {
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

    router.delete('/orders/:id', authenticateToken, async (req, res) => {
        try {
            const familyId = await getFamilyId(req.user.id);
            await pool.query(`UPDATE commercial_orders SET deleted_at = NOW() WHERE id=$1 AND family_id=$2`, [req.params.id, familyId]);
            await logAudit(pool, req.user.id, 'DELETE', 'order', req.params.id, 'Venda removida');
            res.json({ success: true });
        } catch(err) { res.status(500).json({ error: err.message }); }
    });

    router.post('/contracts', authenticateToken, async (req, res) => {
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

    router.delete('/contracts/:id', authenticateToken, async (req, res) => {
        try {
            const familyId = await getFamilyId(req.user.id);
            await pool.query(`UPDATE contracts SET deleted_at = NOW() WHERE id=$1 AND family_id=$2`, [req.params.id, familyId]);
            await logAudit(pool, req.user.id, 'DELETE', 'contract', req.params.id, 'Contrato removido');
            res.json({ success: true });
        } catch(err) { res.status(500).json({ error: err.message }); }
    });

    router.post('/invoices', authenticateToken, async (req, res) => {
        const { id, number, series, type, amount, issueDate, status, contactId, description, items, fileUrl, orderId, serviceOrderId } = req.body;
        try {
            const familyId = await getFamilyId(req.user.id);
            const existing = (await pool.query('SELECT id FROM invoices WHERE id=$1', [id])).rows[0];
            await pool.query(
                `INSERT INTO invoices (id, number, series, type, amount, issue_date, status, contact_id, description, items, file_url, order_id, service_order_id, user_id, family_id) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) 
                 ON CONFLICT (id) DO UPDATE SET 
                    number=$2, series=$3, type=$4, amount=$5, issue_date=$6, status=$7, contact_id=$8, 
                    description=$9, items=$10, file_url=$11, order_id=$12, service_order_id=$13, deleted_at=NULL`,
                [id, number, series, type, amount || 0, issueDate, status, sanitizeValue(contactId), description, JSON.stringify(items || []), fileUrl, sanitizeValue(orderId), sanitizeValue(serviceOrderId), req.user.id, familyId]
            );
            await logAudit(pool, req.user.id, existing ? 'UPDATE' : 'CREATE', 'invoice', id, `NF ${number}`);
            res.json({ success: true });
        } catch(err) { res.status(500).json({ error: err.message }); }
    });

    router.delete('/invoices/:id', authenticateToken, async (req, res) => {
        try {
            const familyId = await getFamilyId(req.user.id);
            await pool.query(`UPDATE invoices SET deleted_at = NOW() WHERE id=$1 AND family_id=$2`, [req.params.id, familyId]);
            await logAudit(pool, req.user.id, 'DELETE', 'invoice', req.params.id, 'Nota Fiscal removida');
            res.json({ success: true });
        } catch(err) { res.status(500).json({ error: err.message }); }
    });

    return router;
}
