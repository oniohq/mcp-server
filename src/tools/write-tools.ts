import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod';
import type { OnioApi } from '../onio-api.js';
import { runTool, toolError } from './result.js';
import { Occasion, PriceRange, Priority, WishId, WishlistId, WishStatus } from './schemas.js';

const CONFIRM = 'Changes the user’s data in Onio. Ask the user to confirm first.';
const PATCH = 'Send only the fields to change. `null` clears an optional field.';

const CREATES = { readOnlyHint: false, destructiveHint: false } as const;
const UPDATES = { readOnlyHint: false, destructiveHint: true, idempotentHint: true } as const;

const ProductLink = z
  .string()
  .describe('The product link. Must start with `http://` or `https://`.');
const ImageLink = z
  .string()
  .describe('A link to an image. Must start with `http://` or `https://`.');

export function registerWriteTools(server: McpServer, api: OnioApi): void {
  server.registerTool(
    'create_wishlist',
    {
      title: 'Create wishlist',
      description: `Creates a wishlist. It starts as Private, so nobody else can see it. ${CONFIRM}`,
      inputSchema: {
        title: z.string(),
        occasion: Occasion.optional().describe(`${Occasion.description} Defaults to \`other\`.`),
        notes: z.string().optional(),
      },
      annotations: CREATES,
    },
    (input) => runTool(() => api.createWishlist(input)),
  );

  server.registerTool(
    'update_wishlist',
    {
      title: 'Update wishlist',
      description: `Changes the title, occasion or notes of a wishlist the user owns. ${PATCH} ${CONFIRM}`,
      inputSchema: {
        wishlistId: WishlistId,
        title: z.string().optional(),
        occasion: Occasion.optional(),
        notes: z.string().nullable().optional(),
      },
      annotations: UPDATES,
    },
    ({ wishlistId, ...changes }) =>
      runUpdate(changes, () => api.updateWishlist(wishlistId, changes)),
  );

  server.registerTool(
    'add_wish',
    {
      title: 'Add wish',
      description: `Adds a wish to a wishlist the user owns. New wishes have status \`published\` and normal priority unless set otherwise. Archived wishlists take no new wishes. ${CONFIRM}`,
      inputSchema: {
        wishlistId: WishlistId,
        title: z.string(),
        description: z.string().optional(),
        priority: Priority.optional(),
        priceRange: PriceRange.optional(),
        url: ProductLink.optional(),
        imageUrl: ImageLink.optional(),
        status: WishStatus.optional(),
      },
      annotations: CREATES,
    },
    ({ wishlistId, ...wish }) => runTool(() => api.createWish(wishlistId, wish)),
  );

  server.registerTool(
    'update_wish',
    {
      title: 'Update wish',
      description: `Changes a wish in a wishlist the user owns. ${PATCH} ${CONFIRM}`,
      inputSchema: {
        wishlistId: WishlistId,
        wishId: WishId,
        title: z.string().optional(),
        description: z.string().nullable().optional(),
        priority: Priority.optional(),
        priceRange: PriceRange.nullable().optional(),
        url: ProductLink.nullable().optional(),
        imageUrl: ImageLink.nullable().optional(),
        status: WishStatus.optional(),
      },
      annotations: UPDATES,
    },
    ({ wishlistId, wishId, ...changes }) =>
      runUpdate(changes, () => api.updateWish(wishlistId, wishId, changes)),
  );
}

async function runUpdate(changes: object, action: () => Promise<unknown>): Promise<CallToolResult> {
  if (Object.keys(changes).length === 0) {
    return toolError('Send at least one field to change.');
  }
  return runTool(action);
}
