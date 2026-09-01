export function toSnakeCase(str: string) {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .toLowerCase();
}

export const addBackgroundTask = (
  env: any,
  promise: Promise<void | unknown>
) => {
  // background task is a no-op in local env
};
