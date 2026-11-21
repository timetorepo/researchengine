/** Heuristic only, never a model-specific tokenizer or billing guarantee. */
export const approximateTokens = (text: string) => Math.ceil(text.length / 4)
export function assertSessionBudget(system: string, messages: { content: string }[], inputBudget: number, outputBudget: number) {
  if (!Number.isSafeInteger(inputBudget) || inputBudget < 1 || !Number.isSafeInteger(outputBudget) || outputBudget < 1) throw new Error('Use positive whole-number input and output budgets.')
  const estimate = approximateTokens(system + messages.map(message => message.content).join('\n'))
  if (estimate > inputBudget) throw new Error(`Estimated input ${estimate.toLocaleString()} tokens exceeds your ${inputBudget.toLocaleString()} input budget. Exclude items, shorten the task, or explicitly raise the budget; nothing was truncated.`)
  return estimate
}
