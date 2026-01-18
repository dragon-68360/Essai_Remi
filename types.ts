
export enum Role {
  TECHNICIAN = 'TECHNICIAN',
  MANAGER = 'MANAGER',
  ADMIN = 'ADMIN'
}

export enum MissionType {
  WORK = 'WORK',
  LEAVE = 'CONGE',
  SICK = 'MALADIE',
  TRAINING = 'FORMATION'
}

export enum MissionStatus {
  PENDING = 'PENDING',
  SUBMITTED = 'SUBMITTED',
  VALIDATED = 'VALIDATED',
  REJECTED = 'REJECTED'
}

export interface User {
  id: string; // Utilisé comme Login
  name: string;
  initials: string;
  role: Role;
  password?: string; // Nouveau champ mot de passe
  email?: string;
  avatarUrl?: string;
}

export interface AppSettings {
  appName: string;
  appLogoUrl?: string;
}

export interface Mission {
  id: string;
  date: string; // ISO string
  jobNumber: string; // Format: RG-AXX-XXXX
  hours: number;
  type: MissionType;
  status: MissionStatus;
  technicianId: string;
  managerInitials: string;
  igd: boolean;
  description?: string; // Maxi 20 caractères
  address?: string; // Adresse postale
  rejectionComment?: string; // Commentaire en cas de refus
}

export interface WeekSelection {
  year: number;
  weekNumber: number;
}
