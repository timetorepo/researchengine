/**
 * How to get a key, per provider, in the order a person actually does it.
 *
 * Every provider's key page is one link, but the link is not the hard part —
 * the hard part is knowing which product the key belongs to, what it looks
 * like, and whether it needs money first. So each guide is written as steps
 * that name the exact page, the exact button, and the shape of the string that
 * comes out, plus the one thing that most often goes wrong.
 *
 * Links are to the provider's own console. Nothing here points at a reseller,
 * and nothing here is a referral.
 */
import type { ProviderId } from '@/types'

export interface KeyGuide {
  provider: ProviderId
  /** The console the key comes from. */
  console: { label: string; url: string }
  /** Numbered steps, in order. */
  steps: string[]
  /** What the key looks like — so a paste can be checked at a glance. */
  shape?: string
  /** Where the key needs to be available: this device, your account, both. */
  cost?: string
  free?: string
  tip?: string
}

export const KEY_GUIDES: Record<ProviderId, KeyGuide> = {
  openai: {
    provider: 'openai',
    console: { label: 'platform.openai.com', url: 'https://platform.openai.com/api-keys' },
    steps: [
      'Sign in at platform.openai.com — or create an account if you have never used the API. A ChatGPT subscription is a different thing and does not include API credit.',
      'Open Billing and add a payment method, then buy a small amount of credit ($5 is plenty to start). Keys work only while the account has credit.',
      'Go to API keys and choose Create new secret key. Name it something you will recognise later, like “Research Engine desktop”.',
      'Choose All projects (or a specific project) and keep the default permissions unless you need more.',
      'Copy the key the moment it appears — the page never shows it again.',
      'Paste it here. It goes into this machine’s encrypted key vault, not into a config file.',
    ],
    shape: 'Starts with sk- and is about 50 characters, e.g. sk-proj-…',
    cost: 'Pay per use, billed to the account. Prices per million tokens are on the pricing page.',
    free: 'No standing free tier for the API (the ChatGPT app is separate). New accounts sometimes get trial credit.',
    tip: 'If a call returns “insufficient_quota”, the account has no credit — that is a billing state, not a wrong key.',
  },
  anthropic: {
    provider: 'anthropic',
    console: { label: 'console.anthropic.com', url: 'https://console.anthropic.com/settings/keys' },
    steps: [
      'Sign in at console.anthropic.com. A Claude app subscription does not give you API access — this is a separate console account.',
      'Open Plans & Billing and add credit. The API is prepaid.',
      'Go to API keys and choose Create key. Give it a name and leave the workspace as Default.',
      'Copy the key from the dialog — it is shown once.',
      'Paste it here.',
    ],
    shape: 'Starts with sk-ant-api03- and is around 100 characters.',
    cost: 'Prepaid credit, per million tokens in and out.',
    free: 'No standing free API tier.',
    tip: 'Keys are workspace-scoped. If a key stops working after a team change, check it was not scoped to a workspace you left.',
  },
  groq: {
    provider: 'groq',
    console: { label: 'console.groq.com', url: 'https://console.groq.com/keys' },
    steps: [
      'Sign in at console.groq.com with Google, GitHub or an email.',
      'Open API Keys in the left menu and choose Create API Key.',
      'Name it, then copy it from the dialog.',
      'Paste it here.',
    ],
    shape: 'Starts with gsk_ and is about 56 characters.',
    cost: 'Free tier with rate limits; paid tiers raise the limits.',
    free: 'Yes — a real free tier, no card required.',
    tip: 'Groq serves open models on their own hardware, which is why it is fast. If a model name returns 404, the model was retired — refresh the model list.',
  },
  gemini: {
    provider: 'gemini',
    console: { label: 'aistudio.google.com', url: 'https://aistudio.google.com/apikey' },
    steps: [
      'Open Google AI Studio and sign in with a Google account.',
      'Choose Get API key, then Create API key.',
      'Pick a Google Cloud project (AI Studio can create one for you) and copy the key.',
      'Paste it here.',
    ],
    shape: 'Starts with AIza and is 39 characters.',
    cost: 'A free tier with generous limits; paid billing raises them.',
    free: 'Yes — free tier available in most countries.',
    tip: 'A key is bound to a Cloud project; if the free tier is exhausted, either add billing to that project or create a key in a different one.',
  },
  ollama: {
    provider: 'ollama',
    console: { label: 'ollama.com', url: 'https://ollama.com/download' },
    steps: [
      'Install Ollama from ollama.com/download and start it — the app runs a local server on port 11434.',
      'Open a terminal and pull a model, for example: ollama pull llama3.2',
      'There is no key: the local server trusts anything on this machine, which is why nothing leaves it.',
      'Press Test connection here to confirm the app can see the server.',
    ],
    shape: 'No key needed.',
    cost: 'Free. It runs on your own hardware.',
    free: 'Yes, entirely.',
    tip: 'If the connection fails, run `ollama serve` in a terminal and check the port is 11434.',
  },
  nim: {
    provider: 'nim',
    console: { label: 'build.nvidia.com', url: 'https://build.nvidia.com/settings/api-keys' },
    steps: [
      'Sign in to build.nvidia.com — a free NVIDIA developer account is enough.',
      'Open your profile menu and choose API Keys, then Generate API Key.',
      'Name the key, set an expiry, and copy it.',
      'Paste it here.',
    ],
    shape: 'Starts with nvapi- and is about 70 characters.',
    cost: 'Free developer credits for hosted models; enterprise pricing beyond them.',
    free: 'Yes — free credits on signup.',
    tip: 'NIM endpoints are per-model, so the model list is long. If a request 404s, pick the model from the list in this app rather than typing it.',
  },
  openrouter: {
    provider: 'openrouter',
    console: { label: 'openrouter.ai', url: 'https://openrouter.ai/settings/keys' },
    steps: [
      'Sign in at openrouter.ai.',
      'Open Credits and add a few dollars — even $5 unlocks almost every model.',
      'Open Keys and choose Create key. Set an optional spend limit if you want a hard ceiling.',
      'Copy the key and paste it here.',
    ],
    shape: 'Starts with sk-or-v1- and is about 73 characters.',
    cost: 'Pay per token, at a small markup over the provider’s own price.',
    free: 'Some models are marked free and work without credit, with limits.',
    tip: 'Model names are namespaced, like anthropic/claude-sonnet-4. The model list in this app comes from OpenRouter directly.',
  },
  kilocode: {
    provider: 'kilocode',
    console: { label: 'kilocode.ai', url: 'https://kilocode.ai/dashboard' },
    steps: [
      'Sign in at kilocode.ai (or make a free account).',
      'Open the dashboard and find the API keys section of the Kilo gateway.',
      'Create a key and copy it.',
      'Paste it here.',
    ],
    shape: 'A long opaque token issued by the Kilo gateway.',
    cost: 'Pay per token through the gateway, at each model’s own rate.',
    free: 'The gateway lists free-tier models; the rest bill per use.',
    tip: 'Kilo Code is a gateway, not one model: pick any model it serves from the model list after the key is saved.',
  },
  together: {
    provider: 'together',
    console: { label: 'api.together.ai', url: 'https://api.together.ai/settings/api-keys' },
    steps: [
      'Sign in at api.together.ai.',
      'Open Settings → API Keys and choose Create key.',
      'Copy it from the dialog.',
      'Paste it here.',
    ],
    shape: 'A long hex string, around 64 characters.',
    cost: 'Pay per token; some open models are free.',
    free: 'Trial credit on signup, and a set of free endpoints.',
    tip: 'Free endpoints have their own rate limits and sometimes queue. If a call is slow, that is usually why.',
  },
  mistral: {
    provider: 'mistral',
    console: { label: 'console.mistral.ai', url: 'https://console.mistral.ai/api-keys' },
    steps: [
      'Sign in at console.mistral.ai (a phone number verification is required).',
      'Open Billing and add credit, or activate the free experiment tier if it is offered to you.',
      'Open API Keys and choose Create new key.',
      'Copy it and paste it here.',
    ],
    shape: 'A 32-character alphanumeric string.',
    cost: 'Pay per token, with a free experiment tier on some accounts.',
    free: 'Sometimes — a limited free tier is offered at signup in some regions.',
    tip: 'Mistral requires phone verification before the first key; if the button is greyed out, that step is missing.',
  },
  lmstudio: {
    provider: 'lmstudio',
    console: { label: 'lmstudio.ai', url: 'https://lmstudio.ai' },
    steps: [
      'Install LM Studio and start it.',
      'Search for and download a model inside the app (the Discover tab).',
      'Open the Developer tab and press Start Server — it listens on port 1234.',
      'No key is needed. Press Test connection here.',
    ],
    shape: 'No key needed for the local server.',
    cost: 'Free.',
    free: 'Yes, entirely — everything runs locally.',
    tip: 'If the model list is empty, the server is running but no model is loaded. Load one first.',
  },
  mercury: {
    provider: 'mercury',
    console: { label: 'platform.inceptionlabs.ai', url: 'https://platform.inceptionlabs.ai' },
    steps: [
      'Sign in at platform.inceptionlabs.ai.',
      'Open API Keys and create one.',
      'Add billing if you expect to exceed the free allowance.',
      'Copy the key and paste it here.',
    ],
    shape: 'Starts with sk_ or similar — copy the whole string.',
    cost: 'Free tier plus usage pricing.',
    free: 'Yes, a free allowance for the small diffusion models.',
    tip: 'Mercury models are unusually fast because they are diffusion-based; they are not the right choice for long chain-of-thought tasks.',
  },
  grok: {
    provider: 'grok',
    console: { label: 'console.x.ai', url: 'https://console.x.ai' },
    steps: [
      'Sign in at console.x.ai with an X account.',
      'Open the API keys section and create a key. Give it a name and (optionally) restrict it to this machine.',
      'Add credit to the team if you have not already — new teams often include a small amount.',
      'Copy the key and paste it here.',
    ],
    shape: 'Starts with xai- and is about 80 characters.',
    cost: 'Pay per token against team credit.',
    free: 'Promotional credit for new teams at times, but no permanent free tier.',
    tip: 'Keys are team-scoped. If a key suddenly 401s, check the team still has credit.',
  },
  deepseek: {
    provider: 'deepseek',
    console: { label: 'platform.deepseek.com', url: 'https://platform.deepseek.com/api_keys' },
    steps: [
      'Sign in at platform.deepseek.com.',
      'Open Top up and add a small balance — the API is prepaid.',
      'Open API keys and choose Create new API key.',
      'Copy it and paste it here.',
    ],
    shape: 'Starts with sk- and is 35 characters.',
    cost: 'Very low per-token pricing, prepaid.',
    free: 'No standing free tier; the web chat is free but separate.',
    tip: 'The balance and the web chat are separate systems — a working chat account can still have an empty API balance.',
  },
  kimi: {
    provider: 'kimi',
    console: { label: 'platform.moonshot.ai', url: 'https://platform.moonshot.ai/console/api-keys' },
    steps: [
      'Sign in at platform.moonshot.ai.',
      'Add a small balance under Billing if you are outside the free window.',
      'Open API Keys and create one.',
      'Copy it and paste it here.',
    ],
    shape: 'Starts with sk- and is 51 characters.',
    cost: 'Per token, prepaid.',
    free: 'Signup credit is often available; the consumer app (kimi.com) is separate.',
    tip: 'Moonshot runs two platforms by region — if you signed up on the .cn console, use that key with its models.',
  },
  glm: {
    provider: 'glm',
    console: { label: 'z.ai', url: 'https://z.ai/manage-apikey/apikey-list' },
    steps: [
      'Sign in at z.ai (or open.bigmodel.cn if you are in mainland China).',
      'Open the API keys page and choose Create.',
      'Copy the key from the dialog — it is shown once.',
      'Paste it here.',
    ],
    shape: 'An id and secret pair separated by a dot, e.g. 1234abcd….xyz',
    cost: 'Freemium: some models are free, others are paid per token.',
    free: 'Yes — GLM’s flash models are free to call.',
    tip: 'Keep the whole string including the dot. Pasting only the part after the dot is the usual mistake.',
  },
  minimax: {
    provider: 'minimax',
    console: { label: 'platform.minimax.io', url: 'https://platform.minimax.io/user-center/basic-information/interface-key' },
    steps: [
      'Sign in at platform.minimax.io.',
      'Open Account → Interface key (the exact label varies by region) and copy the API key.',
      'New accounts include trial credit; add billing to keep going after it.',
      'Paste the key here.',
    ],
    shape: 'A long JWT-like string — copy all of it, including the dots.',
    cost: 'Trial credit, then per token.',
    free: 'Trial credit at signup.',
    tip: 'MiniMax also requires a GroupId on some endpoints; this app sends the key alone, which is what the chat endpoint needs.',
  },
  mimo: {
    provider: 'mimo',
    console: { label: 'platform.xiaomimimo.com', url: 'https://platform.xiaomimimo.com' },
    steps: [
      'Sign in at platform.xiaomimimo.com with a Xiaomi account and complete any identity step it asks for.',
      'Open API Keys and create a key. Copy it from the dialog — it is shown once.',
      'If you have not added billing: the pay-as-you-go key (starting sk-) needs a balance; the Token Plan key (starting tp-) uses the plan instead.',
      'Paste the key here. If it starts with tp-, also open Advanced on the provider row and set the Token Plan base URL for your region, e.g. https://token-plan-sgp.xiaomimimo.com/v1 — the pay-as-you-go URL will reject a plan key.',
    ],
    shape: 'Pay-as-you-go: sk-… · Token Plan: tp-… (teams: ttp-…)',
    cost: 'Pay per token, or a monthly Token Plan with included calls.',
    free: 'Occasional trial credit for new accounts; MiMo’s open weights can also be run locally.',
    tip: 'The two key kinds are not interchangeable. A tp- key against the default URL returns an auth error that looks like a bad key — it is the wrong endpoint.',
  },
  custom: {
    provider: 'custom',
    console: { label: 'your own server', url: 'https://platform.openai.com/docs/api-reference' },
    steps: [
      'Open Advanced on this provider row and set the base URL of your OpenAI-compatible server, e.g. http://localhost:8080/v1.',
      'If the server expects a key, paste it here; if it does not, leave the field empty.',
      'Press Test connection. A 200 with a model list means the wiring is right.',
    ],
    shape: 'Whatever your server issues.',
    cost: 'Depends on what you are running.',
    tip: 'The base URL must include /v1 for most servers (vLLM, llama.cpp, LocalAI, LM Studio). A bare host and port usually 404s.',
  },
}

export const keyGuideFor = (id: ProviderId): KeyGuide | undefined => KEY_GUIDES[id]
