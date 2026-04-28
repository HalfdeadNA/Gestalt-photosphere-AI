# Gestalt Visions

Gestalt Visions is a local-first immersive creative platform built on the EvaOne architecture.

It includes:
- Gestalt Intelligence Core with deterministic local AI provider fallback
- AI Studio for structured creative brief generation (no fake image generation claims)
- Museum room builder with editable room assignments
- Gallery Builder drafts
- Marketplace draft listings (explicit Draft Mode when payments are not connected)
- Academy progress tracking
- Competitions with local entry records
- Creative Memory (visible, editable, deletable)
- Creation Log
- Control Center permissions + local JSON export/import

## Run locally

```bash
npm install
npm run web
```

For device testing:

```bash
npm install
npx expo start
```

Then scan the QR code from Expo Go on iPhone.

## Quick QA checklist

1. Open **Studio** and prepare a creative brief.
2. Save the brief as a project.
3. Open **Museum** and create a room, then add a project ID.
4. Open **More → Gallery** and create a gallery draft.
5. Open **Market** and save a listing draft.
6. Open **Academy** and update course progress.
7. Open **More → Competitions** and submit an entry.
8. Open **More → Memory** and add/delete memory entries.
9. Open **More → Control** and export/import JSON.

## Notes

- Persistence is local via SQLite (`gestalt_visions.db`).
- AI provider defaults to `LocalCreativeProvider` with deterministic structured outputs.
- No external keys are required.
