import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod';
import { type OnioApi, OnioApiError, type Wish, type Wishlist } from '../onio-api.js';
import { runTool } from './result.js';
import { WishlistId } from './schemas.js';

const READ_ONLY = { readOnlyHint: true } as const;

export function registerReadTools(server: McpServer, api: OnioApi): void {
  server.registerTool(
    'list_wishlists',
    {
      title: 'List wishlists',
      description:
        'Lists the wishlists the user owns, including private and archived ones, without their wishes. Lists that others share with the user are not included.',
      annotations: READ_ONLY,
    },
    () =>
      runTool(async () => {
        const { items, truncated } = await api.listWishlists();
        return { wishlists: items, truncated };
      }),
  );

  server.registerTool(
    'get_wishlist',
    {
      title: 'Get wishlist',
      description: 'Gets one wishlist the user owns, with all its wishes.',
      inputSchema: { wishlistId: WishlistId },
      annotations: READ_ONLY,
    },
    ({ wishlistId }) =>
      runTool(async () => {
        const [wishlist, wishes] = await Promise.all([
          api.getWishlist(wishlistId),
          api.listWishes(wishlistId),
        ]);
        return { ...wishlist, wishes: wishes.items, wishesTruncated: wishes.truncated };
      }),
  );

  server.registerTool(
    'search_wishes',
    {
      title: 'Search wishes',
      description:
        'Finds wishes whose title, description or link contains the query, ignoring case. Searches all wishlists the user owns, or one wishlist. Searching all lists reads each list, so it is slow for many lists.',
      inputSchema: {
        query: z.string().trim().min(1).max(200),
        wishlistId: WishlistId.optional().describe(
          'Search only this wishlist. Leave out to search all wishlists.',
        ),
      },
      annotations: READ_ONLY,
    },
    ({ query, wishlistId }) => runTool(() => searchWishes(api, query, wishlistId)),
  );
}

async function searchWishes(api: OnioApi, query: string, wishlistId: string | undefined) {
  const wishlists = wishlistId
    ? { items: [await api.getWishlist(wishlistId)], truncated: false }
    : await api.listWishlists();
  const needle = query.toLocaleLowerCase();
  const matches: { wishlist: Pick<Wishlist, 'id' | 'title'>; wish: Wish }[] = [];
  let truncated = wishlists.truncated;

  for (const wishlist of wishlists.items) {
    let wishes;
    try {
      wishes = await api.listWishes(wishlist.id);
    } catch (error) {
      if (error instanceof OnioApiError && error.status === 429) {
        return { matches, truncated: true, stoppedEarly: error.message };
      }
      throw error;
    }
    truncated ||= wishes.truncated;
    for (const wish of wishes.items.filter((item) => matchesQuery(item, needle))) {
      matches.push({ wishlist: { id: wishlist.id, title: wishlist.title }, wish });
    }
  }
  return { matches, truncated };
}

function matchesQuery(wish: Wish, needle: string): boolean {
  return [wish.title, wish.description, wish.url].some((field) =>
    field?.toLocaleLowerCase().includes(needle),
  );
}
