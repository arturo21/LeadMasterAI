import mysql from 'mysql2/promise';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Cargar variables de entorno
dotenv.config();

console.log(`
==================================================
🚀 LEAD MASTER AI - BACKGROUND WORKER
==================================================
Modo: Producción
PID: ${process.pid}
Base de Datos: ${process.env.DB_NAME || 'lead_master_db'}
Host SMTP: ${process.env.SMTP_HOST || 'No definido (Revisar .env)'}
==================================================
`);

// Configuración de Base de Datos
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'lead_master_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Crear Pool de Conexiones
const pool = mysql.createPool(dbConfig);

// Configuración SMTP (Desde .env)
const getTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465, // true para 465, false para otros
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false
    }
  });
};

// Función Principal del Worker
async function processQueue() {
  let connection;
  try {
    // 1. Obtener conexión del pool
    connection = await pool.getConnection();

    // 2. Buscar correos pendientes (Bloqueo pesimista opcional, aquí simple por simplicidad)
    // Buscamos leads con estado 'PENDING' o 'RETRY' (si attempts < 3)
    const [rows] = await connection.execute(
      `SELECT * FROM leads 
       WHERE status = 'PENDING' 
       OR (status = 'ERROR' AND attempts < 3) 
       ORDER BY updated_at ASC 
       LIMIT 5`
    );

    if (rows.length === 0) {
      // No hay trabajo, liberar conexión y esperar
      connection.release();
      return; 
    }

    console.log(`[WORKER] Procesando lote de ${rows.length} correos...`);
    
    const transporter = getTransporter();
    
    // Verificar conexión SMTP una vez por lote
    try {
      await transporter.verify();
    } catch (smtpError) {
      console.error("[SMTP ERROR] No se puede conectar al servidor de correo:", smtpError.message);
      connection.release();
      return;
    }

    // 3. Procesar cada correo
    for (const lead of rows) {
      try {
        console.log(`📨 Enviando a: ${lead.email}`);

        // Aumentar contador de intentos inmediatamente
        await connection.execute(
          'UPDATE leads SET attempts = attempts + 1, updated_at = NOW() WHERE email = ?',
          [lead.email]
        );

        // Enviar Correo Real
        // NOTA: En un caso real, el 'html_content' y 'subject' deberían venir de una tabla 'campaigns'
        // unida por ID. Aquí asumimos una estructura simple o un valor por defecto para el ejemplo.
        // Si tienes una tabla de campañas, haz un JOIN en la query de selección.
        
        // Simulación de contenido si no está en la tabla leads (ajustar según tu schema real)
        const mailOptions = {
          from: `"${process.env.SENDER_NAME || 'Lead Master'}" <${process.env.SENDER_EMAIL}>`,
          to: lead.email,
          subject: lead.subject || "Propuesta de Colaboración", // Fallback subject
          html: lead.html_content || `<p>Hola ${lead.name || ''},</p><p>Te contactamos para...</p>` // Fallback HTML
        };

        const info = await transporter.sendMail(mailOptions);

        // Marcar como ENVIADO
        await connection.execute(
          'UPDATE leads SET status = "SENT", last_error = NULL, updated_at = NOW() WHERE email = ?',
          [lead.email]
        );
        
        // Registrar Log
        await connection.execute(
          'INSERT INTO campaign_logs (email, action, details) VALUES (?, ?, ?)',
          [lead.email, 'SENT', `MessageID: ${info.messageId}`]
        );

        console.log(`✅ Enviado exitoso: ${lead.email}`);

      } catch (error) {
        console.error(`❌ Error enviando a ${lead.email}:`, error.message);

        // Marcar como ERROR
        await connection.execute(
          'UPDATE leads SET status = "ERROR", last_error = ?, updated_at = NOW() WHERE email = ?',
          [error.message, lead.email]
        );
      }
      
      // Pequeña pausa para no saturar SMTP (Rate limiting básico)
      await new Promise(r => setTimeout(r, 1000));
    }

    connection.release();

  } catch (err) {
    console.error("[WORKER CRASH]", err);
    if (connection) connection.release();
  }
}

// Bucle de Ejecución (Polling cada 10 segundos)
const POLLING_INTERVAL = 10000;

console.log(`[WORKER] Iniciando ciclo de polling (${POLLING_INTERVAL}ms)...`);
setInterval(processQueue, POLLING_INTERVAL);

// Ejecución inmediata inicial
processQueue();

// Manejo de cierre elegante
process.on('SIGINT', async () => {
  console.log('[WORKER] Cerrando conexiones...');
  await pool.end();
  process.exit(0);
});
