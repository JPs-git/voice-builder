# Title Rebrand: 在线声音训练

## Overview

Replace the existing "VoiceBuilder · 伪声训练器" branding with "在线声音训练 · 看见自己的声音" across three locations.

## Changes

### Current → New

| Location | Current | New |
|---|---|---|
| Toolbar brand title | `VoiceBuilder` | `在线声音训练` |
| Toolbar brand subtitle | `伪声训练器` | `「看见自己的声音」` |
| Browser `<title>` | `VoiceBuilder · 伪声训练器` | `在线声音训练 · 看见自己的声音` |
| `main.js` comment | `伪声训练器 · UI 主入口` | `在线声音训练 · UI 主入口` |

### Styling

- Same font sizes and weights as current two-line layout
- Subtitle wrapped in angle quotes `「」` to emphasise the slogan nature
- No structural/layout changes to the toolbar

## Files to modify

1. `index.html` — toolbar brand text and `<title>` tag (3 edits)
2. `js/main.js` — file header comment (1 edit)

## Not in scope

- Logo emoji remains 🎙️
- No CSS changes
- No functional changes
