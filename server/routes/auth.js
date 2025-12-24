
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
            if (!userRow) return res.status(404).json({ error: 'User not found' });
            const workspaces = await getUserWorkspaces(userId);
            const ownerRes = await pool.query('SELECT entity_type FROM users WHERE id = $1', [userRow.family_id]);
            const user = { 
                id: userRow.id, name: userRow.name, email: userRow.email, familyId: userRow.family_id,
                settings: userRow.settings, role: userRow.role, entityType: ownerRes.rows[0]?.entity_type || userRow.entity_type,
                plan: userRow.plan, status: userRow.status, trialEndsAt: userRow.trial_ends_at, workspaces
            };
            res.json({ user });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.post('/register', async (req, res) => {
      const { name, email, password, entityType, plan, companyData } = req.body;
      try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const id = crypto.randomUUID();
        if ((await pool.query('SELECT * FROM users WHERE email = $1', [email])).rows.length > 0) return res.status(400).json({ error: 'Email já cadastrado' });
        
        const trialEndsAt = new Date(); trialEndsAt.setDate(trialEndsAt.getDate() + 15);
        const defaultSettings = { includeCreditCardsInTotal: true };

        await pool.query(
          `INSERT INTO users (id, name, email, password_hash, family_id, settings, role, entity_type, plan, status, trial_ends_at) VALUES ($1, $2, $3, $4, $1, $5, $6, $7, $8, $9, $10)`,
          [id, name, email, hashedPassword, id, defaultSettings, 'USER', entityType || 'PF', plan || 'TRIAL', 'TRIALING', trialEndsAt]
        );
        await pool.query('INSERT INTO memberships (user_id, family_id, role, permissions) VALUES ($1, $1, $2, $3)', [id, 'ADMIN', '[]']);
        
        if (entityType === 'PJ' && companyData) {
            await pool.query(
                `INSERT INTO company_profiles (
                    id, trade_name, legal_name, cnpj, tax_regime, cnae, city, state, has_employees, issues_invoices, user_id, family_id,
                    zip_code, street, number, neighborhood, phone, email, secondary_cnaes
                ) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11, $12, $13, $14, $15, $16, $17, $18)`,
                [
                    crypto.randomUUID(),
                    companyData.tradeName || name, 
                    companyData.legalName || name, 
                    companyData.cnpj || '', 
                    companyData.taxRegime || 'SIMPLES',
                    companyData.cnae,
                    companyData.city,
                    companyData.state,
                    companyData.hasEmployees || false,
                    companyData.issuesInvoices || false,
                    id,
                    companyData.zipCode,
                    companyData.street,
                    companyData.number,
                    companyData.neighborhood,
                    companyData.phone,
                    companyData.email,
                    companyData.secondaryCnaes
                ]
            );
        }

        const workspaces = await getUserWorkspaces(id);
        const user = { id, name, email, familyId: id, settings: defaultSettings, role: 'USER', entityType: entityType || 'PF', plan: plan || 'TRIAL', status: 'TRIALING', trialEndsAt, workspaces };
        const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
        await logAudit(pool, id, 'CREATE', 'user', id, `Novo usuário: ${name}`);
        res.json({ token, user });
      } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.post('/login', async (req, res) => {
      const { email, password } = req.body;
      try {
        const userRow = (await pool.query('SELECT * FROM users WHERE email = $1', [email])).rows[0];
        if (!userRow || !userRow.password_hash || !(await bcrypt.compare(password, userRow.password_hash))) return res.status(400).json({ error: 'Credenciais inválidas' });
        
        if (!userRow.family_id) { await pool.query('UPDATE users SET family_id = $1 WHERE id = $2', [userRow.id, userRow.id]); userRow.family_id = userRow.id; }
        await pool.query(`INSERT INTO memberships (user_id, family_id, role, permissions) VALUES ($1, $2, 'ADMIN', '[]') ON CONFLICT (user_id, family_id) DO NOTHING`, [userRow.id, userRow.family_id]);

        const workspaces = await getUserWorkspaces(userRow.id);
        const ownerRes = await pool.query('SELECT entity_type FROM users WHERE id = $1', [userRow.family_id]);
        const user = { 
            id: userRow.id, name: userRow.name, email: userRow.email, familyId: userRow.family_id,
            settings: userRow.settings || { includeCreditCardsInTotal: true }, role: userRow.role || 'USER', 
            entityType: ownerRes.rows[0]?.entity_type || userRow.entity_type, plan: userRow.plan, status: userRow.status, trialEndsAt: userRow.trial_ends_at, workspaces
        };
        const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user });
      } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.post('/google', async (req, res) => {
      const { token: credential } = req.body;
      try {
        const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
        const { sub: googleId, email, name } = ticket.getPayload();
        let userRow = (await pool.query('SELECT * FROM users WHERE email = $1', [email])).rows[0];
        const defaultSettings = { includeCreditCardsInTotal: true };
        const trialEndsAt = new Date(); trialEndsAt.setDate(trialEndsAt.getDate() + 15);

        if (!userRow) {
           const id = crypto.randomUUID();
           await pool.query(`INSERT INTO users (id, name, email, google_id, family_id, settings, role, entity_type, plan, status, trial_ends_at) VALUES ($1, $2, $3, $4, $1, $5, 'USER', 'PF', 'TRIAL', 'TRIALING', $6)`, [id, name, email, googleId, defaultSettings, trialEndsAt]);
           await pool.query('INSERT INTO memberships (user_id, family_id, role, permissions) VALUES ($1, $1, $2, $3)', [id, 'ADMIN', '[]']);
           userRow = { id, name, email, family_id: id, settings: defaultSettings, role: 'USER', entity_type: 'PF', plan: 'TRIAL', status: 'TRIALING', trial_ends_at: trialEndsAt };
           await logAudit(pool, id, 'CREATE', 'user', id, `Novo usuário Google: ${name}`);
        } else {
           if (!userRow.google_id) await pool.query('UPDATE users SET google_id = $1 WHERE id = $2', [googleId, userRow.id]);
           if (!userRow.family_id) { await pool.query('UPDATE users SET family_id = $1 WHERE id = $2', [userRow.id, userRow.id]); userRow.family_id = userRow.id; }
           await pool.query(`INSERT INTO memberships (user_id, family_id, role, permissions) VALUES ($1, $2, 'ADMIN', '[]') ON CONFLICT DO NOTHING`, [userRow.id, userRow.family_id]);
        }
        const workspaces = await getUserWorkspaces(userRow.id);
        const ownerRes = await pool.query('SELECT entity_type FROM users WHERE id = $1', [userRow.family_id]);
        const user = { 
            id: userRow.id, name: userRow.name, email: userRow.email, familyId: userRow.family_id,
            settings: userRow.settings || defaultSettings, role: userRow.role || 'USER',
            entityType: ownerRes.rows[0]?.entity_type || userRow.entity_type, plan: userRow.plan, status: userRow.status, trialEndsAt: userRow.trial_ends_at, workspaces
        };
        const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user });
      } catch (err) { res.status(400).json({ error: 'Google Auth Error: ' + err.message }); }
    });

    // --- CONTEXT SWITCHING ---

    router.post('/switch-context', authenticateToken, async (req, res) => {
        const { targetFamilyId } = req.body;
        const userId = req.user.id;
        try {
            const membership = await pool.query(
                'SELECT * FROM memberships WHERE user_id = $1 AND family_id = $2',
                [userId, targetFamilyId]
            );
            if (membership.rows.length === 0) {
                return res.status(403).json({ error: 'Você não tem permissão para acessar este ambiente.' });
            }

            await pool.query('UPDATE users SET family_id = $1 WHERE id = $2', [targetFamilyId, userId]);

            const userRow = (await pool.query('SELECT * FROM users WHERE id = $1', [userId])).rows[0];
            const workspaces = await getUserWorkspaces(userId);
            const ownerRes = await pool.query('SELECT entity_type FROM users WHERE id = $1', [targetFamilyId]);
            
            const user = { 
                id: userRow.id, name: userRow.name, email: userRow.email, familyId: targetFamilyId,
                settings: userRow.settings, role: userRow.role, 
                entityType: ownerRes.rows[0]?.entity_type || userRow.entity_type,
                plan: userRow.plan, status: userRow.status, trialEndsAt: userRow.trial_ends_at, workspaces
            };
            const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
            res.json({ token, user });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // --- COLLABORATION & FAMILY ---

    router.post('/invites', authenticateToken, async (req, res) => {
        const { roleTemplate } = req.body;
        const userId = req.user.id;
        try {
            const user = (await pool.query('SELECT family_id FROM users WHERE id = $1', [userId])).rows[0];
            const code = crypto.randomBytes(3).toString('hex').toUpperCase();
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 24);

            await pool.query(
                'INSERT INTO invites (code, family_id, created_by, expires_at, role_template) VALUES ($1, $2, $3, $4, $5)',
                [code, user.family_id, userId, expiresAt, roleTemplate || 'MEMBER']
            );
            res.json({ code });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.post('/invite/join', authenticateToken, async (req, res) => {
        const { code } = req.body;
        const userId = req.user.id;
        try {
            const invite = (await pool.query('SELECT * FROM invites WHERE code = $1 AND expires_at > NOW()', [code])).rows[0];
            if (!invite) return res.status(400).json({ error: 'Código inválido ou expirado.' });

            await pool.query(
                'INSERT INTO memberships (user_id, family_id, role, permissions) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, family_id) DO UPDATE SET role = $3',
                [userId, invite.family_id, invite.role_template || 'MEMBER', '[]']
            );

            await pool.query('UPDATE users SET family_id = $1 WHERE id = $2', [invite.family_id, userId]);

            const userRow = (await pool.query('SELECT * FROM users WHERE id = $1', [userId])).rows[0];
            const workspaces = await getUserWorkspaces(userId);
            const ownerRes = await pool.query('SELECT entity_type FROM users WHERE id = $1', [invite.family_id]);
            
            const user = { 
                id: userRow.id, name: userRow.name, email: userRow.email, familyId: invite.family_id,
                settings: userRow.settings, role: userRow.role, 
                entityType: ownerRes.rows[0]?.entity_type || userRow.entity_type,
                plan: userRow.plan, status: userRow.status, trialEndsAt: userRow.trial_ends_at, workspaces
            };
            const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
            res.json({ token, user });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.get('/family/members', authenticateToken, async (req, res) => {
        const userId = req.user.id;
        try {
            const user = (await pool.query('SELECT family_id FROM users WHERE id = $1', [userId])).rows[0];
            const members = await pool.query(
                `SELECT u.id, u.name, u.email, m.role, m.permissions, u.entity_type as "entityType"
                 FROM memberships m JOIN users u ON m.user_id = u.id WHERE m.family_id = $1`,
                [user.family_id]
            );
            res.json(members.rows);
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.delete('/family/members/:id', authenticateToken, async (req, res) => {
        const memberId = req.params.id;
        const userId = req.user.id;
        try {
            const user = (await pool.query('SELECT family_id FROM users WHERE id = $1', [userId])).rows[0];
            // Don't let user remove themselves or family owner if they are not the owner
            if (memberId === user.family_id) return res.status(403).json({ error: 'Não é possível remover o proprietário.' });
            
            await pool.query('DELETE FROM memberships WHERE user_id = $1 AND family_id = $2', [memberId, user.family_id]);
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.put('/family/members/:id', authenticateToken, async (req, res) => {
        const memberId = req.params.id;
        const { role, permissions } = req.body;
        const userId = req.user.id;
        try {
            const user = (await pool.query('SELECT family_id FROM users WHERE id = $1', [userId])).rows[0];
            await pool.query(
                'UPDATE memberships SET role = $1, permissions = $2 WHERE user_id = $3 AND family_id = $4',
                [role, JSON.stringify(permissions || []), memberId, user.family_id]
            );
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    return router;
}
