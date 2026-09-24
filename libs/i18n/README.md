# @semoss/i18n

Internationalization library for the SEMOSS monorepo using i18next.

## Structure

The translations are organized in a two-tier structure to support multiple packages in the monorepo:

```
libs/i18n/src/
├── builder.ts                     # I18nBuilder + dynamic-import i18next backend
├── preload.ts                     # preloadNamespaces() for on-demand namespaces
├── constants.ts                   # Language definitions (LANGUAGES array)
├── index.ts                       # Main exports
└── resources/
    ├── types.ts                   # LazyResources interface
    ├── client.ts                  # Client lazy loader map
    ├── playground.ts              # Playground lazy loader map
    ├── terminal.ts                # Terminal lazy loader map
    ├── auditlog.ts                # Audit log lazy loader map
    ├── code.ts                    # SEMOSS Code lazy loader map
    └── locales/
        ├── en/                    # English translations
        │   ├── common.json        # Tier 1: Core shared (buttons, labels, actions)
        │   ├── validation.json    # Tier 1: Core shared (form validations)
        │   ├── notifications.json # Tier 1: Core shared (notification templates)
        │   ├── shared/            # Tier 2: @semoss/shared components
        │   ├── playground/        # Tier 2: Playground-specific (chat, room, sidebar, …)
        │   ├── client/            # Tier 2: Client-specific
        │   ├── terminal/          # Tier 2: Terminal-specific
        │   └── code/              # Tier 2: SEMOSS Code (code.json)
        ├── es/                    # Spanish translations (same structure)
        ├── fr/                    # French translations (same structure)
        ├── nl/                    # Dutch translations (same structure)
        ├── hi/                    # Hindi translations (same structure)
        ├── ar/                    # Arabic translations (same structure)
        └── ja/                    # Japanese translations (same structure)
```

## Two-Tier System

### Tier 1: Core Shared
Translations used across **all** packages:
- `common.json` - Generic buttons, labels, placeholders, actions
- `validation.json` - Form validation messages
- `notifications.json` - Notification templates

### Tier 2: Package-Specific
Translations specific to individual packages:
- `playground/` - Playground app translations (chat, room, sidebar, knowledge, workspace, mcp)
- `client/` - Client app translations (for example `githubApp`)
- `code/` - SEMOSS Code translations. `code.json` holds the console's own copy, with the `@semoss/agent-core` session's words under `core.*`

## Usage

### In Playground Package

The default i18next configuration uses playground resources:

```typescript
import { i18n, useTranslation } from "@semoss/i18n";

function MyComponent() {
    const { t } = useTranslation();

    // Core shared translations
    t('common:buttons.save')           // "Save"
    t('validation:required')            // Validation message

    // Playground-specific
    t('chat:messages.placeholder')      // "Type a message..."
    t('room:welcome')                   // "Welcome"
    t('sidebar:search')                 // "Search"
}
```

### In an App

Create the instance via `I18nBuilder`, passing the app's lazy resource config. Languages load on demand (one chunk per language) — await `ready` before the first render.

```typescript
// packages/client/src/App.tsx
import { I18nBuilder, clientResources } from "@semoss/i18n";

const builder = new I18nBuilder(clientResources, { lockToEnglish: true });
export const i18n = builder.i18n;
export const i18nReady = builder.ready; // await in main.tsx before render
```

Then use it in components:

```typescript
import { useTranslation } from "react-i18next";

function ClientComponent() {
    const { t } = useTranslation();

    // Core shared translations
    t('common:buttons.save')           // "Save"

    // Client-specific
    t('githubApp:header.title')         // "GitHub App"
}
```

## Adding New Translations

> Languages are loaded lazily (one chunk per language) via a dynamic-import
> backend. The locale JSON is never in the main bundle. See `AGENTS.md` →
> "Lazy loading architecture".

### Adding a Core Shared Translation

1. Add the key to `locales/<lng>/common.json` (or validation/notifications) for every language.
2. No config changes needed — `common`/`validation`/`notifications` are already in every app's loader map.

### Adding a Package-Specific Translation

1. Create/update the namespace file for every language (e.g., `locales/<lng>/playground/sidebar.json`).
2. Add a lazy `load` entry (and an `ns` entry if it should preload) to the package config.

```typescript
// libs/i18n/src/resources/playground.ts
export const playgroundResources: LazyResources = {
    ns: ["common", "sidebar" /* , ... */],
    load: {
        common: (l) => import(`./locales/${l}/common.json`),
        sidebar: (l) => import(`./locales/${l}/playground/sidebar.json`), // Add here
        // ... other namespaces
    },
};
```

## Supported Languages

- English (`en`) - Default
- Spanish (`es`)
- French (`fr`)
- Hindi (`hi`)
- Arabic (`ar`)
- Japanese (`ja`)
- Dutch (`nl`)

## Type Safety

The library exports TypeScript types for translation resources. Import from `@semoss/i18n` to get type definitions for your translation keys.
