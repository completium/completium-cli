import fs from "fs";
import path from "path";

export class MockupManager {
  private static readonly mockupContextPath = path.resolve(
    process.env.HOME || "",
    ".completium/mockup/mockup/context.json"
  );

  /**
   * Retrieves the current mockup timestamp incremented by 1 second.
   * @returns The updated Date object.
   */
  public static getMockupNow(): Date {
    if (!fs.existsSync(this.mockupContextPath)) {
      throw new Error("Mockup context file not found.");
    }

    const input = JSON.parse(fs.readFileSync(this.mockupContextPath, "utf8"));
    const timestamp = input?.context?.shell_header?.timestamp;

    if (!timestamp) {
      throw new Error("Timestamp not found in mockup context.");
    }

    const date = new Date(timestamp);
    date.setSeconds(date.getSeconds() + 1);
    return date;
  }

  /**
   * Retrieves the current mockup level.
   * @returns The mockup level as a number.
   */
  public static getMockupLevel(): number {
    if (!fs.existsSync(this.mockupContextPath)) {
      throw new Error("Mockup context file not found.");
    }

    const input = JSON.parse(fs.readFileSync(this.mockupContextPath, "utf8"));
    const level = input?.context?.shell_header?.level;

    if (typeof level !== "number") {
      throw new Error("Level not found or invalid in mockup context.");
    }

    return level;
  }
}
