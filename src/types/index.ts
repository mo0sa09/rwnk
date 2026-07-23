export interface User {
  id: string
  email: string
  full_name: string
  phone?: string
  created_at: string
}

export interface Purchase {
  id: string
  user_id: string
  product_id: string
  amount: number
  currency: string
  status: 'pending' | 'completed' | 'refunded'
  created_at: string
}

export interface Product {
  id: string
  name: string
  description: string
  price: number
  currency: string
  file_path: string
}

export interface Testimonial {
  id: string
  name: string
  location: string | null
  image_url: string | null
  rating: number
  review_text: string
  sort_order: number
  is_active: boolean
}

export interface Faq {
  id: string
  question: string
  answer: string
  sort_order: number
  is_active: boolean
}

export interface Feature {
  id: string
  icon: string
  title: string
  description: string
  sort_order: number
  is_active: boolean
}

export interface ComparisonRow {
  id: string
  label: string
  rwnk_has: boolean
  others_has: boolean
  sort_order: number
  is_active: boolean
}

export interface PageContent {
  slug: 'about' | 'terms' | 'privacy' | 'refund'
  title: string
  meta_description: string | null
  content: string
}
