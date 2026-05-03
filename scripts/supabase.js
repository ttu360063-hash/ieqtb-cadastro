import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = 'https://horrciotgjrbovmfawhh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_3i2egQ_uK_G67AqjkyOvYg_0scHn1DA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Salvar inscrição
export async function saveRegistration(registration) {
  const { data, error } = await supabase
    .from('inscricoes')
    .insert([registration]);
  if (error) throw error;
  return data;
}

// Buscar todas inscrições
export async function getRegistrations() {
  const { data, error } = await supabase
    .from('inscricoes')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// Contagem total
export async function getRegistrationCount() {
  const { count, error } = await supabase
    .from('inscricoes')
    .select('*', { count: 'exact', head: true });
  if (error) throw error;
  return count || 0;
}

// Normalizar nome da igreja para grouping
function normalizeChurch(church) {
  if (!church) return '';
  let normalized = church.toLowerCase()
    .replace(/\\s+/g, ' ') // espaços extras
    .trim();
  // Remover palavras genéricas
  normalized = normalized
    .replace(/\\bigreja|\\s*ieq\\s*|\\s*sede\\s*|\\s*de\\s*/gi, ' ')
    .replace(/\\s+/g, ' ')
    .trim();
  // Remover acentos simples
  normalized = normalized
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  return normalized;
}

// Agrupamento inteligente de igrejas
export function groupChurches(registrations) {
  const normalizedChurches = registrations
    .map(r => normalizeChurch(r.igreja))
    .filter(Boolean);
  
  const groups = new Map();
  for (const church of normalizedChurches) {
    let matched = false;
    for (const [key, value] of groups) {
      if (church.includes(key) || key.includes(church) || 
          levenshteinDistance(church, key) / Math.max(church.length, key.length) < 0.3) {
        groups.set(key, value + 1);
        matched = true;
        break;
      }
    }
    if (!matched) {
      groups.set(church, 1);
    }
  }
  return groups.size;
}

// Distância Levenshtein simples para fuzzy matching
function levenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

// Realtime subscription
let realtimeChannel = null;

export function subscribeRealtime(callback) {
  if (realtimeChannel) realtimeChannel.unsubscribe();
  realtimeChannel = supabase
    .channel('inscricoes')
    .on('postgres_changes', 
      { event: 'INSERT', schema: 'public', table: 'inscricoes' },
      callback
    )
    .subscribe();
}

export function unsubscribeRealtime() {
  if (realtimeChannel) {
    realtimeChannel.unsubscribe();
    realtimeChannel = null;
  }
}

// Export CSV
export async function exportRegistrationsAsCsv() {
  const registrations = await getRegistrations();
  const headers = ['id', 'nome', 'idade', 'email', 'igreja', 'telefone', 'created_at'];
  const csvRows = [
    headers.join(','),
    ...registrations.map(row => [
      row.id,
      `"${String(row.nome || '').replace(/"/g, '""')}"`,
      row.idade || '',
      `"${String(row.email || '').replace(/"/g, '""')}"`,
      `"${String(row.igreja || '').replace(/"/g, '""')}"`,
      row.telefone || '',
      row.created_at || ''
    ].join(','))
  ];
  return csvRows.join('\\n');
}

