import { execSync } from "child_process";
import { Printer } from "../printer";
import { ConfigManager } from "./configManager";

/**
 * Manages interactions with the Archetype binary.
 */
export class ArchetypeManager {
  /**
   * Returns the configured path to the Archetype binary.
   * Falls back to the default path if not explicitly set.
   */
  public static getBinaryPath(): string {
    const binaries = ConfigManager.getBinaries();
    return binaries.archetype || "archetype";
  }

  /**
   * Checks if the Archetype binary is available in the system.
   * Throws an error if the binary is not found or not executable.
   */
  public static checkAvailability(): void {
    try {
      execSync(`${this.getBinaryPath()} --help`, { stdio: "ignore" });
    } catch {
      throw new Error(
        "Archetype binary not found or not executable. Please ensure it is installed and properly configured."
      );
    }
  }

  /**
   * Retrieves the version of the Archetype binary.
   * Throws an error if the version cannot be determined.
   * @returns The version of the Archetype binary as a string.
   */
  public static getVersion(): string {
    try {
      const output = execSync(`${this.getBinaryPath()} --version`, { encoding: "utf-8" });
      return output.trim();
    } catch {
      throw new Error("Unable to determine Archetype version. Ensure the binary is available.");
    }
  }

  /**
   * Executes a command using the Archetype binary.
   * Throws an error if the command execution fails.
   * @param args An array of arguments to pass to the Archetype binary.
   * @returns The stdout of the command execution.
   */
  public static executeCommand(args: string[]): string {
    try {
      const command = `${this.getBinaryPath()} ${args.join(" ")}`;
      const output = execSync(command, { encoding: "utf-8" });
      return output.trim();
    } catch (error) {
      throw new Error(
        `Failed to execute Archetype command: ${args.join(" ")}\n${(error as Error).message}`
      );
    }
  }

  /**
   * Validates if a given file is a valid Archetype contract.
   * @param filePath The path to the Archetype contract file.
   * @returns A boolean indicating whether the file is valid.
   */
  public static validateContract(filePath: string): boolean {
    try {
      this.executeCommand(["--check", filePath]);
      return true;
    } catch {
      return false;
    }
  }
}
