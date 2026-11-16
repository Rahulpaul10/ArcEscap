# Arc Escape

A 3D endless runner set in a neon, Arc-inspired city. Swipe to switch lanes, jump and slide, collect Arc Energy, grab power-ups and chase your best score. Everything runs in the browser with no backend.

Built with [Arc Studio](https://studio.arc.io)

## Features

- Three-lane runner with swipe controls on mobile and arrow keys / WASD on desktop
- Endless procedural track with barriers, gates, gaps, drones and laser hazards
- Shield, Magnet and Speed Boost power-ups
- Four districts that blend into each other as you run
- Unlockable skins, daily challenge, achievement badges and distance milestones
- Progress saved in your browser (localStorage)
- Synthesized sound effects and music with a sound on/off control

## Tech stack

- React, TypeScript, Vite, Tailwind CSS
- three.js for rendering, framer-motion for UI transitions
- Web Audio API for all sound (no audio files)

## Development

Prerequisites: [Bun](https://bun.sh).

```bash
bun install
bun run dev      # start the dev server on port 5173
bun run check    # lint and typecheck
```

### Environment variables

None.
