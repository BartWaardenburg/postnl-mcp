import { describe, it, expect, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { createServer, parseToolsets, type Toolset } from "./server.js";
import type { PostNLClient } from "./postnl-client.js";

const mockClient = {} as PostNLClient;

const connect = async (
  toolsets?: Set<Toolset>,
): Promise<{ client: Client; close: () => Promise<void> }> => {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const server = createServer(mockClient, "DEVC", "01234567", toolsets);
  await server.connect(serverSide);
  const client = new Client({ name: "protocol-test", version: "0.0.0" });
  await client.connect(clientSide);
  return { client, close: async () => { await client.close(); await server.close(); } };
};

describe("MCP protocol surface", () => {
  let close: (() => Promise<void>) | undefined;
  afterEach(async () => { await close?.(); });

  it("gives instructions to the client", async () => {
    const conn = await connect();
    close = conn.close;
    const text = conn.client.getInstructions() ?? "";
    expect(text).toMatch(/create_shipment/);
    expect(text).toMatch(/get_shipment_status/);
  });

  it("lists tools in the same order for any toolset order", async () => {
    const a = await connect(parseToolsets("shipping,tracking,delivery,locations"));
    const first = (await a.client.listTools()).tools.map((t) => t.name);
    await a.close();
    const b = await connect(parseToolsets("locations,delivery,tracking,shipping"));
    close = b.close;
    const second = (await b.client.listTools()).tools.map((t) => t.name);
    expect(second).toEqual(first);
  });

  it("lists every tool with a title and annotations", async () => {
    const conn = await connect();
    close = conn.close;
    const { tools } = await conn.client.listTools();
    expect(tools.length).toBeGreaterThan(0);
    for (const tool of tools) {
      expect(tool.title, tool.name).toBeTruthy();
      expect(tool.annotations, tool.name).toBeDefined();
    }
  });
});
