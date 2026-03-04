import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { PostNLClient } from "../postnl-client.js";
import { toTextResult, toErrorResult } from "../tool-result.js";

export const registerTrackingTools = (
  server: McpServer,
  client: PostNLClient,
  _customerCode: string,
  _customerNumber: string,
): void => {
  server.registerTool(
    "get_shipment_status",
    {
      title: "Get Shipment Status",
      description:
        "Track a PostNL shipment by barcode. Returns the current status, expected delivery date, " +
        "and status history of the shipment.",
      annotations: { readOnlyHint: true, openWorldHint: true },

      inputSchema: z.object({
        barcode: z.string().min(1).describe("The PostNL barcode/tracking number of the shipment"),
      }),
    },
    async ({ barcode }) => {
      try {
        const result = await client.getShipmentStatus(barcode);
        const shipment = result.CurrentStatus?.Shipment;

        if (!shipment) {
          return toTextResult(`No status information found for barcode: ${barcode}`);
        }

        const lines: string[] = [
          `Barcode: ${shipment.Barcode ?? barcode}`,
        ];

        if (shipment.Status) {
          lines.push(`Status: ${shipment.Status.StatusDescription ?? shipment.Status.StatusCode ?? "Unknown"}`);
          if (shipment.Status.PhaseDescription) {
            lines.push(`Phase: ${shipment.Status.PhaseDescription}`);
          }
          if (shipment.Status.TimeStamp) {
            lines.push(`Updated: ${shipment.Status.TimeStamp}`);
          }
        }

        if (shipment.ProductDescription) {
          lines.push(`Product: ${shipment.ProductDescription}`);
        }

        if (shipment.ExpectedDeliveryDate) {
          lines.push(`Expected delivery: ${shipment.ExpectedDeliveryDate}`);
        }

        if (shipment.ExpectedDeliveryTimeStampStart && shipment.ExpectedDeliveryTimeStampEnd) {
          lines.push(`Delivery window: ${shipment.ExpectedDeliveryTimeStampStart} - ${shipment.ExpectedDeliveryTimeStampEnd}`);
        }

        if (shipment.DeliveryDate) {
          lines.push(`Delivered: ${shipment.DeliveryDate}`);
        }

        if (shipment.Reference) {
          lines.push(`Reference: ${shipment.Reference}`);
        }

        if (shipment.OldStatuses && shipment.OldStatuses.length > 0) {
          lines.push("");
          lines.push("Status history:");
          for (const status of shipment.OldStatuses) {
            lines.push(`  - ${status.TimeStamp ?? ""}: ${status.StatusDescription ?? status.StatusCode ?? "Unknown"}`);
          }
        }

        const warnings = result.Warnings ?? [];
        if (warnings.length > 0) {
          lines.push("");
          lines.push("Warnings:");
          for (const warn of warnings) {
            lines.push(`  - [${warn.Code}] ${warn.Description}`);
          }
        }

        return toTextResult(
          lines.join("\n"),
          result as unknown as Record<string, unknown>,
        );
      } catch (error) {
        return toErrorResult(error);
      }
    },
  );
};
