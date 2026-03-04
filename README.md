# postnl-mcp

[![npm version](https://img.shields.io/npm/v/postnl-mcp.svg)](https://www.npmjs.com/package/postnl-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-compatible-purple.svg)](https://modelcontextprotocol.io)
[![CI](https://github.com/bartwaardenburg/postnl-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/bartwaardenburg/postnl-mcp/actions/workflows/ci.yml)

A community-built [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server for the [PostNL API](https://developer.postnl.nl/). Create shipments, generate barcodes, track parcels, calculate delivery dates, and find pickup locations — all through natural language via any MCP-compatible AI client.

> **Note:** This is an unofficial, community-maintained project and is not affiliated with or endorsed by PostNL.

## Features

- **7 tools** across 4 categories covering the PostNL Shipping APIs
- **Barcode generation** for domestic (3S), evening delivery (3SDEPA), and international (LA/RI/UE) shipments
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

This MCP server works with any client that supports the Model Context Protocol, including:

| Client | Easiest install |
|---|---|
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | One-liner: `claude mcp add` |
| [Codex CLI](https://github.com/openai/codex) (OpenAI) | One-liner: `codex mcp add` |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli) (Google) | One-liner: `gemini mcp add` |
| [VS Code](https://code.visualstudio.com/) (Copilot) | Command Palette: `MCP: Add Server` |
| [Claude Desktop](https://claude.ai/download) | JSON config file |
| [Cursor](https://cursor.com) | JSON config file |
| [Windsurf](https://codeium.com/windsurf) | JSON config file |
| [Cline](https://github.com/cline/cline) | UI settings |
| [Zed](https://zed.dev) | JSON settings file |

## Installation

### Claude Code

```bash
claude mcp add --scope user postnl-mcp \
  --env POSTNL_API_KEY=your-api-key \
  --env POSTNL_CUSTOMER_CODE=your-customer-code \
  --env POSTNL_CUSTOMER_NUMBER=your-customer-number \
  -- npx -y postnl-mcp
```

### Codex CLI (OpenAI)

```bash
codex mcp add postnl-mcp \
  --env POSTNL_API_KEY=your-api-key \
  --env POSTNL_CUSTOMER_CODE=your-customer-code \
  --env POSTNL_CUSTOMER_NUMBER=your-customer-number \
  -- npx -y postnl-mcp
```

### Gemini CLI (Google)

```bash
gemini mcp add postnl-mcp -- npx -y postnl-mcp
```

Set environment variables `POSTNL_API_KEY`, `POSTNL_CUSTOMER_CODE`, and `POSTNL_CUSTOMER_NUMBER` separately via `~/.gemini/settings.json`.

### VS Code (Copilot)

Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) > `MCP: Add Server` > select **Command (stdio)**.

Or add to `.vscode/mcp.json` in your project directory:

```json
{
  "servers": {
    "postnl-mcp": {
      "type": "stdio",
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

### Claude Desktop / Cursor / Windsurf / Cline

These clients share the same JSON format. Add the config below to the appropriate file:

| Client | Config file |
|---|---|
| Claude Desktop (macOS) | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Desktop (Windows) | `%APPDATA%\Claude\claude_desktop_config.json` |
| Cursor (project) | `.cursor/mcp.json` |
| Cursor (global) | `~/.cursor/mcp.json` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |
| Cline | Settings > MCP Servers > Edit |

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

### Zed

Add to your Zed settings (`~/.zed/settings.json` on macOS, `~/.config/zed/settings.json` on Linux):

```json
{
  "context_servers": {
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

### Docker

```bash
docker run -i --rm \
  -e POSTNL_API_KEY=your-api-key \
  -e POSTNL_CUSTOMER_CODE=your-customer-code \
  -e POSTNL_CUSTOMER_NUMBER=your-customer-number \
  ghcr.io/bartwaardenburg/postnl-mcp
```

### Codex CLI (TOML config alternative)

If you prefer editing `~/.codex/config.toml` directly:

```toml
[mcp_servers.postnl-mcp]
command = "npx"
args = ["-y", "postnl-mcp"]
env = { "POSTNL_API_KEY" = "your-api-key", "POSTNL_CUSTOMER_CODE" = "your-customer-code", "POSTNL_CUSTOMER_NUMBER" = "your-customer-number" }
```

### Other MCP Clients

For any MCP-compatible client, use this server configuration:

- **Command:** `npx`
- **Args:** `["-y", "postnl-mcp"]`
- **Environment variables:** `POSTNL_API_KEY`, `POSTNL_CUSTOMER_CODE`, and `POSTNL_CUSTOMER_NUMBER`

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
| `generate_barcode` | Generate a PostNL barcode for shipping (types: 3S domestic, 3SDEPA evening, LA/RI/UE international) |
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
| `3S` | Standard domestic parcel | `000000000-999999999` |
| `3SDEPA` | Evening delivery parcel | `000000000-999999999` |
| `LA` | International Letter Registered | `000000000-999999999` |
| `RI` | International Registered Shipment | `000000000-999999999` |
| `UE` | International EMS | `000000000-999999999` |

## Common Product Codes

| Code | Description |
|---|---|
| `3085` | Standard domestic shipment |
| `3385` | Evening delivery |
| `3090` | Pickup at PostNL point |
| `3089` | Delivery with age check (18+) |
| `3087` | Extra@Home (large items) |

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
