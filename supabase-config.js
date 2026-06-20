'use strict';

// ─────────────────────────────────────────────────────────────
// ШАГИ ДЛЯ НАСТРОЙКИ:
//
// 1. Зайдите на https://supabase.com и создайте новый проект
// 2. В панели Supabase откройте: Settings → API
// 3. Скопируйте "Project URL" и вставьте вместо PASTE_YOUR_URL
// 4. Скопируйте "anon public" key и вставьте вместо PASTE_YOUR_KEY
// 5. Сохраните файл
// ─────────────────────────────────────────────────────────────

const SUPABASE_URL  = 'https://mlkntyfuvasoqdmvyofz.supabase.co';
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sa250eWZ1dmFzb3FkbXZ5b2Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MjAzNzIsImV4cCI6MjA5NTE5NjM3Mn0.-uFHcIrVd_b2k-Q3E8_2ot2932EwFq__z6CONv4dOps';

// Не трогайте строки ниже
const sbEnabled = SUPABASE_URL !== 'PASTE_YOUR_URL_HERE' && SUPABASE_KEY !== 'PASTE_YOUR_KEY_HERE';
const sb = sbEnabled ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
