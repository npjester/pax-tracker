---
target: landing page and main app page
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
timestamp: 2026-11-21T03-28-21Z
slug: src-tracker-tsx
---
# PAX Tracker design critique — landing and tracker

**Method:** dual-agent (A: `68fc10c8-f17b-4233-8156-02af28513a48` · B: `6c8e6e8d-9340-409a-b019-4c7cabeeb6e6`)

## Scope and evidence

The landing/sign-in surface was inspected live at `/` and in source. The authenticated tracker was not available to inspect live: local Supabase values are blank in `.env.example`, and the page showed “This deployment is waiting for its Supabase connection. Sign-in is not available yet.” Tracker observations and scores are source-based, not a claim that the authenticated page rendered. This local setup state is an inspection limitation, not counted as a product P0.

## Design Health Score

| # | Heuristic | Landing | Tracker |
|---|---|---:|---:|
| 1 | Visibility of System Status | 2 — unavailable state is clear, but provides no next step | 3 — loading, saving, sync, and error states are present |
| 2 | Match System / Real World | 4 — booth planning language is immediately legible | 3 — familiar booth language; “BGG” and “promo” assume familiarity |
| 3 | User Control and Freedom | 3 — resend and change-email exits | 3 — cancel, clear-filters, and collection-removal confirmation; little undo |
| 4 | Consistency and Standards | 4 — cohesive type, color, and form treatment | 3 — consistent cards and controls; several tools share one long page |
| 5 | Error Prevention | 3 — native email validation and constrained code input | 3 — required fields and removal confirmation; collection replacement lacks preview |
| 6 | Recognition Rather Than Recall | 3 — clear sign-in steps; no invite guidance | 3 — visible labels, counters, filters, and search |
| 7 | Flexibility and Efficiency | 2 — essentially one access path | 2 — search, sort, and export help; updates are one at a time |
| 8 | Aesthetic and Minimalist Design | 3 — strong hierarchy; no product preview | 3 — organized cards; page accumulates multiple tools |
| 9 | Error Recovery | 2 — errors surface, but provider messages may be opaque | 3 — errors and retries exist; backend wording may leak through |
| 10 | Help and Documentation | 1 — no invite/contact guidance | 2 — inline guidance and official links, but no contextual help |
| **Total** |  | **27/40 — Acceptable** | **28/40 — Good** |

## Design Specificity Verdict

**Moderately product-specific.** “Field guide,” booth stops, games, and the PAX Unplugged edition give the surfaces a relevant voice. The dark palette, serif headline, and peach accent are coherent. The landing page does not preview the tracker, though, so its composition could still fit another event-planning product. The tracker’s booth checklist and expo lookup are more specific to the task.

**Deterministic scan:** CLI scans of `src` and `index.html` returned zero findings. Browser detector evidence reported four rule types across five logged instances: `wide-tracking` (`src/style.css:46`), `undersized-ui-text` (`src/main.tsx:10`, `src/style.css:48`), `tiny-text` (eyebrows in `src/main.tsx:48,54`, `src/style.css:50`), and `hero-eyebrow-chip` (`src/main.tsx:48`, `src/style.css:50`). These include likely false positives: the tracking is on the wordmark, and the small eyebrow labels are ancillary. Treat the size flags as legibility checks, not automatic changes.

**Browser evidence:** the detector agent reported successful injection and visible overlay labels in its fresh assessment tab. The current side-panel canvases do not show those overlays. The authenticated tracker was not browser-inspected.

## Overall Impression

The visual system is warm, coherent, and suited to a personal show-floor planner. The landing copy makes a clear promise, but access guidance is incomplete; the tracker design has useful capabilities that would benefit from a clearer primary path.

## What's Working

- “Make the show yours” and the field-guide framing give the landing page a fitting voice.
- Per-booth cards, visit checkboxes, and collapsed game checklists support quick scanning.
- The shortlist and footer clearly say the planner is unofficial, helping users judge the data appropriately.

## Cognitive Load

- **Landing: 0/8 checklist failures.** Focused hero, grouped benefits, one primary sign-in task, and progressive email-code flow.
- **Tracker: 2/8 failures — moderate.** The checklist, BGG collection, expo lookup, and manual add compete on one long page; the BGG import/privacy guidance is dense. Grouping, hierarchy, decision size, and progressive disclosure otherwise work well.

## Emotional Journey

The landing starts with an inviting promise and explains the planner quickly. In this unconfigured local environment it ends in a dead end; configured deployments should provide a next step for invite questions. The tracker’s progress counts and save/sync feedback can reassure users, while the number of adjacent tools risks diluting momentum. The unofficial-data caveat is a useful trust signal.

## Priority Issues

1. **[P1] Invite-only access has no help path.** “Use the email address that was added for you” assumes the user knows who invited them. Add a clear help/contact route or explain how to request access without implying open registration. **Suggested command:** `/impeccable clarify`
2. **[P1] Tracker tools compete with the core checklist.** Three jump links lead into one long page containing checklist, collection import, directory lookup, and manual entry. Make checklist setup the primary path and group discovery/import tools under a secondary “Find booths and games” area. **Suggested command:** `/impeccable distill`
3. **[P2] BGG collection replacement lacks a preview.** Users cannot review what will be overwritten before saving. Show the incoming item count and confirm replacement deliberately. **Suggested command:** `/impeccable harden`

## Persona Red Flags

- **Jordan, first-timer:** no visible route to request an invite or resolve uncertainty about which email to use.
- **Casey, distracted mobile user:** several stacked workflows and repeated per-booth actions may require substantial scrolling during the event.
- **Sam, accessibility-dependent user:** very small wordmark/eyebrow text merits a contrast and zoom check; the detector’s size flags should be verified at mobile and 200% zoom.

## Minor Observations

- The “demo / buy / promo” goal controls may not read as saved preferences to first-time users.
- Small detector text/tracking flags are likely intentional in the wordmark and ancillary labels, but should remain readable at zoom.
- The unofficial-planner disclaimer is useful but easy to miss below the fold.

## Questions to Consider

- Can a new visitor understand how to get access without already knowing the organizer?
- Should the tracker guide one primary job first, rather than present four preparation paths together?
