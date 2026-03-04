import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PostNLClient } from "../postnl-client.js";
import { PostNLApiError } from "../postnl-client.js";
import { registerShippingTools } from "./shipping.js";
import { registerTrackingTools } from "./tracking.js";
import { registerDeliveryTools } from "./delivery.js";
import { registerLocationTools } from "./locations.js";

type ToolHandler = (input: Record<string, unknown>) => Promise<unknown>;

interface ToolResult {
  content: { type: string; text: string }[];
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
}

const createMockServer = () => {
  const handlers = new Map<string, ToolHandler>();
  return {
    registerTool: vi.fn((name: string, _config: unknown, handler: ToolHandler) => {
      handlers.set(name, handler);
    }),
    getHandler: (name: string): ToolHandler => {
      const handler = handlers.get(name);
      if (!handler) throw new Error(`No handler registered for "${name}"`);
      return handler;
    },
  };
};

const apiError = new PostNLApiError("API failed", 500, { code: "INTERNAL" });

const createMockClient = (): Record<string, ReturnType<typeof vi.fn>> => ({
  generateBarcode: vi.fn(),
  createShipment: vi.fn(),
  getShipmentStatus: vi.fn(),
  getDeliveryDate: vi.fn(),
  getTimeframes: vi.fn(),
  getLocations: vi.fn(),
  getLocation: vi.fn(),
  validateAddress: vi.fn(),
});

const getText = (result: ToolResult): string => result.content[0].text;

describe("Shipping Tools", () => {
  let server: ReturnType<typeof createMockServer>;
  let client: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    server = createMockServer();
    client = createMockClient();
    registerShippingTools(server as never, client as unknown as PostNLClient, "DEVC", "01234567");
  });

  describe("generate_barcode", () => {
    it("returns generated barcode", async () => {
      client.generateBarcode.mockResolvedValue({ Barcode: "3STEST123456789" });

      const result = (await server.getHandler("generate_barcode")({
        type: "3S",
        serie: "000000000-999999999",
      })) as ToolResult;

      expect(result.isError).toBeUndefined();
      expect(getText(result)).toContain("3STEST123456789");
      expect(result.structuredContent?.barcode).toBe("3STEST123456789");
    });

    it("uses customerCode as default range", async () => {
      client.generateBarcode.mockResolvedValue({ Barcode: "3STEST123" });

      await server.getHandler("generate_barcode")({
        type: "3S",
        serie: "000000000-999999999",
      });

      expect(client.generateBarcode).toHaveBeenCalledWith("DEVC", "01234567", "3S", "000000000-999999999");
    });

    it("uses custom range when provided", async () => {
      client.generateBarcode.mockResolvedValue({ Barcode: "3STEST123" });

      await server.getHandler("generate_barcode")({
        type: "3S",
        serie: "000000000-999999999",
        range: "CUSTOM",
      });

      expect(client.generateBarcode).toHaveBeenCalledWith("CUSTOM", "01234567", "3S", "000000000-999999999");
    });

    it("returns error on API failure", async () => {
      client.generateBarcode.mockRejectedValue(apiError);

      const result = (await server.getHandler("generate_barcode")({
        type: "3S",
        serie: "000000000-999999999",
      })) as ToolResult;

      expect(result.isError).toBe(true);
      expect(getText(result)).toContain("API failed");
    });
  });

  describe("create_shipment", () => {
    const baseInput = {
      barcode: "3STEST123456789",
      addresses: [
        {
          AddressType: "01",
          City: "Amsterdam",
          Countrycode: "NL",
          HouseNr: "1",
          Street: "Teststraat",
          Zipcode: "1234AB",
        },
        {
          AddressType: "02",
          City: "Rotterdam",
          Countrycode: "NL",
          HouseNr: "2",
          Street: "Senderstraat",
          Zipcode: "5678CD",
        },
      ],
      productCodeDelivery: "3085",
      printerType: "GraphicFile|PDF",
      confirm: true,
    };

    it("creates shipment successfully", async () => {
      client.createShipment.mockResolvedValue({
        ResponseShipments: [
          {
            Barcode: "3STEST123456789",
            ProductCodeDelivery: "3085",
            Labels: [{ Content: "base64content", Labeltype: "Label", OutputType: "PDF" }],
            Errors: [],
            Warnings: [],
          },
        ],
      });

      const result = (await server.getHandler("create_shipment")(baseInput)) as ToolResult;

      expect(result.isError).toBeUndefined();
      expect(getText(result)).toContain("Shipment created successfully");
      expect(getText(result)).toContain("3STEST123456789");
      expect(getText(result)).toContain("Label format");
    });

    it("reports errors from response", async () => {
      client.createShipment.mockResolvedValue({
        ResponseShipments: [
          {
            Errors: [{ Code: "123", Description: "Invalid barcode" }],
            Warnings: [],
          },
        ],
      });

      const result = (await server.getHandler("create_shipment")(baseInput)) as ToolResult;

      expect(result.isError).toBeUndefined();
      expect(getText(result)).toContain("Errors:");
      expect(getText(result)).toContain("Invalid barcode");
    });

    it("reports warnings from response", async () => {
      client.createShipment.mockResolvedValue({
        ResponseShipments: [
          {
            Barcode: "3STEST123456789",
            Errors: [],
            Warnings: [{ Code: "W01", Description: "Minor issue" }],
            Labels: [],
          },
        ],
      });

      const result = (await server.getHandler("create_shipment")(baseInput)) as ToolResult;

      expect(getText(result)).toContain("Warnings:");
      expect(getText(result)).toContain("Minor issue");
    });

    it("returns error on API failure", async () => {
      client.createShipment.mockRejectedValue(apiError);

      const result = (await server.getHandler("create_shipment")(baseInput)) as ToolResult;

      expect(result.isError).toBe(true);
      expect(getText(result)).toContain("API failed");
    });

    it("passes customerCode and customerNumber to shipment body", async () => {
      client.createShipment.mockResolvedValue({
        ResponseShipments: [{ Barcode: "3STEST123456789", Errors: [], Warnings: [], Labels: [] }],
      });

      await server.getHandler("create_shipment")(baseInput);

      const [body] = client.createShipment.mock.calls[0];
      expect(body.Customer.CustomerCode).toBe("DEVC");
      expect(body.Customer.CustomerNumber).toBe("01234567");
    });
  });
});

describe("Tracking Tools", () => {
  let server: ReturnType<typeof createMockServer>;
  let client: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    server = createMockServer();
    client = createMockClient();
    registerTrackingTools(server as never, client as unknown as PostNLClient, "DEVC", "01234567");
  });

  describe("get_shipment_status", () => {
    it("returns shipment status with all fields", async () => {
      client.getShipmentStatus.mockResolvedValue({
        CurrentStatus: {
          Shipment: {
            Barcode: "3STEST123",
            Status: {
              StatusCode: "7",
              StatusDescription: "Delivered",
              PhaseDescription: "Delivery",
              TimeStamp: "2024-07-01T14:00:00",
            },
            ProductDescription: "Standard parcel",
            ExpectedDeliveryDate: "2024-07-01",
            DeliveryDate: "2024-07-01",
            Reference: "REF-001",
            OldStatuses: [
              { TimeStamp: "2024-06-30T10:00:00", StatusDescription: "Sorting" },
            ],
          },
        },
      });

      const result = (await server.getHandler("get_shipment_status")({
        barcode: "3STEST123",
      })) as ToolResult;

      expect(result.isError).toBeUndefined();
      expect(getText(result)).toContain("3STEST123");
      expect(getText(result)).toContain("Delivered");
      expect(getText(result)).toContain("Delivery");
      expect(getText(result)).toContain("Standard parcel");
      expect(getText(result)).toContain("REF-001");
      expect(getText(result)).toContain("Status history:");
      expect(getText(result)).toContain("Sorting");
    });

    it("handles missing shipment data", async () => {
      client.getShipmentStatus.mockResolvedValue({
        CurrentStatus: {},
      });

      const result = (await server.getHandler("get_shipment_status")({
        barcode: "3STEST123",
      })) as ToolResult;

      expect(getText(result)).toContain("No status information found");
    });

    it("shows delivery window when available", async () => {
      client.getShipmentStatus.mockResolvedValue({
        CurrentStatus: {
          Shipment: {
            Barcode: "3STEST123",
            Status: { StatusDescription: "In transit" },
            ExpectedDeliveryTimeStampStart: "2024-07-01T09:00:00",
            ExpectedDeliveryTimeStampEnd: "2024-07-01T12:00:00",
          },
        },
      });

      const result = (await server.getHandler("get_shipment_status")({
        barcode: "3STEST123",
      })) as ToolResult;

      expect(getText(result)).toContain("Delivery window:");
    });

    it("shows warnings when present", async () => {
      client.getShipmentStatus.mockResolvedValue({
        CurrentStatus: {
          Shipment: {
            Barcode: "3STEST123",
            Status: { StatusDescription: "Delivered" },
          },
        },
        Warnings: [{ Code: "W01", Description: "Partial data" }],
      });

      const result = (await server.getHandler("get_shipment_status")({
        barcode: "3STEST123",
      })) as ToolResult;

      expect(getText(result)).toContain("Warnings:");
      expect(getText(result)).toContain("Partial data");
    });

    it("returns error on API failure", async () => {
      client.getShipmentStatus.mockRejectedValue(apiError);

      const result = (await server.getHandler("get_shipment_status")({
        barcode: "3STEST123",
      })) as ToolResult;

      expect(result.isError).toBe(true);
      expect(getText(result)).toContain("API failed");
    });
  });
});

describe("Delivery Tools", () => {
  let server: ReturnType<typeof createMockServer>;
  let client: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    server = createMockServer();
    client = createMockClient();
    registerDeliveryTools(server as never, client as unknown as PostNLClient, "DEVC", "01234567");
  });

  describe("get_delivery_date", () => {
    it("returns delivery date", async () => {
      client.getDeliveryDate.mockResolvedValue({
        DeliveryDate: "01-07-2024",
        Options: { string: "Daytime" },
      });

      const result = (await server.getHandler("get_delivery_date")({
        shippingDate: "29-06-2024 14:00:00",
        postalCode: "1234AB",
        countryCode: "NL",
      })) as ToolResult;

      expect(result.isError).toBeUndefined();
      expect(getText(result)).toContain("01-07-2024");
      expect(getText(result)).toContain("Daytime");
    });

    it("returns delivery date without options", async () => {
      client.getDeliveryDate.mockResolvedValue({
        DeliveryDate: "01-07-2024",
      });

      const result = (await server.getHandler("get_delivery_date")({
        shippingDate: "29-06-2024 14:00:00",
        postalCode: "1234AB",
        countryCode: "NL",
      })) as ToolResult;

      expect(getText(result)).toContain("01-07-2024");
      expect(getText(result)).not.toContain("Options:");
    });

    it("returns error on API failure", async () => {
      client.getDeliveryDate.mockRejectedValue(apiError);

      const result = (await server.getHandler("get_delivery_date")({
        shippingDate: "29-06-2024 14:00:00",
        postalCode: "1234AB",
        countryCode: "NL",
      })) as ToolResult;

      expect(result.isError).toBe(true);
    });
  });

  describe("get_delivery_options", () => {
    it("returns available timeframes", async () => {
      client.getTimeframes.mockResolvedValue({
        Timeframes: {
          Timeframe: [
            {
              Date: "01-07-2024",
              Timeframes: {
                TimeframeTimeFrame: [
                  { From: "09:00:00", To: "12:00:00", Options: { string: ["Daytime"] } },
                  { From: "18:00:00", To: "21:00:00", Options: { string: ["Evening"] } },
                ],
              },
            },
          ],
        },
      });

      const result = (await server.getHandler("get_delivery_options")({
        startDate: "01-07-2024",
        endDate: "05-07-2024",
        postalCode: "1234AB",
        countryCode: "NL",
      })) as ToolResult;

      expect(result.isError).toBeUndefined();
      expect(getText(result)).toContain("Available delivery timeframes:");
      expect(getText(result)).toContain("01-07-2024");
      expect(getText(result)).toContain("09:00:00 - 12:00:00");
      expect(getText(result)).toContain("Daytime");
      expect(getText(result)).toContain("Evening");
    });

    it("returns reason when no timeframes available", async () => {
      client.getTimeframes.mockResolvedValue({
        Timeframes: {},
        ReasonNoTimeframes: {
          ReasonNoTimeframe: [
            { Date: "01-07-2024", Code: "1", Description: "Public holiday" },
          ],
        },
      });

      const result = (await server.getHandler("get_delivery_options")({
        startDate: "01-07-2024",
        endDate: "01-07-2024",
        postalCode: "1234AB",
        countryCode: "NL",
      })) as ToolResult;

      expect(getText(result)).toContain("Dates without timeframes:");
      expect(getText(result)).toContain("Public holiday");
    });

    it("returns message when neither timeframes nor reasons exist", async () => {
      client.getTimeframes.mockResolvedValue({
        Timeframes: {},
        ReasonNoTimeframes: {},
      });

      const result = (await server.getHandler("get_delivery_options")({
        startDate: "01-07-2024",
        endDate: "01-07-2024",
        postalCode: "1234AB",
        countryCode: "NL",
      })) as ToolResult;

      expect(getText(result)).toContain("No delivery timeframes available");
    });

    it("returns error on API failure", async () => {
      client.getTimeframes.mockRejectedValue(apiError);

      const result = (await server.getHandler("get_delivery_options")({
        startDate: "01-07-2024",
        endDate: "05-07-2024",
        postalCode: "1234AB",
        countryCode: "NL",
      })) as ToolResult;

      expect(result.isError).toBe(true);
    });
  });
});

describe("Location Tools", () => {
  let server: ReturnType<typeof createMockServer>;
  let client: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    server = createMockServer();
    client = createMockClient();
    registerLocationTools(server as never, client as unknown as PostNLClient, "DEVC", "01234567");
  });

  describe("find_locations", () => {
    it("returns found locations", async () => {
      client.getLocations.mockResolvedValue({
        GetLocationsResult: {
          ResponseLocation: [
            {
              Name: "PostNL Punt Albert Heijn",
              LocationCode: 12345,
              Address: {
                Street: "Teststraat",
                HouseNr: 1,
                Zipcode: "1234AB",
                City: "Amsterdam",
              },
              Distance: 250,
              PhoneNumber: "020-1234567",
              DeliveryOptions: { string: ["PG", "PGE"] },
              PartnerName: "Albert Heijn",
              OpeningHours: {
                Monday: { string: "08:00-21:00" },
                Tuesday: { string: "08:00-21:00" },
              },
            },
          ],
        },
      });

      const result = (await server.getHandler("find_locations")({
        countryCode: "NL",
        postalCode: "1234AB",
      })) as ToolResult;

      expect(result.isError).toBeUndefined();
      expect(getText(result)).toContain("Found 1 PostNL location(s):");
      expect(getText(result)).toContain("PostNL Punt Albert Heijn");
      expect(getText(result)).toContain("12345");
      expect(getText(result)).toContain("250m");
      expect(getText(result)).toContain("PG, PGE");
      expect(getText(result)).toContain("Albert Heijn");
      expect(getText(result)).toContain("Mon: 08:00-21:00");
      expect(result.structuredContent?.count).toBe(1);
    });

    it("returns message when no locations found", async () => {
      client.getLocations.mockResolvedValue({
        GetLocationsResult: {
          ResponseLocation: [],
        },
      });

      const result = (await server.getHandler("find_locations")({
        countryCode: "NL",
        postalCode: "9999ZZ",
      })) as ToolResult;

      expect(getText(result)).toContain("No PostNL locations found");
    });

    it("returns error on API failure", async () => {
      client.getLocations.mockRejectedValue(apiError);

      const result = (await server.getHandler("find_locations")({
        countryCode: "NL",
        postalCode: "1234AB",
      })) as ToolResult;

      expect(result.isError).toBe(true);
    });

    it("passes all parameters to client", async () => {
      client.getLocations.mockResolvedValue({
        GetLocationsResult: { ResponseLocation: [] },
      });

      await server.getHandler("find_locations")({
        countryCode: "NL",
        postalCode: "1234AB",
        city: "Amsterdam",
        street: "Teststraat",
        houseNumber: 1,
        deliveryDate: "01-07-2024",
        openingTime: "09:00:00",
        deliveryOptions: ["PG"],
        latitude: 52.37,
        longitude: 4.89,
      });

      expect(client.getLocations).toHaveBeenCalledWith({
        CountryCode: "NL",
        PostalCode: "1234AB",
        City: "Amsterdam",
        Street: "Teststraat",
        HouseNumber: 1,
        DeliveryDate: "01-07-2024",
        OpeningTime: "09:00:00",
        DeliveryOptions: ["PG"],
        Latitude: 52.37,
        Longitude: 4.89,
      });
    });
  });

  describe("get_location", () => {
    it("returns location details", async () => {
      client.getLocation.mockResolvedValue({
        GetLocationsResult: {
          ResponseLocation: [
            {
              Name: "PostNL Punt AH",
              LocationCode: 12345,
              Address: {
                Street: "Teststraat",
                HouseNr: 1,
                Zipcode: "1234AB",
                City: "Amsterdam",
              },
              DeliveryOptions: { string: ["PG"] },
            },
          ],
        },
      });

      const result = (await server.getHandler("get_location")({
        locationCode: "12345",
        retailNetworkID: "PNPNL-01",
      })) as ToolResult;

      expect(result.isError).toBeUndefined();
      expect(getText(result)).toContain("PostNL Punt AH");
      expect(getText(result)).toContain("12345");
    });

    it("returns message when location not found", async () => {
      client.getLocation.mockResolvedValue({
        GetLocationsResult: {
          ResponseLocation: [],
        },
      });

      const result = (await server.getHandler("get_location")({
        locationCode: "99999",
        retailNetworkID: "PNPNL-01",
      })) as ToolResult;

      expect(getText(result)).toContain("No location found with code: 99999");
    });

    it("returns error on API failure", async () => {
      client.getLocation.mockRejectedValue(apiError);

      const result = (await server.getHandler("get_location")({
        locationCode: "12345",
        retailNetworkID: "PNPNL-01",
      })) as ToolResult;

      expect(result.isError).toBe(true);
    });

    it("passes retailNetworkID to client", async () => {
      client.getLocation.mockResolvedValue({
        GetLocationsResult: { ResponseLocation: [] },
      });

      await server.getHandler("get_location")({
        locationCode: "12345",
        retailNetworkID: "CUSTOM-01",
      });

      expect(client.getLocation).toHaveBeenCalledWith("12345", "CUSTOM-01");
    });
  });
});
