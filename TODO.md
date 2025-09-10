# Project TODO & Update Log

This document tracks the progress, pending tasks, and future ideas for the Store Mobile Ultra application.

## Completed

-   **v0.1 - Initial Setup**: Basic Next.js app with main pages (Picking, Availability, etc.).
-   **v0.2 - AI Integration**: Added Genkit flows for product insights, price validation, and aisle finding.
-   **v.0.3 - UI/UX Polish**: Implemented ShadCN themes (Light, Dark, Glass), improved component styling, and added responsive layouts.
-   **v0.4 - Offline & Sync**: Integrated IndexedDB and a network sync hook (`useNetworkSync`) to queue actions while offline.
-   **v0.5 - Voice Input**: Added Web Speech API integration for voice-to-text search in the main search component.
-   **v0.6 - Code Documentation**: Added `structure.md` and updated `README.md` with guidance for AI assistants.

## In Progress

-   **Refining UI consistency across all themes**: Ensuring all pages and components feel cohesive with the selected theme (Light, Dark, Glass).
-   **Investigating Build Warnings**:
    -   **Symptom**: `next build` produces warnings related to `instrumentation-winston` and `handlebars`.
    -   **Status**: These seem to be related to dependencies within the Genkit library. They don't appear to break the build, but they should be monitored.

## Future Ideas

-   Add a "chat with product" feature on the AI Assistant page.
-   Implement end-to-end tests for critical user flows.
-   Explore generating shelf plans or planograms visually.
-   Add user authentication to save lists across devices.
-   Create an `ISSUES.md` log for persistent bugs, detailing symptoms and attempted fixes.
