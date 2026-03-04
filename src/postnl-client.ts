import { TtlCache } from "./cache.js";
import type {
  PostNLBarcodeResponse,
  PostNLShipmentBody,
  PostNLShipmentResponse,
  PostNLStatusResponse,
  PostNLDeliveryDateResponse,
  PostNLTimeframeRequest,
  PostNLTimeframeResponse,
  PostNLLocationRequest,
  PostNLLocationsResponse,
  PostNLSingleLocationResponse,
  PostNLAddressCheckRequest,
  PostNLAddressCheckResponse,
} from "./types.js";

export class PostNLApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export interface RetryOptions {
  maxRetries: number;
}

const DEFAULT_RETRY: RetryOptions = { maxRetries: 3 };

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export class PostNLClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly retry: RetryOptions;
  private readonly cache: TtlCache;
  private readonly cachingEnabled: boolean;

  constructor(
    apiKey: string,
    baseUrl = "https://api.postnl.nl",
    cacheTtlMs?: number,
    retry: RetryOptions = DEFAULT_RETRY,
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
    this.retry = retry;
    this.cachingEnabled = cacheTtlMs !== 0;
    this.cache = new TtlCache(cacheTtlMs ?? 120_000);
  }

  private async cachedRequest<T>(cacheKey: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
    if (!this.cachingEnabled || ttlMs <= 0) return fetcher();

    const cached = this.cache.get<T>(cacheKey);
    if (cached !== undefined) return cached;

    const result = await fetcher();
    this.cache.set(cacheKey, result, ttlMs);
    return result;
  }

  // --- Barcode ---

  async generateBarcode(
    customerCode: string,
    customerNumber: string,
    type = "3S",
    serie = "000000000-999999999",
    range?: string,
  ): Promise<PostNLBarcodeResponse> {
    const query = new URLSearchParams({
      CustomerCode: customerCode,
      CustomerNumber: customerNumber,
      Type: type,
      Serie: serie,
    });

    if (range) {
      query.set("Range", range);
    }

    return this.request<PostNLBarcodeResponse>(
      `/shipment/v1_1/barcode?${query.toString()}`,
    );
  }

  // --- Shipment ---

  async createShipment(
    body: PostNLShipmentBody,
    confirm = true,
  ): Promise<PostNLShipmentResponse> {
    const query = new URLSearchParams({ confirm: String(confirm) });

    return this.request<PostNLShipmentResponse>(
      `/shipment/v2_2/label?${query.toString()}`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
  }

  // --- Status / Tracking ---

  async getShipmentStatus(barcode: string): Promise<PostNLStatusResponse> {
    return this.cachedRequest(
      `status:${barcode}`,
      60_000,
      () => this.request<PostNLStatusResponse>(
        `/shipment/v2/status/barcode/${encodeURIComponent(barcode)}`,
      ),
    );
  }

  // --- Delivery Date ---

  async getDeliveryDate(options: {
    shippingDate: string;
    shippingDuration?: number;
    cutOffTime?: string;
    postalCode: string;
    countryCode?: string;
    city?: string;
    houseNumber?: number;
    houseNrExt?: string;
    options?: string[];
  }): Promise<PostNLDeliveryDateResponse> {
    const query = new URLSearchParams({
      ShippingDate: options.shippingDate,
      PostalCode: options.postalCode,
    });

    if (options.shippingDuration !== undefined) {
      query.set("ShippingDuration", String(options.shippingDuration));
    }
    if (options.cutOffTime) {
      query.set("CutOffTime", options.cutOffTime);
    }
    if (options.countryCode) {
      query.set("CountryCode", options.countryCode);
    }
    if (options.city) {
      query.set("City", options.city);
    }
    if (options.houseNumber !== undefined) {
      query.set("HouseNumber", String(options.houseNumber));
    }
    if (options.houseNrExt) {
      query.set("HouseNrExt", options.houseNrExt);
    }
    if (options.options?.length) {
      for (const opt of options.options) {
        query.append("Options", opt);
      }
    }

    return this.cachedRequest(
      `delivery-date:${query.toString()}`,
      300_000,
      () => this.request<PostNLDeliveryDateResponse>(
        `/shipment/v2_2/calculate/date/delivery?${query.toString()}`,
      ),
    );
  }

  // --- Timeframes / Delivery Options ---

  async getTimeframes(options: PostNLTimeframeRequest): Promise<PostNLTimeframeResponse> {
    const query = new URLSearchParams({
      StartDate: options.StartDate,
      EndDate: options.EndDate,
      PostalCode: options.PostalCode,
    });

    if (options.CountryCode) {
      query.set("CountryCode", options.CountryCode);
    }
    if (options.HouseNumber !== undefined) {
      query.set("HouseNumber", String(options.HouseNumber));
    }
    if (options.HouseNrExt) {
      query.set("HouseNrExt", options.HouseNrExt);
    }
    if (options.City) {
      query.set("City", options.City);
    }
    if (options.Street) {
      query.set("Street", options.Street);
    }
    if (options.Options?.length) {
      for (const opt of options.Options) {
        query.append("Options", opt);
      }
    }

    return this.cachedRequest(
      `timeframes:${query.toString()}`,
      300_000,
      () => this.request<PostNLTimeframeResponse>(
        `/shipment/v2_1/calculate/timeframes?${query.toString()}`,
      ),
    );
  }

  // --- Locations ---

  async getLocations(options: PostNLLocationRequest): Promise<PostNLLocationsResponse> {
    const query = new URLSearchParams({
      CountryCode: options.CountryCode,
    });

    if (options.PostalCode) {
      query.set("PostalCode", options.PostalCode);
    }
    if (options.City) {
      query.set("City", options.City);
    }
    if (options.Street) {
      query.set("Street", options.Street);
    }
    if (options.HouseNumber !== undefined) {
      query.set("HouseNumber", String(options.HouseNumber));
    }
    if (options.DeliveryDate) {
      query.set("DeliveryDate", options.DeliveryDate);
    }
    if (options.OpeningTime) {
      query.set("OpeningTime", options.OpeningTime);
    }
    if (options.DeliveryOptions?.length) {
      for (const opt of options.DeliveryOptions) {
        query.append("DeliveryOptions", opt);
      }
    }
    if (options.Latitude !== undefined) {
      query.set("Latitude", String(options.Latitude));
    }
    if (options.Longitude !== undefined) {
      query.set("Longitude", String(options.Longitude));
    }

    return this.cachedRequest(
      `locations:${query.toString()}`,
      600_000,
      () => this.request<PostNLLocationsResponse>(
        `/shipment/v2_1/locations/nearest?${query.toString()}`,
      ),
    );
  }

  async getLocation(locationCode: string, retailNetworkID = "PNPNL-01"): Promise<PostNLSingleLocationResponse> {
    const query = new URLSearchParams({
      RetailNetworkID: retailNetworkID,
    });

    return this.cachedRequest(
      `location:${locationCode}:${retailNetworkID}`,
      600_000,
      () => this.request<PostNLSingleLocationResponse>(
        `/shipment/v2_1/locations/lookup?LocationCode=${encodeURIComponent(locationCode)}&${query.toString()}`,
      ),
    );
  }

  // --- Address Validation ---

  async validateAddress(address: PostNLAddressCheckRequest): Promise<PostNLAddressCheckResponse[]> {
    return this.request<PostNLAddressCheckResponse[]>(
      "/shipment/v1/checkout/address/check",
      {
        method: "POST",
        body: JSON.stringify([address]),
      },
    );
  }

  // --- Private ---

  private static async parseBody(response: Response): Promise<unknown> {
    const contentType = response.headers.get("content-type") ?? "";
    return contentType.includes("application/json")
      ? response.json().catch(() => null)
      : response.text().catch(() => "");
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    headers.set("apikey", this.apiKey);
    headers.set("Content-Type", "application/json");
    headers.set("Accept", "application/json");

    const url = `${this.baseUrl}${path}`;
    const requestInit: RequestInit = { ...init, headers };

    const maxRetries = Math.max(0, this.retry.maxRetries);

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const response = await fetch(url, requestInit);

      if (response.ok) {
        if (response.status === 204) {
          return null as T;
        }
        return await PostNLClient.parseBody(response) as T;
      }

      if (response.status === 429 && attempt < maxRetries) {
        const retryAfter = response.headers.get("retry-after");
        const delayMs = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : Math.pow(2, attempt) * 1000;
        await sleep(delayMs);
        continue;
      }

      throw new PostNLApiError(
        `PostNL API request failed: ${response.status} ${response.statusText}`,
        response.status,
        await PostNLClient.parseBody(response),
      );
    }

    /* v8 ignore next */
    throw new Error("Retry loop exited unexpectedly");
  }
}
