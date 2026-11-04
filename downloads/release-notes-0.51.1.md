## 0.51.1 — answers that keep streaming, correct citations, sliding tabs

- **Answers no longer stop mid-stream.** With *Raw stream* (Settings → Flow → Off), only the first words appeared until the answer finished. Every word now shows as it arrives.
- **Background tabs keep streaming.** The answer used to freeze while the tab was hidden and resume when you came back. It now keeps going.
- **Stalls are reported.** If a provider goes quiet mid-answer, the chat says so and keeps the text received so far, instead of waiting forever or ending silently. Reasoning output counts as activity, so a model that is still thinking is not cut off.
- **Errors mid-answer are shown.** A provider error after the answer has started is shown in the chat instead of being dropped.
- **Last words are kept.** The final part of a reply is no longer lost when the provider ends the stream without a closing newline.
- **Citations are checked properly.** The citation check missed invented numbers inside groups such as `[1, 99, 2]`, and could drop a real source from `[99, 1, 2]`. Every number is now checked. A stopped answer is checked too.
- **Inline sources link to their pages.** `[1]` in an answer opens source 1. Code is left alone.
- **Bots tabs slide.** The active tab in Bots has a pill that slides between tabs. Reduced motion turns the slide off.
- **Smoother hover and dialogs.** Scrollbar, file-tree and welcome rows, humanized text, and the video player fade and slide in and out instead of snapping.

Installers: `Research.Engine_0.51.1_x64-setup.exe` and `Research.Engine_0.51.1_amd64.deb`. Digests are in `downloads/INSTALLERS.sha256`.

Upgrade: nothing to migrate. Existing bots, chats, projects and settings are kept.
