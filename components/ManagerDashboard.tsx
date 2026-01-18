
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { User, Mission, MissionStatus, WeekSelection, MissionType } from '../types';
import { JOB_NUMBER_REGEX } from '../constants';
import { getCurrentWeekInfo, getWeekDates, isSunday } from '../utils';
import { Plus, X, List, LayoutGrid, MapPin, Copy, Clipboard, Map as MapIcon, ChevronLeft, ChevronRight, Ban, Minus, ShieldCheck, Navigation, CheckCircle, Move, Loader2, AlertCircle, Info, Trash2, Edit, RefreshCw } from 'lucide-react';
import { isSameDay, format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

declare const L: any;

interface Props {
  user: User;
  missions: Mission[];
  technicians: User[];
  onUpdateMissions: (m: Mission[] | { removeId: string }) => void;
}

const DEFAULT_ADDRESS = "27 Av. ZAC de Chassagne, 69360 Ternay, France";

const ManagerDashboard: React.FC<Props> = ({ user, missions, technicians, onUpdateMissions }) => {
  const [selectedWeek, setSelectedWeek] = useState<WeekSelection>(getCurrentWeekInfo());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOnlyMine, setFilterOnlyMine] = useState(false); 
  const [viewMode, setViewMode] = useState<'LIST' | 'CALENDAR' | 'MAP'>('CALENDAR');
  const [isAddingMission, setIsAddingMission] = useState(false);
  const [editingMissionId, setEditingMissionId] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<Mission | null>(null);
  const [draggedMissionId, setDraggedMissionId] = useState<string | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{techId: string, date: string} | null>(null);
  const [geocodingStatus, setGeocodingStatus] = useState({ current: 0, total: 0, active: false });
  
  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersLayerRef = useRef<any>(null);

  const [missionForm, setMissionForm] = useState({
    technicianId: '',
    date: '',
    jobNumber: '',
    hours: 8,
    igd: false,
    description: '',
    address: DEFAULT_ADDRESS
  });

  const weekDates = getWeekDates(selectedWeek.year, selectedWeek.weekNumber);

  const relevantMissions = useMemo(() => {
    return missions.filter(m => {
      const isInWeek = weekDates.some(d => isSameDay(new Date(m.date), d));
      if (!isInWeek) return false;
      const matchesSearch = m.jobNumber.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           (m.description && m.description.toLowerCase().includes(searchTerm.toLowerCase()));
      if (!matchesSearch && searchTerm) return false;
      if (filterOnlyMine) return m.managerInitials === user.initials;
      return true;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [missions, selectedWeek, searchTerm, filterOnlyMine, user.initials, weekDates]);

  const technicianRows = useMemo(() => {
    return technicians.map(tech => {
      const techMissions = relevantMissions.filter(m => m.technicianId === tech.id);
      const totalHours = techMissions.reduce((sum, m) => sum + m.hours, 0);
      const isPending = techMissions.some(m => m.status === MissionStatus.SUBMITTED);
      const allValidated = techMissions.length > 0 && techMissions.every(m => m.status === MissionStatus.VALIDATED);
      const isRejected = techMissions.some(m => m.status === MissionStatus.REJECTED);

      return {
        ...tech,
        totalHours,
        status: allValidated ? 'VALIDATED' : isRejected ? 'REJECTED' : isPending ? 'SUBMITTED' : techMissions.length > 0 ? 'PENDING' : 'NO_DATA',
        missions: techMissions
      };
    }).filter(t => filterOnlyMine ? t.missions.length > 0 : true); 
  }, [technicians, relevantMissions, filterOnlyMine]);

  // Initialisation et Force Resize de la Map
  useEffect(() => {
    if (viewMode === 'MAP' && mapContainerRef.current) {
        if (!mapRef.current) {
            mapRef.current = L.map(mapContainerRef.current).setView([45.75, 4.85], 9);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap'
            }).addTo(mapRef.current);
            markersLayerRef.current = L.featureGroup().addTo(mapRef.current);
        }
        // Crucial pour les Single Page App : forcer le calcul de la taille
        setTimeout(() => {
            if (mapRef.current) mapRef.current.invalidateSize();
        }, 100);
    }
  }, [viewMode]);

  // Géocodage robuste
  useEffect(() => {
    if (viewMode !== 'MAP' || !mapRef.current) return;

    let isSubscribed = true;

    const performGeocoding = async () => {
      const allMissionsInMap = technicianRows.flatMap(t => t.missions);
      const uniqueAddresses = Array.from(new Set(
        allMissionsInMap
          .filter(m => m.address && m.address.trim() !== "")
          .map(m => m.address!.trim())
      ));

      if (uniqueAddresses.length === 0) {
        markersLayerRef.current?.clearLayers();
        return;
      }

      setGeocodingStatus({ current: 0, total: uniqueAddresses.length, active: true });
      markersLayerRef.current?.clearLayers();

      const geoCache: Record<string, [number, number]> = JSON.parse(localStorage.getItem('plani_geocache') || '{}');
      const results: Record<string, [number, number]> = {};
      let hasNewData = false;

      for (let i = 0; i < uniqueAddresses.length; i++) {
        if (!isSubscribed) break;
        
        const addr: string = uniqueAddresses[i] as string;
        if (geoCache[addr]) {
          results[addr] = geoCache[addr];
          setGeocodingStatus(prev => ({ ...prev, current: i + 1 }));
          continue;
        }

        try {
          // Temporisation pour respecter l'API Nominatim (1 req/s)
          await new Promise(r => setTimeout(r, 1100));
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);
          const searchQuery = addr.toLowerCase().includes('france') ? addr : `${addr}, France`;
          
          const resp = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`,
            { signal: controller.signal }
          );
          
          clearTimeout(timeoutId);
          if (resp.ok) {
            const data: any = await resp.json();
            if (data && data[0]) {
              const coords: [number, number] = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
              results[addr] = coords;
              geoCache[addr] = coords;
              hasNewData = true;
            }
          }
        } catch (e) {
          console.warn(`Échec géocodage pour: ${addr}`, e);
        }
        setGeocodingStatus(prev => ({ ...prev, current: i + 1 }));
      }

      if (hasNewData) localStorage.setItem('plani_geocache', JSON.stringify(geoCache));

      // Création des marqueurs avec un léger "jitter" si plusieurs chantiers sont au même endroit
      allMissionsInMap.forEach((m, idx) => {
        if (!m.address) return;
        let coords = results[m.address.trim()];
        if (coords) {
          // Ajout d'un minuscule décalage aléatoire si plusieurs points sont identiques
          const jitter = 0.0001 * (idx % 5); 
          const finalCoords: [number, number] = [coords[0] + jitter, coords[1] + jitter];
          
          const tech = technicians.find(u => u.id === m.technicianId);
          const markerColor = m.igd ? '#9333ea' : '#2563eb';
          const marker = L.marker(finalCoords, {
            icon: L.divIcon({
              className: 'custom-marker',
              html: `<div style="background-color: ${markerColor}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
              iconSize: [14, 14],
              iconAnchor: [7, 7]
            })
          });
          marker.bindPopup(`
            <div style="font-family: sans-serif; padding: 4px; min-width: 140px;">
              <strong style="color: ${markerColor}; display: block; margin-bottom: 2px;">${m.jobNumber} ${m.igd ? '(IGD)' : ''}</strong>
              <div style="font-size: 11px; font-weight: 600;">${tech?.name}</div>
              <div style="font-size: 10px; color: #64748b; margin-top: 5px; border-top: 1px solid #f1f5f9; padding-top: 4px;">${m.address}</div>
            </div>
          `);
          markersLayerRef.current.addLayer(marker);
        }
      });

      if (markersLayerRef.current && markersLayerRef.current.getLayers().length > 0) {
        const bounds = markersLayerRef.current.getBounds();
        if (bounds.isValid()) mapRef.current.fitBounds(bounds, { padding: [40, 40] });
      }
      setGeocodingStatus(prev => ({ ...prev, active: false }));
    };

    performGeocoding();
    return () => { isSubscribed = false; };
  }, [viewMode, technicianRows, technicians]);

  const handleValidateTechnicianMissions = (techId: string) => {
    const toValidate = missions.filter(m => 
      m.technicianId === techId && 
      weekDates.some(d => isSameDay(new Date(m.date), d)) &&
      (m.status === MissionStatus.SUBMITTED || m.status === MissionStatus.PENDING)
    ).map(m => ({ ...m, status: MissionStatus.VALIDATED, rejectionComment: undefined }));
    if (toValidate.length > 0) onUpdateMissions(toValidate);
    else alert("Aucune mission à valider.");
  };

  const handleRejectTechnicianMissions = (techId: string) => {
    const reason = window.prompt("Motif du refus :");
    if (!reason) return;
    const toReject = missions.filter(m => 
      m.technicianId === techId && 
      weekDates.some(d => isSameDay(new Date(m.date), d)) &&
      (m.status === MissionStatus.SUBMITTED || m.status === MissionStatus.VALIDATED)
    ).map(m => ({ ...m, status: MissionStatus.REJECTED, rejectionComment: reason }));
    if (toReject.length > 0) onUpdateMissions(toReject);
  };

  const handleDeleteMission = (e: React.MouseEvent | null, missionId: string) => {
    if (e) e.stopPropagation();
    if (window.confirm("Supprimer cette affectation ?")) {
      onUpdateMissions({ removeId: missionId });
      setIsAddingMission(false);
      setEditingMissionId(null);
    }
  };

  const handleCopy = (e: React.MouseEvent, m: Mission) => {
    e.stopPropagation();
    setClipboard(m);
  };

  const handlePaste = (techId: string, date: string) => {
    if (!clipboard) return;
    const m: Mission = {
      ...clipboard,
      id: `m-pst-${Date.now()}`,
      date: date,
      technicianId: techId,
      status: MissionStatus.SUBMITTED,
    };
    onUpdateMissions([m]);
  };

  const handleDragStart = (e: React.DragEvent, missionId: string) => {
    setDraggedMissionId(missionId);
    e.dataTransfer.setData('missionId', missionId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, techId: string, date: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverCell?.techId !== techId || dragOverCell?.date !== date) {
        setDragOverCell({ techId, date });
    }
  };

  const handleDrop = (e: React.DragEvent, targetTechId: string, targetDate: string) => {
    e.preventDefault();
    const missionId = e.dataTransfer.getData('missionId');
    setDragOverCell(null);
    const missionToMove = missions.find(m => m.id === missionId);
    if (missionToMove) {
        if (missionToMove.technicianId === targetTechId && isSameDay(new Date(missionToMove.date), new Date(targetDate))) return;
        const updatedMission: Mission = {
            ...missionToMove,
            technicianId: targetTechId,
            date: targetDate,
            status: missionToMove.status === MissionStatus.VALIDATED ? MissionStatus.VALIDATED : MissionStatus.SUBMITTED
        };
        onUpdateMissions([updatedMission]);
    }
  };

  const handleSaveMission = (e: React.FormEvent) => {
    e.preventDefault();
    if (!missionForm.technicianId || !missionForm.date || !missionForm.jobNumber) return;
    
    const m: Mission = {
      id: editingMissionId || `m-man-${Date.now()}`,
      date: missionForm.date,
      technicianId: missionForm.technicianId,
      jobNumber: missionForm.jobNumber,
      hours: missionForm.hours,
      igd: missionForm.igd,
      description: missionForm.description,
      address: missionForm.address || DEFAULT_ADDRESS,
      type: MissionType.WORK,
      status: editingMissionId ? (missions.find(mi => mi.id === editingMissionId)?.status || MissionStatus.SUBMITTED) : MissionStatus.SUBMITTED,
      managerInitials: missionForm.jobNumber.split('-')[0]
    };
    
    onUpdateMissions([m]);
    setIsAddingMission(false);
    setEditingMissionId(null);
    setMissionForm({ technicianId: '', date: '', jobNumber: '', hours: 8, igd: false, description: '', address: DEFAULT_ADDRESS });
  };

  const openAddPopup = (techId: string = '', date: string = '') => {
    setEditingMissionId(null);
    setMissionForm({ 
      technicianId: techId, 
      date: date || weekDates[0].toISOString(), 
      jobNumber: '',
      hours: 8, 
      igd: false, 
      description: '', 
      address: DEFAULT_ADDRESS 
    });
    setIsAddingMission(true);
  };

  const openEditPopup = (e: React.MouseEvent, mission: Mission) => {
    e.stopPropagation();
    setEditingMissionId(mission.id);
    setMissionForm({
      technicianId: mission.technicianId,
      date: mission.date,
      jobNumber: mission.jobNumber,
      hours: mission.hours,
      igd: mission.igd,
      description: mission.description || '',
      address: mission.address || DEFAULT_ADDRESS
    });
    setIsAddingMission(true);
  };

  const prevWeek = () => setSelectedWeek(prev => prev.weekNumber === 1 ? { year: prev.year - 1, weekNumber: 52 } : { ...prev, weekNumber: prev.weekNumber - 1 });
  const nextWeek = () => setSelectedWeek(prev => prev.weekNumber === 52 ? { year: prev.year + 1, weekNumber: 1 } : { ...prev, weekNumber: prev.weekNumber + 1 });

  return (
    <div className="space-y-8 animate-in fade-in duration-500 relative">
      {isAddingMission && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">
            <div className={`p-6 text-white flex justify-between items-center transition-colors duration-500 ${missionForm.igd ? 'bg-purple-600' : 'bg-blue-600'}`}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">{editingMissionId ? <Edit size={24}/> : <Plus size={24}/>}</div>
                <h2 className="text-xl font-black text-white">{editingMissionId ? "Modifier l'Intervention" : "Nouvelle Attribution"}</h2>
              </div>
              <button onClick={() => { setIsAddingMission(false); setEditingMissionId(null); }} className="p-2 hover:bg-white/20 rounded-full transition-colors text-white"><X size={24}/></button>
            </div>
            <form onSubmit={handleSaveMission} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Technicien *</label>
                  <select required value={missionForm.technicianId} onChange={e => setMissionForm({...missionForm, technicianId: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Choisir un technicien...</option>
                    {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Date *</label>
                  <select required value={missionForm.date} onChange={e => setMissionForm({...missionForm, date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500">
                    {weekDates.map(d => <option key={d.toISOString()} value={d.toISOString()}>{format(d, 'EEEE d MMMM', { locale: fr })}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">N° Affaire *</label>
                  <input type="text" required placeholder="RG-A23-0001" value={missionForm.jobNumber} onChange={e => setMissionForm({...missionForm, jobNumber: e.target.value.toUpperCase()})} className={`w-full bg-slate-50 border rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 ${missionForm.jobNumber && !JOB_NUMBER_REGEX.test(missionForm.jobNumber) ? 'border-red-300' : 'border-slate-200'}`} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Heures</label>
                  <input type="number" step="0.5" required value={missionForm.hours} onChange={e => setMissionForm({...missionForm, hours: parseFloat(e.target.value) || 0})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none" />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Adresse du chantier</label>
                  <div className="relative">
                    <Navigation className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${missionForm.igd ? 'text-purple-400' : 'text-slate-300'}`} size={16} />
                    <input type="text" placeholder="Rue, Ville..." value={missionForm.address} onChange={e => setMissionForm({...missionForm, address: e.target.value})} className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <div className="md:col-span-1 space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Client / Info</label>
                  <input type="text" maxLength={20} value={missionForm.description} onChange={e => setMissionForm({...missionForm, description: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-medium outline-none" />
                </div>
                <div className="md:col-span-1 flex items-end pb-1">
                   <label className={`flex items-center gap-3 cursor-pointer group p-3 rounded-2xl border transition-all w-full ${missionForm.igd ? 'bg-purple-50 border-purple-200' : 'bg-slate-50 border-slate-200 hover:bg-blue-50'}`}>
                      <input type="checkbox" checked={missionForm.igd} onChange={e => setMissionForm({...missionForm, igd: e.target.checked})} className="w-5 h-5 rounded border-slate-300 text-purple-600 focus:ring-purple-500" />
                      <span className={`text-xs font-black uppercase tracking-widest transition-colors ${missionForm.igd ? 'text-purple-700' : 'text-slate-600'}`}>IGD</span>
                   </label>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                <button type="button" onClick={() => { setIsAddingMission(false); setEditingMissionId(null); }} className="px-6 py-3 text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-100 rounded-2xl transition-all">Annuler</button>
                <button type="submit" className={`px-10 py-3 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl ${missionForm.igd ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                  {editingMissionId ? "Enregistrer" : "Valider"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row items-center justify-between gap-6 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-5">
          <div className="bg-blue-600 p-3.5 rounded-2xl text-white shadow-xl"><ShieldCheck size={28} /></div>
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight leading-none mb-1">Suivi d'Équipe</h1>
            <p className="text-slate-400 font-medium">Planning S{selectedWeek.weekNumber} • {user.initials}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
          <button onClick={() => setViewMode('LIST')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${viewMode === 'LIST' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><List size={16} /> Liste</button>
          <button onClick={() => setViewMode('CALENDAR')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${viewMode === 'CALENDAR' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><LayoutGrid size={16} /> Calendrier</button>
          <button onClick={() => setViewMode('MAP')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${viewMode === 'MAP' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><MapIcon size={16} /> Carte</button>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={prevWeek} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><ChevronLeft size={24} /></button>
          <div className="flex flex-col items-center">
             <span className="text-sm font-black text-blue-600">{selectedWeek.weekNumber} / {selectedWeek.year}</span>
          </div>
          <button onClick={nextWeek} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><ChevronRight size={24} /></button>
        </div>
        <button onClick={() => openAddPopup()} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-sm hover:bg-blue-700 transition-all shadow-lg"><Plus size={18} /> Attribuer</button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden min-h-[500px]">
        {viewMode === 'MAP' ? (
          <div className="p-4 h-[600px] flex flex-col gap-4 relative">
             {geocodingStatus.active && (
                 <div className="absolute top-8 right-8 z-[1000] bg-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-100 flex items-center gap-4 text-xs font-black text-blue-600 animate-in fade-in zoom-in-95">
                     <Loader2 size={24} className="animate-spin" />
                     <div className="flex flex-col">
                        <span>Localisation en cours...</span>
                        <span className="text-slate-400 font-bold text-[10px]">{geocodingStatus.current} / {geocodingStatus.total} adresses</span>
                     </div>
                 </div>
             )}
             <div ref={mapContainerRef} className="flex-1 bg-slate-100 rounded-3xl overflow-hidden border border-slate-200 z-0"></div>
          </div>
        ) : viewMode === 'LIST' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead><tr className="bg-slate-50">
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Technicien</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Affaire</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Heures</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Statut</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {relevantMissions.map((m) => {
                  const tech = technicians.find(t => t.id === m.technicianId);
                  return (
                    <tr key={m.id} className="group hover:bg-slate-50 transition-all cursor-pointer" onClick={(e) => openEditPopup(e, m)}>
                      <td className="px-6 py-4"><div className="text-[11px] font-black text-slate-800 capitalize">{format(new Date(m.date), 'EEE dd MMM', { locale: fr })}</div></td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {tech?.avatarUrl ? <img src={tech.avatarUrl} alt={tech.name} className="w-7 h-7 rounded-lg object-cover border border-slate-100" /> : <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-black text-[9px]">{tech?.initials || '??'}</div>}
                          <div className="text-[11px] font-bold text-slate-700 truncate max-w-[100px]">{tech?.name || 'Inconnu'}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-black text-xs text-blue-600">{m.jobNumber}</td>
                      <td className="px-6 py-4 text-center font-black text-xs text-slate-700">{m.hours} h</td>
                      <td className="px-6 py-4"><StatusLabel status={m.status} /></td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => openEditPopup(e, m)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><Edit size={16}/></button>
                          <button onClick={(e) => handleDeleteMission(e, m.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={16}/></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full text-left border-separate border-spacing-0 table-fixed">
              <thead className="bg-slate-50"><tr>
                <th className="w-48 px-6 py-4 text-[9px] font-black text-slate-400 uppercase border-r border-slate-200 sticky left-0 z-20 bg-slate-50">Technicien</th>
                {weekDates.map((date) => <th key={date.toISOString()} className={`px-4 py-4 text-[9px] font-black uppercase text-center border-r border-slate-200 ${isSunday(date) ? 'w-16 bg-slate-100' : 'text-slate-500'}`}>{format(date, 'EEE d MMM', { locale: fr })}</th>)}
                <th className="w-24 px-4 py-4 text-[9px] font-black text-slate-400 uppercase text-center">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {technicianRows.map((tech) => (
                  <tr key={tech.id} className="group hover:bg-slate-50/50">
                    <td className="px-6 py-4 border-r border-slate-200 bg-white sticky left-0 z-10 shadow-sm">
                       <div className="flex items-center gap-2">
                          {tech.avatarUrl ? <img src={tech.avatarUrl} alt={tech.name} className="w-7 h-7 rounded-lg object-cover border border-slate-100 shadow-sm" /> : <div className="w-7 h-7 rounded-lg bg-slate-100 text-[10px] font-bold flex items-center justify-center text-slate-500">{tech.initials}</div>}
                          <div className="flex flex-col overflow-hidden">
                             <span className="text-[11px] font-black text-slate-700 truncate">{tech.name}</span>
                             <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{tech.totalHours}H</span>
                          </div>
                       </div>
                    </td>
                    {weekDates.map((date) => {
                      const dateStr = date.toISOString();
                      const dayMissions = tech.missions.filter(m => isSameDay(new Date(m.date), date));
                      const isOver = dragOverCell?.techId === tech.id && dragOverCell?.date === dateStr;
                      return (
                        <td key={dateStr} onDragOver={(e) => handleDragOver(e, tech.id, dateStr)} onDrop={(e) => handleDrop(e, tech.id, dateStr)} className={`p-1.5 border-r border-slate-100 align-top group/cell relative min-h-[100px] transition-all ${isSunday(date) ? 'bg-slate-50' : ''} ${isOver ? 'bg-blue-50 ring-2 ring-inset ring-blue-300 ring-offset-0' : ''}`}>
                          <div className="flex flex-col gap-1 h-full">
                            {dayMissions.map((m) => (
                              <div key={m.id} draggable onDragStart={(e) => handleDragStart(e, m.id)} onClick={(e) => openEditPopup(e, m)} className={`px-2 py-1.5 rounded-md text-[9px] font-black border truncate relative group/mission pr-10 shadow-sm cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-blue-400 transition-all duration-300 ${m.status === MissionStatus.VALIDATED ? 'bg-green-50 text-green-700 border-green-200' : m.status === MissionStatus.REJECTED ? 'bg-red-50 text-red-700 border-red-200' : m.igd ? 'bg-purple-100 text-purple-900 border-purple-400 shadow-md ring-1 ring-purple-500/30' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                                <div className="flex items-center gap-1"><Move size={8} className={`${m.igd ? 'text-purple-600' : 'text-blue-400'}`} />{m.jobNumber}</div>
                                <div className={`text-[7px] font-medium truncate ${m.igd ? 'text-purple-800' : 'opacity-60'}`}>{m.hours}h</div>
                                {m.igd && <MapPin size={8} className="absolute top-1 right-1 text-purple-700" />}
                              </div>
                            ))}
                            {!isSunday(date) && dayMissions.length < 2 && (
                               <div className="flex gap-1 opacity-0 group-hover/cell:opacity-100 transition-all mt-auto pt-1">
                                  <button onClick={() => openAddPopup(tech.id, dateStr)} className="flex-1 h-8 rounded-md border border-dashed border-slate-200 flex items-center justify-center text-slate-300 hover:text-blue-500 hover:border-blue-300 hover:bg-blue-50 transition-all"><Plus size={14}/></button>
                                  {clipboard && <button onClick={() => handlePaste(tech.id, dateStr)} className="w-8 h-8 rounded-md border border-dashed border-blue-300 bg-blue-50 flex items-center justify-center text-blue-600 hover:bg-blue-100 animate-pulse"><Clipboard size={14}/></button>}
                               </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-2 py-4 text-center bg-slate-50/20">
                      <div className="flex flex-col items-center gap-2">
                        {tech.status === 'SUBMITTED' ? (
                          <div className="flex flex-col gap-1 w-full px-1">
                             <button onClick={() => handleValidateTechnicianMissions(tech.id)} className="w-full py-1.5 bg-green-600 text-white rounded-lg text-[8px] font-black uppercase hover:bg-green-700 shadow-sm flex items-center justify-center gap-1"><CheckCircle size={10}/> OK</button>
                             <button onClick={() => handleRejectTechnicianMissions(tech.id)} className="w-full py-1.5 bg-red-600 text-white rounded-lg text-[8px] font-black uppercase hover:bg-red-700 shadow-sm flex items-center justify-center gap-1"><Ban size={10}/> NON</button>
                          </div>
                        ) : (
                          <StatusLabel status={tech.status} />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const StatusLabel: React.FC<{ status: string }> = ({ status }) => {
  const base = "px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border text-center whitespace-nowrap";
  switch (status) {
    case 'PENDING': return <span className={`${base} bg-slate-100 text-slate-500 border-slate-200`}>Brouillon</span>;
    case 'SUBMITTED': return <span className={`${base} bg-orange-100 text-orange-600 border-orange-200`}>À Valider</span>;
    case 'VALIDATED': return <span className={`${base} bg-green-100 text-green-700 border-green-200`}>Validé</span>;
    case 'REJECTED': return <span className={`${base} bg-red-100 text-red-600 border-red-200`}>Refusé</span>;
    default: return <span className={`${base} bg-slate-50 text-slate-300 border-slate-100`}>Inactif</span>;
  }
};

export default ManagerDashboard;
