
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
                serviceItems: services.rows.map(r => ({ id: r.id, name: r.name, code: r.code, defaultPrice: parseFloat(r.default_price), moduleTag: r.module_tag, type: r.type, costPrice: parseFloat(r.cost_price), unit: r.unit, description: r.description, imageUrl: r.image_url })),
                serviceAppointments: appts.rows.map(r => ({ id: r.id, clientId: r.client_id, clientName: r.client_name, serviceId: r.service_id, serviceName: r.service_name, date: r.date, status: r.status, notes: r.notes, transactionId: r.transaction_id, moduleTag: r.module_tag })),
                
                // Services Module Data Mappers
                serviceOrders: so.rows.map(r => ({ id: r.id, number: r.number, title: r.title, description: r.description, contactId: r.contact_id, contactName: r.contact_name, status: r.status, totalAmount: parseFloat(r.total_amount), startDate: r.start_date ? new Date(r.start_date).toISOString().split('T')[0] : undefined, endDate: r.end_date ? new Date(r.end_date).toISOString().split('T')[0] : undefined })),
                commercialOrders: co.rows.map(r => ({ id: r.id, type: r.type, description: r.description, contactId: r.contact_id, contactName: r.contact_name, amount: parseFloat(r.amount), date: new Date(r.date).toISOString().split('T')[0], status: r.status, transactionId: r.transaction_id })),
                contracts: ct.rows.map(r => ({ id: r.id, title: r.title, contactId: r.contact_id, contactName: r.contact_name, value: parseFloat(r.value), startDate: new Date(r.start_date).toISOString().split('T')[0], endDate: r.end_date ? new Date(r.end_date).toISOString().split('T')[0] : undefined, status: r.status, billingDay: r.billing_day })),
                invoices: inv.rows.map(r => ({ id: r.id, number: r.number, series: r.series, type: r.type, amount: parseFloat(r.amount), issueDate: new Date(r.issue_date).toISOString().split('T')[0], status: r.status, contactId: r.contact_id, contactName: r.contact_name, fileUrl: r.file_url }))
            });
