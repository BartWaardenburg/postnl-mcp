import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { PostNLClient } from "../postnl-client.js";
import { toTextResult, toErrorResult } from "../tool-result.js";

export const registerDeliveryTools = (
  server: McpServer,
  client: PostNLClient,
  _customerCode: string,
  _customerNumber: string,
): void => {
  server.registerTool(
    "get_delivery_date",
    {
      title: "Get Delivery Date",
      description:
        "Calculate the expected delivery date for a shipment based on the shipping date, postal code, " +
        "and delivery options. Useful for showing customers when they can expect their parcel.",
      annotations: { readOnlyHint: true, openWorldHint: true },

      inputSchema: z.object({
        shippingDate: z.string().describe("Shipping date in format dd-MM-yyyy HH:mm:ss (e.g. '29-06-2024 14:00:00')"),
        postalCode: z.string().describe("Destination postal code (Dutch format: 1234AB)"),
        countryCode: z.string().length(2).default("NL").describe("Destination country code (ISO 3166-1 alpha-2)"),
        shippingDuration: z.number().int().optional().describe("Number of days for shipping (default depends on destination)"),
        cutOffTime: z.string().optional().describe("Cut-off time for same-day processing (format: HH:mm:ss)"),
        city: z.string().optional().describe("Destination city"),
        houseNumber: z.number().int().optional().describe("Destination house number"),
        houseNrExt: z.string().optional().describe("House number extension"),
        options: z.array(z.string()).optional().describe("Delivery options: Daytime, Evening, Morning, Noon, Sunday, Sameday"),
      }),
    },
    async ({ shippingDate, postalCode, countryCode, shippingDuration, cutOffTime, city, houseNumber, houseNrExt, options }) => {
      try {
        const result = await client.getDeliveryDate({
          shippingDate,
          postalCode,
          countryCode,
          shippingDuration,
          cutOffTime,
          city,
          houseNumber,
          houseNrExt,
          options,
        });

        const lines: string[] = [
          `Expected delivery date: ${result.DeliveryDate}`,
        ];

        if (result.Options?.string) {
          lines.push(`Options: ${result.Options.string}`);
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

  server.registerTool(
    "get_delivery_options",
    {
      title: "Get Delivery Options",
      description:
        "Get available delivery time windows for a specific address and date range. " +
        "Returns available timeframes including daytime, evening, and morning delivery options.",
      annotations: { readOnlyHint: true, openWorldHint: true },

      inputSchema: z.object({
        startDate: z.string().describe("Start date for the timeframe calculation (format: dd-MM-yyyy)"),
        endDate: z.string().describe("End date for the timeframe calculation (format: dd-MM-yyyy)"),
        postalCode: z.string().describe("Destination postal code (Dutch format: 1234AB)"),
        countryCode: z.string().length(2).default("NL").describe("Destination country code (ISO 3166-1 alpha-2)"),
        houseNumber: z.number().int().optional().describe("Destination house number"),
        houseNrExt: z.string().optional().describe("House number extension"),
        city: z.string().optional().describe("Destination city"),
        street: z.string().optional().describe("Destination street name"),
        options: z.array(z.string()).optional().describe("Delivery options to query: Daytime, Evening, Morning, Noon, Sunday, Sameday"),
      }),
    },
    async ({ startDate, endDate, postalCode, countryCode, houseNumber, houseNrExt, city, street, options }) => {
      try {
        const result = await client.getTimeframes({
          StartDate: startDate,
          EndDate: endDate,
          PostalCode: postalCode,
          CountryCode: countryCode,
          HouseNumber: houseNumber,
          HouseNrExt: houseNrExt,
          City: city,
          Street: street,
          Options: options,
        });

        const timeframes = result.Timeframes?.Timeframe ?? [];
        const noTimeframes = result.ReasonNoTimeframes?.ReasonNoTimeframe ?? [];

        if (timeframes.length === 0 && noTimeframes.length === 0) {
          return toTextResult("No delivery timeframes available for the specified address and date range.");
        }

        const lines: string[] = [];

        if (timeframes.length > 0) {
          lines.push("Available delivery timeframes:");
          for (const tf of timeframes) {
            lines.push(`  ${tf.Date ?? "Unknown date"}:`);
            const frames = tf.Timeframes?.TimeframeTimeFrame ?? [];
            for (const frame of frames) {
              const opts = frame.Options?.string?.join(", ") ?? "";
              lines.push(`    - ${frame.From ?? "?"} - ${frame.To ?? "?"}${opts ? ` (${opts})` : ""}`);
            }
          }
        }

        if (noTimeframes.length > 0) {
          lines.push("");
          lines.push("Dates without timeframes:");
          for (const reason of noTimeframes) {
            lines.push(`  - ${reason.Date ?? "?"}: ${reason.Description ?? reason.Code ?? "Unknown reason"}`);
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
