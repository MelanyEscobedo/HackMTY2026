import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { sendChatMessage, speakChatText } from '../api'
import type { Tab } from '../App'
import './ChatWidget.css'

interface ChatWidgetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentTab: Tab
  onNavigate: (tab: Tab) => void
}

interface Suggestion {
  text: string
  scrollTarget?: string
}

const SECTION_SUGGESTIONS: Record<Tab, Suggestion[]> = {
  overview: [{ text: '¿Cómo va mi cuenta?' }, { text: 'Congela mi tarjeta' }],
  alerts: [
    { text: 'Explícame esta alerta', scrollTarget: 'alerts' },
    { text: '¿Debo preocuparme por esto?' },
  ],
  spending: [
    { text: 'Ayúdame a manejar mis gastos', scrollTarget: 'spending' },
    { text: 'Muéstrame la gráfica de mis gastos', scrollTarget: 'spend-bars' },
  ],
  transactions: [
    { text: '¿Qué compré recientemente?', scrollTarget: 'transactions' },
    { text: '¿Algo aquí se ve inusual?' },
  ],
  credit: [{ text: '¿Cuánto sería mi mensualidad?' }, { text: 'Ayúdame a elegir un enganche' }],
}

// scrollTarget id -> which tab that element actually lives in, so a
// suggestion referencing e.g. "spend-bars" switches to the Gastos tab first
// (that element doesn't exist in the DOM until its tab is mounted).
const SCROLL_TARGET_TAB: Record<string, Tab> = {
  alerts: 'alerts',
  spending: 'spending',
  'spend-bars': 'spending',
  transactions: 'transactions',
}

interface Message {
  id: number
  text: string
  isUser: boolean
  isThinking?: boolean
}

let nextId = 1

// Hardcoded reply for common credit questions -- avoids burning a Gemini
// API call on a question we can answer ourselves. Matching is accent-
// and case-insensitive on the normalized text.
const normalizeText = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

const CANNED_REPLIES: { test: (t: string) => boolean; reply: string }[] = [
  {
    test: (t) => t.includes('mensualidad') && t.includes('cuanto'),
    reply:
      '¡Claro! Para estimar tu mensualidad necesito el monto, la tasa (APR) y el plazo. Como ejemplo: un crédito de $200,000 a 15% anual en 60 meses da una mensualidad aproximada de $4,282.19 (intereses totales de ~$76,931). Abre la sección Crédito para calcular tu caso exacto.',
  },
]

function matchCanned(text: string): string | null {
  const norm = normalizeText(text)
  for (const entry of CANNED_REPLIES) {
    if (entry.test(norm)) return entry.reply
  }
  return null
}

function ChatWidget({ open, onOpenChange, currentTab, onNavigate }: ChatWidgetProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [hasGreeted, setHasGreeted] = useState(false)
  const [speakingId, setSpeakingId] = useState<number | null>(null)
  const [speakError, setSpeakError] = useState<string | null>(null)
  const threadRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const speakUrlRef = useRef<string | null>(null)

  function stopSpeaking() {
    const audio = audioRef.current
    if (audio) {
      audio.onended = null
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }
    if (speakUrlRef.current) {
      URL.revokeObjectURL(speakUrlRef.current)
      speakUrlRef.current = null
    }
    setSpeakingId(null)
  }

  async function toggleSpeak(id: number, text: string) {
    if (speakingId === id) {
      stopSpeaking()
      return
    }
    stopSpeaking()
    setSpeakingId(id)
    setSpeakError(null)
    try {
      const blob = await speakChatText(text)
      const url = URL.createObjectURL(blob)
      speakUrlRef.current = url
      const audio = audioRef.current
      if (!audio) return
      audio.src = url
      audio.onended = () => {
        if (speakUrlRef.current) {
          URL.revokeObjectURL(speakUrlRef.current)
          speakUrlRef.current = null
        }
        setSpeakingId(null)
      }
      await audio.play()
    } catch (err) {
      if (speakUrlRef.current) {
        URL.revokeObjectURL(speakUrlRef.current)
        speakUrlRef.current = null
      }
      setSpeakingId(null)
      setSpeakError(err instanceof Error ? err.message : 'No se pudo reproducir el audio')
    }
  }

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight
  }, [messages])

  // Auto-grow the input as the draft gets longer (and reset when it clears).
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [draft])

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const text = draft.trim()
      if (text) sendMessage(text)
    }
  }

  // "Adjust state when a prop changes" pattern (react.dev) instead of an
  // effect -- the panel can be opened either from the fab below or
  // externally (Overview's "Hablar con el asistente" button sets `open`
  // via App), so this has to react to the prop itself, not just a click.
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open && !hasGreeted) {
      setHasGreeted(true)
      setMessages([
        {
          id: nextId++,
          isUser: false,
          text: 'Hola, soy tu asistente. Puedo revisar tu saldo, explicarte una alerta, congelar tu tarjeta o resumir tus gastos.',
        },
      ])
    }
  }

  async function sendMessage(text: string, scrollTarget?: string) {
    if (busy || !text) return
    setBusy(true)
    setMessages((prev) => [...prev, { id: nextId++, text, isUser: true }])
    setDraft('')

    if (scrollTarget) {
      const targetTab = SCROLL_TARGET_TAB[scrollTarget]
      if (targetTab) onNavigate(targetTab)
      setTimeout(() => {
        const el = document.getElementById(scrollTarget)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          el.classList.add('is-pulsing')
          setTimeout(() => el.classList.remove('is-pulsing'), 1600)
        }
      }, 80)
    }

    const canned = matchCanned(text)
    if (canned) {
      setMessages((prev) => [...prev, { id: nextId++, text: canned, isUser: false }])
      setBusy(false)
      return
    }

    const thinkingId = nextId++
    setMessages((prev) => [...prev, { id: thinkingId, text: 'Pensando…', isUser: false, isThinking: true }])

    try {
      const res = await sendChatMessage(text)
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== thinkingId),
        { id: nextId++, text: res.reply, isUser: false },
      ])
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Error desconocido'
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== thinkingId),
        {
          id: nextId++,
          isUser: false,
          text: `No pude conectar con el asistente (${detail}). ¿Está corriendo el backend? Asegúrate de tener GOOGLE_API_KEY o GEMINI_API_KEY en tu .env.`,
        },
      ])
    } finally {
      setBusy(false)
    }
  }

  const suggestions = SECTION_SUGGESTIONS[currentTab] ?? SECTION_SUGGESTIONS.overview

  return (
    <>
      <button
        className="chat-fab"
        type="button"
        aria-label="Abrir el asistente"
        onClick={() => onOpenChange(!open)}
      >
        <span className="chat-fab-dot" aria-hidden="true" />
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5v-8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="chat-panel">
          <div className="chat-panel-head">
            <span className="chat-avatar" aria-hidden="true">CY</span>
            <span className="chat-panel-title">
              <strong>Asistente Capital You</strong>
              <span className="chat-panel-status"><span className="dot" />En línea</span>
            </span>
            <button className="chat-close" type="button" aria-label="Cerrar" onClick={() => onOpenChange(false)}>
              &times;
            </button>
          </div>

          <div className="chat-thread" ref={threadRef}>
            {messages.map((m) => (
              <div key={m.id} className={`chat-msg${m.isUser ? ' is-user' : ''}`}>
                <div className={`chat-bubble${m.isThinking ? ' is-thinking' : ''}`}>{m.text}</div>
                {!m.isUser && !m.isThinking && (
                  <button
                    type="button"
                    className={`chat-speak${speakingId === m.id ? ' is-playing' : ''}`}
                    onClick={() => toggleSpeak(m.id, m.text)}
                    aria-label={speakingId === m.id ? 'Detener audio' : 'Leer mensaje'}
                  >
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M4 10v4h3l4 4V6l-4 4H4Z" fill="currentColor" />
                      <path d="M15 8.5a4 4 0 0 1 0 7M17 6a7 7 0 0 1 0 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="chat-suggestions">
            {suggestions.map((s) => (
              <button
                key={s.text}
                type="button"
                className="chat-chip"
                onClick={() => sendMessage(s.text, s.scrollTarget)}
              >
                {s.text}
              </button>
            ))}
          </div>

          {speakError && <p className="chat-speak-error">{speakError}</p>}

          <form
            className="chat-input-row"
            onSubmit={(e) => {
              e.preventDefault()
              const text = draft.trim()
              if (text) sendMessage(text)
            }}
          >
            <textarea
              ref={inputRef}
              rows={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pregúntame algo…"
              autoComplete="off"
              aria-label="Mensaje"
            />
            <button className="chat-send" type="submit" aria-label="Enviar" disabled={!draft.trim() || busy}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M4 12h16M14 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </form>
          <audio ref={audioRef} hidden />
        </div>
      )}
    </>
  )
}

export default ChatWidget
