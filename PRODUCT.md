# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Inferred from the current course content: people learning the Arch Linux command line who want a guided first pass without risking their own machine.

## Product Purpose

Inferred from the current app: a short, self-paced course that teaches practical Arch Linux commands through small lessons, a safe browser-only practice shell, and a knowledge check after each lesson. Success means a learner can explain and use the command patterns in the course with less guesswork.

## Positioning

Inferred from the current app: the course connects explanation to immediate practice in a simulated terminal. It teaches command intent and how to look up flags instead of asking learners to memorize syntax.

## Operating Context

Inferred from the current app: learners move through a linear lesson path, read a command guide, complete terminal objectives, answer a quiz, and continue to the next lesson. Progress is saved locally in the browser. The practice shell cannot access the learner's computer or execute arbitrary commands.

## Capabilities and Constraints

- Inferred capabilities: lesson navigation, local progress persistence, expandable command guides, command copy, browser-only terminal practice, terminal reset, quiz feedback, gated next lessons, and Arch Wiki reference links.
- Inferred constraint: preserve the existing client-side interactions and course content while changing the visual system and layout.
- Inferred terminology: lesson, command guide, objective, practice shell, knowledge check, and path.

## Brand Commitments

- The existing product name is "I learn arch btw".
- The voice is direct, curious, and practical, with a little personality. Keep the plain-language teaching style.
- The product is about Arch Linux command-line learning, not a general-purpose terminal or package manager.

## Evidence on Hand

- Current lesson content and practice behavior live in `app/page.tsx` and `app/terminal.ts`.
- The Arch Wiki is the reference source linked by the current interface.
- No user testimonials, commercial claims, or brand assets were found in the repository. Do not invent them.

## Product Principles

- Show the command doing real work before asking the learner to recall it.
- Keep practice safe, local to the browser, and explicit about its limits.
- Make progress visible without turning the course into a game dashboard.
- Explain intent before syntax details.
- Reward completion with a clear next action.

## Accessibility & Inclusion

Inferred from the current web app: preserve keyboard access, visible focus, readable contrast, responsive layouts, semantic controls, and clear feedback for locked, incorrect, correct, and completed states.
