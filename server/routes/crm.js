
    // Updated to support Catalog (Products/Services with extended info)
    router.post('/modules/services', authenticateToken, async (req, res) => {
        const { id, name, code, defaultPrice, moduleTag, type, costPrice, unit, description, imageUrl } = req.body;
        try {
            const familyId = await getFamilyId(req.user.id);
            await pool.query(`ALTER TABLE module_services ADD COLUMN IF NOT EXISTS family_id TEXT`);
            // Ensure new columns exist
            await pool.query(`ALTER TABLE module_services ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'SERVICE'`);
            await pool.query(`ALTER TABLE module_services ADD COLUMN IF NOT EXISTS cost_price DECIMAL(15,2)`);
            await pool.query(`ALTER TABLE module_services ADD COLUMN IF NOT EXISTS unit TEXT`);
            await pool.query(`ALTER TABLE module_services ADD COLUMN IF NOT EXISTS description TEXT`);
            await pool.query(`ALTER TABLE module_services ADD COLUMN IF NOT EXISTS image_url TEXT`);

            await pool.query(
                `INSERT INTO module_services (id, name, code, default_price, module_tag, user_id, family_id, type, cost_price, unit, description, image_url) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
                 ON CONFLICT (id) DO UPDATE SET name=$2, code=$3, default_price=$4, module_tag=$5, type=$8, cost_price=$9, unit=$10, description=$11, image_url=$12, deleted_at=NULL`, 
                [id, name, sanitizeValue(code), defaultPrice||0, moduleTag||'GENERAL', req.user.id, familyId, type||'SERVICE', costPrice||0, sanitizeValue(unit), sanitizeValue(description), sanitizeValue(imageUrl)]
            );
            res.json({ success: true });
        } catch(err) { res.status(500).json({ error: err.message }); }
    });
