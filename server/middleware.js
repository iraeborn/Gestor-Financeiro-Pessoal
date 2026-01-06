
import jwt from 'jsonwebtoken';
import pool from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.sendStatus(401);
  const token = authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Helper para calcular Diff entre objeto antigo (DB SnakeCase) e novo (Req Body CamelCase)
export const calculateChanges = (oldObj, newObj, keyMap) => {
    if (!oldObj) return null;
    const changes = {};
    let hasChanges = false;

    for (const [bodyKey, dbKey] of Object.entries(keyMap)) {
        if (newObj[bodyKey] !== undefined) {
            let valOld = oldObj[dbKey];
            let valNew = newObj[bodyKey];

            if (valOld instanceof Date) valOld = valOld.toISOString().split('T')[0];
            
            if (typeof valOld === 'number' || !isNaN(Number(valOld))) valOld = String(valOld);
            if (typeof valNew === 'number' || !isNaN(Number(valNew))) valNew = String(valNew);
            
            if (!valOld && !valNew) continue;

            if (valOld != valNew) {
                changes[bodyKey] = { old: valOld, new: valNew };
                hasChanges = true;
            }
        }
    }
    return hasChanges ? changes : null;
};

/**
 * Atualiza o saldo de uma conta de forma atômica.
 * @param {Object} client - Cliente do Pool de conexão (para manter a transação)
 * @param {string} accountId - ID da conta
 * @param {number} amount - Valor absoluto
 * @param {string} type - INCOME, EXPENSE ou TRANSFER
 * @param {boolean} isReversal - Se true, inverte a operação (estorno)
 */
export const updateAccountBalance = async (client, accountId, amount, type, isReversal = false) => {
    if (!accountId || isNaN(amount)) return;
    
    let multiplier = 1;
    // Se for despesa, subtrai. Se for receita, soma.
    if (type === 'EXPENSE') multiplier = -1;
    
    // Se for uma reversão (exclusão), inverte o sinal original
    if (isReversal) multiplier *= -1;
    
    const finalChange = Number(amount) * multiplier;
    
    await client.query(
        `UPDATE accounts SET balance = balance + $1 WHERE id = $2`,
        [finalChange, accountId]
    );
};

export const familyCheckParam2 = `user_id IN (SELECT id FROM users WHERE family_id = (SELECT family_id FROM users WHERE id = $2))`;

export const getUserWorkspaces = async (userId) => {
    const res = await pool.query(`
        SELECT m.family_id as id, u.name as name, m.role, u.entity_type as "entityType", m.permissions, u.settings as "ownerSettings"
        FROM memberships m JOIN users u ON m.family_id = u.id WHERE m.user_id = $1
    `, [userId]);
    
    return res.rows.map(w => {
        let perms = w.permissions;
        if (typeof perms === 'string') {
            try { perms = JSON.parse(perms); } catch (e) { perms = []; }
        }
        return { ...w, permissions: Array.isArray(perms) ? perms : [] };
    });
};

export const sanitizeValue = (val) => {
    if (val === undefined || val === null) return null;
    if (typeof val === 'string' && val.trim() === '') return null;
    return val;
};
