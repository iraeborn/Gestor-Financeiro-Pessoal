
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import pool from '../db.js';
import crypto from 'crypto';
import { authenticateToken, getUserWorkspaces } from '../middleware.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "272556908691-3gnld5rsjj6cv2hspp96jt2fb3okkbhv.apps.googleusercontent.com";
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

export default function(logAudit) {
    router.get('/me', authenticateToken, async (req, res) => {
        const userId = req.user.id;
        try {
            const userRow = (await pool.query('SELECT * FROM users WHERE id = $1', [userId])).rows[0];
            if (!userRow) return res.status(404).json({ error: 'Usuário não encontrado' });
            const workspaces = await getUserWorkspaces(userId);
            const ownerRes = await pool.query('SELECT entity_type FROM users WHERE id = $1', [userRow.family_id]);
            res.json({ user: { ...userRow, entityType: ownerRes.rows[0]?.entity_type || userRow.entity_type, workspaces } });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.post('/switch-context', authenticateToken, async (req, res) => {
        const { targetFamilyId } = req.body;
        const userId = req.user.id;
        try {
            const membership = await pool.query('SELECT * FROM memberships WHERE user_id = $1 AND family_id = $2', [userId, targetFamilyId]);
            if (membership.rows.length === 0) return res.status(403).json({ error: 'Acesso negado.' });
            await pool.query('UPDATE users SET family_id = $1 WHERE id = $2', [targetFamilyId, userId]);
            const userRow = (await pool.query('SELECT * FROM users WHERE id = $1', [userId])).rows[0];
            const workspaces = await getUserWorkspaces(userId);
            const token = jwt.sign(userRow, JWT_SECRET, { expiresIn: '7d' });
            res.json({ token, user: { ...userRow, workspaces } });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.post('/register', async (req, res) => {
      const { name, email, password, entityType } = req.body;
      try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const id = crypto.randomUUID();
        await pool.query(`INSERT INTO users (id, name, email, password_hash, family_id, entity_type, plan, status) VALUES ($1, $2, $3, $4, $1, $5, 'TRIAL', 'TRIALING')`, [id, name, email, hashedPassword, entityType || 'PF']);
        await pool.query('INSERT INTO memberships (user_id, family_id, role, permissions) VALUES ($1, $1, $2, $3)', [id, 'ADMIN', '[]']);
        const user = { id, name, email, familyId: id, role: 'USER', entityType: entityType || 'PF' };
        const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user });
      } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.post('/login', async (req, res) => {
      const { email, password } = req.body;
      try {
        const userRow = (await pool.query('SELECT * FROM users WHERE email = $1', [email])).rows[0];
        if (!userRow || !(await bcrypt.compare(password, userRow.password_hash))) return res.status(400).json({ error: 'Credenciais inválidas' });
        const workspaces = await getUserWorkspaces(userRow.id);
        const token = jwt.sign(userRow, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { ...userRow, workspaces } });
      } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.post('/google', async (req, res) => {
      const { credential } = req.body;
      try {
        const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
        const { sub: googleId, email, name } = ticket.getPayload();
        
        let userRow = (await pool.query('SELECT * FROM users WHERE email = $1', [email])).rows[0];
        
        if (!userRow) {
           const id = crypto.randomUUID();
           await pool.query(`INSERT INTO users (id, name, email, google_id, family_id, entity_type, plan, status) VALUES ($1, $2, $3, $4, $1, 'PF', 'TRIAL', 'TRIALING')`, [id, name, email, googleId]);
           await pool.query('INSERT INTO memberships (user_id, family_id, role, permissions) VALUES ($1, $1, $2, $3)', [id, 'ADMIN', '[]']);
           userRow = (await pool.query('SELECT * FROM users WHERE id = $1', [id])).rows[0];
           await logAudit(pool, id, 'CREATE', 'user', id, `Novo usuário Google: ${name}`);
        } else if (!userRow.google_id) {
           await pool.query('UPDATE users SET google_id = $1 WHERE id = $2', [googleId, userRow.id]);
           userRow.google_id = googleId;
        }

        const workspaces = await getUserWorkspaces(userRow.id);
        const token = jwt.sign(userRow, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { ...userRow, workspaces } });
      } catch (err) { 
        res.status(400).json({ error: 'Google Auth Error: ' + err.message }); 
      }
    });

    return router;
}
