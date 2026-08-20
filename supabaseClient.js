const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Backend uses the SERVICE ROLE key -> full access, bypasses RLS.
// Never expose this key to the mobile app or admin panel frontend.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = supabase;
