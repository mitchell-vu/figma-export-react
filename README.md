# Figma export SVG icons to React components

## How to use

Copy `.env.example` to `.env` and set variables.

```bash
cp .env.example .env
```

Set variables in `.env` file

1. `FIGMA_TOKEN` - Figma personal access token
2. `FIGMA_FILE_ID` - Figma file id
3. `FIGMA_PAGE` - Figma page name containing icons
4. `FIGMA_FRAME` - Figma frame name containing icons
5. `EXPORT_PATH` - Directory to export icons
6. `REMOVE_FROM_NAME` - Remove prefix from icon name

Run script

```bash
npm run generate
yarn generate
```

## How it works

1. Get Figma file ➡️ Page ➡️ Frame (if it set in .env)
2. Get Figma frame children as the icons
3. Get image AWS URL for each icon
4. Download icon from AWS
5. Convert SVG to React component and export to file `index.jsx`

## Example

`arrow-up-down.svg` ➡️ Append to index.jsx:

```jsx
export { default as ArrowUpDownSvg } from './arrow-up-down.svg';
```
