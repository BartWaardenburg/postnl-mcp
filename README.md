# postnl-mcp

[![npm version](https://img.shields.io/npm/v/postnl-mcp.svg)](https://www.npmjs.com/package/postnl-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-compatible-purple.svg)](https://modelcontextprotocol.io)
[![CI](https://github.com/bartwaardenburg/postnl-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/bartwaardenburg/postnl-mcp/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/BartWaardenburg/9cfb0ee7e59fa9ea1b0e31d16d0deb5a/raw/postnl-mcp-coverage.json)](https://bartwaardenburg.github.io/postnl-mcp/)

A community-built [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server for the [PostNL API](https://developer.postnl.nl/). Create shipments, generate barcodes, track parcels, calculate delivery dates, and find pickup locations — all through natural language via any MCP-compatible AI client.

> **Note:** This is an unofficial, community-maintained project and is not affiliated with or endorsed by PostNL.

## Quick Start (Non-Developers)

You do not need to clone this repo.

1. Make sure Node.js 20+ is installed (your AI app will run `npx` on your machine)
2. Get PostNL credentials (see [API Key Setup](#api-key-setup))
3. Add this as an MCP server in your AI app (copy/paste config below)
4. Ask plain-language shipping/tracking questions (see [Example Usage](#example-usage))

### Add To Claude Desktop (Also Works In Cowork)

Cowork runs inside Claude Desktop and uses the same connected MCP servers and permissions.

1. Open your Claude Desktop MCP config file:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\\Claude\\claude_desktop_config.json`
2. Add this server entry (or merge into existing `mcpServers`):

```json
{
  "mcpServers": {
    "postnl-mcp": {
      "command": "npx",
      "args": ["-y", "postnl-mcp"],
      "env": {
        "POSTNL_API_KEY": "your-api-key",
        "POSTNL_CUSTOMER_CODE": "your-customer-code",
        "POSTNL_CUSTOMER_NUMBER": "your-customer-number"
      }
    }
  }
}
```

3. Restart Claude Desktop

### Add To Other AI Apps

Most MCP apps have an "Add MCP Server" screen where you can fill in:

- Command: `npx`
- Args: `-y postnl-mcp`
- Env: `POSTNL_API_KEY=...`, `POSTNL_CUSTOMER_CODE=...`, `POSTNL_CUSTOMER_NUMBER=...`

If your app wants JSON, paste this and adapt the top-level key name to your client (common keys are `mcpServers`, `servers`, or `context_servers`):

```json
{
  "postnl-mcp": {
    "command": "npx",
    "args": ["-y", "postnl-mcp"],
    "env": {
      "POSTNL_API_KEY": "your-api-key",
      "POSTNL_CUSTOMER_CODE": "your-customer-code",
      "POSTNL_CUSTOMER_NUMBER": "your-customer-number"
    }
  }
}
```

### Troubleshooting

- Error: `Missing required env vars` or startup validation errors.
  - Fix: add `POSTNL_API_KEY`, `POSTNL_CUSTOMER_CODE`, and `POSTNL_CUSTOMER_NUMBER` to server `env` and restart your app.
- Error: `npx: command not found` or server fails to start.
  - Fix: install Node.js 20+ and restart your app.
- Connected but API calls fail with `401/403` or empty business data.
  - Fix: verify PostNL API subscriptions for the tools you use (see [Required API Subscriptions](#required-api-subscriptions)).

## Features

- **7 tools** across 4 categories covering the PostNL Shipping APIs
- **Barcode generation** for domestic (3S), mailbox (2S), EU (CC/CP/CD/CF), and international (LA/RI/UE) shipments
- **Shipment creation** with shipping label generation (PDF or ZPL format)
- **Parcel tracking** with full status history and event timeline
- **Delivery date calculation** with origin country and postal code support
- **Delivery timeframes** with evening delivery and Sunday sorting options
- **Location finder** — search PostNL pickup/drop-off points by postal code, city, or coordinates
- **Input validation** via Zod schemas on every tool for safe, predictable operations
- **Response caching** with configurable TTL and automatic invalidation on writes
- **Rate limit handling** with exponential backoff and `Retry-After` header support
- **Toolset filtering** to expose only the tool categories you need
- **Docker support** for containerized deployment via GHCR
- **Actionable error messages** with context-aware recovery suggestions

## Supported Clients

<details>
<summary><strong>Advanced setup and supported clients (expand)</strong></summary>

This MCP server is not tied to one coding agent. It works with any MCP-compatible client/runtime that can start a stdio MCP server.

| Client / runtime | Easiest setup |
|---|---|
| Claude Desktop + Cowork | JSON config (`claude_desktop_config.json`) |
| Claude Code | One-liner: `claude mcp add` |
| Codex CLI / IDE | One-liner: `codex mcp add` |
| Gemini CLI | One-liner: `gemini mcp add` |
| VS Code (Copilot) | Command Palette: `MCP: Add Server` |
| Cursor | JSON config file |
| Windsurf | JSON config file |
| Cline | UI settings |
| Zed | JSON settings file |
| Any other MCP host | Use command/args/env from [Generic MCP Server Config](#generic-mcp-server-config) |

### Claude Ecosystem Notes

Claude has several concepts that are easy to mix up:

- **Local MCP servers (Claude Desktop):** configured in `claude_desktop_config.json` and started on your machine ([docs](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop)).
- **Cowork:** reuses MCP servers connected in Claude Desktop ([docs](https://support.claude.com/en/articles/13345190-get-started-with-cowork)).
- **Connectors:** remote integrations managed in Claude ([docs](https://support.claude.com/en/articles/11176164-use-connectors-to-extend-claude-s-capabilities)).
- **Cowork plugins:** Claude-specific workflow packaging ([docs](https://support.claude.com/en/articles/13837440-use-plugins-in-cowork)). Useful in Claude, not portable as generic MCP server config in other hosts.

### Setup (Power Users)

If Quick Start works in your client, you can skip this section.

### Generic MCP Server Config

Use this canonical config for any stdio-capable MCP host:

- **Command:** `npx`
- **Args:** `["-y", "postnl-mcp"]`
- **Required env vars:** `POSTNL_API_KEY`, `POSTNL_CUSTOMER_CODE`, `POSTNL_CUSTOMER_NUMBER` (see [Required](#required))

Minimal JSON shape (adapt key names to your client, e.g. `mcpServers`, `servers`, or `context_servers`):

```json
{
  "postnl-mcp": {
    "command": "npx",
    "args": ["-y", "postnl-mcp"],
    "env": {
      "POSTNL_API_KEY": "your-api-key",
      "POSTNL_CUSTOMER_CODE": "your-customer-code",
      "POSTNL_CUSTOMER_NUMBER": "your-customer-number"
    }
  }
}
```

### Client-Specific Setup

Use [Generic MCP Server Config](#generic-mcp-server-config) as the canonical config and apply only host-specific details below.

Verified against vendor docs on **2026-03-05**.

| Client | Docs | Host-specific notes |
|---|---|---|
| Claude Code | [Connect Claude Code to tools via MCP](https://code.claude.com/docs/en/mcp) | Supports `claude mcp add` for stdio/http servers |
| Codex CLI / IDE | [Codex MCP](https://developers.openai.com/codex/mcp) | CLI + IDE share `~/.codex/config.toml` |
| Gemini CLI | [Gemini CLI MCP servers](https://google-gemini.github.io/gemini-cli/docs/tools/mcp-server.html) | Configure via `gemini mcp add` or `~/.gemini/settings.json` |
| VS Code (Copilot) | [Add and manage MCP servers in VS Code](https://code.visualstudio.com/docs/copilot/customization/mcp-servers) | Use `MCP: Add Server` or `.vscode/mcp.json` |
| Claude Desktop | [Connectors overview](https://claude.com/docs/connectors/overview) | Local config uses `claude_desktop_config.json` |
| Cursor | [Cursor MCP](https://docs.cursor.com/en/context/mcp) | Uses `mcp.json` schema |
| Windsurf | [Cascade MCP Integration](https://docs.windsurf.com/windsurf/cascade/mcp) | Uses `mcp_config.json` |
| Cline | [Adding & Configuring Servers](https://docs.cline.bot/mcp/adding-and-configuring-servers) | Configure MCP servers in Cline settings |
| Zed | [Zed MCP](https://zed.dev/docs/ai/mcp) | Uses `context_servers` in `settings.json` |

CLI quick-add examples:

```bash
# Claude Code
claude mcp add --scope user postnl-mcp \
  --env POSTNL_API_KEY=your-api-key \
  --env POSTNL_CUSTOMER_CODE=your-customer-code \
  --env POSTNL_CUSTOMER_NUMBER=your-customer-number \
  -- npx -y postnl-mcp

# Codex
codex mcp add postnl-mcp \
  --env POSTNL_API_KEY=your-api-key \
  --env POSTNL_CUSTOMER_CODE=your-customer-code \
  --env POSTNL_CUSTOMER_NUMBER=your-customer-number \
  -- npx -y postnl-mcp

# Gemini CLI
gemini mcp add -s user postnl-mcp \
  -e POSTNL_API_KEY=your-api-key \
  -e POSTNL_CUSTOMER_CODE=your-customer-code \
  -e POSTNL_CUSTOMER_NUMBER=your-customer-number \
  npx -y postnl-mcp
```

### Security Notes

- Only connect MCP servers you trust. Servers can execute operations on your behalf.
- Scope credentials per server and environment (`dev`, `staging`, `prod`) instead of one broad key.
- Prefer least-privilege credentials and only required PostNL API subscriptions.
- Keep client-side approval prompts enabled for write/destructive tools.
- For team setups, keep shared MCP config in version control and review changes.

</details>

## Configuration

### Required

| Variable | Description |
|---|---|
| `POSTNL_API_KEY` | Your PostNL API key |
| `POSTNL_CUSTOMER_CODE` | Your PostNL customer code (used in barcode generation and shipments) |
| `POSTNL_CUSTOMER_NUMBER` | Your PostNL customer number (used in shipment requests) |

Get your API credentials from the [PostNL Developer Portal](https://developer.postnl.nl/). Your customer code and customer number can be found in your PostNL business account.

### Optional

| Variable | Description | Default |
|---|---|---|
| `POSTNL_CACHE_TTL` | Response cache lifetime in seconds. Set to `0` to disable caching. | `120` |
| `POSTNL_MAX_RETRIES` | Maximum retry attempts for rate-limited (429) requests with exponential backoff. | `3` |
| `POSTNL_TOOLSETS` | Comma-separated list of tool categories to enable (see [Toolset Filtering](#toolset-filtering)). | All toolsets |

## API Key Setup

### Creating Your API Key

1. Register for a [PostNL Developer Portal](https://developer.postnl.nl/) account
2. Subscribe to the APIs you need (Shipment, Barcode, Delivery Date, etc.)
3. Generate an API key for your application
4. Find your **Customer Code** and **Customer Number** in your PostNL business contract or portal

### Required API Subscriptions

Depending on which tools you use, subscribe to:

| API Subscription | Tools |
|---|---|
| **Barcode API** | `generate_barcode` |
| **Labelling API** (Shipment v2) | `create_shipment` |
| **Status API** (Shipment v2) | `get_shipment_status` |
| **Delivery Date API** | `get_delivery_date` |
| **Timeframe API** | `get_delivery_options` |
| **Locations API** | `find_locations`, `get_location` |

## Available Tools

### Shipping

| Tool | Description |
|---|---|
| `generate_barcode` | Generate a PostNL barcode for shipping (types: 2S mailbox, 3S domestic, CC/CP/CD/CF EU, LA/RI/UE international) |
| `create_shipment` | Create a shipment with label generation — provide sender/receiver address, get a PDF or ZPL shipping label back |

### Tracking

| Tool | Description |
|---|---|
| `get_shipment_status` | Track a parcel by barcode — returns current status, timestamps, and full event history |

### Delivery

| Tool | Description |
|---|---|
| `get_delivery_date` | Calculate the expected delivery date for a shipment based on postal code, shipping date, and product code |
| `get_delivery_options` | Get available delivery timeframes for an address (morning, afternoon, evening windows) |

### Locations

| Tool | Description |
|---|---|
| `find_locations` | Find nearby PostNL pickup/drop-off points by postal code, city, or GPS coordinates |
| `get_location` | Get details of a specific PostNL location by location code |

## Toolset Filtering

Reduce context window usage by enabling only the tool categories you need. Set the `POSTNL_TOOLSETS` environment variable to a comma-separated list:

```bash
POSTNL_TOOLSETS=shipping,tracking
```

| Toolset | Tools included |
|---|---|
| `shipping` | Barcode generation and shipment creation |
| `tracking` | Parcel tracking by barcode |
| `delivery` | Delivery date calculation and timeframe options |
| `locations` | PostNL location finder and details |

When not set, all toolsets are enabled. Invalid names are ignored; if all names are invalid, all toolsets are enabled as a fallback.

## Barcode Types

PostNL uses different barcode types depending on the shipment:

| Type | Description | Serie format |
|---|---|---|
| `2S` | Mailbox parcel | `000000000-999999999` |
| `3S` | Standard domestic parcel | `000000000-999999999` |
| `CC` | EU consumer parcel | `000000000-999999999` |
| `CP` | EU compact parcel | `000000000-999999999` |
| `CD` | EU standard parcel | `000000000-999999999` |
| `CF` | EU bulk parcel | `000000000-999999999` |
| `LA` | International Letter Registered | `000000000-999999999` |
| `RI` | International Registered Shipment | `000000000-999999999` |
| `UE` | International EMS | `000000000-999999999` |

## Common Product Codes

| Code | Description |
|---|---|
| `3085` | Standard shipment |
| `3385` | Deliver to stated address only |
| `3090` | Delivery to neighbour + return when not home |
| `3087` | Extra cover |
| `3089` | Signature on delivery + deliver to stated address only |
| `3189` | Signature on delivery |
| `3533` | Pickup + signature on delivery |
| `3534` | Pickup + extra cover |
| `3543` | Pickup + signature on delivery + notification |
| `3438` | Age check (18+) |
| `2928` | Mailbox parcel (brievenbuspakje) |

Evening delivery is not a separate product code — use any compatible product code (e.g. `3085`) with product option `{Characteristic: "118", Option: "006"}` and a `DeliveryDate`.

## Example Usage

Once connected, you can interact with the PostNL API using natural language:

- "Generate a barcode for a domestic parcel"
- "Create a shipment from my warehouse at Hoofdstraat 1, Amsterdam to Kerkstraat 42, Rotterdam"
- "Track parcel 3STBJG123456789"
- "What's the expected delivery date for postal code 1234AB if I ship today?"
- "Show me delivery timeframes for 2511 BT Den Haag"
- "Find PostNL pickup points near postal code 3011 AA"
- "Get details of PostNL location 176227"

## Development

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm dev

# Build for production
pnpm build

# Run tests
pnpm test

# Type check
pnpm typecheck
```

### Project Structure

```
src/
  index.ts              # Entry point (stdio transport)
  server.ts             # MCP server setup and toolset filtering
  postnl-client.ts      # PostNL API HTTP client with caching and retry
  cache.ts              # TTL-based in-memory response cache
  types.ts              # TypeScript interfaces for PostNL API
  tool-result.ts        # Error formatting with recovery suggestions
  update-checker.ts     # NPM update notifications
  tools/
    shipping.ts         # Barcode generation and shipment creation
    tracking.ts         # Parcel tracking by barcode
    delivery.ts         # Delivery date and timeframe calculation
    locations.ts        # PostNL location finder
```

## Requirements

- Node.js >= 20
- A [PostNL](https://postnl.nl) business account with API credentials

## License

MIT - see [LICENSE](LICENSE) for details.
