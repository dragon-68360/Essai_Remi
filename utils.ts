
import { format, startOfWeek, addDays, getWeek, getYear, parse, getDay } from 'date-fns';
import { fr } from 'date-fns/locale';

export const getWeekDates = (year: number, week: number) => {
  const firstDayOfYear = new Date(year, 0, 1);
  const daysOffset = (week - 1) * 7;
  const start = startOfWeek(addDays(firstDayOfYear, daysOffset), { weekStartsOn: 1 });
  
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
};

export const getCurrentWeekInfo = () => {
  const now = new Date();
  return {
    weekNumber: getWeek(now, { weekStartsOn: 1 }),
    year: getYear(now)
  };
};

export const isSunday = (date: Date) => getDay(date) === 0;

export const formatFrenchDate = (date: Date) => {
  return format(date, 'EEEE d MMMM', { locale: fr });
};

/**
 * Nettoie une chaîne de caractères pour comparaison (accents, majuscules, espaces)
 */
export const normalizeString = (str: string): string => {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Supprime les accents
    .replace(/[^a-z0-9]/g, "");     // Garde uniquement l'essentiel
};

/**
 * Parseur CSV robuste compatible Excel
 */
export const parseCSV = (text: string): string[][] => {
  if (!text || !text.trim()) return [];

  // Suppression du BOM Excel et des caractères de contrôle
  const cleanText = text
    .replace(/^\uFEFF/, '')
    .replace(/^ï»¿/, '')
    .trim();

  const lines = cleanText.split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length === 0) return [];

  // Détection du séparateur sur la base de la première ligne
  const firstLine = lines[0];
  const separators = [';', ',', '\t'];
  const separator = separators.reduce((a, b) => 
    (firstLine.split(a).length > firstLine.split(b).length ? a : b)
  );

  return lines.map(line => {
    const result = [];
    let curVal = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          curVal += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === separator && !inQuotes) {
        result.push(curVal.trim());
        curVal = "";
      } else {
        curVal += char;
      }
    }
    result.push(curVal.trim());
    return result.map(v => v.replace(/^"|"$/g, '').trim());
  });
};

export const exportToCSV = (data: any[], filename: string) => {
  if (data.length === 0) return;
  
  const headers = Object.keys(data[0]).join(';');
  const rows = data.map(obj => 
    Object.values(obj).map(val => {
      const str = String(val ?? '').replace(/"/g, '""');
      return `"${str}"`;
    }).join(';')
  ).join('\n');
  
  const csvContent = "\uFEFF" + headers + "\n" + rows;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
