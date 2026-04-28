# Gestalt Visions Migration Plan

## Objective
Transform the current EvaOne single-screen prototype into a production-ready, local-first Gestalt Visions app built on the existing Expo architecture, with real workflows for Studio, Museum, Marketplace, Academy, Projects, Competitions, Memory, Logs, and Control Center.

## Affected Files
- `PLANS.md`
- `App.tsx`
- `README.md`

## Risk Areas
- Large single-file refactor could introduce TypeScript/runtime regressions.
- SQLite schema migration/seed logic may fail if not idempotent.
- Mobile layout regressions due to many new sections.
- Local import/export JSON parsing safety.

## Step-by-Step Implementation Order
1. Replace old EvaOne tab/state model with Gestalt Visions data models and navigation states.
2. Implement SQLite schema for required entities (projects, rooms, galleries, listings, courses, entries, logs, memory, settings).
3. Add robust seed data for required default content.
4. Build Gestalt Intelligence Core with deterministic LocalCreativeProvider fallback methods.
5. Implement Home, Studio, Museum, Marketplace, Academy tabs with real local actions.
6. Implement More area screens: Projects, Gallery Builder, Competitions, Creator Dashboard, Creation Log, Creative Memory, Control Center, Assistant.
7. Ensure all primary actions write persistent state and creation log entries.
8. Add JSON export/import tooling (local text workflow) for portability.
9. Improve UI to premium dark, mobile-friendly style system with consistent reusable panel/button/input styling.
10. Update README test/run instructions for phone + desktop validation.

## Test Plan
- Run TypeScript check: `npx tsc --noEmit`.
- Run Expo web start sanity: `npm run web -- --non-interactive` (startup check).
- Manual QA:
  - create/edit/delete project
  - generate creative brief in Studio
  - create room and assign/remove artwork
  - create gallery and add project
  - create marketplace listing draft and mark ready
  - update academy progress
  - submit competition entry
  - add/edit/delete memory entries
  - export and import JSON snapshot

## Rollback Notes
- Revert to previous commit if refactor destabilizes app.
- If schema issues occur, remove app local DB (`gestalt_visions.db`) and relaunch to reseed.
