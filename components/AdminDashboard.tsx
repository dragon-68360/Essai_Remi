
import React, { useState, useRef, useEffect } from 'react';
import { User, Role, AppSettings, Mission, MissionType, MissionStatus } from '../types';
import { exportToCSV, parseCSV, normalizeString } from '../utils';
import { Users, UserPlus, Trash2, Edit2, Shield, HardHat, Settings, Check, X, ImageIcon, LayoutTemplate, Download, Upload, Database, Camera, Trash, HardDrive, FileSpreadsheet, History, RotateCcw, FileUp, FileDown, Contact, FileText, MapPin, AlertTriangle, FileCheck, ShieldAlert } from 'lucide-react';

interface Props {
  users: User[];
  onUpdateUsers: (users: User[], oldId?: string, newId?: string) => void;
  appSettings: AppSettings;
  onUpdateAppSettings: (settings: AppSettings) => void;
  missions: Mission[];
  onRestoreDatabase: (data: { missions: Mission[], users: User[], settings: AppSettings }) => void;
}

const AdminDashboard: React.FC<Props> = ({ users, onUpdateUsers, appSettings, onUpdateAppSettings, missions, onRestoreDatabase }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [storageUsage, setStorageUsage] = useState<{ used: number, percent: number }>({ used: 0, percent: 0 });
  const [formData, setFormData] = useState<Partial<User>>({
    name: '', initials: '', role: Role.TECHNICIAN, id: '', email: '', password: '', avatarUrl: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvMissionsRef = useRef<HTMLInputElement>(null);
  const csvUsersRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [settingsForm, setSettingsForm] = useState<AppSettings>(appSettings);

  useEffect(() => {
    const calculateStorage = () => {
      let total = 0;
      for (let x in localStorage) {
        if (localStorage.hasOwnProperty(x)) {
          total += ((localStorage[x].length + x.length) * 2);
        }
      }
      const usedMB = total / (1024 * 1024);
      setStorageUsage({
        used: parseFloat(usedMB.toFixed(2)),
        percent: Math.min(Math.round((usedMB / 5) * 100), 100)
      });
    };
    calculateStorage();
  }, [users, missions, appSettings]);

  const handleFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) { alert("L'image est trop lourde."); return; }
      const base64 = await handleFileToBase64(file);
      setSettingsForm({ ...settingsForm, appLogoUrl: base64 });
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500 * 1024) { alert("La photo est trop lourde."); return; }
      const base64 = await handleFileToBase64(file);
      setFormData({ ...formData, avatarUrl: base64 });
    }
  };

  const handleSaveUser = () => {
    if (!formData.name || !formData.initials || !formData.id || !formData.password) {
      alert("Tous les champs marqués d'une étoile (*) sont obligatoires.");
      return;
    }
    const newId = formData.id?.toLowerCase().replace(/\s/g, '');
    if (editingId) {
      onUpdateUsers(users.map(u => u.id === editingId ? { ...u, ...formData, id: newId } as User : u), editingId, newId);
      setEditingId(null);
    } else {
      if (users.find(u => u.id === newId)) { alert("Cet identifiant existe déjà."); return; }
      onUpdateUsers([...users, { ...formData, id: newId } as User]);
      setIsAdding(false);
    }
    setFormData({ name: '', initials: '', role: Role.TECHNICIAN, id: '', email: '', password: '', avatarUrl: '' });
  };

  const handleSaveSettings = () => {
    onUpdateAppSettings(settingsForm);
    alert("Paramètres mis à jour.");
  };

  const handleExportBackup = () => {
    const snapshot = {
      metadata: { version: "2.1", exportDate: new Date().toISOString(), source: "Planit-Mounier DB" },
      payload: { missions, users, settings: appSettings }
    };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `MOUNIER_BACKUP_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) throw new Error("Fichier vide.");
        const snapshot = JSON.parse(text);
        
        if (!snapshot || !snapshot.payload || !snapshot.payload.users || !snapshot.payload.missions) {
          throw new Error("Le fichier n'est pas un backup JSON valide de l'application.");
        }

        const missionCount = snapshot.payload.missions.length;
        const userCount = snapshot.payload.users.length;

        if (window.confirm(`⚠️ RESTAURATION COMPLÈTE\n\n- Membres : ${userCount}\n- Missions : ${missionCount}\n\nToutes les données actuelles seront remplacées. Continuer ?`)) {
          onRestoreDatabase(snapshot.payload);
        }
      } catch (err) { 
        alert(`❌ Erreur de backup : ${err instanceof Error ? err.message : "Fichier corrompu"}`); 
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportMissionsCSV = () => {
    if (missions.length === 0) { alert("Aucune mission."); return; }
    const data = missions.map(m => ({
      ID_MISSION: m.id, DATE: m.date.split('T')[0], CODE_AFFAIRE: m.jobNumber, 
      CA: m.managerInitials, TECH_ID: m.technicianId, HEURES: m.hours,
      IGD: m.igd ? 'OUI' : 'NON', STATUT: m.status, INFO: m.description || '', ADRESSE: m.address || ''
    }));
    exportToCSV(data, `ARCHIVE_MISSIONS_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleImportMissionsCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const rows = parseCSV(event.target?.result as string);
        if (rows.length < 2) throw new Error("Fichier trop court.");
        
        const headers = rows[0].map(h => normalizeString(h));
        const findIdx = (kw: string[]) => headers.findIndex(h => kw.some(k => h.includes(normalizeString(k))));

        const idxDate = findIdx(['date', 'jour']);
        const idxJob = findIdx(['affaire', 'job', 'code']);
        const idxCA = findIdx(['ca', 'manager', 'initiale']);
        const idxTech = findIdx(['tech', 'login', 'intervenant', 'user']);
        const idxHours = findIdx(['heure', 'hour', 'duree']);
        const idxIgd = findIdx(['igd', 'frais', 'deplacement']);

        if (idxDate === -1 || idxJob === -1 || idxTech === -1) {
          alert(`❌ Erreur : Colonnes obligatoires non trouvées.\nColonnes détectées : ${rows[0].join(', ')}`);
          return;
        }

        const imported = rows.slice(1).map((row, i) => {
          let dateStr = (row[idxDate] || '').trim();
          if (!dateStr) return null;

          // Support JJ/MM/AAAA
          if (dateStr.includes('/')) {
            const p = dateStr.split('/');
            if (p.length === 3) dateStr = `${p[2]}-${p[1]}-${p[0]}`;
          }

          const hVal = idxHours !== -1 ? parseFloat(row[idxHours].replace(',', '.')) : 8;
          const igdVal = idxIgd !== -1 ? ['OUI',