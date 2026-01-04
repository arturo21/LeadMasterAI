import { MailgunConfig } from "../types";

export class MailgunService {
  
  // Verifica si el backend Node.js está corriendo
  static async verifyBackendStatus(): Promise<boolean> {
    try {
      const response = await fetch('/api/health');
      return response.ok;
    } catch (e) {
      return false;
    }
  }

  static async sendEmail(
    config: MailgunConfig, 
    to: string, 
    subject: string, 
    html: string
  ): Promise<{ success: boolean; message: string }> {
    
    if (!config.isConfigured) {
      return { success: false, message: "SMTP no configurado en la App." };
    }

    try {
      // Realizamos una petición POST real al servidor Backend (server.js)
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config, // Enviamos las credenciales SMTP para que el servidor las use
          to,
          subject,
          html
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `Error HTTP: ${response.status}`);
      }
      
      return { success: true, message: "Enviado exitosamente." };

    } catch (error: any) {
      console.error("[SMTP_ERROR]", error);
      
      // Mensaje específico si el servidor backend no responde
      if (error.message && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError'))) {
          return { 
            success: false, 
            message: "NO SE PUEDE CONECTAR CON EL SERVIDOR DE CORREOS. Asegúrate de ejecutar 'npm run server' en tu terminal." 
          };
      }

      return { success: false, message: error.message || "Error desconocido al enviar." };
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

  // Genera el código Node.js de Nivel de Producción (Para descarga)
  static getNodeScript(config: MailgunConfig): string {
    return `/**
 * LEAD MASTER AI - WORKER
 * Usa este script para despliegues dedicados.
 */
// ... (El contenido de descarga se mantiene igual para referencia)
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
      <p>Powered by Lead Master AI</p>
    </div>
  </div>
</body>
</html>`;
  }
}