
import express from 'express';
import pool from '../db.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { sendEmail } from '../services/email.js';
import { authenticateToken, familyCheckParam2, updateAccountBalance, getUserWorkspaces } from '../middleware.js';

const router = express.Router();
const WHATSAPP_API_URL = "https://graph.facebook.com/v22.0/934237103105071/messages";
const WHATSAPP_TOKEN = "EAFpabmZBi0U0BQKRhGRsH8eVtgUPLNUoDi2mg2r8bDAj9vfBcolZC9CONlSdqFVug7FXrCKZCGsgxPiIUZBc2kIdnZBbnZAVZAJFOFRk4f3ZA3bsOwEyO87bzZBGwUY0Aj0aQTHq1mcYxHaebickk8ubQsz6G4Y0hnlIxcmj0WQFKasRy8KFLobi0torRxc2NzYE5Q17KToe24ngyadf2PdbRmfKahoO26mALs6yAMUTyiZBm9ufcIod9fipU8ZCzP0mBIqgmzClQtbonxa43kQ11CGTh7f1ZAxuDPwLlZCZCTZA8c3";

// --- PERMISSION MAP (Must match types.ts ROLE_DEFINITIONS) ---
const ROLE_PERMISSIONS = {
    'ADMIN': [], // Special case: All access
    'MEMBER': ['FIN_DASHBOARD', 'FIN_TRANSACTIONS', 'FIN_CALENDAR', 'FIN_ACCOUNTS', 'FIN_CARDS', 'FIN_GOALS', 'FIN_REPORTS', 'FIN_CATEGORIES', 'FIN_CONTACTS'],
    'ACCOUNTANT': ['FIN_REPORTS', 'FIN_TRANSACTIONS', 'SYS_LOGS', 'FIN_DASHBOARD', 'FIN_ADVISOR'],
    'DENTIST': ['ODONTO_AGENDA', 'ODONTO_PATIENTS', 'ODONTO_PROCEDURES', 'FIN_CONTACTS'],
    'SALES': ['SRV_SALES', 'SRV_CLIENTS', 'SRV_OS', 'SRV_NF', 'FIN_CONTACTS'],
    'OPERATOR': ['FIN_TRANSACTIONS', 'SRV_OS', 'FIN_CALENDAR', 'SRV_PURCHASES']
};

// --- HELPERS (WHATSAPP) ---
const sendWhatsappMessage = async (to, templateName = 'jaspers_market_plain_text_v1') => {
    if (!to) return;
    const cleanPhone = to.replace(/\D/g, '');
    try {
        const response = await fetch(WHATSAPP_API_URL, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ messaging_product: "whatsapp", to: cleanPhone, type: "template", template: { name: templateName, language: { code: "en_US" } } })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || "Failed to send message");
        return data;
    } catch (e) { console.error("WhatsApp Exception:", e); throw e; }
};

// --- LOGGING HELPER (Autocreate Table) ---
const logNotification = async (userId, channel, recipient, subject, content, status) => {
    try {
        // Ensure table exists (Lazy migration for this demo environment)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS notification_logs (
                id SERIAL PRIMARY KEY,
                user_id TEXT REFERENCES users(id),
                channel TEXT NOT NULL, 
                recipient TEXT NOT NULL,
                subject TEXT,
                content TEXT,
                status TEXT DEFAULT 'SENT',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        await pool.query(
            `INSERT INTO notification_logs (user_id, channel, recipient, subject, content, status) VALUES ($1, $2, $3, $4, $5, $6)`,
            [userId, channel, recipient, subject, content, status]
        );
    } catch (e) {
        console.error("Failed to log notification:", e);
    }
};

// --- NFC-e Helpers ---
const extractAccessKey = (urlStr) => {
    try {
        const url = new URL(urlStr);
        let p = url.searchParams.get('p');
        if (p && p.includes('|')) p = p.split('|')[0];
        if (!p) {
            const match = urlStr.match(/\d{44}/);
            if (match) return match[0];
        }
        return p ? p.replace(/\D/g, '') : null;
    } catch (e) {
        const match = urlStr.match(/p=(\d{44})/);
        if (match) return match[1];
        return null;
    }
};

const detectPaymentMethod = (html) => {
    if (html.match(/Crédito|Cartão de Crédito/i)) return 'CREDIT';
    if (html.match(/Débito|Cartão de Débito/i)) return 'DEBIT';
    if (html.match(/Pix/i)) return 'PIX';
    if (html.match(/Dinheiro/i)) return 'CASH';
    return null;
};

const robustParser = (html) => {
    let amount = null;
    const amountPatterns = [
        /class=["'][^"']*linhaShade[^"']*["'][\s\S]*?class=["'][^"']*txtMax[^"']*["'][^>]*>\s*(?:<[^>]+>)*\s*(?:R\$\s*)?([\d\.,]+)/i,
        /class=["'][^"']*txtMax[^"']*["'][^>]*>\s*(?:<[^>]+>)*\s*(?:R\$\s*)?([\d\.,]+)/i,
        /Valor\s*a\s*Pagar[\s\S]*?(?:R\$\s*)?([\d\.,]+)/i
    ];
    for (const p of amountPatterns) {
        const m = html.match(p);
        if (m) { amount = m[1]; break; }
    }

    let merchant = null;
    const merchantPatterns = [
        /class=["'][^"']*txtTopo[^"']*["'][^>]*>\s*(?:<[^>]+>)*\s*([^<]+)/i,
        /id=["']lblNomeEmitente["'][^>]*>\s*([^<]+)/i,
        /Razão\s*Social[:\s]*<\/label>\s*<span>([^<]+)/i,
        /<h4[^>]*>\s*([^<]+)<\/h4>/i 
    ];
    for (const p of merchantPatterns) {
        const m = html.match(p);
        if (m) { merchant = m[1].replace(/<[^>]+>/g, '').trim(); break; }
    }

    let date = null;
    const datePatterns = [
        /<strong>\s*Emiss[ãa]o:\s*<\/strong>\s*(\d{2}\/\d{2}\/\d{4})/i,
        /(\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}:\d{2}/,
        /Data\s*de\s*Emissão.*?(\d{2}\/\d{2}\/\d{4})/i
    ];
    for (const p of datePatterns) {
        const m = html.match(p);
        if (m) { date = m[1]; break; }
    }

    return { amount, merchant, date, paymentType: detectPaymentMethod(html) };
};

const parsers = {
    '35': robustParser,
    '41': (html) => {
        const p = robustParser(html);
        if (p.amount) return p;
        const amountMatch = html.match(/Valor\s*Total.*?R\$\s*([\d\.,]+)/i);
        const merchantMatch = html.match(/id=["']u20["'][^>]*>([^<]+)<\/span>/i);
        const dateMatch = html.match(/(\d{2}\/\d{2}\/\d{4})\s+[\d:]+/);
        return {
            amount: amountMatch ? amountMatch[1] : null,
            merchant: merchantMatch ? merchantMatch[1].trim() : null,
            date: dateMatch ? dateMatch[1] : null,
            paymentType: detectPaymentMethod(html)
        };
    },
    'default': robustParser
};

export default function(logAudit) {

    // --- NOTIFICATION ROUTES ---
    
    router.post('/test-whatsapp', authenticateToken, async (req, res) => {
        const { phone } = req.body;
        try {
            const result = await sendWhatsappMessage(phone);
            // Log Success
            await logNotification(req.user.id, 'WHATSAPP', phone, 'Template Test', 'Mensagem de teste enviada via template', 'SENT');
            res.json({ success: true, data: result });
        } catch (e) { 
            // Log Failure
            await logNotification(req.user.id, 'WHATSAPP', phone, 'Template Test', e.message, 'FAILED');
            res.status(500).json({ error: e.message }); 
        }
    });

    router.post('/test-email', authenticateToken, async (req, res) => {
        const { email } = req.body;
        const subject = "Teste de Notificação";
        const body = "Este é um email de teste do FinManager.";
        try {
            await sendEmail(email, subject, body, "<h1>Olá!</h1><p>Este é um email de teste do FinManager.</p>");
            // Log Success
            await logNotification(req.user.id, 'EMAIL', email, subject, body, 'SENT');
            res.json({ success: true });
        } catch (e) { 
            console.error("Erro envio email:", e);
            let errorMessage = e.message;
            
            // Tratamento amigável para erro comum do Gmail (App Password required)
            if (errorMessage && errorMessage.includes('Application-specific password required')) {
                errorMessage = 'Para usar o Gmail, você DEVE gerar uma "Senha de App". Ative a Verificação em 2 Etapas na sua conta Google e gere uma senha em: Conta > Segurança > Senhas de app. Use essa senha no .env.';
            } else if (errorMessage && errorMessage.includes('Invalid login')) {
                errorMessage = 'Login inválido. Verifique o email e a senha no arquivo .env. Se usar Gmail, use uma Senha de App.';
            }

            // Log Failure
            await logNotification(req.user.id, 'EMAIL', email, subject, errorMessage, 'FAILED');

            res.status(500).json({ error: errorMessage }); 
        }
    });

    router.get('/notification-logs', authenticateToken, async (req, res) => {
        try {
            const familyId = (await pool.query('SELECT family_id FROM users WHERE id = $1', [req.user.id])).rows[0]?.family_id || req.user.id;
            
            // Ensure table exists before querying (just in case no log was created yet)
            await pool.query(`
                CREATE TABLE IF NOT EXISTS notification_logs (
                    id SERIAL PRIMARY KEY,
                    user_id TEXT REFERENCES users(id),
                    channel TEXT NOT NULL, 
                    recipient TEXT NOT NULL,
                    subject TEXT,
                    content TEXT,
                    status TEXT DEFAULT 'SENT',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Get logs for the whole family
            const logs = await pool.query(`
                SELECT nl.*, u.name as user_name 
                FROM notification_logs nl 
                JOIN users u ON nl.user_id = u.id 
                WHERE u.family_id = $1 
                ORDER BY nl.created_at DESC LIMIT 50
            `, [familyId]);
            
            res.json(logs.rows.map(r => ({
                id: r.id,
                userId: r.user_id,
                userName: r.user_name,
                channel: r.channel,
                recipient: r.recipient,
                subject: r.subject,
                content: r.content,
                status: r.status,
                createdAt: r.created_at
            })));
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // --- SETTINGS ---
    router.put('/profile', authenticateToken, async (req, res) => {
        const { name, email, currentPassword, newPassword } = req.body;
        const userId = req.user.id;
        try {
            const user = (await pool.query('SELECT * FROM users WHERE id = $1', [userId])).rows[0];
            let passwordHash = user.password_hash;
            if (newPassword) {
                if (!user.google_id) {
                    if (!currentPassword || !(await bcrypt.compare(currentPassword, user.password_hash))) return res.status(400).json({ error: 'Senha atual incorreta.' });
                }
                passwordHash = await bcrypt.hash(newPassword, 10);
            }
            if (email !== user.email && (await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, userId])).rows.length > 0) return res.status(400).json({ error: 'Email já está em uso.' });

            await pool.query(`UPDATE users SET name = $1, email = $2, password_hash = $3 WHERE id = $4`, [name, email, passwordHash, userId]);
            
            // Return fresh user
            const updatedUser = (await pool.query('SELECT * FROM users WHERE id = $1', [userId])).rows[0];
            const workspaces = await getUserWorkspaces(userId);
            res.json({ user: { 
                id: updatedUser.id, name: updatedUser.name, email: updatedUser.email, familyId: updatedUser.family_id,
                settings: updatedUser.settings, role: updatedUser.role, entityType: updatedUser.entity_type, workspaces
            }});
            await logAudit(pool, userId, 'UPDATE', 'user', userId, 'Perfil atualizado');
        } catch (err) { res.status(500).json({ error: 'Erro ao atualizar perfil.' }); }
    });

    router.post('/settings', authenticateToken, async (req, res) => {
        const { settings } = req.body;
        try {
            await pool.query('UPDATE users SET settings = $1 WHERE id = $2', [settings, req.user.id]);
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // --- SWITCH CONTEXT ---
    router.post('/switch-context', authenticateToken, async (req, res) => {
        const { targetFamilyId } = req.body;
        const userId = req.user.id;
        try {
            if ((await pool.query('SELECT * FROM memberships WHERE user_id = $1 AND family_id = $2', [userId, targetFamilyId])).rows.length === 0) return res.status(403).json({ error: 'Acesso negado' });
            await pool.query('UPDATE users SET family_id = $1 WHERE id = $2', [targetFamilyId, userId]);
            
            const userRow = (await pool.query('SELECT * FROM users WHERE id = $1', [userId])).rows[0];
            const workspaces = await getUserWorkspaces(userId);
            const ownerRes = await pool.query('SELECT entity_type FROM users WHERE id = $1', [targetFamilyId]);
            
            const user = { 
                id: userRow.id, name: userRow.name, email: userRow.email, familyId: userRow.family_id,
                settings: userRow.settings, role: userRow.role, entityType: ownerRes.rows[0]?.entity_type || 'PF',
                plan: userRow.plan, status: userRow.status, trialEndsAt: userRow.trial_ends_at, workspaces
            };
            const token = jwt.sign(user, process.env.JWT_SECRET || 'dev-secret-key', { expiresIn: '7d' });
            res.json({ success: true, token, user });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // --- COLLABORATION ---
    router.post('/invites', authenticateToken, async (req, res) => {
        const userId = req.user.id;
        const { roleTemplate } = req.body; // New: receive role template
        try {
            const activeFamilyId = (await pool.query('SELECT family_id FROM users WHERE id = $1', [userId])).rows[0]?.family_id;
            if (!activeFamilyId) return res.status(400).json({error: "Usuário não tem contexto ativo"});
            
            // Ensure column exists (Migration Lazy)
            try { await pool.query(`ALTER TABLE invites ADD COLUMN IF NOT EXISTS role_template TEXT`); } catch(e) {}

            const code = Math.random().toString(36).substring(2, 8).toUpperCase();
            const expiresAt = new Date(); expiresAt.setHours(expiresAt.getHours() + 24);
            await pool.query(`INSERT INTO invites (code, family_id, created_by, expires_at, role_template) VALUES ($1, $2, $3, $4, $5)`, [code, activeFamilyId, userId, expiresAt, roleTemplate || 'MEMBER']);
            res.json({ code, expiresAt });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.post('/invite/join', authenticateToken, async (req, res) => {
        const { code } = req.body;
        const userId = req.user.id;
        try {
            // Ensure column exists
            try { await pool.query(`ALTER TABLE invites ADD COLUMN IF NOT EXISTS role_template TEXT`); } catch(e) {}

            const invite = (await pool.query('SELECT * FROM invites WHERE code = $1 AND expires_at > NOW()', [code])).rows[0];
            if (!invite) return res.status(404).json({ error: 'Convite inválido ou expirado' });

            const roleKey = invite.role_template || 'MEMBER';
            const mappedRole = roleKey === 'ADMIN' ? 'ADMIN' : 'MEMBER'; 
            
            // Get permissions from map
            let permissionsToApply = [];
            if (roleKey === 'ADMIN') {
                permissionsToApply = []; 
            } else {
                permissionsToApply = ROLE_PERMISSIONS[roleKey] || ROLE_PERMISSIONS['MEMBER'];
            }

            const permissionsJson = JSON.stringify(permissionsToApply);

            await pool.query(
                `INSERT INTO memberships (user_id, family_id, role, permissions) VALUES ($1, $2, $3, $4) 
                 ON CONFLICT (user_id, family_id) DO UPDATE SET role = $3, permissions = COALESCE(memberships.permissions, $4)`, 
                [userId, invite.family_id, mappedRole, permissionsJson]
            );
            await pool.query('UPDATE users SET family_id = $1 WHERE id = $2', [invite.family_id, userId]);
            
            const userRow = (await pool.query('SELECT * FROM users WHERE id = $1', [userId])).rows[0];
            const workspaces = await getUserWorkspaces(userId);
            const ownerRes = await pool.query('SELECT entity_type FROM users WHERE id = $1', [userRow.family_id]);
            
            const user = { id: userRow.id, name: userRow.name, email: userRow.email, familyId: userRow.family_id, settings: userRow.settings, role: userRow.role, entityType: ownerRes.rows[0]?.entity_type || 'PF', workspaces };
            const token = jwt.sign(user, process.env.JWT_SECRET || 'dev-secret-key', { expiresIn: '7d' });
            res.json({ success: true, token, user });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.get('/family/members', authenticateToken, async (req, res) => {
        const userId = req.user.id;
        try {
            const familyId = (await pool.query('SELECT family_id FROM users WHERE id = $1', [userId])).rows[0]?.family_id || userId;
            const members = await pool.query(`SELECT u.id, u.name, u.email, m.role, u.entity_type, m.permissions FROM users u JOIN memberships m ON u.id = m.user_id WHERE m.family_id = $1`, [familyId]);
            
            // Fix: Parse permissions for the list view as well
            const parsedMembers = members.rows.map(m => {
                let perms = m.permissions;
                if (typeof perms === 'string') {
                    try { perms = JSON.parse(perms); } catch (e) { perms = []; }
                }
                return { ...m, permissions: Array.isArray(perms) ? perms : [] };
            });
            
            res.json(parsedMembers);
        } catch(err) { res.status(500).json({ error: err.message }); }
    });

    router.put('/family/members/:memberId', authenticateToken, async (req, res) => {
        const { role, permissions } = req.body;
        try {
            const familyId = (await pool.query('SELECT family_id FROM users WHERE id = $1', [req.user.id])).rows[0]?.family_id;
            const checkAdmin = await pool.query(`SELECT role FROM memberships WHERE user_id = $1 AND family_id = $2`, [req.user.id, familyId]);
            if (checkAdmin.rows[0]?.role !== 'ADMIN') return res.status(403).json({ error: 'Apenas administradores.' });
            await pool.query(`UPDATE memberships SET role = $1, permissions = $2 WHERE user_id = $3 AND family_id = $4`, [role, JSON.stringify(permissions || []), req.params.memberId, familyId]);
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.delete('/family/members/:memberId', authenticateToken, async (req, res) => {
        const userId = req.user.id;
        const memberId = req.params.memberId;
        if (userId === memberId) return res.status(400).json({ error: 'Não pode se remover.' });
        try {
            const familyId = (await pool.query('SELECT family_id FROM users WHERE id = $1', [userId])).rows[0]?.family_id;
            const checkAdmin = await pool.query(`SELECT role FROM memberships WHERE user_id = $1 AND family_id = $2`, [userId, familyId]);
            if (checkAdmin.rows[0]?.role !== 'ADMIN') return res.status(403).json({ error: 'Apenas administradores.' });
            await pool.query(`DELETE FROM memberships WHERE user_id = $1 AND family_id = $2`, [memberId, familyId]);
            await pool.query(`UPDATE users SET family_id = id WHERE id = $1 AND family_id = $2`, [memberId, familyId]);
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // --- ADMIN ---
    router.get('/admin/stats', authenticateToken, async (req, res) => {
        if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Acesso negado' });
        try {
            const totalUsers = (await pool.query('SELECT count(*) FROM users')).rows[0].count;
            const active = (await pool.query("SELECT count(*) FROM users WHERE status = 'ACTIVE'")).rows[0].count;
            const trial = (await pool.query("SELECT count(*) FROM users WHERE status = 'TRIALING'")).rows[0].count;
            const pf = (await pool.query("SELECT count(*) FROM users WHERE entity_type = 'PF'")).rows[0].count;
            const pj = (await pool.query("SELECT count(*) FROM users WHERE entity_type = 'PJ'")).rows[0].count;
            res.json({ totalUsers, active, trial, pf, pj, revenue: active * 29 });
        } catch(err) { res.status(500).json({ error: err.message }); }
    });

    router.get('/admin/users', authenticateToken, async (req, res) => {
        if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Acesso negado' });
        try {
            const users = await pool.query('SELECT id, name, email, entity_type, plan, status, created_at FROM users ORDER BY created_at DESC LIMIT 50');
            res.json(users.rows);
        } catch(err) { res.status(500).json({ error: err.message }); }
    });

    // --- UTILS (CNPJ, Scraper) ---
    router.post('/consult-cnpj', async (req, res) => {
        const { cnpj } = req.body;
        if (!cnpj) return res.status(400).json({ error: 'CNPJ obrigatório' });
        
        // BrasilAPI expects just numbers. Ensure it is a string first.
        const cleanCnpj = String(cnpj).replace(/\D/g, '');
        
        if (cleanCnpj.length !== 14) {
             return res.status(400).json({ error: 'CNPJ inválido (deve ter 14 dígitos)' });
        }

        try {
            console.log(`Consulting CNPJ: ${cleanCnpj}`);
            const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; FinManager/1.0;)'
                }
            });
            
            if (!response.ok) {
                console.error(`BrasilAPI Error: ${response.status} ${response.statusText}`);
                throw new Error("CNPJ não encontrado ou erro na BrasilAPI");
            }
            
            const data = await response.json();
            res.json(data);
        } catch (e) {
            console.error("Consult CNPJ Exception:", e);
            res.status(404).json({ error: e.message });
        }
    });

    router.post('/scrape-nfce', authenticateToken, async (req, res) => {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'URL é obrigatória' });
        try {
            const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' } });
            if (!response.ok) throw new Error(`Erro SEFAZ: ${response.status}`);
            const html = await response.text();
            const accessKey = extractAccessKey(url);
            const ufCode = accessKey && accessKey.length === 44 ? accessKey.substring(0, 2) : 'default';
            const parser = parsers[ufCode] || parsers['default'];
            const data = parser(html);
            
            let amount = data.amount ? data.amount.replace(/\./g, '').replace(',', '.') : null;
            let date = null;
            if (data.date) { const parts = data.date.split('/'); if (parts.length === 3) date = `${parts[2]}-${parts[1]}-${parts[0]}`; }

            if (!amount) return res.status(422).json({ error: 'Não foi possível ler o valor total.' });
            res.json({ amount: parseFloat(amount), date: date || new Date().toISOString().split('T')[0], merchant: data.merchant || 'Estabelecimento NFC-e', stateCode: ufCode, paymentType: data.paymentType });
        } catch (error) { res.status(500).json({ error: 'Erro ao processar nota.' }); }
    });

    // --- LOGS ---
    router.get('/audit-logs', authenticateToken, async (req, res) => {
        try {
            const familyId = (await pool.query('SELECT family_id FROM users WHERE id = $1', [req.user.id])).rows[0]?.family_id || req.user.id;
            const logs = await pool.query(`SELECT al.*, u.name as user_name, CASE WHEN al.entity='transaction' THEN (SELECT deleted_at IS NOT NULL FROM transactions WHERE id=al.entity_id) WHEN al.entity='account' THEN (SELECT deleted_at IS NOT NULL FROM accounts WHERE id=al.entity_id) ELSE false END as is_deleted FROM audit_logs al JOIN users u ON al.user_id = u.id WHERE u.family_id = $1 ORDER BY al.timestamp DESC LIMIT 100`, [familyId]);
            res.json(logs.rows.map(r => ({ ...r, isDeleted: r.is_deleted, previousState: r.previous_state, changes: r.changes })));
        } catch(err) { res.status(500).json({ error: err.message }); }
    });

    router.post('/restore', authenticateToken, async (req, res) => {
        const { entity, id } = req.body;
        const tableMap = { 'transaction': 'transactions', 'account': 'accounts', 'contact': 'contacts', 'category': 'categories', 'goal': 'goals' };
        const tableName = tableMap[entity];
        if (!tableName) return res.status(400).json({ error: 'Inválido' });
        try {
            const record = (await pool.query(`SELECT * FROM ${tableName} WHERE id=$1`, [id])).rows[0];
            await pool.query(`UPDATE ${tableName} SET deleted_at = NULL WHERE id=$1 AND ${familyCheckParam2}`, [id, req.user.id]);
            if (entity === 'transaction' && record && record.status === 'PAID') {
                if (record.type === 'TRANSFER') { if (record.account_id) await updateAccountBalance(pool, record.account_id, record.amount, 'EXPENSE'); if (record.destination_account_id) await updateAccountBalance(pool, record.destination_account_id, record.amount, 'INCOME'); }
                else await updateAccountBalance(pool, record.account_id, record.amount, record.type);
                if (record.goal_id) await pool.query(`UPDATE goals SET current_amount = current_amount + $1 WHERE id = $2`, [record.amount, record.goal_id]);
            }
            await logAudit(pool, req.user.id, 'RESTORE', entity, id, 'Registro restaurado', record);
            res.json({ success: true });
        } catch(err) { res.status(500).json({ error: err.message }); }
    });

    router.post('/revert-change', authenticateToken, async (req, res) => {
        const { logId } = req.body;
        try {
            const log = (await pool.query('SELECT * FROM audit_logs WHERE id=$1', [logId])).rows[0];
            if (!log || !log.previous_state) return res.status(400).json({ error: 'Inválido' });
            const tableMap = { 'transaction': 'transactions', 'account': 'accounts', 'contact': 'contacts', 'category': 'categories' };
            const tableName = tableMap[log.entity];
            if (!tableName) return res.status(400).json({ error: 'Entidade desconhecida' });

            const currentState = (await pool.query(`SELECT * FROM ${tableName} WHERE id=$1`, [log.entity_id])).rows[0];
            const keys = Object.keys(log.previous_state).filter(k => !['id','user_id','created_at','updated_at','created_by'].includes(k));
            const setClause = keys.map((k,i) => `"${k}"=$${i+2}`).join(', ');
            await pool.query(`UPDATE ${tableName} SET ${setClause}, updated_at=NOW() WHERE id=$1`, [log.entity_id, ...keys.map(k => log.previous_state[k])]);

            if (log.entity === 'transaction' && currentState && log.previous_state.status === 'PAID') {
                if (currentState.account_id === log.previous_state.account_id) {
                    const diff = parseFloat(currentState.amount) - parseFloat(log.previous_state.amount);
                    await updateAccountBalance(pool, log.previous_state.account_id, diff, log.previous_state.type === 'INCOME' ? 'EXPENSE' : 'INCOME');
                }
                if (currentState.goal_id) await pool.query(`UPDATE goals SET current_amount = current_amount + $1 WHERE id=$2`, [parseFloat(log.previous_state.amount) - parseFloat(currentState.amount), currentState.goal_id]);
            }
            await logAudit(pool, req.user.id, 'REVERT', log.entity, log.entity_id, 'Reversão de alteração', currentState);
            res.json({ success: true });
        } catch(err) { res.status(500).json({ error: err.message }); }
    });

    return router;
}
