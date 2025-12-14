
// ... (código anterior permanece igual)

app.post('/api/invite/join', authenticateToken, async (req, res) => {
    const { code } = req.body;
    const userId = req.user.id;
    try {
        const inviteRes = await pool.query('SELECT * FROM invites WHERE code = $1 AND expires_at > NOW()', [code]);
        const invite = inviteRes.rows[0];
        
        if (!invite) return res.status(404).json({ error: 'Convite inválido ou expirado' });

        // Default Permissions for new Members
        // Gives access to basic financial features, but restricts Management/Admin settings
        const defaultPermissions = JSON.stringify([
            'FIN_DASHBOARD', 
            'FIN_TRANSACTIONS', 
            'FIN_CALENDAR', 
            'FIN_ACCOUNTS',
            'FIN_CARDS',
            'FIN_GOALS',
            'FIN_REPORTS', 
            'FIN_CATEGORIES', 
            'FIN_CONTACTS'
        ]);

        // Add to memberships with default permissions
        await pool.query(`
            INSERT INTO memberships (user_id, family_id, role, permissions) 
            VALUES ($1, $2, 'MEMBER', $3) 
            ON CONFLICT (user_id, family_id) DO NOTHING
        `, [userId, invite.family_id, defaultPermissions]);

        // Switch user to this family immediately? Yes, standard flow.
        await pool.query('UPDATE users SET family_id = $1 WHERE id = $2', [invite.family_id, userId]);
        
        // Optional: Delete invite if one-time use, but keeping it allows multiple people to use the same link until expiry
        // await pool.query('DELETE FROM invites WHERE id = $1', [invite.id]); 

        // Return updated user
        const userRow = (await pool.query('SELECT * FROM users WHERE id = $1', [userId])).rows[0];
        const workspaces = await getUserWorkspaces(userId);
        const ownerRes = await pool.query('SELECT entity_type FROM users WHERE id = $1', [userRow.family_id]);
        
        const user = { 
            id: userRow.id, name: userRow.name, email: userRow.email, familyId: userRow.family_id,
            settings: userRow.settings, role: userRow.role, entityType: ownerRes.rows[0]?.entity_type || 'PF',
            plan: userRow.plan, status: userRow.status, trialEndsAt: userRow.trial_ends_at,
            workspaces
        };
        const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });

        res.json({ success: true, token, user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ... (resto do código permanece igual)
