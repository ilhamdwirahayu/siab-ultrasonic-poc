import { z } from "zod";
import type { AntaresContent } from "@/types/telemetry";

const uplinkSchema = z.object({
  type: z.literal("uplink"),
  port: z.number().int().min(0).max(255),
  data: z.string().regex(/^(?:[0-9a-fA-F]{2})+$/),
  counter: z.number().int().optional(),
  devEui: z.string().regex(/^[0-9a-fA-F]{16}$/),
  radio: z
    .object({
      gps_time: z.string().datetime({ offset: true }).optional(),
      freq: z.number().optional(),
      datarate: z.number().optional(),
      hardware: z.object({ snr: z.number().optional(), rssi: z.number().optional() }).optional(),
      modulation: z.object({ spreading: z.number().optional() }).optional(),
    })
    .optional(),
});

const envelopeSchema = z.object({
  "m2m:cin": z.object({
    con: z.union([z.string(), z.record(z.string(), z.unknown())]),
    ri: z.string().optional(),
    ct: z.string().optional(),
  }),
});

export class AntaresParsingError extends Error {
  constructor() {
    super("ANTARES response parsing failed: m2m:cin.con must contain a valid uplink.");
    this.name = "AntaresParsingError";
  }
}

export function parseAntaresTimestamp(value: string | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  const date = new Date(Date.UTC(+year, +month - 1, +day, +hour, +minute, +second));
  if (
    date.getUTCFullYear() !== +year ||
    date.getUTCMonth() !== +month - 1 ||
    date.getUTCDate() !== +day ||
    date.getUTCHours() !== +hour ||
    date.getUTCMinutes() !== +minute ||
    date.getUTCSeconds() !== +second
  ) return null;
  return date.toISOString();
}

export function getAntaresReadingTimestamp(createdAt: string | null, radioGpsTime: string | undefined): string {
  const timestamp = radioGpsTime ?? createdAt;
  if (!timestamp || Number.isNaN(Date.parse(timestamp))) {
    throw new Error("ANTARES reading has no valid creation or radio timestamp.");
  }
  return timestamp;
}

export function normalizeAntaresEnvelope(response: unknown): {
  content: AntaresContent;
  resourceId: string | null;
  createdAt: string | null;
  rawResponse: unknown;
} {
  try {
    const outer = envelopeSchema.parse(response);
    const content = outer["m2m:cin"].con;
    const parsedContent = typeof content === "string" ? JSON.parse(content) as unknown : content;
    return {
      content: uplinkSchema.parse(parsedContent),
      resourceId: outer["m2m:cin"].ri ?? null,
      createdAt: parseAntaresTimestamp(outer["m2m:cin"].ct),
      rawResponse: response,
    };
  } catch {
    throw new AntaresParsingError();
  }
}

export function normalizeAntaresLatest(response: unknown): AntaresContent {
  return normalizeAntaresEnvelope(response).content;
}
