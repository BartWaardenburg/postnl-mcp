import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { PostNLClient } from "../postnl-client.js";
import { toTextResult, toErrorResult } from "../tool-result.js";
import type { PostNLShipmentBody, PostNLAddress, PostNLContact, PostNLDimension, PostNLProductOption, PostNLCustoms, PostNLCustomsContent } from "../types.js";

const addressSchema = z.object({
  AddressType: z.string().describe("Address type: 01 = receiver, 02 = sender, 09 = delivery address (for pickup points)"),
  City: z.string().describe("City name"),
  CompanyName: z.string().optional().describe("Company name"),
  Countrycode: z.string().length(2).describe("ISO 3166-1 alpha-2 country code (e.g. NL, BE, DE)"),
  HouseNr: z.string().describe("House number"),
  HouseNrExt: z.string().optional().describe("House number extension (e.g. 'A', 'bis')"),
  Street: z.string().describe("Street name"),
  Zipcode: z.string().describe("Postal code (Dutch format: 1234AB)"),
  FirstName: z.string().optional().describe("First name of the recipient"),
  Name: z.string().optional().describe("Last name or full name of the recipient"),
});

const contactSchema = z.object({
  ContactType: z.string().describe("Contact type: 01 = receiver"),
  Email: z.string().optional().describe("Email address for notifications"),
  SMSNr: z.string().optional().describe("Phone number for SMS notifications"),
  TelNr: z.string().optional().describe("Phone number"),
});

const dimensionSchema = z.object({
  Height: z.number().optional().describe("Height in mm"),
  Length: z.number().optional().describe("Length in mm"),
  Volume: z.number().optional().describe("Volume in cm3"),
  Weight: z.number().optional().describe("Weight in grams"),
  Width: z.number().optional().describe("Width in mm"),
});

const productOptionSchema = z.object({
  Characteristic: z.string().describe("Option characteristic code"),
  Option: z.string().describe("Option value code"),
});

const customsContentSchema = z.object({
  Description: z.string().describe("Description of the content"),
  Quantity: z.number().int().describe("Number of items"),
  Weight: z.number().describe("Weight in grams"),
  Value: z.number().describe("Value in cents"),
  HSTariffNr: z.string().optional().describe("HS tariff number"),
  CountryOfOrigin: z.string().optional().describe("Country of origin (ISO 3166-1 alpha-2)"),
});

const customsSchema = z.object({
  Certificate: z.boolean().optional().describe("Certificate enclosed"),
  CertificateNr: z.string().optional().describe("Certificate number"),
  Currency: z.string().optional().describe("Currency code (e.g. EUR)"),
  HandleAsNonDeliverable: z.boolean().optional().describe("Return to sender if undeliverable"),
  Invoice: z.boolean().optional().describe("Invoice enclosed"),
  InvoiceNr: z.string().optional().describe("Invoice number"),
  License: z.boolean().optional().describe("License enclosed"),
  LicenseNr: z.string().optional().describe("License number"),
  ShipmentType: z.string().optional().describe("Shipment type: Gift, Documents, Commercial Goods, Commercial Sample, Returned Goods"),
  Content: z.array(customsContentSchema).optional().describe("Customs content items"),
});

export const registerShippingTools = (
  server: McpServer,
  client: PostNLClient,
  customerCode: string,
  customerNumber: string,
): void => {
  server.registerTool(
    "generate_barcode",
    {
      title: "Generate Barcode",
      description:
        "Generate a PostNL barcode for shipping. The barcode is required before creating a shipment. " +
        "Types: 3S (domestic NL parcels), 3SDEPA (evening/Sunday delivery), LA (EU parcels), " +
        "RI (registered international), UE (non-EU parcels).",
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },

      inputSchema: z.object({
        type: z.enum(["3S", "3SDEPA", "LA", "RI", "UE"]).default("3S").describe("Barcode type. 3S = domestic, LA = EU, RI = registered international, UE = non-EU"),
        serie: z.string().default("000000000-999999999").describe("Barcode serie range"),
        range: z.string().optional().describe("Customer code override (defaults to env POSTNL_CUSTOMER_CODE)"),
      }),
    },
    async ({ type, serie, range }) => {
      try {
        const result = await client.generateBarcode(
          range ?? customerCode,
          customerNumber,
          type,
          serie,
        );

        return toTextResult(
          `Generated barcode: ${result.Barcode}`,
          { barcode: result.Barcode },
        );
      } catch (error) {
        return toErrorResult(error);
      }
    },
  );

  server.registerTool(
    "create_shipment",
    {
      title: "Create Shipment",
      description:
        "Create a PostNL shipment and generate a shipping label. Requires a barcode (use generate_barcode first), " +
        "sender address (AddressType 02), and receiver address (AddressType 01). Returns a PDF label as base64. " +
        "Common product codes: 3085 (standard), 3385 (evening delivery), 3090 (PostNL pickup point), " +
        "3087 (extra@home), 3089 (signature on delivery). " +
        "WARNING: Creating a shipment incurs shipping costs. Always confirm with the user before calling this tool.",
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },

      inputSchema: z.object({
        barcode: z.string().describe("The barcode for this shipment (use generate_barcode to create one)"),
        addresses: z.array(addressSchema).min(1).describe("Array of addresses. Must include sender (AddressType 02) and receiver (AddressType 01)"),
        productCodeDelivery: z.string().default("3085").describe("Product code: 3085 (standard), 3385 (evening), 3090 (pickup), 3087 (extra@home), 3089 (signature)"),
        contacts: z.array(contactSchema).optional().describe("Contact information for notifications"),
        dimension: dimensionSchema.optional().describe("Package dimensions"),
        productOptions: z.array(productOptionSchema).optional().describe("Additional product options"),
        reference: z.string().optional().describe("Your reference for this shipment"),
        remark: z.string().optional().describe("Remark for the shipment"),
        deliveryDate: z.string().optional().describe("Requested delivery date (format: dd-MM-yyyy HH:mm:ss)"),
        customs: customsSchema.optional().describe("Customs information (required for international shipments)"),
        printerType: z.enum(["GraphicFile|PDF", "GraphicFile|GIF", "GraphicFile|JPG", "GraphicFile|ZPL"]).default("GraphicFile|PDF").describe("Label output format"),
        confirm: z.boolean().default(true).describe("Confirm the shipment immediately (true) or save as concept (false)"),
      }),
    },
    async ({
      barcode,
      addresses,
      productCodeDelivery,
      contacts,
      dimension,
      productOptions,
      reference,
      remark,
      deliveryDate,
      customs,
      printerType,
      confirm,
    }) => {
      try {
        const now = new Date();
        const messageTimestamp = `${String(now.getDate()).padStart(2, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

        const senderAddress = addresses.find((a) => a.AddressType === "02");

        const body: PostNLShipmentBody = {
          Customer: {
            Address: senderAddress as PostNLAddress | undefined,
            CustomerCode: customerCode,
            CustomerNumber: customerNumber,
          },
          Message: {
            MessageID: crypto.randomUUID(),
            MessageTimeStamp: messageTimestamp,
            Printertype: printerType,
          },
          Shipments: [
            {
              Addresses: addresses as PostNLAddress[],
              Barcode: barcode,
              Contacts: contacts as PostNLContact[] | undefined,
              Dimension: dimension as PostNLDimension | undefined,
              ProductCodeDelivery: productCodeDelivery,
              ProductOptions: productOptions as PostNLProductOption[] | undefined,
              Reference: reference,
              Remark: remark,
              DeliveryDate: deliveryDate,
              Customs: customs as PostNLCustoms | undefined,
            },
          ],
        };

        const result = await client.createShipment(body, confirm);

        const shipment = result.ResponseShipments?.[0];
        const errors = shipment?.Errors ?? [];
        const warnings = shipment?.Warnings ?? [];
        const hasLabel = (shipment?.Labels?.length ?? 0) > 0;

        const lines: string[] = [];

        if (errors.length > 0) {
          lines.push("Errors:");
          for (const err of errors) {
            lines.push(`  - [${err.Code}] ${err.Description}`);
          }
        } else {
          lines.push(`Shipment created successfully`);
          lines.push(`Barcode: ${shipment?.Barcode ?? barcode}`);
          lines.push(`Product: ${shipment?.ProductCodeDelivery ?? productCodeDelivery}`);

          if (hasLabel) {
            lines.push(`Label format: ${printerType}`);
            lines.push(`Label content included as base64 in structured data`);
          }
        }

        if (warnings.length > 0) {
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
