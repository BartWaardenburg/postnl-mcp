import { PostNLApiError } from "./postnl-client.js";

export const toTextResult = (
  text: string,
  structuredContent?: Record<string, unknown>,
) => ({
  content: [{ type: "text" as const, text }],
  ...(structuredContent ? { structuredContent } : {}),
});

const getRecoverySuggestion = (status: number, message: string, details: unknown): string | null => {
  if (status === 429) {
    return "Rate limit exceeded. Wait a moment and retry the operation, or reduce the frequency of API calls.";
  }

  if (status === 404) {
    const lower = message.toLowerCase();
    if (lower.includes("shipment") || lower.includes("barcode")) {
      return "Shipment not found. Verify the barcode is correct. Use generate_barcode to create a new barcode before creating a shipment.";
    }
    if (lower.includes("location")) {
      return "Location not found. Verify the location code is correct. Use find_locations to search for nearby PostNL locations.";
    }
    return "Resource not found. Verify the identifier is correct and the resource exists.";
  }

  if (status === 401 || status === 403) {
    return "Authentication failed. Verify that the POSTNL_API_KEY environment variable is set correctly and the API key has not expired.";
  }

  if (status === 400) {
    const detailStr = typeof details === "string" ? details : JSON.stringify(details ?? "");
    const lower = detailStr.toLowerCase();
    if (lower.includes("address") || lower.includes("zipcode") || lower.includes("postalcode")) {
      return "Invalid address. Dutch postal codes use the format '1234AB' (4 digits + 2 letters, no space). Ensure Street, HouseNr, Zipcode, and City are all provided.";
    }
    if (lower.includes("barcode")) {
      return "Invalid barcode. Ensure the barcode was generated via generate_barcode and matches the shipment type (3S for domestic, LA/RI/UE for international).";
    }
    if (lower.includes("product")) {
      return "Invalid product code. Common codes: 3085 (standard), 3385 (evening delivery), 3090 (pickup point), 3087 (extra@home). Verify the code matches the delivery type.";
    }
    return "Invalid request. Check that all required parameters are provided and in the correct format. Refer to the PostNL API documentation for field requirements.";
  }

  if (status >= 500) {
    return "PostNL API server error. This is a temporary issue on PostNL's end. Wait a moment and retry the operation.";
  }

  return null;
};

export const toErrorResult = (error: unknown) => {
  if (error instanceof PostNLApiError) {
    const suggestion = getRecoverySuggestion(error.status, error.message, error.details);

    return {
      content: [
        {
          type: "text" as const,
          text: [
            `PostNL API error: ${error.message}`,
            `Status: ${error.status}`,
            error.details ? `Details: ${JSON.stringify(error.details, null, 2)}` : "",
            suggestion ? `\nRecovery: ${suggestion}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
      isError: true,
    };
  }

  return {
    content: [
      {
        type: "text" as const,
        text: error instanceof Error ? error.message : String(error),
      },
    ],
    isError: true,
  };
};
