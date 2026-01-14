[
  {
    "id": "root",
    "component": {
      "Column": {
        "children": {
          "explicitList": [
            "headerText",
            "textDemo",
            "iconDemo",
            "rowDemo",
            "columnDemo",
            "cardDemo",
            "buttonDemo",
            "textFieldDemo",
            "checkBoxDemo",
            "sliderDemo",
            "dividerDemo",
            "listDemo",
            "tabsDemo",
            "modalDemoEntry",
            "modalDemoContent",
            "multipleChoiceDemo",
            "dateTimeInputDemo"
          ]
        },
        "distribution": "start",
        "alignment": "stretch"
      }
    }
  },
  {
    "id": "headerText",
    "component": {
      "Text": {
        "text": {
          "literalString": "A2UI Components Demo"
        },
        "usageHint": "h1"
      }
    }
  },
  {
    "id": "textDemo",
    "component": {
      "Text": {
        "text": {
          "literalString": "This is a Text component example."
        },
        "usageHint": "body"
      }
    }
  },
  {
    "id": "iconDemo",
    "component": {
      "Row": {
        "children": {
          "explicitList": [
            "iconStar",
            "iconFavorite",
            "iconHome"
          ]
        },
        "distribution": "start",
        "alignment": "center"
      }
    }
  },
  {
    "id": "iconStar",
    "component": {
      "Icon": {
        "name": {
          "literalString": "star"
        }
      }
    }
  },
  {
    "id": "iconFavorite",
    "component": {
      "Icon": {
        "name": {
          "literalString": "favorite"
        }
      }
    }
  },
  {
    "id": "iconHome",
    "component": {
      "Icon": {
        "name": {
          "literalString": "home"
        }
      }
    }
  },
  {
    "id": "rowDemo",
    "component": {
      "Row": {
        "children": {
          "explicitList": [
            "rowText1",
            "rowText2",
            "rowText3"
          ]
        },
        "distribution": "spaceAround",
        "alignment": "center"
      }
    }
  },
  {
    "id": "rowText1",
    "component": {
      "Text": {
        "text": {
          "literalString": "Row Item 1"
        }
      }
    }
  },
  {
    "id": "rowText2",
    "component": {
      "Text": {
        "text": {
          "literalString": "Row Item 2"
        }
      }
    }
  },
  {
    "id": "rowText3",
    "component": {
      "Text": {
        "text": {
          "literalString": "Row Item 3"
        }
      }
    }
  },
  {
    "id": "columnDemo",
    "component": {
      "Column": {
        "children": {
          "explicitList": [
            "colText1",
            "colText2",
            "colText3"
          ]
        },
        "distribution": "spaceBetween",
        "alignment": "center"
      }
    }
  },
  {
    "id": "colText1",
    "component": {
      "Text": {
        "text": {
          "literalString": "Column Item 1"
        }
      }
    }
  },
  {
    "id": "colText2",
    "component": {
      "Text": {
        "text": {
          "literalString": "Column Item 2"
        }
      }
    }
  },
  {
    "id": "colText3",
    "component": {
      "Text": {
        "text": {
          "literalString": "Column Item 3"
        }
      }
    }
  },
  {
    "id": "cardDemo",
    "component": {
      "Card": {
        "child": "cardContent"
      }
    }
  },
  {
    "id": "cardContent",
    "component": {
      "Column": {
        "children": {
          "explicitList": [
            "cardTitle",
            "cardDesc"
          ]
        },
        "distribution": "start",
        "alignment": "start"
      }
    }
  },
  {
    "id": "cardTitle",
    "component": {
      "Text": {
        "text": {
          "literalString": "Card Title"
        },
        "usageHint": "h3"
      }
    }
  },
  {
    "id": "cardDesc",
    "component": {
      "Text": {
        "text": {
          "literalString": "This is a card description example."
        }
      }
    }
  },
  {
    "id": "buttonDemo",
    "component": {
      "Button": {
        "child": "buttonText",
        "action": {
          "name": "buttonClickDemo"
        },
        "primary": true
      }
    }
  },
  {
    "id": "buttonText",
    "component": {
      "Text": {
        "text": {
          "literalString": "Click Me"
        }
      }
    }
  },
  {
    "id": "textFieldDemo",
    "component": {
      "TextField": {
        "label": {
          "literalString": "Text Field Label"
        },
        "text": {
          "path": "/textFieldValue"
        },
        "textFieldType": "shortText"
      }
    }
  },
  {
    "id": "checkBoxDemo",
    "component": {
      "CheckBox": {
        "label": {
          "literalString": "Check this box"
        },
        "value": {
          "path": "/checkBoxValue"
        }
      }
    }
  },
  {
    "id": "sliderDemo",
    "component": {
      "Slider": {
        "value": {
          "path": "/sliderValue"
        },
        "minValue": 0,
        "maxValue": 100
      }
    }
  },
  {
    "id": "dividerDemo",
    "component": {
      "Divider": {
        "axis": "horizontal"
      }
    }
  },
  {
    "id": "listDemo",
    "component": {
      "List": {
        "children": {
          "template": {
            "componentId": "listItemTemplate",
            "dataBinding": "/listItems"
          }
        },
        "direction": "vertical",
        "alignment": "start"
      }
    }
  },
  {
    "id": "listItemTemplate",
    "component": {
      "Text": {
        "text": {
          "path": "/label"
        }
      }
    }
  },
  {
    "id": "tabsDemo",
    "component": {
      "Tabs": {
        "tabItems": [
          {
            "title": {
              "literalString": "Tab 1"
            },
            "child": "tab1Content"
          },
          {
            "title": {
              "literalString": "Tab 2"
            },
            "child": "tab2Content"
          }
        ]
      }
    }
  },
  {
    "id": "tab1Content",
    "component": {
      "Text": {
        "text": {
          "literalString": "Content of Tab 1"
        }
      }
    }
  },
  {
    "id": "tab2Content",
    "component": {
      "Text": {
        "text": {
          "literalString": "Content of Tab 2"
        }
      }
    }
  },
  {
    "id": "modalDemoEntry",
    "component": {
      "Button": {
        "child": "modalEntryText",
        "action": {
          "name": "openModal"
        }
      }
    }
  },
  {
    "id": "modalEntryText",
    "component": {
      "Text": {
        "text": {
          "literalString": "Open Modal"
        }
      }
    }
  },
  {
    "id": "modalDemoContent",
    "component": {
      "Text": {
        "text": {
          "literalString": "This is the modal content."
        }
      }
    }
  },
  {
    "id": "modalDemo",
    "component": {
      "Modal": {
        "entryPointChild": "modalDemoEntry",
        "contentChild": "modalDemoContent"
      }
    }
  },
  {
    "id": "multipleChoiceDemo",
    "component": {
      "MultipleChoice": {
        "selections": {
          "path": "/multipleChoiceSelections"
        },
        "options": [
          {
            "label": {
              "literalString": "Option 1"
            },
            "value": "option1"
          },
          {
            "label": {
              "literalString": "Option 2"
            },
            "value": "option2"
          },
          {
            "label": {
              "literalString": "Option 3"
            },
            "value": "option3"
          }
        ],
        "maxAllowedSelections": 2
      }
    }
  },
  {
    "id": "dateTimeInputDemo",
    "component": {
      "DateTimeInput": {
        "value": {
          "path": "/dateTimeValue"
        },
        "enableDate": true,
        "enableTime": true
      }
    }
  }
]