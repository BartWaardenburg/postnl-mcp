#!/usr/bin/env node

import { createRequire } from "node:module";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { PostNLClient } from "./postnl-client.js";
import { createServer, parseToolsets } from "./server.js";
import { checkForUpdate } from "./update-checker.js";

const require = createRequire(import.meta.url);
const { name, version } = require("../package.json") as { name: string; version: string };

const apiKey = process.env.POSTNL_API_KEY;
const customerCode = process.env.POSTNL_CUSTOMER_CODE;
const customerNumber = process.env.POSTNL_CUSTOMER_NUMBER;

if (!apiKey) {
  console.error("Missing required env var: POSTNL_API_KEY");
  process.exit(1);
}

if (!customerCode || !customerNumber) {
  console.error("Missing required env vars: POSTNL_CUSTOMER_CODE and POSTNL_CUSTOMER_NUMBER");
  process.exit(1);
}

const cacheTtl = process.env.POSTNL_CACHE_TTL !== undefined
  ? parseInt(process.env.POSTNL_CACHE_TTL, 10) * 1000
  : undefined;
const maxRetries = process.env.POSTNL_MAX_RETRIES !== undefined
  ? parseInt(process.env.POSTNL_MAX_RETRIES, 10)
  : 3;
const client = new PostNLClient(apiKey, undefined, cacheTtl, { maxRetries });
const toolsets = parseToolsets(process.env.POSTNL_TOOLSETS);
const server = createServer(client, customerCode, customerNumber, toolsets);

const main = async (): Promise<void> => {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Fire-and-forget — don't block server startup
  void checkForUpdate(name, version);
};

main().catch((error) => {
  console.error("PostNL MCP server failed:", error);
  process.exit(1);
});
