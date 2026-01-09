
import express from 'express';
import pool from '../db.js';
import { authenticateToken, updateAccountBalance, sanitizeValue, calculateChanges } from '../middleware.js';

const router = express.Router();

// Mapeamento de campos para auditoria
const transactionKeyMap = {
    description: 'description',
    amount: 'amount',
    type: 'type',
    category: 'category',
    date: 'date',
    status: 'status',
    accountId: 'account_id',
    contactId: 'contact_id',
    branchId: 'branch_id'
};

const calculateImpact = (status, amount, type) => {
    if (status !== 'PAID') return 0;
    const numericAmount = Number(amount);
    if (type === 'EXPENSE') return -numericAmount;
    if (type === 'INCOME') return numericAmount;
    if (type === 'TRANSFER') return -numericAmount;
    return 0;
};

export default function(logAudit) {
    router.post('/sync', authenticateToken, async (req, res) => {
        const { action, payload } = req.body;
        const userId = req.user.id;
        let client;

        try {
            client = await pool.connect();
            const familyIdRes = await client.query('SELECT family_id FROM users WHERE id = $1', [userId]);
            const familyId = familyIdRes.rows[0]?.family_id || userId;
            
            await client.query('BEGIN');

            if (action === 'DELETE') {
                const tRes = await client.query('SELECT * FROM transactions WHERE id = $1 FOR UPDATE', [payload.id]);
                const oldT = tRes.rows[0];
                
                if (oldT) {
                    if (oldT.status === 'PAID') {
                        const amount = Number(oldT.amount);
                        if (oldT.type === 'TRANSFER') {
                            await updateAccountBalance(client, oldT.account_id, amount, 'EXPENSE', true);
                            if (oldT.destination_account_id) await updateAccountBalance(client, oldT.destination_account_id, amount, 'INCOME', true);
                        } else {
                            await updateAccountBalance(client, oldT.account_id, amount, oldT.type, true);
                        }
                    }
                    await client.query(`UPDATE transactions SET deleted_at = NOW() WHERE id = $1 AND family_id = $2`, [payload.id, familyId]);
                    
                    // Log com estado anterior para permitir reversão
                    await logAudit(client, userId, 'DELETE', 'transaction', payload.id, `Exclusão: ${oldT.description}`, oldT);
                }

            } else if (action === 'SAVE') {
                const existingRes = await client.query('SELECT * FROM transactions WHERE id = $1 FOR UPDATE', [payload.id]);
                const oldT = existingRes.rows[0];
                
                const oldImpact = calculateImpact(oldT?.status, oldT?.amount, oldT?.type);
                const newImpact = calculateImpact(payload.status, payload.amount, payload.type);
                const delta = newImpact - oldImpact;

                // Atualização de saldo
                if (oldT && oldT.account_id !== payload.accountId) {
                    if (oldImpact !== 0) await updateAccountBalance(client, oldT.account_id, Math.abs(oldImpact), oldT.type, true);
                    if (newImpact !== 0) await updateAccountBalance(client, payload.accountId, Math.abs(newImpact), payload.type, false);
                } else if (delta !== 0) {
                    await client.query(`UPDATE accounts SET balance = balance + $1 WHERE id = $2`, [delta, payload.accountId]);
                }

                // Lógica de transferência
                if (payload.type === 'TRANSFER') {
                    const oldDestImpact = (oldT?.type === 'TRANSFER' && oldT?.status === 'PAID') ? Number(oldT.amount) : 0;
                    const newDestImpact = (payload.status === 'PAID') ? Number(payload.amount) : 0;
                    if (oldT && oldT.destination_account_id && oldT.destination_account_id !== payload.destinationAccountId) {
                        if (oldDestImpact !== 0) await updateAccountBalance(client, oldT.destination_account_id, oldDestImpact, 'INCOME', true);
                        if (newDestImpact !== 0) await updateAccountBalance(client, payload.destinationAccountId, newDestImpact, 'INCOME', false);
                    } else if (payload.destinationAccountId) {
                        const destDelta = newDestImpact - oldDestImpact;
                        if (destDelta !== 0) await client.query(`UPDATE accounts SET balance = balance + $1 WHERE id = $2`, [destDelta, payload.destinationAccountId]);
                    }
                }

                const query = `
                    INSERT INTO transactions (id, user_id, family_id, description, amount, type, category, date, status, account_id, destination_account_id, contact_id, is_recurring, recurrence_frequency, recurrence_end_date, branch_id)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                    ON CONFLICT (id) DO UPDATE SET 
                        description=EXCLUDED.description, amount=EXCLUDED.amount, type=EXCLUDED.type, category=EXCLUDED.category, 
                        date=EXCLUDED.date, status=EXCLUDED.status, account_id=EXCLUDED.account_id, 
                        destination_account_id=EXCLUDED.destination_account_id, contact_id=EXCLUDED.contact_id, deleted_at=NULL`;
                
                await client.query(query, [
                    payload.id, userId, familyId, payload.description, Number(payload.amount), payload.type, 
                    payload.category || 'Geral', payload.date, payload.status, payload.accountId, 
                    payload.destination_account_id || payload.destinationAccountId, sanitizeValue(payload.contactId), payload.isRecurring || false, 
                    payload.recurrenceFrequency, sanitizeValue(payload.recurrenceEndDate), sanitizeValue(payload.branchId)
                ]);

                // Cálculo de mudanças para o Log
                if (oldT) {
                    const changes = calculateChanges(oldT, payload, transactionKeyMap);
                    if (changes) await logAudit(client, userId, 'UPDATE', 'transaction', payload.id, payload.description, oldT, changes);
                } else {
                    // Para criação, enviamos o payload como 'changes' para exibição na UI
                    await logAudit(client, userId, 'CREATE', 'transaction', payload.id, payload.description, null, payload);
                }
            }

            await client.query('COMMIT');
            res.json({ success: true });
        } catch (err) {
            if (client) await client.query('ROLLBACK').catch(() => {});
            res.status(500).json({ error: err.message });
        } finally { if (client) client.release(); }
    });
    return router;
}
