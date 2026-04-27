export interface ToolHandler {
  provider: string;
  execute: (params: Record<string, any>, accessToken: string) => Promise<any>;
}

const registry: Record<string, ToolHandler> = {};

export function registerTool(name: string, handler: ToolHandler) {
  registry[name] = handler;
}

export function getTool(name: string): ToolHandler | null {
  return registry[name] ?? null;
}

export function isToolConfigured(name: string): boolean {
  return Boolean(registry[name]);
}
