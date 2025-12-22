
import express from 'express';
import pool from '../db.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { sendEmail } from '../services/email.js';
import { sendWhatsappTemplate } from '../services/whatsapp.js';
import { authenticateToken, getUserWorkspaces } from '../middleware.js';

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

    return router;
}
