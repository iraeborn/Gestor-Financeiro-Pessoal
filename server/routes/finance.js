
import express from 'express';
import pool from '../db.js';
import crypto from 'crypto';
import multer from 'multer';
import { authenticateToken, updateAccountBalance, sanitizeValue } from '../middleware.js';
import { uploadFiles } from '../services/storage.js';

const router = express.Router();
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } 
});

export default function(logAudit) {

    const getFamilyId = async (userId) => {
        const res = await pool.query('SELECT family_id FROM users WHERE id = $1', [userId]);
        return res.rows[0]?.family_id || userId;
    };
    
    router.post('/transactions', authenticateToken, async (req, res) => {
        const t = req.body;
        const userId = req.user.id;
        const client = await pool.connect();
        try {
            const familyId = await getFamilyId(userId);
            await client.query('BEGIN');
            const id = t.id || crypto.randomUUID();
            const existingRes = await client.query('SELECT * FROM transactions WHERE id = $1', [id]);
            const isUpdate = existingRes.rows.length > 0;

            await client.query(
                `INSERT INTO transactions (id, description, amount, type, category, date, status, account_id, destination_account_id, contact_id, goal_id, user_id, family_id, is_recurring, receipt_urls)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                 ON CONFLICT (id) DO UPDATE SET description=$2, amount=$3, type=$4, category=$5, date=$6, status=$7, account_id=$8, destination_account_id=$9, contact_id=$10, goal_id=$11, family_id=$13, receipt_urls=$15`,
                [id, t.description, t.amount, t.type, t.category, t.date, t.status, t.accountId, sanitizeValue(t.destinationAccountId), sanitizeValue(t.contactId), sanitizeValue(t.goalId), userId, familyId, t.isRecurring || false, JSON.stringify(t.receiptUrls || [])]
            );

            if (t.status === 'PAID') {
                await updateAccountBalance(client, t.accountId, t.amount, t.type);
                if (t.type === 'TRANSFER' && t.destinationAccountId) await updateAccountBalance(client, t.destinationAccountId, t.amount, 'INCOME');
            }
            
            await client.query('COMMIT');
            await logAudit(pool, userId, isUpdate ? 'UPDATE' : 'CREATE', 'transaction', id, t.description);
            res.json({ success: true, id });
        } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); } finally { client.release(); }
    });

    router.post('/upload', authenticateToken, upload.array('files'), async (req, res) => {
        try {
            const urls = await uploadFiles(req.files, req.user.id);
            res.json({ urls });
        } catch (err) { 
            res.status(500).json({ error: err.message }); 
        }
    });

    return router;
}
