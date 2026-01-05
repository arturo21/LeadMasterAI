import React, { useState, useCallback, useRef, useEffect, Suspense } from 'react';
import { enrichProfiles } from './services/geminiService';
import { MechanicalService } from './services/mechanicalService';
import { ExportManager } from './services/exportService';
import { ImportService } from './services/importService';
import { Profile, SearchParams, AppStatus, LeadCategory, ViewMode, MailgunConfig, RawProfile } from './types';
// Lazy loaded components for better performance
const SettingsView = React.lazy(() => import('./components/SettingsView').then(module => ({ default: module.SettingsView })));
const CampaignView = React.lazy(() => import('./components/CampaignView').then(module => ({ default: module.CampaignView })));
const AnalyticsDashboard = React.lazy(() => import('./components/AnalyticsDashboard').then(module => ({ default: module.AnalyticsDashboard })));
const MediaTalentView = React.lazy(() => import('./components/MediaTalentView').then(module => ({ default: module.MediaTalentView })));

import { 
  Search, 
  Copy, 
  FileSpreadsheet, 
  FileText, 
  Activity, 
  Users, 
  Filter, 
  AlertCircle,
  Play,
  Terminal,
  Briefcase,
  UserPlus,
  Globe,
  Loader2,
  Music,
  Mail,
  Settings,
  Database,
  ArrowRight,
  BarChart,
  Bot,
  Zap,
  Mic2,
  UploadCloud
} from 'lucide-react';

const INITIAL_PARAMS: SearchParams = {
  mode: 'niche',
  niche: '',
  country: '',
  sourceUsername: '',
  contactNature: 'Prospectos de Agencia',
  musicStyle: '',
  minFollowers: 1000,
  maxFollowers: 50000,
  resultsCount: 10
};

const INITIAL_MAILGUN_CONFIG: MailgunConfig = {
  smtpHost: 'smtp.mailgun.org',
  smtpPort: 587,
  smtpUser: '',
  smtpPass: '',
  fromName: '',
  fromEmail: '',
  isConfigured: false,
  dbHost: 'localhost',
  dbUser: 'root',
  dbPass: '',
  dbName: 'lead_master_db'
};

// Loading component for Suspense
const LoadingView = () => (
  <div className="flex items-center justify-center h-full text-slate-500 gap-2">
    <Loader2 className="animate-spin" /> Cargando Módulo...
  </div>
);

const App: React.FC = () => {
  // Navigation State
  const [currentView, setCurrentView] = useState<ViewMode>('scraper');
  const [visitedViews, setVisitedViews] = useState<Set<ViewMode>>(new Set(['scraper']));
  
  // Scraper State
  const [params, setParams] = useState<SearchParams>(INITIAL_PARAMS);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [status, setStatus] = useState<AppStatus>(AppStatus.Idle);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  // Campaign State
  const [campaignRecipients, setCampaignRecipients] = useState<Profile[]>([]);
  const [mailgunConfig, setMailgunConfig] = useState<MailgunConfig>(() => {
    const saved = localStorage.getItem('lead_master_mailgun');
    if (saved) {
      const parsed = JSON.parse(saved);
      return { 
          ...INITIAL_MAILGUN_CONFIG, 
          ...parsed,
          dbHost: parsed.dbHost || 'localhost',
          dbUser: parsed.dbUser || 'root',
          dbName: parsed.dbName || 'lead_master_db'
      };
    }
    return INITIAL_MAILGUN_CONFIG;
  });
  
  const logsEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addLog = useCallback((message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const navigateTo = (view: ViewMode) => {
    setCurrentView(view);
    setVisitedViews(prev => new Set(prev).add(view));
  };

  const handleSaveConfig = useCallback((newConfig: MailgunConfig) => {
    setMailgunConfig(newConfig);
    localStorage.setItem('lead_master_mailgun', JSON.stringify(newConfig));
    addLog("Configuración Backend (Node.js) actualizada.");
  }, [addLog]);

  const handleTransferToCampaign = useCallback(() => {
    const validLeads = profiles.filter(p => p.email);
    setCampaignRecipients(validLeads);
    navigateTo('campaign');
    addLog(`${validLeads.length} leads transferidos al módulo de Campaña.`);
  }, [profiles, addLog]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (params.mode === 'niche' && (!params.niche || !params.country)) {
        setError("Por favor define un Nicho y un País.");
        return;
    }
    
    setStatus(AppStatus.Scraping);
    setProgress(0);
    setError(null);
    setLogs([]); 
    addLog(`Inicializando MOTOR HÍBRIDO v3.0 (Node.js)...`);
    
    try {
      addLog(">> FASE 1: Scraping Mecánico (Node.js Worker)...");
      const mechInterval = setInterval(() => {
         setProgress(prev => prev < 45 ? prev + 5 : prev);
      }, 300);

      const rawProfiles: RawProfile[] = await MechanicalService.scrapeRawProfiles(params);
      
      clearInterval(mechInterval);
      setProgress(50);
      addLog(`✅ Scraping completado. ${rawProfiles.length} perfiles brutos extraídos.`);

      setStatus(AppStatus.Classifying);
      addLog(">> FASE 2: Enriquecimiento Generativo (Gemini AI)...");

      const enrichedProfiles = await enrichProfiles(rawProfiles, params.contactNature);
      
      setProfiles(enrichedProfiles);
      setProgress(100);
      setStatus(AppStatus.Completed);
      addLog("✅ Clasificación IA completada.");

      setTimeout(() => { if (status !== AppStatus.Scraping) setProgress(0); }, 2000);
      
    } catch (err: any) {
      setError(err.message || "Ocurrió un error inesperado.");
      addLog(`ERROR CRÍTICO: ${err.message}`);
      setStatus(AppStatus.Error);
      setProgress(0);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    addLog(`📂 Leyendo archivo: ${file.name}...`);
    setError(null);

    try {
      const importedProfiles = await ImportService.parseFile(file);
      setProfiles(importedProfiles);
      addLog(`✅ Importación exitosa: ${importedProfiles.length} perfiles cargados.`);
      setStatus(AppStatus.Completed);
    } catch (err: any) {
      setError(err.message);
      addLog(`❌ Error de importación: ${err.message}`);
    } finally {
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const clearData = () => {
    setProfiles([]);
    setLogs([]);
    setStatus(AppStatus.Idle);
    setProgress(0);
  };

  const stats = {
    total: profiles.length,
    media: profiles.filter(p => p.category === LeadCategory.MediaPress).length,
    business: profiles.filter(p => p.category === LeadCategory.DigitalBusiness).length,
    investors: profiles.filter(p => p.category === LeadCategory.Investment).length,
    irrelevant: profiles.filter(p => p.category === LeadCategory.Irrelevant).length,
  };

  const getDisplayClass = (view: ViewMode) => {
    return currentView === view ? 'flex-1 flex overflow-hidden w-full h-full' : 'hidden';
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex font-sans overflow-hidden">
      
      {/* Main Sidebar Navigation */}
      <nav className="w-20 bg-slate-950 border-r border-slate-800 flex flex-col items-center py-6 gap-6 z-50">
        <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg mb-4 cursor-default" title="Lead Master AI Node v3">
           <Zap className="text-white" size={24} />
        </div>

        <button 
          onClick={() => navigateTo('scraper')}
          className={`p-3 rounded-xl transition-all group relative ${currentView === 'scraper' ? 'bg-slate-800 text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
          title="Scraper & Leads"
        >
           <Database size={24} />
        </button>

        <button 
          onClick={() => navigateTo('media-talent')}
          className={`p-3 rounded-xl transition-all group relative ${currentView === 'media-talent' ? 'bg-indigo-900 text-blue-300 shadow-lg shadow-blue-900/30' : 'text-slate-500 hover:text-slate-300'}`}
          title="Media Talent OSINT"
        >
           <Mic2 size={24} />
        </button>

        <button 
          onClick={() => navigateTo('campaign')}
          className={`p-3 rounded-xl transition-all group relative ${currentView === 'campaign' ? 'bg-slate-800 text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
          title="Email Campaign"
        >
           <Mail size={24} />
           {campaignRecipients.length > 0 && (
             <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border border-slate-950"></span>
           )}
        </button>

        <button 
          onClick={() => navigateTo('analytics')}
          className={`p-3 rounded-xl transition-all group relative ${currentView === 'analytics' ? 'bg-slate-800 text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
          title="Analytics"
        >
           <BarChart size={24} />
        </button>

        <div className="flex-1" />

        <button 
          onClick={() => navigateTo('settings')}
          className={`p-3 rounded-xl transition-all group relative ${currentView === 'settings' ? 'bg-slate-800 text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
          title="Settings"
        >
           <Settings size={24} />
        </button>
      </nav>

      <div className="flex-1 flex overflow-hidden relative">
        <Suspense fallback={<LoadingView />}>
            <div className={getDisplayClass('media-talent')}>
              {visitedViews.has('media-talent') && <MediaTalentView />}
            </div>
            <div className={getDisplayClass('settings')}>
              {visitedViews.has('settings') && <SettingsView config={mailgunConfig} onSave={handleSaveConfig} />}
            </div>
            <div className={getDisplayClass('campaign')}>
               {visitedViews.has('campaign') && (
                <CampaignView 
                    recipients={campaignRecipients} 
                    onUpdateRecipients={setCampaignRecipients}
                    config={mailgunConfig} 
                />
               )}
            </div>
            <div className={getDisplayClass('analytics')}>
                {visitedViews.has('analytics') && <AnalyticsDashboard />}
            </div>
        </Suspense>

        {/* VIEW: SCRAPER */}
        <div className={getDisplayClass('scraper')}>
            <aside className="w-80 bg-slate-950 border-r border-slate-800 flex flex-col h-full z-10 shadow-2xl">
              <div className="p-6 border-b border-slate-800">
                <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent flex items-center gap-2">
                  LEAD MASTER AI
                </h1>
                <p className="text-xs text-slate-500 mt-1 font-mono">NODE.JS ARCHITECTURE</p>
              </div>

              <div className="p-6 flex-1 overflow-y-auto">
                <form onSubmit={handleSearch} className="space-y-6">
                  
                  {/* Mode Switcher */}
                  <div className="bg-slate-900 p-1 rounded-lg flex gap-1 border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setParams({...params, mode: 'niche'})}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-md transition-all ${
                        params.mode === 'niche' 
                          ? 'bg-slate-800 text-cyan-400 shadow-sm border border-slate-700' 
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      <Globe size={14} /> Nicho
                    </button>
                    <button
                      type="button"
                      onClick={() => setParams({...params, mode: 'followers'})}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-md transition-all ${
                        params.mode === 'followers' 
                          ? 'bg-slate-800 text-cyan-400 shadow-sm border border-slate-700' 
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      <UserPlus size={14} /> Seguidores
                    </button>
                  </div>

                  {/* Target Inputs */}
                  <div className="space-y-3">
                    {params.mode === 'niche' ? (
                      <>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                          <input 
                            type="text" 
                            placeholder="Nicho (ej. Cripto)"
                            value={params.niche}
                            onChange={e => setParams({...params, niche: e.target.value})}
                            className="w-full bg-slate-900 border border-slate-700 rounded-md py-2 pl-10 pr-3 text-sm focus:border-cyan-400 focus:outline-none placeholder:text-slate-600"
                          />
                        </div>
                        
                        <div className="relative">
                          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                          <input 
                            type="text" 
                            placeholder="País (ej. España)"
                            value={params.country}
                            onChange={e => setParams({...params, country: e.target.value})}
                            className="w-full bg-slate-900 border border-slate-700 rounded-md py-2 pl-10 pr-3 text-sm focus:border-cyan-400 focus:outline-none placeholder:text-slate-600"
                          />
                        </div>
                        <div className="relative">
                           <Music className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                           <input 
                             type="text" 
                             placeholder="Estilo Musical (Opcional)"
                             value={params.musicStyle}
                             onChange={e => setParams({...params, musicStyle: e.target.value})}
                             className="w-full bg-slate-900 border border-slate-700 rounded-md py-2 pl-10 pr-3 text-sm focus:border-cyan-400 focus:outline-none placeholder:text-slate-600"
                           />
                        </div>
                      </>
                    ) : (
                      <div className="relative">
                          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">@</div>
                          <input 
                            type="text" 
                            placeholder="Usuario Fuente"
                            value={params.sourceUsername}
                            onChange={e => setParams({...params, sourceUsername: e.target.value})}
                            className="w-full bg-slate-900 border border-slate-700 rounded-md py-2 pl-8 pr-3 text-sm focus:border-cyan-400 focus:outline-none placeholder:text-slate-600"
                          />
                        </div>
                    )}

                    <div className="relative mt-2">
                      <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                      <select
                        value={params.contactNature}
                        onChange={e => setParams({...params, contactNature: e.target.value})}
                        className="w-full bg-slate-900 border border-slate-700 rounded-md py-2 pl-10 pr-3 text-sm focus:border-cyan-400 focus:outline-none appearance-none text-slate-300"
                      >
                          <option value="Medios y Prensa">Medios y Prensa</option>
                          <option value="Negocios Digitales">Negocios Digitales</option>
                          <option value="Artistas y Creadores">Artistas y Creadores</option>
                          <option value="Productores">Productores</option>
                          <option value="Prospectos de Agencia">Prospectos de Agencia</option>
                          <option value="Inversión / Capital">Inversión / Capital</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2 border-t border-slate-800">
                    <div>
                      <label className="text-[10px] text-slate-500 mb-1 block">Cantidad (N)</label>
                      <select 
                        value={params.resultsCount}
                        onChange={e => setParams({...params, resultsCount: parseInt(e.target.value)})}
                        className="w-full bg-slate-900 border border-slate-700 rounded-md py-2 px-3 text-sm focus:border-cyan-400 focus:outline-none"
                      >
                        <option value={10}>10 Perfiles</option>
                        <option value={20}>20 Perfiles</option>
                        <option value={50}>50 Perfiles</option>
                        <option value={100}>100 Perfiles</option>
                      </select>
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={status === AppStatus.Scraping || status === AppStatus.Classifying}
                    className={`w-full py-3 rounded-md font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-lg ${
                      status === AppStatus.Scraping || status === AppStatus.Classifying
                        ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-cyan-900/50'
                    }`}
                  >
                    {status === AppStatus.Scraping ? (
                      <>
                        <Loader2 className="animate-spin" size={16} /> EXTRAYENDO (NODE.JS)...
                      </>
                    ) : status === AppStatus.Classifying ? (
                      <>
                        <Bot className="animate-pulse" size={16} /> CLASIFICANDO (AI)...
                      </>
                    ) : (
                      <>
                        <Play size={16} /> INICIAR
                      </>
                    )}
                  </button>

                  {/* UPLOAD BUTTON FOR SCRAPER */}
                  <div className="pt-2 border-t border-slate-800">
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept=".csv, .doc"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700 rounded-md text-xs flex items-center justify-center gap-2 transition-colors"
                    >
                      <UploadCloud size={14} /> Cargar Sesión Anterior (.CSV/DOC)
                    </button>
                  </div>
                  
                  {profiles.length > 0 && (
                    <button 
                      type="button" 
                      onClick={clearData}
                      className="w-full py-2 rounded-md font-medium text-xs text-slate-400 hover:text-red-400 hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-colors"
                    >
                      LIMPIAR DATOS
                    </button>
                  )}
                </form>
              </div>

              {/* Console Log Area */}
              <div className="h-48 bg-black border-t border-slate-800 p-3 font-mono text-[10px] text-green-400 overflow-y-auto">
                <div className="flex items-center gap-2 text-slate-500 mb-2 pb-1 border-b border-slate-900">
                  <Terminal size={12} /> SYSTEM_LOGS (Node.js Worker)
                </div>
                <div className="space-y-1">
                  {logs.length === 0 && <span className="text-slate-700 opacity-50">Worker idle. Waiting for jobs...</span>}
                  {logs.map((log, i) => (
                    <div key={i} className="opacity-90">{log}</div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-900 relative">
              <header className="flex-none h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur-sm z-20">
                <div className="flex items-center gap-6">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase text-slate-500 font-bold tracking-widest">Leads</span>
                    <span className="text-xl font-mono text-white">{stats.total}</span>
                  </div>
                  <div className="h-8 w-px bg-slate-800" />
                  <div className="flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1 text-emerald-400"><Users size={12} /> Biz: {stats.business}</span>
                    <span className="flex items-center gap-1 text-purple-400"><Activity size={12} /> Media: {stats.media}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={() => ExportManager.copyToClipboard(profiles)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors" title="Copiar"><Copy size={18} /></button>
                  <button onClick={() => ExportManager.downloadCSV(profiles, params.mode === 'followers' ? `Seguidores_de_${params.sourceUsername}` : params.niche)} className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-md transition-colors" title="CSV"><FileSpreadsheet size={18} /></button>
                  <button onClick={() => ExportManager.downloadHTML(profiles, params.mode === 'followers' ? `Seguidores_de_${params.sourceUsername}` : params.niche)} className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-md transition-colors" title="Word"><FileText size={18} /> </button>
                    {profiles.length > 0 && (
                      <>
                        <div className="h-6 w-px bg-slate-800 mx-1" />
                        <button onClick={handleTransferToCampaign} className="flex items-center gap-2 px-3 py-1.5 bg-cyan-900/40 hover:bg-cyan-900/60 text-cyan-400 text-xs rounded-md border border-cyan-500/30 transition-colors font-medium animate-in fade-in">
                          <Mail size={14} /> Crear Campaña <ArrowRight size={12} />
                        </button>
                      </>
                    )}
                </div>
              </header>

              {(status === AppStatus.Scraping || status === AppStatus.Classifying || (status === AppStatus.Completed && progress > 0)) && (
                <div className="flex-none w-full bg-slate-950 h-1.5 relative overflow-hidden">
                  <div className={`absolute top-0 left-0 h-full shadow-[0_0_15px_rgba(34,211,238,0.6)] transition-all duration-300 ease-out ${status === AppStatus.Scraping ? 'bg-amber-500' : 'bg-cyan-500'}`} style={{ width: `${progress}%` }} />
                </div>
              )}

              <div className="flex-1 overflow-auto p-6 relative">
                {error && (
                  <div className="mb-6 p-4 bg-red-900/20 border border-red-500/50 rounded-lg flex items-center gap-3 text-red-200 text-sm">
                    <AlertCircle size={20} />
                    {error}
                  </div>
                )}
                {profiles.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600">
                    <div className="w-24 h-24 rounded-full bg-slate-800/50 flex items-center justify-center mb-4 relative">
                      {params.mode === 'niche' ? <Search size={40} className="opacity-20" /> : <UserPlus size={40} className="opacity-20" />}
                      {(status === AppStatus.Scraping || status === AppStatus.Classifying) && (
                          <div className={`absolute inset-0 border-2 rounded-full animate-spin ${status === AppStatus.Scraping ? 'border-amber-500/30 border-t-amber-500' : 'border-cyan-500/30 border-t-cyan-500'}`}></div>
                      )}
                    </div>
                    <p className="text-lg font-medium">
                        {status === AppStatus.Scraping ? 'Fase 1: Extracción Mecánica (Puppeteer)' : 
                        status === AppStatus.Classifying ? 'Fase 2: Clasificación Generativa (AI)' :
                        params.mode === 'niche' ? 'Modo Búsqueda por Nicho' : 'Modo Extracción de Seguidores'}
                    </p>
                    <p className="text-sm max-w-md text-center mt-2 opacity-60">
                      {status !== AppStatus.Idle ? 'Procesando arquitectura híbrida...' : 
                        "Utiliza el panel izquierdo para comenzar la prospección."
                      }
                    </p>
                  </div>
                ) : (
                  <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-900 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                            <th className="p-4 font-semibold">Perfil</th>
                            <th className="p-4 font-semibold">Categoría (IA)</th>
                            <th className="p-4 font-semibold text-right">Seguidores</th>
                            <th className="p-4 font-semibold">Contacto (Regex)</th>
                            <th className="p-4 font-semibold">Relevancia</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {profiles.map((profile) => (
                            <tr key={profile.id} className="hover:bg-slate-900/50 transition-colors group animate-in fade-in slide-in-from-bottom-2 duration-300">
                              <td className="p-4">
                                <div className="flex flex-col">
                                  <span className="font-bold text-slate-200">@{profile.username}</span>
                                  <span className="text-xs text-slate-500">{profile.fullName}</span>
                                  {profile.externalUrl && <a href={profile.externalUrl.startsWith('http') ? profile.externalUrl : `https://${profile.externalUrl}`} target="_blank" rel="noreferrer" className="text-[10px] text-cyan-600 hover:text-cyan-400 mt-1 truncate max-w-[150px]">{profile.externalUrl}</a>}
                                </div>
                              </td>
                              <td className="p-4">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-medium border ${profile.category === LeadCategory.MediaPress ? 'bg-purple-900/30 text-purple-400 border-purple-800' : profile.category === LeadCategory.DigitalBusiness ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800' : profile.category === LeadCategory.Investment ? 'bg-amber-900/30 text-amber-400 border-amber-800' : profile.category === LeadCategory.Irrelevant ? 'bg-slate-800 text-slate-500 border-slate-700' : 'bg-cyan-900/30 text-cyan-400 border-cyan-800'}`}>{profile.category}</span>
                              </td>
                              <td className="p-4 text-right font-mono text-sm text-slate-300">{profile.followerCount.toLocaleString()}</td>
                              <td className="p-4">
                                <div className="flex flex-col gap-1 text-xs">
                                    {profile.email ? <span className="text-slate-300 select-all">{profile.email}</span> : <span className="text-slate-600 italic">No email</span>}
                                    {profile.phone && <span className="text-slate-500 select-all">{profile.phone}</span>}
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${profile.relevanceScore > 80 ? 'bg-green-500' : profile.relevanceScore > 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${profile.relevanceScore}%` }} />
                                  </div>
                                  <span className="text-[10px] text-slate-500">{profile.relevanceScore}%</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </main>
        </div>
      </div>
    </div>
  );
}

export default App;