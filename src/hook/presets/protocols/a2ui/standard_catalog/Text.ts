// Auto-generated from Text.json
export const Text = {
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "text": {
      "type": "object",
      "description": "The text content to display. This can be a literal string or a reference to a value in the data model ('path', e.g., '/doc/title'). While simple Markdown formatting is supported (i.e. without HTML, images, or links), utilizing dedicated UI components is generally preferred for a richer and more structured presentation.",
      "additionalProperties": false,
      "properties": {
        "literalString": { "type": "string" },
        "path": { "type": "string" }
      }
    },
    "usageHint": { "type": "string", "description": "A hint for the base text style. One of:\n- `h1`: Largest heading.\n- `h2`: Second largest heading.\n- `h3`: Third largest heading.\n- `h4`: Fourth largest heading.\n- `h5`: Fifth largest heading.\n- `caption`: Small text for captions.\n- `body`: Standard body text.", "enum": ["h1","h2","h3","h4","h5","caption","body"] }
  },
  "required": ["text"]
} as const;
export type Text = typeof Text;
