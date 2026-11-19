import { ActivityTrace } from './ActivityTrace'
import { BoardQuestionnaire } from '@/components/ui/boardui/Questionnaire'
import { AttachmentCarousel } from './AttachmentCarousel'
import React, { useState } from 'react'
import { motion } from 'motion/react'
import { Wrench, CheckCircle2, XCircle, ShieldAlert, ClipboardList, Send, Code as CodeIcon } from 'lucide-react'
import type { ChatMessage } from '@/types'
import { submitQuestionnaire, resolveExec } from '@/lib/chat/tools'
// Aceternity's Images Badge — a folder whose papers fan out under the pointer.
import { ImagesBadge } from '@/components/ui/aceternity/ImagesBadge'
import { ApprovalCard } from '@/components/ui/kit/beui/ApprovalCard'
import { openBirdsEye } from '@/components/graph/BirdsEyeWindow'

/* Existing call site; both modern and historical events use one SortUI trace. */
export function ToolTraceChips({ msg }: { msg: ChatMessage; streaming?: boolean }) {
  return <ActivityTrace activities={msg.toolActivity} legacy={msg.toolTrace} onOpenGraph={openBirdsEye} />
}

/* ---------- research chat → coding chat ---------- */

/**
 * The moment a research conversation becomes a coding one.
 *
 * The AI calls `start_coding_mode` (a client-side tool that only exists in this
 * app) and the transcript moves into a project with the IDE tools. This card is
 * the receipt: it says what happened and offers the workspace again, because
 * the automatic switch also happens by itself.
 */
export function CodingModeCard({ project, reason }: { project?: string; reason?: string }) {
  if (!project) return null
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className="p-3.5 rounded-[14px] mb-3 flex items-start gap-3"
      style={{ background: 'color-mix(in srgb, var(--primary) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--primary) 32%, transparent)' }}>
      <span className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
        style={{ background: 'color-mix(in srgb, var(--primary) 16%, transparent)', color: 'var(--primary)' }}>
        <CodeIcon size={15} strokeWidth={1.6} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-medium mb-0.5">This chat is now a coding chat</div>
        <p className="text-[11.5px] mb-2" style={{ color: 'var(--text-2)' }}>
          {reason || `It works inside the project “${project}” and can read files, edit them and run commands there.`}
        </p>
        <button
          onClick={() => { window.location.hash = `#/code?project=${encodeURIComponent(project)}` }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[12px] font-medium"
          style={{ background: 'var(--primary)', color: '#fff' }}>
          <CodeIcon size={12} /> Open the coding workspace
        </button>
      </div>
    </motion.div>
  )
}

/* ---------- command approval (Coding-mode safety) ---------- */
export function ExecApproval({ chatId, msg }: { chatId: string; msg: ChatMessage }) {
  const pe = msg.pendingExec
  if (!pe) return null
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mb-3">
      {/* The AI paused for a yes or no. The card says what it wants to run and waits. */}
      <ApprovalCard
        title="Command approval required"
        description={pe.reason || 'The AI wants to run this command inside the project folder. It only runs if you approve.'}
        command={`$ ${pe.command}`}
        onDecide={(d) => resolveExec(chatId, msg.id, pe.toolCallId, d === 'approve')}
      />
    </motion.div>
  )
}

/* ---------- AI-generated questionnaire ---------- */
export function QuestionnaireCard({ chatId, msg }: { chatId: string; msg: ChatMessage }) {
  if (!msg.questionnaire) return null
  return <BoardQuestionnaire key={msg.questionnaire.toolCallId ?? msg.id} questionnaire={msg.questionnaire} onSubmit={(answers) => {
    if (msg.questionnaire?.toolCallId) submitQuestionnaire(chatId, msg.id, msg.questionnaire.toolCallId, answers)
  }} />
}

/* ---------- attachment strip (vision) ---------- */
export function AttachmentStrip({ msg }: { msg: ChatMessage }) {
  if (!msg.attachments?.length) return null
  const images = msg.attachments.filter((a) => a.type === 'image')
  return (
    <div className="flex flex-col items-end gap-2 mb-2">
      {/* What you attached, as the papers of a folder: the badge keeps a thread
          with three screenshots in it from turning into three full-size images
          above every message. Hover it and they fan out. */}
      {images.length > 1 && <AttachmentCarousel images={images} />}
      {images.length === 1 && (
        <ImagesBadge
          className="self-end"
          folderSize={{ width: 40, height: 30 }}
          hoverImageSize={{ width: 74, height: 50 }}
          images={images.map((a) => a.dataUrl)}
          teaserImageSize={{ width: 24, height: 17 }}
          text={`${images.length} attachment${images.length === 1 ? '' : 's'}`}
        />
      )}
      {images.length <= 1 && <div className="flex flex-wrap justify-end gap-2">
        {msg.attachments.map((a, i) => (
          <img key={i} src={a.dataUrl} alt={a.name} title={a.name}
            className="max-h-40 max-w-[240px] object-contain rounded-[10px]"
            style={{ border: '1px solid var(--surface-border)' }} />
        ))}
      </div>}
    </div>
  )
}

export { Wrench, XCircle, ShieldAlert }
