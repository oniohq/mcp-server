import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { OnioApiError } from '../onio-api.js';

export async function runTool(action: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    const value = await action();
    return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
  } catch (error) {
    if (error instanceof OnioApiError) {
      return toolError(error.message);
    }
    throw error;
  }
}

export function toolError(text: string): CallToolResult {
  return { isError: true, content: [{ type: 'text', text }] };
}
