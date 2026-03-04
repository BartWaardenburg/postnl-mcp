import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PostNLClient } from "./postnl-client.js";
import { registerShippingTools } from "./tools/shipping.js";
import { registerTrackingTools } from "./tools/tracking.js";
import { registerDeliveryTools } from "./tools/delivery.js";
import { registerLocationTools } from "./tools/locations.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

export type Toolset = "shipping" | "tracking" | "delivery" | "locations";

const ALL_TOOLSETS: Toolset[] = ["shipping", "tracking", "delivery", "locations"];

export const parseToolsets = (env?: string): Set<Toolset> => {
  if (!env) return new Set(ALL_TOOLSETS);

  const requested = env.split(",").map((s) => s.trim().toLowerCase());
  const valid = new Set<Toolset>();

  for (const name of requested) {
    if (ALL_TOOLSETS.includes(name as Toolset)) {
      valid.add(name as Toolset);
    }
  }

  return valid.size > 0 ? valid : new Set(ALL_TOOLSETS);
};

type ToolRegisterer = (server: McpServer, client: PostNLClient, customerCode: string, customerNumber: string) => void;

const toolsetRegistry: Record<Toolset, ToolRegisterer[]> = {
  shipping: [registerShippingTools],
  tracking: [registerTrackingTools],
  delivery: [registerDeliveryTools],
  locations: [registerLocationTools],
};

export const createServer = (
  client: PostNLClient,
  customerCode: string,
  customerNumber: string,
  toolsets?: Set<Toolset>,
): McpServer => {
  const server = new McpServer({
    name: "postnl-mcp",
    version,
  });

  const enabled = toolsets ?? new Set(ALL_TOOLSETS);
  const registered = new Set<ToolRegisterer>();

  for (const toolset of enabled) {
    const registerers = toolsetRegistry[toolset];

    for (const register of registerers) {
      if (!registered.has(register)) {
        registered.add(register);
        register(server, client, customerCode, customerNumber);
      }
    }
  }

  return server;
};
