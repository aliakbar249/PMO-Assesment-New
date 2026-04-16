import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jvmnwpxqugzsssuewlis.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2bW53cHhxdWd6c3NzdWV3bGlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNTY4MjgsImV4cCI6MjA5MTkzMjgyOH0.wH4fnE3TxV-50vUstoN-PEuCNS0uWMdW75Vd1VfIDTk';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const { data, error } = await supabase.from('users').select('id').limit(1);
console.log('Connection test:', error ? `ERROR: ${error.message}` : 'SUCCESS');
if (error) console.log('Code:', error.code);
