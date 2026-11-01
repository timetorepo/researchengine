# Where the UI components came from

## Untitled UI, requested as CLI blocks

Requested: `npx untitledui@latest add video-player`, `calendar`, `carousel-base`
and `metrics`.

What happened:

- The CLI (`untitledui` 0.1.69 on npm) fetches component source from
  `https://www.untitledui.com/react/api`. The build environment cannot reach that
  host (TLS handshake fails), so `add` returns "No components found". The CLI
  package itself contains no component source, only styles and a migration.
- Untitled UI's open-source components are at https://github.com/untitleduico/react
  under the MIT licence. That repository has **`carousel-base`** and calendar
  primitives under `date-picker/` (for a date picker). It does **not** contain
  `video-player` or `metrics`, and it has no full `calendar` block. Those are
  presumably in the paid "PRO" set, which we have no licence for.

What we did:

| Requested | Result |
| --- | --- |
| `carousel-base` | Vendored from the MIT repository into `frontend/src/components/ui/untitledui/carousel-base.tsx`, with the attribution in `THIRD-PARTY-NOTICES.md`. Used for multi-photo messages in chat. |
| `calendar` | Not vendored. The open `date-picker/calendar.tsx` needs Untitled UI's button, input and cell components plus react-aria. We wrote our own month grid in `components/calendar/CalendarView.tsx`. |
| `video-player` | Not available in the open repository, so nothing was copied. The built-in player is the existing popup (`components/video/VideoPlayerModal.tsx`). |
| `metrics` | Not available in the open repository. Not built. |

To use the two missing blocks, someone with an Untitled UI licence would need to
supply their source, or the CLI would need a working network route to
untitledui.com from a machine that has one.
