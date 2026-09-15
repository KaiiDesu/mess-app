// server/config/supabase.js - Supabase client setup
const { createClient } = require('@supabase/supabase-js');

const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

if (!process.env.SUPABASE_URL || !serviceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
}

let configuredRole = 'non-JWT-or-invalid';
if (serviceRoleKey.startsWith('eyJ')) {
  try {
    configuredRole = JSON.parse(
      Buffer.from(serviceRoleKey.split('.')[1], 'base64url').toString('utf8')
    ).role || configuredRole;
  } catch (_) {
    configuredRole = 'invalid-JWT';
  }
} else if (serviceRoleKey.startsWith('sb_secret_')) {
  configuredRole = 'sb_secret';
}

console.log('[supabase] configured server key type:', configuredRole);

const supabase = createClient(
  process.env.SUPABASE_URL,
  serviceRoleKey
);

module.exports = supabase;
