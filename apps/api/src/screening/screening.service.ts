import { Injectable } from "@nestjs/common";
import type { ScreeningResult } from "@sellme/shared";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Eligibility & fraud screening run at intake.
 *
 * The lock/blacklist lookups are deterministic stubs so the flow is testable without
 * a real IMEI provider — drive them with serial prefixes:
 *   LCK… → activation lock   MDM… → MDM lock   BLK… → blacklisted   MIS… → model mismatch
 * Anything else screens CLEAR. Swap `lookup()` for a GSMA/CheckMEND provider in prod.
 */
@Injectable()
export class ScreeningService {
  constructor(private readonly prisma: PrismaService) {}

  async screen(args: {
    serial: string;
    imei?: string;
    declaredModelName: string;
  }): Promise<ScreeningResult> {
    const serial = args.serial.trim().toUpperCase();
    const lock = this.lockStatus(serial, args.imei);
    const blacklist = serial.startsWith("BLK") ? "BLACKLISTED" : "CLEAR";
    const mismatch = serial.startsWith("MIS");

    // Velocity: this serial already attached to another device = re-submission/abuse.
    const priorCount = await this.prisma.device.count({ where: { serial } });
    const velocity = priorCount > 0;

    const eligible = lock === "CLEAR" && blacklist === "CLEAR" && !mismatch;

    const flags: string[] = [];
    if (lock === "ACTIVATION_LOCK") flags.push("Activation Lock (iCloud) is still on — must be removed before payout.");
    if (lock === "MDM_LOCK") flags.push("Device is MDM/DEP enrolled — must be released by the owner.");
    if (blacklist === "BLACKLISTED") flags.push("Carrier blacklist / reported lost or stolen.");
    if (mismatch) flags.push(`Serial does not match the declared model (${args.declaredModelName}).`);
    if (velocity) flags.push("This serial was submitted before (velocity flag).");

    return { lockStatus: lock, blacklistStatus: blacklist, mismatch, velocity, eligible, flags };
  }

  private lockStatus(serial: string, imei?: string): ScreeningResult["lockStatus"] {
    if (serial.startsWith("LCK") || (imei ?? "").startsWith("99")) return "ACTIVATION_LOCK";
    if (serial.startsWith("MDM")) return "MDM_LOCK";
    return "CLEAR";
  }
}
