import { describe, it, expect } from "vitest";
import { createServer, parseToolsets } from "./server.js";
import type { PostNLClient } from "./postnl-client.js";

const mockClient = {} as PostNLClient;

type RegisteredTool = { annotations?: Record<string, unknown> };
type ServerWithTools = { _registeredTools: Record<string, RegisteredTool> };

const getTools = (toolsets?: Set<string>): Record<string, RegisteredTool> =>
  (createServer(mockClient, "DEVC", "01234567", toolsets as never) as unknown as ServerWithTools)._registeredTools;

describe("createServer", () => {
  it("creates a server", () => {
    const server = createServer(mockClient, "DEVC", "01234567");
    expect(server).toBeDefined();
  });

  it("registers all 7 tools", () => {
    const tools = getTools();
    expect(Object.keys(tools)).toHaveLength(7);
  });

  it("registers all expected tool names", () => {
    const tools = getTools();

    const expectedTools = [
      // Shipping
      "generate_barcode",
      "create_shipment",
      // Tracking
      "get_shipment_status",
      // Delivery
      "get_delivery_date",
      "get_delivery_options",
      // Locations
      "find_locations",
      "get_location",
    ];

    for (const name of expectedTools) {
      expect(name in tools, `Tool "${name}" should be registered`).toBe(true);
    }
  });

  it("all tools have annotations", () => {
    const tools = getTools();

    for (const [name, tool] of Object.entries(tools)) {
      expect(tool.annotations, `Tool "${name}" should have annotations`).toBeDefined();
    }
  });
});

describe("parseToolsets", () => {
  it("returns all toolsets when env is undefined", () => {
    const result = parseToolsets(undefined);
    expect(result.size).toBe(4);
  });

  it("returns all toolsets when env is empty", () => {
    const result = parseToolsets("");
    expect(result.size).toBe(4);
  });

  it("parses a single toolset", () => {
    const result = parseToolsets("shipping");
    expect(result).toEqual(new Set(["shipping"]));
  });

  it("parses multiple toolsets", () => {
    const result = parseToolsets("shipping,tracking,locations");
    expect(result).toEqual(new Set(["shipping", "tracking", "locations"]));
  });

  it("ignores invalid toolset names", () => {
    const result = parseToolsets("shipping,invalid,tracking");
    expect(result).toEqual(new Set(["shipping", "tracking"]));
  });

  it("returns all toolsets if all names are invalid", () => {
    const result = parseToolsets("invalid,unknown");
    expect(result.size).toBe(4);
  });

  it("handles whitespace in toolset names", () => {
    const result = parseToolsets(" shipping , tracking ");
    expect(result).toEqual(new Set(["shipping", "tracking"]));
  });
});

describe("toolset filtering", () => {
  it("registers only shipping tools when shipping toolset is selected", () => {
    const tools = getTools(new Set(["shipping"]) as never);
    expect("generate_barcode" in tools).toBe(true);
    expect("create_shipment" in tools).toBe(true);
    expect("get_shipment_status" in tools).toBe(false);
    expect("find_locations" in tools).toBe(false);
  });

  it("registers only tracking tools when tracking toolset is selected", () => {
    const tools = getTools(new Set(["tracking"]) as never);
    expect("get_shipment_status" in tools).toBe(true);
    expect("generate_barcode" in tools).toBe(false);
    expect("find_locations" in tools).toBe(false);
  });

  it("registers only delivery tools when delivery toolset is selected", () => {
    const tools = getTools(new Set(["delivery"]) as never);
    expect("get_delivery_date" in tools).toBe(true);
    expect("get_delivery_options" in tools).toBe(true);
    expect("generate_barcode" in tools).toBe(false);
    expect("find_locations" in tools).toBe(false);
  });

  it("registers only location tools when locations toolset is selected", () => {
    const tools = getTools(new Set(["locations"]) as never);
    expect("find_locations" in tools).toBe(true);
    expect("get_location" in tools).toBe(true);
    expect("generate_barcode" in tools).toBe(false);
    expect("get_shipment_status" in tools).toBe(false);
  });

  it("does not register duplicate tools when multiple toolsets are selected", () => {
    const tools = getTools(new Set(["shipping", "tracking", "delivery", "locations"]) as never);
    const toolNames = Object.keys(tools);
    const unique = new Set(toolNames);
    expect(toolNames.length).toBe(unique.size);
  });
});
