import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { promises as dns } from 'dns';
import puppeteer from 'puppeteer';

// Configuración básica
const app = express();
// IMPORTANTE: En Shared Hosting (cPanel/Passenger), el puerto lo asigna el entorno.
// Si process.env.PORT no está definido, usamos 3001 como fallback local.
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); 

// Servir archivos estáticos en producción
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// En producción, servimos el frontend compilado desde la carpeta 'dist'
app.use(express.static(join(__dirname, 'dist')));

// --- UTILS ---
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function validateMxInternal(email) {
  if (!email || !email.includes('@')) return false;
  const domain = email.split('@')[1];
  try {
    const mxRecords = await dns.resolveMx(domain);
    return mxRecords && mxRecords.length > 0;
  } catch (error) {
    return false;
  }
}

async function scrapeGoogleResults(query, limit = 30) {
    let browser;
    try {
        console.log(`[PUPPETEER] Iniciando instancia en entorno: ${process.env.NODE_ENV || 'development'}`);
        
        // Configuración optimizada para Shared Hosting (Recursos limitados)
        browser = await puppeteer.launch({
            headless: true,
            // Argumentos CRÍTICOS para funcionar en entornos Linux restringidos (cPanel/CentOS)
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-dev-shm-usage', // Usa /tmp en lugar de /dev/shm (vital para docker/shared)
                '--disable-gpu',
                '--no-first-run',
                '--no-zygote',
                '--single-process', // A veces necesario en entornos muy estrictos
                '--disable-extensions'
            ]
        });

        const page = await browser.newPage();
        
        // Bloquear carga de recursos pesados para ahorrar ancho de banda del hosting
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const resourceType = req.resourceType();
            if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');
        
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        });

        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=${Math.min(limit * 1.5, 100)}`;
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 45000 }); // Timeout aumentado para hosting lento
        
        await sleep(1500 + Math.random() * 1000);

        const rawResults = await page.evaluate(() => {
            const items = document.querySelectorAll('div.g, div.MjjYud'); 
            const data = [];
            
            items.forEach(item => {
                const titleEl = item.querySelector('h3');
                const linkEl = item.querySelector('a');
                const snippetEl = item.querySelector('div.VwiC3b') || 
                                  item.querySelector('div[style*="-webkit-line-clamp"]') || 
                                  item.querySelector('span.aCOpRe'); 

                if (titleEl && linkEl) {
                    const text = snippetEl ? snippetEl.innerText : "";
                    const fullText = (titleEl.innerText + " " + text).toLowerCase();
                    const emailMatch = fullText.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi);
                    
                    if (emailMatch && emailMatch.length > 0) {
                        data.push({
                            title: titleEl.innerText,
                            url: linkEl.href,
                            snippet: text,
                            email: emailMatch[0]
                        });
                    }
                }
            });
            return data;
        });

        return rawResults;

    } catch (error) {
        console.error("[INTERNAL SCRAPER ERROR]", error);
        throw error;
    } finally {
        if (browser) await browser.close();
    }
}

// --- ENDPOINTS ---

app.get('/api/health', (req, res) => {
  res.json({ status: 'online', env: process.env.NODE_ENV, port: PORT });
});

app.post('/api/validate-email', async (req, res) => {
  const { email } = req.body;
  const isValid = await validateMxInternal(email);
  res.json({ isValid });
});

app.post('/api/validate-batch', async (req, res) => {
  const { emails } = req.body;
  if (!Array.isArray(emails)) return res.status(400).json({ error: "Array requerido" });

  console.log(`[MECHANICAL] Validando lote de ${emails.length} correos...`);
  const results = [];
  const BATCH_SIZE = 20;
  
  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const chunk = emails.slice(i, i + BATCH_SIZE);
    const promises = chunk.map(async (email) => ({ email, isValid: await validateMxInternal(email) }));
    const chunkResults = await Promise.all(promises);
    results.push(...chunkResults);
  }
  res.json({ results });
});

app.post('/api/scrape-live', async (req, res) => {
  const { query, limit = 10 } = req.body;
  if (!query) return res.status(400).json({ error: "Query requerida" });

  console.log(`[SCRAPER] Búsqueda: "${query}"`);
  try {
    const rawResults = await scrapeGoogleResults(query, limit);
    
    const verifiedProfiles = [];
    for (const result of rawResults) {
      if (verifiedProfiles.length >= limit) break;

      let username = "unknown";
      if (result.url.includes('instagram.com/')) {
        const parts = result.url.split('instagram.com/');
        if (parts[1]) username = parts[1].split('/')[0].split('?')[0];
      }

      const isMxValid = await validateMxInternal(result.email);
      if (isMxValid) {
        verifiedProfiles.push({
          username: username,
          fullName: result.title.split(/ [•|-] /)[0].trim(),
          bio: result.snippet,
          email: result.email,
          externalUrl: result.url,
          followerCount: 0, 
          phone: null,
          isScraped: true
        });
      }
    }
    res.json({ success: true, profiles: verifiedProfiles });
  } catch (error) {
    console.error("[SCRAPER API ERROR]", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/send-email', async (req, res) => {
  const { config, to, subject, html } = req.body;
  try {
      const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: Number(config.smtpPort),
      secure: Number(config.smtpPort) === 465, 
      auth: { user: config.smtpUser, pass: config.smtpPass },
      tls: { rejectUnauthorized: false }
    });
    await transporter.verify();
    const info = await transporter.sendMail({ from: `"${config.fromName}" <${config.fromEmail}>`, to, subject, html });
    res.json({ success: true, messageId: info.messageId });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Manejo de Rutas del Frontend (SPA)
// Cualquier petición que no sea /api será manejada por React Router enviando index.html
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n=== LEAD MASTER AI ===`);
  console.log(`🚀 Servidor iniciado en puerto: ${PORT}`);
  console.log(`📂 Sirviendo frontend desde: ${join(__dirname, 'dist')}`);
  console.log(`======================\n`);
});