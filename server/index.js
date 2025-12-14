
// ... (código existente até a rota app.post('/api/settings', ...) )

app.post('/api/settings', authenticateToken, async (req, res) => {
    const { settings } = req.body;
    const userId = req.user.id;
    try {
        await pool.query('UPDATE users SET settings = $1 WHERE id = $2', [settings, userId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// NEW: Invite Creation (Standardized)
app.post('/api/invites', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    // Get the user's current family context to invite people TO
    const activeFamilyIdRes = await pool.query('SELECT family_id FROM users WHERE id = $1', [userId]);
    const activeFamilyId = activeFamilyIdRes.rows[0]?.family_id || userId;
    
    if (!activeFamilyId) return res.status(400).json({error: "Usuário não tem contexto ativo"});

    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await pool.query(
        `INSERT INTO invites (code, family_id, created_by, expires_at) VALUES ($1, $2, $3, $4)`,
        [code, activeFamilyId, userId, expiresAt]
    );
    res.json({ code, expiresAt });
});

// NEW: Company Profile
app.post('/api/company', authenticateToken, async (req, res) => {
    const { id, tradeName, legalName, cnpj } = req.body;
    const userId = req.user.id;
    try {
        // Company profile is linked to the family owner (family_id) usually
        const familyIdRes = await pool.query('SELECT family_id FROM users WHERE id = $1', [userId]);
        const familyId = familyIdRes.rows[0]?.family_id || userId;

        const existingRes = await pool.query('SELECT * FROM company_profiles WHERE user_id = $1', [familyId]);
        const existing = existingRes.rows[0];
        const action = existing ? 'UPDATE' : 'CREATE';
        
        const changes = calculateChanges(existing, req.body, { tradeName: 'trade_name', legalName: 'legal_name', cnpj: 'cnpj' });

        await pool.query(
            `INSERT INTO company_profiles (id, trade_name, legal_name, cnpj, user_id) 
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (user_id) DO UPDATE SET trade_name = $2, legal_name = $3, cnpj = $4`,
            [id, tradeName, legalName, cnpj, familyId]
        );
        
        await logAudit(pool, userId, action, 'company', id, `Empresa: ${tradeName}`, existing, changes);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ... (Resto do código mantido: rotas family, modules, etc)
// ... (Certifique-se de remover a antiga rota GET /api/admin/invite/create se existir duplicada, mas POST /api/invites terá precedência ou conviverá)

app.get('/api/family/members', authenticateToken, async (req, res) => {
// ... (código existente)
