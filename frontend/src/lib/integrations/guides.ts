/**
 * How to connect each integration properly, in the order a person does it.
 *
 * The accounts panel already saves and tests credentials; what was missing is
 * the walk up to the paste box — which console, which button, which scope, and
 * the one thing that most often goes wrong. So the tutorial is not a slideshow
 * about integrations, it is these steps with the real form and the real test
 * at the end of them.
 *
 * `shape` is what the credential looks like, so a paste can be checked at a
 * glance; `gotcha` is the mistake that reads like "the app is broken" when it
 * is really the account.
 */
import type { IntegrationId } from './registry'

export interface IntegrationGuide {
  id: IntegrationId
  /** Numbered, in order, each one a single action. */
  steps: string[]
  /** What the token looks like once you have it. */
  shape?: string
  /** The mistake that most often reads like a bug. */
  gotcha?: string
}

export const INTEGRATION_GUIDES: Record<IntegrationId, IntegrationGuide> = {
  files: {
    id: 'files',
    steps: [
      'There is nothing to connect — your Research Engine folder is already readable by the agent.',
      'Drop a file anywhere on the home screen, or upload one in this tab, and it becomes searchable.',
    ],
  },
  drive: {
    id: 'drive',
    steps: [
      'Open the Google Cloud console and create a project (any name).',
      'In APIs & Services → Library, enable the Google Drive API for that project.',
      'In APIs & Services → Credentials, choose Create credentials → OAuth client ID, application type Desktop app, and note the client id and client secret.',
      'Open the OAuth playground, press the gear, tick "Use your own client id and secret", and paste the two values from the previous step.',
      'In Step 1 of the playground, under Google Drive API v3, select the scope drive.readonly, then authorise with the Google account whose files you want.',
      'In Step 2, exchange the code; copy the access token — and the refresh token, if shown.',
      'Paste the access token here (or refresh token plus client id and secret, so the connection renews itself), then press Save & test.',
    ],
    shape: 'Access tokens start with ya29.; refresh tokens with 1//.',
    gotcha: 'A token made against a different OAuth client will be refused — the playground must use the same client id you paste here.',
  },
  gmail: {
    id: 'gmail',
    steps: [
      'Use the same Google Cloud project as Drive, or create one; enable the Gmail API in the Library.',
      'In the OAuth playground, select the scope gmail.readonly under Gmail API v1 and authorise.',
      'Exchange the code and copy the access token (and refresh token, if shown).',
      'Paste it here and press Save & test — the answer names the account the token signs in as.',
    ],
    shape: 'Access tokens start with ya29.',
    gotcha: 'gmail.readonly is the scope that lets the agent search and read; a token without it is refused with 403, which is the service saying no, not the app.',
  },
  gcal: {
    id: 'gcal',
    steps: [
      'Enable the Google Calendar API for your Cloud project in APIs & Services → Library.',
      'Create (or reuse) a Desktop OAuth client under Credentials, and note the client id and secret.',
      'In the OAuth playground, using your own client, select calendar.readonly under Calendar API v3 and authorise.',
      'Exchange the code, copy the access token, paste it here, then press Save & test.',
    ],
    shape: 'Access tokens start with ya29.',
    gotcha: 'Events are read-only in both directions — the app never writes back to your calendar.',
  },
  github: {
    id: 'github',
    steps: [
      'On GitHub, open Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token.',
      'Choose the repositories the token may read (or all of them, if you prefer).',
      'Under Permissions, set Contents, Issues, Pull requests and Code search to Read-only.',
      'Generate the token and copy it the moment it appears — it is shown once.',
      'Paste it here and press Save & test; the answer is your GitHub username.',
    ],
    shape: 'Fine-grained tokens start with github_pat_; classic ones with ghp_.',
    gotcha: 'A classic token without the repo scope returns 404 on private repositories — the app reports that as the service\'s refusal, verbatim.',
  },
  notion: {
    id: 'notion',
    steps: [
      'Open notion.so/my-integrations and create a new internal integration.',
      'Under Capabilities, keep Read content enabled; save and copy the Internal Integration Secret.',
      'Back in Notion, open each page or database you want the agent to see, press Share, and invite the integration by its name — pages it is not shared with simply do not exist for it.',
      'Paste the secret here and press Save & test.',
    ],
    shape: 'Secrets start with ntn_ (older ones with secret_).',
    gotcha: 'A connected token that sees nothing is almost always a page that was never shared with the integration.',
  },
  slack: {
    id: 'slack',
    steps: [
      'On api.slack.com, create an app from scratch and pick the workspace.',
      'Under OAuth & Permissions, add the user scope search:read (a bot token cannot search messages).',
      'Install the app to the workspace and authorise.',
      'On the same OAuth & Permissions page, copy the User OAuth Token — the one that starts with xoxp-, not the bot token.',
      'Paste it here and press Save & test.',
    ],
    shape: 'User tokens start with xoxp-; bot tokens with xoxb- and will not search.',
    gotcha: 'Pasting the bot token is the classic miss: it connects, then every search is refused.',
  },
}

export const guideFor = (id: IntegrationId): IntegrationGuide => INTEGRATION_GUIDES[id]
