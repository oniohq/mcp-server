import { readFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { afterEach, describe, expect, it } from 'vitest';
import { OnioApi, type Wish, type Wishlist } from './onio-api.js';
import { createServer } from './server.js';

const TOKEN = 'onio_pat_secret';
const BIRTHDAY_ID = '3f6c1a52-8d1e-4b7a-9c2e-1f5d7a9b0c41';
const WEDDING_ID = '9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d';

type Handler = (request: Request) => Response | Promise<Response>;

const json = (body: unknown, init?: ResponseInit) => Response.json(body, init);

function wishlist(id: string, title: string): Wishlist {
  return {
    id,
    title,
    occasion: 'other',
    notes: null,
    status: 'draft',
    createdAt: '2026-11-02T09:15:00.000Z',
    updatedAt: '2026-11-02T09:15:00.000Z',
  };
}

function wish(wishlistId: string, title: string, url: string | null = null): Wish {
  return {
    id: crypto.randomUUID(),
    wishlistId,
    title,
    description: null,
    priority: 'normal',
    priceRange: null,
    url,
    imageUrl: null,
    status: 'published',
    createdAt: '2026-11-03T14:20:00.000Z',
    updatedAt: '2026-11-03T14:20:00.000Z',
  };
}

let client: Client | undefined;
const requests: Request[] = [];

async function connect(handler: Handler): Promise<Client> {
  const fetchFn = async (request: Request) => {
    requests.push(request.clone());
    return handler(request);
  };
  const api = new OnioApi({ token: TOKEN, apiUrl: 'https://onio.test' }, fetchFn as typeof fetch);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await createServer(api).connect(serverTransport);
  client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(clientTransport);
  return client;
}

async function call(name: string, args: Record<string, unknown> = {}) {
  const result = (await client!.callTool({ name, arguments: args })) as CallToolResult;
  const text = result.content[0]?.type === 'text' ? result.content[0].text : '';
  return { isError: result.isError ?? false, text };
}

afterEach(async () => {
  await client?.close();
  client = undefined;
  requests.length = 0;
});

describe('Onio MCP server', () => {
  it('marks read tools as read-only and write tools as changing data', async () => {
    await connect(() => json({}));
    const { tools } = await client!.listTools();
    const readOnly = Object.fromEntries(
      tools.map((tool) => [tool.name, tool.annotations?.readOnlyHint]),
    );

    expect(readOnly).toEqual({
      list_wishlists: true,
      get_wishlist: true,
      search_wishes: true,
      create_wishlist: false,
      update_wishlist: false,
      add_wish: false,
      update_wish: false,
    });
  });

  it('lists the same tools as the Claude Desktop extension manifest', async () => {
    await connect(() => json({}));
    const { tools } = await client!.listTools();
    const manifest = JSON.parse(
      readFileSync(new URL('../mcpb/manifest.json', import.meta.url), 'utf8'),
    ) as { tools: { name: string }[] };

    expect(manifest.tools.map((tool) => tool.name)).toEqual(tools.map((tool) => tool.name));
  });

  it('returns a wishlist with the wishes of every page', async () => {
    await connect((request) => {
      const url = new URL(request.url);
      if (url.pathname === `/api/v1/wishlists/${BIRTHDAY_ID}`) {
        return json(wishlist(BIRTHDAY_ID, 'Birthday'));
      }
      return url.searchParams.get('cursor')
        ? json({ data: [wish(BIRTHDAY_ID, 'Book')], nextCursor: null })
        : json({ data: [wish(BIRTHDAY_ID, 'Watering can')], nextCursor: 'next' });
    });

    const result = JSON.parse((await call('get_wishlist', { wishlistId: BIRTHDAY_ID })).text);

    expect(result.title).toBe('Birthday');
    expect(result.wishes.map((item: Wish) => item.title)).toEqual(['Watering can', 'Book']);
    expect(result.wishesTruncated).toBe(false);
    expect(requests[0]?.headers.get('Authorization')).toBe(`Bearer ${TOKEN}`);
  });

  it('searches the wishes of all wishlists, ignoring case', async () => {
    await connect((request) => {
      const { pathname } = new URL(request.url);
      if (pathname === '/api/v1/wishlists') {
        return json({
          data: [wishlist(BIRTHDAY_ID, 'Birthday'), wishlist(WEDDING_ID, 'Wedding')],
          nextCursor: null,
        });
      }
      return pathname.includes(BIRTHDAY_ID)
        ? json({
            data: [wish(BIRTHDAY_ID, 'Headphones'), wish(BIRTHDAY_ID, 'Book')],
            nextCursor: null,
          })
        : json({
            data: [wish(WEDDING_ID, 'Speaker', 'https://example.com/HEADPHONES-stand')],
            nextCursor: null,
          });
    });

    const result = JSON.parse((await call('search_wishes', { query: 'headphones' })).text);

    expect(
      result.matches.map((match: { wishlist: Wishlist; wish: Wish }) => [
        match.wishlist.title,
        match.wish.title,
      ]),
    ).toEqual([
      ['Birthday', 'Headphones'],
      ['Wedding', 'Speaker'],
    ]);
  });

  it('returns the matches found so far when the rate limit stops a search', async () => {
    await connect((request) => {
      const { pathname } = new URL(request.url);
      if (pathname === '/api/v1/wishlists') {
        return json({
          data: [wishlist(BIRTHDAY_ID, 'Birthday'), wishlist(WEDDING_ID, 'Wedding')],
          nextCursor: null,
        });
      }
      return pathname.includes(BIRTHDAY_ID)
        ? json({ data: [wish(BIRTHDAY_ID, 'Headphones')], nextCursor: null })
        : json({}, { status: 429, headers: { 'Retry-After': '30' } });
    });

    const result = await call('search_wishes', { query: 'headphones' });
    const body = JSON.parse(result.text);

    expect(result.isError).toBe(false);
    expect(body.matches.map((match: { wish: Wish }) => match.wish.title)).toEqual(['Headphones']);
    expect(body.truncated).toBe(true);
    expect(body.stoppedEarly).toContain('30 seconds');
  });

  it('adds a wish with only the given fields', async () => {
    await connect(async (request) => json(await request.json(), { status: 201 }));

    await call('add_wish', { wishlistId: BIRTHDAY_ID, title: 'Book', priority: 'high' });

    expect(requests[0]?.method).toBe('POST');
    expect(new URL(requests[0]!.url).pathname).toBe(`/api/v1/wishlists/${BIRTHDAY_ID}/wishes`);
    expect(await requests[0]?.json()).toEqual({ title: 'Book', priority: 'high' });
  });

  it('rejects an update without fields before calling Onio', async () => {
    await connect(() => json({}));

    const result = await call('update_wish', { wishlistId: BIRTHDAY_ID, wishId: BIRTHDAY_ID });

    expect(result).toEqual({ isError: true, text: 'Send at least one field to change.' });
    expect(requests).toHaveLength(0);
  });

  it('names the missing scope when the token lacks it', async () => {
    await connect(() =>
      json({ statusCode: 403, message: 'Access token lacks the required scope' }, { status: 403 }),
    );

    const result = await call('update_wish', {
      wishlistId: BIRTHDAY_ID,
      wishId: BIRTHDAY_ID,
      title: 'Book',
    });

    expect(result).toEqual({
      isError: true,
      text: 'The token does not have the "wishes:write" permission. Create a token with this permission in your Onio profile.',
    });
  });

  it('reports a network failure as a tool error', async () => {
    await connect(() => {
      throw new TypeError(`fetch failed for ${TOKEN}`);
    });

    const result = await call('list_wishlists');

    expect(result.isError).toBe(true);
    expect(result.text).not.toContain(TOKEN);
  });
});
