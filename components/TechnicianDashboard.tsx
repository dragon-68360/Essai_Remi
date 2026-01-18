import React, { useState, useEffect, useMemo } from 'react';
import { User, Mission, WeekSelection, MissionType, MissionStatus } from '../types';
import { getWeekDates, formatFrenchDate, isSunday } from '../utils';
import { ChevronLeft, ChevronRight, Save, Send, AlertCircle, Clock, Calendar, Moon, Info, CheckSquare, Square, List, LayoutGrid, MapPin, ShieldCheck as ShieldCheckIcon, MessageSquare, Map as MapIcon, Ban } from 'lucide-react';
import { JOB_NUMBER_REGEX } from '../constants';
import { format, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Props {
  user: User;
  missions: Mission[];
  week: WeekSelection;
  onWeekChange: (w: WeekSelection) => void;
  onUpdateMissions: (m: Mission[]) => void;
}

const TechnicianDashboard: React.FC<Props> = ({ user, missions, week, onWeekChange, onUpdateMissions }) => {
  const dates = getWeekDates(week.year, week.weekNumber);
  const [localMissions, setLocalMissions] = useState<Mission[]>([]);
  const [viewMode, setViewMode] = useState<'LIST' | 'CALENDAR'>('LIST');

  useEffect(() => {
    const weekMissions = missions.filter(m => 
      m.technicianId === user.id && 
      dates.some(d => isSameDay(new Date(m.date), d))
    );

    const syncedMissions: Mission[] = [];
    dates.forEach(date => {
      const dateStr = date.toISOString();
      const existing = weekMissions.filter(m => isSameDay(new Date(m.date), date));
      
      syncedMissions.push(existing[0] || {
        id: `m-${user.id}-${dateStr}-1`,
        date: dateStr,
        jobNumber: '',
        hours: 0,
        type: MissionType.WORK,
        status: MissionStatus.PENDING,
        technicianId: user.id,
        managerInitials: '',
        igd: false,
        description: '',
        address: ''
      });

      syncedMissions.push(existing[1] || {
        id: `m-${user.id}-${dateStr}-2`,
        date: dateStr,
        jobNumber: '',
        hours: 0,
        type: MissionType.WORK,
        status: MissionStatus.PENDING,
        technicianId: user.id,
        managerInitials: '',
        igd: false,
        description: '',
        address: ''
      });
    });

    setLocalMissions(syncedMissions);
  }, [week, missions, user.id]);

  const totalHours = useMemo(() => localMissions.reduce((acc, m) => acc + m.hours, 0), [localMissions]);

  const isWeekValidated = localMissions.every(m => m.status === MissionStatus.VALIDATED);
  const isWeekSubmitted = localMissions.some(m => m.status === MissionStatus.SUBMITTED);
  const isWeekRejected = localMissions.some(m => m.status === MissionStatus.REJECTED);

  const canEdit = !isWeekValidated && !isWeekSubmitted;

  const handleChange = (id: string, field: keyof Mission, value: any) => {
    if (!canEdit) return;
    setLocalMissions(prev => prev.map(m => {
      if (m.id === id) {
        const updated = { ...m, [field]: value };
        if (field === 'type' && value !== MissionType.WORK) {
          updated.hours = 0;
          updated.jobNumber = '';
          updated.managerInitials = '';
          updated.igd = false;
          updated.description = '';
          updated.address = '';
        }
        if (field === 'jobNumber' && typeof value === 'string') {
          const match = value.match(/^([A-Z]{2})/);
          if (match) updated.managerInitials = match[1];
        }
        if (updated.status === MissionStatus.REJECTED) {
            updated.status = MissionStatus.PENDING;
        }
        return updated;
      }
      return m;
    }));
  };

  const handleSave = () => {
    onUpdateMissions(localMissions);
    alert('Brouillon enregistré avec succès.');
  };

  const handleSubmit = () => {
    const submitted = localMissions.map(m => ({
      ...m,
      status: MissionStatus.SUBMITTED
    }));
    onUpdateMissions(submitted);
    alert('Semaine envoyée pour validation.');
  };

  const prevWeek = () => {
    if (week.weekNumber === 1) onWeekChange({ year: week.year - 1, weekNumber: 52 });
    else onWeekChange({ year: week.year, weekNumber: week.weekNumber - 1 });
  };

  const nextWeek = () => {
    if (week.weekNumber === 52) onWeekChange({ year: week.year + 1, weekNumber: 1 });
    else onWeekChange({ year: week.year, weekNumber: week.weekNumber + 1 });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Ma Saisie Hebdomadaire</h1>
          <p className="text-slate-500 text-sm">Renseignez vos interventions quotidiennes.</p>
        </div>
        <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
          <button onClick={() => setViewMode('LIST')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all ${viewMode === 'LIST' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><List size={16} /> Liste</button>
          <button onClick={() => setViewMode('CALENDAR')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all ${viewMode === 'CALENDAR' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><LayoutGrid size={16} /> Calendrier</button>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={prevWeek} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><ChevronLeft size={24} /></button>
          <div className="flex items-center gap-2 px-6 py-2 bg-blue-50 text-blue-700 rounded-xl font-bold border border-blue-100 min-w-[200px] justify-center"><Calendar size={18} /> Semaine {week.weekNumber} - {week.year}</div>
          <button onClick={nextWeek} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><ChevronRight size={24} /></button>
        </div>
      </div>

      {isWeekRejected && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-4 animate-in fade-in slide-in-from-top-2">
              <div className="bg-red-600 p-2 rounded-xl text-white shadow-lg"><Ban size={20}/></div>
              <div>
                  <h3 className="text-sm font-black text-red-800 uppercase tracking-widest">Saisie refusée par le chargé d'affaires</h3>
                  <p className="text-xs text-red-600 font-bold mt-1">Motif : {localMissions.find(m => m.rejectionComment)?.rejectionComment || "Non spécifié"}</p>
                  <p className="text-[10px] text-red-400 mt-2 italic">Veuillez corriger vos heures et renvoyer la semaine.</p>
              </div>
          </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {viewMode === 'LIST' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Jour</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Affaire & Info</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Heures</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">IGD</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Lieu</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dates.map((date) => {
                  const dayMissions = localMissions.filter(m => isSameDay(new Date(m.date), date));
                  const sun = isSunday(date);
                  return (
                    <React.Fragment key={date.toISOString()}>
                      {dayMissions.map((m, idx) => (
                        <tr key={m.id} className={`${sun ? 'bg-slate-100/80 grayscale opacity-60' : (idx === 0 ? 'bg-white' : 'bg-slate-50/30')} ${!sun && m.igd ? 'bg-purple-100/40 border-l-4 border-l-purple-500' : ''}`}>
                          {idx === 0 && (
                            <td rowSpan={2} className="px-6 py-4 align-top">
                              <div className="font-bold text-slate-800 capitalize text-sm">{formatFrenchDate(date)}</div>
                              <div className="text-[10px] text-slate-400">{format(date, 'dd/MM/yyyy')}</div>
                            </td>
                          )}
                          <td className="px-6 py-4 min-w-[200px]">
                            {sun ? <div className="text-slate-400 italic text-xs">Repos</div> : (
                              <div className="space-y-2">
                                <select value={m.type} disabled={!canEdit} onChange={(e) => handleChange(m.id, 'type', e.target.value)} className={`w-full p-2 rounded-lg border text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${m.igd ? 'border-purple-300 bg-purple-50' : 'border-slate-200'}`}>
                                  <option value={MissionType.WORK}>Chantier / Bureau</option>
                                  <option value={MissionType.LEAVE}>Congés</option>
                                  <option value={MissionType.SICK}>Maladie</option>
                                  <option value={MissionType.TRAINING}>Formation</option>
                                </select>
                                {m.type === MissionType.WORK && (
                                  <div className="flex flex-col gap-2">
                                    <input type="text" placeholder="RG-A23-1234" value={m.jobNumber} disabled={!canEdit} onChange={(e) => handleChange(m.id, 'jobNumber', e.target.value.toUpperCase())} className={`w-full p-2 rounded-lg border text-xs font-black focus:ring-2 focus:ring-blue-500 ${m.jobNumber && !JOB_NUMBER_REGEX.test(m.jobNumber) ? 'border-red-300 bg-red-50' : m.igd ? 'border-purple-300 bg-white shadow-sm' : 'border-slate-200'}`} />
                                    <div className={`flex items-center gap-2 px-2 py-1 rounded border ${m.igd ? 'bg-purple-200/50 border-purple-300' : 'bg-slate-50 border-slate-100'}`}>
                                      <MessageSquare size={12} className={m.igd ? 'text-purple-600' : 'text-slate-400'} />
                                      <input type="text" maxLength={20} placeholder="Info (20 car. max)" value={m.description || ''} disabled={!canEdit} onChange={(e) => handleChange(m.id, 'description', e.target.value)} className={`w-full bg-transparent text-[10px] font-medium outline-none ${m.igd ? 'placeholder:text-purple-400' : ''}`} />
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {!sun && m.type === MissionType.WORK ? <div className="flex items-center gap-1"><input type="number" step="0.5" value={m.hours || ''} disabled={!canEdit} onChange={(e) => handleChange(m.id, 'hours', parseFloat(e.target.value) || 0)} className={`w-16 p-2 rounded-lg border text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 ${m.igd ? 'border-purple-300 bg-white' : 'border-slate-200'}`} /><span className="text-slate-400 text-xs">h</span></div> : <span className="text-xs text-slate-400 italic">0h</span>}
                          </td>
                          <td className="px-6 py-4">
                            {!sun && m.type === MissionType.WORK && <button onClick={() => handleChange(m.id, 'igd', !m.igd)} disabled={!canEdit} className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-all ${m.igd ? 'bg-purple-600 border-purple-600 text-white shadow-md scale-110' : 'bg-white border-slate-200 text-slate-300'}`}>{m.igd ? <CheckSquare size={16} /> : <Square size={16} />}</button>}
                          </td>
                          <td className="px-6 py-4">
                            {!sun && m.type === MissionType.WORK && (
                              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border max-w-[150px] transition-colors ${m.igd ? 'bg-purple-100/50 border-purple-300' : 'bg-slate-50 border-slate-100'}`}>
                                <MapIcon size={12} className={m.igd ? 'text-purple-600' : 'text-blue-500'} />
                                <input type="text" placeholder="Adresse" value={m.address || ''} disabled={!canEdit} onChange={(e) => handleChange(m.id, 'address', e.target.value)} className="w-full bg-transparent text-[9px] font-medium outline-none truncate" />
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4">{!sun && <StatusBadge status={m.status} />}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full text-left border-separate border-spacing-0 table-fixed">
              <thead className="bg-slate-50">
                <tr>
                  <th className="w-48 px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-200 sticky left-0 z-20 bg-slate-50">Mon Profil</th>
                  {dates.map((date) => <th key={date.toISOString()} className={`px-4 py-4 text-[9px] font-black uppercase text-center border-r border-slate-200 ${isSunday(date) ? 'w-16 bg-slate-100 text-slate-300' : 'text-slate-500'}`}>{format(date, 'EEE d MMM', { locale: fr })}</th>)}
                  <th className="w-20 px-4 py-4 text-[9px] font-black text-slate-400 uppercase text-center">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="group hover:bg-slate-50/50">
                  <td className="px-6 py-4 border-r border-slate-200 bg-white sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                    <div className="flex items-center gap-3">
                      {user.avatarUrl ? <img src={user.avatarUrl} alt={user.name} className="w-8 h-8 rounded-lg object-cover border border-slate-100" /> : <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-black text-[10px]">{user.initials}</div>}
                      <span className="text-[11px] font-black text-slate-700 truncate">{user.name}</span>
                    </div>
                  </td>
                  {dates.map((date) => {
                    const dayMissions = localMissions.filter(m => isSameDay(new Date(m.date), date));
                    const sun = isSunday(date);
                    return (
                      <td key={date.toISOString()} className={`p-1.5 border-r border-slate-100 align-top ${sun ? 'bg-slate-50/50' : ''}`}>
                        <div className="flex flex-col gap-1">
                          {dayMissions.map((m, idx) => (
                            m.type === MissionType.WORK && m.jobNumber ? (
                              <div key={m.id} className={`px-2 py-1.5 rounded-md text-[9px] font-black border truncate shadow-sm relative pr-6 transition-all duration-300 ${
                                m.status === MissionStatus.VALIDATED ? 'bg-green-50 text-green-700 border-green-200' : 
                                m.status === MissionStatus.SUBMITTED ? 'bg-orange-50 text-orange-700 border-orange-200' : 
                                m.status === MissionStatus.REJECTED ? 'bg-red-50 text-red-700 border-red-200' : 
                                m.igd ? 'bg-purple-100 text-purple-900 border-purple-400 shadow-md ring-1 ring-purple-500/20' : 
                                'bg-blue-50 text-blue-700 border-blue-200'
                              }`}>
                                {m.jobNumber}
                                <div className={`text-[8px] font-medium ${m.igd ? 'text-purple-800' : 'opacity-70'}`}>{m.hours}h</div>
                                {m.description && <div className={`text-[7px] font-medium truncate italic ${m.igd ? 'text-purple-600/80' : 'text-slate-400'}`}>{m.description}</div>}
                                {/* Removed invalid title prop from MapPin icon to fix TypeScript error */}
                                {m.igd && <MapPin size={10} className="absolute top-1 right-1 text-purple-700 animate-bounce" />}
                              </div>
                            ) : (m.type !== MissionType.WORK && idx === 0 ? <div key={m.id} className="px-2 py-1 rounded-md text-[8px] font-black bg-slate-100 text-slate-400 border border-slate-200 uppercase text-center">{m.type}</div> : null)
                          ))}
                          {dayMissions.every(m => !m.jobNumber && m.type === MissionType.WORK) && !sun && <div className="h-6 rounded-md bg-slate-50/50 border border-dashed border-slate-200"></div>}
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-4 py-4 text-center text-xs font-black text-slate-800 bg-slate-50/30">{totalHours}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-4 p-6 bg-slate-900 rounded-2xl text-white shadow-lg sticky bottom-8">
        <div className="mr-auto flex items-center gap-3 text-slate-400 text-sm"><Clock size={20} className="text-blue-400" /><span>Total de la semaine: </span><span className="text-white font-bold text-lg">{totalHours} h</span></div>
        {canEdit && (<><button onClick={handleSave} className="flex items-center gap-2 px-6 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all font-semibold border border-slate-700"><Save size={18} />Brouillon</button><button onClick={handleSubmit} className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl transition-all font-semibold shadow-lg shadow-blue-900/20"><Send size={18} />Envoyer</button></>)}
        {isWeekSubmitted && !isWeekValidated && (<div className="flex items-center gap-3 text-orange-400 bg-orange-400/10 px-4 py-2 rounded-xl border border-orange-400/20"><AlertCircle size={20} /><span className="font-semibold text-sm">En attente de validation</span></div>)}
        {isWeekValidated && (<div className="flex items-center gap-3 text-green-400 bg-green-400/10 px-4 py-2 rounded-xl border border-green-400/20"><ShieldCheckIcon size={20} /><span className="font-semibold text-sm">Semaine validée</span></div>)}
      </div>
    </div>
  );
};

const StatusBadge: React.FC<{ status: MissionStatus }> = ({ status }) => {
  switch (status) {
    case MissionStatus.PENDING: return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">Brouillon</span>;
    case MissionStatus.SUBMITTED: return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">Envoyé</span>;
    case MissionStatus.VALIDATED: return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Validé</span>;
    case MissionStatus.REJECTED: return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Refusé</span>;
    default: return null;
  }
};

export default TechnicianDashboard;