
import nodemailer from 'nodemailer';

// Verifica se as variáveis de ambiente essenciais estão presentes
const isConfigured = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

let transporter;

if (isConfigured) {
  console.log(`[EMAIL] Configurando transporte SMTP via ${process.env.SMTP_HOST}`);
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === 'true', 
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  
  // Verifica conexão no startup
  transporter.verify((error, success) => {
    if (error) {
      console.error("[EMAIL] Erro na verificação do SMTP:", error.message);
    } else {
      console.log("[EMAIL] Servidor SMTP pronto para envio.");
    }
  });
} else {
  console.warn("[EMAIL] !!! SMTP NÃO CONFIGURADO COMPLETAMENTE !!! Usando Mock (Veja logs do console).");
  transporter = nodemailer.createTransport({
    jsonTransport: true
  });
}

/**
 * Envia um e-mail formatado
 * @param {string} to - Destinatário
 * @param {string} subject - Assunto
 * @param {string} text - Versão em texto simples
 * @param {string} html - Versão em HTML
 */
export const sendEmail = async (to, subject, text, html) => {
  if (!to) throw new Error("Destinatário não informado.");

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"FinManager" <no-reply@finmanager.com>',
      to,
      subject,
      text,
      html,
    });

    if (isConfigured) {
      console.log(`[EMAIL] Sucesso ao enviar para ${to}. ID: ${info.messageId}`);
    } else {
      console.log("--- MOCK EMAIL ---");
      console.log(`Para: ${to}`);
      console.log(`Assunto: ${subject}`);
      console.log("------------------");
    }
    
    return info;
  } catch (error) {
    console.error(`[EMAIL ERROR] Falha ao enviar para ${to}:`, error.message);
    // Erros específicos de provedores comuns
    if (error.message.includes('Invalid login')) {
        throw new Error("Erro de autenticação no servidor de e-mail. Verifique o usuário e senha (ou Senha de App se for Gmail).");
    }
    throw error;
  }
};
