import { z } from "zod"

export const payloadSchema = z.object({
  title: z.string(),
  description: z.string(),
  type: z.string(),
  additionalProperties: z.boolean(),
  properties: z.object({
    beginRendering: z.object({
      type: z.string(),
      description: z.string(),
      additionalProperties: z.boolean(),
      properties: z.object({
        surfaceId: z.object({ type: z.string(), description: z.string() }),
        root: z.object({ type: z.string(), description: z.string() }),
        styles: z.object({
          type: z.string(),
          description: z.string(),
          additionalProperties: z.boolean(),
          properties: z.object({
            font: z.object({ type: z.string(), description: z.string() }),
            primaryColor: z.object({
              type: z.string(),
              description: z.string(),
              pattern: z.string()
            })
          })
        })
      }),
      required: z.array(z.string())
    }),
    surfaceUpdate: z.object({
      type: z.string(),
      description: z.string(),
      additionalProperties: z.boolean(),
      properties: z.object({
        surfaceId: z.object({ type: z.string(), description: z.string() }),
        components: z.object({
          type: z.string(),
          description: z.string(),
          minItems: z.number(),
          items: z.object({
            type: z.string(),
            description: z.string(),
            additionalProperties: z.boolean(),
            properties: z.object({
              id: z.object({ type: z.string(), description: z.string() }),
              weight: z.object({ type: z.string(), description: z.string() }),
              component: z.object({
                type: z.string(),
                description: z.string(),
                additionalProperties: z.boolean(),
                properties: z.object({
                  Text: z.object({
                    type: z.string(),
                    additionalProperties: z.boolean(),
                    properties: z.object({
                      text: z.object({
                        type: z.string(),
                        description: z.string(),
                        additionalProperties: z.boolean(),
                        properties: z.object({
                          literalString: z.object({ type: z.string() }),
                          path: z.object({ type: z.string() })
                        })
                      }),
                      usageHint: z.object({
                        type: z.string(),
                        description: z.string(),
                        enum: z.array(z.string())
                      })
                    }),
                    required: z.array(z.string())
                  }),
                  Image: z.object({
                    type: z.string(),
                    additionalProperties: z.boolean(),
                    properties: z.object({
                      url: z.object({
                        type: z.string(),
                        description: z.string(),
                        additionalProperties: z.boolean(),
                        properties: z.object({
                          literalString: z.object({ type: z.string() }),
                          path: z.object({ type: z.string() })
                        })
                      }),
                      fit: z.object({
                        type: z.string(),
                        description: z.string(),
                        enum: z.array(z.string())
                      }),
                      usageHint: z.object({
                        type: z.string(),
                        description: z.string(),
                        enum: z.array(z.string())
                      })
                    }),
                    required: z.array(z.string())
                  }),
                  Icon: z.object({
                    type: z.string(),
                    additionalProperties: z.boolean(),
                    properties: z.object({
                      name: z.object({
                        type: z.string(),
                        description: z.string(),
                        additionalProperties: z.boolean(),
                        properties: z.object({
                          literalString: z.object({
                            type: z.string(),
                            enum: z.array(z.string())
                          }),
                          path: z.object({ type: z.string() })
                        })
                      })
                    }),
                    required: z.array(z.string())
                  }),
                  Video: z.object({
                    type: z.string(),
                    additionalProperties: z.boolean(),
                    properties: z.object({
                      url: z.object({
                        type: z.string(),
                        description: z.string(),
                        additionalProperties: z.boolean(),
                        properties: z.object({
                          literalString: z.object({ type: z.string() }),
                          path: z.object({ type: z.string() })
                        })
                      })
                    }),
                    required: z.array(z.string())
                  }),
                  AudioPlayer: z.object({
                    type: z.string(),
                    additionalProperties: z.boolean(),
                    properties: z.object({
                      url: z.object({
                        type: z.string(),
                        description: z.string(),
                        additionalProperties: z.boolean(),
                        properties: z.object({
                          literalString: z.object({ type: z.string() }),
                          path: z.object({ type: z.string() })
                        })
                      }),
                      description: z.object({
                        type: z.string(),
                        description: z.string(),
                        additionalProperties: z.boolean(),
                        properties: z.object({
                          literalString: z.object({ type: z.string() }),
                          path: z.object({ type: z.string() })
                        })
                      })
                    }),
                    required: z.array(z.string())
                  }),
                  Row: z.object({
                    type: z.string(),
                    additionalProperties: z.boolean(),
                    properties: z.object({
                      children: z.object({
                        type: z.string(),
                        description: z.string(),
                        additionalProperties: z.boolean(),
                        properties: z.object({
                          explicitList: z.object({
                            type: z.string(),
                            items: z.object({ type: z.string() })
                          }),
                          template: z.object({
                            type: z.string(),
                            description: z.string(),
                            additionalProperties: z.boolean(),
                            properties: z.object({
                              componentId: z.object({ type: z.string() }),
                              dataBinding: z.object({ type: z.string() })
                            }),
                            required: z.array(z.string())
                          })
                        })
                      }),
                      distribution: z.object({
                        type: z.string(),
                        description: z.string(),
                        enum: z.array(z.string())
                      }),
                      alignment: z.object({
                        type: z.string(),
                        description: z.string(),
                        enum: z.array(z.string())
                      })
                    }),
                    required: z.array(z.string())
                  }),
                  Column: z.object({
                    type: z.string(),
                    additionalProperties: z.boolean(),
                    properties: z.object({
                      children: z.object({
                        type: z.string(),
                        description: z.string(),
                        additionalProperties: z.boolean(),
                        properties: z.object({
                          explicitList: z.object({
                            type: z.string(),
                            items: z.object({ type: z.string() })
                          }),
                          template: z.object({
                            type: z.string(),
                            description: z.string(),
                            additionalProperties: z.boolean(),
                            properties: z.object({
                              componentId: z.object({ type: z.string() }),
                              dataBinding: z.object({ type: z.string() })
                            }),
                            required: z.array(z.string())
                          })
                        })
                      }),
                      distribution: z.object({
                        type: z.string(),
                        description: z.string(),
                        enum: z.array(z.string())
                      }),
                      alignment: z.object({
                        type: z.string(),
                        description: z.string(),
                        enum: z.array(z.string())
                      })
                    }),
                    required: z.array(z.string())
                  }),
                  List: z.object({
                    type: z.string(),
                    additionalProperties: z.boolean(),
                    properties: z.object({
                      children: z.object({
                        type: z.string(),
                        description: z.string(),
                        additionalProperties: z.boolean(),
                        properties: z.object({
                          explicitList: z.object({
                            type: z.string(),
                            items: z.object({ type: z.string() })
                          }),
                          template: z.object({
                            type: z.string(),
                            description: z.string(),
                            additionalProperties: z.boolean(),
                            properties: z.object({
                              componentId: z.object({ type: z.string() }),
                              dataBinding: z.object({ type: z.string() })
                            }),
                            required: z.array(z.string())
                          })
                        })
                      }),
                      direction: z.object({
                        type: z.string(),
                        description: z.string(),
                        enum: z.array(z.string())
                      }),
                      alignment: z.object({
                        type: z.string(),
                        description: z.string(),
                        enum: z.array(z.string())
                      })
                    }),
                    required: z.array(z.string())
                  }),
                  Card: z.object({
                    type: z.string(),
                    additionalProperties: z.boolean(),
                    properties: z.object({
                      child: z.object({
                        type: z.string(),
                        description: z.string()
                      })
                    }),
                    required: z.array(z.string())
                  }),
                  Tabs: z.object({
                    type: z.string(),
                    additionalProperties: z.boolean(),
                    properties: z.object({
                      tabItems: z.object({
                        type: z.string(),
                        description: z.string(),
                        items: z.object({
                          type: z.string(),
                          additionalProperties: z.boolean(),
                          properties: z.object({
                            title: z.object({
                              type: z.string(),
                              description: z.string(),
                              additionalProperties: z.boolean(),
                              properties: z.object({
                                literalString: z.object({ type: z.string() }),
                                path: z.object({ type: z.string() })
                              })
                            }),
                            child: z.object({ type: z.string() })
                          }),
                          required: z.array(z.string())
                        })
                      })
                    }),
                    required: z.array(z.string())
                  }),
                  Divider: z.object({
                    type: z.string(),
                    additionalProperties: z.boolean(),
                    properties: z.object({
                      axis: z.object({
                        type: z.string(),
                        description: z.string(),
                        enum: z.array(z.string())
                      })
                    })
                  }),
                  Modal: z.object({
                    type: z.string(),
                    additionalProperties: z.boolean(),
                    properties: z.object({
                      entryPointChild: z.object({
                        type: z.string(),
                        description: z.string()
                      }),
                      contentChild: z.object({
                        type: z.string(),
                        description: z.string()
                      })
                    }),
                    required: z.array(z.string())
                  }),
                  Button: z.object({
                    type: z.string(),
                    additionalProperties: z.boolean(),
                    properties: z.object({
                      child: z.object({
                        type: z.string(),
                        description: z.string()
                      }),
                      primary: z.object({
                        type: z.string(),
                        description: z.string()
                      }),
                      action: z.object({
                        type: z.string(),
                        description: z.string(),
                        additionalProperties: z.boolean(),
                        properties: z.object({
                          name: z.object({ type: z.string() }),
                          context: z.object({
                            type: z.string(),
                            items: z.object({
                              type: z.string(),
                              additionalProperties: z.boolean(),
                              properties: z.object({
                                key: z.object({ type: z.string() }),
                                value: z.object({
                                  type: z.string(),
                                  description: z.string(),
                                  additionalProperties: z.boolean(),
                                  properties: z.object({
                                    path: z.object({ type: z.string() }),
                                    literalString: z.object({
                                      type: z.string()
                                    }),
                                    literalNumber: z.object({
                                      type: z.string()
                                    }),
                                    literalBoolean: z.object({
                                      type: z.string()
                                    })
                                  })
                                })
                              }),
                              required: z.array(z.string())
                            })
                          })
                        }),
                        required: z.array(z.string())
                      })
                    }),
                    required: z.array(z.string())
                  }),
                  CheckBox: z.object({
                    type: z.string(),
                    additionalProperties: z.boolean(),
                    properties: z.object({
                      label: z.object({
                        type: z.string(),
                        description: z.string(),
                        additionalProperties: z.boolean(),
                        properties: z.object({
                          literalString: z.object({ type: z.string() }),
                          path: z.object({ type: z.string() })
                        })
                      }),
                      value: z.object({
                        type: z.string(),
                        description: z.string(),
                        additionalProperties: z.boolean(),
                        properties: z.object({
                          literalBoolean: z.object({ type: z.string() }),
                          path: z.object({ type: z.string() })
                        })
                      })
                    }),
                    required: z.array(z.string())
                  }),
                  TextField: z.object({
                    type: z.string(),
                    additionalProperties: z.boolean(),
                    properties: z.object({
                      label: z.object({
                        type: z.string(),
                        description: z.string(),
                        additionalProperties: z.boolean(),
                        properties: z.object({
                          literalString: z.object({ type: z.string() }),
                          path: z.object({ type: z.string() })
                        })
                      }),
                      text: z.object({
                        type: z.string(),
                        description: z.string(),
                        additionalProperties: z.boolean(),
                        properties: z.object({
                          literalString: z.object({ type: z.string() }),
                          path: z.object({ type: z.string() })
                        })
                      }),
                      textFieldType: z.object({
                        type: z.string(),
                        description: z.string(),
                        enum: z.array(z.string())
                      }),
                      validationRegexp: z.object({
                        type: z.string(),
                        description: z.string()
                      })
                    }),
                    required: z.array(z.string())
                  }),
                  DateTimeInput: z.object({
                    type: z.string(),
                    additionalProperties: z.boolean(),
                    properties: z.object({
                      value: z.object({
                        type: z.string(),
                        description: z.string(),
                        additionalProperties: z.boolean(),
                        properties: z.object({
                          literalString: z.object({ type: z.string() }),
                          path: z.object({ type: z.string() })
                        })
                      }),
                      enableDate: z.object({
                        type: z.string(),
                        description: z.string()
                      }),
                      enableTime: z.object({
                        type: z.string(),
                        description: z.string()
                      })
                    }),
                    required: z.array(z.string())
                  }),
                  MultipleChoice: z.object({
                    type: z.string(),
                    additionalProperties: z.boolean(),
                    properties: z.object({
                      selections: z.object({
                        type: z.string(),
                        description: z.string(),
                        additionalProperties: z.boolean(),
                        properties: z.object({
                          literalArray: z.object({
                            type: z.string(),
                            items: z.object({ type: z.string() })
                          }),
                          path: z.object({ type: z.string() })
                        })
                      }),
                      options: z.object({
                        type: z.string(),
                        description: z.string(),
                        items: z.object({
                          type: z.string(),
                          additionalProperties: z.boolean(),
                          properties: z.object({
                            label: z.object({
                              type: z.string(),
                              description: z.string(),
                              additionalProperties: z.boolean(),
                              properties: z.object({
                                literalString: z.object({ type: z.string() }),
                                path: z.object({ type: z.string() })
                              })
                            }),
                            value: z.object({
                              type: z.string(),
                              description: z.string()
                            })
                          }),
                          required: z.array(z.string())
                        })
                      }),
                      maxAllowedSelections: z.object({
                        type: z.string(),
                        description: z.string()
                      })
                    }),
                    required: z.array(z.string())
                  }),
                  Slider: z.object({
                    type: z.string(),
                    additionalProperties: z.boolean(),
                    properties: z.object({
                      value: z.object({
                        type: z.string(),
                        description: z.string(),
                        additionalProperties: z.boolean(),
                        properties: z.object({
                          literalNumber: z.object({ type: z.string() }),
                          path: z.object({ type: z.string() })
                        })
                      }),
                      minValue: z.object({
                        type: z.string(),
                        description: z.string()
                      }),
                      maxValue: z.object({
                        type: z.string(),
                        description: z.string()
                      })
                    }),
                    required: z.array(z.string())
                  })
                })
              })
            }),
            required: z.array(z.string())
          })
        })
      }),
      required: z.array(z.string())
    }),
    dataModelUpdate: z.object({
      type: z.string(),
      description: z.string(),
      additionalProperties: z.boolean(),
      properties: z.object({
        surfaceId: z.object({ type: z.string(), description: z.string() }),
        path: z.object({ type: z.string(), description: z.string() }),
        contents: z.object({
          type: z.string(),
          description: z.string(),
          items: z.object({
            type: z.string(),
            description: z.string(),
            additionalProperties: z.boolean(),
            properties: z.object({
              key: z.object({ type: z.string(), description: z.string() }),
              valueString: z.object({ type: z.string() }),
              valueNumber: z.object({ type: z.string() }),
              valueBoolean: z.object({ type: z.string() }),
              valueMap: z.object({
                description: z.string(),
                type: z.string(),
                items: z.object({
                  type: z.string(),
                  description: z.string(),
                  additionalProperties: z.boolean(),
                  properties: z.object({
                    key: z.object({ type: z.string() }),
                    valueString: z.object({ type: z.string() }),
                    valueNumber: z.object({ type: z.string() }),
                    valueBoolean: z.object({ type: z.string() })
                  }),
                  required: z.array(z.string())
                })
              })
            }),
            required: z.array(z.string())
          })
        })
      }),
      required: z.array(z.string())
    }),
    deleteSurface: z.object({
      type: z.string(),
      description: z.string(),
      additionalProperties: z.boolean(),
      properties: z.object({
        surfaceId: z.object({ type: z.string(), description: z.string() })
      }),
      required: z.array(z.string())
    })
  })
})
