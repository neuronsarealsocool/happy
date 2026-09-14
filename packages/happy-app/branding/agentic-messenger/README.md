# AgenticMessenger Brand Assets

The SVG files are the editable source of truth for the selected AgenticMessenger option A.

- `agentic-messenger-mark.svg`: full-color master mark
- `agentic-messenger-foreground.svg`: Android adaptive foreground
- `agentic-messenger-monochrome.svg`: Android themed/notification source
- `agentic-messenger-wordmark.svg`: horizontal wordmark
- `generated/`: raster exports created by the generator

The generated pack includes 1024px app/adaptive masters, Android monochrome and
notification images, 512px and 192px web icons, a 256px chat-head image, 48px
and 32px favicons, and a 2200px horizontal wordmark.

Run `node scripts/generate-agentic-messenger-assets.mjs` from the repository root after editing an SVG source.
