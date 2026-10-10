// Supabase connection for accounts, Lookbook sync and analytics.
// Both values come from Supabase → Project Settings → API (or "Connect").
// The anon / publishable key is meant to be public: Row Level Security in
// supabase/schema.sql is what protects the data. Never put the service_role key here.
// Leave both empty to run the site without accounts (guest mode, localStorage only).
window.VPR_CONFIG = {
  supabaseUrl: 'https://qgzrdzytmwfybpnuauvh.supabase.co',
  supabaseAnonKey: 'sb_publishable_-mkADRXtxUZ5VoK6rW-niw_PkFMMFR0'
};
