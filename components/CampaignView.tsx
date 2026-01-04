import React, { useState, useRef, useEffect } from 'react';
import { MailgunConfig, Profile, LeadCategory } from '../types';
import { MailgunService } from '../services/mailgunService';
import { generateEmailTemplate } from '../services/geminiService';
import { PersistenceService } from '../services/persistenceService';
import { Send, Users, Wand2, UploadCloud, AlertCircle, Loader2, FileUp, Trash2, AtSign, Calendar, Megaphone, Radio, FileText, PenTool, Save, Beaker, CheckCircle2, XCircle, Info, ServerCrash } from 'lucide-react';

interface CampaignViewProps {
  recipients: Profile[];
  onUpdateRecipients: (newRecipients: Profile[]) => void;
  config: MailgunConfig;
}

export const CampaignView: React.FC<CampaignViewProps> = ({ recipients, onUpdateRecipients, config }) => {
  // Initialize sender email with config default, but allow editing
  const [senderEmail, setSenderEmail] = useState(config.fromEmail || "");
  const [subject, setSubject] = useState("");
  const [campaignCategory, setCampaignCategory] = useState("Evento en vivo");
  const [extraInstructions, setExtraInstructions] = useState("");
  const [htmlContent, setHtmlContent] = useState(MailgunService.generateDefaultTemplate());
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingTemplate, setGeneratingTemplate] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  
  // Test Email State
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [testStatusMessage, setTestStatusMessage] = useState("");
  
  // Notification State
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Drag & Drop State
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state if config changes externally
  useEffect(() => {
    if (config.fromEmail && !senderEmail) {
      setSenderEmail(config.fromEmail);
    }
  }, [config.fromEmail]);

  // Auto-hide notification after 5 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const validRecipients = recipients.filter(p => p.email && p.email.includes('@'));

  const addLog = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

  const handleGenerateTemplate = async () => {
    if (!subject || subject.length < 5) {
      addLog("ERROR: Escribe un asunto descriptivo antes de generar la plantilla.");
      setNotification({ message: "Escribe un asunto descriptivo primero.", type: 'error' });
      return;
    }
    
    setGeneratingTemplate(true);
    addLog(`Generando plantilla (${campaignCategory}) con IA...`);
    
    try {
      const aiHtml = await generateEmailTemplate(subject, campaignCategory, extraInstructions);
      setHtmlContent(aiHtml);
      setActiveTab('preview');
      addLog("Plantilla generada con éxito.");
      setNotification({ message: "Plantilla generada por IA.", type: 'success' });
    } catch (err: any) {
      addLog(`ERROR IA: ${err.message}`);
      setNotification({ message: "Error al generar plantilla.", type: 'error' });
    } finally {
      setGeneratingTemplate(false);
    }
  };

  const handleSendTest = async () => {
    setTestStatus('idle');
    setTestStatusMessage("");
    setNotification(null);

    // 1. Validations Local
    if (!config.isConfigured) {
      const msg = "Configura SMTP en Ajustes primero.";
      addLog("ERROR: " + msg);
      setTestStatus('error');
      setTestStatusMessage(msg);
      return;
    }
    if (!testEmail || !testEmail.includes('@')) {
      const msg = "Email de prueba inválido.";
      addLog("ERROR: " + msg);
      setTestStatus('error');
      setTestStatusMessage(msg);
      return;
    }

    // 2. Check Backend Connection
    setSendingTest(true);
    setTestStatus('sending');
    const isBackendOnline = await MailgunService.verifyBackendStatus();
    
    if (!isBackendOnline) {
       const msg = "Backend desconectado. Ejecuta 'npm run server'.";
       addLog("CRITICAL ERROR: " + msg);
       setTestStatus('error');
       setTestStatusMessage("Backend offline");
       setNotification({ message: msg, type: 'error' });
       setSendingTest(false);
       return;
    }

    addLog(`🧪 Enviando prueba a ${testEmail} (REAL)...`);

    try {
      // Create a temporary config object merging the global config with the specific sender email
      const campaignConfig = { ...config, fromEmail: senderEmail };
      
      // Personalize the template for the test
      let testHtml = htmlContent
        .replace(/{{username}}/g, "UsuarioPrueba")
        .replace(/{{fullname}}/g, "Nombre Apellido Test");
      
      const result = await MailgunService.sendEmail(
        campaignConfig, 
        testEmail, 
        `[PRUEBA] ${subject || "Sin Asunto"}`, 
        testHtml
      );

      if (result.success) {
        addLog(`✅ Correo de prueba enviado a ${testEmail}`);
        setTestStatus('success');
        setTestStatusMessage(`Enviado a ${testEmail}`);
        setNotification({ message: `Prueba enviada correctamente a ${testEmail}`, type: 'success' });
      } else {
        addLog(`❌ Error en prueba: ${result.message}`);
        setTestStatus('error');
        setTestStatusMessage("Falló envío");
        setNotification({ message: `Error al enviar prueba: ${result.message}`, type: 'error' });
      }
    } catch (e: any) {
      addLog(`❌ Excepción: ${e.message}`);
      setTestStatus('error');
      setTestStatusMessage(`Error: ${e.message}`);
      setNotification({ message: `Error crítico: ${e.message}`, type: 'error' });
    } finally {
      setSendingTest(false);
    }
  };

  const handleSendCampaign = async () => {
    if (!config.isConfigured) {
      addLog("ERROR: Configura SMTP en la sección de Ajustes.");
      setNotification({ message: "SMTP no configurado.", type: 'error' });
      return;
    }
    if (validRecipients.length === 0) {
      addLog("ERROR: No hay destinatarios con email válido.");
      setNotification({ message: "No hay destinatarios válidos.", type: 'error' });
      return;
    }

    setSending(true);
    setNotification(null); // Clear previous
    addLog("🔒 Verificando estado del servidor...");

    // Check backend first
    const isBackendOnline = await MailgunService.verifyBackendStatus();
    if (!isBackendOnline) {
       const msg = "NO SE PUEDE ENVIAR: El servidor Backend no está corriendo. Ejecuta 'npm run server' en tu terminal.";
       addLog(msg);
       setNotification({ message: msg, type: 'error' });
       setSending(false);
       return;
    }

    addLog("✅ Servidor ONLINE. Iniciando envío masivo...");

    try {
      setSaving(true);
      const campaignRecord = await PersistenceService.saveCampaign(
        subject,
        campaignCategory,
        htmlContent,
        validRecipients
      );
      setSaving(false);
      addLog("✅ Campaña persistida en Base de Datos. ID: " + campaignRecord.id.substring(0,8));
      
      addLog(`Iniciando entrega SMTP para ${validRecipients.length} contactos...`);
      
      let successCount = 0;
      let failCount = 0;
      const campaignConfig = { ...config, fromEmail: senderEmail };

      for (const profile of validRecipients) {
        // En un entorno real idealmente usaríamos una cola en el backend,
        // pero para este modo híbrido, iteramos con cuidado.
        const trackingPixel = `<img src="https://api.leadmaster.ai/track/open/${campaignRecord.id}/${profile.id}" width="1" height="1" style="display:none;" alt="" />`;
        
        let finalHtml = htmlContent
          .replace(/{{username}}/g, profile.username)
          .replace(/{{fullname}}/g, profile.fullName || profile.username);
        
        if (finalHtml.includes('</body>')) {
          finalHtml = finalHtml.replace('</body>', `${trackingPixel}</body>`);
        } else {
          finalHtml += trackingPixel;
        }

        const result = await MailgunService.sendEmail(campaignConfig, profile.email!, subject, finalHtml);
        
        if (result.success) {
          successCount++;
          addLog(`✅ Enviado: ${profile.email}`);
        } else {
          failCount++;
          addLog(`❌ Rebote: ${profile.email} - ${result.message}`);
        }

        // Rate Limiting del lado del cliente para no saturar
        await new Promise(r => setTimeout(r, 600));
      }

      addLog(`=== FIN DE CAMPAÑA ===`);
      addLog(`Entregados: ${successCount} | Fallidos: ${failCount}`);
      
      // Final Notification logic
      if (failCount === 0) {
        setNotification({ 
            message: `¡Campaña finalizada! ${successCount} correos entregados exitosamente.`, 
            type: 'success' 
        });
      } else if (successCount > 0) {
        setNotification({ 
            message: `Campaña completada. ${successCount} enviados, ${failCount} fallidos.`, 
            type: 'error' // Usamos estilo 'error' (rojo/ambar) para llamar la atención sobre los fallos
        });
      } else {
         setNotification({ 
            message: `Error masivo: Ningún correo pudo ser entregado. Revisa credenciales.`, 
            type: 'error' 
        });
      }
      
    } catch (error: any) {
      addLog(`CRITICAL ERROR: ${error.message}`);
      setNotification({ message: `Error crítico del sistema: ${error.message}`, type: 'error' });
    } finally {
      setSending(false);
      setSaving(false);
    }
  };

  // ... (Rest of imports and functions like processFile remain same)

  // Drag & drop logic and handlers remain the same...
  // (We are focusing on the send logic changes above)
  const processFile = (file: File) => {
    // ... same as before
    const isCSV = file.name.endsWith('.csv');
    const isDOC = file.name.endsWith('.doc'); // HTML-based Word files from ExportService

    if (!isCSV && !isDOC) {
      addLog("ERROR: Formato no soportado. Usa .CSV o los archivos .DOC generados por la app.");
      setNotification({ message: "Formato de archivo no soportado.", type: 'error' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      const newProfiles: Profile[] = [];

      if (isCSV) {
        // --- CSV PARSING STRATEGY ---
        const lines = text.split('\n');
        if (lines.length < 2) return;

        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        
        // Detección Inteligente de Columnas
        let usernameIdx = headers.findIndex(h => h.match(/usuario|user|username/i));
        let nameIdx = headers.findIndex(h => h.match(/nombre|name|fullname/i));
        let emailIdx = headers.findIndex(h => h.match(/email|correo|mail/i));

        // Fallback por contenido si fallan headers
        if (emailIdx === -1) {
           addLog("⚠️ Headers CSV confusos. Escaneando contenido...");
           const sampleRows = lines.slice(1, 6);
           const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
           const colScores = new Array(headers.length).fill(0);
           
           sampleRows.forEach(rowStr => {
              const cols = rowStr.split(',');
              cols.forEach((col, idx) => { if (emailRegex.test(col)) colScores[idx]++; });
           });

           const bestCol = colScores.findIndex(score => score > 0);
           if (bestCol !== -1) emailIdx = bestCol;
        }

        if (emailIdx === -1) {
          addLog("ERROR: No se encontró columna de Email en el CSV.");
          setNotification({ message: "No se encontró columna de Email en el CSV.", type: 'error' });
          return;
        }

        for (let i = 1; i < lines.length; i++) {
          const row = lines[i].split(','); 
          if (row.length < headers.length && row.length < emailIdx) continue;

          const rawEmail = row[emailIdx]?.trim();
          const email = rawEmail ? rawEmail.replace(/"/g, '') : '';
          
          if (email && email.includes('@')) {
             newProfiles.push({
               id: crypto.randomUUID(),
               username: usernameIdx !== -1 ? row[usernameIdx]?.trim() || 'ImportedUser' : 'ImportedUser',
               fullName: nameIdx !== -1 ? row[nameIdx]?.replace(/"/g, '').trim() || '' : '',
               email: email,
               bio: 'Importado vía CSV',
               externalUrl: '',
               followerCount: 0,
               phone: null,
               category: LeadCategory.Unclassified,
               relevanceScore: 50,
               scrapedAt: new Date().toISOString(),
               isScraped: true
             });
          }
        }
      } else if (isDOC) {
        // --- DOC/HTML PARSING STRATEGY ---
        addLog("📄 Detectado archivo Word (HTML Table). Procesando...");
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(text, 'text/html');
          const rows = Array.from(doc.querySelectorAll('tr'));
          
          rows.forEach((row, index) => {
            if (index === 0) return; // Skip Header row
            const cells = row.querySelectorAll('td');
            if (cells.length < 5) return;

            // Limpieza específica para el formato HTML generado
            const rawEmail = cells[4]?.textContent?.trim() || '';
            
            if (rawEmail && rawEmail.includes('@') && rawEmail !== '-') {
              const rawUsername = cells[0]?.textContent?.trim() || 'Usuario';
              const cleanUsername = rawUsername.replace('@', ''); // Quitar arroba visual
              
              newProfiles.push({
                id: crypto.randomUUID(),
                username: cleanUsername,
                fullName: cells[1]?.textContent?.trim() || '',
                email: rawEmail,
                bio: cells[6]?.textContent?.trim() || 'Importado vía DOC',
                externalUrl: cells[5]?.textContent?.trim() || '',
                followerCount: parseInt(cells[3]?.textContent?.replace(/,/g, '') || '0'),
                phone: null,
                category: LeadCategory.Unclassified,
                relevanceScore: 50,
                scrapedAt: new Date().toISOString(),
                isScraped: true
              });
            }
          });
        } catch (e) {
          addLog("ERROR Parseando DOC: El archivo no tiene el formato esperado.");
          setNotification({ message: "Archivo DOC corrupto o formato inválido.", type: 'error' });
          return;
        }
      }

      if (newProfiles.length > 0) {
        onUpdateRecipients([...recipients, ...newProfiles]);
        addLog(`📥 Importados ${newProfiles.length} contactos desde ${file.name}.`);
        setNotification({ message: `Importados ${newProfiles.length} contactos correctamente.`, type: 'success' });
      } else {
        addLog("No se encontraron emails válidos en el archivo.");
        setNotification({ message: "No se encontraron contactos válidos.", type: 'error' });
      }
    };
    reader.readAsText(file);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const clearRecipients = () => {
    onUpdateRecipients([]);
    addLog("Lista de destinatarios limpiada.");
  }

  return (
    <div className="flex h-full bg-slate-900 overflow-hidden">
      
      {/* Left Panel: Editor & Config */}
      <div className="w-1/2 flex flex-col border-r border-slate-800">
        <div className="p-6 border-b border-slate-800 bg-slate-950">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Send className="text-cyan-400" /> Nueva Campaña
          </h2>
          <div className="flex items-center gap-4 mt-4 text-sm">
             <div className="flex items-center gap-2 text-slate-400">
               <Users size={16} /> 
               <span className="text-white font-mono">{validRecipients.length}</span> Destinatarios
             </div>
             {!config.isConfigured && (
               <span className="text-red-400 flex items-center gap-1 text-xs bg-red-900/20 px-2 py-1 rounded">
                 <AlertCircle size={12} /> SMTP no configurado
               </span>
             )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 relative">
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Remitente (De)</label>
              <div className="relative">
                <AtSign className="absolute left-3 top-2.5 text-slate-500" size={14} />
                <input 
                  type="email" 
                  value={senderEmail}
                  onChange={e => setSenderEmail(e.target.value)}
                  placeholder="marketing@tuempresa.com"
                  className="w-full bg-slate-950 border border-slate-700 rounded-md py-2 pl-9 pr-3 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Categoría Campaña</label>
              <div className="relative">
                 <div className="absolute left-3 top-2.5 pointer-events-none">
                    {campaignCategory === 'Evento en vivo' && <Calendar size={14} className="text-cyan-500" />}
                    {campaignCategory === 'Evento online' && <Radio size={14} className="text-purple-500" />}
                    {campaignCategory === 'Nota de prensa' && <FileText size={14} className="text-emerald-500" />}
                    {campaignCategory === 'Convocatoria de medios' && <Megaphone size={14} className="text-amber-500" />}
                 </div>
                <select
                  value={campaignCategory}
                  onChange={e => setCampaignCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-md py-2 pl-9 pr-3 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none appearance-none cursor-pointer"
                >
                  <option value="Evento en vivo">Evento en vivo</option>
                  <option value="Evento online">Evento online</option>
                  <option value="Nota de prensa">Nota de prensa</option>
                  <option value="Convocatoria de medios">Convocatoria de medios</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Asunto del Correo</label>
            <input 
              type="text" 
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Ej: Invitación exclusiva al lanzamiento..."
              className="w-full bg-slate-950 border border-slate-700 rounded-md py-3 px-4 text-slate-100 focus:border-cyan-400 focus:outline-none transition-colors"
            />
          </div>

           <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
              <PenTool size={12} /> Instrucciones Adicionales para la IA
            </label>
            <div className="flex gap-2 items-start">
              <textarea 
                value={extraInstructions}
                onChange={e => setExtraInstructions(e.target.value)}
                placeholder="Ej: Usa un tono urgente, destaca que las plazas son limitadas, usa colores oscuros..."
                className="flex-1 bg-slate-950 border border-slate-700 rounded-md py-2 px-4 text-xs text-slate-300 focus:border-cyan-400 focus:outline-none transition-colors h-16 resize-none"
              />
              <button
                onClick={handleGenerateTemplate}
                disabled={!subject || generatingTemplate}
                className="h-16 w-32 bg-gradient-to-br from-purple-600 to-indigo-600 text-white rounded-md hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 transition-all flex flex-col items-center justify-center gap-1 font-medium text-xs shadow-lg shadow-purple-900/20"
                title="Generar plantilla con IA"
              >
                {generatingTemplate ? <Loader2 className="animate-spin" size={20} /> : <Wand2 size={20} />}
                {generatingTemplate ? 'Creando...' : 'Generar HTML'}
              </button>
            </div>
            {subject && !generatingTemplate && (
              <p className="text-[10px] text-purple-400 mt-1 animate-in fade-in">
                💡 Tip: Define bien las instrucciones para un resultado perfecto.
              </p>
            )}
          </div>

          <div className="flex flex-col h-80 border-t border-slate-800 pt-4">
            <div className="flex items-center justify-between mb-2">
               <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Editor de Plantilla</label>
               <div className="flex bg-slate-800 rounded p-1">
                 <button 
                   onClick={() => setActiveTab('editor')}
                   className={`px-3 py-1 text-xs rounded transition-colors ${activeTab === 'editor' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}
                 >
                   Código
                 </button>
                 <button 
                   onClick={() => setActiveTab('preview')}
                   className={`px-3 py-1 text-xs rounded transition-colors ${activeTab === 'preview' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}
                 >
                   Vista Previa
                 </button>
               </div>
            </div>
            
            {activeTab === 'editor' ? (
              <textarea 
                value={htmlContent}
                onChange={e => setHtmlContent(e.target.value)}
                className="flex-1 w-full bg-slate-950 border border-slate-700 rounded-md p-4 font-mono text-xs text-slate-300 focus:border-cyan-400 focus:outline-none resize-none leading-relaxed"
                spellCheck={false}
              />
            ) : (
              <div className="flex-1 w-full bg-white rounded-md overflow-hidden border border-slate-700">
                <iframe 
                  srcDoc={htmlContent} 
                  className="w-full h-full" 
                  title="Preview"
                  sandbox="allow-same-origin"
                />
              </div>
            )}
            <p className="text-[10px] text-slate-500 mt-2">
              Variables: <code className="text-cyan-500">{'{{username}}'}</code>, <code className="text-cyan-500">{'{{fullname}}'}</code>.
              Se añadirá automáticamente el <span className="text-green-400">Pixel de Tracking</span>.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-800 animate-in slide-in-from-bottom-2 fade-in">
             <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Beaker size={14} className="text-amber-500" /> Enviar Prueba de Diseño
                </label>
                {testStatus !== 'idle' && (
                    <span className={`text-[10px] flex items-center gap-1 ${testStatus === 'success' ? 'text-green-400' : testStatus === 'sending' ? 'text-amber-400' : 'text-red-400'}`}>
                        {testStatus === 'sending' && <Loader2 size={10} className="animate-spin" />}
                        {testStatus === 'success' && <CheckCircle2 size={10} />}
                        {testStatus === 'error' && <AlertCircle size={10} />}
                        {testStatus === 'sending' ? 'Enviando...' : testStatusMessage}
                    </span>
                )}
             </div>
             
             <div className="flex gap-2 bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                <input 
                  type="email" 
                  value={testEmail}
                  onChange={e => setTestEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-md py-2 px-3 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none placeholder:text-slate-600"
                />
                <button
                  onClick={handleSendTest}
                  disabled={sendingTest}
                  className={`px-4 py-2 rounded-md font-medium text-xs flex items-center gap-2 transition-all ${
                     sendingTest
                     ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                     : 'bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-600 hover:border-cyan-500'
                  }`}
                >
                  {sendingTest ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
                  Enviar Prueba
                </button>
             </div>
             <p className="text-[10px] text-slate-500 mt-1 pl-1">
                Se enviará una versión con datos ficticios ({`{{username}}`} &rarr; UsuarioPrueba) para verificar estilos.
             </p>
          </div>

        </div>

        {/* Global Action Area */}
        <div className="p-6 border-t border-slate-800 bg-slate-950 flex flex-col gap-3">
          
          {/* Global Notification Banner */}
          {notification && (
            <div className={`
              px-4 py-3 rounded-md flex items-center gap-3 text-sm font-medium animate-in fade-in slide-in-from-bottom-4 shadow-lg
              ${notification.type === 'success' 
                 ? 'bg-green-900/30 text-green-400 border border-green-500/30' 
                 : 'bg-red-900/30 text-red-400 border border-red-500/30'}
            `}>
               {notification.type === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
               <span>{notification.message}</span>
            </div>
          )}

          <button
            onClick={handleSendCampaign}
            disabled={sending || validRecipients.length === 0 || !config.isConfigured}
            className={`w-full py-4 rounded-md font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg ${
              sending || validRecipients.length === 0 || !config.isConfigured
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-cyan-900/20'
            }`}
          >
            {sending ? <Loader2 className="animate-spin" /> : <Send size={18} />}
            {sending 
              ? (saving ? 'GUARDANDO EN DB...' : 'ENVIANDO CORREOS...') 
              : 'GUARDAR Y LANZAR CAMPAÑA'
            }
          </button>
        </div>
      </div>

      <div className="w-1/2 flex flex-col bg-black/20">
        
        <div className="p-6 border-b border-slate-800">
           <div className="flex items-center justify-between mb-4">
             <h3 className="text-sm font-semibold text-slate-400 flex items-center gap-2">
               <UploadCloud size={16} /> Importar Contactos
             </h3>
             {recipients.length > 0 && (
               <button 
                 onClick={clearRecipients}
                 className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1"
               >
                 <Trash2 size={12} /> Limpiar Lista
               </button>
             )}
           </div>

           <div 
             onDragOver={onDragOver}
             onDragLeave={onDragLeave}
             onDrop={onDrop}
             onClick={() => fileInputRef.current?.click()}
             className={`
               border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all
               ${isDragging ? 'border-cyan-500 bg-cyan-900/20' : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/50'}
             `}
           >
             <input 
               type="file" 
               ref={fileInputRef} 
               onChange={handleFileInput} 
               accept=".csv, .doc" 
               className="hidden" 
             />
             <FileUp className="mx-auto text-slate-500 mb-2" size={24} />
             <p className="text-xs text-slate-300 font-medium">Arrastra CSV o Reporte DOC aquí</p>
             <p className="text-[10px] text-slate-500 mt-1">Soporta .CSV y .DOC (Generados por Lead Master)</p>
           </div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto">
           <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
             <table className="w-full text-left text-xs">
               <thead className="bg-slate-900 text-slate-500 font-medium border-b border-slate-800">
                 <tr>
                   <th className="p-3">Usuario</th>
                   <th className="p-3">Email</th>
                   <th className="p-3 text-right">Estado</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-800">
                 {validRecipients.length === 0 ? (
                   <tr><td colSpan={3} className="p-8 text-center text-slate-500 italic">No hay contactos cargados.</td></tr>
                 ) : (
                   validRecipients.map(p => (
                     <tr key={p.id}>
                       <td className="p-3 font-medium text-slate-300">{p.username}</td>
                       <td className="p-3 text-slate-400">{p.email}</td>
                       <td className="p-3 text-right">
                         <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-[10px]">Listo</span>
                       </td>
                     </tr>
                   ))
                 )}
               </tbody>
             </table>
           </div>
        </div>

        <div className="h-1/3 bg-black p-4 font-mono text-xs overflow-y-auto border-t border-slate-800">
          <div className="text-slate-500 mb-2 font-bold uppercase tracking-wider text-[10px]">Log de Envío</div>
          {logs.length === 0 && <span className="text-slate-700">Esperando inicio de campaña...</span>}
          {logs.map((log, i) => (
            <div key={i} className={`mb-1 ${log.includes('Fallo') || log.includes('ERROR') || log.includes('Backend desconectado') ? 'text-red-400' : 'text-green-400'}`}>
              {log}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};