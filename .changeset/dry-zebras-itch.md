---
'astro': patch
---

Fixes i18n fallback routes being corrupted when a path segment starts with the locale code (e.g. `/en/enterprise` producing `/es/esterprise` instead of `/es/enterprise`)
