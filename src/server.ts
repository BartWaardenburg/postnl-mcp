import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/server";
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

const INSTRUCTIONS = [
  "Create PostNL shipments, track parcels, get delivery dates and find pickup locations with the PostNL API.",
  "Call generate_barcode, then create_shipment to get a label. The server needs POSTNL_API_KEY, POSTNL_CUSTOMER_CODE and POSTNL_CUSTOMER_NUMBER.",
  "create_shipment costs money. Ask the user first. Set confirm to false to save a concept only.",
  "Call get_shipment_status with a barcode to track a parcel.",
  "Call get_delivery_date or get_delivery_options for delivery data, and find_locations or get_location for pickup points.",
  "The PostNL API limits the request rate. The server retries rate-limited calls.",
].join("\n");

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
  const server = new McpServer(
    {
      name: "postnl-mcp",
      title: "PostNL",
      version,
      websiteUrl: "https://developer.postnl.nl/",
    },
    { instructions: INSTRUCTIONS },
  );

  const enabled = toolsets ?? new Set(ALL_TOOLSETS);
  const registered = new Set<ToolRegisterer>();

  // Iterate the fixed list, not the user input, so tools/list has one stable order.
  for (const toolset of ALL_TOOLSETS.filter((t) => enabled.has(t))) {
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
