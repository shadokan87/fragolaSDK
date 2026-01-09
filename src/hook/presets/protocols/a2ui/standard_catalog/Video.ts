// Auto-generated from Video.json
export const Video = {
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "url": {
      "type": "object",
      "description": "The URL of the video to display. This can be a literal string or a reference to a value in the data model ('path', e.g. '/video/url').",
      "additionalProperties": false,
      "properties": {
        "literalString": { "type": "string" },
        "path": { "type": "string" }
      }
    }
  },
  "required": ["url"]
} as const;
export type Video = typeof Video;
