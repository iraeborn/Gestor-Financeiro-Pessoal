
/**
 * Registra uma ação no banco de auditoria e notifica os clientes via Socket.io de forma isolada.
 */
export const createAuditLog = async (pool, io, { userId, action, entity, entityId, details, previousState = null, changes = null, familyIdOverride = null }) => {
    let targetFamilyId = familyIdOverride;

    // Se não houver override, buscamos o family_id atual do usuário
    if (!targetFamilyId && userId && userId !== 'EXTERNAL_CLIENT') {
        try {
            const res = await pool.query('SELECT family_id FROM users WHERE id = $1', [userId]);
            targetFamilyId = res.rows[0]?.family_id || userId;
        } catch (e) {
            console.error("[AUDIT] Falha ao buscar family_id do usuário:", e.message);
        }
    }

    // 1. Gravação no Banco com isolamento de tenant
    try {
        await pool.query(
            `INSERT INTO audit_logs (user_id, action, entity, entity_id, details, previous_state, changes, family_id) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [userId, action, entity, entityId, details, previousState, changes, targetFamilyId]
        );
    } catch (dbErr) {
        console.error("[AUDIT SERVICE] Erro ao gravar banco:", dbErr.message);
    }

    // 2. Notificação Real-time APENAS para a sala da família correta
    try {
        if (targetFamilyId && io) {
            io.to(String(targetFamilyId).trim()).emit('DATA_UPDATED', { 
                action, 
                entity, 
                entityId,
                actorId: userId, 
                timestamp: new Date(),
                changes: changes
            });
        }
    } catch (e) { 
        console.error("[AUDIT SERVICE] Erro no broadcast isolado:", e.message); 
    }
};
