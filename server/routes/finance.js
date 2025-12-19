
import express from 'express';
import pool from '../db.js';
import crypto from 'crypto';
import multer from 'multer';
import { Storage } from '@google-cloud/storage';
import { authenticateToken, updateAccountBalance, sanitizeValue } from '../middleware.js';

const router = express.Router();
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // Limite de 10MB por arquivo
});

// Configuração do Google Cloud Storage
const storage = new Storage();
const bucketName = process.env.GCS_BUCKET_NAME || 'finmanager-attachments';
const bucket = storage.bucket(bucketName);

export default function(logAudit) {
    
    // Rota de Upload: Salva arquivos na pasta 'attachments/' no bucket
    router.post('/upload', authenticateToken, upload.array('files'), async (req, res) => {
        try {
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
            }

            const [exists] = await bucket.exists();
            if (!exists) {
                console.error(`[CRÍTICO] Bucket "${bucketName}" não encontrado no Google Cloud.`);
                return res.status(500).json({ error: `Configuração incorreta: Bucket ${bucketName} inexistente.` });
            }

            const uploadPromises = req.files.map(file => {
                const cleanName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
                const fileName = `attachments/${req.user.id}/${crypto.randomUUID()}-${cleanName}`;
                
                const blob = bucket.file(fileName);
                const blobStream = blob.createWriteStream({
                    resumable: false,
                    metadata: { 
                        contentType: file.mimetype,
                        cacheControl: 'public, max-age=31536000'
                    }
                });

                return new Promise((resolve, reject) => {
                    blobStream.on('error', err => {
                        console.error("[GCS Stream Error]", err);
                        reject(err);
                    });

                    blobStream.on('finish', async () => {
                        try {
                            try {
                                await blob.makePublic();
                            } catch (e) {
                                console.warn(`[GCS IAM] Falha ao executar makePublic() em ${fileName}. Verifique as permissões de ACL do bucket.`);
                            }
                            
                            const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
                            resolve(publicUrl);
                        } catch (err) {
                            reject(err);
                        }
                    });

                    blobStream.end(file.buffer);
                });
            });

            const urls = await Promise.all(uploadPromises);
            res.json({ urls });
        } catch (err) {
            console.error("GCS Processing Error:", err);
            res.status(500).json({ error: 'Erro ao processar o envio para nuvem: ' + err.message });
        }
    });

    router.get('/initial-data', authenticateToken, async (req, res) => {
        const userId = req.user.id;
        try {
            const userRes = await pool.query('SELECT family_id FROM users WHERE id = $1', [userId]);
            const activeFamilyId = userRes.rows[0]?.family_id || userId;

            const buildFilter = (alias = '') => {
                const prefix = alias ? `${alias}.` : '';
                return `(${prefix}family_id = $1 OR (${prefix}family_id IS NULL AND ${prefix}user_id = $1))`;
            };

            const accs = await pool.query(`SELECT * FROM accounts WHERE ${buildFilter()} AND deleted_at IS NULL`, [activeFamilyId]);
            
            const trans = await pool.query(`
                SELECT t.*, u.name as created_by_name 
                FROM transactions t 
                JOIN users u ON t.user_id = u.id 
                WHERE ${buildFilter('t')} AND t.deleted_at IS NULL 
                ORDER BY t.date DESC LIMIT 500
            `, [activeFamilyId]);

            const goals = await pool.query(`SELECT * FROM goals WHERE ${buildFilter()} AND deleted_at IS NULL`, [activeFamilyId]);
            const contacts = await pool.query(`SELECT * FROM contacts WHERE ${buildFilter()} AND deleted_at IS NULL`, [activeFamilyId]);
            let categories = await pool.query(`SELECT * FROM categories WHERE ${buildFilter()} AND deleted_at IS NULL`, [activeFamilyId]);
            
            const companyRes = await pool.query(`SELECT * FROM company_profiles WHERE user_id = $1`, [activeFamilyId]);
            
            const branches = await pool.query(`SELECT * FROM branches WHERE family_id = $1`, [activeFamilyId]);
            const costCenters = await pool.query(`SELECT * FROM cost_centers WHERE family_id = $1`, [activeFamilyId]);
            const departments = await pool.query(`SELECT * FROM departments WHERE family_id = $1`, [activeFamilyId]);
            const projects = await pool.query(`SELECT * FROM projects WHERE family_id = $1`, [activeFamilyId]);

            const srvItems = await pool.query(`SELECT * FROM module_services WHERE family_id = $1 AND deleted_at IS NULL`, [activeFamilyId]);

            const commOrders = await pool.query(`
                SELECT o.*, c.name as contact_name, u.name as created_by_name
                FROM commercial_orders o 
                LEFT JOIN contacts c ON o.contact_id = c.id 
                JOIN users u ON o.user_id = u.id
                WHERE ${buildFilter('o')} AND o.deleted_at IS NULL
            `, [activeFamilyId]);

            const serviceOrdersRes = await pool.query(`
                SELECT so.*, c.name as contact_name, u.name as created_by_name
                FROM service_orders so 
                LEFT JOIN contacts c ON so.contact_id = c.id 
                JOIN users u ON so.user_id = u.id
                WHERE ${buildFilter('so')} AND so.deleted_at IS NULL
            `, [activeFamilyId]);

            const contractsRes = await pool.query(`
                SELECT ct.*, c.name as contact_name, u.name as created_by_name
                FROM contracts ct 
                LEFT JOIN contacts c ON ct.contact_id = c.id 
                JOIN users u ON ct.user_id = u.id
                WHERE ${buildFilter('ct')} AND ct.deleted_at IS NULL
            `, [activeFamilyId]);

            const invoicesRes = await pool.query(`
                SELECT inv.*, c.name as contact_name 
                FROM invoices inv 
                LEFT JOIN contacts c ON inv.contact_id = c.id 
                WHERE ${buildFilter('inv')} AND inv.deleted_at IS NULL
            `, [activeFamilyId]);

            res.json({
                accounts: accs.rows.map(r => ({ ...r, balance: parseFloat(r.balance) })),
                transactions: trans.rows.map(r => ({ 
                    ...r, 
                    amount: parseFloat(r.amount), 
                    date: new Date(r.date).toISOString().split('T')[0],
                    createdByName: r.created_by_name,
                    receiptUrls: Array.isArray(r.receipt_urls) ? r.receipt_urls : []
                })),
                goals: goals.rows.map(r => ({ ...r, targetAmount: parseFloat(r.target_amount), currentAmount: parseFloat(r.current_amount) })),
                contacts: contacts.rows,
                categories: categories.rows,
                companyProfile: companyRes.rows[0] || null,
                branches: branches.rows,
                costCenters: costCenters.rows,
                departments: departments.rows,
                projects: projects.rows,
                serviceItems: srvItems.rows.map(r => ({
                    id: r.id,
                    name: r.name,
                    code: r.code,
                    type: r.type,
                    defaultPrice: parseFloat(r.default_price || 0),
                    costPrice: parseFloat(r.cost_price || 0),
                    unit: r.unit,
                    description: r.description,
                    moduleTag: r.module_tag,
                    imageUrl: r.image_url,
                    brand: r.brand,
                    defaultDuration: r.default_duration || 0,
                    items: r.items || []
                })),
                serviceClients: [], 
                serviceAppointments: [],
                serviceOrders: serviceOrdersRes.rows.map(r => ({
                    ...r,
                    totalAmount: parseFloat(r.total_amount || 0),
                    contactName: r.contact_name,
                    createdByName: r.created_by_name,
                    startDate: r.start_date ? new Date(r.start_date).toISOString().split('T')[0] : null,
                    endDate: r.end_date ? new Date(r.end_date).toISOString().split('T')[0] : null
                })),
                commercialOrders: commOrders.rows.map(r => ({
                    id: r.id,
                    type: r.type,
                    description: r.description,
                    contactId: r.contact_id,
                    contactName: r.contact_name,
                    createdByName: r.created_by_name,
                    amount: parseFloat(r.amount || 0),
                    grossAmount: parseFloat(r.gross_amount || 0),
                    discountAmount: parseFloat(r.discount_amount || 0),
                    taxAmount: parseFloat(r.tax_amount || 0),
                    items: r.items || [],
                    date: new Date(r.date).toISOString().split('T')[0],
                    status: r.status,
                    transactionId: r.transaction_id
                })),
                contracts: contractsRes.rows.map(r => ({
                    ...r,
                    value: parseFloat(r.value || 0),
                    contactName: r.contact_name,
                    createdByName: r.created_by_name,
                    startDate: new Date(r.start_date).toISOString().split('T')[0],
                    endDate: r.end_date ? new Date(r.end_date).toISOString().split('T')[0] : null
                })),
                invoices: invoicesRes.rows.map(r => ({
                    ...r,
                    amount: parseFloat(r.amount || 0),
                    contactName: r.contact_name,
                    issueDate: new Date(r.issue_date).toISOString().split('T')[0]
                }))
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    // --- TRANSACTIONS ---
    router.post('/transactions', authenticateToken, async (req, res) => {
        const t = req.body;
        const userId = req.user.id;
        const client = await pool.connect();
        try {
            const familyIdRes = await client.query('SELECT family_id FROM users WHERE id = $1', [userId]);
            const familyId = familyIdRes.rows[0]?.family_id || userId;
            
            await client.query('BEGIN');
            const id = t.id || crypto.randomUUID();

            const existingRes = await client.query('SELECT * FROM transactions WHERE id = $1', [id]);
            const isUpdate = existingRes.rows.length > 0;

            await client.query(
                `INSERT INTO transactions (id, description, amount, type, category, date, status, account_id, destination_account_id, contact_id, user_id, family_id, is_recurring, recurrence_frequency, recurrence_end_date, receipt_urls)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                 ON CONFLICT (id) DO UPDATE SET description=$2, amount=$3, type=$4, category=$5, date=$6, status=$7, account_id=$8, destination_account_id=$9, contact_id=$10, family_id=$12, receipt_urls=$16`,
                [id, t.description, t.amount, t.type, t.category, t.date, t.status, t.accountId, t.destinationAccountId, t.contactId, userId, familyId, t.isRecurring, t.recurrenceFrequency, t.recurrenceEndDate, JSON.stringify(t.receiptUrls || [])]
            );

            if (t.status === 'PAID') {
                await updateAccountBalance(client, t.accountId, t.amount, t.type);
                if (t.type === 'TRANSFER' && t.destinationAccountId) {
                    await updateAccountBalance(client, t.destinationAccountId, t.amount, 'INCOME');
                }
            }
            
            await client.query('COMMIT');
            await logAudit(pool, userId, isUpdate ? 'UPDATE' : 'CREATE', 'transaction', id, t.description);
            res.json({ success: true, id });
        } catch (err) {
            await client.query('ROLLBACK');
            res.status(500).json({ error: err.message });
        } finally {
            client.release();
        }
    });

    router.delete('/transactions/:id', authenticateToken, async (req, res) => {
        try {
            const familyIdRes = await pool.query('SELECT family_id FROM users WHERE id = $1', [req.user.id]);
            const familyId = familyIdRes.rows[0]?.family_id;
            await pool.query(`UPDATE transactions SET deleted_at = NOW() WHERE id = $1 AND family_id = $2`, [req.params.id, familyId]);
            await logAudit(pool, req.user.id, 'DELETE', 'transaction', req.params.id, 'Transação removida');
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    return router;
}
