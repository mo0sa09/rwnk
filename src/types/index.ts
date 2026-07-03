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
