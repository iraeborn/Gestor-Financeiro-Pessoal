
import nodemailer from 'nodemailer';

// Verifica se as variáveis de ambiente essenciais estão presentes
const isConfigured = process.env.SMTP_HOST && process.env.SMTP_USER;

let transporter;

if (isConfigured) {
  // Configuração Real (Produção/Ambiente Configurado)
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === 'true', // true para 465, false para outras
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
} else {
  // Configuração Mock (Desenvolvimento sem credenciais)
  // Isso previne o erro 535 ao testar sem um servidor SMTP real configurado
  console.log("SMTP não configurado totalmente. Usando Mock Transport (Emails serão logados no console).");
  transporter = nodemailer.createTransport({
    jsonTransport: true
  });
}

export const sendEmail = async (to, subject, text, html) => {
  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"FinManager Notification" <no-reply@finmanager.com>',
      to,
      subject,
      text,
      html,
    });

    if (isConfigured) {
      console.log("Message sent: %s", info.messageId);
    } else {
      console.log("--- MOCK EMAIL SENT (Check .env to configure real SMTP) ---");
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      // Em jsonTransport, info.message é uma string JSON com os detalhes do email
      try {
          const messageData = JSON.parse(info.message);
          console.log("Content:", messageData.html || messageData.text);
      } catch (e) {
          console.log("Message info:", info);
      }
      console.log("-----------------------------------------------------------");
    }
    
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};
