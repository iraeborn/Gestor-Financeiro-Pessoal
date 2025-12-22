
const WHATSAPP_API_URL = "https://graph.facebook.com/v22.0/934237103105071/messages";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || "EAFpabmZBi0U0BQKRhGRsH8eVtgUPLNUoDi2mg2r8bDAj9vfBcolZC9CONlSdqFVug7FXrCKZCGsgxPiIUZBc2kIdnZBbnZAVZAJFOFRk4f3ZA3bsOwEyO87bzZBGwUY0Aj0aQTHq1mcYxHaebickk8ubQsz6G4Y0hnlIxcmj0WQFKasRy8KFLobi0torRxc2NzYE5Q17KToe24ngyadf2PdbRmfKahoO26mALs6yAMUTyiZBm9ufcIod9fipU8ZCzP0mBIqgmzClQtbonxa43kQ11CGTh7f1ZAxuDPwLlZCZCTZA8c3";

/**
 * Envia uma mensagem via WhatsApp usando templates da Meta.
 */
export const sendWhatsappTemplate = async (to, templateName = 'jaspers_market_plain_text_v1') => {
    if (!to) throw new Error("Telefone de destino não informado.");
    const cleanPhone = to.replace(/\D/g, '');
    
    try {
        const response = await fetch(WHATSAPP_API_URL, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${WHATSAPP_TOKEN}`, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ 
                messaging_product: "whatsapp", 
                to: cleanPhone, 
                type: "template", 
                template: { 
                    name: templateName, 
                    language: { code: "en_US" } 
                } 
            })
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || "Erro na API do WhatsApp");
        return data;
    } catch (e) {
        console.error("[SERVICE:WHATSAPP] Exception:", e.message);
        throw e;
    }
};
