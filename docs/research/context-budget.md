# Context budget and long sessions

Long chats used to grow without a limit. Every turn re-sent the whole history, every tool
result from every round, and every attached item, so a session got slower and more
expensive the longer it ran. This note records the limits now in place and why.

## What is capped

| Part | Limit | Where |
| --- | --- | --- |
| Chat history per prompt | 12k / 32k / 96k estimated tokens (Efficient / Balanced / Fidelity). With AIFlowEngine off, the Fidelity budget applies. | `lib/flow/pruner.ts`, `lib/context/budget.ts` |
| Newest 6 messages | Sent verbatim, up to 12,000 characters each | `LIMITS.verbatimMessages`, `verbatimChars` |
| Older messages | First 700 characters; anything past the budget is folded into a capsule of first lines | `fitHistory` |
| Tool output, per call | 12,000 characters | `runChat.ts`, `runner.ts` (bots) |
| Tool output, earlier rounds | Head of 800 characters, the rest says how much was dropped. The current round stays in full. | `compactToolRounds` |
| Role method (ECC) | 6,000 characters | `runChat.ts` |
| Skill packs | 12,000 characters together | `runChat.ts` |
| Attached connector items | 12,000 characters together | `runChat.ts` |
| Retrieved sources | 16,000 characters | `runChat.ts` |
| Bot prompts | Each message 2,000 characters; newest 30 memories | `lib/bots/logic.ts` |

Every cut says so in the text sent to the model ("characters left out to fit the context
budget"), so the model knows content is missing and does not treat it as complete.

## Storage

Chats are saved in browser storage, which holds about 5 MB. When a save fails for lack of
space, the oldest persisted detail is trimmed (tool traces and reasoning from older messages,
then the oldest chats, then the oldest messages of each chat) and the save is retried. The
on-screen state is not touched, and a warning toast says what was trimmed. The
trimmer is `lib/security/quota.ts`.

## Daily token budget

Real provider tokens are counted per local day across the chat, bots and agents. When the
day's budget is spent, new real requests stop with a clear message; the on-device engine is
never counted or blocked. The limit is set under Settings → AIFlowEngine (default 2M tokens, 0
means no limit). It counts estimated tokens when a provider does not report usage.

## Assumptions and limits

- Tokens are estimated as characters ÷ 4, the same rule the app already used. Real counts
  come from providers when they report them.
- The budget is in tokens, not money. Prices differ by model, so a dollar limit would be a
  guess.
- The caps trade a little recall in very long chats for predictable cost. Fidelity mode keeps
  the most context.
