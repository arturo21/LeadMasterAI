
import React, { useState } from 'react';
import { MailgunConfig } from '../types';
import { MailgunService } from '../services/mailgunService';
import JSZip from 'jszip';
import { Save, Settings, ShieldCheck, AlertTriangle, Globe, Key, AtSign, User, Server, Lock, Eye, EyeOff, Code, Copy, Check, Database, Download, Terminal, XCircle, Package } from 'lucide-react';

interface SettingsViewProps {
  config: MailgunConfig;
  onSave: (config: MailgunConfig) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ config, onSave }) => {
  const [formData, setFormData] = useState<MailgunConfig>(config);
  const [showPassword, setShowPassword] = useState(false);
  const [showDbPassword, setShowDbPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    // Si el usuario cambia el puerto, asegurarnos que sea número
    if (e.target.name === 'smtpPort') {
        setFormData({ ...formData, [e.target.name]: parseInt(e.target.value) || 587 });
    } else {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    }
    // Clear error when user types
    if (validationError) setValidationError(null);
    if (saveSuccess) setSaveSuccess(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setSaveSuccess(false);

    // Validación: Campos SMTP obligatorios
    if (!formData.smtpHost || !formData.smtpPort || !formData.smtpUser || !formData.smtpPass) {
        setValidationError("Debes completar todos los campos SMTP (Host, Puerto, Usuario, Contraseña).");
        // Guardamos los datos para no perderlos, pero marcamos como NO configurado
        onSave({
            ...formData,
            isConfigured: false
        });
        return;
    }
    
    // Validación: Email remitente
    if (!formData.fromEmail) {
        setValidationError("El email del remitente es obligatorio.");
         onSave({
            ...formData,
            isConfigured: false
        });
        return;
    }

    onSave({
      ...formData,
      isConfigured: true
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleCopyCode = () => {
    const code = MailgunService.getNodeScript(formData);
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadZip = async () => {
    const zip = new JSZip();
    const randomId = Math.floor(100000 + Math.random() * 900000);
    
    // 1. Backend Script Node.js
    zip.file(`node_worker_${randomId}.js`, MailgunService.getNodeScript(formData));
    
    // 2. SQL Schema
    zip.file(`schema_${randomId}.sql`, MailgunService.getMySQLSchema());
    
    // 3. Environment Variables Template
    const envContent = `SMTP_HOST=${formData.smtpHost}
SMTP_PORT=${formData.smtpPort}
SMTP_USER=${formData.smtpUser}
SMTP_PASS=${formData.smtpPass}
SENDER_EMAIL=${formData.fromEmail}

DB_HOST=${formData.dbHost || 'localhost'}
DB_USER=${formData.dbUser || 'root'}
DB_PASS=${formData.dbPass || ''}
DB_NAME=${formData.dbName || 'lead_master_db'}
REDIS_URL=redis://localhost:6379`;
    zip.file(".env.example", envContent);

    // 4. Instructions
    const readmeContent = `LEAD MASTER AI - NODE.JS ARCHITECTURE KIT
----------------------------
ID Despliegue: ${randomId}
Stack: Node.js + Puppeteer + Nodemailer
Fecha: ${new Date().toLocaleString()}

INSTRUCCIONES:
1. Instala Node.js v20+ (LTS).
2. Instala dependencias: 
   npm install nodemailer mysql2 dotenv puppeteer

3. Renombra .env.example a .env (ya contiene tus credenciales).
4. Importa schema_${randomId}.sql en tu base de datos MySQL.
5. Ejecuta el worker: 
   node node_worker_${randomId}.js

PARA PRODUCCIÓN (Con PM2):
   npm install -g pm2
   pm2 start node_worker_${randomId}.js --name "lead-master-worker"
`;
    zip.file("README_ARCH.txt", readmeContent);

    // Generate ZIP
    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lead_master_node_kit_${randomId}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto animate-in fade-in duration-500 pb-20">
      <div className="mb-8 border-b border-slate-800 pb-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <Settings className="text-cyan-400" /> Configuración Backend (Node.js)
        </h2>
        <p className="text-slate-400 mt-2">
          Configura las credenciales para el servidor Node.js (Worker).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: FORM */}
        <div className="lg:col-span-2 space-y-8">
          <form onSubmit={handleSubmit} className="bg-slate-950 border border-slate-800 p-6 rounded-lg shadow-xl space-y-6">
            
            {/* Section 1: SMTP Credentials */}
            <div className="space-y-4">
               <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2 flex items-center gap-2">
                 <Server size={14} /> 1. Servidor SMTP (Nodemailer)
               </h3>
               
               <div className="grid grid-cols-3 gap-4">
                 <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-400 mb-2">Host</label>
                    <input
                      type="text"
                      name="smtpHost"
                      value={formData.smtpHost}
                      onChange={handleChange}
                      placeholder="smtp.gmail.com"
                      className="w-full bg-slate-900 border border-slate-700 rounded-md py-2.5 px-4 text-slate-100 focus:border-cyan-400 focus:outline-none transition-colors font-mono text-sm"
                    />
                 </div>
                 <div className="col-span-1">
                    <label className="block text-xs font-semibold text-slate-400 mb-2">Puerto</label>
                    <input
                      type="number"
                      name="smtpPort"
                      value={formData.smtpPort}
                      onChange={handleChange}
                      placeholder="587"
                      className="w-full bg-slate-900 border border-slate-700 rounded-md py-2.5 px-4 text-slate-100 focus:border-cyan-400 focus:outline-none transition-colors font-mono text-sm"
                    />
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-2">Usuario SMTP</label>
                      <input
                        type="text"
                        name="smtpUser"
                        value={formData.smtpUser}
                        onChange={handleChange}
                        placeholder="tu@email.com"
                        className="w-full bg-slate-900 border border-slate-700 rounded-md py-2.5 px-4 text-slate-100 focus:border-cyan-400 focus:outline-none transition-colors text-sm"
                      />
                   </div>
                   
                   <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-2">Contraseña SMTP</label>
                      <div className="relative">
                        <input
                            type={showPassword ? "text" : "password"}
                            name="smtpPass"
                            value={formData.smtpPass}
                            onChange={handleChange}
                            placeholder="••••••••••••"
                            className="w-full bg-slate-900 border border-slate-700 rounded-md py-2.5 px-4 pr-10 text-slate-100 focus:border-cyan-400 focus:outline-none transition-colors text-sm font-mono"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-2.5 text-slate-500 hover:text-cyan-400 transition-colors"
                            tabIndex={-1}
                        >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                   </div>
               </div>
            </div>

            {/* Section 2: Default Sender Info */}
            <div className="space-y-4 pt-4">
               <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2 flex items-center gap-2">
                 <User size={14} /> 2. Detalles del Remitente
               </h3>
               
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-2">Nombre Visible</label>
                    <input
                      type="text"
                      name="fromName"
                      value={formData.fromName}
                      onChange={handleChange}
                      placeholder="Tu Empresa"
                      className="w-full bg-slate-900 border border-slate-700 rounded-md py-2.5 px-4 text-slate-100 focus:border-cyan-400 focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-2">Email Remitente</label>
                    <input
                      type="email"
                      name="fromEmail"
                      value={formData.fromEmail}
                      onChange={handleChange}
                      placeholder="marketing@tu-dominio.com"
                      className="w-full bg-slate-900 border border-slate-700 rounded-md py-2.5 px-4 text-slate-100 focus:border-cyan-400 focus:outline-none transition-colors"
                    />
                  </div>
               </div>
            </div>

            {/* Section 3: Database Config */}
            <div className="space-y-4 pt-4">
               <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2 flex items-center gap-2">
                 <Database size={14} /> 3. Base de Datos (MySQL/Postgres)
               </h3>
               
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-2">DB Host</label>
                    <input
                      type="text"
                      name="dbHost"
                      value={formData.dbHost || 'localhost'}
                      onChange={handleChange}
                      placeholder="localhost"
                      className="w-full bg-slate-900 border border-slate-700 rounded-md py-2.5 px-4 text-slate-100 focus:border-cyan-400 focus:outline-none transition-colors font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-2">Nombre BD</label>
                    <input
                      type="text"
                      name="dbName"
                      value={formData.dbName || 'lead_master_db'}
                      onChange={handleChange}
                      placeholder="lead_master_db"
                      className="w-full bg-slate-900 border border-slate-700 rounded-md py-2.5 px-4 text-slate-100 focus:border-cyan-400 focus:outline-none transition-colors font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-2">Usuario DB</label>
                    <input
                      type="text"
                      name="dbUser"
                      value={formData.dbUser || 'root'}
                      onChange={handleChange}
                      placeholder="root"
                      className="w-full bg-slate-900 border border-slate-700 rounded-md py-2.5 px-4 text-slate-100 focus:border-cyan-400 focus:outline-none transition-colors font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-2">Contraseña DB</label>
                    <div className="relative">
                        <input
                            type={showDbPassword ? "text" : "password"}
                            name="dbPass"
                            value={formData.dbPass || ''}
                            onChange={handleChange}
                            placeholder=""
                            className="w-full bg-slate-900 border border-slate-700 rounded-md py-2.5 px-4 pr-10 text-slate-100 focus:border-cyan-400 focus:outline-none transition-colors text-sm font-mono"
                        />
                        <button
                            type="button"
                            onClick={() => setShowDbPassword(!showDbPassword)}
                            className="absolute right-3 top-2.5 text-slate-500 hover:text-cyan-400 transition-colors"
                            tabIndex={-1}
                        >
                            {showDbPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                  </div>
               </div>
            </div>

            {/* Error Message */}
            {validationError && (
              <div className="bg-red-900/20 border border-red-500/50 rounded-md p-3 flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                <XCircle size={16} className="text-red-400 mt-0.5" />
                <p className="text-xs text-red-200">{validationError}</p>
              </div>
            )}
            
            {/* Success Message */}
            {saveSuccess && (
              <div className="bg-green-900/20 border border-green-500/50 rounded-md p-3 flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                <Check size={16} className="text-green-400 mt-0.5" />
                <p className="text-xs text-green-200">Configuración Node.js guardada correctamente.</p>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-3 rounded-md transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-900/20"
            >
              <Save size={18} /> Guardar Configuración
            </button>
          </form>

           {/* CODE SNIPPET DISPLAY */}
           <div className="bg-[#0d1117] border border-slate-800 rounded-lg overflow-hidden shadow-xl animate-in slide-in-from-bottom-4">
              <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex justify-between items-center">
                 <div className="flex items-center gap-2">
                    <Terminal size={14} className="text-yellow-400" />
                    <span className="text-xs font-mono font-bold text-slate-300">node_worker.js</span>
                 </div>
                 <div className="flex gap-2">
                    <button 
                      onClick={handleCopyCode} 
                      className="text-[10px] flex items-center gap-1 text-slate-400 hover:text-white transition-colors bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded border border-slate-700"
                    >
                      {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                      {copied ? "Copiado" : "Copiar"}
                    </button>
                 </div>
              </div>
              <div className="p-4 overflow-x-auto">
                 <pre className="font-mono text-xs text-slate-300 leading-relaxed">
                   <code>{MailgunService.getNodeScript(formData)}</code>
                 </pre>
              </div>
              
              {/* DOWNLOAD AREA */}
              <div className="bg-slate-900 p-4 border-t border-slate-800">
                <button 
                  onClick={handleDownloadZip}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white py-3 rounded-md shadow-lg transition-all border border-emerald-500/30"
                >
                   <Package size={18} /> Descargar Deployment Kit (.ZIP)
                </button>
                <p className="text-[10px] text-slate-500 text-center mt-2">
                   Incluye: Script Node.js, Schema SQL, .env.example y Guía PM2.
                   <br/>
                   <span className="font-mono text-slate-600">lead_master_node_kit_[RANDOM].zip</span>
                </p>
              </div>
           </div>
        </div>

        {/* RIGHT COLUMN: STATUS & INFO */}
        <div className="space-y-6">
          <div className={`p-4 rounded-lg border ${config.isConfigured ? 'bg-green-900/20 border-green-500/50' : 'bg-amber-900/20 border-amber-500/50'}`}>
            <div className="flex items-start gap-3">
              {config.isConfigured ? <ShieldCheck className="text-green-400 shrink-0" /> : <AlertTriangle className="text-amber-400 shrink-0" />}
              <div>
                <h4 className={`font-semibold ${config.isConfigured ? 'text-green-400' : 'text-amber-400'}`}>
                  {config.isConfigured ? 'Backend Conectado' : 'Faltan Credenciales'}
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  {config.isConfigured 
                    ? `Worker Node.js configurado para ${config.smtpHost}.` 
                    : 'Completa los campos SMTP para generar el worker.'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 p-5 rounded-lg border border-slate-800 text-xs text-slate-400 leading-relaxed">
            <h4 className="text-slate-200 font-bold mb-3 uppercase flex items-center gap-2">
               <Database size={14} /> Arquitectura Node.js
            </h4>
            <p className="mb-2">Stack de alto rendimiento:</p>
            <ul className="list-disc pl-4 space-y-2 mb-4">
               <li><strong className="text-cyan-400">Node.js v20+</strong> Core Engine.</li>
               <li><strong className="text-cyan-400">Puppeteer</strong> para Scraping Headless.</li>
               <li><strong className="text-cyan-400">Nodemailer</strong> envío asíncrono.</li>
               <li><strong className="text-cyan-400">BullMQ (Redis)</strong> gestión de colas.</li>
            </ul>
            
            <div className="bg-blue-900/10 p-3 rounded border border-blue-900/30 text-blue-200 mb-2">
               <p><strong>Rendimiento:</strong> Code-splitting implementado en Frontend para carga instantánea.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
