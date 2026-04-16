import { createClient } from '@supabase/supabase-js';
import { DEFAULT_SECTIONS } from './src/data/competencies.js';
import { v4 as uuidv4 } from 'uuid';

const SUPABASE_URL = 'https://jvmnwpxqugzsssuewlis.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2bW53cHhxdWd6c3NzdWV3bGlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNTY4MjgsImV4cCI6MjA5MTkzMjgyOH0.wH4fnE3TxV-50vUstoN-PEuCNS0uWMdW75Vd1VfIDTk';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkTables() {
  const tables = ['users','employees','template_sections','template_statements',
    'assessments','assignments','nominations','reviewers','reviews','password_resets'];
  const results = {};
  for (const t of tables) {
    const { error } = await supabase.from(t).select('*').limit(1);
    results[t] = error ? `MISSING (${error.code})` : 'EXISTS';
  }
  return results;
}

console.log('Checking tables...');
const tables = await checkTables();
console.log(tables);

const allExist = Object.values(tables).every(v => v === 'EXISTS');
console.log('\nAll tables exist:', allExist);
