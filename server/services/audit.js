
/**
 * Registra uma ação no banco de auditoria e notifica os clientes via Socket.io.
 */
export const createAuditLog = async (pool, io, { userId, action, entity, entityId, details, previousState = null, changes = null, familyIdOverride = null }) => {
    // 1. Gravação no Banco
    try {
        await pool.query(
            `INSERT INTO audit_logs (user_id, action, entity, entity_id, details, previous_state, changes) 
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [userId, action, entity, entityId, details, previousState, changes]
        );
    } catch (dbErr) {
        console.error("[AUDIT SERVICE] Erro ao gravar banco:", dbErr.message);
    }

    // 2. Notificação Real-time
    try {
        let targetRoom = null;
        if (familyIdOverride) {
            targetRoom = String(familyIdOverride).trim();
        } else if (userId && userId !== 'EXTERNAL_CLIENT') {
            const res = await pool.query('SELECT family_id FROM users WHERE id = $1', [userId]);
            targetRoom = res.rows[0]?.family_id ? String(res.rows[0].family_id).trim() : String(userId).trim();
        }

        if (targetRoom && io) {
            io.to(targetRoom).emit('DATA_UPDATED', { 
                action, 
                entity, 
                entityId,
                actorId: userId, 
                timestamp: new Date(),
                changes: changes // Passamos os campos alterados para o frontend decidir se faz refresh parcial
            });
        }
    } catch (e) { 
        console.error("[AUDIT SERVICE] Erto no broadcast:", e.message); 
    }
};
