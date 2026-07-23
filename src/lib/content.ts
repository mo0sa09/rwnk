// Public content fetchers — read-only, anon key.
// Every function falls back to today's hardcoded copy so the site
// still renders correctly before the CMS migration has been run.

import type { Metadata } from 'next'
import type { Testimonial, Faq, Feature, ComparisonRow, PageContent } from '@/types'

export function pageMetadata(page: PageContent): Metadata {
  const description = page.meta_description ?? undefined
  return {
    title: page.title,
    description,
    openGraph: { title: `${page.title} | رَوْنَق`, description, type: 'website' },
    twitter: { card: 'summary_large_image', title: `${page.title} | رَوْنَق`, description },
  }
}

async function getSb() {
  const { createClient } = await import('@supabase/supabase-js')
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  ) as any
}

const FALLBACK_TESTIMONIALS: Testimonial[] = [
  { id: 'f1', name: 'أم ماجد',      location: 'الكويت',  image_url: null, rating: 5, review_text: 'اشتريت الكتاب وأعطيته للعاملة. الأسبوع الأول كان فرقاً واضحاً.',   sort_order: 1, is_active: true },
  { id: 'f2', name: 'نورة العنزي',  location: 'الرياض',  image_url: null, rating: 5, review_text: 'استخدمناه في تدريب موظفاتنا. وفّر وقت التدريب ورفع مستوى الخدمة.', sort_order: 2, is_active: true },
  { id: 'f3', name: 'سارة الدوسري', location: 'البحرين', image_url: null, rating: 4, review_text: 'القوائم الجاهزة للطباعة هي الأفضل — علّقتها في المطبخ والحمام.',   sort_order: 3, is_active: true },
]

const FALLBACK_FAQS: Faq[] = [
  { id: 'f1', question: 'كيف أستلم الكتاب بعد الشراء؟', answer: 'تحميل فوري — بعد الدفع تصلك رسالة برابط التحميل المباشر.', sort_order: 1, is_active: true },
  { id: 'f2', question: 'هل يمكنني طباعة الكتاب؟',      answer: 'نعم، مصمم للطباعة. القوائم والجداول بتنسيق A4 جاهز.',       sort_order: 2, is_active: true },
  { id: 'f3', question: 'هل يناسب كل أنواع المنازل؟',   answer: 'نعم، ليناسب الشقق والفلل بمختلف أحجامها في منطقة الخليج.',  sort_order: 3, is_active: true },
  { id: 'f4', question: 'هل هناك تحديثات مستقبلية؟',    answer: 'نعم، جميع التحديثات مجانية لمن اشترى النسخة الأولى.',      sort_order: 4, is_active: true },
]

const FALLBACK_FEATURES: Feature[] = [
  { id: 'f1', icon: 'IconStarFilled', title: 'معايير 5 نجوم',      description: 'أسس التنظيف المستوحاة من الفنادق الراقية مُطبَّقة على بيئة المنزل', sort_order: 1, is_active: true },
  { id: 'f2', icon: 'IconCheck',      title: 'قوائم تفتيش جاهزة',  description: 'لكل غرفة قائمة منفصلة — لا شيء يُنسى، لا شيء يُهمل',                sort_order: 2, is_active: true },
  { id: 'f3', icon: 'IconCalendar',   title: 'جداول منظمة',        description: 'يومية · أسبوعية · شهرية — جاهزة للطباعة والتطبيق فوراً',            sort_order: 3, is_active: true },
]

const FALLBACK_COMPARISON: ComparisonRow[] = [
  { id: 'f1', label: 'باللغة العربية',      rwnk_has: true, others_has: false, sort_order: 1, is_active: true },
  { id: 'f2', label: 'مستوى الفنادق',       rwnk_has: true, others_has: false, sort_order: 2, is_active: true },
  { id: 'f3', label: 'قوائم جاهزة للطباعة', rwnk_has: true, others_has: false, sort_order: 3, is_active: true },
  { id: 'f4', label: 'تحديثات مجانية',      rwnk_has: true, others_has: false, sort_order: 4, is_active: true },
  { id: 'f5', label: 'ضمان استرجاع 7 أيام', rwnk_has: true, others_has: false, sort_order: 5, is_active: true },
  { id: 'f6', label: 'دفعة واحدة',          rwnk_has: true, others_has: false, sort_order: 6, is_active: true },
]

const FALLBACK_PAGES: Record<string, PageContent> = {
  about: {
    slug: 'about', title: 'من نحن',
    meta_description: 'تعرّفي على قصة رَوْنَق ورسالتنا في رفع مستوى التنظيف المنزلي.',
    content: 'رَوْنَق دليل تدريبي رقمي يهدف إلى رفع مستوى التنظيف المنزلي إلى معايير الفنادق الخمس نجوم.\n\nنؤمن أن كل منزل يستحق العناية والدقة نفسها التي تحصل عليها أفخم الفنادق، دون الحاجة إلى خبرة سابقة أو تدريب مكلف.\n\nفريقنا صمّم هذا الدليل بالتعاون مع خبراء تنظيف محترفين، ليكون مرجعاً عملياً وسهل التطبيق لأي عاملة منزلية أو ربة بيت في منطقة الخليج.',
  },
  terms: {
    slug: 'terms', title: 'شروط الاستخدام',
    meta_description: 'الشروط والأحكام الخاصة باستخدام موقع وخدمات رَوْنَق.',
    content: 'باستخدامك لموقع رَوْنَق وشراء منتجاتنا الرقمية، فإنك توافقين على الشروط التالية:\n\nالمنتج رقمي بالكامل (ملف PDF) ويُسلَّم فور إتمام الدفع عبر رابط تحميل آمن.\n\nيُمنع إعادة بيع أو توزيع أو نشر محتوى الدليل دون إذن كتابي مسبق.\n\nنحتفظ بحقنا في تحديث محتوى الدليل وأسعاره في أي وقت دون إشعار مسبق للمشتريات المستقبلية.\n\nجميع المشتريات الحالية تحصل على التحديثات مجانًا مدى الحياة.',
  },
  privacy: {
    slug: 'privacy', title: 'سياسة الخصوصية',
    meta_description: 'كيف نجمع ونستخدم ونحمي بياناتك الشخصية في رَوْنَق.',
    content: 'نحترم خصوصيتك ونلتزم بحماية بياناتك الشخصية.\n\nنجمع فقط المعلومات الضرورية لإتمام عملية الشراء والتحميل: الاسم، البريد الإلكتروني، ورقم الهاتف عند توفره.\n\nلا نشارك بياناتك مع أي طرف ثالث لأغراض تسويقية دون موافقتك الصريحة.\n\nتُستخدم بيانات الدفع فقط عبر بوابات دفع آمنة ومعتمدة، ولا يتم تخزين بيانات البطاقات لدينا.\n\nيمكنك طلب حذف بياناتك في أي وقت عبر التواصل معنا.',
  },
  refund: {
    slug: 'refund', title: 'سياسة الاسترجاع',
    meta_description: 'تفاصيل ضمان الاسترجاع الكامل خلال 7 أيام من الشراء.',
    content: 'نقدّم ضمان استرجاع كامل خلال 7 أيام من تاريخ الشراء.\n\nإذا لم تكوني راضية عن المنتج لأي سبب، تواصلي معنا خلال 7 أيام وسنُعيد لك المبلغ بالكامل دون أي أسئلة.\n\nلطلب الاسترجاع، يُرجى التواصل عبر البريد الإلكتروني أو واتساب مع ذكر رقم الفاتورة.\n\nتتم معالجة طلبات الاسترجاع خلال 3-5 أيام عمل وتُعاد الأموال بنفس وسيلة الدفع الأصلية.',
  },
}

export async function getTestimonials(): Promise<Testimonial[]> {
  try {
    const sb = await getSb()
    const { data, error } = await sb.from('testimonials').select('*').eq('is_active', true).order('sort_order', { ascending: true })
    if (error || !data || data.length === 0) return FALLBACK_TESTIMONIALS
    return data
  } catch { return FALLBACK_TESTIMONIALS }
}

export async function getFaqs(): Promise<Faq[]> {
  try {
    const sb = await getSb()
    const { data, error } = await sb.from('faqs').select('*').eq('is_active', true).order('sort_order', { ascending: true })
    if (error || !data || data.length === 0) return FALLBACK_FAQS
    return data
  } catch { return FALLBACK_FAQS }
}

export async function getFeatures(): Promise<Feature[]> {
  try {
    const sb = await getSb()
    const { data, error } = await sb.from('features').select('*').eq('is_active', true).order('sort_order', { ascending: true })
    if (error || !data || data.length === 0) return FALLBACK_FEATURES
    return data
  } catch { return FALLBACK_FEATURES }
}

export async function getComparisonRows(): Promise<ComparisonRow[]> {
  try {
    const sb = await getSb()
    const { data, error } = await sb.from('comparison_rows').select('*').eq('is_active', true).order('sort_order', { ascending: true })
    if (error || !data || data.length === 0) return FALLBACK_COMPARISON
    return data
  } catch { return FALLBACK_COMPARISON }
}

export async function getPage(slug: 'about' | 'terms' | 'privacy' | 'refund'): Promise<PageContent> {
  try {
    const sb = await getSb()
    const { data, error } = await sb.from('pages').select('*').eq('slug', slug).single()
    if (error || !data) return FALLBACK_PAGES[slug]
    return data
  } catch { return FALLBACK_PAGES[slug] }
}
