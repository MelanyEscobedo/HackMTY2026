const BASE = '/api'

export interface Account {
  _id: string
  type: string
  nickname: string
  rewards: number
  balance: number
  account_number?: string
  customer_id?: string
}

export interface ChatMessage {
  role: 'user' | 'model'
  text: string
}

export interface ChatResponse {
  reply: string
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail =
        typeof body.detail === 'string'
          ? body.detail
          : JSON.stringify(body.detail ?? body)
    } catch {
      // keep statusText fallback
    }
    throw new Error(detail)
  }
  return res.json() as Promise<T>
}

export const fetchAccounts = () => request<Account[]>('/accounts')

export const sendChat = (messages: ChatMessage[]) =>
  request<ChatResponse>('/chat', {
    method: 'POST',
    body: JSON.stringify({ messages }),
  })