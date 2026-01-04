================================================================================
INSTA-PROSPECT HYBRID ENGINE v3.0 - GUÍA DE DESPLIEGUE (SHARED HOSTING)
================================================================================

Esta guía detalla cómo instalar la aplicación en un Hosting Compartido (cPanel, 
Plesk, Hostinger, Namecheap, etc.) que soporte Node.js.

ARQUITECTURA:
1. FRONTEND: Archivos estáticos (HTML/JS/CSS) compilados.
2. BACKEND: Proceso Node.js corriendo con Phusion Passenger (típico en cPanel).

--------------------------------------------------------------------------------
REQUISITOS PREVIOS
--------------------------------------------------------------------------------
1. Acceso a cPanel (o panel similar).
2. Funcionalidad "Setup Node.js App" (o "Node.js Selector") activa en el hosting.
3. Base de datos MySQL.
4. Acceso al Administrador de Archivos o FTP.

--------------------------------------------------------------------------------
FASE 1: PREPARACIÓN Y BUILD DEL FRONTEND (En tu PC Local)
--------------------------------------------------------------------------------

1. Configura la API Key de Gemini:
   - Crea un archivo `.env` en la raíz de tu proyecto local (junto a package.json).
   - Agrega: VITE_API_KEY=tu_clave_de_google_ai_studio

2. Genera los archivos de producción:
   Abre tu terminal en la carpeta del proyecto y ejecuta:
   $ npm install
   $ npm run build

   Esto creará una carpeta llamada `dist`. El contenido de esta carpeta es lo que
   subirás a tu hosting.

--------------------------------------------------------------------------------
FASE 2: DESPLIEGUE DEL FRONTEND (cPanel - Public HTML)
--------------------------------------------------------------------------------

1. Sube los archivos:
   - Ve al "Administrador de Archivos" en cPanel.
   - Navega a la carpeta pública (`public_html` o la carpeta de tu subdominio).
   - Sube TODO el contenido que está DENTRO de la carpeta `dist` local.
     (No subas la carpeta `dist`, sino los archivos index.html, assets/, etc.).

2. Configura el Enrutamiento (.htaccess):
   Como es una Single Page Application (SPA), necesitas redirigir todo al index.html.
   - Crea un archivo llamado `.htaccess` en la misma carpeta.
   - Pega el siguiente código:

   <IfModule mod_rewrite.c>
     RewriteEngine On
     RewriteBase /
     RewriteRule ^index\.html$ - [L]
     RewriteCond %{REQUEST_FILENAME} !-f
     RewriteCond %{REQUEST_FILENAME} !-d
     RewriteRule . /index.html [L]
   </IfModule>

--------------------------------------------------------------------------------
FASE 3: BASE DE DATOS
--------------------------------------------------------------------------------

1. Crear Base de Datos:
   - En cPanel > "Bases de datos MySQL".
   - Crea una nueva base de datos (ej. `miusuario_leadmaster`).
   - Crea un usuario y asígnale contraseña.
   - Añade el usuario a la base de datos con "Todos los Privilegios".

2. Importar Estructura:
   - Ve a phpMyAdmin.
   - Selecciona tu base de datos.
   - Importa el archivo `.sql` que genera la aplicación (descárgalo desde la sección
     "Configuración" de la app funcionando localmente o usa el esquema provisto).

--------------------------------------------------------------------------------
FASE 4: DESPLIEGUE DEL BACKEND (cPanel - Setup Node.js App)
--------------------------------------------------------------------------------

El backend (Worker) necesita correr continuamente para enviar correos.

1. Crear la App Node.js:
   - En cPanel busca "Setup Node.js App".
   - Click en "Create Application".
   - Node.js Version: Selecciona la recomendada (v18, v20).
   - Application Mode: Production.
   - Application root: `lead-backend` (se creará esta carpeta fuera de public_html).
   - Application URL: `api` (o un subdominio si prefieres, ej. api.midominio.com).
   - Application startup file: `app.js`.
   - Click en "CREATE".

2. Subir Archivos del Backend:
   - Entra al Administrador de Archivos y busca la carpeta `lead-backend` creada.
   - Sube los siguientes archivos (Generados por el Kit de descarga de la App):
     a) `package.json` (Asegúrate que tenga las dependencias: nodemailer, mysql2, dotenv).
     b) El script del worker (renómbralo a `app.js`).
     c) `.env` (con tus credenciales de base de datos del hosting y SMTP).

   *NOTA: Si descargas el KIT desde la app, extrae los archivos y sube el .js renombrado.*

3. Instalar Dependencias:
   - Vuelve a la pantalla de "Setup Node.js App" en cPanel.
   - Si subiste el package.json correctamente, verás un botón "Run NPM Install". Púlsalo.
   - Si no aparece, entra por SSH al servidor, ve a la carpeta y ejecuta `npm install`.

4. Iniciar el Backend:
   - En la pantalla de Node.js App, haz click en "Restart".

--------------------------------------------------------------------------------
RESUMEN DE CONFIGURACIÓN (.env del Backend)
--------------------------------------------------------------------------------
El archivo .env en tu carpeta `lead-backend` debe lucir así:

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu@gmail.com
SMTP_PASS=tu_app_password
SENDER_EMAIL=tu@gmail.com

DB_HOST=localhost (Generalmente es localhost en cPanel)
DB_USER=miusuario_dbuser
DB_PASS=password_segura
DB_NAME=miusuario_leadmaster

--------------------------------------------------------------------------------
SOLUCIÓN DE PROBLEMAS COMUNES
--------------------------------------------------------------------------------

1. Error 404 al recargar la página:
   - Asegúrate de haber creado el archivo `.htaccess` correctamente en `public_html`.

2. El Backend no envía correos:
   - Revisa el archivo de logs. En cPanel, suele crearse un `stderr.log` en la carpeta `lead-backend`.
   - Verifica que el puerto SMTP 587 esté abierto (algunos hostings bloquean puertos de correo, consulta a soporte).

3. "App Not Found" o Error 500/503 en el Backend:
   - Asegúrate que el archivo de inicio se llame `app.js` y coincida con la configuración en "Setup Node.js App".
   - Revisa que hayas pulsado "Run NPM Install".

================================================================================
Generated by Lead Master AI Architect v3.0
================================================================================