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
CREATE POLICY "tokens_own"      ON public.download_tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "downloads_own"   ON public.downloads       FOR SELECT USING (auth.uid() = user_id);

-- Deliberately NO client-writable INSERT/UPDATE policy on purchases.
-- Every write (create pending purchase, mark completed after gateway
-- verification, link to an account) happens server-side through the
-- service-role key, which bypasses RLS entirely. A previous
-- `purchases_insert ... WITH CHECK (TRUE)` policy let anyone using the
-- anon key insert a row with status='completed' directly from the
-- browser — a full payment bypass. If this ran on a database that
-- already has that policy, drop it explicitly:
DROP POLICY IF EXISTS "purchases_insert" ON public.purchases;

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

-- ═══════════════════════════════════════════════════════════
-- 13. CMS — site content, editable from /admin
-- Public SELECT only. All writes go through the server
-- (service-role key), same pattern as discount_codes above.
-- ═══════════════════════════════════════════════════════════

-- 13.1 store_settings — extra editable copy/config
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS product_description   TEXT DEFAULT 'دليل تدريبي احترافي يحوّل عاملتك المنزلية إلى خبيرة تنظيف — بمعايير خمس نجوم.';
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS product_image_url     TEXT;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS hero_badge            TEXT DEFAULT 'الإصدار الأول — متاح الآن';
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS hero_title            TEXT DEFAULT 'منزلك يستحق *مستوى* الفنادق الراقية';
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS hero_subtitle         TEXT DEFAULT 'دليل تدريبي احترافي يحوّل عاملتك المنزلية إلى خبيرة تنظيف — بمعايير خمس نجوم.';
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS hero_cta_text         TEXT DEFAULT 'اشترِ الآن';
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS pricing_cta_text      TEXT DEFAULT 'اشترِ الآن وحمّلي فوراً';
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS final_cta_title       TEXT DEFAULT 'ابدئي رحلتك نحو منزل بمستوى الفنادق اليوم';
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS final_cta_subtitle    TEXT DEFAULT 'انضمي إلى +500 عائلة اختارت رَوْنَق نظاماً لمنازلها';
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS final_cta_button_text TEXT DEFAULT 'اشترِ الآن';
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS footer_cta_title      TEXT DEFAULT 'ابدئي بتحويل منزلك اليوم';
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS footer_cta_subtitle   TEXT DEFAULT 'دليل تنظيف احترافي بمعايير 5 نجوم — تحميل فوري';
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS stats_visible         BOOLEAN DEFAULT FALSE;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS stats                 JSONB DEFAULT '[
  {"value":"+500","label":"نسخة مُباعة"},
  {"value":"4.9","label":"متوسط التقييم"},
  {"value":"7 أيام","label":"ضمان استرجاع"},
  {"value":"5","label":"نجوم معيار"}
]'::jsonb;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS testimonials_visible  BOOLEAN DEFAULT FALSE;

-- 13.2 testimonials
CREATE TABLE IF NOT EXISTS public.testimonials (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  location    TEXT,
  image_url   TEXT,
  rating      INTEGER NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT NOT NULL,
  sort_order  INTEGER DEFAULT 0,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "testimonials_read" ON public.testimonials FOR SELECT USING (is_active = TRUE);

INSERT INTO public.testimonials (name, location, rating, review_text, sort_order) VALUES
  ('أم ماجد',      'الكويت',  5, 'اشتريت الكتاب وأعطيته للعاملة. الأسبوع الأول كان فرقاً واضحاً.',            1),
  ('نورة العنزي',  'الرياض',  5, 'استخدمناه في تدريب موظفاتنا. وفّر وقت التدريب ورفع مستوى الخدمة.',          2),
  ('سارة الدوسري', 'البحرين', 4, 'القوائم الجاهزة للطباعة هي الأفضل — علّقتها في المطبخ والحمام.',            3)
ON CONFLICT DO NOTHING;

-- 13.3 faqs
CREATE TABLE IF NOT EXISTS public.faqs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question    TEXT NOT NULL,
  answer      TEXT NOT NULL,
  sort_order  INTEGER DEFAULT 0,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "faqs_read" ON public.faqs FOR SELECT USING (is_active = TRUE);

INSERT INTO public.faqs (question, answer, sort_order) VALUES
  ('كيف أستلم الكتاب بعد الشراء؟',    'تحميل فوري — بعد الدفع تصلك رسالة برابط التحميل المباشر.',            1),
  ('هل يمكنني طباعة الكتاب؟',         'نعم، مصمم للطباعة. القوائم والجداول بتنسيق A4 جاهز.',                  2),
  ('هل يناسب كل أنواع المنازل؟',      'نعم، ليناسب الشقق والفلل بمختلف أحجامها في منطقة الخليج.',             3),
  ('هل هناك تحديثات مستقبلية؟',       'نعم، جميع التحديثات مجانية لمن اشترى النسخة الأولى.',                  4)
ON CONFLICT DO NOTHING;

-- 13.4 features (solution / benefits grid)
CREATE TABLE IF NOT EXISTS public.features (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  icon        TEXT NOT NULL DEFAULT 'IconCircleCheck',
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  sort_order  INTEGER DEFAULT 0,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "features_read" ON public.features FOR SELECT USING (is_active = TRUE);

-- "تعليمات مصورة" (Illustrated Instructions) intentionally omitted — product doesn't include it
INSERT INTO public.features (icon, title, description, sort_order) VALUES
  ('IconStarFilled', 'معايير 5 نجوم',      'أسس التنظيف المستوحاة من الفنادق الراقية مُطبَّقة على بيئة المنزل', 1),
  ('IconCheck',      'قوائم تفتيش جاهزة',  'لكل غرفة قائمة منفصلة — لا شيء يُنسى، لا شيء يُهمل',                2),
  ('IconCalendar',   'جداول منظمة',        'يومية · أسبوعية · شهرية — جاهزة للطباعة والتطبيق فوراً',            3)
ON CONFLICT DO NOTHING;

-- 13.5 comparison_rows
CREATE TABLE IF NOT EXISTS public.comparison_rows (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  label       TEXT NOT NULL,
  rwnk_has    BOOLEAN DEFAULT TRUE,
  others_has  BOOLEAN DEFAULT FALSE,
  sort_order  INTEGER DEFAULT 0,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.comparison_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comparison_rows_read" ON public.comparison_rows FOR SELECT USING (is_active = TRUE);

INSERT INTO public.comparison_rows (label, rwnk_has, others_has, sort_order) VALUES
  ('باللغة العربية',           TRUE, FALSE, 1),
  ('مستوى الفنادق',            TRUE, FALSE, 2),
  ('قوائم جاهزة للطباعة',      TRUE, FALSE, 3),
  ('تحديثات مجانية',           TRUE, FALSE, 4),
  ('ضمان استرجاع 7 أيام',      TRUE, FALSE, 5),
  ('دفعة واحدة',               TRUE, FALSE, 6)
ON CONFLICT DO NOTHING;

-- 13.6 pages — About / Terms / Privacy / Refund
CREATE TABLE IF NOT EXISTS public.pages (
  slug              TEXT PRIMARY KEY CHECK (slug IN ('about','terms','privacy','refund')),
  title             TEXT NOT NULL,
  meta_description  TEXT,
  content           TEXT NOT NULL,
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pages_read" ON public.pages FOR SELECT USING (TRUE);

INSERT INTO public.pages (slug, title, meta_description, content) VALUES
('about', 'من نحن',
 'تعرّفي على قصة رَوْنَق ورسالتنا في رفع مستوى التنظيف المنزلي.',
 'رَوْنَق دليل تدريبي رقمي يهدف إلى رفع مستوى التنظيف المنزلي إلى معايير الفنادق الخمس نجوم.

نؤمن أن كل منزل يستحق العناية والدقة نفسها التي تحصل عليها أفخم الفنادق، دون الحاجة إلى خبرة سابقة أو تدريب مكلف.

فريقنا صمّم هذا الدليل بالتعاون مع خبراء تنظيف محترفين، ليكون مرجعاً عملياً وسهل التطبيق لأي عاملة منزلية أو ربة بيت في منطقة الخليج.'),

('terms', 'شروط الاستخدام',
 'الشروط والأحكام الخاصة باستخدام موقع وخدمات رَوْنَق.',
 'باستخدامك لموقع رَوْنَق وشراء منتجاتنا الرقمية، فإنك توافقين على الشروط التالية:

المنتج رقمي بالكامل (ملف PDF) ويُسلَّم فور إتمام الدفع عبر رابط تحميل آمن.

يُمنع إعادة بيع أو توزيع أو نشر محتوى الدليل دون إذن كتابي مسبق.

نحتفظ بحقنا في تحديث محتوى الدليل وأسعاره في أي وقت دون إشعار مسبق للمشتريات المستقبلية.

جميع المشتريات الحالية تحصل على التحديثات مجانًا مدى الحياة.'),

('privacy', 'سياسة الخصوصية',
 'كيف نجمع ونستخدم ونحمي بياناتك الشخصية في رَوْنَق.',
 'نحترم خصوصيتك ونلتزم بحماية بياناتك الشخصية.

نجمع فقط المعلومات الضرورية لإتمام عملية الشراء والتحميل: الاسم، البريد الإلكتروني، ورقم الهاتف عند توفره.

لا نشارك بياناتك مع أي طرف ثالث لأغراض تسويقية دون موافقتك الصريحة.

تُستخدم بيانات الدفع فقط عبر بوابات دفع آمنة ومعتمدة، ولا يتم تخزين بيانات البطاقات لدينا.

يمكنك طلب حذف بياناتك في أي وقت عبر التواصل معنا.'),

('refund', 'سياسة الاسترجاع',
 'تفاصيل ضمان الاسترجاع الكامل خلال 7 أيام من الشراء.',
 'نقدّم ضمان استرجاع كامل خلال 7 أيام من تاريخ الشراء.

إذا لم تكوني راضية عن المنتج لأي سبب، تواصلي معنا خلال 7 أيام وسنُعيد لك المبلغ بالكامل دون أي أسئلة.

لطلب الاسترجاع، يُرجى التواصل عبر البريد الإلكتروني أو واتساب مع ذكر رقم الفاتورة.

تتم معالجة طلبات الاسترجاع خلال 3-5 أيام عمل وتُعاد الأموال بنفس وسيلة الدفع الأصلية.')
ON CONFLICT (slug) DO NOTHING;

-- ─────────────────────────────────────
-- 14. AUTH — auto-create/update profile on signup
-- register()/signUp() passes full_name + phone in user metadata;
-- keep the profile row in sync with it (insert on new user, update
-- full_name/phone if the auth user record changes later).
-- ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'phone', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name  = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
    phone      = COALESCE(EXCLUDED.phone, public.profiles.phone),
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (NEW.raw_user_meta_data IS DISTINCT FROM OLD.raw_user_meta_data)
  EXECUTE FUNCTION public.handle_new_user();
