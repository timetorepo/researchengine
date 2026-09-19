import React, { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { MessageSquare, BookOpen, GraduationCap, Users, Compass, ArrowRight, Sparkles, UploadCloud, Search, Code2, Swords, Calculator } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { InputBar } from '@/components/input/InputBar'
import { AuroraBackground } from '@/components/ui/aceternity/AuroraBackground'
import { SpotlightCard } from '@/components/ui/aceternity/SpotlightCard'
import { AnimatedCounter } from '@/components/ui/reactbits/AnimatedCounter'
import { Magnetic } from '@/components/ui/reactbits/Magnetic'
import { timeAgo, fmt } from '@/lib/utils'
import { runChat } from '@/lib/chat/runChat'
import { RevolvingText } from './RevolvingText'
import { SuggestedForYou } from './SuggestedForYou'

const SUGGESTIONS = [
  'Compare RAG vs fine-tuning for domain-specific Q&A',
  'Derive the gradient of softmax cross-entropy',
  'Summarize the evidence on sleep and memory consolidation',
  'Write a literature review outline for CRISPR off-target effects',
  'Explain transformer attention like I teach undergrads',
  'What changed in TLS 1.3 vs 1.2, and why?',
  'Draft a quiz on cellular respiration from my notes',
  'Is dark matter still the leading explanation? Weigh the alternatives',
]

export function HomeScreen() {
  const navigate = useNavigate()
  const chats = useStore((s) => s.chats)
  const articles = useStore((s) => s.articles)
  const spaces = useStore((s) => s.spaces)
  const saved = useStore((s) => s.tokensSavedLifetime)
  const [chips, setChips] = useState<string[]>(() => pick(SUGGESTIONS))
  const [mathMode, setMathMode] = useState(false)
  const verbs = useMemo(() => [
    { word: 'research', icon: Search, color: 'var(--primary)' },
    { word: 'build', icon: Code2, color: 'var(--success)' },
    { word: 'challenge', icon: Swords, color: 'var(--warning)' },
    { word: 'calculate', icon: Calculator, color: 'var(--secondary)' },
    { word: 'learn', icon: BookOpen, color: 'var(--primary)' },
  ], [])

  useEffect(() => {
    const iv = setInterval(() => setChips(pick(SUGGESTIONS)), 8000)
    return () => clearInterval(iv)
  }, [])

  const recentChats = useMemo(() => [...chats].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3), [chats])
  const hasHistory = chats.length > 0 || articles.length > 0

  const sendFromHome = (prompt: string, opts?: { search?: boolean; quality?: boolean; replicate?: boolean }) => {
    const id = useStore.getState().newChat()
    navigate(`/chat/${id}`)
    setTimeout(() => runChat({
      chatId: id, prompt,
      mode: { math: mathMode || undefined, search: opts?.search || undefined, quality: opts?.quality || undefined, replicate: opts?.replicate || undefined },
    }), 80)
  }

  // Drag & drop a document anywhere on the home screen -> Read & Quiz.
  const [dragOver, setDragOver] = useState(false)
  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes('Files')
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) {
      useUI.setState({ pendingQuizFile: f })
      navigate('/quiz')
    }
  }

  return (
    <div
      className="h-full overflow-y-auto relative"
      onDragEnter={(e) => { if (hasFiles(e)) { e.preventDefault(); setDragOver(true) } }}
      onDragOver={(e) => { if (hasFiles(e)) e.preventDefault() }}
      onDragLeave={(e) => { if (hasFiles(e) && e.currentTarget === e.target) setDragOver(false) }}
      onDrop={onDrop}
    >
      <AuroraBackground className="absolute inset-0 pointer-events-none" />
      <AnimatePresence>
        {dragOver && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none"
            style={{ background: 'color-mix(in srgb, var(--bg) 70%, transparent)', backdropFilter: 'blur(6px)' }}
          >
            <div className="flex flex-col items-center gap-3 px-10 py-8 rounded-[22px]"
              style={{ border: '2px dashed var(--primary)', background: 'color-mix(in srgb, var(--primary) 8%, var(--surface))' }}>
              <UploadCloud size={30} strokeWidth={1.5} style={{ color: 'var(--primary)' }} />
              <div className="text-[15px] font-semibold" style={{ letterSpacing: '-0.01em' }}>Drop to read & quiz</div>
              <div className="text-[12px]" style={{ color: 'var(--text-3)' }}>PDF, DOCX, TXT or Markdown — processed on-device</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="relative z-10 max-w-[860px] mx-auto px-5 pt-[9vh] pb-16">
        {/* Research / build / challenge hero — the rotating word morphs its
            slot width instead of being clipped, and the line scales down rather
            than wrapping (which used to shove the composer south). */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="text-center">
          <RevolvingText
            items={verbs.map((v) => ({ word: v.word, icon: v.icon, color: v.color }))}
            prefix="What do you want to"
            suffix="Today?"
            maxFontPx={46}
            intervalMs={2200}
          />
        </motion.div>

        {/* Input */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.3 }}>
          <InputBar big autoFocus={false} chatId="home" emptyHistory onSend={sendFromHome}
            streaming={false} onStop={() => {}} mathMode={mathMode} setMathMode={setMathMode} />
        </motion.div>

        {/* Suggestions: drawn from your recent chats when there is history,
            otherwise the generic research prompts. */}
        <SuggestedForYou chats={recentChats} onAsk={(prompt, opts) => sendFromHome(prompt, opts)} fallback={chips} />

        {/* Bento grid */}
        {hasHistory ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <BentoCard
              className="sm:col-span-2 grad-research"
              title="Recent research" icon={MessageSquare}
              onClick={() => { if (recentChats[0]) { useStore.getState().setActiveChat(recentChats[0].id); navigate(`/chat/${recentChats[0].id}`) } }}
            >
              <div className="space-y-2 mt-3">
                {recentChats.length === 0 && <div className="text-[12px] text-white/60">No chats yet.</div>}
                {recentChats.map((c) => (
                  <button key={c.id} onClick={(e) => { e.stopPropagation(); useStore.getState().setActiveChat(c.id); navigate(`/chat/${c.id}`) }}
                    className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-[12px] transition-colors hover:bg-white/10"
                    style={{ background: 'rgba(0,0,0,0.22)' }}>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] font-medium text-white truncate">{c.title}</span>
                      <span className="block text-[10.5px] text-white/60">{c.messages.length} messages · {timeAgo(c.updatedAt)}</span>
                    </span>
                    <ArrowRight size={13} className="text-white/50" />
                  </button>
                ))}
              </div>
            </BentoCard>

            <BentoCard className="grad-article" title="AIFlowEngine" icon={Sparkles} center>
              <div>
                <div className="text-3xl font-semibold text-white" style={{ letterSpacing: '-0.02em' }}>
                  <AnimatedCounter value={saved} duration={900} />
                </div>
                <div className="text-[11.5px] text-white/70 mt-1">tokens saved across all sessions</div>
              </div>
            </BentoCard>

            <BentoCard className="grad-quiz" title="Articles" icon={BookOpen} center onClick={() => navigate('/articles')}>
              <div className="text-[12px] text-white/80">
                {articles.length === 0 ? 'Nothing published yet.' : `${articles.length} article${articles.length > 1 ? 's' : ''} in your library.`}
                <button className="mt-2 flex items-center gap-1 text-white font-medium hover:underline" onClick={(e) => { e.stopPropagation(); navigate('/articles') }}>
                  Open <ArrowRight size={12} />
                </button>
              </div>
            </BentoCard>

            <BentoCard className="sm:col-span-2" title="Spaces" icon={Compass} plain>
              <div className="flex flex-wrap gap-2 mt-3">
                {spaces.map((sp) => (
                  <span key={sp.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px]"
                    style={{ background: 'var(--elevated)', border: `1px solid ${sp.color}44`, color: 'var(--text-2)' }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: sp.color }} />
                    {sp.name}
                    <span style={{ color: 'var(--text-3)' }}>· {chats.filter((c) => c.spaceId === sp.id).length}</span>
                  </span>
                ))}
              </div>
            </BentoCard>
          </div>
        ) : (
          <GettingStarted />
        )}
      </div>
    </div>
  )
}

function pick(arr: string[]): string[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, 4)
}

function BentoCard({ title, icon: Icon, children, className = '', onClick, plain = false, center = false }: {
  title: string; icon: any; children: React.ReactNode; className?: string; onClick?: () => void; plain?: boolean; center?: boolean
}) {
  // h-full + flex-fill: when a row neighbor (e.g. Recent research) grows,
  // this card stretches and its content redistributes instead of leaving a
  // dead gradient region.
  return (
    <motion.div
      whileHover={onClick ? { y: -2 } : undefined}
      onClick={onClick}
      className={`p-4 rounded-[18px] min-h-[130px] h-full flex flex-col ${className}`}
      style={plain ? { background: 'var(--surface)', border: '1px solid var(--surface-border)' } : undefined}
    >
      <div className={`flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider ${plain ? '' : 'text-white/80'}`}
        style={plain ? { color: 'var(--text-2)' } : undefined}>
        <Icon size={14} strokeWidth={1.8} /> {title}
      </div>
      <div className={`flex-1 min-h-0 flex flex-col ${center ? 'justify-center' : ''}`}>{children}</div>
    </motion.div>
  )
}

function GettingStarted() {
  const navigate = useNavigate()
  const items = [
    { title: 'Ask with citations', desc: 'Toggle Search to get sourced answers with numbered citations.', icon: MessageSquare, grad: 'grad-research', go: () => navigate(`/chat/${useStore.getState().newChat()}`) },
    { title: 'Read & Quiz', desc: 'Drop a PDF or notes — get quizzes, flashcards and progress.', icon: GraduationCap, grad: 'grad-quiz', go: () => navigate('/quiz') },
    { title: 'Write articles', desc: 'Turn any conversation into a structured, exportable article.', icon: BookOpen, grad: 'grad-article', go: () => navigate('/articles') },
    { title: 'Build in Coding', desc: 'Open a guarded local workspace to edit, run and ship code with AI.', icon: Code2, grad: 'grad-article', go: () => navigate('/code') },
    { title: 'Deploy an Agent Flood', desc: 'Point a squad of specialized agents at one objective.', icon: Users, grad: 'grad-research', go: () => navigate('/flood') },
  ]
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {items.map((it, i) => (
        <motion.div key={it.title} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.06 }}>
          <SpotlightCard
            className={`rounded-[18px] ${it.grad} card-hover`}
            spotlightColor="rgba(255,255,255,0.14)"
            onClick={it.go}
          >
            <div className="p-5">
              <it.icon size={20} strokeWidth={1.5} className="text-white mb-3" />
              <div className="text-[15px] font-semibold text-white" style={{ letterSpacing: '-0.01em' }}>{it.title}</div>
              <div className="text-[12.5px] text-white/70 mt-1 leading-relaxed">{it.desc}</div>
            </div>
          </SpotlightCard>
        </motion.div>
      ))}
    </div>
  )
}
