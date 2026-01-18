
import React, { useState, useEffect, useRef } from 'react';
import { User, Role, Mission, WeekSelection, AppSettings } from './types';
import { INITIAL_MANAGERS, INITIAL_TECHNICIANS, DEFAULT_ADMIN } from './constants';
import { getCurrentWeekInfo } from './utils';
import TechnicianDashboard from './components/TechnicianDashboard';
import ManagerDashboard from './components/ManagerDashboard';
import AdminDashboard from './components/AdminDashboard';
import { LogOut, User as UserIcon, ShieldCheck, Factory, Lock, ArrowRight, AlertCircle } from 'lucide-react';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentWeek, setCurrentWeek] = useState<WeekSelection>(getCurrentWeekInfo());
  const [appSettings, setAppSettings] = useState<AppSettings>({
    appName: 'PLANIT-MOUNIER',
    appLogoUrl: ''
  });

  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  
  // Utilisation d'un ref pour bloquer la sauvegarde automatique pendant une restauration
  const isRestoring = useRef(false);

  // Chargement initial au démarrage
  useEffect(() => {
    try {
      const savedMissions = localStorage.getItem('plantit_missions');
      if (savedMissions) setMissions(JSON.parse(savedMissions));

      const savedUsers = localStorage.getItem('plantit_users');
      if (savedUsers) {
        setUsers(JSON.parse(savedUsers));
      } else {
        const initialUsers = [DEFAULT_ADMIN, ...INITIAL_MANAGERS, ...INITIAL_TECHNICIANS];
        setUsers(initialUsers);
        localStorage.setItem('plantit_users', JSON.stringify(initialUsers));
      }

      const savedSettings = localStorage.getItem('plantit_settings');
      if (savedSettings) setAppSettings(JSON.parse(savedSettings));
    } catch (e) {
      console.error("Erreur lecture initiale localStorage:", e);
    }
  }, []);

  // Sauvegarde automatique des missions
  useEffect(() => {
    // Ne pas sauvegarder si on est en train de restaurer la base (évite d'écraser avec les anciennes valeurs d'état)
    if (isRestoring.current) return;
    
    localStorage.setItem('plantit_missions', JSON.stringify(missions));
  }, [missions]);

  const handleUpdateUsers = (newUsers: User[], oldId?: string, newId?: string) => {
    setUsers(newUsers);
    localStorage.setItem('plantit_users', JSON.stringify(newUsers));
    if (oldId && newId && oldId !== newId) {
      setMissions(prev => prev.map(m => m.technicianId === oldId ? { ...m, technicianId: newId } : m));
      if (currentUser && currentUser.id === oldId) {
        const updatedMe = newUsers.find(u => u.id === newId);
        if (updatedMe) setCurrentUser(updatedMe);
      }
    }
  };

  const updateAppSettings = (newSettings: AppSettings) => {
    setAppSettings(newSettings);
    localStorage.setItem('plantit_settings', JSON.stringify(newSettings));
  };

  const handleRestoreDatabase = (data: { missions: Mission[], users: User[], settings: AppSettings }) => {
    console.log("DÉBUT RESTAURATION PHYSIQUE...");
    isRestoring.current = true; // Bloque les useEffect de sauvegarde
    
    try {
        // 1. Nettoyage total du stockage
        localStorage.clear();
        console.log("1. LocalStorage nettoyé.");

        // 2. Écriture directe des données importées
        const missionsStr = JSON.stringify(data.missions || []);
        const usersStr = JSON.stringify(data.users || []);
        const settingsStr = JSON.stringify(data.settings || { appName: 'PLANIT-MOUNIER', appLogoUrl: '' });

        localStorage.setItem('plantit_missions', missionsStr);
        localStorage.setItem('plantit_users', usersStr);
        localStorage.setItem('plantit_settings', settingsStr);
        
        console.log("2. Données écrites dans LocalStorage.");
        
        alert("✅ Données restaurées avec succès !\nL'application va maintenant redémarrer.");
        
        // 3. Redémarrage forcé
        setTimeout(() => {
            window.location.href = window.location.origin;
        }, 300);
    } catch (e) {
        isRestoring.current = false;
        console.error("Erreur fatale restauration:", e);
        alert("❌ ÉCHEC CRITIQUE DE LA RESTAURATION :\n" + (e instanceof Error ? e.message : "Erreur inconnue"));
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const user = users.find(u => u.id === loginId);
    if (!user) {
      setLoginError('Identifiant inconnu.');
      return;
    }
    if (user.password !== loginPassword) {
      setLoginError('Mot de passe incorrect.');
      return;
    }
    setCurrentUser(user);
    setLoginPassword('');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setLoginId('');
  };

  const updateMissions = (payload: Mission[] | { removeId: string }) => {
    setMissions(prev => {
      if (payload && !Array.isArray(payload) && 'removeId' in payload) {
        return prev.filter(m => m.id !== payload.removeId);
      } 
      if (Array.isArray(payload)) {
        const idsToUpdate = new Set(payload.map(m => m.id));
        const filtered = prev.filter(m => !idsToUpdate.has(m.id));
        return [...filtered, ...payload];
      }
      return prev;
    });
  };

  const renderLogo = (size: number = 32, className: string = "text-white") => {
    if (appSettings.appLogoUrl) {
      return <img src={appSettings.appLogoUrl} alt="Logo" className={`h-${size/4} object-contain`} style={{ height: `${size}px` }} />;
    }
    return <Factory size={size} className={className} />;
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="max-w-4xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row border border-slate-200">
          <div className="md:w-1/2 bg-blue-700 p-12 text-white flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-10">
                <div className="bg-white/20 p-2.5 rounded-2xl backdrop-blur-md">{renderLogo(36)}</div>
                <h1 className="text-3xl font-black tracking-tighter uppercase">{appSettings.appName}</h1>
              </div>
              <h2 className="text-4xl font-bold mb-4 leading-tight">Portail de Gestion de Planning</h2>
              <p className="text-blue-100 text-lg opacity-80">Accédez à votre espace sécurisé pour gérer vos interventions et valider les heures chantiers.</p>
            </div>
          </div>
          <div className="md:w-1/2 p-12 bg-white flex flex-col justify-center">
            <h3 className="text-2xl font-black text-slate-800 mb-2">Connexion</h3>
            <p className="text-slate-400 mb-8 font-medium">Entrez vos identifiants pour continuer.</p>
            <form onSubmit={handleLogin} className="space-y-6">
              {loginError && <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-bold animate-in fade-in slide-in-from-top-2"><AlertCircle size={18} />{loginError}</div>}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Identifiant Utilisateur</label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input type="text" required value={loginId} onChange={e => setLoginId(e.target.value)} placeholder="ex: remig" className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-300" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Mot de passe</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input type="password" required value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="••••••••" className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-300" />
                </div>
              </div>
              <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 group">Se connecter <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center">
            <div className="flex items-center gap-4">
              <div className="bg-blue-600 text-white p-2.5 rounded-2xl shadow-lg shadow-blue-200">{renderLogo(24)}</div>
              <div className="flex flex-col">
                <span className="text-xl font-black text-slate-900 tracking-tighter leading-none uppercase">{appSettings.appName}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Solutions terrain</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-200">
                {currentUser.avatarUrl ? (
                  <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-8 h-8 rounded-full object-cover border border-white shadow-sm" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold">{currentUser.initials}</div>
                )}
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-800">{currentUser.name}</span>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{currentUser.role}</span>
                </div>
              </div>
              <button onClick={handleLogout} className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 text-slate-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200 rounded-2xl transition-all" title="Déconnexion"><LogOut size={20} /></button>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {currentUser.role === Role.TECHNICIAN && (
          <TechnicianDashboard user={currentUser} missions={missions} week={currentWeek} onWeekChange={setCurrentWeek} onUpdateMissions={updateMissions} />
        )}
        {currentUser.role === Role.MANAGER && (
          <ManagerDashboard user={currentUser} missions={missions} technicians={users.filter(u => u.role === Role.TECHNICIAN)} onUpdateMissions={updateMissions} />
        )}
        {currentUser.role === Role.ADMIN && (
          <AdminDashboard 
            users={users} 
            onUpdateUsers={handleUpdateUsers} 
            appSettings={appSettings} 
            onUpdateAppSettings={updateAppSettings} 
            missions={missions}
            onRestoreDatabase={handleRestoreDatabase}
          />
        )}
      </main>
    </div>
  );
};

export default App;
