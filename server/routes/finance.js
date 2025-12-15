
import express from 'express';
import pool from '../db.js';
import { authenticateToken, calculateChanges, updateAccountBalance, sanitizeValue, familyCheckParam2 } from '../middleware.js';

const router = express.Router();

export default function(logAudit) {

    // --- ACCOUNTS ---
    router.post('/accounts', authenticateToken, async (req, res) => {
        const { id, name, type, balance, creditLimit, closingDay, dueDay } = req.body;
        try {
            const existing = (await pool.query('SELECT * FROM accounts WHERE id = $1', [id])).rows[0];
            const changes = calculateChanges(existing, req.body, { name: 'name', type: 'type', balance: 'balance', creditLimit: 'credit_limit', closingDay: 'closing_day', dueDay: 'due_day' });
            await pool.query(`INSERT INTO accounts (id, name, type, balance, user_id, credit_limit, closing_day, due_day) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO UPDATE SET name=$2, type=$3, balance=$4, credit_limit=$6, closing_day=$7, due_day=$8, deleted_at=NULL`, [id, name, type, balance, req.user.id, creditLimit||null, closingDay||null, dueDay||null]);
            await logAudit(pool, req.user.id, existing ? 'UPDATE' : 'CREATE', 'account', id, `Conta: ${name}`, existing, changes);
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });
    router.delete('/accounts/:id', authenticateToken, async (req, res) => {
        try {
            const prev = (await pool.query('SELECT * FROM accounts WHERE id=$1', [req.params.id])).rows[0];
            await pool.query(`UPDATE accounts SET deleted_at = NOW() WHERE id = $1 AND ${familyCheckParam2}`, [req.params.id, req.user.id]);
            await logAudit(pool, req.user.id, 'DELETE', 'account', req.params.id, `Conta: ${prev?.name}`, prev);
            res.json({ success: true });
        } catch(err) { res.status(500).json({ error: err.message }); }
    });

    // --- TRANSACTIONS ---
    router.post('/transactions', authenticateToken, async (req, res) => {
        const t = req.body; const u = req.user.id;
        try {
            const existing = (await pool.query('SELECT * FROM transactions WHERE id=$1', [t.id])).rows[0];
            const changes = calculateChanges(existing, t, { description: 'description', amount: 'amount', type: 'type', category: 'category', date: 'date', status: 'status', accountId: 'account_id', destinationAccountId: 'destination_account_id' });
            await pool.query(`INSERT INTO transactions (id, description, amount, type, category, date, status, account_id, destination_account_id, is_recurring, recurrence_frequency, recurrence_end_date, interest_rate, contact_id, goal_id, user_id, branch_id, cost_center_id, department_id, project_id, classification, destination_branch_id, created_by, updated_by, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $23, NOW()) ON CONFLICT (id) DO UPDATE SET description=$2, amount=$3, type=$4, category=$5, date=$6, status=$7, account_id=$8, destination_account_id=$9, is_recurring=$10, recurrence_frequency=$11, recurrence_end_date=$12, interest_rate=$13, contact_id=$14, goal_id=$15, branch_id=$17, cost_center_id=$18, department_id=$19, project_id=$20, classification=$21, destination_branch_id=$22, updated_by=$23, updated_at=NOW(), deleted_at=NULL`, 
            [t.id, t.description, t.amount, t.type, t.category, t.date, t.status, t.accountId, sanitizeValue(t.destinationAccountId), t.isRecurring, t.recurrenceFrequency, t.recurrenceEndDate, t.interestRate||0, sanitizeValue(t.contactId), sanitizeValue(t.goalId), u, sanitizeValue(t.branchId), sanitizeValue(t.costCenterId), sanitizeValue(t.departmentId), sanitizeValue(t.projectId), t.classification||'STANDARD', sanitizeValue(t.destinationBranchId), u]);
            
            if (t.goalId && t.status === 'PAID') {
                const diff = parseFloat(t.amount) - (existing && existing.goal_id === t.goalId ? parseFloat(existing.amount) : 0);
                await pool.query(`UPDATE goals SET current_amount = current_amount + $1 WHERE id = $2`, [diff, t.goalId]);
            }
            await logAudit(pool, u, existing ? 'UPDATE' : 'CREATE', 'transaction', t.id, `${t.type}: ${t.description}`, existing, changes);
            res.json({ success: true });
        } catch(err) { res.status(500).json({ error: err.message }); }
    });
    router.delete('/transactions/:id', authenticateToken, async (req, res) => {
        try {
            const prev = (await pool.query('SELECT * FROM transactions WHERE id=$1', [req.params.id])).rows[0];
            await pool.query(`UPDATE transactions SET deleted_at = NOW() WHERE id = $1 AND ${familyCheckParam2}`, [req.params.id, req.user.id]);
            if (prev && prev.goal_id && prev.status === 'PAID') await pool.query(`UPDATE goals SET current_amount = current_amount - $1 WHERE id = $2`, [prev.amount, prev.goal_id]);
            await logAudit(pool, req.user.id, 'DELETE', 'transaction', req.params.id, prev?.description, prev);
            res.json({ success: true });
        } catch(err) { res.status(500).json({ error: err.message }); }
    });

    // --- CATEGORIES ---
    router.post('/categories', authenticateToken, async (req, res) => {
        const { id, name, type } = req.body;
        try {
            const existing = (await pool.query('SELECT * FROM categories WHERE id=$1', [id])).rows[0];
            const changes = calculateChanges(existing, req.body, { name: 'name', type: 'type' });
            await pool.query(`INSERT INTO categories (id, name, type, user_id) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET name=$2, type=$3, deleted_at=NULL`, [id, name, type||null, req.user.id]);
            await logAudit(pool, req.user.id, existing ? 'UPDATE' : 'CREATE', 'category', id, name, existing, changes);
            res.json({ success: true });
        } catch(err) { res.status(500).json({ error: err.message }); }
    });
    router.delete('/categories/:id', authenticateToken, async (req, res) => {
        try {
            const prev = (await pool.query('SELECT * FROM categories WHERE id=$1', [req.params.id])).rows[0];
            await pool.query(`UPDATE categories SET deleted_at = NOW() WHERE id = $1 AND ${familyCheckParam2}`, [req.params.id, req.user.id]);
            await logAudit(pool, req.user.id, 'DELETE', 'category', req.params.id, prev?.name, prev);
            res.json({ success: true });
        } catch(err) { res.status(500).json({ error: err.message }); }
    });

    // --- GOALS ---
    router.post('/goals', authenticateToken, async (req, res) => {
        const { id, name, targetAmount, currentAmount, deadline } = req.body;
        try {
            const existing = (await pool.query('SELECT * FROM goals WHERE id=$1', [id])).rows[0];
            const changes = calculateChanges(existing, req.body, { name: 'name', targetAmount: 'target_amount', currentAmount: 'current_amount', deadline: 'deadline' });
            await pool.query(`INSERT INTO goals (id, name, target_amount, current_amount, deadline, user_id) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET name=$2, target_amount=$3, current_amount=$4, deadline=$5, deleted_at=NULL`, [id, name, targetAmount, currentAmount, deadline||null, req.user.id]);
            await logAudit(pool, req.user.id, existing ? 'UPDATE' : 'CREATE', 'goal', id, name, existing, changes);
            res.json({ success: true });
        } catch(err) { res.status(500).json({ error: err.message }); }
    });
    router.delete('/goals/:id', authenticateToken, async (req, res) => {
        try {
            const prev = (await pool.query('SELECT * FROM goals WHERE id=$1', [req.params.id])).rows[0];
            await pool.query(`UPDATE goals SET deleted_at = NOW() WHERE id = $1 AND ${familyCheckParam2}`, [req.params.id, req.user.id]);
            await logAudit(pool, req.user.id, 'DELETE', 'goal', req.params.id, prev?.name, prev);
            res.json({ success: true });
        } catch(err) { res.status(500).json({ error: err.message }); }
    });

    return router;
}
