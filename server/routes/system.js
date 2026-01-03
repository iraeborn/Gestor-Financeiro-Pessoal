
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

    // --- CONFIGURAÇÕES DO SISTEMA ---

    router.post('/settings', authenticateToken, async (req, res) => {
        const { settings } = req.body;
        const userId = req.user.id;
        try {
            await pool.query(
                'UPDATE users SET settings = $1 WHERE id = $2',
                [JSON.stringify(settings), userId]
            );

            await logAudit(pool, userId, 'UPDATE', 'settings', userId, 'Configurações de sistema atualizadas');
            res.json({ success: true });
        } catch (err) {
            console.error("[SETTINGS ERROR]", err);
            res.status(500).json({ error: 'Erro ao salvar configurações: ' + err.message });
        }
    });

    // --- CONVITES ---

    router.post('/invites', authenticateToken, async (req, res) => {
        const { role } = req.body;
        const userId = req.user.id;
        try {
            // Robustez: Fallback caso o family_id esteja nulo na sessão
            const userRes = await pool.query('SELECT family_id FROM users WHERE id = $1', [userId]);
            const familyId = userRes.rows[0]?.family_id || userId;

            // Validação estrita contra a tabela de memberships
            const adminCheck = await pool.query(
                'SELECT role FROM memberships WHERE user_id = $1 AND family_id = $2', 
                [userId, familyId]
            );

            const userRole = adminCheck.rows[0]?.role;

            if (userRole !== 'ADMIN') {
                return res.status(403).json({ 
                    error: 'Acesso negado.',
                    details: 'Apenas administradores do workspace atual podem gerar convites.' 
                });
            }

            const code = crypto.randomBytes(3).toString('hex').toUpperCase(); 
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 24);

            await pool.query(
                'INSERT INTO invites (code, family_id, created_by, expires_at, role_template) VALUES ($1, $2, $3, $4, $5)',
                [code, familyId, userId, expiresAt, role || 'MEMBER']
            );

            res.json({ code });
        } catch (err) { 
            console.error("[INVITE ERROR]", err);
            res.status(500).json({ error: 'Erro ao gerar código: ' + err.message }); 
        }
    });

    router.post('/invites/join', authenticateToken, async (req, res) => {
        const { code } = req.body;
        try {
            const inviteRes = await pool.query(
                'SELECT * FROM invites WHERE code = $1 AND expires_at > NOW()',
                [code]
            );

            if (inviteRes.rows.length === 0) {
                return res.status(400).json({ error: 'Código inválido ou expirado.' });
            }

            const invite = inviteRes.rows[0];
            const userId = req.user.id;

            // Ingressar na equipe
            await pool.query(
                `INSERT INTO memberships (user_id, family_id, role, permissions) 
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (user_id, family_id) DO UPDATE SET role = EXCLUDED.role`,
                [userId, invite.family_id, invite.role_template || 'MEMBER', '[]']
            );

            // Atualizar contexto ativo do usuário
            await pool.query('UPDATE users SET family_id = $1 WHERE id = $2', [invite.family_id, userId]);

            const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
            const workspaces = await getUserWorkspaces(userId);
            
            await logAudit(pool, userId, 'JOIN', 'family', invite.family_id, 'Usuário ingressou no workspace');
            
            res.json({ 
                user: { 
                    ...userRes.rows[0], 
                    familyId: invite.family_id,
                    workspaces 
                } 
            });
        } catch (err) { 
            res.status(500).json({ error: err.message }); 
        }
    });

    // --- OUTRAS ROTAS DO SISTEMA MANTIDAS ---

    router.get('/audit-logs', authenticateToken, async (req, res) => {
        try {
            const userRes = await pool.query('SELECT family_id FROM users WHERE id = $1', [req.user.id]);
            const familyId = userRes.rows[0]?.family_id || req.user.id;
            
            const logs = await pool.query(`
                SELECT al.*, u.name as user_name 
                FROM audit_logs al 
                JOIN users u ON al.user_id = u.id 
                WHERE u.family_id = $1 
                ORDER BY al.timestamp DESC LIMIT 150
            `, [familyId]);
            
            res.json(logs.rows.map(r => ({ ...r, userName: r.user_name, entityId: r.entity_id })));
        } catch(err) { res.status(500).json({ error: err.message }); }
    });

    router.get('/members', authenticateToken, async (req, res) => {
        try {
            const userRes = await pool.query('SELECT family_id FROM users WHERE id = $1', [req.user.id]);
            const familyId = userRes.rows[0]?.family_id || req.user.id;

            const members = await pool.query(`
                SELECT u.id, u.name, u.email, m.role, m.permissions, u.entity_type as "entityType"
                FROM users u
                JOIN memberships m ON u.id = m.user_id
                WHERE m.family_id = $1
                ORDER BY u.name ASC
            `, [familyId]);

            res.json(members.rows.map(m => {
                let perms = m.permissions;
                if (typeof perms === 'string') { try { perms = JSON.parse(perms); } catch (e) { perms = []; } }
                return { ...m, permissions: Array.isArray(perms) ? perms : [] };
            }));
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.put('/members/:memberId', authenticateToken, async (req, res) => {
        const { role, permissions } = req.body;
        const { memberId } = req.params;
        const userId = req.user.id;
        try {
            const userRes = await pool.query('SELECT family_id FROM users WHERE id = $1', [userId]);
            const familyId = userRes.rows[0]?.family_id || userId;

            const adminCheck = await pool.query('SELECT role FROM memberships WHERE user_id = $1 AND family_id = $2', [userId, familyId]);
            if (adminCheck.rows[0]?.role !== 'ADMIN') return res.status(403).json({ error: 'Apenas administradores podem gerenciar a equipe.' });

            await pool.query('UPDATE memberships SET role = $1, permissions = $2 WHERE user_id = $3 AND family_id = $4', [role, JSON.stringify(permissions || []), memberId, familyId]);
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
            if (adminCheck.rows[0]?.role !== 'ADMIN') return res.status(403).json({ error: 'Apenas administradores podem remover membros.' });
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
