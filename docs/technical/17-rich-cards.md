# 17 — Rich in-app cards: the variant catalogue

When a tool answers in chat, the answer is drawn as a card, never as raw data. This page
lists every card variant the app can draw. The list is generated from the code in
`frontend/src/lib/cards/catalog.ts`; run `tsx scripts/cards-doc.mts` from `frontend/` to
rebuild it, and `--check` to make sure it still matches.

**277 variants** (277 unique ids). The product range is 200–300.

## How the variants are made

- **Connected apps:** 35 apps × 7 action kinds = 245 variants. Each app's
  kinds are search, list, read, create, send, update and delete. Each has its own id (`github.search`),
  accent colour, icon and headline.
- **Built-in tools:** 32 variants, one per tool (`web_search`, `crm_create`, `ide_write_file`, …).
- **Ids are stored on messages.** They are stable: renaming one would change old chats, so add new ids instead.

Counts by kind: search 41, list 41, read 47, create 40, send 35, update 37, delete 35, builtin 1.

Counts by layout family (how the results are drawn): action 144, message 19, task 18, page 16, metric 13, list 10, person 10, event 9, file 9, media 8, repo 8, order 6, track 3, web 2, generic 2.

## Connected apps

| App | Id | Layout | Noun | Accent |
| --- | --- | --- | --- | --- |
| Spotify | `spotify` | track | track / tracks | `#1DB954` |
| YouTube | `youtube` | media | video / videos | `#FF0033` |
| Gmail | `gmail` | message | email / emails | `#EA4335` |
| Outlook | `outlook` | message | email / emails | `#0078D4` |
| Google Calendar | `googlecalendar` | event | event / events | `#4285F4` |
| Google Drive | `googledrive` | file | file / files | `#0F9D58` |
| Google Sheets | `googlesheets` | metric | sheet / sheets | `#188038` |
| Google Docs | `googledocs` | page | document / documents | `#4285F4` |
| Dropbox | `dropbox` | file | file / files | `#0061FF` |
| GitHub | `github` | repo | repository / repositories | `#8B5CF6` |
| GitLab | `gitlab` | repo | project / projects | `#FC6D26` |
| Notion | `notion` | page | page / pages | `#37352F` |
| Slack | `slack` | message | message / messages | `#E01E5A` |
| Discord | `discord` | message | message / messages | `#5865F2` |
| Microsoft Teams | `microsoft_teams` | message | message / messages | `#6264A7` |
| Linear | `linear` | task | issue / issues | `#5E6AD2` |
| Jira | `jira` | task | issue / issues | `#0052CC` |
| Trello | `trello` | task | card / cards | `#0079BF` |
| Asana | `asana` | task | task / tasks | `#F06A6A` |
| Todoist | `todoist` | task | task / tasks | `#E44332` |
| ClickUp | `clickup` | task | task / tasks | `#7B68EE` |
| Airtable | `airtable` | list | record / records | `#18BFFF` |
| HubSpot | `hubspot` | person | contact / contacts | `#FF7A59` |
| Salesforce | `salesforce` | person | contact / contacts | `#00A1E0` |
| Stripe | `stripe` | order | payment / payments | `#635BFF` |
| Shopify | `shopify` | order | order / orders | `#7AB55C` |
| X (Twitter) | `twitter` | message | post / posts | `#111111` |
| Reddit | `reddit` | list | post / posts | `#FF4500` |
| LinkedIn | `linkedin` | person | profile / profiles | `#0A66C2` |
| Instagram | `instagram` | media | post / posts | `#E4405F` |
| Figma | `figma` | page | file / files | `#A259FF` |
| Calendly | `calendly` | event | booking / bookings | `#006BFF` |
| Zoom | `zoom` | event | meeting / meetings | `#2D8CFF` |
| Mailchimp | `mailchimp` | metric | campaign / campaigns | `#FFE01B` |
| SendGrid | `sendgrid` | metric | email / emails | `#1A82E2` |

## Variants for connected apps

| Card id | Headline | Kind | Layout |
| --- | --- | --- | --- |
| `spotify.search` | Spotify search | search | track |
| `spotify.list` | Your tracks in Spotify | list | track |
| `spotify.read` | Spotify track | read | track |
| `spotify.create` | Created in Spotify | create | action |
| `spotify.send` | Sent with Spotify | send | action |
| `spotify.update` | Updated in Spotify | update | action |
| `spotify.delete` | Removed from Spotify | delete | action |
| `youtube.search` | YouTube search | search | media |
| `youtube.list` | Your videos in YouTube | list | media |
| `youtube.read` | YouTube video | read | media |
| `youtube.create` | Created in YouTube | create | action |
| `youtube.send` | Sent with YouTube | send | action |
| `youtube.update` | Updated in YouTube | update | action |
| `youtube.delete` | Removed from YouTube | delete | action |
| `gmail.search` | Gmail search | search | message |
| `gmail.list` | Your emails in Gmail | list | message |
| `gmail.read` | Gmail email | read | message |
| `gmail.create` | Created in Gmail | create | action |
| `gmail.send` | Sent with Gmail | send | action |
| `gmail.update` | Updated in Gmail | update | action |
| `gmail.delete` | Removed from Gmail | delete | action |
| `outlook.search` | Outlook search | search | message |
| `outlook.list` | Your emails in Outlook | list | message |
| `outlook.read` | Outlook email | read | message |
| `outlook.create` | Created in Outlook | create | action |
| `outlook.send` | Sent with Outlook | send | action |
| `outlook.update` | Updated in Outlook | update | action |
| `outlook.delete` | Removed from Outlook | delete | action |
| `googlecalendar.search` | Google Calendar search | search | event |
| `googlecalendar.list` | Your events in Google Calendar | list | event |
| `googlecalendar.read` | Google Calendar event | read | event |
| `googlecalendar.create` | Created in Google Calendar | create | action |
| `googlecalendar.send` | Sent with Google Calendar | send | action |
| `googlecalendar.update` | Updated in Google Calendar | update | action |
| `googlecalendar.delete` | Removed from Google Calendar | delete | action |
| `googledrive.search` | Google Drive search | search | file |
| `googledrive.list` | Your files in Google Drive | list | file |
| `googledrive.read` | Google Drive file | read | file |
| `googledrive.create` | Created in Google Drive | create | action |
| `googledrive.send` | Sent with Google Drive | send | action |
| `googledrive.update` | Updated in Google Drive | update | action |
| `googledrive.delete` | Removed from Google Drive | delete | action |
| `googlesheets.search` | Google Sheets search | search | metric |
| `googlesheets.list` | Your sheets in Google Sheets | list | metric |
| `googlesheets.read` | Google Sheets sheet | read | metric |
| `googlesheets.create` | Created in Google Sheets | create | action |
| `googlesheets.send` | Sent with Google Sheets | send | action |
| `googlesheets.update` | Updated in Google Sheets | update | action |
| `googlesheets.delete` | Removed from Google Sheets | delete | action |
| `googledocs.search` | Google Docs search | search | page |
| `googledocs.list` | Your documents in Google Docs | list | page |
| `googledocs.read` | Google Docs document | read | page |
| `googledocs.create` | Created in Google Docs | create | action |
| `googledocs.send` | Sent with Google Docs | send | action |
| `googledocs.update` | Updated in Google Docs | update | action |
| `googledocs.delete` | Removed from Google Docs | delete | action |
| `dropbox.search` | Dropbox search | search | file |
| `dropbox.list` | Your files in Dropbox | list | file |
| `dropbox.read` | Dropbox file | read | file |
| `dropbox.create` | Created in Dropbox | create | action |
| `dropbox.send` | Sent with Dropbox | send | action |
| `dropbox.update` | Updated in Dropbox | update | action |
| `dropbox.delete` | Removed from Dropbox | delete | action |
| `github.search` | GitHub search | search | repo |
| `github.list` | Your repositories in GitHub | list | repo |
| `github.read` | GitHub repository | read | repo |
| `github.create` | Created in GitHub | create | action |
| `github.send` | Sent with GitHub | send | action |
| `github.update` | Updated in GitHub | update | action |
| `github.delete` | Removed from GitHub | delete | action |
| `gitlab.search` | GitLab search | search | repo |
| `gitlab.list` | Your projects in GitLab | list | repo |
| `gitlab.read` | GitLab project | read | repo |
| `gitlab.create` | Created in GitLab | create | action |
| `gitlab.send` | Sent with GitLab | send | action |
| `gitlab.update` | Updated in GitLab | update | action |
| `gitlab.delete` | Removed from GitLab | delete | action |
| `notion.search` | Notion search | search | page |
| `notion.list` | Your pages in Notion | list | page |
| `notion.read` | Notion page | read | page |
| `notion.create` | Created in Notion | create | action |
| `notion.send` | Sent with Notion | send | action |
| `notion.update` | Updated in Notion | update | action |
| `notion.delete` | Removed from Notion | delete | action |
| `slack.search` | Slack search | search | message |
| `slack.list` | Your messages in Slack | list | message |
| `slack.read` | Slack message | read | message |
| `slack.create` | Created in Slack | create | action |
| `slack.send` | Sent with Slack | send | action |
| `slack.update` | Updated in Slack | update | action |
| `slack.delete` | Removed from Slack | delete | action |
| `discord.search` | Discord search | search | message |
| `discord.list` | Your messages in Discord | list | message |
| `discord.read` | Discord message | read | message |
| `discord.create` | Created in Discord | create | action |
| `discord.send` | Sent with Discord | send | action |
| `discord.update` | Updated in Discord | update | action |
| `discord.delete` | Removed from Discord | delete | action |
| `microsoft_teams.search` | Microsoft Teams search | search | message |
| `microsoft_teams.list` | Your messages in Microsoft Teams | list | message |
| `microsoft_teams.read` | Microsoft Teams message | read | message |
| `microsoft_teams.create` | Created in Microsoft Teams | create | action |
| `microsoft_teams.send` | Sent with Microsoft Teams | send | action |
| `microsoft_teams.update` | Updated in Microsoft Teams | update | action |
| `microsoft_teams.delete` | Removed from Microsoft Teams | delete | action |
| `linear.search` | Linear search | search | task |
| `linear.list` | Your issues in Linear | list | task |
| `linear.read` | Linear issue | read | task |
| `linear.create` | Created in Linear | create | action |
| `linear.send` | Sent with Linear | send | action |
| `linear.update` | Updated in Linear | update | action |
| `linear.delete` | Removed from Linear | delete | action |
| `jira.search` | Jira search | search | task |
| `jira.list` | Your issues in Jira | list | task |
| `jira.read` | Jira issue | read | task |
| `jira.create` | Created in Jira | create | action |
| `jira.send` | Sent with Jira | send | action |
| `jira.update` | Updated in Jira | update | action |
| `jira.delete` | Removed from Jira | delete | action |
| `trello.search` | Trello search | search | task |
| `trello.list` | Your cards in Trello | list | task |
| `trello.read` | Trello card | read | task |
| `trello.create` | Created in Trello | create | action |
| `trello.send` | Sent with Trello | send | action |
| `trello.update` | Updated in Trello | update | action |
| `trello.delete` | Removed from Trello | delete | action |
| `asana.search` | Asana search | search | task |
| `asana.list` | Your tasks in Asana | list | task |
| `asana.read` | Asana task | read | task |
| `asana.create` | Created in Asana | create | action |
| `asana.send` | Sent with Asana | send | action |
| `asana.update` | Updated in Asana | update | action |
| `asana.delete` | Removed from Asana | delete | action |
| `todoist.search` | Todoist search | search | task |
| `todoist.list` | Your tasks in Todoist | list | task |
| `todoist.read` | Todoist task | read | task |
| `todoist.create` | Created in Todoist | create | action |
| `todoist.send` | Sent with Todoist | send | action |
| `todoist.update` | Updated in Todoist | update | action |
| `todoist.delete` | Removed from Todoist | delete | action |
| `clickup.search` | ClickUp search | search | task |
| `clickup.list` | Your tasks in ClickUp | list | task |
| `clickup.read` | ClickUp task | read | task |
| `clickup.create` | Created in ClickUp | create | action |
| `clickup.send` | Sent with ClickUp | send | action |
| `clickup.update` | Updated in ClickUp | update | action |
| `clickup.delete` | Removed from ClickUp | delete | action |
| `airtable.search` | Airtable search | search | list |
| `airtable.list` | Your records in Airtable | list | list |
| `airtable.read` | Airtable record | read | list |
| `airtable.create` | Created in Airtable | create | action |
| `airtable.send` | Sent with Airtable | send | action |
| `airtable.update` | Updated in Airtable | update | action |
| `airtable.delete` | Removed from Airtable | delete | action |
| `hubspot.search` | HubSpot search | search | person |
| `hubspot.list` | Your contacts in HubSpot | list | person |
| `hubspot.read` | HubSpot contact | read | person |
| `hubspot.create` | Created in HubSpot | create | action |
| `hubspot.send` | Sent with HubSpot | send | action |
| `hubspot.update` | Updated in HubSpot | update | action |
| `hubspot.delete` | Removed from HubSpot | delete | action |
| `salesforce.search` | Salesforce search | search | person |
| `salesforce.list` | Your contacts in Salesforce | list | person |
| `salesforce.read` | Salesforce contact | read | person |
| `salesforce.create` | Created in Salesforce | create | action |
| `salesforce.send` | Sent with Salesforce | send | action |
| `salesforce.update` | Updated in Salesforce | update | action |
| `salesforce.delete` | Removed from Salesforce | delete | action |
| `stripe.search` | Stripe search | search | order |
| `stripe.list` | Your payments in Stripe | list | order |
| `stripe.read` | Stripe payment | read | order |
| `stripe.create` | Created in Stripe | create | action |
| `stripe.send` | Sent with Stripe | send | action |
| `stripe.update` | Updated in Stripe | update | action |
| `stripe.delete` | Removed from Stripe | delete | action |
| `shopify.search` | Shopify search | search | order |
| `shopify.list` | Your orders in Shopify | list | order |
| `shopify.read` | Shopify order | read | order |
| `shopify.create` | Created in Shopify | create | action |
| `shopify.send` | Sent with Shopify | send | action |
| `shopify.update` | Updated in Shopify | update | action |
| `shopify.delete` | Removed from Shopify | delete | action |
| `twitter.search` | X (Twitter) search | search | message |
| `twitter.list` | Your posts in X (Twitter) | list | message |
| `twitter.read` | X (Twitter) post | read | message |
| `twitter.create` | Created in X (Twitter) | create | action |
| `twitter.send` | Sent with X (Twitter) | send | action |
| `twitter.update` | Updated in X (Twitter) | update | action |
| `twitter.delete` | Removed from X (Twitter) | delete | action |
| `reddit.search` | Reddit search | search | list |
| `reddit.list` | Your posts in Reddit | list | list |
| `reddit.read` | Reddit post | read | list |
| `reddit.create` | Created in Reddit | create | action |
| `reddit.send` | Sent with Reddit | send | action |
| `reddit.update` | Updated in Reddit | update | action |
| `reddit.delete` | Removed from Reddit | delete | action |
| `linkedin.search` | LinkedIn search | search | person |
| `linkedin.list` | Your profiles in LinkedIn | list | person |
| `linkedin.read` | LinkedIn profile | read | person |
| `linkedin.create` | Created in LinkedIn | create | action |
| `linkedin.send` | Sent with LinkedIn | send | action |
| `linkedin.update` | Updated in LinkedIn | update | action |
| `linkedin.delete` | Removed from LinkedIn | delete | action |
| `instagram.search` | Instagram search | search | media |
| `instagram.list` | Your posts in Instagram | list | media |
| `instagram.read` | Instagram post | read | media |
| `instagram.create` | Created in Instagram | create | action |
| `instagram.send` | Sent with Instagram | send | action |
| `instagram.update` | Updated in Instagram | update | action |
| `instagram.delete` | Removed from Instagram | delete | action |
| `figma.search` | Figma search | search | page |
| `figma.list` | Your files in Figma | list | page |
| `figma.read` | Figma file | read | page |
| `figma.create` | Created in Figma | create | action |
| `figma.send` | Sent with Figma | send | action |
| `figma.update` | Updated in Figma | update | action |
| `figma.delete` | Removed from Figma | delete | action |
| `calendly.search` | Calendly search | search | event |
| `calendly.list` | Your bookings in Calendly | list | event |
| `calendly.read` | Calendly booking | read | event |
| `calendly.create` | Created in Calendly | create | action |
| `calendly.send` | Sent with Calendly | send | action |
| `calendly.update` | Updated in Calendly | update | action |
| `calendly.delete` | Removed from Calendly | delete | action |
| `zoom.search` | Zoom search | search | event |
| `zoom.list` | Your meetings in Zoom | list | event |
| `zoom.read` | Zoom meeting | read | event |
| `zoom.create` | Created in Zoom | create | action |
| `zoom.send` | Sent with Zoom | send | action |
| `zoom.update` | Updated in Zoom | update | action |
| `zoom.delete` | Removed from Zoom | delete | action |
| `mailchimp.search` | Mailchimp search | search | metric |
| `mailchimp.list` | Your campaigns in Mailchimp | list | metric |
| `mailchimp.read` | Mailchimp campaign | read | metric |
| `mailchimp.create` | Created in Mailchimp | create | action |
| `mailchimp.send` | Sent with Mailchimp | send | action |
| `mailchimp.update` | Updated in Mailchimp | update | action |
| `mailchimp.delete` | Removed from Mailchimp | delete | action |
| `sendgrid.search` | SendGrid search | search | metric |
| `sendgrid.list` | Your emails in SendGrid | list | metric |
| `sendgrid.read` | SendGrid email | read | metric |
| `sendgrid.create` | Created in SendGrid | create | action |
| `sendgrid.send` | Sent with SendGrid | send | action |
| `sendgrid.update` | Updated in SendGrid | update | action |
| `sendgrid.delete` | Removed from SendGrid | delete | action |

## Built-in tool variants

| Card id | Area | Headline | Summary | Kind | Layout |
| --- | --- | --- | --- | --- | --- |
| `tool.web_search` | Web | Web results | Sources with a short extract each. | search | web |
| `tool.library_search` | Library | Library results | Matches from your library and the open web. | search | web |
| `tool.library_read` | Library | From the library | The page as it was read. | read | page |
| `tool.docs_search` | Context7 docs | Documentation | Current docs and examples for that library. | search | page |
| `tool.connector_search` | Connectors | Local search | Drive files, mail and calendar on this device. | search | file |
| `tool.connector_read` | Connectors | Local item | The full item from this device. | read | page |
| `tool.integration_search` | Integrations | Integration results | Matches from a connected integration. | search | list |
| `tool.integration_read` | Integrations | Integration item | The full item from the integration. | read | page |
| `tool.composio_apps` | Connectors | Connected apps | The apps you have signed into. | list | list |
| `tool.composio_tools` | Connectors | Available actions | What this app can do. | list | list |
| `tool.crm_search` | CRM | CRM contacts | Matching people and companies. | search | person |
| `tool.crm_create` | CRM | Added to the CRM | The record is saved. | create | action |
| `tool.seo_domain` | SEO | Domain report | Authority, traffic and the numbers that matter. | read | metric |
| `tool.seo_keywords` | SEO | Keyword ideas | Volume and difficulty per keyword. | list | metric |
| `tool.social_channels` | Social | Social channels | The accounts you can post to. | list | list |
| `tool.social_draft` | Social | Draft post | Saved as a draft. Nothing is published. | create | message |
| `tool.voice_speak` | Voice | Spoken | The audio is ready to play. | create | media |
| `tool.read_local_file` | Files | File | Read from this device. | read | page |
| `tool.list_local_files` | Files | Files | Found in the folder you named. | list | file |
| `tool.ide_list_files` | Project | Project files | The files in this project. | list | file |
| `tool.ide_read_file` | Project | Project file | The file as it is now. | read | page |
| `tool.ide_write_file` | Project | File saved | The change is written to the project. | update | action |
| `tool.ide_run_command` | Terminal | Command run | What it printed, summarised. | create | repo |
| `tool.ide_git` | Git | Git | The repository state. | read | repo |
| `tool.run_ui_test` | UI test | UI test | Checks that passed or failed. | read | metric |
| `tool.design_screenshot` | Design | Screenshot | The screen as it is now. | read | media |
| `tool.design_snapshot` | Design | Screen read | What is on the screen. | read | page |
| `tool.design_audit` | Design | UI audit | Accessibility and layout findings. | read | metric |
| `tool.mcp_call` | MCP server | MCP result | The tool’s answer. | read | generic |
| `tool.start_coding_mode` | Coding | Coding mode | This chat now works in a project. | create | action |
| `tool.open_section` | Navigation | Opened | Moved to that part of the app. | update | action |
| `tool.session_sandbox` | Sandbox | Sandbox | Ran in the sandbox. | builtin | generic |

## Checks

`tsx scripts/cards-doc.mts --check` fails when the count is outside the range, when an id is
duplicated, or when this page no longer matches the catalogue.
