
import express from 'express';
import pool from '../db.js';
import { authenticateToken } from '../middleware.js';

const router = express.Router();

// Flag para controle de ativação do gateway
const ENABLE_PAYMENT_GATEWAY = false;

// Configurações Pagar.me (Dormante)
const PAGARME_API_KEY = process.env.PAGARME_API_KEY || 'sk_test_pagarme_placeholder';

export default function(logAudit) {

    // Rota de criação de pedido/assinatura Pagar.me
    router.post('/create-pagarme-session', authenticateToken, async (req, res) => {
        const { planId } = req.body;
        const userId = req.user.id;

        try {
            // Se o pagamento estiver desativado, simulamos sucesso imediato para plano TRIAL
            if (!ENABLE_PAYMENT_GATEWAY) {
                await pool.query(
                    `UPDATE users SET status = 'ACTIVE', plan = $1, trial_ends_at = NOW() + interval '15 days' WHERE id = $2`,
                    [planId || 'PF_FREE', userId]
                );
                return res.json({ 
                    success: true, 
                    message: "Plano grátis ativado com sucesso.",
                    redirectUrl: '/FIN_DASHBOARD' 
                });
            }

            // Lógica Pagar.me (Para ativação futura)
            // Aqui entraria a chamada fetch("https://api.pagar.me/core/v5/orders", ...)
            
            res.json({ error: "Gateway em manutenção. Use o modo gratuito." });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // Webhook Pagar.me
    router.post('/pagarme-webhook', async (req, res) => {
        const event = req.body;
        // Lógica de processamento de postback do Pagar.me
        console.log("Postback Pagar.me recebido:", event.type);
        res.json({ received: true });
    });

    return router;
}
