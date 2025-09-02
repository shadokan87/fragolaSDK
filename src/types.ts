export type maybePromise<T> = Promise<T> | T;
export type Prettify<T> = {
    [K in keyof T]: T[K];
  } & {};
export type StoreLike<T> = T extends Record<string, any> ? T : never;