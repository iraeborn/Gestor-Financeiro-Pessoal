
import express from 'express';
import pool from '../db.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sendEmail } from '../services/email.js';
import { sendWhatsappTemplate } from '../services/whatsapp.js';
import { authenticateToken, getUserWorkspaces, sanitizeValue, updateAccountBalance } from '../middleware.js';

const router = express.Router();

export default function(logAudit) {

    router.post('/settings', authenticateToken, async (req, res) => {
        const { settings } = req.body;
        const userId = req.user.id;
        try {
            // Busca o family_id (dono do workspace) para garantir que a config seja global para o negócio
            const userRes = await pool.query('SELECT family_id FROM users WHERE id = $1', [userId]);
            const familyId = userRes.rows[0]?.family_id || userId;

            // Verifica se o usuário tem permissão de ADMIN no workspace ativo
            const adminCheck = await pool.query(
                'SELECT role FROM memberships WHERE user_id = $1 AND family_id = $2',
                [userId, familyId]
            );

            if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'ADMIN') {
                return res.status(403).json({ error: 'Apenas administradores podem alterar configurações globais do negócio.' });
            }

            // Atualiza as configurações no registro do dono (que é quem dita as regras do workspace)
            await pool.query('UPDATE users SET settings = $1 WHERE id = $2', [JSON.stringify(settings), familyId]);
            
            await logAudit(pool, userId, 'UPDATE', 'settings', familyId, 'Configurações globais de sistema atualizadas');
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: 'Erro ao salvar configurações: ' + err.message });
        }
    });

    /**
     * Endpoint Genérico de Processamento de Sincronização
     * Lida com SAVE e DELETE para tabelas simples que não requerem lógica complexa de saldo ou estoque.
     */
    router.post('/sync/process', authenticateToken, async (req, res) => {
        const { action, store, payload } = req.body;
        const userId = req.user.id;

        if (!store || !payload || !payload.id) {
            return res.status(400).json({ error: "Parâmetros de sincronização incompletos." });
        }

        const storeToTableMap = {
            'categories': 'categories',
            'serviceOrders': 'service_orders',
            'salespeople': 'salespeople',
            'laboratories': 'laboratories',
            'salespersonSchedules': 'salesperson_schedules',
            'serviceClients': 'service_clients'
        };

        const tableName = storeToTableMap[store];
        if (!tableName) {
            return res.status(400).json({ error: `Store '${store}' não mapeada para sincronização genérica.` });
        }

        try {
            const familyIdRes = await pool.query('SELECT family_id FROM users WHERE id = $1', [userId]);
            const familyId = familyIdRes.rows[0]?.family_id || userId;

            if (action === 'DELETE') {
                await pool.query(
                    `UPDATE ${tableName} SET deleted_at = NOW() WHERE id = $1 AND family_id = $2`,
                    [payload.id, familyId]
                );
                await logAudit(pool, userId, 'DELETE', tableName, payload.id, `Exclusão genérica via sync`);
            } else {
                // Mapeamento dinâmico de chaves camelCase para snake_case
                // Remove campos de conveniência que não existem fisicamente na tabela (como nomes de filiais/colaboradores que são joins)
                const forbiddenKeys = ['salespersonName', 'branchName', 'contactName', '_updatedAt', 'id', 'familyId'];
                
                const fields = Object.keys(payload).filter(k => !forbiddenKeys.includes(k));
                const snakeFields = fields.map(f => f.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`));
                
                const placeholders = fields.map((_, i) => `$${i + 3}`).join(', ');
                const updateStr = snakeFields.map((f, i) => `${f} = $${i + 3}`).join(', ');

                const query = `
                    INSERT INTO ${tableName} (id, family_id, ${snakeFields.join(', ')})
                    VALUES ($1, $2, ${placeholders})
                    ON CONFLICT (id) DO UPDATE SET ${updateStr}, deleted_at = NULL`;

                const values = [
                    payload.id,
                    familyId,
                    ...fields.map(f => sanitizeValue(payload[f]))
                ];

                await pool.query(query, values);
                await logAudit(pool, userId, 'SAVE', tableName, payload.id, `Sincronização de registro: ${store}`);
            }

            res.json({ success: true });
        } catch (err) {
            console.error(`[GENERIC SYNC ERROR - ${store}]`, err.message);
            res.status(500).json({ error: err.message });
        }
    });

    // Rota de histórico de chat
    router.get('/chat/history', authenticateToken, async (req, res) => {
        const { familyId } = req.query;
        if (!familyId) return res.status(400).json({ error: 'familyId é obrigatório' });
        
        try {
            // Verifica se o usuário pertence à família solicitada
            const membership = await pool.query(
                'SELECT 1 FROM memberships WHERE user_id = $1 AND family_id = $2',
                [req.user.id, familyId]
            );
            
            if (membership.rows.length === 0) {
                return res.status(403).json({ error: 'Acesso negado ao histórico desta equipe.' });
            }

            const history = await pool.query(
                `SELECT * FROM chat_messages 
                 WHERE family_id = $1 
                 ORDER BY created_at ASC LIMIT 100`,
                [familyId]
            );

            // Mapeia para camelCase esperado pelo frontend
            const mappedHistory = history.rows.map(r => ({
                id: r.id,
                senderId: r.sender_id,
                senderName: r.sender_name,
                receiverId: r.receiver_id,
                familyId: r.family_id,
                content: r.content,
                type: r.type,
                attachmentUrl: r.attachment_url,
                createdAt: r.created_at
            }));

            res.json(mappedHistory);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/invites', authenticateToken, async (req, res) => {
        const { role } = req.body;
        const userId = req.user.id;
        try {
            const userRes = await pool.query('SELECT family_id FROM users WHERE id = $1', [userId]);
            const familyId = userRes.rows[0]?.family_id || userId;
            const adminCheck = await pool.query('SELECT role FROM memberships WHERE user_id = $1 AND family_id = $2', [userId, familyId]);
            if (adminCheck.rows[0]?.role !== 'ADMIN') return res.status(403).json({ error: 'Acesso negado.' });

            const code = crypto.randomBytes(3).toString('hex').toUpperCase(); 
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 24);

            await pool.query('INSERT INTO invites (code, family_id, created_by, expires_at, role_template) VALUES ($1, $2, $3, $4, $5)', [code, familyId, userId, expiresAt, role || 'MEMBER']);
            res.json({ code });
        } catch (err) { res.status(500).json({ error: 'Erro ao gerar código: ' + err.message }); }
    });

    router.post('/invites/join', authenticateToken, async (req, res) => {
        const { code } = req.body;
        try {
            const inviteRes = await pool.query('SELECT * FROM invites WHERE code = $1 AND expires_at > NOW()', [code]);
            if (inviteRes.rows.length === 0) return res.status(400).json({ error: 'Código inválido ou expirado.' });

            const invite = inviteRes.rows[0];
            const userId = req.user.id;

            await pool.query(`INSERT INTO memberships (user_id, family_id, role, permissions) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, family_id) DO UPDATE SET role = EXCLUDED.role`, [userId, invite.family_id, invite.role_template || 'MEMBER', '[]']);
            await pool.query('UPDATE users SET family_id = $1 WHERE id = $2', [invite.family_id, userId]);

            const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
            const workspaces = await getUserWorkspaces(userId);
            await logAudit(pool, userId, 'JOIN', 'family', invite.family_id, 'Usuário ingressou no workspace');
            res.json({ user: { ...userRes.rows[0], familyId: invite.family_id, workspaces } });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.get('/audit-logs', authenticateToken, async (req, res) => {
        try {
            const userRes = await pool.query('SELECT family_id FROM users WHERE id = $1', [req.user.id]);
            const familyId = userRes.rows[0]?.family_id || req.user.id;
            const logs = await pool.query(`SELECT al.*, u.name as user_name FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id WHERE al.family_id = $1 ORDER BY al.timestamp DESC LIMIT 150`, [familyId]);
            res.json(logs.rows.map(r => ({ ...r, userName: r.user_name || 'Sistema', entityId: r.entity_id })));
        } catch(err) { res.status(500).json({ error: err.message }); }
    });

    router.get('/notification-logs', authenticateToken, async (req, res) => {
        try {
            const userRes = await pool.query('SELECT family_id FROM users WHERE id = $1', [req.user.id]);
            const familyId = userRes.rows[0]?.family_id || req.user.id;
            const logs = await pool.query(`SELECT nl.*, u.name as user_name FROM notification_logs nl LEFT JOIN users u ON nl.user_id = u.id WHERE nl.family_id = $1 ORDER BY nl.created_at DESC LIMIT 100`, [familyId]);
            res.json(logs.rows.map(r => ({ ...r, userName: r.user_name || 'Sistema' })));
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.post('/audit/restore', authenticateToken, async (req, res) => {
        const { entity, entityId } = req.body;
        const userId = req.user.id;
        const client = await pool.connect();
        try {
            const userRes = await client.query('SELECT family_id FROM users WHERE id = $1', [userId]);
            const familyId = userRes.rows[0]?.family_id || userId;

            const tableMap = { 'transaction': 'transactions', 'account': 'accounts', 'contact': 'contacts', 'goal': 'goals' };
            const tableName = tableMap[entity];
            if (!tableName) return res.status(400).json({ error: 'Entidade inválida' });

            await client.query('BEGIN');

            // Se for transação, precisamos re-aplicar o saldo
            if (entity === 'transaction') {
                const tRes = await client.query('SELECT amount, type, account_id, destination_account_id, status FROM transactions WHERE id = $1', [entityId]);
                const t = tRes.rows[0];
                if (t && t.status === 'PAID') {
                    const amount = Number(t.amount);
                    if (t.type === 'TRANSFER') {
                        await updateAccountBalance(client, t.account_id, amount, 'EXPENSE');
                        if (t.destination_account_id) await updateAccountBalance(client, t.destination_account_id, amount, 'INCOME');
                    } else {
                        await updateAccountBalance(client, t.account_id, amount, t.type);
                    }
                }
            }

            await client.query(`UPDATE ${tableName} SET deleted_at = NULL WHERE id = $1 AND family_id = $2`, [entityId, familyId]);
            await client.query('COMMIT');

            await logAudit(pool, userId, 'RESTORE', entity, entityId, `Restaurou registro de ${entity}`);
            res.json({ success: true });
        } catch (err) { 
            if (client) await client.query('ROLLBACK').catch(()=>{});
            res.status(500).json({ error: err.message }); 
        } finally {
            client.release();
        }
    });

    router.post('/audit/revert/:logId', authenticateToken, async (req, res) => {
        const { logId } = req.params;
        const userId = req.user.id;
        try {
            const userRes = await pool.query('SELECT family_id FROM users WHERE id = $1', [userId]);
            const familyId = userRes.rows[0]?.family_id || userId;
            const logRes = await pool.query('SELECT * FROM audit_logs WHERE id = $1 AND family_id = $2', [logId, familyId]);
            if (logRes.rows.length === 0) return res.status(404).json({ error: 'Log não encontrado' });

            const log = logRes.rows[0];
            if (!log.previous_state) return res.status(400).json({ error: 'Estado anterior não disponível' });

            const tableMap = { 'transaction': 'transactions', 'account': 'accounts', 'contact': 'contacts', 'goal': 'goals' };
            const tableName = tableMap[log.entity];
            if (!tableName) return res.status(400).json({ error: 'Entidade inválida' });

            const prevState = log.previous_state;
            const fields = Object.keys(prevState).filter(k => !['id', 'user_id', 'family_id', 'created_at', 'updated_at'].includes(k));
            const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
            
            await pool.query(`UPDATE ${tableName} SET ${setClause} WHERE id = $${fields.length + 1} AND family_id = $${fields.length + 2}`, [...fields.map(f => prevState[f]), log.entity_id, familyId]);
            await logAudit(pool, userId, 'REVERT', log.entity, log.entity_id, `Reverteu alteração`);
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.get('/admin/stats', authenticateToken, async (req, res) => {
        if (req.user.email !== process.env.ADMIN_EMAIL && req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Acesso restrito.' });
        try {
            const stats = await pool.query(`SELECT COUNT(*) as "totalUsers", COUNT(NULLIF(status != 'ACTIVE', TRUE)) as active, COUNT(NULLIF(status != 'TRIALING', TRUE)) as trial, COUNT(NULLIF(entity_type != 'PF', TRUE)) as pf, COUNT(NULLIF(entity_type != 'PJ', TRUE)) as pj FROM users`);
            res.json(stats.rows[0]);
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.get('/admin/users', authenticateToken, async (req, res) => {
        if (req.user.email !== process.env.ADMIN_EMAIL && req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Acesso restrito.' });
        try {
            const users = await pool.query('SELECT id, name, email, entity_type, plan, status, created_at FROM users ORDER BY created_at DESC LIMIT 50');
            res.json(users.rows);
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.get('/members', authenticateToken, async (req, res) => {
        try {
            const userRes = await pool.query('SELECT family_id FROM users WHERE id = $1', [req.user.id]);
            const familyId = userRes.rows[0]?.family_id || req.user.id;
            const members = await pool.query(`SELECT u.id, u.name, u.email, m.role, m.permissions, u.entity_type as "entityType", m.contact_id as "contactId" FROM users u JOIN memberships m ON u.id = m.user_id WHERE m.family_id = $1 ORDER BY u.name ASC`, [familyId]);
            res.json(members.rows.map(m => {
                let perms = m.permissions;
                if (typeof perms === 'string') { try { perms = JSON.parse(perms); } catch (e) { perms = []; } }
                return { ...m, permissions: Array.isArray(perms) ? perms : [] };
            }));
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.put('/members/:memberId', authenticateToken, async (req, res) => {
        const { role, permissions, contactId } = req.body;
        const { memberId } = req.params;
        const userId = req.user.id;
        try {
            const userRes = await pool.query('SELECT family_id FROM users WHERE id = $1', [userId]);
            const familyId = userRes.rows[0]?.family_id || userId;
            const adminCheck = await pool.query('SELECT role FROM memberships WHERE user_id = $1 AND family_id = $2', [userId, familyId]);
            if (adminCheck.rows[0]?.role !== 'ADMIN') return res.status(403).json({ error: 'Apenas administradores.' });
            await pool.query('UPDATE memberships SET role = $1, permissions = $2, contact_id = $3 WHERE user_id = $4 AND family_id = $5', [role, JSON.stringify(permissions || []), sanitizeValue(contactId), memberId, familyId]);
            await logAudit(pool, userId, 'UPDATE', 'membership', memberId, `Permissões atualizadas`);
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.delete('/members/:memberId', authenticateToken, async (req, res) => {
        const { memberId } = req.params;
        const userId = req.user.id;
        try {
            const userRes = await pool.query('SELECT family_id FROM users WHERE id = $1', [userId]);
            const familyId = userRes.rows[0]?.family_id || userId;
            const adminCheck = await pool.query('SELECT role FROM memberships WHERE user_id = $1 AND family_id = $2', [userId, familyId]);
            if (adminCheck.rows[0]?.role !== 'ADMIN') return res.status(403).json({ error: 'Apenas administradores.' });
            if (memberId === familyId) return res.status(400).json({ error: 'O proprietário não pode ser removido.' });
            await pool.query('DELETE FROM memberships WHERE user_id = $1 AND family_id = $2', [memberId, familyId]);
            await pool.query('UPDATE users SET family_id = id WHERE id = $1', [memberId]);
            await logAudit(pool, userId, 'DELETE', 'membership', memberId, 'Membro removido');
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.put('/profile', authenticateToken, async (req, res) => {
        const { name, email, currentPassword, newPassword } = req.body;
        const userId = req.user.id;
        try {
            const user = (await pool.query('SELECT * FROM users WHERE id = $1', [userId])).rows[0];
            if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
            let passwordHash = user.password_hash;
            if (newPassword) {
                if (!user.google_id) {
                    if (!currentPassword || !(await bcrypt.compare(currentPassword, user.password_hash))) return res.status(400).json({ error: 'Senha atual incorreta.' });
                }
                passwordHash = await bcrypt.hash(newPassword, 10);
            }
            await pool.query(`UPDATE users SET name = $1, email = $2, password_hash = $3 WHERE id = $4`, [name, email, passwordHash, userId]);
            const workspaces = await getUserWorkspaces(userId);
            res.json({ user: { id: userId, name, email, settings: user.settings, familyId: user.family_id, workspaces } });
            await logAudit(pool, userId, 'UPDATE', 'user', userId, 'Perfil atualizado');
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.post('/test-whatsapp', authenticateToken, async (req, res) => {
        try { res.json({ success: true, data: await sendWhatsappTemplate(req.body.phone) }); } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/test-email', authenticateToken, async (req, res) => {
        try { await sendEmail(req.body.email, "Teste Operacional", "Sucesso.", "<h1>Sucesso!</h1>"); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
    });

    return router;
}
