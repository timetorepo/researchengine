import type { Squad } from '@/types'

export const builtinSquads: Squad[] = [
  {
    id: 'sq-deep-research', name: 'Deep Research', builtin: true,
    description: '2 researchers, 1 verifier, 1 synthesizer',
    agents: [
      { id: 'a1', name: 'Scout', role: 'Researcher', color: '#6C8EEF', modelBinding: 'inherit', temperature: 0.6, skills: [] },
      { id: 'a2', name: 'Delver', role: 'Researcher', color: '#22D3EE', modelBinding: 'inherit', temperature: 0.6, skills: [] },
      { id: 'a3', name: 'Auditor', role: 'Verifier', color: '#FBBF24', modelBinding: 'inherit', temperature: 0.1, skills: [] },
      { id: 'a4', name: 'Weaver', role: 'Synthesizer', color: '#A78BFA', modelBinding: 'inherit', temperature: 0.5, skills: [] },
    ],
  },
  {
    id: 'sq-software-design', name: 'Software Design', builtin: true,
    description: '2 researchers, 2 builders, 1 critic',
    agents: [
      { id: 'a1', name: 'Recon', role: 'Researcher', color: '#6C8EEF', modelBinding: 'inherit', temperature: 0.5, skills: [] },
      { id: 'a2', name: 'Surveyor', role: 'Researcher', color: '#22D3EE', modelBinding: 'inherit', temperature: 0.5, skills: [] },
      { id: 'a3', name: 'Forge', role: 'Builder', color: '#34D399', modelBinding: 'inherit', temperature: 0.4, skills: [] },
      { id: 'a4', name: 'Anvil', role: 'Builder', color: '#A3E635', modelBinding: 'inherit', temperature: 0.4, skills: [] },
      { id: 'a5', name: 'Lash', role: 'Critic', color: '#F87171', modelBinding: 'inherit', temperature: 0.3, skills: [] },
    ],
  },
  {
    id: 'sq-study-team', name: 'Study Team', builtin: true,
    description: '1 explainer, 1 quizzer, 1 note-taker',
    agents: [
      { id: 'a1', name: 'Sage', role: 'Explainer', color: '#6C8EEF', modelBinding: 'inherit', temperature: 0.7, skills: [] },
      { id: 'a2', name: 'Proctor', role: 'Quizzer', color: '#2DD4BF', modelBinding: 'inherit', temperature: 0.5, skills: ['sk-quiz-from-notes'] },
      { id: 'a3', name: 'Scribe', role: 'Note-taker', color: '#A78BFA', modelBinding: 'inherit', temperature: 0.4, skills: [] },
    ],
  },
]

export const AGENT_ROLES = ['Researcher', 'Builder', 'Critic', 'Synthesizer', 'Verifier', 'Explainer', 'Quizzer', 'Note-taker', 'Custom'] as const

export const AGENT_INSTRUCTIONS: Record<string, string> = {
  Researcher: 'Investigate the objective. Report concrete findings with sources where possible.',
  Builder: 'Produce a concrete artifact (design, code, outline) advancing the objective.',
  Critic: 'Attack weaknesses in the current outputs. Be specific and constructive.',
  Synthesizer: 'Merge all contributions into one coherent, attributed synthesis.',
  Verifier: 'Check every claim for accuracy. Flag what is uncertain or wrong.',
  Explainer: 'Explain the topic clearly, building intuition step by step.',
  Quizzer: 'Produce quiz questions that test real understanding.',
  'Note-taker': 'Distill the discussion into clean, structured notes.',
  Custom: 'Contribute toward the objective.',
}
