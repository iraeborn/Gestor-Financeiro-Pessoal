/**
 * Registra uma ação no banco de auditoria e notifica os clientes via Socket.io.
 * O isolamento é garantido pelo familyId (sala do socket).
 */
export const createAuditLog = async (pool, io, { userId, action, entity, entityId, details, previousState = null, changes = null, familyIdOverride = null }) => {
    let targetFamilyId = familyIdOverride;

    // 1. Tentar recuperar o family_id se não houver override explícito
    // Importante: pool pode ser a conexão da transação (client) ou o pool global
    if (!targetFamilyId && userId && userId !== 'EXTERNAL_CLIENT' && pool) {
        try {
            const res = await pool.query('SELECT family_id FROM users WHERE id = $1', [userId]);
            targetFamilyId = res.rows[0]?.family_id || userId;
        } catch (e) {
            console.error("[AUDIT ERROR] Falha ao recuperar family_id para broadcast:", e.message);
        }
    }

    const roomName = String(targetFamilyId || userId || 'global').trim();

    // 2. Gravação opcional no Banco (Se pool estiver disponível)
    if (pool) {
        try {
            await pool.query(
                `INSERT INTO audit_logs (user_id, action, entity, entity_id, details, previous_state, changes, family_id) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [userId, action, entity, entityId, details, previousState, changes, roomName]
            );
        } catch (dbErr) {
            console.error("[AUDIT ERROR] Falha ao persistir log físico:", dbErr.message);
        }
    }

    // 3. Notificação em Tempo Real (Broadcast)
    try {
        if (io) {
            console.log(`📡 [BROADCAST] Sinal 'DATA_UPDATED' disparado para a sala: [${roomName}] | Entidade: ${entity} | Autor: ${userId}`);
            
            // Enviamos para a sala da família. Todos os usuários nela receberão o alerta de refresh.
            io.to(roomName).emit('DATA_UPDATED', { 
                action, 
                entity, 
                entityId,
                actorId: userId, // ID de quem causou a mudança
                timestamp: new Date(),
                changes: changes
            });
        }
    } catch (e) { 
        console.error("[AUDIT ERROR] Falha no disparo do WebSocket:", e.message); 
    }
};