// Pure decision logic for "which Storage path does this download actually
// serve" — no network/database I/O, so /api/download's language-selection
// branching can be unit tested directly instead of only being provable via
// a live HTTP round-trip. Extracted specifically because "an Arabic
// purchase must never receive the English file, and vice versa" is a hard
// correctness requirement, not just a nice-to-have fallback — this is the
// one place that decision is made, and it needs its own tests independent
// of whatever the live database's migration state happens to be.

export type BookLanguage = 'ar' | 'en'

export interface ProductFiles {
  file_path?: string | null      // legacy pre-bilingual single-file column
  file_path_ar?: string | null
  file_path_en?: string | null
}

// `rawLanguage` is whatever purchases.book_language actually contains —
// which may be null/undefined (column missing because the migration in
// supabase/schema.sql §15 hasn't been applied yet, or a row created before
// this feature existed) or, in principle, some unexpected value if the
// column's CHECK constraint were ever bypassed (e.g. a direct DB edit).
// Anything other than the literal string 'en' resolves to 'ar' — the same
// default the database column itself uses — so this function's behavior
// always matches what a fresh purchase row would actually contain.
export function resolveBookLanguage(rawLanguage: string | null | undefined): BookLanguage {
  return rawLanguage === 'en' ? 'en' : 'ar'
}

export interface ResolvedFile {
  language: BookLanguage
  filePath: string | null
  // True only when the customer's actual language could not be honored and
  // a DIFFERENT language's file was served instead (or none was available)
  // — this is the one signal that distinguishes "correctly served the
  // requested language" from "gracefully degraded because that language's
  // file isn't configured yet". The caller logs a warning whenever this is
  // true; it is never true when filePath matches what the language asked for.
  degraded: boolean
}

// The single source of truth for language -> file path. An Arabic request
// NEVER returns file_path_en, and an English request NEVER returns
// file_path_ar UNLESS file_path_en is genuinely unavailable (not yet
// uploaded) — in which case `degraded: true` signals exactly that, rather
// than silently pretending the correct file was served. `file_path` (the
// legacy single-file column) is the last-resort fallback for either
// language, for a product row that predates this feature entirely.
export function resolveProductFilePath(rawLanguage: string | null | undefined, product: ProductFiles | null | undefined): ResolvedFile {
  const language = resolveBookLanguage(rawLanguage)

  if (language === 'en') {
    if (product?.file_path_en) return { language, filePath: product.file_path_en, degraded: false }
    const fallback = product?.file_path_ar || product?.file_path || null
    return { language, filePath: fallback, degraded: true }
  }

  if (product?.file_path_ar) return { language, filePath: product.file_path_ar, degraded: false }
  const fallback = product?.file_path || null
  return { language, filePath: fallback, degraded: fallback !== null }
}

// ── Dynamic (book_languages-backed) resolution ───────────────
// Added for the admin-managed language system: book_languages.language_code
// is now the source of truth for ANY language (not just ar/en), per
// `purchase_id -> book_language -> book_languages -> file_path`. The ar/en
// product columns above are kept as a fallback ONLY for the two languages
// that predate this table (a purchase made before this migration ran, or a
// live database where the migration hasn't been applied yet) — a language
// the admin adds from the dashboard has no such legacy fallback and simply
// resolves to null (caller shows a clear error) if its file is missing.

export interface BookLanguageRow {
  file_path: string | null
}

export interface ResolvedBookFile {
  filePath: string | null
  // True whenever the row's own file_path could not be used directly — either
  // it fell back to the legacy ar/en product columns, or no file exists at
  // all for this language. Mirrors ResolvedFile.degraded's contract: the
  // caller logs a warning whenever this is true.
  degraded: boolean
}

// `bookLanguageRow` is intentionally NOT filtered by is_active by the
// caller — a disabled language must keep serving its EXISTING purchasers
// (see §11 of the feature spec: disabling only hides it from new checkouts).
// `legacyProduct` is only consulted for 'ar'/'en', matching the exact two
// codes the pre-dynamic system ever supported.
export function resolveBookLanguageFile(
  languageCode: string,
  bookLanguageRow: BookLanguageRow | null | undefined,
  legacyProduct?: ProductFiles | null
): ResolvedBookFile {
  if (bookLanguageRow?.file_path) {
    return { filePath: bookLanguageRow.file_path, degraded: false }
  }

  if (languageCode === 'ar' || languageCode === 'en') {
    const fallback = resolveProductFilePath(languageCode, legacyProduct)
    return { filePath: fallback.filePath, degraded: true }
  }

  return { filePath: null, degraded: true }
}
