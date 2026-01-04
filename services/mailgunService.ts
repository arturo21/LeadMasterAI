
import { MailgunConfig } from "../types";

export class MailgunService {
  
  static async sendEmail(
    config: MailgunConfig, 
    to: string, 
    subject: string, 
    html: string
  ): Promise<{ success: boolean; message: string }> {
    
    if (!config.isConfigured) {
      return { success: false, message: "SMTP no configurado." };
    }

    // SIMULACIÓN DEL MOTOR NODE.JS (SMTP)
    console.log(`%c[NODE_ENGINE] Procesando Job ID: ${Math.random().toString(36).substr(2, 9)}...`, "color: #22d3ee; font-weight: bold;");

    try {
      console.log(`[BULLMQ] Job picked up by worker from 'email-queue'`);
      console.log(`[NODEMAILER] createTransport({ host: "${config.smtpHost}"... })`);
      await new Promise(resolve => setTimeout(resolve, 150)); // Faster simulation

      if(!config.smtpUser || !config.smtpPass) {
          throw new Error("SMTP Auth Error: Missing User/Pass");
      }
      
      console.log(`[NODEMAILER] transporter.sendMail({ to: "${to}" })`);
      await new Promise(resolve => setTimeout(resolve, 300));
      
      if (to.includes('fail')) {
          console.error(`[SMTP] 550 User unknown (Hard Bounce detected)`);
          return { success: false, message: "550 5.1.1 User unknown" };
      }

      console.log(`[PRISMA] await prisma.campaignLog.create({...})`);
      
      return { success: true, message: "Enviado exitosamente (Simulación Node.js)" };

    } catch (error: any) {
      console.error("[NODE_ERROR]", error);
      return { success: false, message: error.message || "Error en Worker Node.js" };
    }
  }

  // Schema SQL para descarga (Compatible con MySQL/MariaDB)
  static getMySQLSchema(): string {
      return `CREATE DATABASE IF NOT EXISTS lead_master_db;
USE lead_master_db;

-- Tabla de Leads (Contactos)
CREATE TABLE IF NOT EXISTS leads (
    email VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'PENDING',
    attempts INT DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabla de Auditoría (Logs de Envío)
CREATE TABLE IF NOT EXISTS campaign_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255),
    action VARCHAR(50),
    details TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (email) REFERENCES leads(email)
);
`;
  }

  // Genera el código Node.js de Nivel de Producción
  static getNodeScript(config: MailgunConfig): string {
    return `/**
 * LEAD MASTER AI - NODE.JS WORKER ENGINE
 * -----------------------------------------
 * Stack: Node.js, Nodemailer, MySQL2, Dotenv
 * Recomendado: Usar con PM2 y Redis (BullMQ) para producción masiva.
 */

const nodemailer = require('nodemailer');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// --- CONFIGURACIÓN (Node.js Environment) ---
const SMTP_CONFIG = {
    host: process.env.SMTP_HOST || "${config.smtpHost || 'smtp.gmail.com'}",
    port: parseInt(process.env.SMTP_PORT || "${config.smtpPort || 587}"),
    secure: false, // true for 465
    auth: {
        user: process.env.SMTP_USER || "${config.smtpUser || 'user@email.com'}",
        pass: process.env.SMTP_PASS || "${config.smtpPass || 'password'}",
    },
};

const DB_CONFIG = {
    host: process.env.DB_HOST || "${config.dbHost || 'localhost'}",
    user: process.env.DB_USER || "${config.dbUser || 'root'}",
    password: process.env.DB_PASS || "${config.dbPass || ''}",
    database: process.env.DB_NAME || "${config.dbName || 'lead_master_db'}",
};

const SENDER_EMAIL = process.env.SENDER_EMAIL || "${config.fromEmail || config.smtpUser}";
const DRY_RUN = false; 

// --- LOGGER SETUP (Winston-like simulation) ---
const logFile = path.join(__dirname, 'worker_execution.log');

function log(level, message) {
    const timestamp = new Date().toISOString();
    const logMsg = \`[\${timestamp}] [\${level}] \${message}\`;
    console.log(logMsg);
    fs.appendFileSync(logFile, logMsg + '\\n');
}

class MailWorker {
    constructor() {
        this.connection = null;
        this.transporter = null;
    }

    async init() {
        try {
            // Database Connection
            this.connection = await mysql.createConnection(DB_CONFIG);
            log('INFO', 'MySQL Database Connected via Pool.');

            // SMTP Transporter
            this.transporter = nodemailer.createTransport(SMTP_CONFIG);
            if (!DRY_RUN) {
                await this.transporter.verify();
                log('INFO', 'Nodemailer Transport Verified.');
            }
        } catch (error) {
            log('CRITICAL', \`Worker Initialization Failed: \${error.message}\`);
            process.exit(1);
        }
    }

    async close() {
        if (this.connection) await this.connection.end();
        log('INFO', 'Worker process finished gracefully.');
    }

    async logResult(email, status, errorMsg = null) {
        try {
            // Update Lead Status
            await this.connection.execute(
                'UPDATE leads SET status = ?, attempts = attempts + 1, last_error = ?, updated_at = NOW() WHERE email = ?',
                [status, errorMsg, email]
            );

            // Audit Log
            await this.connection.execute(
                'INSERT INTO campaign_logs (email, action, details) VALUES (?, ?, ?)',
                [email, status, errorMsg]
            );

            log(status === 'SUCCESS' ? 'INFO' : 'ERROR', \`Processed \${email}: \${status}\`);
        } catch (dbError) {
            log('ERROR', \`DB Error for \${email}: \${dbError.message}\`);
        }
    }

    async processQueue(recipients, subject, htmlTemplate) {
        await this.init();

        log('INFO', 'Synchronizing leads to database...');
        for (const r of recipients) {
            try {
                await this.connection.execute(
                    'INSERT IGNORE INTO leads (email, name, status) VALUES (?, ?, "PENDING")',
                    [r.email, r.name]
                );
            } catch (e) {}
        }

        // Fetch PENDING tasks
        const [rows] = await this.connection.execute(
            "SELECT email, name FROM leads WHERE status NOT IN ('SUCCESS', 'HARD_BOUNCE')"
        );
        
        log('INFO', \`Starting processing for \${rows.length} jobs.\`);

        for (const row of rows) {
            const { email, name } = row;

            // --- SMART THROTTLING (Node.js Event Loop Friendly) ---
            if (!DRY_RUN) {
                const delay = Math.floor(Math.random() * (25000 - 10000 + 1) + 10000); // 10-25s
                log('INFO', \`Throttling: yielding for \${(delay/1000).toFixed(1)}s...\`);
                await new Promise(r => setTimeout(r, delay));
            }

            const personalizedHtml = htmlTemplate
                .replace(/{{username}}/g, name)
                .replace(/{{fullname}}/g, name);

            if (DRY_RUN) {
                log('INFO', \`[DRY RUN] Would send to \${email}\`);
                await this.logResult(email, 'SUCCESS', 'Simulated');
                continue;
            }

            try {
                await this.transporter.sendMail({
                    from: SENDER_EMAIL,
                    to: email,
                    subject: subject,
                    html: personalizedHtml
                });
                await this.logResult(email, 'SUCCESS');
            } catch (error) {
                const errorMsg = error.message;
                await this.logResult(email, 'FAILED', errorMsg);
            }
        }

        await this.close();
    }
}

// --- WORKER ENTRY POINT ---
(async () => {
    // In production, this data comes from Redis/BullMQ
    const leads = [
       { email: 'test@example.com', name: 'Test User' }
    ];
    
    const htmlTemplate = \`<h1>Hello {{username}}</h1>\`;
    const subject = "Node.js Powered Campaign";

    const worker = new MailWorker();
    await worker.processQueue(leads, subject, htmlTemplate);
})();
`;
  }

  static generateDefaultTemplate(): string {
    return `<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px; }
  .container { max-width: 600px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 8px; }
  .header { border-bottom: 2px solid #22d3ee; padding-bottom: 20px; margin-bottom: 20px; }
  .footer { font-size: 12px; color: #888; margin-top: 30px; text-align: center; }
  .btn { display: inline-block; background-color: #0f172a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; }
</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Hola {{username}}!</h1>
    </div>
    <p>Me gustaría presentarte nuestra propuesta de valor...</p>
    <p>
      <a href="#" class="btn" style="color: #ffffff;">Ver más</a>
    </p>
    <div class="footer">
      <p>Powered by Lead Master AI (Node.js Engine)</p>
    </div>
  </div>
</body>
</html>`;
  }
}
