import React, { useState, useRef } from 'react';
import { MechanicalService } from '../services/mechanicalService';
import { enrichMediaTalent } from '../services/geminiService';
import { ExportManager } from '../services/exportService';
import { ImportService } from '../services/importService';
import { Profile, MediaTalentSearchParams, AppStatus, MediaCategory } from '../types';
import { Mic2, Radio, Tv, Globe, Loader2, Play, Users, FileText, CheckCircle2, AlertTriangle, Download, Copy, RadioReceiver, Music, UploadCloud } from 'lucide-react';

export const MediaTalentView: React.FC = () => {
  const [params, setParams] = useState<MediaTalentSearchParams>({
    country: '',
    role: '',
    languageAccent: 'Español Neutro',
    musicGenre: '',
    resultsCount: 10
  });

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [status, setStatus] = useState<AppStatus>(AppStatus.Idle);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addLog = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!params.country || !params.role) {
      setError("Por favor define el País/Ciudad y el Rol Profesional.");
      return;
    }
    
    setProfiles([]);
    setStatus(AppStatus.Scraping);
    setProgress(10);
    setError(null);
    setLogs([]);
    addLog(`Iniciando MEDIA TALENT ENGINE para: ${params.role} en ${params.country}`);
    if (params.musicGenre) addLog(`Filtro de Afinidad Musical: ${params.musicGenre}`);

    try {
      // Phase 1: Mechanical (Node.js/Puppeteer)
      addLog(">> FASE 1: Búsqueda Heurística (Backend Node.js)...");
      addLog(`Dorks: "${params.role}" + "Booking" ${params.musicGenre ? `+ "${params.musicGenre}"` : ''}`);
      
      const mechInterval = setInterval(() => setProgress(p => p < 45 ? p + 2 : p), 200);
      const rawProfiles = await MechanicalService.scrapeMediaTalent(params);
      clearInterval(mechInterval);
      
      setProgress(50);
      addLog(`✅ Extracción completada: ${rawProfiles.length} candidatos encontrados.`);
      addLog(`Detectando agencias y linktrees...`);

      // Phase 2: AI Enrichment (Gemini Reasoning)
      setStatus(AppStatus.Classifying);
      addLog(">> FASE 2: Clasificación de Talento (Gemini Reasoning)...");
      addLog(`Evaluando afinidad cultural con: ${params.musicGenre || 'General'}...`);
      
      // Pass the genre as context for AI reasoning
      const enriched = await enrichMediaTalent(rawProfiles, params.musicGenre);
      
      setProfiles(enriched);
      setProgress(100);
      setStatus(AppStatus.Completed);
      addLog("✅ Proceso finalizado. Ready for export.");

    } catch (err: any) {
      setError(err.message);
      setStatus(AppStatus.Error);
      addLog(`ERROR: ${err.message}`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    addLog(`📂 Leyendo archivo media: ${file.name}...`);
    setError(null);
    setStatus(AppStatus.Idle);

    try {
      const importedProfiles = await ImportService.parseFile(file);
      setProfiles(importedProfiles);
      addLog(`✅ Importación exitosa: ${importedProfiles.length} perfiles cargados.`);
      setStatus(AppStatus.Completed);
    } catch (err: any) {
      setError(err.message);
      setStatus(AppStatus.Error);
      addLog(`❌ Error de importación: ${err.message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExport = () => {
      const genreSuffix = params.musicGenre ? `_${params.musicGenre.replace(/\s/g, '')}` : '';
      const filename = `TalentReport_${params.country.replace(/\s/g, '')}_${params.role.replace(/\s/g, '')}${genreSuffix}`;
      ExportManager.downloadHTML(profiles, filename);
  };

  const stats = {
    total: profiles.length,
    valid: profiles.filter(p => p.relevanceScore > 40).length,
    agencies: profiles.filter(p => p.email && !p.email.includes('gmail') && !p.email.includes('hotmail')).length
  };

  return (
    <div className="flex h-full bg-indigo-950 text-blue-100 font-sans overflow-hidden">
      
      {/* SIDEBAR CONFIG */}
      <aside className="w-80 border-r border-indigo-900 flex flex-col h-full bg-indigo-950/50 backdrop-blur-sm z-10 shadow-2xl">
        <div className="p-6 border-b border-indigo-900 bg-indigo-900/30">
          <h1 className="text-xl font-bold text-white flex items-center gap-2 tracking-tight">
            <Mic2 className="text-blue-400" /> MEDIA OSINT
          </h1>
          <p className="text-[10px] text-blue-300 mt-1 uppercase tracking-widest font-mono">Talent Discovery Engine</p>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          <form onSubmit={handleSearch} className="space-y-6">
            
            <div className="space-y-4">
              <label className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                <Globe size={12} /> Target Market (País / Ciudad)
              </label>
              <input 
                type="text" 
                placeholder="País o Ciudad (ej. CDMX, España)"
                value={params.country}
                onChange={e => setParams({...params, country: e.target.value})}
                className="w-full bg-indigo-900/50 border border-indigo-700 rounded-md py-3 px-4 text-sm text-white focus:border-blue-400 focus:outline-none placeholder:text-indigo-400/50 transition-all shadow-inner"
              />
            </div>

            <div className="space-y-4">
              <label className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                <Radio size={12} /> Rol Profesional
              </label>
              <input 
                type="text" 
                placeholder="Ej. Locutor Comercial, Presentador, Podcast Host..."
                value={params.role}
                onChange={e => setParams({...params, role: e.target.value})}
                className="w-full bg-indigo-900/50 border border-indigo-700 rounded-md py-3 px-4 text-sm text-white focus:border-blue-400 focus:outline-none placeholder:text-indigo-400/50 transition-all shadow-inner"
              />
            </div>

            <div className="space-y-4">
               <label className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                <Music size={12} /> Género Musical (Opcional)
              </label>
               <input 
                type="text" 
                placeholder="ej. Urbano, Rock, Pop, Regional"
                value={params.musicGenre || ''}
                onChange={e => setParams({...params, musicGenre: e.target.value})}
                className="w-full bg-indigo-900/50 border border-indigo-700 rounded-md py-3 px-4 text-sm text-white focus:border-blue-400 focus:outline-none placeholder:text-indigo-400/50 transition-all shadow-inner"
              />
              <p className="text-[10px] text-blue-300/60 leading-tight">
                Filtra locutores/hosts afines al estilo musical que promocionas (Evaluado por IA).
              </p>
            </div>

            <div className="space-y-4">
               <label className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                <Mic2 size={12} /> Idioma
              </label>
               <input 
                type="text" 
                placeholder="Español"
                value={params.languageAccent}
                onChange={e => setParams({...params, languageAccent: e.target.value})}
                className="w-full bg-indigo-900/50 border border-indigo-700 rounded-md py-3 px-4 text-sm text-white focus:border-blue-400 focus:outline-none placeholder:text-indigo-400/50 transition-all shadow-inner"
              />
            </div>

            <button 
              type="submit" 
              disabled={status === AppStatus.Scraping || status === AppStatus.Classifying}
              className={`w-full py-4 rounded-md font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg border border-transparent ${
                status !== AppStatus.Idle && status !== AppStatus.Completed && status !== AppStatus.Error
                  ? 'bg-indigo-800 text-indigo-400 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/50 hover:border-blue-400'
              }`}
            >
              {status === AppStatus.Scraping || status === AppStatus.Classifying ? (
                <Loader2 className="animate-spin" />
              ) : (
                <RadioReceiver size={18} />
              )}
              {status === AppStatus.Scraping ? 'SCANNING FREQUENCIES...' : 
               status === AppStatus.Classifying ? 'TUNING SIGNAL...' : 'INICIAR ESCANEO'}
            </button>
            
            {/* UPLOAD BUTTON */}
            <div className="pt-2 border-t border-indigo-800/50">
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
                    className="w-full py-2 bg-indigo-900/50 hover:bg-indigo-800 text-blue-300 hover:text-white border border-indigo-700 rounded-md text-xs flex items-center justify-center gap-2 transition-colors"
                >
                    <UploadCloud size={14} /> Cargar Sesión Anterior (.CSV/DOC)
                </button>
            </div>

          </form>
        </div>
        
        {/* LOGS CONSOLE - "MIDNIGHT STYLE" */}
        <div className="h-48 bg-black/40 border-t border-indigo-900 p-4 font-mono text-[10px] overflow-y-auto">
           {logs.length === 0 && <span className="text-indigo-500/50">System Standby...</span>}
           {logs.map((log, i) => (
             <div key={i} className="text-blue-400/80 mb-1 border-l-2 border-blue-900 pl-2">{log}</div>
           ))}
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col relative bg-gradient-to-br from-indigo-950 to-[#050b14]">
        
        {/* HEADER */}
        <header className="h-20 border-b border-indigo-900/50 bg-indigo-950/30 backdrop-blur-md flex items-center justify-between px-8 z-20">
           <div>
             <h2 className="text-2xl font-bold text-white tracking-tight">Resultados de Exploración</h2>
             <div className="flex items-center gap-4 text-xs text-blue-300/60 mt-1 font-mono">
                <span>TOTAL: {stats.total}</span>
                <span className="text-blue-400">AGENCY LEADS: {stats.agencies}</span>
                <span className="text-emerald-400">VERIFIED PROS: {stats.valid}</span>
             </div>
           </div>

           <div className="flex gap-3">
              <button 
                 onClick={() => ExportManager.copyToClipboard(profiles)}
                 className="p-3 bg-indigo-900/50 hover:bg-blue-900/50 text-blue-300 rounded-lg border border-indigo-700 hover:border-blue-500 transition-all"
                 title="Copiar al Portapapeles"
              >
                 <Copy size={20} />
              </button>
              <button 
                 onClick={handleExport}
                 disabled={profiles.length === 0}
                 className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                 <Download size={18} /> Exportar Reporte (.DOC)
              </button>
           </div>
        </header>

        {/* PROGRESS BAR */}
        {(status === AppStatus.Scraping || status === AppStatus.Classifying) && (
            <div className="w-full h-1 bg-indigo-950 relative overflow-hidden">
               <div 
                 className="absolute top-0 left-0 h-full bg-blue-500 shadow-[0_0_15px_#3b82f6]"
                 style={{ width: `${progress}%`, transition: 'width 0.3s ease-out' }}
               />
            </div>
        )}

        {/* TABLE AREA */}
        <div className="flex-1 overflow-auto p-8 relative">
           {error && (
             <div className="mb-6 p-4 bg-red-900/20 border border-red-500/50 rounded-lg flex items-center gap-3 text-red-200">
                <AlertTriangle /> {error}
             </div>
           )}

           {profiles.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center text-indigo-500/30">
                <Mic2 size={80} strokeWidth={1} />
                <p className="mt-4 text-xl font-light text-indigo-400">Esperando señal...</p>
                <p className="text-sm">Configura los parámetros de búsqueda en el panel izquierdo.</p>
             </div>
           ) : (
             <div className="grid gap-4">
                {profiles.map((p) => {
                  const isFan = p.category === MediaCategory.FanAccount;
                  const isAgency = p.email && !p.email.includes('gmail') && !p.email.includes('hotmail');
                  
                  return (
                    <div key={p.id} className={`
                       relative p-5 rounded-xl border transition-all duration-300 group
                       ${isFan ? 'bg-red-900/10 border-red-900/30 opacity-60' : 'bg-indigo-900/20 border-indigo-800 hover:bg-indigo-800/30 hover:border-blue-500/50'}
                    `}>
                       {/* Relevance Indicator */}
                       <div className="absolute right-5 top-5 flex flex-col items-end">
                          <div className={`text-2xl font-mono font-bold ${p.relevanceScore > 75 ? 'text-blue-400' : 'text-indigo-500'}`}>
                             {p.relevanceScore}%
                          </div>
                          <span className="text-[10px] text-indigo-400 uppercase tracking-wider">Relevance</span>
                       </div>

                       <div className="flex items-start gap-5">
                          {/* Avatar Placeholder */}
                          <div className="w-16 h-16 rounded-full bg-indigo-950 border-2 border-indigo-800 flex items-center justify-center text-indigo-600 font-bold text-xl shrink-0">
                             {p.username.substring(0,2).toUpperCase()}
                          </div>

                          <div className="flex-1 min-w-0">
                             <div className="flex items-center gap-3">
                                <h3 className="text-lg font-bold text-white truncate">@{p.username}</h3>
                                {isFan ? (
                                   <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-900/40 text-red-400 border border-red-900">FAN / PARODY</span>
                                ) : (
                                   <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-900/40 text-blue-300 border border-blue-800">{p.category}</span>
                                )}
                             </div>
                             
                             <p className="text-sm text-indigo-300 mt-1 truncate">{p.fullName}</p>
                             
                             {!isFan && (
                                <div className="mt-3 flex items-center gap-4 text-xs font-mono">
                                   <div className="flex items-center gap-1.5 text-blue-200 bg-blue-900/20 px-2 py-1 rounded">
                                      <Tv size={12} /> {p.mediaOutlet}
                                   </div>
                                   <div className="flex items-center gap-1.5 text-indigo-300">
                                      <Users size={12} /> {p.followerCount.toLocaleString()}
                                   </div>
                                </div>
                             )}

                             {/* Contact Info */}
                             <div className="mt-4 pt-3 border-t border-indigo-800/50 flex flex-wrap gap-4 text-xs">
                                {p.email ? (
                                   <span className={`flex items-center gap-2 ${isAgency ? 'text-emerald-400 font-bold' : 'text-slate-300'}`}>
                                      {isAgency && <CheckCircle2 size={12} />}
                                      {p.email}
                                   </span>
                                ) : (
                                   <span className="text-indigo-600 italic">Email no público</span>
                                )}
                                {p.phone && <span className="text-slate-400">{p.phone}</span>}
                                {p.externalUrl && <a href={p.externalUrl} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">{p.externalUrl}</a>}
                             </div>
                          </div>
                       </div>
                    </div>
                  );
                })}
             </div>
           )}
        </div>
      </main>

    </div>
  );
};