
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

/**
 * Normaliza o objeto de usuário e garante integridade do workspace
 */
const ensureUserIntegrity = async (user) => {
    if (!user) return null;
    const userId = user.id;
    const familyId = user.family_id || userId;

    // Verificação de segurança: Se o usuário é dono mas não tem membership, cria agora.
    if (familyId === userId) {
        const check = await pool.query('SELECT * FROM memberships WHERE user_id = $1 AND family_id = $2', [userId, userId]);
        if (check.rows.length === 0) {
            await pool.query(
                'INSERT INTO memberships (user_id, family_id, role, permissions) VALUES ($1, $1, $2, $3)',
                [userId, 'ADMIN', '[]']
            );
        }
    }

    return {
        id: user.id,
        name: user.name,
        email: user.email,
        familyId: familyId,
        googleId: user.google_id,
        entityType: user.entity_type,
        plan: user.plan,
        status: user.status,
        settings: user.settings,
        role: user.role || 'USER'
    };
};

export default function(logAudit) {
    router.get('/me', authenticateToken, async (req, res) => {
        const userId = req.user.id;
        try {
            const userRow = (await pool.query('SELECT * FROM users WHERE id = $1', [userId])).rows[0];
            if (!userRow) return res.status(404).json({ error: 'Usuário não encontrado' });
            
            const workspaces = await getUserWorkspaces(userId);
            const ownerRes = await pool.query('SELECT entity_type FROM users WHERE id = $1', [userRow.family_id || userId]);
            
            const mappedUser = await ensureUserIntegrity(userRow);
            mappedUser.workspaces = workspaces;
            mappedUser.entityType = ownerRes.rows[0]?.entity_type || mappedUser.entityType;
            
            res.json({ user: mappedUser });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.post('/switch-context', authenticateToken, async (req, res) => {
        const { targetFamilyId } = req.body;
        const userId = req.user.id;
        try {
            const membership = await pool.query('SELECT * FROM memberships WHERE user_id = $1 AND family_id = $2', [userId, targetFamilyId]);
            if (membership.rows.length === 0) return res.status(403).json({ error: 'Acesso negado a este workspace.' });
            
            await pool.query('UPDATE users SET family_id = $1 WHERE id = $2', [targetFamilyId, userId]);
            const userRow = (await pool.query('SELECT * FROM users WHERE id = $1', [userId])).rows[0];
            const workspaces = await getUserWorkspaces(userId);
            
            const mappedUser = await ensureUserIntegrity(userRow);
            mappedUser.workspaces = workspaces;
            
            // CRÍTICO: Token agora contém o familyId ativo para isolamento no frontend
            const token = jwt.sign({ id: mappedUser.id, email: mappedUser.email, familyId: targetFamilyId }, JWT_SECRET, { expiresIn: '7d' });
            res.json({ token, user: mappedUser });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.post('/register', async (req, res) => {
      const { name, email, password, entityType, plan, pjPayload } = req.body;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const hashedPassword = await bcrypt.hash(password, 10);
        const id = crypto.randomUUID();
        
        await client.query(
            `INSERT INTO users (id, name, email, password_hash, family_id, entity_type, plan, status, role) 
             VALUES ($1, $2, $3, $4, $1, $5, $6, 'TRIALING', 'ADMIN')`, 
            [id, name, email, hashedPassword, entityType || 'PF', plan || 'MONTHLY']
        );
        
        await client.query(
            'INSERT INTO memberships (user_id, family_id, role, permissions) VALUES ($1, $1, $2, $3)', 
            [id, 'ADMIN', '[]']
        );
        
        if (entityType === 'PJ' && pjPayload) {
            await client.query(
                `INSERT INTO company_profiles (id, trade_name, legal_name, cnpj, tax_regime, cnae, city, state, has_employees, issues_invoices, user_id, family_id, zip_code, street, number, neighborhood, phone, email)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11, $12, $13, $14, $15, $16, $17)`,
                [crypto.randomUUID(), pjPayload.tradeName, pjPayload.legalName, pjPayload.cnpj, pjPayload.taxRegime, pjPayload.cnae, pjPayload.city, pjPayload.state, pjPayload.hasEmployees, pjPayload.issuesInvoices, id, pjPayload.zipCode, pjPayload.street, pjPayload.number, pjPayload.neighborhood, pjPayload.phone, pjPayload.email]
            );
        }

        await client.query('COMMIT');
        if (logAudit) await logAudit(pool, id, 'CREATE', 'user', id, `Registro via e-mail: ${name}`);

        const userRow = (await pool.query('SELECT * FROM users WHERE id = $1', [id])).rows[0];
        const workspaces = await getUserWorkspaces(id);
        const mappedUser = await ensureUserIntegrity(userRow);
        mappedUser.workspaces = workspaces;
        const token = jwt.sign({ id: mappedUser.id, email: mappedUser.email, familyId: id }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: mappedUser });
      } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); } finally { client.release(); }
    });

    router.post('/login', async (req, res) => {
      const { email, password } = req.body;
      try {
        const userRow = (await pool.query('SELECT * FROM users WHERE email = $1', [email])).rows[0];
        if (!userRow || !(await bcrypt.compare(password, userRow.password_hash))) return res.status(400).json({ error: 'Credenciais inválidas' });
        
        const workspaces = await getUserWorkspaces(userRow.id);
        const mappedUser = await ensureUserIntegrity(userRow);
        mappedUser.workspaces = workspaces;
        
        const token = jwt.sign({ id: mappedUser.id, email: mappedUser.email, familyId: mappedUser.familyId }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: mappedUser });
      } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.post('/google', async (req, res) => {
      const { credential, entityType, pjPayload } = req.body;
      const client = await pool.connect();
      try {
        const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
        const { sub: googleId, email, name } = ticket.getPayload();
        
        let userRow = (await client.query('SELECT * FROM users WHERE email = $1', [email])).rows[0];
        
        if (!userRow) {
           await client.query('BEGIN');
           const id = crypto.randomUUID();
           const finalType = entityType || 'PF';

           await client.query(
               `INSERT INTO users (id, name, email, google_id, family_id, entity_type, plan, status, role) 
                VALUES ($1, $2, $3, $4, $1, $5, 'TRIAL', 'TRIALING', 'ADMIN')`, 
               [id, name, email, googleId, finalType]
            );
           
           await client.query(
               'INSERT INTO memberships (user_id, family_id, role, permissions) VALUES ($1, $1, $2, $3)', 
               [id, 'ADMIN', '[]']
           );
           
           if (finalType === 'PJ') {
               await client.query(
                    `INSERT INTO company_profiles (id, trade_name, legal_name, cnpj, tax_regime, cnae, city, state, has_employees, issues_invoices, user_id, family_id, zip_code, street, number, neighborhood, phone, email)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11, $12, $13, $14, $15, $16, $17)`,
                    [crypto.randomUUID(), pjPayload?.tradeName || name, pjPayload?.legalName || name, pjPayload?.cnpj || '', pjPayload?.taxRegime || 'SIMPLES', pjPayload?.cnae, pjPayload?.city, pjPayload?.state, pjPayload?.hasEmployees || false, pjPayload?.issuesInvoices || false, id, pjPayload?.zipCode, pjPayload?.street, pjPayload?.number, pjPayload?.neighborhood, pjPayload?.phone, pjPayload?.email]
               );
           }
           
           await client.query('COMMIT');
           userRow = (await client.query('SELECT * FROM users WHERE id = $1', [id])).rows[0];
           if (logAudit) await logAudit(pool, id, 'CREATE', 'user', id, `Registro Google: ${name}`);
        } else if (!userRow.google_id) {
           await client.query('UPDATE users SET google_id = $1 WHERE id = $2', [googleId, userRow.id]);
           userRow.google_id = googleId;
        }

        const workspaces = await getUserWorkspaces(userRow.id);
        const mappedUser = await ensureUserIntegrity(userRow);
        mappedUser.workspaces = workspaces;
        
        const token = jwt.sign({ id: mappedUser.id, email: mappedUser.email, familyId: mappedUser.familyId }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: mappedUser });
      } catch (err) { 
        if (client) await client.query('ROLLBACK').catch(() => {});
        res.status(400).json({ error: err.message }); 
      } finally {
        client.release();
      }
    });

    return router;
}
