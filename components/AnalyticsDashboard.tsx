import React, { useEffect, useState } from 'react';
import { Campaign, RecipientStats } from '../types';
import { PersistenceService } from '../services/persistenceService';
import { analyzeCampaignPerformance } from '../services/geminiService';
import { BarChart, Activity, Mail, Eye, AlertCircle, RefreshCw, Zap, Search } from 'lucide-react';

export const AnalyticsDashboard: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [simulationActive, setSimulationActive] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const data = PersistenceService.getCampaigns();
    setCampaigns(data);
    if (!selectedCampaign && data.length > 0) {
      setSelectedCampaign(data[0]);
    } else if (selectedCampaign) {
      // Refresh selected campaign data
      const updated = data.find(c => c.id === selectedCampaign.id);
      if (updated) setSelectedCampaign(updated);
    }
  };

  // Simulates tracking pixel activity for demonstration
  const toggleSimulation = () => {
    if (simulationActive) {
      setSimulationActive(false);
      return;
    }
    
    setSimulationActive(true);
    const interval = setInterval(() => {
      if (!selectedCampaign) return;
      
      PersistenceService.simulateOpen(selectedCampaign.id);
      loadData(); // Trigger UI refresh

      // Stop randomly
      if (Math.random() > 0.9) {
        clearInterval(interval);
        setSimulationActive(false);
      }
    }, 1500);
  };

  const handleAIAnalysis = async () => {
    if (!selectedCampaign) return;
    setAnalyzing(true);
    try {
      const advice = await analyzeCampaignPerformance(selectedCampaign);
      PersistenceService.updateAnalysis(selectedCampaign.id, advice);
      loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setAnalyzing(false);
    }
  };

  if (campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500">
        <Activity size={48} className="mb-4 opacity-50" />
        <h2 className="text-xl font-bold text-slate-300">Sin Datos de Campaña</h2>
        <p className="text-sm">Envía tu primera campaña para ver métricas en tiempo real.</p>
      </div>
    );
  }

  const activeStats = selectedCampaign?.stats || { totalSent: 0, delivered: 0, uniqueOpens: 0 };
  const openRate = activeStats.totalSent > 0 ? (activeStats.uniqueOpens / activeStats.totalSent) * 100 : 0;
  
  // Get recent opens
  const recentOpens = selectedCampaign?.recipients
    .filter(r => r.status === 'opened')
    .sort((a, b) => (b.lastOpenAt && a.lastOpenAt ? new Date(b.lastOpenAt).getTime() - new Date(a.lastOpenAt).getTime() : 0))
    .slice(0, 10) || [];

  return (
    <div className="flex h-full bg-slate-900 overflow-hidden">
      
      {/* Sidebar List */}
      <div className="w-80 border-r border-slate-800 bg-slate-950 flex flex-col">
        <div className="p-4 border-b border-slate-800">
           <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
             <BarChart size={16} /> Historial
           </h2>
        </div>
        <div className="overflow-y-auto flex-1 p-2 space-y-2">
           {campaigns.map(c => (
             <button
               key={c.id}
               onClick={() => setSelectedCampaign(c)}
               className={`w-full text-left p-3 rounded-lg transition-all border ${
                 selectedCampaign?.id === c.id 
                 ? 'bg-slate-800 border-cyan-500/50 shadow-lg shadow-cyan-900/10' 
                 : 'bg-transparent border-transparent hover:bg-slate-900 hover:border-slate-800'
               }`}
             >
               <div className="text-xs font-semibold text-slate-200 truncate">{c.subject}</div>
               <div className="flex justify-between items-center mt-2 text-[10px] text-slate-500">
                 <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                 <span className={`${c.stats.uniqueOpens > 0 ? 'text-green-400' : 'text-slate-600'}`}>
                   {((c.stats.uniqueOpens / c.stats.totalSent) * 100).toFixed(0)}% Open
                 </span>
               </div>
             </button>
           ))}
        </div>
      </div>

      {/* Main Dashboard */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedCampaign && (
          <>
            <header className="flex-none p-6 border-b border-slate-800 bg-slate-900/50 backdrop-blur flex justify-between items-center">
               <div>
                 <div className="flex items-center gap-2 mb-1">
                   <span className="bg-cyan-900/30 text-cyan-400 border border-cyan-800 px-2 py-0.5 rounded text-[10px] uppercase font-bold">
                     {selectedCampaign.category}
                   </span>
                   <span className="text-xs text-slate-500">{new Date(selectedCampaign.createdAt).toLocaleString()}</span>
                 </div>
                 <h1 className="text-xl font-bold text-white">{selectedCampaign.subject}</h1>
               </div>
               
               <div className="flex gap-2">
                 <button 
                   onClick={toggleSimulation}
                   className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all border ${
                     simulationActive 
                     ? 'bg-green-900/30 text-green-400 border-green-500/50 animate-pulse' 
                     : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'
                   }`}
                 >
                   <RefreshCw size={14} className={simulationActive ? 'animate-spin' : ''} />
                   {simulationActive ? 'SIMULANDO TRÁFICO...' : 'SIMULAR OPEN TRACKING'}
                 </button>
               </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* KPI Cards */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl relative overflow-hidden group">
                  <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Mail size={64} className="text-blue-500" />
                  </div>
                  <p className="text-xs text-slate-500 font-bold uppercase">Enviados (Delivery)</p>
                  <p className="text-3xl font-mono text-white mt-1">{activeStats.totalSent}</p>
                  <p className="text-[10px] text-green-400 mt-2 flex items-center gap-1">
                    <Zap size={10} /> 100% Delivery Rate
                  </p>
                </div>

                <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl relative overflow-hidden group">
                   <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Eye size={64} className="text-purple-500" />
                  </div>
                  <p className="text-xs text-slate-500 font-bold uppercase">Aperturas Únicas</p>
                  <p className="text-3xl font-mono text-white mt-1">{activeStats.uniqueOpens}</p>
                  <p className="text-[10px] text-slate-500 mt-2">
                    Total Raw Opens: <span className="text-slate-300">{activeStats.totalOpens}</span>
                  </p>
                </div>

                <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl relative overflow-hidden group">
                  <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Activity size={64} className={openRate > 20 ? "text-green-500" : "text-amber-500"} />
                  </div>
                  <p className="text-xs text-slate-500 font-bold uppercase">Open Rate</p>
                  <p className={`text-3xl font-mono mt-1 ${openRate > 20 ? 'text-green-400' : openRate > 10 ? 'text-amber-400' : 'text-red-400'}`}>
                    {openRate.toFixed(1)}%
                  </p>
                  <div className="w-full h-1 bg-slate-800 rounded-full mt-3 overflow-hidden">
                    <div 
                      className={`h-full ${openRate > 20 ? 'bg-green-500' : 'bg-amber-500'}`} 
                      style={{ width: `${Math.min(openRate, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* AI Analysis Section */}
              <div className="bg-gradient-to-r from-slate-900 to-slate-950 border border-slate-800 rounded-xl p-5 shadow-xl">
                 <div className="flex justify-between items-start mb-3">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Search className="text-cyan-400" size={16} /> Análisis de IA Generativa
                    </h3>
                    <button 
                      onClick={handleAIAnalysis}
                      disabled={analyzing}
                      className="text-xs bg-slate-800 hover:bg-slate-700 text-cyan-400 px-3 py-1 rounded transition-colors"
                    >
                      {analyzing ? 'Analizando...' : 'Analizar Rendimiento'}
                    </button>
                 </div>
                 
                 {selectedCampaign.aiAnalysis ? (
                   <p className="text-sm text-slate-300 leading-relaxed font-light border-l-2 border-cyan-500 pl-4">
                     {selectedCampaign.aiAnalysis}
                   </p>
                 ) : (
                   <p className="text-xs text-slate-600 italic">
                     Solicita a la IA que interprete tus métricas para obtener consejos de mejora.
                   </p>
                 )}
              </div>

              {/* Real Time Feed */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex-1 min-h-[300px]">
                <div className="p-4 border-b border-slate-800 bg-slate-900/30">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Feed en Tiempo Real (Últimas 10 aperturas)</h3>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-500 border-b border-slate-800">
                    <tr>
                      <th className="p-3">Destinatario</th>
                      <th className="p-3">Estado</th>
                      <th className="p-3 text-right">Hora</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {recentOpens.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="p-8 text-center text-slate-600 italic">
                          Esperando actividad de tracking...
                        </td>
                      </tr>
                    ) : (
                      recentOpens.map((r, idx) => (
                        <tr key={idx} className="animate-in fade-in slide-in-from-left-2">
                          <td className="p-3 font-mono text-slate-300">{r.email}</td>
                          <td className="p-3">
                             <span className="flex items-center gap-1 text-green-400 bg-green-900/20 px-2 py-0.5 rounded-full w-fit">
                               <Eye size={10} /> Abierto
                             </span>
                          </td>
                          <td className="p-3 text-right text-slate-500">
                            {r.lastOpenAt ? new Date(r.lastOpenAt).toLocaleTimeString() : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          </>
        )}
      </div>
    </div>
  );
};