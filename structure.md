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
- **`app/api`**: Server-side API routes.
- **`app/actions.ts`**: Contains Server Actions, which are used for form submissions and data fetching from client components without needing explicit API endpoints.
- **`app/layout.tsx`**: The root layout of the application.
- **`app/globals.css`**: Global styles and theme definitions for ShadCN and Tailwind CSS.

### `/ai`
This is the central hub for all AI-related functionality, powered by Genkit.

- **`ai/genkit.ts`**: Initializes and configures the global Genkit instance.
- **`ai/flows/*`**: Contains all the individual Genkit flows.
  - `*-flow.ts`: Defines a specific AI capability, such as `product-insights-flow.ts` or `price-validator-flow.ts`. These files define the prompts, tools, and input/output schemas (using Zod).
  - `*-types.ts`: Shared Zod schemas and TypeScript types for a flow's inputs and outputs.

### `/components`
This directory holds all reusable React components.

- **`components/ui`**: Contains the standard, un-styled UI primitives from ShadCN (e.g., `button.tsx`, `card.tsx`).
- **`components/*.tsx`**: Higher-level, application-specific components (e.g., `AppLayout.tsx`, `ProductCard.tsx`, `StoreMap.tsx`).
- **`components/assistant`**: Components specifically used within the AI Assistant page.

### `/hooks`
Custom React Hooks used across the application to encapsulate client-side logic.

- **`useApiSettings.ts`**: Manages user settings (like Store ID and Bearer Token) and stores them in local storage. This is the central source of truth for API credentials.
- **`useNetworkSync.ts`**: Handles online/offline detection and flushes queued data when the connection is restored.
- **`useSpeechRecognition.ts`**: Manages voice input using the Web Speech API.

### `/lib`
Contains shared libraries, data, and utility functions.

- **`lib/morrisons-api.ts`**: The primary client-side wrapper for fetching data from the external Morrisons APIs. It consolidates calls to different endpoints (product details, stock, pricing) into a single function.
- **`lib/idb.ts`**: A helper library for interacting with IndexedDB, used for offline data storage.
- **`lib/offlineQueue.ts`**: Implements the logic for queueing API requests when the user is offline and flushing them when online.
- **`lib/map-data.ts`**: Contains the static JSON data defining the store layout for the `StoreMap` component.
- **`lib/utils.ts`**: Standard utility functions, including `cn` for merging Tailwind classes.

## 3. Key Interactions & Patterns

- **Data Fetching**: Client components (`*Client.tsx`) call Server Actions defined in `app/actions.ts`. These actions then use the `lib/morrisons-api.ts` client to fetch data.
- **AI Flows**: Client components directly import and call the server-side Genkit flow functions from `/ai/flows/*.ts`. These are exposed as async functions that can be invoked from the client.
- **Settings**: All pages that need the Store ID or API tokens use the `useApiSettings` hook to get the current values. They do not manage this state locally.
- **Offline**: When the app is offline (detected by `useNetworkSync`), actions like adding a product to the picking list or reporting an availability issue are queued in IndexedDB via `lib/offlineQueue.ts`. The `useNetworkSync` hook automatically flushes this queue when the app comes back online.
- **Styling**: All styling is done via Tailwind CSS and ShadCN UI components. Themes are defined in `app/globals.css` and applied in the root `layout.tsx`.

## 4. Key Examples (Golden Paths)

To ensure consistency, refer to these files as the standard for common tasks.

-   **Creating a New Page**: Follow the pattern in `app/picking/page.tsx` (for the Suspense wrapper) and `app/picking/PickingListClient.tsx` (for the interactive client logic).
-   **Creating an AI Flow**: Use `ai/flows/product-insights-flow.ts` as the template. It demonstrates proper use of Zod schemas, structured outputs, and a clear prompt.
-   **Defining a Component**: `components/product-card.tsx` is a good example of a complex, data-driven component with conditional rendering and user interactions.
-   **Handling Forms**: The forms in `app/picking/PickingListClient.tsx` and `app/settings/page.tsx` demonstrate the use of `react-hook-form` with Zod for validation.
