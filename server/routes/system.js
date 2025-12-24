
import express from 'express';
import pool from '../db.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sendEmail } from '../services/email.js';
import { sendWhatsappTemplate } from '../services/whatsapp.js';
import { authenticateToken, getUserWorkspaces, sanitizeValue } from '../middleware.js';

const router = express.Router();

export default function(logAudit) {

    router.post('/test-whatsapp', authenticateToken, async (req, res) => {
        const { phone } = req.body;
        try {
            const result = await sendWhatsappTemplate(phone);
            res.json({ success: true, data: result });
        } catch (e) { 
            res.status(500).json({ error: e.message }); 
        }
    });

    router.post('/test-email', authenticateToken, async (req, res) => {
        const { email } = req.body;
        try {
            await sendEmail(email, "Teste de Notificação", "FinManager está operacional.", "<h1>Sucesso!</h1>");
            res.json({ success: true });
        } catch (e) { 
            res.status(500).json({ error: e.message }); 
        }
    });

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
            await pool.query(`UPDATE users SET name = $1, email = $2, password_hash = $3 WHERE id = $4`, [name, email, passwordHash, userId]);
            
            const workspaces = await getUserWorkspaces(userId);
            res.json({ user: { id: userId, name, email, settings: user.settings, workspaces }});
            await logAudit(pool, userId, 'UPDATE', 'user', userId, 'Perfil atualizado');
        } catch (err) { res.status(500).json({ error: 'Erro ao atualizar perfil.' }); }
    });

    router.get('/audit-logs', authenticateToken, async (req, res) => {
        try {
            const familyId = (await pool.query('SELECT family_id FROM users WHERE id = $1', [req.user.id])).rows[0]?.family_id || req.user.id;
            const logs = await pool.query(`
                SELECT al.*, u.name as user_name 
                FROM audit_logs al 
                JOIN users u ON al.user_id = u.id 
                WHERE u.family_id = $1 
                ORDER BY al.timestamp DESC LIMIT 100
            `, [familyId]);
            res.json(logs.rows.map(r => ({ ...r, userName: r.user_name, entityId: r.entity_id })));
        } catch(err) { res.status(500).json({ error: err.message }); }
    });

    // --- GESTÃO DE MEMBROS ---

    router.get('/members', authenticateToken, async (req, res) => {
        try {
            const userRes = await pool.query('SELECT family_id FROM users WHERE id = $1', [req.user.id]);
            const familyId = userRes.rows[0]?.family_id;

            const members = await pool.query(`
                SELECT u.id, u.name, u.email, m.role, m.permissions, u.entity_type as "entityType"
                FROM users u
                JOIN memberships m ON u.id = m.user_id
                WHERE m.family_id = $1
            `, [familyId]);

            res.json(members.rows.map(m => {
                let perms = m.permissions;
                if (typeof perms === 'string') {
                    try { perms = JSON.parse(perms); } catch (e) { perms = []; }
                }
                return { ...m, permissions: Array.isArray(perms) ? perms : [] };
            }));
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.put('/members/:memberId', authenticateToken, async (req, res) => {
        const { role, permissions } = req.body;
        const { memberId } = req.params;
        try {
            const adminCheck = await pool.query('SELECT role FROM memberships WHERE user_id = $1 AND family_id = (SELECT family_id FROM users WHERE id = $1)', [req.user.id]);
            if (adminCheck.rows[0]?.role !== 'ADMIN') return res.status(403).json({ error: 'Apenas administradores podem alterar permissões.' });

            const userRes = await pool.query('SELECT family_id FROM users WHERE id = $1', [req.user.id]);
            const familyId = userRes.rows[0]?.family_id;

            await pool.query(
                'UPDATE memberships SET role = $1, permissions = $2 WHERE user_id = $3 AND family_id = $4',
                [role, JSON.stringify(permissions || []), memberId, familyId]
            );

            await logAudit(pool, req.user.id, 'UPDATE', 'membership', memberId, `Permissões de membro alteradas: ${role}`);
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.delete('/members/:memberId', authenticateToken, async (req, res) => {
        const { memberId } = req.params;
        try {
            const adminCheck = await pool.query('SELECT role FROM memberships WHERE user_id = $1 AND family_id = (SELECT family_id FROM users WHERE id = $1)', [req.user.id]);
            if (adminCheck.rows[0]?.role !== 'ADMIN') return res.status(403).json({ error: 'Apenas administradores podem remover membros.' });

            const userRes = await pool.query('SELECT family_id FROM users WHERE id = $1', [req.user.id]);
            const familyId = userRes.rows[0]?.family_id;

            if (memberId === familyId) return res.status(400).json({ error: 'O dono do ambiente não pode ser removido.' });

            await pool.query('DELETE FROM memberships WHERE user_id = $1 AND family_id = $2', [memberId, familyId]);
            
            // Se o usuário removido estava visualizando este family_id, volta para o dele próprio
            await pool.query('UPDATE users SET family_id = id WHERE id = $1 AND family_id = $2', [memberId, familyId]);

            await logAudit(pool, req.user.id, 'DELETE', 'membership', memberId, 'Membro removido do workspace');
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // --- CONVITES ---

    router.post('/invites', authenticateToken, async (req, res) => {
        const { role } = req.body;
        try {
            const userRes = await pool.query('SELECT family_id FROM users WHERE id = $1', [req.user.id]);
            const familyId = userRes.rows[0]?.family_id;

            const code = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 chars
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 24);

            await pool.query(
                'INSERT INTO invites (code, family_id, created_by, expires_at, role_template) VALUES ($1, $2, $3, $4, $5)',
                [code, familyId, req.user.id, expiresAt, role || 'MEMBER']
            );

            res.json({ code });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.post('/invites/join', authenticateToken, async (req, res) => {
        const { code } = req.body;
        try {
            const inviteRes = await pool.query(
                'SELECT * FROM invites WHERE code = $1 AND expires_at > NOW()',
                [code]
            );

            if (inviteRes.rows.length === 0) return res.status(400).json({ error: 'Código inválido ou expirado.' });

            const invite = inviteRes.rows[0];
            const userId = req.user.id;

            // Cria o vínculo (Membership)
            await pool.query(
                `INSERT INTO memberships (user_id, family_id, role, permissions) 
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (user_id, family_id) DO NOTHING`,
                [userId, invite.family_id, 'MEMBER', '[]']
            );

            // Muda o contexto atual do usuário para o novo family_id
            await pool.query('UPDATE users SET family_id = $1 WHERE id = $2', [invite.family_id, userId]);

            const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
            const workspaces = await getUserWorkspaces(userId);
            
            await logAudit(pool, userId, 'JOIN', 'family', invite.family_id, 'Usuário entrou via convite');
            
            res.json({ user: { ...userRes.rows[0], workspaces } });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    return router;
}
