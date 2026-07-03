-- ═══════════════════════════════════════════════════════════
-- رَوْنَق — Supabase Database Schema  (Digital Product Flow)
-- ═══════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────
-- 1. PROFILES
-- ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  phone       TEXT,
  country     TEXT DEFAULT 'KW',
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────
-- 2. PRODUCTS
-- ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.products (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  description TEXT,
  price       NUMERIC(10,3) NOT NULL,
  currency    TEXT DEFAULT 'KWD',
  file_path   TEXT NOT NULL,
  is_active   BOOLEAN DEFAULT TRUE,
  version     TEXT DEFAULT '1.0',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.products (id, name, description, price, file_path, version)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'كتاب رَوْنَق — دليل التنظيف الاحترافي',
  'دليل تدريبي احترافي يحوّل عاملتك المنزلية إلى خبيرة تنظيف بمعايير خمس نجوم',
  15.000, 'books/rwnk-guide-v1.pdf', '1.0'
) ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────
-- 3. PURCHASES  (supports guest checkout)
-- ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.purchases (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  product_id       UUID REFERENCES public.products(id),
  email            TEXT NOT NULL,
  guest_email      TEXT,           -- email used at checkout (before account creation)
  amount           NUMERIC(10,3) NOT NULL,
  currency         TEXT DEFAULT 'KWD',
  status           TEXT DEFAULT 'pending'
                   CHECK (status IN ('pending','completed','refunded','failed')),
  payment_method   TEXT,
  payment_ref      TEXT,
  invoice_number   TEXT UNIQUE,
  downloads_limit  INTEGER DEFAULT 5,
  downloads_used   INTEGER DEFAULT 0,
  account_created  BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Auto invoice number
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TRIGGER AS $$
DECLARE seq_num INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO seq_num FROM public.purchases;
  NEW.invoice_number := 'RWN-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_invoice_number ON public.purchases;
CREATE TRIGGER set_invoice_number
  BEFORE INSERT ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.generate_invoice_number();

-- ─────────────────────────────────────
-- 4. DOWNLOAD TOKENS  (15-min secure links)
-- ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.download_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_id UUID REFERENCES public.purchases(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  token       TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '15 minutes',
  used_at     TIMESTAMPTZ,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────
-- 5. DOWNLOADS LOG  (every download tracked)
-- ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.downloads (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_id   UUID REFERENCES public.purchases(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address    TEXT,
  user_agent    TEXT,
  downloaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────
-- 6. ROW LEVEL SECURITY
-- ─────────────────────────────────────
ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.download_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.downloads       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_own"    ON public.profiles        FOR ALL    USING (auth.uid() = id);
CREATE POLICY "products_read"   ON public.products        FOR SELECT USING (is_active = TRUE);
CREATE POLICY "purchases_own"   ON public.purchases       FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "purchases_insert" ON public.purchases      FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "tokens_own"      ON public.download_tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "downloads_own"   ON public.downloads       FOR SELECT USING (auth.uid() = user_id);

-- ─────────────────────────────────────
-- 7. FUNCTION: record download + enforce limit
-- ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_download(
  p_purchase_id UUID,
  p_user_id     UUID,
  p_ip          TEXT DEFAULT NULL,
  p_ua          TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_limit INTEGER;
  v_used  INTEGER;
BEGIN
  SELECT downloads_limit, downloads_used
  INTO   v_limit, v_used
  FROM   public.purchases
  WHERE  id = p_purchase_id
  FOR UPDATE;

  IF v_used >= v_limit THEN RETURN FALSE; END IF;

  UPDATE public.purchases
  SET    downloads_used = downloads_used + 1
  WHERE  id = p_purchase_id;

  INSERT INTO public.downloads (purchase_id, user_id, ip_address, user_agent)
  VALUES (p_purchase_id, p_user_id, p_ip, p_ua);

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────
-- 8. FUNCTION: guest purchase lookup (for success page)
-- ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_purchase_by_email(
  p_email       TEXT,
  p_purchase_id UUID
)
RETURNS TABLE (
  id               UUID,
  invoice_number   TEXT,
  amount           NUMERIC,
  status           TEXT,
  downloads_limit  INT,
  downloads_used   INT,
  account_created  BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT pu.id, pu.invoice_number, pu.amount, pu.status,
         pu.downloads_limit, pu.downloads_used, pu.account_created
  FROM   public.purchases pu
  WHERE  pu.id = p_purchase_id
    AND  (pu.guest_email = p_email OR pu.email = p_email)
    AND  pu.status = 'completed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────
-- 9. VIEWS
-- ─────────────────────────────────────

-- User library (authenticated users)
CREATE OR REPLACE VIEW public.user_library AS
SELECT
  p.id,
  p.invoice_number,
  p.amount,
  p.currency,
  p.status,
  p.payment_method,
  p.downloads_limit,
  p.downloads_used,
  (p.downloads_limit - p.downloads_used) AS downloads_remaining,
  p.created_at,
  pr.id         AS product_id,
  pr.name       AS product_name,
  pr.version    AS product_version,
  pr.file_path,
  pr.updated_at AS product_updated_at
FROM   public.purchases p
JOIN   public.products  pr ON pr.id = p.product_id
WHERE  p.user_id = auth.uid()
  AND  p.status  = 'completed';

-- Legacy view (backward compat)
CREATE OR REPLACE VIEW public.user_purchases AS
SELECT * FROM public.user_library;

-- ─────────────────────────────────────
-- 10. updated_at triggers
-- ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at  BEFORE UPDATE ON public.profiles  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER purchases_updated_at BEFORE UPDATE ON public.purchases FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER products_updated_at  BEFORE UPDATE ON public.products  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ─────────────────────────────────────
-- 11. STORE SETTINGS
-- ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.store_settings (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_name       TEXT DEFAULT 'رَوْنَق',
  store_tagline    TEXT DEFAULT 'دليل التنظيف الاحترافي',
  product_name     TEXT DEFAULT 'كتاب رَوْنَق — دليل التنظيف الاحترافي',
  product_price    NUMERIC(10,3) DEFAULT 15.000,
  product_currency TEXT DEFAULT 'KWD',
  product_id       UUID DEFAULT 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  whatsapp         TEXT DEFAULT '+96500000000',
  email            TEXT DEFAULT 'hello@rwnk.co',
  instagram        TEXT DEFAULT '@rwnak.official',
  twitter          TEXT DEFAULT '@rwnk',
  primary_color    TEXT DEFAULT '#6747B2',
  downloads_limit  INTEGER DEFAULT 5,
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Only admins can edit (use service role key in admin panel)
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_public_read" ON public.store_settings FOR SELECT USING (TRUE);

-- Insert default settings
INSERT INTO public.store_settings DEFAULT VALUES ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────
-- 12. DISCOUNT CODES
-- ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.discount_codes (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code           TEXT UNIQUE NOT NULL,
  discount_type  TEXT NOT NULL CHECK (discount_type IN ('percent','fixed')),
  discount_value NUMERIC(10,3) NOT NULL,
  max_uses       INTEGER DEFAULT NULL,        -- NULL = unlimited
  used_count     INTEGER DEFAULT 0,
  expires_at     TIMESTAMPTZ DEFAULT NULL,    -- NULL = no expiry
  is_active      BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
-- Codes are verified server-side only (no direct client access to all codes)
CREATE POLICY "codes_admin_only" ON public.discount_codes FOR ALL USING (FALSE);

-- Function: validate and apply discount code
CREATE OR REPLACE FUNCTION public.apply_discount_code(
  p_code    TEXT,
  p_amount  NUMERIC
)
RETURNS TABLE (
  valid          BOOLEAN,
  discount_type  TEXT,
  discount_value NUMERIC,
  final_amount   NUMERIC,
  message        TEXT
) AS $$
DECLARE
  v_code public.discount_codes%ROWTYPE;
BEGIN
  SELECT * INTO v_code FROM public.discount_codes
  WHERE UPPER(code) = UPPER(p_code) AND is_active = TRUE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::NUMERIC, p_amount, 'كود الخصم غير صحيح'::TEXT;
    RETURN;
  END IF;

  IF v_code.expires_at IS NOT NULL AND v_code.expires_at < NOW() THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::NUMERIC, p_amount, 'كود الخصم منتهي الصلاحية'::TEXT;
    RETURN;
  END IF;

  IF v_code.max_uses IS NOT NULL AND v_code.used_count >= v_code.max_uses THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::NUMERIC, p_amount, 'تم استخدام كود الخصم بالكامل'::TEXT;
    RETURN;
  END IF;

  DECLARE
    v_final NUMERIC;
  BEGIN
    IF v_code.discount_type = 'percent' THEN
      v_final := p_amount * (1 - v_code.discount_value / 100);
    ELSE
      v_final := GREATEST(0, p_amount - v_code.discount_value);
    END IF;

    RETURN QUERY SELECT TRUE, v_code.discount_type, v_code.discount_value, v_final,
      CASE WHEN v_code.discount_type = 'percent'
        THEN 'خصم ' || v_code.discount_value || '%'
        ELSE 'خصم ' || v_code.discount_value || ' د.ك'
      END;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: increment discount code usage
CREATE OR REPLACE FUNCTION public.use_discount_code(p_code TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.discount_codes
  SET used_count = used_count + 1
  WHERE UPPER(code) = UPPER(p_code) AND is_active = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
