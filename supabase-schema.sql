-- ═══════════════════════════════════════════════════════════
--  ТБО Мониторинг — схема базы данных Supabase
--  Запустите этот файл в: Supabase → SQL Editor → New query
-- ═══════════════════════════════════════════════════════════

-- 1. Основная таблица для хранения всех данных приложения
CREATE TABLE IF NOT EXISTS app_data (
  key        TEXT PRIMARY KEY,
  value      JSONB        NOT NULL,
  updated_at TIMESTAMPTZ  DEFAULT NOW()
);

-- 2. Включаем Row Level Security (RLS)
ALTER TABLE app_data ENABLE ROW LEVEL SECURITY;

-- 3. Политики (пересоздаём если уже существуют)
DROP POLICY IF EXISTS "Allow public read"   ON app_data;
DROP POLICY IF EXISTS "Allow public insert" ON app_data;
DROP POLICY IF EXISTS "Allow public update" ON app_data;

CREATE POLICY "Allow public read"
  ON app_data FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert"
  ON app_data FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update"
  ON app_data FOR UPDATE
  USING (true);

-- ═══════════════════════════════════════════════════════════
--  Storage bucket для фотографий
--  Настройте в: Supabase → Storage → New bucket
--  Имя bucket: tbo-photos
--  Public bucket: YES (включить публичный доступ)
-- ═══════════════════════════════════════════════════════════

-- Политики Storage (пересоздаём если уже существуют)
DROP POLICY IF EXISTS "Allow photo upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow photo read"   ON storage.objects;

CREATE POLICY "Allow photo upload"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'tbo-photos');

CREATE POLICY "Allow photo read"
  ON storage.objects FOR SELECT
  TO anon
  USING (bucket_id = 'tbo-photos');

-- ═══════════════════════════════════════════════════════════
--  Realtime — мгновенная синхронизация между устройствами
--  Запустите эту строку ОТДЕЛЬНЫМ запросом если Realtime
--  не работает (ошибки в консоли браузера)
-- ═══════════════════════════════════════════════════════════
-- ALTER PUBLICATION supabase_realtime ADD TABLE app_data;
