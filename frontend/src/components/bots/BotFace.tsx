/**
 * A Bot's face. The drawing is the bot-avatars package (libraries.dev, MIT). A
 * Bot without a chosen avatar gets one from its id, so it keeps the same look.
 */
import { BotAvatar } from 'bot-avatars'
import { avatarTypeFor, type AvatarType, type Bot } from '@/lib/bots/logic'

export function BotFace({ bot, type, size = 28, busy = false }: { bot?: Bot; type?: AvatarType; size?: number; busy?: boolean }) {
  const shape = type ?? bot?.avatar ?? (bot ? avatarTypeFor(bot.id) : 'blob')
  return (
    <span className="inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} aria-hidden="true">
      <BotAvatar type={shape} size={size} state={busy ? 'working' : 'default'} />
    </span>
  )
}
