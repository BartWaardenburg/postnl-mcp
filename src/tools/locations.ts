import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { PostNLClient } from "../postnl-client.js";
import { toTextResult, toErrorResult } from "../tool-result.js";
import type { PostNLLocation } from "../types.js";

const formatLocation = (loc: PostNLLocation): string => {
  const parts: string[] = [];
  parts.push(`${loc.Name ?? "Unknown"} (${loc.LocationCode ?? "?"})`);

  if (loc.Address) {
    const addr = loc.Address;
    parts.push(`  Address: ${addr.Street ?? ""} ${addr.HouseNr ?? ""}${addr.HouseNrExt ? ` ${addr.HouseNrExt}` : ""}, ${addr.Zipcode ?? ""} ${addr.City ?? ""}`);
  }

  if (loc.Distance !== undefined) {
    parts.push(`  Distance: ${loc.Distance}m`);
  }

  if (loc.PhoneNumber) {
    parts.push(`  Phone: ${loc.PhoneNumber}`);
  }

  const deliveryOpts = loc.DeliveryOptions?.string ?? [];
  if (deliveryOpts.length > 0) {
    parts.push(`  Options: ${deliveryOpts.join(", ")}`);
  }

  if (loc.OpeningHours) {
    const hours: string[] = [];
    const days: [string, typeof loc.OpeningHours.Monday][] = [
      ["Mon", loc.OpeningHours.Monday],
      ["Tue", loc.OpeningHours.Tuesday],
      ["Wed", loc.OpeningHours.Wednesday],
      ["Thu", loc.OpeningHours.Thursday],
      ["Fri", loc.OpeningHours.Friday],
      ["Sat", loc.OpeningHours.Saturday],
      ["Sun", loc.OpeningHours.Sunday],
    ];
    for (const [day, time] of days) {
      if (time?.string) {
        hours.push(`${day}: ${time.string}`);
      }
    }
    if (hours.length > 0) {
      parts.push(`  Hours: ${hours.join(", ")}`);
    }
  }

  if (loc.PartnerName) {
    parts.push(`  Partner: ${loc.PartnerName}`);
  }

  return parts.join("\n");
};

export const registerLocationTools = (
  server: McpServer,
  client: PostNLClient,
  _customerCode: string,
  _customerNumber: string,
): void => {
  server.registerTool(
    "find_locations",
    {
      title: "Find PostNL Locations",
      description:
        "Find nearby PostNL pickup/drop-off points (post offices, parcel lockers, retail points). " +
        "Search by postal code, city, coordinates, or a combination. " +
        "Useful for finding the nearest place to drop off or collect a parcel.",
      annotations: { readOnlyHint: true, openWorldHint: true },

      inputSchema: z.object({
        countryCode: z.string().length(2).default("NL").describe("Country code (ISO 3166-1 alpha-2)"),
        postalCode: z.string().optional().describe("Postal code to search near (Dutch format: 1234AB)"),
        city: z.string().optional().describe("City to search in"),
        street: z.string().optional().describe("Street name"),
        houseNumber: z.number().int().optional().describe("House number"),
        deliveryDate: z.string().optional().describe("Delivery date (format: dd-MM-yyyy)"),
        openingTime: z.string().optional().describe("Required opening time (format: HH:mm:ss)"),
        deliveryOptions: z.array(z.string()).optional().describe("Filter by delivery options: PG (pickup), PGE (early pickup), PA (parcel automat)"),
        latitude: z.number().optional().describe("Latitude for geo-search"),
        longitude: z.number().optional().describe("Longitude for geo-search"),
      }),
    },
    async ({ countryCode, postalCode, city, street, houseNumber, deliveryDate, openingTime, deliveryOptions, latitude, longitude }) => {
      try {
        const result = await client.getLocations({
          CountryCode: countryCode,
          PostalCode: postalCode,
          City: city,
          Street: street,
          HouseNumber: houseNumber,
          DeliveryDate: deliveryDate,
          OpeningTime: openingTime,
          DeliveryOptions: deliveryOptions,
          Latitude: latitude,
          Longitude: longitude,
        });

        const locations = result.GetLocationsResult?.ResponseLocation ?? [];

        if (locations.length === 0) {
          return toTextResult("No PostNL locations found matching the search criteria.");
        }

        const lines: string[] = [
          `Found ${locations.length} PostNL location(s):`,
          "",
          ...locations.map(formatLocation),
        ];

        return toTextResult(
          lines.join("\n"),
          { count: locations.length, locations } as Record<string, unknown>,
        );
      } catch (error) {
        return toErrorResult(error);
      }
    },
  );

  server.registerTool(
    "get_location",
    {
      title: "Get PostNL Location",
      description:
        "Get detailed information about a specific PostNL location by its location code. " +
        "Returns address, opening hours, available delivery options, and contact information.",
      annotations: { readOnlyHint: true, openWorldHint: true },

      inputSchema: z.object({
        locationCode: z.string().min(1).describe("The PostNL location code"),
        retailNetworkID: z.string().default("PNPNL-01").describe("Retail network ID (default: PNPNL-01 for PostNL Netherlands)"),
      }),
    },
    async ({ locationCode, retailNetworkID }) => {
      try {
        const result = await client.getLocation(locationCode, retailNetworkID);
        const locations = result.GetLocationsResult?.ResponseLocation ?? [];

        if (locations.length === 0) {
          return toTextResult(`No location found with code: ${locationCode}`);
        }

        const location = locations[0];

        return toTextResult(
          formatLocation(location),
          location as unknown as Record<string, unknown>,
        );
      } catch (error) {
        return toErrorResult(error);
      }
    },
  );
};
