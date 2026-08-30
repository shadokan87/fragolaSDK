// A mock implementation of the Hono Context object to allow the Portkey translation logic
// to run completely client-side without any server dependencies.
export const createMockHonoContext = (body: any = {}) => {
    return {
        req: {
            url: "https://api.portkey.ai/v1/chat/completions",
            path: "/v1/chat/completions",
            header: (key: string) => "",
            param: (key?: string) => key ? "" : {},
            query: (key?: string) => key ? "" : {},
            json: async () => body,
            raw: {
                headers: new Headers()
            }
        },
        env: {},
        get: (key: string) => null,
        set: (key: string, value: any) => {}
    } as any; // Cast as any so typescript ignores the missing Hono methods
};
