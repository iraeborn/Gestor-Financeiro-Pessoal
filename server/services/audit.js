
/**
 * Registra uma ação no banco de auditoria e notifica os clientes via Socket.io de forma isolada.
 */
export const createAuditLog = async (pool, io, { userId, action, entity, entityId, details, previousState = null, changes = null, familyIdOverride = null }) => {
    let targetFamilyId = familyIdOverride;

    // 1. Tentar recuperar o family_id se não houver override
    if (!targetFamilyId && userId && userId !== 'EXTERNAL_CLIENT' && pool) {
        try {
            const res = await pool.query('SELECT family_id FROM users WHERE id = $1', [userId]);
            targetFamilyId = res.rows[0]?.family_id || userId;
        } catch (e) {
            console.error("[AUDIT] Falha ao buscar family_id para broadcast:", e.message);
        }
    }

    // Se ainda não temos familyId, usamos o userId como fallback de sala individual
    const roomName = String(targetFamilyId || userId || 'global').trim();

    // 2. Gravação no Banco (Opcional se pool for fornecido)
    if (pool) {
        try {
            await pool.query(
                `INSERT INTO audit_logs (user_id, action, entity, entity_id, details, previous_state, changes, family_id) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [userId, action, entity, entityId, details, previousState, changes, targetFamilyId || userId]
            );
        } catch (dbErr) {
            console.error("[AUDIT SERVICE] Erro ao gravar banco:", dbErr.message);
        }
    }

    // 3. Notificação Real-time - CRÍTICO: Não depende do sucesso do banco acima
    try {
        if (io) {
            console.log(`📡 [BROADCAST] Enviando DATA_UPDATED para sala: ${roomName}`);
            io.to(roomName).emit('DATA_UPDATED', { 
                action, 
                entity, 
                entityId,
                actorId: userId, 
                timestamp: new Date(),
                changes: changes
            });
        }
    } catch (e) { 
        console.error("[AUDIT SERVICE] Erro no broadcast Socket.io:", e.message); 
    }
};
