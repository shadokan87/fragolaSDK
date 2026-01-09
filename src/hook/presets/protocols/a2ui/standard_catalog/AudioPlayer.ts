// Auto-generated from AudioPlayer.json
export const AudioPlayer = {
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "url": {
      "type": "object",
      "description": "The URL of the audio to be played. This can be a literal string ('literal') or a reference to a value in the data model ('path', e.g. '/song/url').",
      "additionalProperties": false,
      "properties": {
        "literalString": { "type": "string" },
        "path": { "type": "string" }
      }
    },
    "description": {
      "type": "object",
      "description": "A description of the audio, such as a title or summary. This can be a literal string or a reference to a value in the data model ('path', e.g. '/song/title').",
      "additionalProperties": false,
      "properties": {
        "literalString": { "type": "string" },
        "path": { "type": "string" }
      }
    }
  },
  "required": ["url"]
} as const;
export type AudioPlayer = typeof AudioPlayer;
