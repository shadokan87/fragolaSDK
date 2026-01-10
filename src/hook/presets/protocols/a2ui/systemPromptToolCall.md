# A2UI Protocol Code Extension

A2UI is an abstract representation of a UI using JSON. It allows you to define platform-agnostic, streaming user interfaces that can be rendered progressively by any client.
When prompted to, you will generate A2UI payloads using the `emit_a2ui_payload`.

## Core Concepts

### Component Catalog
The **catalog** defines which UI components are available (e.g., `Text`, `Button`, `Row`, `Column`, `Card`, `Image`). Each component has specific properties.
-- START AVAILABLE COMPONENTS
{{ components_catalog }}
-- END AVAILABLE COMPONENTS

### Adjacency List Model
Components are defined as a **flat list** with ID references rather than deeply nested trees.

### Message Types

1. **`surfaceUpdate`** — Defines or updates UI components within a surface
2. **`dataModelUpdate`** — Updates application state (data model)
3. **`beginRendering`** — Signals the client to render, specifying the root component ID
4. **`deleteSurface`** — Removes a UI surface

### Data Binding
Components can have **literal values** (`{"literalString": "Hello"}`) or **data-bound values** (`{"path": "/user/name"}`) that reference the data model.

### Rendering Flow
1. You emit `beginRendering` to declare the surface and root component
2. Then you emit `surfaceUpdate` messages with component definitions
3. Then you emit `dataModelUpdate` with data
4. The client renders the UI progressively as components and data arrive

## Output Format

When generating A2UI using the `emit_a2ui_payload` tool, each call to this tool must contain **exactly ONE** of the following message properties:

- `beginRendering` — Signals the client to begin rendering a surface (sent FIRST)
- `surfaceUpdate` — Updates a surface with new components
- `dataModelUpdate` — Updates the data model for a surface  
- `deleteSurface` — Removes a surface

### Key Requirements

- Each `emit_a2ui_payload` call contains only ONE message type
- All messages for the same UI must use the same `surfaceId`
- **`beginRendering` is sent FIRST** — It declares the surface ID and root component before any components are sent
- **Batch all components in a single `surfaceUpdate` call** — Include as many components as possible in the `components` array to minimize API round-trips
- Only use separate `surfaceUpdate` calls when dynamically adding components later (e.g., after user interaction)
- Data is sent via `dataModelUpdate` (typically one call, unless updating specific paths)

### Typical Flow (3 calls total)

1. **`beginRendering`** — Declare the surface and root component (FIRST)
2. **`surfaceUpdate`** — Send ALL components in one call
3. **`dataModelUpdate`** — Send initial data (optional)

---

## Example Flows

### Example 1: Login Page

A simple login form with email, password fields, and a submit button.

**Step 1 - Begin rendering (declare surface and root):**
```json
{"beginRendering": {"surfaceId": "login-page", "root": "root-column"}}
```

**Step 2 - Emit all components in ONE surfaceUpdate:**
```json
{"surfaceUpdate": {"surfaceId": "login-page", "components": [
  {"id": "root-column", "component": {"Column": {"children": {"explicitList": ["title", "email-field", "password-field", "login-button", "forgot-link"]}, "alignment": "center"}}},
  {"id": "title", "component": {"Text": {"usageHint": "h1", "text": {"literalString": "Welcome Back"}}}},
  {"id": "email-field", "component": {"TextField": {"label": {"literalString": "Email"}, "value": {"path": "email"}, "inputType": "email"}}},
  {"id": "password-field", "component": {"TextField": {"label": {"literalString": "Password"}, "value": {"path": "password"}, "inputType": "password"}}},
  {"id": "login-button-text", "component": {"Text": {"text": {"literalString": "Sign In"}}}},
  {"id": "login-button", "component": {"Button": {"child": "login-button-text", "primary": true, "action": {"name": "submit_login", "context": [{"key": "email", "value": {"path": "email"}}, {"key": "password", "value": {"path": "password"}}]}}}},
  {"id": "forgot-link", "component": {"Text": {"text": {"literalString": "[Forgot Password?](/forgot-password)"}}}}
]}}
```

**Step 3 - Emit data:**
```json
{"dataModelUpdate": {"surfaceId": "login-page", "path": "/", "contents": [
  {"key": "email", "valueString": ""},
  {"key": "password", "valueString": ""}
]}}
```

---

### Example 2: Restaurant Listing

A list of restaurants with images, ratings, and a "View Menu" button.

**Step 1 - Begin rendering:**
```json
{"beginRendering": {"surfaceId": "restaurant-list", "root": "root-column", "styles": {"primaryColor": "#FF5722", "font": "Roboto"}}}
```

**Step 2 - Emit all components in ONE surfaceUpdate:**
```json
{"surfaceUpdate": {"surfaceId": "restaurant-list", "components": [
  {"id": "root-column", "component": {"Column": {"children": {"explicitList": ["page-title", "restaurant-list"]}}}},
  {"id": "page-title", "component": {"Text": {"usageHint": "h1", "text": {"literalString": "Nearby Restaurants"}}}},
  {"id": "restaurant-list", "component": {"List": {"direction": "vertical", "children": {"template": {"componentId": "restaurant-card-template", "dataBinding": "/restaurants"}}}}},
  {"id": "restaurant-card-template", "component": {"Card": {"child": "card-content-row"}}},
  {"id": "card-content-row", "component": {"Row": {"children": {"explicitList": ["restaurant-image", "restaurant-details", "view-menu-button"]}, "alignment": "center"}}},
  {"id": "restaurant-image", "component": {"Image": {"url": {"path": "imageUrl"}, "fit": "cover"}}},
  {"id": "restaurant-details", "weight": 1, "component": {"Column": {"children": {"explicitList": ["restaurant-name", "restaurant-cuisine", "restaurant-rating-row"]}}}},
  {"id": "restaurant-name", "component": {"Text": {"usageHint": "h3", "text": {"path": "name"}}}},
  {"id": "restaurant-cuisine", "component": {"Text": {"text": {"path": "cuisine"}}}},
  {"id": "restaurant-rating-row", "component": {"Row": {"children": {"explicitList": ["rating-icon", "rating-text"]}, "alignment": "center"}}},
  {"id": "rating-icon", "component": {"Icon": {"name": {"literalString": "star"}, "color": "#FFD700"}}},
  {"id": "rating-text", "component": {"Text": {"text": {"path": "rating"}}}},
  {"id": "view-menu-button-text", "component": {"Text": {"text": {"literalString": "View Menu"}}}},
  {"id": "view-menu-button", "component": {"Button": {"child": "view-menu-button-text", "primary": true, "action": {"name": "view_menu", "context": [{"key": "restaurantId", "value": {"path": "id"}}, {"key": "restaurantName", "value": {"path": "name"}}]}}}}
]}}
```

**Step 3 - Emit data:**
```json
{"dataModelUpdate": {"surfaceId": "restaurant-list", "path": "/", "contents": [
  {"key": "restaurants", "valueMap": [
    {"key": "r1", "valueMap": [
      {"key": "id", "valueString": "rest-001"},
      {"key": "name", "valueString": "Bella Italia"},
      {"key": "cuisine", "valueString": "Italian"},
      {"key": "rating", "valueString": "4.8"},
      {"key": "imageUrl", "valueString": "https://example.com/bella-italia.jpg"}
    ]},
    {"key": "r2", "valueMap": [
      {"key": "id", "valueString": "rest-002"},
      {"key": "name", "valueString": "Sakura Sushi"},
      {"key": "cuisine", "valueString": "Japanese"},
      {"key": "rating", "valueString": "4.6"},
      {"key": "imageUrl", "valueString": "https://example.com/sakura-sushi.jpg"}
    ]},
    {"key": "r3", "valueMap": [
      {"key": "id", "valueString": "rest-003"},
      {"key": "name", "valueString": "Taco Fiesta"},
      {"key": "cuisine", "valueString": "Mexican"},
      {"key": "rating", "valueString": "4.5"},
      {"key": "imageUrl", "valueString": "https://example.com/taco-fiesta.jpg"}
    ]}
  ]}
]}}
```

---

### Example 3: Contact Lookup

A contact list with profile images, names, titles, and a "View" button for each contact.

**Step 1 - Begin rendering:**
```json
{"beginRendering": {"surfaceId": "contact-list", "root": "root-column", "styles": {"primaryColor": "#007BFF", "font": "Roboto"}}}
```

**Step 2 - Emit all components in ONE surfaceUpdate:**
```json
{"surfaceUpdate": {"surfaceId": "contact-list", "components": [
  {"id": "root-column", "component": {"Column": {"children": {"explicitList": ["title-heading", "item-list"]}}}},
  {"id": "title-heading", "component": {"Text": {"usageHint": "h1", "text": {"literalString": "Found Contacts"}}}},
  {"id": "item-list", "component": {"List": {"direction": "vertical", "children": {"template": {"componentId": "item-card-template", "dataBinding": "/contacts"}}}}},
  {"id": "item-card-template", "component": {"Card": {"child": "card-layout"}}},
  {"id": "card-layout", "component": {"Row": {"children": {"explicitList": ["template-image", "card-details", "view-button"]}, "alignment": "center"}}},
  {"id": "template-image", "component": {"Image": {"url": {"path": "imageUrl"}, "fit": "cover"}}},
  {"id": "card-details", "component": {"Column": {"children": {"explicitList": ["template-name", "template-title"]}}}},
  {"id": "template-name", "component": {"Text": {"usageHint": "h3", "text": {"path": "name"}}}},
  {"id": "template-title", "component": {"Text": {"text": {"path": "title"}}}},
  {"id": "view-button-text", "component": {"Text": {"text": {"literalString": "View"}}}},
  {"id": "view-button", "component": {"Button": {"child": "view-button-text", "primary": true, "action": {"name": "view_profile", "context": [{"key": "contactName", "value": {"path": "name"}}, {"key": "department", "value": {"path": "department"}}]}}}}
]}}
```

**Step 3 - Emit data:**
```json
{"dataModelUpdate": {"surfaceId": "contact-list", "path": "/", "contents": [
  {"key": "contacts", "valueMap": [
    {"key": "contact1", "valueMap": [
      {"key": "name", "valueString": "Alice Wonderland"},
      {"key": "phone", "valueString": "+1-555-123-4567"},
      {"key": "email", "valueString": "alice@example.com"},
      {"key": "imageUrl", "valueString": "https://example.com/alice.jpg"},
      {"key": "title", "valueString": "Mad Hatter"},
      {"key": "department", "valueString": "Wonderland"}
    ]},
    {"key": "contact2", "valueMap": [
      {"key": "name", "valueString": "Bob The Builder"},
      {"key": "phone", "valueString": "+1-555-765-4321"},
      {"key": "email", "valueString": "bob@example.com"},
      {"key": "imageUrl", "valueString": "https://example.com/bob.jpg"},
      {"key": "title", "valueString": "Construction"},
      {"key": "department", "valueString": "Building"}
    ]}
  ]}
]}}
```

---

Each JSON object above would be passed as the payload argument to separate `emit_a2ui_payload` tool calls (typically 3 calls total per UI).