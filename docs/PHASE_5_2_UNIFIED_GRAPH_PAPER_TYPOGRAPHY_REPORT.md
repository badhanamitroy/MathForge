# Phase 5.2 — Unified Graph Paper & Typography

**Date:** 2026-11-03

**Status:** Implementation in progress; final acceptance pending.

## Objectives

- Unify graph-paper styling across all four graph tools.
- Use Equation Graph as the visual reference.
- Set default graph font size to 11 pt.
- Use Times New Roman for English.
- Use the supplied Kalpurush Unicode font for Bangla.
- Allow users to adjust font size and bold formatting.

## Added assets

- assets/js/core/graph-typography.js
- assets/fonts/kalpurush.ttf

## Modified implementation areas

- Shared CSS and JavaScript.
- Coordinates, Equation, Ogive and Histogram engines.
- Four standalone tool pages.
- Main workspace.
- Service worker and deployment test.

## Acceptance tests still pending

1. Verify graph-paper parity across all four tools.
2. Verify 11 pt default typography.
3. Verify English and Bangla canvas rendering.
4. Verify font-size and bold controls.
5. Verify project save/reopen compatibility.
6. Verify PNG/SVG export typography.
7. Verify old .mathforge project compatibility.
8. Verify installed PWA cache updates.

## Deployment

This implementation is being synchronized for Vercel-hosted testing.
Deployment success does not constitute final Phase 5.2 acceptance.
