'use strict';

const SupabaseSync = (() => {

  let _lastPollAt = null;

  // Перехватываем Data._set → пишем в Supabase после каждого изменения
  const _orig = Data._set.bind(Data);
  Data._set = function(key, val) {
    _orig(key, val);
    if (sbEnabled) _upsert(key, val);
  };

  // ── Запись строки в Supabase ─────────────────────────────────
  async function _upsert(key, val) {
    try {
      await sb.from('app_data').upsert(
        { key, value: val, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
    } catch (e) {
      console.warn('[Supabase] upsert error:', e);
    }
  }

  // ── Загрузка всех данных (первый запуск) ─────────────────────
  async function loadFromCloud() {
    if (!sbEnabled) return false;
    try {
      const { data, error } = await sb.from('app_data').select('key, value');
      if (error || !data || !data.length) return false;
      data.forEach(row => localStorage.setItem(row.key, JSON.stringify(row.value)));
      _lastPollAt = new Date().toISOString();
      return true;
    } catch (e) {
      console.warn('[Supabase] load error:', e);
      return false;
    }
  }

  // ── Delta-polling: только изменённые строки ──────────────────
  async function _pollChanges() {
    if (!sbEnabled || !_lastPollAt) return;
    try {
      const since = new Date(new Date(_lastPollAt).getTime() - 500).toISOString();
      _lastPollAt = new Date().toISOString();

      const { data, error } = await sb.from('app_data')
        .select('key, value')
        .gt('updated_at', since);

      if (error || !data || !data.length) return;

      data.forEach(row => localStorage.setItem(row.key, JSON.stringify(row.value)));
      window.dispatchEvent(new CustomEvent('tbo-sync', { detail: { keys: data.map(r => r.key) } }));
    } catch (e) {
      console.warn('[Supabase] poll error:', e);
    }
  }

  // ── Загрузка фото в Supabase Storage ─────────────────────────
  async function uploadPhoto(dataUrl, filename) {
    if (!sbEnabled) return dataUrl;
    try {
      const res  = await fetch(dataUrl);
      const blob = await res.blob();
      const path = `photos/${Date.now()}_${filename}.jpg`;

      const { data, error } = await sb.storage
        .from('tbo-photos')
        .upload(path, blob, { contentType: 'image/jpeg', upsert: false });

      if (error) { console.warn('[Supabase Storage] upload error:', error); return dataUrl; }

      const { data: { publicUrl } } = sb.storage.from('tbo-photos').getPublicUrl(data.path);
      return publicUrl;
    } catch (e) {
      console.warn('[Supabase Storage] error:', e);
      return dataUrl;
    }
  }

  // ── Инициализация ─────────────────────────────────────────────
  async function init(callback) {
    if (sbEnabled) {
      const loaded = await loadFromCloud();
      if (loaded) console.info('[Supabase] данные загружены из облака');
      else         console.info('[Supabase] облако пусто — используем локальные данные');
    }
    callback();
  }

  // ── Realtime-подписка (мгновенные обновления) ─────────────────
  function startRealtime() {
    if (!sbEnabled) return;
    sb.channel('app_data_rt')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'app_data' },
        payload => {
          if (payload.new && payload.new.key) {
            localStorage.setItem(payload.new.key, JSON.stringify(payload.new.value));
            window.dispatchEvent(new CustomEvent('tbo-sync', { detail: { keys: [payload.new.key] } }));
            console.info('[Supabase RT] обновление:', payload.new.key);
          }
        }
      )
      .subscribe(status => {
        if (status === 'SUBSCRIBED') console.info('[Supabase RT] Realtime подключён');
      });
  }

  // ── Polling каждые 3 секунды (резервный канал) ───────────────
  function startPolling() {
    if (!sbEnabled) return;
    setInterval(_pollChanges, 3000);
  }

  return { init, uploadPhoto, startRealtime, startPolling };
})();
