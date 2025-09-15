# Application Structure Guide

This document outlines the structure of the Next.js application to provide context for AI-driven development.

## 1. Project Overview

This is a Next.js application built with the App Router. It serves as a "Store Mobile Ultra" application for managing various in-store tasks like product picking, availability reporting, price checking, and product lookups.

The key technologies used are:
- **Framework**: Next.js 14+ with App Router
- **UI Components**: React, ShadCN UI, Tailwind CSS
- **AI Integration**: Genkit (for all generative AI flows)
- **State Management**: React Hooks and Context (`useApiSettings`)
- **Offline Support**: IndexedDB (`idb` library) and a custom service worker via `next-pwa`.

## 2. Directory Structure

### `/app`
This directory contains all the routes and UI pages of the application, following the Next.js App Router conventions.

- **`/app/(pages)/*`**: Each subdirectory represents a route.
  - `page.tsx`: The main React component for the route. It's often a wrapper that suspense-loads a client component.
  - `*Client.tsx`: The primary interactive component for a page (e.g., `PickingListClient.tsx`). All client-side logic, state management, and form handling reside here.
- **`app/api`**: Server-side API routes. These are critical for proxying requests to external services that have CORS restrictions or require secret API keys.
  - `app/api/morrisons/product/route.ts`: A key proxy that fetches the full, rich product data object.
- **`app/actions.ts`**: Contains Server Actions, which are used for form submissions and initial data fetching from client components.
- **`app/layout.tsx`**: The root layout of the application.
- **`app/globals.css`**: Global styles and theme definitions for ShadCN and Tailwind CSS.

### `/ai`
This is the central hub for all AI-related functionality, powered by Genkit.

- **`ai/genkit.ts`**: Initializes and configures the global Genkit instance.
- **`ai/flows/*`**: Contains all the individual Genkit flows.
  - `*-flow.ts`: Defines a specific AI capability, such as `product-insights-flow.ts` or `planogram-flow.ts`. These files define the prompts, tools, and import their input/output schemas.
  - `*-types.ts`: Shared Zod schemas and TypeScript types for a flow's inputs and outputs (e.g., `planogram-types.ts`).

### `/components`
This directory holds all reusable React components.

- **`components/ui`**: Contains the standard, un-styled UI primitives from ShadCN (e.g., `button.tsx`, `card.tsx`).
- **`components/*.tsx`**: Higher-level, application-specific components (e.g., `AppLayout.tsx`, `ProductCard.tsx`, `StoreMap.tsx`).
- **`components/assistant`**: Components specifically used within the AI Assistant page, such as the `SearchComponent`.

### `/hooks`
Custom React Hooks used across the application to encapsulate client-side logic.

- **`useApiSettings.ts`**: Manages user settings (like Store ID and Bearer Token) and stores them in local storage. This is the central source of truth for API credentials.
- **`useNetworkSync.ts`**: Handles online/offline detection and flushes queued data when the connection is restored.
- **`useSpeechRecognition.ts`**: Manages voice input using the Web Speech API.

### `/lib`
Contains shared libraries, data, and utility functions.

- **`lib/morrisons-api.ts`**: The client-side wrapper for fetching *basic* data from external Morrisons APIs. It consolidates calls to endpoints like stock and price integrity. Note that for full, rich product details, a different pattern is used (see below).
- **`lib/idb.ts`**: A helper library for interacting with IndexedDB, used for offline data storage.
- **`lib/offlineQueue.ts`**: Implements the logic for queueing API requests when the user is offline and flushing them when online.
- **`lib/map-data.ts`**: Contains the static JSON data defining the store layout for the `StoreMap` component.
- **`lib/utils.ts`**: Standard utility functions, including `cn` for merging Tailwind classes.

## 3. Key Interactions & Patterns

- **Server Actions vs. API Routes**:
  - **Server Actions** (`app/actions.ts`) are used for initial, straightforward data fetches that don't require complex merging (e.g., getting basic stock and price).
  - **API Routes** (`app/api/*`) are used as server-side proxies to external APIs, especially those with CORS issues or when API keys must be hidden. The `/api/morrisons/product` route is a critical example.

- **Successful Data Enrichment Pattern (AI Assistant)**:
  - **Problem**: Fetching complete product data was challenging because rich details (ingredients, allergens) live in a separate API endpoint from basic data (stock, price). Attempts to merge this data server-side in a single function (`lib/morrisons-api.ts`) proved unreliable and difficult to debug.
  - **Solution (The "Two-Step Fetch")**: The `app/assistant/AssistantPageClient.tsx` now implements a successful two-step, client-driven pattern:
    1.  **Initial Fetch**: It calls the `getProductData` server action to get the basic product object, which includes stock, price, and location.
    2.  **Enrichment Fetch**: Immediately after, it makes a *second*, direct `fetch` call from the client to the internal proxy at `/api/morrisons/product`. This route fetches the full, rich product JSON.
    3.  **Client-Side Merge**: The client component then merges the results from both fetches into a single, complete product object and stores it in its state. This complete object is then used to render the UI and is passed to the AI flows.
  - **Conclusion**: This pattern is now the standard for pages requiring a complete, multi-source view of a product. It is more robust and easier to debug than a complex, monolithic server-side fetching function.

- **AI Flows**: Client components directly import and call the server-side Genkit flow functions from `/ai/flows/*.ts`. With the successful data enrichment pattern, these flows now receive the complete product object, enabling them to provide accurate and detailed responses.

- **Offline**: When the app is offline (detected by `useNetworkSync`), actions are queued in IndexedDB via `lib/offlineQueue.ts`. The `useNetworkSync` hook automatically flushes this queue when the app comes back online.

## 4. Key Examples (Golden Paths)

To ensure consistency, refer to these files as the standard for common tasks.

-   **Creating a New Page**: Follow the pattern in `app/picking/page.tsx` (for the Suspense wrapper) and `app/picking/PickingListClient.tsx` (for the interactive client logic).
-   **Fetching and Displaying Complex Data**: Refer to `app/assistant/AssistantPageClient.tsx` for the canonical example of the "Two-Step Fetch" pattern.
-   **Creating an AI Flow**: Use `ai/flows/product-insights-flow.ts` and its corresponding `*-types.ts` file as a template.
-   **Defining a Component**: `components/product-card.tsx` is a good example of a complex, data-driven component that correctly renders all nested product details.
-   **Handling Forms**: The forms in `app/picking/PickingListClient.tsx` and `app/settings/page.tsx` demonstrate the use of `react-hook-form` with Zod for validation.
