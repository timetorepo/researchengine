# Grok Bot: notes for Research Engine

Written October 2026 from xAI's public Grok Bot documentation and launch material.
We did not use any code from xAI. We have no access to their app's source; the
public GitHub repository named in secondary reporting is not a source for this
note. Everything below is either a documented behaviour or our own choice.

## What Grok Bot is, as documented

- **A Bot is a named, persistent teammate.** It has a name, a job, an avatar and a
  title, its own conversation, and memory of its past work. You come back to the
  same Bot tomorrow. (docs.x.ai/grok-bot/overview, x.ai/news/designing-grok-bot)
- **Four primitives:** Bots, Chats, Prompts (used once, saved as a **Skill**, or
  triggered as a **Routine**), and Tools (connectors, the shell, computer use).
  (x.ai/news/designing-grok-bot)
- **Skill vs routine.** A skill is *how* a task is done. A routine is *when* it
  runs, on a schedule or after an event where supported. (docs.x.ai/grok-bot/faq,
  docs.x.ai/grok-bot/skills-routines-and-automations)
- **Limits published:** up to 50 routines per Bot, the 20 most recent run records
  kept for each, and schedules at least five minutes apart. Deleting a routine
  cannot be undone; deleting a Bot removes its routines.
  (docs.x.ai/grok-bot/skills-routines-and-automations)
- **Memory.** A Bot keeps stable preferences, role context and summaries of prior
  work, and xAI says memory is not a substitute for an authoritative source.
  (docs.x.ai/grok-bot/bots, docs.x.ai/grok-bot/faq)
- **Compute.** Every Bot on an account shares one persistent cloud computer with a
  browser, files and a terminal, and each Bot has its own screen. Work continues
  when the laptop is closed. (docs.x.ai/grok-bot/overview, docs.x.ai/grok-bot/faq)
- **Setup is a message.** You create a Bot, describe the job, and grant access as
  it asks. (docs.x.ai/grok-bot/overview)

Secondary reporting adds approximate account and group limits (about 50 Bots per
account and six per group chat). We have not verified those, so we do not rely on them.

## What we took (ideas, not code)

| Grok Bot idea | What Research Engine does |
| --- | --- |
| A named Bot with a job and its own thread | `components/bots/BotsView.tsx`, `lib/bots/logic.ts` |
| Memory the Bot reads before each reply | `Bot.memory`, shown in the Memory tab, included in the system prompt |
| Routines on a schedule, with a run history | `Routine`, `runRoutine`, `startBotScheduler` (every 30 s) |
| Published limits on routines and history | 50 routines, 20 runs kept, 5 minutes minimum (`logic.ts`) |
| Skills as saved ways of working | **Not built.** Routines hold the instructions directly. |
| Shared computer and browser | **Not built.** Bots here cannot act outside the chat. |
| Bots messaging each other, handoffs | **Not built.** |
| Approval for consequential actions | **Not needed yet:** Bots have no external actions to approve. |

## What we did differently, on purpose

- **Routines run only while the app is open.** There is no hosted service here, and
  the app says so in the Routines tab. A missed run is caught up once when the app
  next opens, not once per missed slot.
- **No computer.** A Bot answers from its memory, the recent thread, and the model
  you configured. Its system prompt tells it that it cannot browse or act, and the
  routine prompt says live information must be flagged rather than guessed.
- **Memory is explicit.** Anything saved is visible and removable. Typing
  `remember: …` saves a memory without calling the model.
- **Local data.** Bots, threads, memory and run history live in this browser's
  storage (`re.bots.v1`), not on a server.
- **Failure is kept, not hidden.** A failed run is recorded and shown in the
  history as a failure, and a note appears in the thread.

## Gaps against Grok Bot, in priority order

1. **Skills.** Saving a finished chat as a reusable skill that routines reference.
2. **Connectors for Bots.** A Bot should be able to read a calendar, a mail box or
   a file through the connector layer. See `docs/research/rakazo-integrations.md`.
3. **Routines that run in the background.** Only possible with a process that
   outlives the window, such as the desktop app's tray, or a server.
4. **Bot-to-Bot handoff** in a shared thread.
5. **Event triggers** (a new calendar event, a new file in a folder). Grok says
   event triggers are preferred to schedules, because a schedule wakes up even when
   there is nothing to do.
