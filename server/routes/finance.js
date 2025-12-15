
import express from 'express';
import pool from '../db.js';
import crypto from 'crypto';
import { authenticateToken, calculateChanges, updateAccountBalance, sanitizeValue, familyCheckParam2 } from '../middleware.js';

const router = express.Router();

export default function(logAudit) {

    // --- HELPER: Get Current Family ID ---
    const getFamilyId = async (userId) => {
        const res = await pool.query('SELECT family_id FROM users WHERE id = $1', [userId]);
        return res.rows[0]?.family_id || userId;
    };

    // --- INITIAL DATA ---
    router.get('/initial-data', authenticateToken, async (req, res) => {
        const userId = req.user.id;
        try {
            const activeFamilyId = await getFamilyId(userId);
            
            // Determinar o Tipo da Entidade do Workspace Atual (PJ ou PF)
            const ownerRes = await pool.query('SELECT entity_type FROM users WHERE id = $1', [activeFamilyId]);
            const isPJ = ownerRes.rows[0]?.entity_type === 'PJ';

            // 1. AUTO-MIGRATION: Garantir que tabelas novas existam antes de consultar
            const createTablesQueries = [
                `CREATE TABLE IF NOT EXISTS service_orders (id TEXT PRIMARY KEY, number SERIAL, title TEXT, description TEXT, contact_id TEXT, status TEXT, total_amount DECIMAL, start_date DATE, end_date DATE, user_id TEXT, family_id TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, deleted_at TIMESTAMP)`,
                `CREATE TABLE IF NOT EXISTS contracts (id TEXT PRIMARY KEY, title TEXT, contact_id TEXT, value DECIMAL, start_date DATE, end_date DATE, status TEXT, billing_day INTEGER, user_id TEXT, family_id TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, deleted_at TIMESTAMP)`,
                `CREATE TABLE IF NOT EXISTS commercial_orders (id TEXT PRIMARY KEY, type TEXT, description TEXT, contact_id TEXT, amount DECIMAL, date DATE, status TEXT, transaction_id TEXT, user_id TEXT, family_id TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, deleted_at TIMESTAMP)`,
                `CREATE TABLE IF NOT EXISTS invoices (id TEXT PRIMARY KEY, number TEXT, series TEXT, type TEXT, amount DECIMAL, issue_date DATE, status TEXT, contact_id TEXT, file_url TEXT, user_id TEXT, family_id TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, deleted_at TIMESTAMP)`
            ];
            
            for (const q of createTablesQueries) {
                await pool.query(q);
            }

            // LÓGICA DE ISOLAMENTO DE DADOS (CRÍTICO)
            // Função helper para construir o filtro SQL com o alias correto
            const buildFilter = (alias) => {
                const prefix = alias ? `${alias}.` : '';
                if (isPJ) {
                    // ISOLAMENTO TOTAL PARA PJ: Apenas dados deste family_id
                    return `${prefix}family_id = $1`;
                } else {
                    // MODO HÍBRIDO PARA PF: Dados da família OU dados legados do usuário
                    return `(${prefix}family_id = $1 OR (${prefix}family_id IS NULL AND ${prefix}user_id IN (SELECT id FROM users WHERE family_id = $1)))`;
                }
            };
            
            // Garantir que TODAS as tabelas tenham a coluna family_id (Migration Lazy)
            const tablesToCheck = [
                'accounts', 'transactions', 'goals', 'contacts', 'categories', 
                'branches', 'cost_centers', 'departments', 'projects', 
                'module_clients', 'module_services', 'module_appointments',
                'service_orders', 'contracts', 'commercial_orders', 'invoices'
            ];
            const ensureCol = async (table) => {
                try { await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS family_id TEXT`); } catch(e) {}
            };
            await Promise.all(tablesToCheck.map(ensureCol));

            // Executar Queries com o Filtro Definido (Usando buildFilter)
            
            const accs = await pool.query(`SELECT * FROM accounts WHERE ${buildFilter()} AND deleted_at IS NULL`, [activeFamilyId]);
            
            // Transações (Alias 't')
            const trans = await pool.query(`SELECT t.*, uc.name as created_by_name FROM transactions t LEFT JOIN users uc ON t.created_by = uc.id WHERE ${buildFilter('t')} AND t.deleted_at IS NULL ORDER BY t.date DESC`, [activeFamilyId]);
            
            const goals = await pool.query(`SELECT * FROM goals WHERE ${buildFilter()} AND deleted_at IS NULL`, [activeFamilyId]);
            const contacts = await pool.query(`SELECT * FROM contacts WHERE ${buildFilter()} AND deleted_at IS NULL ORDER BY name ASC`, [activeFamilyId]);
            let categories = await pool.query(`SELECT * FROM categories WHERE ${buildFilter()} AND deleted_at IS NULL ORDER BY name ASC`, [activeFamilyId]);
            
            const companyRes = await pool.query(`SELECT * FROM company_profiles WHERE user_id = $1`, [activeFamilyId]);
            
            // PJ & Modules
            const branches = await pool.query(`SELECT * FROM branches WHERE ${buildFilter()} AND deleted_at IS NULL`, [activeFamilyId]);
            const costCenters = await pool.query(`SELECT * FROM cost_centers WHERE ${buildFilter()} AND deleted_at IS NULL`, [activeFamilyId]);
            const departments = await pool.query(`SELECT * FROM departments WHERE ${buildFilter()} AND deleted_at IS NULL`, [activeFamilyId]);
            const projects = await pool.query(`SELECT * FROM projects WHERE ${buildFilter()} AND deleted_at IS NULL`, [activeFamilyId]);

            // Modules (Alias 'mc' e 'ma')
            const clients = await pool.query(`SELECT mc.*, c.name as contact_name, c.email as contact_email, c.phone as contact_phone FROM module_clients mc JOIN contacts c ON mc.contact_id = c.id WHERE ${buildFilter('mc')} AND mc.deleted_at IS NULL`, [activeFamilyId]);
            const services = await pool.query(`SELECT * FROM module_services WHERE ${buildFilter()} AND deleted_at IS NULL`, [activeFamilyId]);
            const appts = await pool.query(`SELECT ma.*, c.name as client_name, ms.name as service_name FROM module_appointments ma JOIN module_clients mc ON ma.client_id = mc.id JOIN contacts c ON mc.contact_id = c.id LEFT JOIN module_services ms ON ma.service_id = ms.id WHERE ${buildFilter('ma')} AND ma.deleted_at IS NULL ORDER BY ma.date ASC`, [activeFamilyId]);

            // Services Module (OS, Sales, etc) - Alias explicit mappings
            const so = await pool.query(`SELECT s.*, c.name as contact_name FROM service_orders s LEFT JOIN contacts c ON s.contact_id = c.id WHERE ${buildFilter('s')} AND s.deleted_at IS NULL ORDER BY s.created_at DESC`, [activeFamilyId]);
            const co = await pool.query(`SELECT co.*, c.name as contact_name FROM commercial_orders co LEFT JOIN contacts c ON co.contact_id = c.id WHERE ${buildFilter('co')} AND co.deleted_at IS NULL ORDER BY co.date DESC`, [activeFamilyId]);
            const ct = await pool.query(`SELECT ct.*, c.name as contact_name FROM contracts ct LEFT JOIN contacts c ON ct.contact_id = c.id WHERE ${buildFilter('ct')} AND ct.deleted_at IS NULL ORDER BY ct.created_at DESC`, [activeFamilyId]);
            const inv = await pool.query(`SELECT i.*, c.name as contact_name FROM invoices i LEFT JOIN contacts c ON i.contact_id = c.id WHERE ${buildFilter('i')} AND i.deleted_at IS NULL ORDER BY i.issue_date DESC`, [activeFamilyId]);

            // Categorias Padrão
            if (categories.rows.length === 0) {
                const defaults = [
                    { name: 'Alimentação', type: 'EXPENSE' }, 
                    { name: 'Transporte', type: 'EXPENSE' }, 
                    { name: 'Vendas', type: 'INCOME' },
                    { name: 'Serviços', type: 'INCOME' }
                ];
                for (const c of defaults) await pool.query('INSERT INTO categories (id, name, type, user_id, family_id) VALUES ($1, $2, $3, $4, $5)', [crypto.randomUUID(), c.name, c.type, activeFamilyId, activeFamilyId]);
                // Recarregar
                categories = await pool.query(`SELECT * FROM categories WHERE ${buildFilter()} AND deleted_at IS NULL ORDER BY name ASC`, [activeFamilyId]);
            }

            res.json({
                accounts: accs.rows.map(r => ({ ...r, balance: parseFloat(r.balance), creditLimit: r.credit_limit ? parseFloat(r.credit_limit) : undefined, closingDay: r.closing_day, dueDay: r.due_day })),
                transactions: trans.rows.map(r => ({ ...r, amount: parseFloat(r.amount), date: new Date(r.date).toISOString().split('T')[0], recurrenceEndDate: r.recurrence_end_date ? new Date(r.recurrence_end_date).toISOString().split('T')[0] : undefined, interestRate: parseFloat(r.interest_rate), accountId: r.account_id, destinationAccountId: r.destination_account_id, contactId: r.contact_id, goalId: r.goal_id, branchId: r.branch_id, destinationBranchId: r.destination_branch_id, costCenterId: r.cost_center_id, departmentId: r.department_id, projectId: r.project_id, createdByName: r.created_by_name })),
                goals: goals.rows.map(r => ({ ...r, targetAmount: parseFloat(r.target_amount), currentAmount: parseFloat(r.current_amount), deadline: r.deadline ? new Date(r.deadline).toISOString().split('T')[0] : undefined })),
                contacts: contacts.rows.map(r => ({ id: r.id, name: r.name, email: r.email, phone: r.phone, document: r.document, pixKey: r.pix_key })),
                categories: categories.rows.map(r => ({ id: r.id, name: r.name, type: r.type })),
                companyProfile: companyRes.rows[0] ? { 
                    id: companyRes.rows[0].id, 
                    tradeName: companyRes.rows[0].trade_name, 
                    legalName: companyRes.rows[0].legal_name, 
                    cnpj: companyRes.rows[0].cnpj,
                    taxRegime: companyRes.rows[0].tax_regime,
                    cnae: companyRes.rows[0].cnae,
                    city: companyRes.rows[0].city,
                    state: companyRes.rows[0].state,
                    hasEmployees: companyRes.rows[0].has_employees,
                    issuesInvoices: companyRes.rows[0].issues_invoices,
                    zipCode: companyRes.rows[0].zip_code,
                    street: companyRes.rows[0].street,
                    number: companyRes.rows[0].number,
                    neighborhood: companyRes.rows[0].neighborhood,
                    phone: companyRes.rows[0].phone,
                    email: companyRes.rows[0].email,
                    secondaryCnaes: companyRes.rows[0].secondary_cnaes
                } : null,
                branches: branches.rows.map(r => ({ id: r.id, name: r.name, code: r.code })),
                costCenters: costCenters.rows.map(r => ({ id: r.id, name: r.name, code: r.code })),
                departments: departments.rows.map(r => ({ id: r.id, name: r.name })),
                projects: projects.rows.map(r => ({ id: r.id, name: r.name })),
                serviceClients: clients.rows.map(r => ({ id: r.id, contactId: r.contact_id, contactName: r.contact_name, contactEmail: r.contact_email, contactPhone: r.contact_phone, notes: r.notes, birthDate: r.birth_date ? new Date(r.birth_date).toISOString().split('T')[0] : undefined, insurance: r.insurance, allergies: r.allergies, medications: r.medications, moduleTag: r.module_tag })),
                serviceItems: services.rows.map(r => ({ id: r.id, name: r.name, code: r.code, defaultPrice: parseFloat(r.default_price), moduleTag: r.module_tag })),
                serviceAppointments: appts.rows.map(r => ({ id: r.id, clientId: r.client_id, clientName: r.client_name, serviceId: r.service_id, serviceName: r.service_name, date: r.date, status: r.status, notes: r.notes, transactionId: r.transaction_id, moduleTag: r.module_tag })),
                
                // Services Module Data Mappers
                serviceOrders: so.rows.map(r => ({ id: r.id, number: r.number, title: r.title, description: r.description, contactId: r.contact_id, contactName: r.contact_name, status: r.status, totalAmount: parseFloat(r.total_amount), startDate: r.start_date ? new Date(r.start_date).toISOString().split('T')[0] : undefined, endDate: r.end_date ? new Date(r.end_date).toISOString().split('T')[0] : undefined })),
                commercialOrders: co.rows.map(r => ({ id: r.id, type: r.type, description: r.description, contactId: r.contact_id, contactName: r.contact_name, amount: parseFloat(r.amount), date: new Date(r.date).toISOString().split('T')[0], status: r.status, transactionId: r.transaction_id })),
                contracts: ct.rows.map(r => ({ id: r.id, title: r.title, contactId: r.contact_id, contactName: r.contact_name, value: parseFloat(r.value), startDate: new Date(r.start_date).toISOString().split('T')[0], endDate: r.end_date ? new Date(r.end_date).toISOString().split('T')[0] : undefined, status: r.status, billingDay: r.billing_day })),
                invoices: inv.rows.map(r => ({ id: r.id, number: r.number, series: r.series, type: r.type, amount: parseFloat(r.amount), issueDate: new Date(r.issue_date).toISOString().split('T')[0], status: r.status, contactId: r.contact_id, contactName: r.contact_name, fileUrl: r.file_url }))
            });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // --- ACCOUNTS ---
    router.post('/accounts', authenticateToken, async (req, res) => {
        const { id, name, type, balance, creditLimit, closingDay, dueDay } = req.body;
        try {
            const familyId = await getFamilyId(req.user.id);
            await pool.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS family_id TEXT`);

            const existing = (await pool.query('SELECT * FROM accounts WHERE id = $1', [id])).rows[0];
            const changes = calculateChanges(existing, req.body, { name: 'name', type: 'type', balance: 'balance', creditLimit: 'credit_limit', closingDay: 'closing_day', dueDay: 'due_day' });
            
            // Insert with family_id
            await pool.query(`INSERT INTO accounts (id, name, type, balance, user_id, family_id, credit_limit, closing_day, due_day) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO UPDATE SET name=$2, type=$3, balance=$4, credit_limit=$7, closing_day=$8, due_day=$9, deleted_at=NULL`, 
            [id, name, type, balance, req.user.id, familyId, creditLimit||null, closingDay||null, dueDay||null]);
            
            await logAudit(pool, req.user.id, existing ? 'UPDATE' : 'CREATE', 'account', id, `Conta: ${name}`, existing, changes);
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });
    router.delete('/accounts/:id', authenticateToken, async (req, res) => {
        try {
            const prev = (await pool.query('SELECT * FROM accounts WHERE id=$1', [req.params.id])).rows[0];
            // Soft delete with validation (must own directly or via family)
            await pool.query(`UPDATE accounts SET deleted_at = NOW() WHERE id = $1 AND (user_id = $2 OR family_id = (SELECT family_id FROM users WHERE id = $2))`, [req.params.id, req.user.id]);
            await logAudit(pool, req.user.id, 'DELETE', 'account', req.params.id, `Conta: ${prev?.name}`, prev);
            res.json({ success: true });
        } catch(err) { res.status(500).json({ error: err.message }); }
    });

    // --- TRANSACTIONS ---
    router.post('/transactions', authenticateToken, async (req, res) => {
        const t = req.body; const u = req.user.id;
        try {
            const familyId = await getFamilyId(u);
            await pool.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS family_id TEXT`);

            const existing = (await pool.query('SELECT * FROM transactions WHERE id=$1', [t.id])).rows[0];
            const changes = calculateChanges(existing, t, { description: 'description', amount: 'amount', type: 'type', category: 'category', date: 'date', status: 'status', accountId: 'account_id', destinationAccountId: 'destination_account_id' });
            
            await pool.query(`INSERT INTO transactions (id, description, amount, type, category, date, status, account_id, destination_account_id, is_recurring, recurrence_frequency, recurrence_end_date, interest_rate, contact_id, goal_id, user_id, family_id, branch_id, cost_center_id, department_id, project_id, classification, destination_branch_id, created_by, updated_by, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $24, NOW()) ON CONFLICT (id) DO UPDATE SET description=$2, amount=$3, type=$4, category=$5, date=$6, status=$7, account_id=$8, destination_account_id=$9, is_recurring=$10, recurrence_frequency=$11, recurrence_end_date=$12, interest_rate=$13, contact_id=$14, goal_id=$15, branch_id=$18, cost_center_id=$19, department_id=$20, project_id=$21, classification=$22, destination_branch_id=$23, updated_by=$24, updated_at=NOW(), deleted_at=NULL`, 
            [t.id, t.description, t.amount, t.type, t.category, t.date, t.status, t.accountId, sanitizeValue(t.destinationAccountId), t.isRecurring, t.recurrenceFrequency, t.recurrenceEndDate, t.interestRate||0, sanitizeValue(t.contactId), sanitizeValue(t.goalId), u, familyId, sanitizeValue(t.branchId), sanitizeValue(t.costCenterId), sanitizeValue(t.departmentId), sanitizeValue(t.projectId), t.classification||'STANDARD', sanitizeValue(t.destinationBranchId), u]);
            
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
            // Validate ownership/family
            await pool.query(`UPDATE transactions SET deleted_at = NOW() WHERE id = $1 AND (user_id = $2 OR family_id = (SELECT family_id FROM users WHERE id = $2))`, [req.params.id, req.user.id]);
            if (prev && prev.goal_id && prev.status === 'PAID') await pool.query(`UPDATE goals SET current_amount = current_amount - $1 WHERE id = $2`, [prev.amount, prev.goal_id]);
            await logAudit(pool, req.user.id, 'DELETE', 'transaction', req.params.id, prev?.description, prev);
            res.json({ success: true });
        } catch(err) { res.status(500).json({ error: err.message }); }
    });

    // --- CATEGORIES ---
    router.post('/categories', authenticateToken, async (req, res) => {
        const { id, name, type } = req.body;
        try {
            const familyId = await getFamilyId(req.user.id);
            await pool.query(`ALTER TABLE categories ADD COLUMN IF NOT EXISTS family_id TEXT`);

            const existing = (await pool.query('SELECT * FROM categories WHERE id=$1', [id])).rows[0];
            const changes = calculateChanges(existing, req.body, { name: 'name', type: 'type' });
            await pool.query(`INSERT INTO categories (id, name, type, user_id, family_id) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO UPDATE SET name=$2, type=$3, deleted_at=NULL`, [id, name, type||null, req.user.id, familyId]);
            await logAudit(pool, req.user.id, existing ? 'UPDATE' : 'CREATE', 'category', id, name, existing, changes);
            res.json({ success: true });
        } catch(err) { res.status(500).json({ error: err.message }); }
    });
    router.delete('/categories/:id', authenticateToken, async (req, res) => {
        try {
            const prev = (await pool.query('SELECT * FROM categories WHERE id=$1', [req.params.id])).rows[0];
            await pool.query(`UPDATE categories SET deleted_at = NOW() WHERE id = $1 AND (user_id = $2 OR family_id = (SELECT family_id FROM users WHERE id = $2))`, [req.params.id, req.user.id]);
            await logAudit(pool, req.user.id, 'DELETE', 'category', req.params.id, prev?.name, prev);
            res.json({ success: true });
        } catch(err) { res.status(500).json({ error: err.message }); }
    });

    // --- GOALS ---
    router.post('/goals', authenticateToken, async (req, res) => {
        const { id, name, targetAmount, currentAmount, deadline } = req.body;
        try {
            const familyId = await getFamilyId(req.user.id);
            await pool.query(`ALTER TABLE goals ADD COLUMN IF NOT EXISTS family_id TEXT`);

            const existing = (await pool.query('SELECT * FROM goals WHERE id=$1', [id])).rows[0];
            const changes = calculateChanges(existing, req.body, { name: 'name', targetAmount: 'target_amount', currentAmount: 'current_amount', deadline: 'deadline' });
            await pool.query(`INSERT INTO goals (id, name, target_amount, current_amount, deadline, user_id, family_id) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO UPDATE SET name=$2, target_amount=$3, current_amount=$4, deadline=$5, deleted_at=NULL`, [id, name, targetAmount, currentAmount, deadline||null, req.user.id, familyId]);
            await logAudit(pool, req.user.id, existing ? 'UPDATE' : 'CREATE', 'goal', id, name, existing, changes);
            res.json({ success: true });
        } catch(err) { res.status(500).json({ error: err.message }); }
    });
    router.delete('/goals/:id', authenticateToken, async (req, res) => {
        try {
            const prev = (await pool.query('SELECT * FROM goals WHERE id=$1', [req.params.id])).rows[0];
            await pool.query(`UPDATE goals SET deleted_at = NOW() WHERE id = $1 AND (user_id = $2 OR family_id = (SELECT family_id FROM users WHERE id = $2))`, [req.params.id, req.user.id]);
            await logAudit(pool, req.user.id, 'DELETE', 'goal', req.params.id, prev?.name, prev);
            res.json({ success: true });
        } catch(err) { res.status(500).json({ error: err.message }); }
    });

    return router;
}
