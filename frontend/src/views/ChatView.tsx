import { useEffect, useRef, useState, type FormEvent } from 'react'
import { sendChat, type ChatMessage } from '../api'
import './ChatView.css'

interface Message {
  id: number
  role: 'user' | 'assistant'
  text: string
}

const WELCOME: Message = {
  id: 0,
  role: 'assistant',
  text: "Hi, I'm your Capital You assistant. Ask me about your accounts or finances.",
}

let nextId = 1

function ChatView() {
  const [messages, setMessages] = useState<Message[]>([WELCOME])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages, loading])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || loading) return
    setDraft('')
    setError(null)

    const history: ChatMessage[] = messages
      .filter((m) => m.id !== 0)
      .map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        text: m.text,
      }))
    const userMsg: Message = { id: nextId++, role: 'user', text }
    setMessages((prev) => [...prev, userMsg])
    setLoading(true)

    try {
      const res = await sendChat([...history, { role: 'user', text }])
      const reply: Message = {
        id: nextId++,
        role: 'assistant',
        text: res.reply,
      }
      setMessages((prev) => [...prev, reply])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="view chat-view">
      <header className="banner">
        <h1>Chat</h1>
        <p className="subtitle">Executive voice assistant</p>
      </header>

      <div className="chat" ref={listRef}>
        {messages.map((m) => (
          <div key={m.id} className={`bubble ${m.role}`}>
            {m.text}
          </div>
        ))}
        {loading && (
          <div className="bubble assistant typing" aria-live="polite">
            Thinking…
          </div>
        )}
      </div>

      {error && <p className="msg error">Failed: {error}</p>}

      <form className="chat-form" onSubmit={handleSubmit}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask about your accounts…"
          aria-label="Message"
          disabled={loading}
        />
        <button type="submit" disabled={!draft.trim() || loading}>
          Send
        </button>
      </form>
    </div>
  )
}

export default ChatView