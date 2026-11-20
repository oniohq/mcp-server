import createClient, { type Client } from 'openapi-fetch';
import type { Config } from './config.js';
import type { components, paths } from './generated/openapi.js';
import { SERVER_NAME, PACKAGE_VERSION } from './version.js';

type Schemas = components['schemas'];
export type Wishlist = Schemas['Wishlist'];
export type Wish = Schemas['Wish'];
type CreateWishlistInput = Schemas['CreateWishlist'];
type UpdateWishlistInput = Schemas['UpdateWishlist'];
export type CreateWishInput = Schemas['CreateWish'];
type UpdateWishInput = Schemas['UpdateWish'];

type Scope = 'wishlists:read' | 'wishlists:write' | 'wishes:write';

export interface Collection<T> {
  items: T[];
  truncated: boolean;
}

interface Page<T> {
  data: T[];
  nextCursor: string | null;
}

interface ApiResult<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

const PAGE_SIZE = 100;
const MAX_PAGES = 10;

export class OnioApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'OnioApiError';
  }
}

export class OnioApi {
  private readonly client: Client<paths>;

  constructor(config: Config, fetchFn: typeof fetch = globalThis.fetch) {
    this.client = createClient<paths>({
      baseUrl: config.apiUrl,
      fetch: (request) => sendRequest(fetchFn, request),
      headers: {
        Authorization: `Bearer ${config.token}`,
        'User-Agent': `${SERVER_NAME}/${PACKAGE_VERSION}`,
      },
    });
  }

  listWishlists(): Promise<Collection<Wishlist>> {
    return collectPages((cursor) =>
      this.read(
        this.client.GET('/api/v1/wishlists', { params: { query: { limit: PAGE_SIZE, cursor } } }),
      ),
    );
  }

  getWishlist(wishlistId: string): Promise<Wishlist> {
    return this.read(
      this.client.GET('/api/v1/wishlists/{wishlistId}', { params: { path: { wishlistId } } }),
    );
  }

  listWishes(wishlistId: string): Promise<Collection<Wish>> {
    return collectPages((cursor) =>
      this.read(
        this.client.GET('/api/v1/wishlists/{wishlistId}/wishes', {
          params: { path: { wishlistId }, query: { limit: PAGE_SIZE, cursor } },
        }),
      ),
    );
  }

  createWishlist(body: CreateWishlistInput): Promise<Wishlist> {
    return this.unwrap('wishlists:write', this.client.POST('/api/v1/wishlists', { body }));
  }

  updateWishlist(wishlistId: string, body: UpdateWishlistInput): Promise<Wishlist> {
    return this.unwrap(
      'wishlists:write',
      this.client.PATCH('/api/v1/wishlists/{wishlistId}', {
        params: { path: { wishlistId } },
        body,
      }),
    );
  }

  createWish(wishlistId: string, body: CreateWishInput): Promise<Wish> {
    return this.unwrap(
      'wishes:write',
      this.client.POST('/api/v1/wishlists/{wishlistId}/wishes', {
        params: { path: { wishlistId } },
        body,
      }),
    );
  }

  updateWish(wishlistId: string, wishId: string, body: UpdateWishInput): Promise<Wish> {
    return this.unwrap(
      'wishes:write',
      this.client.PATCH('/api/v1/wishlists/{wishlistId}/wishes/{wishId}', {
        params: { path: { wishlistId, wishId } },
        body,
      }),
    );
  }

  private read<T>(call: Promise<ApiResult<T>>): Promise<T> {
    return this.unwrap('wishlists:read', call);
  }

  private async unwrap<T>(scope: Scope, call: Promise<ApiResult<T>>): Promise<T> {
    const { data, error, response } = await call;
    if (error !== undefined || data === undefined) {
      throw new OnioApiError(response.status, describeFailure(response, error, scope));
    }
    return data;
  }
}

async function sendRequest(fetchFn: typeof fetch, request: Request): Promise<Response> {
  try {
    return await fetchFn(request);
  } catch {
    throw new OnioApiError(0, 'Onio is not reachable. Check the network connection and try again.');
  }
}

async function collectPages<T>(
  fetchPage: (cursor: string | undefined) => Promise<Page<T>>,
): Promise<Collection<T>> {
  const items: T[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await fetchPage(cursor);
    items.push(...result.data);
    if (!result.nextCursor) {
      return { items, truncated: false };
    }
    cursor = result.nextCursor;
  }
  return { items, truncated: true };
}

function describeFailure(response: Response, error: unknown, scope: Scope): string {
  switch (response.status) {
    case 401:
      return 'Onio rejected the token. It is missing, unknown or revoked. Create a new token in your Onio profile and update ONIO_TOKEN.';
    case 403:
      return `The token does not have the "${scope}" permission. Create a token with this permission in your Onio profile.`;
    case 429:
      return `Onio's rate limit is reached. Try again in ${response.headers.get('Retry-After') ?? 60} seconds.`;
  }
  if (response.status >= 500) {
    return `Onio answered with an error (${response.status}). Try again later.`;
  }
  return apiMessage(error) ?? `Onio answered with status ${response.status}.`;
}

function apiMessage(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const { message } = error;
    return typeof message === 'string' ? message : undefined;
  }
  return undefined;
}
