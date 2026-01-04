================================================================================
INSTA-PROSPECT HYBRID ENGINE v3.0 - NODE.JS ARCHITECTURE
================================================================================

Este proyecto ha sido migrado a una arquitectura Full-Stack JavaScript unificada.
1. FRONTEND: Interfaz Web (React + TypeScript).
2. BACKEND: Motor de Procesamiento (Node.js).

--------------------------------------------------------------------------------
PARTE 1: DESPLIEGUE DEL FRONTEND EN VERCEL (Recomendado)
--------------------------------------------------------------------------------

Esta aplicación está lista para ser desplegada como una SPA (Single Page Application)
en Vercel.

Pasos para producción:

1. Subir código a GitHub/GitLab:
   - Inicializa el repositorio: `git init`
   - Agrega los archivos: `git add .`
   - Haz commit: `git commit -m "Initial commit"`
   - Sube a tu repositorio remoto.

2. Conectar con Vercel:
   - Ve a https://vercel.com/new
   - Importa tu repositorio de GitHub.
   - Vercel detectará automáticamente que es un proyecto "Vite".

3. Configurar Variables de Entorno (IMPORTANTE):
   - En la pantalla de configuración de Vercel, busca la sección "Environment Variables".
   - Agrega la siguiente variable:
     NAME: API_KEY
     VALUE: tu_clave_de_google_gemini_aqui

4. Desplegar:
   - Haz clic en "Deploy".
   - Vercel instalará las dependencias y construirá el proyecto usando `npm run build`.

Nota: El archivo `vercel.json` incluido se encarga de manejar el enrutamiento
para que las recargas de página funcionen correctamente.

--------------------------------------------------------------------------------
PARTE 2: DESPLIEGUE DEL BACKEND (Node.js Worker)
--------------------------------------------------------------------------------

El backend ahora utiliza Node.js nativo en lugar de Python, ofreciendo mayor
rendimiento y compatibilidad con el ecosistema JS.

Requisitos del Servidor (Debian/Ubuntu):
- Node.js v18+ (Instalar via nvm recomendado).
- Servidor MySQL.
- PM2 (Opcional, para ejecución en segundo plano).

Pasos de Instalación:

1. Preparar la carpeta del backend:
   Crea una carpeta en tu servidor (ej. /opt/leadmaster-backend).

2. Inicializar proyecto e instalar dependencias:
   $ npm init -y
   $ npm install nodemailer mysql2 dotenv

3. Configuración de Base de Datos (MySQL):
   - Importa `schema.sql` (descargable desde la App):
     $ mysql -u root -p < schema_XXXXXX.sql

4. Configurar Credenciales:
   - Crea un archivo `.env` en la carpeta del backend:
     SMTP_HOST=smtp.gmail.com
     SMTP_PORT=587
     SMTP_USER=tu-email@gmail.com
     SMTP_PASS=tu-contraseña-app
     
     DB_HOST=localhost
     DB_USER=root
     DB_PASS=tu_password
     DB_NAME=lead_master_db

5. Desplegar el Script:
   - Descarga `backend_mailer_XXXXXX.js` desde la sección Configuración de la App.
   - Súbelo a tu servidor.

6. Ejecutar:
   Modo manual:
   $ node backend_mailer_XXXXXX.js

   Modo Producción (con PM2):
   $ npm install -g pm2
   $ pm2 start backend_mailer_XXXXXX.js --name "lead-mailer"

--------------------------------------------------------------------------------
CARACTERÍSTICAS DEL MOTOR NODE.JS
--------------------------------------------------------------------------------

1. ARQUITECTURA NO BLOQUEANTE:
   Usa `mysql2/promise` y `nodemailer` de forma asíncrona para manejar miles
   de correos sin bloquear el hilo principal.

2. SMART THROTTLING:
   Algoritmo de espera inteligente (20-45s entre correos) implementado con
   Promesas nativas para evitar bloqueos de SMTP.

3. LOGGING:
   Registra actividad en consola y archivo local `campaign_execution.log`.

================================================================================
Generado por Lead Master AI Architect
================================================================================