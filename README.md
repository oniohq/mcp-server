# Onio MCP server

An [MCP](https://modelcontextprotocol.io) server for [Onio](https://onio.app). It lets AI assistants such as Claude read and change your wishlists. It runs on your computer and uses the [Onio public API](https://developers.onio.app) with your own personal access token.

Setup, privacy and safety notes: [Use Onio with AI assistants](https://developers.onio.app/guides/ai-assistants).

## Quick start

Create a token in **API Access** in your Onio profile. Then, in Claude Code:

```bash
claude mcp add onio --env ONIO_TOKEN=onio_pat_your_token -- npx -y @oniohq/mcp-server
```

You need Node.js 22 or later.

## Tools

| Tool              | Does                                                      | Scope             |
| ----------------- | --------------------------------------------------------- | ----------------- |
| `list_wishlists`  | Lists your wishlists, including private and archived ones | `wishlists:read`  |
| `get_wishlist`    | Gets one wishlist with all its wishes                     | `wishlists:read`  |
| `search_wishes`   | Finds wishes by title, description or link                | `wishlists:read`  |
| `create_wishlist` | Creates a wishlist. It starts as Private                  | `wishlists:write` |
| `update_wishlist` | Changes the title, occasion or notes of a wishlist        | `wishlists:write` |
| `add_wish`        | Adds a wish to a wishlist. It is visible, not Private     | `wishes:write`    |
| `update_wish`     | Changes a wish                                            | `wishes:write`    |

## Configuration

| Variable       | Required | Description                                                                                   |
| -------------- | -------- | --------------------------------------------------------------------------------------------- |
| `ONIO_TOKEN`   | Yes      | Your personal access token. It starts with `onio_pat_`.                                       |
| `ONIO_API_URL` | No       | The Onio address. Defaults to `https://web.onio.app`. Must use https, except for `localhost`. |

## Development

This repository uses [Bun](https://bun.sh).

```bash
bun install
bun run test
bun run lint
bun run typecheck
bun run build
```

To try a local build, register `node dist/index.js` instead of `npx -y @oniohq/mcp-server`. Set `ONIO_API_URL=http://localhost:3000` to use a local Onio API.

`openapi.json` is a copy of the public spec, and `src/generated/openapi.ts` is generated from it. Do not edit either by hand. CI fails when the live spec changes. Then run `bun run spec:sync`, check the tools, and commit the result.

To release, run `npm version <patch|minor|major>` and `git push --follow-tags`. The Release workflow then runs the checks and stages the tagged version on npm through trusted publishing. Approve it on npmjs.com or with `npm stage approve <id>` to publish it. `npm stage list @oniohq/mcp-server` shows the staged versions.

## License

[MIT](LICENSE)
