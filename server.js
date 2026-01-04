import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Configuración básica
const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Aumentamos límite para HTML grandes

// Servir archivos estáticos en producción
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
app.use(express.static(join(__dirname, 'dist')));

// --- ENDPOINT: CHECK STATUS ---
// Permite al Frontend saber si el Backend está listo para enviar
app.get('/api/health', (req, res) => {
  res.json({ status: 'online', timestamp: new Date().toISOString() });
});

// --- ENDPOINT: ENVIAR EMAIL ---
app.post('/api/send-email', async (req, res) => {
  const { config, to, subject, html } = req.body;

  if (!config || !to || !subject || !html) {
    return res.status(400).json({ success: false, message: 'Faltan datos requeridos (config, to, subject, html).' });
  }

  console.log(`[SERVER] 📨 Solicitud de envío a: ${to}`);

  try {
    // 1. Configurar el Transporter con los datos recibidos del Frontend
    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: Number(config.smtpPort),
      secure: Number(config.smtpPort) === 465, // true para 465, false para otros
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass,
      },
      tls: {
        rejectUnauthorized: false // Importante para evitar errores en servidores auto-firmados o locales
      }
    });

    // 2. Verificar conexión SMTP antes de enviar
    await transporter.verify();
    
    // 3. Enviar correo
    const info = await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: to,
      subject: subject,
      html: html,
    });

    console.log(`[SERVER] ✅ Enviado ID: ${info.messageId}`);
    res.json({ success: true, messageId: info.messageId });

  } catch (error) {
    console.error(`[SERVER] ❌ Error enviando a ${to}:`, error.message);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Error interno del servidor SMTP' 
    });
  }
});

// Fallback para SPA (Single Page Application) - Redirige todo al index.html
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🚀 MOTOR DE ENVÍO (BACKEND) ACTIVO`);
  console.log(`👉 Puerto: ${PORT}`);
  console.log(`👉 API Endpoint: http://localhost:${PORT}/api/send-email`);
  console.log(`👉 Status Check: http://localhost:${PORT}/api/health`);
  console.log(`==================================================\n`);
});