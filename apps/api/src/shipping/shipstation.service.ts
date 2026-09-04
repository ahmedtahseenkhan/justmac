import { Injectable, Logger } from "@nestjs/common";
import type { ShippingAddress } from "@sellme/shared";

/**
 * ShipStation API v2 client for inbound (customer → warehouse) prepaid labels.
 *
 *   POST {SHIPSTATION_API_URL}/v2/labels   header: api-key
 *
 * Config (env):
 *   SHIPSTATION_API_KEY        — from ShipStation → Settings → API Settings. When
 *                                unset the service returns a stub label so dev and
 *                                demo environments keep working without an account.
 *   SHIPSTATION_TEST           — "true" (default) buys free watermarked test labels;
 *                                set to "false" in production to buy real postage.
 *   SHIPSTATION_SERVICE_CODE   — carrier service, e.g. usps_ground_advantage.
 *   SHIPSTATION_CARRIER_ID     — optional; needed when the account has several
 *                                accounts for the same carrier.
 *   SHIPSTATION_WEIGHT_OZ      — declared package weight (default 16).
 *   SHIPSTATION_DIMS_IN        — optional box dimensions "LxWxH" in inches, e.g.
 *                                "16x16x10" — FedEx/UPS use dimensional pricing.
 *   SHIPSTATION_API_URL        — override for tests (default https://api.shipstation.com).
 *   WAREHOUSE_NAME/PHONE/STREET1/STREET2/CITY/STATE/ZIP — where customers ship to.
 */

export interface PurchasedLabel {
  labelUrl: string;
  trackingNumber: string | null;
  labelId: string | null;
  /** True when this came from the no-API-key stub, not a real purchase. */
  stub: boolean;
}

export class LabelPurchaseError extends Error {}

@Injectable()
export class ShipStationService {
  private readonly logger = new Logger(ShipStationService.name);

  get configured(): boolean {
    return !!process.env.SHIPSTATION_API_KEY;
  }

  /** Buy the prepaid inbound label: ship_from = customer, ship_to = warehouse. */
  async createInboundLabel(input: {
    trackingId: string;
    fullName: string;
    address: ShippingAddress;
  }): Promise<PurchasedLabel> {
    if (!this.configured) {
      this.logger.warn(`SHIPSTATION_API_KEY not set — issuing stub label for ${input.trackingId}`);
      return {
        labelUrl: `https://labels.sellme.local/${input.trackingId}.pdf`,
        trackingNumber: null,
        labelId: null,
        stub: true,
      };
    }

    const warehouse = this.warehouseAddress();
    const body = {
      shipment: {
        service_code: process.env.SHIPSTATION_SERVICE_CODE ?? "usps_ground_advantage",
        ...(process.env.SHIPSTATION_CARRIER_ID
          ? { carrier_id: process.env.SHIPSTATION_CARRIER_ID }
          : {}),
        ship_from: {
          name: input.fullName,
          phone: input.address.phone || warehouse.phone,
          address_line1: input.address.street1,
          ...(input.address.street2 ? { address_line2: input.address.street2 } : {}),
          city_locality: input.address.city,
          state_province: input.address.state.toUpperCase(),
          postal_code: input.address.postalCode,
          country_code: "US",
        },
        ship_to: warehouse.payload,
        packages: [
          {
            weight: {
              value: Number(process.env.SHIPSTATION_WEIGHT_OZ ?? 16),
              unit: "ounce",
            },
            ...(parseDims(process.env.SHIPSTATION_DIMS_IN) ?? {}),
          },
        ],
      },
      test_label: (process.env.SHIPSTATION_TEST ?? "true") !== "false",
      label_format: "pdf",
    };

    const base = process.env.SHIPSTATION_API_URL ?? "https://api.shipstation.com";
    let res: Response;
    try {
      res = await fetch(`${base}/v2/labels`, {
        method: "POST",
        headers: {
          "api-key": process.env.SHIPSTATION_API_KEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
      });
    } catch (e) {
      throw new LabelPurchaseError(
        `ShipStation unreachable: ${e instanceof Error ? e.message : e}`,
      );
    }

    const text = await res.text();
    if (!res.ok) {
      throw new LabelPurchaseError(`ShipStation ${res.status}: ${extractError(text)}`);
    }

    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      throw new LabelPurchaseError("ShipStation returned a non-JSON response");
    }
    const labelUrl = json?.label_download?.pdf ?? json?.label_download?.href;
    if (!labelUrl) throw new LabelPurchaseError("ShipStation response had no label URL");

    this.logger.log(
      `Label ${json.label_id} purchased for ${input.trackingId} (${json.tracking_number}${body.test_label ? ", TEST" : ""})`,
    );
    return {
      labelUrl,
      trackingNumber: json.tracking_number ?? null,
      labelId: json.label_id ?? null,
      stub: false,
    };
  }

  private warehouseAddress() {
    const env = process.env;
    const missing = ["WAREHOUSE_NAME", "WAREHOUSE_STREET1", "WAREHOUSE_CITY", "WAREHOUSE_STATE", "WAREHOUSE_ZIP"]
      .filter((k) => !env[k]);
    if (missing.length > 0) {
      throw new LabelPurchaseError(`Warehouse address not configured (missing ${missing.join(", ")})`);
    }
    return {
      phone: env.WAREHOUSE_PHONE ?? "0000000000",
      payload: {
        name: env.WAREHOUSE_NAME!,
        phone: env.WAREHOUSE_PHONE ?? "0000000000",
        address_line1: env.WAREHOUSE_STREET1!,
        ...(env.WAREHOUSE_STREET2 ? { address_line2: env.WAREHOUSE_STREET2 } : {}),
        city_locality: env.WAREHOUSE_CITY!,
        state_province: env.WAREHOUSE_STATE!,
        postal_code: env.WAREHOUSE_ZIP!,
        country_code: "US",
      },
    };
  }
}

/** "16x16x10" → ShipStation dimensions object; undefined when unset/invalid. */
function parseDims(raw: string | undefined) {
  if (!raw) return undefined;
  const m = raw.trim().match(/^(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)$/i);
  if (!m) return undefined;
  return {
    dimensions: { length: Number(m[1]), width: Number(m[2]), height: Number(m[3]), unit: "inch" },
  };
}

/** Pull the human-readable message(s) out of a ShipStation error body. */
function extractError(text: string): string {
  try {
    const parsed = JSON.parse(text);
    const msgs = (parsed?.errors ?? [])
      .map((e: any) => e?.message)
      .filter(Boolean);
    if (msgs.length > 0) return msgs.join("; ");
    if (parsed?.message) return parsed.message;
  } catch {
    /* fall through to raw text */
  }
  return text.slice(0, 300);
}
