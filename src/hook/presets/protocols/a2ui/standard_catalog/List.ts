// Auto-generated from List.json
export const List = {
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "children": {
      "type": "object",
      "description": "Defines the children. Use 'explicitList' for a fixed set of children, or 'template' to generate children from a data list.",
      "additionalProperties": false,
      "properties": {
        "explicitList": { "type": "array", "items": { "type": "string" } },
        "template": {
          "type": "object",
          "description": "A template for generating a dynamic list of children from a data model list. `componentId` is the component to use as a template, and `dataBinding` is the path to the map of components in the data model. Values in the map will define the list of children.",
          "additionalProperties": false,
          "properties": {
            "componentId": { "type": "string" },
            "dataBinding": { "type": "string" }
          },
          "required": ["componentId", "dataBinding"]
        }
      }
    },
    "direction": { "type": "string", "description": "The direction in which the list items are laid out.", "enum": ["vertical", "horizontal"] },
    "alignment": { "type": "string", "description": "Defines the alignment of children along the cross axis.", "enum": ["start", "center", "end", "stretch"] }
  },
  "required": ["children"]
} as const;
export type List = typeof List;
