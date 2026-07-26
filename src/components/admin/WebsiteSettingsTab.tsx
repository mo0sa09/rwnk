'use client'
import { useState } from 'react'
import { C } from '@/lib/theme'
import { CrudSection } from './CrudSection'
import { ContentTab } from './ContentTab'
import { PagesTab } from './PagesTab'
import { BrandingTab } from './BrandingTab'
import { SeoTab } from './SeoTab'
import { PageHeader } from './adminUi'

type SubTab = 'branding' | 'homepage' | 'seo' | 'testimonials' | 'faqs' | 'features' | 'comparison' | 'pages'

const SUB_NAV: { id: SubTab; label: string }[] = [
  { id: 'branding',     label: 'الهوية البصرية' },
  { id: 'homepage',     label: 'الصفحة الرئيسية' },
  { id: 'seo',          label: 'SEO' },
  { id: 'testimonials', label: 'الشهادات' },
  { id: 'faqs',         label: 'الأسئلة الشائعة' },
  { id: 'features',     label: 'المميزات' },
  { id: 'comparison',   label: 'المقارنة' },
  { id: 'pages',        label: 'الصفحات القانونية' },
]

export function WebsiteSettingsTab() {
  const [sub, setSub] = useState<SubTab>('branding')

  return (
    <div>
      <PageHeader title="إعدادات الموقع" subtitle="تحكّمي بكامل محتوى وهوية الموقع دون لمس الكود" />

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
        {SUB_NAV.map(s => (
          <button key={s.id} onClick={() => setSub(s.id)} style={{
            height: 36, padding: '0 16px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            background: sub === s.id ? C.primary : '#fff', color: sub === s.id ? '#fff' : C.text2,
            border: `1px solid ${sub === s.id ? C.primary : C.border}`,
          }}>{s.label}</button>
        ))}
      </div>

      {sub === 'branding' && <BrandingTab />}
      {sub === 'homepage' && <ContentTab />}
      {sub === 'seo' && <SeoTab />}
      {sub === 'testimonials' && (
        <CrudSection
          resource="testimonials" title="الشهادات"
          description="أضيفي وعدّلي شهادات العملاء — تظهر في الصفحة الرئيسية عند التفعيل من تبويب الصفحة الرئيسية"
          emptyItem={{ name: '', location: '', image_url: '', rating: 5, review_text: '', is_active: true }}
          fields={[
            { key: 'name', label: 'اسم العميلة' },
            { key: 'location', label: 'الموقع' },
            { key: 'image_url', label: 'رابط الصورة (اختياري)' },
            { key: 'rating', label: 'التقييم (1-5)', type: 'number' },
            { key: 'review_text', label: 'نص التقييم', type: 'textarea' },
            { key: 'is_active', label: 'مفعّل', type: 'checkbox' },
          ]}
          renderLabel={t => t.name}
          renderMeta={t => `${t.rating}★ — ${t.review_text}`}
        />
      )}
      {sub === 'faqs' && (
        <CrudSection
          resource="faqs" title="الأسئلة الشائعة"
          description="أضيفي وعدّلي ورتّبي الأسئلة الشائعة — تظهر في الصفحة الرئيسية وصفحة /faq"
          reorderable
          emptyItem={{ question: '', answer: '', is_active: true }}
          fields={[
            { key: 'question', label: 'السؤال' },
            { key: 'answer', label: 'الإجابة', type: 'textarea' },
            { key: 'is_active', label: 'مفعّل', type: 'checkbox' },
          ]}
          renderLabel={f => f.question}
          renderMeta={f => f.answer}
        />
      )}
      {sub === 'features' && (
        <CrudSection
          resource="features" title="المميزات"
          description="أضيفي وعدّلي شبكة مميزات المنتج في الصفحة الرئيسية"
          emptyItem={{ icon: 'IconCircleCheck', title: '', description: '', is_active: true }}
          fields={[
            { key: 'title', label: 'العنوان' },
            { key: 'description', label: 'الوصف', type: 'textarea' },
            { key: 'icon', label: 'الأيقونة', type: 'select', options: [
              { value: 'IconStarFilled', label: 'نجمة' },
              { value: 'IconCheck', label: 'علامة صح' },
              { value: 'IconCalendar', label: 'تقويم' },
              { value: 'IconPhoto', label: 'صورة' },
              { value: 'IconBook2', label: 'كتاب' },
              { value: 'IconShieldCheck', label: 'درع' },
              { value: 'IconBolt', label: 'برق' },
              { value: 'IconCircleCheck', label: 'دائرة صح' },
            ] },
            { key: 'is_active', label: 'مفعّل', type: 'checkbox' },
          ]}
          renderLabel={f => f.title}
          renderMeta={f => f.description}
        />
      )}
      {sub === 'comparison' && (
        <CrudSection
          resource="comparison_rows" title="جدول المقارنة"
          description="أضيفي وعدّلي صفوف جدول المقارنة بين رَوْنَق والبدائل"
          emptyItem={{ label: '', rwnk_has: true, others_has: false, is_active: true }}
          fields={[
            { key: 'label', label: 'الميزة' },
            { key: 'rwnk_has', label: 'متوفر في رَوْنَق', type: 'checkbox' },
            { key: 'others_has', label: 'متوفر في البدائل', type: 'checkbox' },
            { key: 'is_active', label: 'مفعّل', type: 'checkbox' },
          ]}
          renderLabel={r => r.label}
          renderMeta={r => `رَوْنَق: ${r.rwnk_has ? '✓' : '✗'} — البدائل: ${r.others_has ? '✓' : '✗'}`}
        />
      )}
      {sub === 'pages' && <PagesTab />}
    </div>
  )
}
