import React, { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { MessageSquare, BookOpen, GraduationCap, Users, Compass, ArrowRight, Sparkles } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { InputBar } from '@/components/input/InputBar'
import { AuroraBackground } from '@/components/ui/aceternity/AuroraBackground'
import { TextGenerateEffect } from '@/components/ui/aceternity/TextGenerateEffect'
import { SpotlightCard } from '@/components/ui/aceternity/SpotlightCard'
import { AnimatedCounter } from '@/components/ui/reactbits/AnimatedCounter'
import { Magnetic } from '@/components/ui/reactbits/Magnetic'
import { greeting, timeAgo, fmt } from '@/lib/utils'
import { runChat } from '@/lib/chat/runChat'

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

  return (
    <div className="h-full overflow-y-auto relative">
      <AuroraBackground className="absolute inset-0 pointer-events-none" />
      <div className="relative z-10 max-w-[860px] mx-auto px-5 pt-[9vh] pb-16">
        {/* Greeting */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="text-center">
          <h1 className="text-[clamp(26px,4vw,36px)] font-semibold" style={{ letterSpacing: '-0.02em' }}>
            {greeting()}.
          </h1>
          <TextGenerateEffect
            text="What would you like to research today?"
            className="text-[15px] mt-1.5"
            duration={0.7}
            delay={0.15}
          />
        </motion.div>

        {/* Input */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.3 }}>
          <InputBar big autoFocus={false} chatId="home" emptyHistory onSend={sendFromHome}
            streaming={false} onStop={() => {}} mathMode={mathMode} setMathMode={setMathMode} />
        </motion.div>

        {/* Rotating suggestion chips */}
        <div className="flex flex-wrap justify-center gap-2 -mt-2 mb-10 min-h-[34px]">
          {chips.map((c, i) => (
            <Magnetic key={c} strength={0.2}>
              <motion.button
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => sendFromHome(c)}
                className="px-3.5 py-1.5 rounded-full text-[12px] transition-colors hover:border-[var(--primary)]"
                style={{ border: '1px solid var(--surface-border)', color: 'var(--text-2)', background: 'var(--surface)' }}
              >
                {c}
              </motion.button>
            </Magnetic>
          ))}
        </div>

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

            <BentoCard className="grad-article" title="AIFlowEngine" icon={Sparkles}>
              <div className="mt-3">
                <div className="text-3xl font-semibold text-white" style={{ letterSpacing: '-0.02em' }}>
                  <AnimatedCounter value={saved} duration={900} />
                </div>
                <div className="text-[11.5px] text-white/70 mt-1">tokens saved across all sessions</div>
              </div>
            </BentoCard>

            <BentoCard className="grad-quiz" title="Articles" icon={BookOpen} onClick={() => navigate('/articles')}>
              <div className="text-[12px] text-white/80 mt-3">
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

function BentoCard({ title, icon: Icon, children, className = '', onClick, plain = false }: {
  title: string; icon: any; children: React.ReactNode; className?: string; onClick?: () => void; plain?: boolean
}) {
  return (
    <motion.div
      whileHover={onClick ? { y: -2 } : undefined}
      onClick={onClick}
      className={`p-4 rounded-[18px] min-h-[130px] ${className}`}
      style={plain ? { background: 'var(--surface)', border: '1px solid var(--surface-border)' } : undefined}
    >
      <div className={`flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider ${plain ? '' : 'text-white/80'}`}
        style={plain ? { color: 'var(--text-2)' } : undefined}>
        <Icon size={14} strokeWidth={1.8} /> {title}
      </div>
      {children}
    </motion.div>
  )
}

function GettingStarted() {
  const navigate = useNavigate()
  const items = [
    { title: 'Ask with citations', desc: 'Toggle Search to get sourced answers with numbered citations.', icon: MessageSquare, grad: 'grad-research', go: () => navigate(`/chat/${useStore.getState().newChat()}`) },
    { title: 'Read & Quiz', desc: 'Drop a PDF or notes — get quizzes, flashcards and progress.', icon: GraduationCap, grad: 'grad-quiz', go: () => navigate('/quiz') },
    { title: 'Write articles', desc: 'Turn any conversation into a structured, exportable article.', icon: BookOpen, grad: 'grad-article', go: () => navigate('/articles') },
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
