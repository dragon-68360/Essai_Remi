
import { Role, User } from './types';

export const DEFAULT_ADMIN: User = { 
  id: 'admin', 
  name: 'Administrateur Général', 
  initials: 'AD', 
  role: Role.ADMIN,
  password: 'admin' 
};

export const INITIAL_MANAGERS: User[] = [
  { id: 'remig', name: 'Rémi Girard', initials: 'RG', role: Role.MANAGER, password: '1234' },
  { id: 'jeans', name: 'Jean Sabatier', initials: 'JS', role: Role.MANAGER, password: '1234' },
];

export const INITIAL_TECHNICIANS: User[] = Array.from({ length: 5 }, (_, i) => ({
  id: `tech0${i + 1}`,
  name: `Technicien ${i + 1}`,
  initials: `T${i + 1}`,
  role: Role.TECHNICIAN,
  password: '1234'
}));

export const JOB_NUMBER_REGEX = /^[A-Z]{2}-A\d{2}-\d{4}$/;
