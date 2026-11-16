# Arc Escape

A 3D endless runner set in a neon, Arc-inspired city. Swipe to switch lanes, jump and slide, collect Arc Energy, grab power-ups and chase your best score. Everything runs in the browser with no backend.

Built with [Arc Studio](https://studio.arc.io)

## Features

- Three-lane runner with swipe controls on mobile and arrow keys / WASD on desktop
- Endless procedural track with barriers, gates, gaps, drones and laser hazards
- Cinematic neon city: PBR materials, reflections, real-time shadows, bloom and lens effects, with automatic quality scaling on slower devices
- Shield, Magnet and Speed Boost power-ups
- Dodge chain: close calls and risky Energy next to hazards build a x2 to x5 score multiplier with a short speed surge
- Four districts that blend into each other as you run
- 22 playable cartoon runners (11 female, 11 male) across Futuristic, Sporty, Streetwear, Casual, Adventure and Fun styles, each with its own hair, outfit, accessories, proportions and personality. Pick one on the character select screen; the choice is saved and every runner plays the same
- Arc Energy coins that carry the Arc mark
- Unlockable colorways, daily challenge, achievement badges and distance milestones
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
