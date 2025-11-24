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

### Picking Page Architecture (v0.7+)
The picking page (`app/picking/PickingListClient.tsx`) was refactored to support a more robust workflow.
- **Data Structure**: Instead of a flat list, orders are stored in a nested state object: `GroupedOrders`. This object uses the collection date and time slot as keys, allowing for the management of multiple distinct orders.
  ```typescript
  // { "25-11-2025": { "16:00 - 17:00": [Order, ...] } }
  type GroupedOrders = Record<string, Record<string, Order[]>>;
  ```
- **Order Lifecycle**:
  1.  Orders are imported via text paste or file upload.
  2.  They are parsed and merged into the `GroupedOrders` state.
  3.  The UI renders these orders grouped by date and time.
  4.  An order can be picked, after which it is marked as `isPicked: true`.
  5.  Completed orders can be marked as `isCollected: true`, moving them to a separate, collapsible "Collected Orders" section for historical reference. This provides a clean separation between active and completed work.

### Successful Data Enrichment Pattern (AI Assistant)
- **Problem**: Fetching complete product data was challenging because rich details (ingredients, allergens) live in a separate API endpoint from basic data (stock, price).
- **Solution (The "Two-Step Fetch")**: `app/assistant/AssistantPageClient.tsx` now implements a successful two-step, client-driven pattern:
    1.  **Initial Fetch**: It calls the `getProductData` server action to get the basic product object.
    2.  **Enrichment Fetch**: Immediately after, it makes a *second*, direct `fetch` call from the client to the internal proxy at `/api/morrisons/product`.
    3.  **Client-Side Merge**: The client component merges the results from both fetches into a single, complete product object before rendering or passing to AI flows.
- **Conclusion**: This pattern is the standard for pages requiring a complete, multi-source view of a product.

### AI Flows
Client components directly import and call the server-side Genkit flow functions from `/ai/flows/*.ts`. With the successful data enrichment pattern, these flows now receive the complete product object, enabling them to provide accurate and detailed responses.

### Offline
When the app is offline (detected by `useNetworkSync`), actions are queued in IndexedDB via `lib/offlineQueue.ts`. The `useNetworkSync` hook automatically flushes this queue when the app comes back online.

## 4. Key Examples (Golden Paths)

-   **Creating a New Page**: Follow the pattern in `app/picking/page.tsx` (for the Suspense wrapper) and `app/picking/PickingListClient.tsx` (for the interactive client logic).
-   **Fetching and Displaying Complex Data**: Refer to `app/assistant/AssistantPageClient.tsx` for the canonical example of the "Two-Step Fetch" pattern.
-   **Creating an AI Flow**: Use `ai/flows/product-insights-flow.ts` and its corresponding `*-types.ts` file as a template.
-   **Defining a Component**: `components/product-card.tsx` is a good example of a complex, data-driven component.
-   **Handling Forms**: The forms in `app/picking/PickingListClient.tsx` and `app/settings/page.tsx` demonstrate the use of `react-hook-form` with Zod for validation.
