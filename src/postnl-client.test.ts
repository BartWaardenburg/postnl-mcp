import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PostNLClient, PostNLApiError } from "./postnl-client.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const jsonResponse = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

const emptyResponse = (): Response => new Response(null, { status: 204 });

const errorResponse = (status: number, body?: unknown): Response =>
  new Response(body ? JSON.stringify(body) : "error", {
    status,
    statusText: status === 429 ? "Too Many Requests" : "Error",
    headers: body ? { "content-type": "application/json" } : {},
  });

describe("PostNLClient", () => {
  let client: PostNLClient;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    mockFetch.mockReset();
    client = new PostNLClient("test-api-key", "https://api.test.com");
  });

  describe("request building", () => {
    it("sends apikey header on every request", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ Barcode: "3STEST123" }));

      await client.generateBarcode("DEVC", "01234567");

      const [, init] = mockFetch.mock.calls[0];
      const headers = init.headers as Headers;
      expect(headers.get("apikey")).toBe("test-api-key");
      expect(headers.get("Content-Type")).toBe("application/json");
      expect(headers.get("Accept")).toBe("application/json");
    });

    it("strips trailing slash from baseUrl", () => {
      const c = new PostNLClient("key", "https://api.test.com/");
      mockFetch.mockResolvedValueOnce(jsonResponse({ Barcode: "3STEST123" }));

      c.generateBarcode("DEVC", "01234567");

      const [url] = mockFetch.mock.calls[0];
      expect(url).not.toContain("//shipment");
    });
  });

  describe("response parsing", () => {
    it("parses JSON responses", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ Barcode: "3STEST123" }));

      const result = await client.generateBarcode("DEVC", "01234567");

      expect(result).toEqual({ Barcode: "3STEST123" });
    });

    it("returns null for 204 No Content", async () => {
      mockFetch.mockResolvedValueOnce(emptyResponse());

      const result = await client.generateBarcode("DEVC", "01234567");

      expect(result).toBeNull();
    });

    it("parses text responses for non-JSON content types", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response("plain text", {
          status: 200,
          headers: { "content-type": "text/plain" },
        }),
      );

      const result = await client.generateBarcode("DEVC", "01234567");

      expect(result).toBe("plain text");
    });
  });

  describe("error handling", () => {
    it("throws PostNLApiError on non-ok responses", async () => {
      mockFetch.mockResolvedValue(errorResponse(400, { message: "Bad request" }));

      await expect(client.generateBarcode("DEVC", "01234567")).rejects.toThrow(PostNLApiError);
    });

    it("includes status code in error", async () => {
      mockFetch.mockResolvedValue(errorResponse(404, { message: "Not found" }));

      try {
        await client.generateBarcode("DEVC", "01234567");
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(PostNLApiError);
        expect((err as PostNLApiError).status).toBe(404);
      }
    });

    it("includes parsed body as details", async () => {
      mockFetch.mockResolvedValue(errorResponse(400, { Errors: [{ Code: "1", Description: "Invalid" }] }));

      try {
        await client.generateBarcode("DEVC", "01234567");
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as PostNLApiError).details).toEqual({ Errors: [{ Code: "1", Description: "Invalid" }] });
      }
    });
  });

  describe("retry on 429", () => {
    it("retries on 429 and succeeds", async () => {
      vi.useFakeTimers();

      mockFetch
        .mockResolvedValueOnce(errorResponse(429))
        .mockResolvedValueOnce(jsonResponse({ Barcode: "3STEST123" }));

      const promise = client.generateBarcode("DEVC", "01234567");

      // Advance past the exponential backoff delay (2^0 * 1000 = 1000ms)
      await vi.advanceTimersByTimeAsync(1500);

      const result = await promise;
      expect(result).toEqual({ Barcode: "3STEST123" });
      expect(mockFetch).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it("respects retry-after header", async () => {
      vi.useFakeTimers();

      const rateLimitResponse = new Response("rate limited", {
        status: 429,
        statusText: "Too Many Requests",
        headers: { "retry-after": "2" },
      });
      mockFetch
        .mockResolvedValueOnce(rateLimitResponse)
        .mockResolvedValueOnce(jsonResponse({ Barcode: "3STEST123" }));

      const promise = client.generateBarcode("DEVC", "01234567");

      // retry-after: 2 means 2000ms
      await vi.advanceTimersByTimeAsync(2500);

      const result = await promise;
      expect(result).toEqual({ Barcode: "3STEST123" });

      vi.useRealTimers();
    });

    it("throws after exhausting retries", async () => {
      const noRetryClient = new PostNLClient("test-api-key", "https://api.test.com", undefined, { maxRetries: 0 });

      mockFetch.mockResolvedValue(errorResponse(429));

      await expect(noRetryClient.generateBarcode("DEVC", "01234567")).rejects.toThrow(PostNLApiError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("caching", () => {
    it("caches getShipmentStatus responses", async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({ CurrentStatus: { Shipment: { Barcode: "3STEST123" } } }),
      );

      const first = await client.getShipmentStatus("3STEST123");
      const second = await client.getShipmentStatus("3STEST123");

      expect(first).toEqual(second);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("caches getDeliveryDate responses", async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({ DeliveryDate: "2024-07-01" }),
      );

      const opts = { shippingDate: "29-06-2024 14:00:00", postalCode: "1234AB" };
      await client.getDeliveryDate(opts);
      await client.getDeliveryDate(opts);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("caches getTimeframes responses", async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({ Timeframes: { Timeframe: [] } }),
      );

      const opts = { StartDate: "01-07-2024", EndDate: "05-07-2024", PostalCode: "1234AB" };
      await client.getTimeframes(opts);
      await client.getTimeframes(opts);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("caches getLocations responses", async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({ GetLocationsResult: { ResponseLocation: [] } }),
      );

      const opts = { CountryCode: "NL", PostalCode: "1234AB" };
      await client.getLocations(opts);
      await client.getLocations(opts);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("caches getLocation responses", async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({ GetLocationsResult: { ResponseLocation: [] } }),
      );

      await client.getLocation("12345");
      await client.getLocation("12345");

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("does not cache generateBarcode", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ Barcode: "3STEST123" }));

      await client.generateBarcode("DEVC", "01234567");
      await client.generateBarcode("DEVC", "01234567");

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("does not cache createShipment", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ ResponseShipments: [] }));

      const body = {
        Customer: { CustomerCode: "DEVC", CustomerNumber: "01234567" },
        Message: { MessageID: "1", MessageTimeStamp: "01-01-2024 00:00:00", Printertype: "GraphicFile|PDF" },
        Shipments: [],
      };
      await client.createShipment(body);
      await client.createShipment(body);

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("does not cache validateAddress", async () => {
      mockFetch.mockResolvedValue(jsonResponse([]));

      const addr = { PostalCode: "1234AB", HouseNumber: 1 };
      await client.validateAddress(addr);
      await client.validateAddress(addr);

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("disables caching when cacheTtlMs is 0", async () => {
      const noCacheClient = new PostNLClient("test-api-key", "https://api.test.com", 0);

      mockFetch.mockResolvedValue(
        jsonResponse({ CurrentStatus: { Shipment: { Barcode: "3STEST123" } } }),
      );

      await noCacheClient.getShipmentStatus("3STEST123");
      await noCacheClient.getShipmentStatus("3STEST123");

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("API method URLs", () => {
    it("calls correct URL for generateBarcode", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ Barcode: "3STEST123" }));

      await client.generateBarcode("DEVC", "01234567", "3S", "000000000-999999999");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/shipment/v1_1/barcode");
      expect(url).toContain("CustomerCode=DEVC");
      expect(url).toContain("CustomerNumber=01234567");
      expect(url).toContain("Type=3S");
    });

    it("calls correct URL for createShipment", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ ResponseShipments: [] }));

      const body = {
        Customer: { CustomerCode: "DEVC", CustomerNumber: "01234567" },
        Message: { MessageID: "1", MessageTimeStamp: "01-01-2024 00:00:00", Printertype: "GraphicFile|PDF" },
        Shipments: [],
      };
      await client.createShipment(body, true);

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toContain("/shipment/v2_2/label");
      expect(url).toContain("confirm=true");
      expect(init.method).toBe("POST");
    });

    it("calls correct URL for getShipmentStatus", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ CurrentStatus: {} }));

      await client.getShipmentStatus("3STEST123");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/shipment/v2/status/barcode/3STEST123");
    });

    it("calls correct URL for getDeliveryDate", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ DeliveryDate: "2024-07-01" }));

      await client.getDeliveryDate({
        shippingDate: "29-06-2024 14:00:00",
        postalCode: "1234AB",
        countryCode: "NL",
      });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/shipment/v2_2/calculate/date/delivery");
      expect(url).toContain("PostalCode=1234AB");
    });

    it("calls correct URL for getTimeframes", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ Timeframes: {} }));

      await client.getTimeframes({
        StartDate: "01-07-2024",
        EndDate: "05-07-2024",
        PostalCode: "1234AB",
      });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/shipment/v2_1/calculate/timeframes");
    });

    it("calls nearest endpoint for getLocations without coordinates", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ GetLocationsResult: {} }));

      await client.getLocations({ CountryCode: "NL", PostalCode: "1234AB" });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/shipment/v2_1/locations/nearest?");
      expect(url).not.toContain("geocode");
    });

    it("calls geocode endpoint for getLocations with coordinates", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ GetLocationsResult: {} }));

      await client.getLocations({ CountryCode: "NL", Latitude: 52.37, Longitude: 4.89 });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/shipment/v2_1/locations/nearest/geocode");
    });

    it("calls correct URL for getLocation", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ GetLocationsResult: {} }));

      await client.getLocation("12345", "PNPNL-01");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/shipment/v2_1/locations/lookup");
      expect(url).toContain("LocationCode=12345");
      expect(url).toContain("RetailNetworkID=PNPNL-01");
    });

    it("calls correct URL for validateAddress", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse([]));

      await client.validateAddress({ PostalCode: "1234AB", HouseNumber: 1 });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/shipment/checkout/v1/postalcodecheck");
      expect(url).toContain("postalcode=1234AB");
      expect(url).toContain("housenumber=1");
    });

    it("includes housenumberaddition for validateAddress when provided", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse([]));

      await client.validateAddress({ PostalCode: "1234AB", HouseNumber: 1, HouseNumberAddition: "bis" });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("housenumberaddition=bis");
    });

    it("includes range parameter for generateBarcode when provided", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ Barcode: "3STEST123" }));

      await client.generateBarcode("DEVC", "01234567", "3S", "000000000-999999999", "RANGE1");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("Range=RANGE1");
    });

    it("includes optional query params for getDeliveryDate", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ DeliveryDate: "2024-07-01" }));

      await client.getDeliveryDate({
        shippingDate: "29-06-2024 14:00:00",
        postalCode: "1234AB",
        shippingDuration: 1,
        cutOffTime: "16:00:00",
        countryCode: "NL",
        originCountryCode: "NL",
        city: "Amsterdam",
        houseNr: "1",
        houseNrExt: "A",
        options: ["Daytime", "Evening"],
      });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("ShippingDuration=1");
      expect(url).toContain("CutOffTime=16%3A00%3A00");
      expect(url).toContain("City=Amsterdam");
      expect(url).toContain("HouseNumber=1");
      expect(url).toContain("HouseNrExt=A");
      expect(url).toContain("Options=Daytime");
      expect(url).toContain("Options=Evening");
    });
  });
});
