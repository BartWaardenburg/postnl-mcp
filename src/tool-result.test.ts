import { describe, it, expect } from "vitest";
import { toTextResult, toErrorResult } from "./tool-result.js";
import { PostNLApiError } from "./postnl-client.js";

describe("toTextResult", () => {
  it("returns text content", () => {
    const result = toTextResult("hello");
    expect(result).toEqual({
      content: [{ type: "text", text: "hello" }],
    });
  });

  it("includes structured content when provided", () => {
    const result = toTextResult("hello", { key: "value" });
    expect(result).toEqual({
      content: [{ type: "text", text: "hello" }],
      structuredContent: { key: "value" },
    });
  });

  it("omits structuredContent when not provided", () => {
    const result = toTextResult("hello");
    expect(result).not.toHaveProperty("structuredContent");
  });
});

describe("toErrorResult", () => {
  it("formats PostNLApiError with status and details", () => {
    const error = new PostNLApiError("Not found", 404, { code: "NOT_FOUND" });
    const result = toErrorResult(error);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("PostNL API error");
    expect(result.content[0].text).toContain("404");
    expect(result.content[0].text).toContain("NOT_FOUND");
  });

  it("formats PostNLApiError without details", () => {
    const error = new PostNLApiError("Bad request", 400);
    const result = toErrorResult(error);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("400");
    expect(result.content[0].text).not.toContain("Details:");
  });

  it("formats generic Error", () => {
    const result = toErrorResult(new Error("something broke"));

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("something broke");
  });

  it("formats non-Error values", () => {
    const result = toErrorResult("string error");

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("string error");
  });

  it("includes rate limit recovery suggestion for 429", () => {
    const error = new PostNLApiError("Rate limit exceeded", 429);
    const result = toErrorResult(error);

    expect(result.content[0].text).toContain("Recovery:");
    expect(result.content[0].text).toContain("Rate limit exceeded");
  });

  it("includes shipment not found recovery suggestion for 404 with shipment context", () => {
    const error = new PostNLApiError("Shipment not found", 404);
    const result = toErrorResult(error);

    expect(result.content[0].text).toContain("Recovery:");
    expect(result.content[0].text).toContain("generate_barcode");
  });

  it("includes barcode not found recovery suggestion for 404 with barcode context", () => {
    const error = new PostNLApiError("Barcode not found", 404);
    const result = toErrorResult(error);

    expect(result.content[0].text).toContain("Recovery:");
    expect(result.content[0].text).toContain("generate_barcode");
  });

  it("includes location not found recovery suggestion for 404 with location context", () => {
    const error = new PostNLApiError("Location not found", 404);
    const result = toErrorResult(error);

    expect(result.content[0].text).toContain("Recovery:");
    expect(result.content[0].text).toContain("find_locations");
  });

  it("includes generic 404 recovery suggestion for other not found errors", () => {
    const error = new PostNLApiError("Resource not found", 404);
    const result = toErrorResult(error);

    expect(result.content[0].text).toContain("Recovery:");
    expect(result.content[0].text).toContain("Verify the identifier");
  });

  it("includes auth recovery suggestion for 401", () => {
    const error = new PostNLApiError("Unauthorized", 401);
    const result = toErrorResult(error);

    expect(result.content[0].text).toContain("Recovery:");
    expect(result.content[0].text).toContain("POSTNL_API_KEY");
  });

  it("includes auth recovery suggestion for 403", () => {
    const error = new PostNLApiError("Forbidden", 403);
    const result = toErrorResult(error);

    expect(result.content[0].text).toContain("Recovery:");
    expect(result.content[0].text).toContain("POSTNL_API_KEY");
  });

  it("includes address validation recovery for 400 with address details", () => {
    const error = new PostNLApiError("Bad request", 400, "Invalid address provided");
    const result = toErrorResult(error);

    expect(result.content[0].text).toContain("Recovery:");
    expect(result.content[0].text).toContain("1234AB");
  });

  it("includes zipcode validation recovery for 400 with zipcode details", () => {
    const error = new PostNLApiError("Bad request", 400, "Invalid postalcode format");
    const result = toErrorResult(error);

    expect(result.content[0].text).toContain("Recovery:");
    expect(result.content[0].text).toContain("1234AB");
  });

  it("includes barcode validation recovery for 400 with barcode details", () => {
    const error = new PostNLApiError("Bad request", 400, "Invalid barcode format");
    const result = toErrorResult(error);

    expect(result.content[0].text).toContain("Recovery:");
    expect(result.content[0].text).toContain("generate_barcode");
  });

  it("includes product code recovery for 400 with product details", () => {
    const error = new PostNLApiError("Bad request", 400, "Invalid product code");
    const result = toErrorResult(error);

    expect(result.content[0].text).toContain("Recovery:");
    expect(result.content[0].text).toContain("3085");
  });

  it("includes generic 400 recovery for unspecific errors", () => {
    const error = new PostNLApiError("Bad request", 400);
    const result = toErrorResult(error);

    expect(result.content[0].text).toContain("Recovery:");
    expect(result.content[0].text).toContain("required parameters");
  });

  it("includes server error recovery suggestion for 500", () => {
    const error = new PostNLApiError("Internal server error", 500);
    const result = toErrorResult(error);

    expect(result.content[0].text).toContain("Recovery:");
    expect(result.content[0].text).toContain("temporary issue");
  });

  it("includes server error recovery suggestion for 503", () => {
    const error = new PostNLApiError("Service unavailable", 503);
    const result = toErrorResult(error);

    expect(result.content[0].text).toContain("Recovery:");
    expect(result.content[0].text).toContain("temporary issue");
  });

  it("returns no recovery suggestion for unrecognized status codes", () => {
    const error = new PostNLApiError("I'm a teapot", 418);
    const result = toErrorResult(error);

    expect(result.content[0].text).not.toContain("Recovery:");
  });

  it("handles details as object in 400 with address context", () => {
    const error = new PostNLApiError("Bad request", 400, { message: "Invalid zipcode" });
    const result = toErrorResult(error);

    expect(result.content[0].text).toContain("Recovery:");
    expect(result.content[0].text).toContain("1234AB");
  });
});
