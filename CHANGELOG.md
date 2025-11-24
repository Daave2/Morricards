# Project Changelog

This document tracks the major versions and completed features for the Store Mobile Ultra application.

## v0.7 - Picking & Navigation Overhaul (Current)
-   **Picking Page Rearchitected**:
    -   Changed the data model from a single list to a `GroupedOrders` structure, allowing multiple orders to be managed and displayed by date and collection slot.
    -   Added a collapsible "Collected Orders" section to provide a history of completed work.
    -   Items are now visually grouped by Aisle number for a more logical picking walk.
    -   Fixed a critical bug where missing items on a completed order were not clearly marked. Now shows a "Missing" status.
    -   Made summary counts (Picked, Subbed, Missing) on completed orders clickable, opening a dialog to show the specific items in each category.
-   **Enhanced Map Page**: The "Find by Category" feature now searches for all products in that category and displays them as pins on the map, not just highlighting an aisle.
-   **Smarter Product Assistant**: The chat assistant can now use the `findAisleForProduct` tool to answer location-based questions about other products during a conversation.
-   **Improved UX**: Added a click-to-enlarge image modal for product images across the Picking, Availability, Amazon, and Assistant pages.

## v0.6 - Guidance & Documentation
-   Implemented an interactive chat feature on the Product Assistant page.
-   Updated the Amazon Picker Assistant to handle single-image analysis, use a more robust card-based layout for results, allow camera capture for images, and show a detailed product modal on-click for every result item.
-   Updated planogram validator to handle single-image analysis (listing items from a planogram), use a more robust card-based layout for results, allow camera capture for images, and show a detailed product modal on-click for every result item.
-   Refactored the bottom navigation for a cleaner mobile experience.
-   Updated `structure.md` to document the application architecture for assistants, including the successful "two-step fetch" pattern for enriching product data on the client-side. This resolved a persistent issue with missing product details on the Assistant page.
-   Updated `README.md` to guide assistants to use the new documentation files.

## v0.5 - Voice Input
-   Added Web Speech API integration for voice-to-text search in the main search component.

## v-0.4 - Offline & Sync
-   Integrated IndexedDB and a network sync hook (`useNetworkSync`) to queue actions while offline.

## v0.3 - UI/UX Polish
-   Implemented ShadCN themes (Light, Dark, Glass).
-   Improved component styling across the application.
-   Added responsive layouts for better mobile usability.

## v0.2 - Assistant Integration
-   Added Genkit flows for product insights, price validation, and aisle finding.

## v0.1 - Initial Setup
-   Created the basic Next.js application with main pages (Picking, Availability, etc.).
