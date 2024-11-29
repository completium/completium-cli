import fs from "fs";
import { execSync } from "child_process";
import { ConfigManager } from "./configManager";
import { Printer } from "../printer";
import { handleTezosError } from "../errorHandler";

/**
 * Manages interactions with the `tezos-client` binary.
 */
export class TezosClientManager {
  /**
   * Gets the configured path for the `tezos-client` binary.
   * Throws an error if the binary path is not configured.
   * @returns The path to the `tezos-client` binary.
   */
  public static getBinaryPath(): string {
    const binaries = ConfigManager.getBinaries();
    const binaryPath = binaries["tezos-client"];

    if (!binaryPath) {
      throw new Error("`tezos-client` binary path is not configured.");
    }

    return binaryPath;
  }

  /**
   * Executes a `tezos-client` command and returns the output.
   * @param args The arguments to pass to the `tezos-client` command.
   * @returns The standard output of the command.
   */
  public static executeCommand(args: string[]): string {
    const binaryPath = this.getBinaryPath();
    try {
      const result = execSync(`${binaryPath} ${args.join(" ")}`, {
        encoding: "utf-8",
        stdio: "pipe",
      });
      return result.trim();
    } catch (error) {
      const errorMessage = (error as Error).message;
      throw new Error(`Error executing \`tezos-client\`: ${errorMessage}`);
    }
  }

  /**
   * Checks if the `tezos-client` binary is accessible.
   * @returns `true` if the binary is accessible, `false` otherwise.
   */
  public static isBinaryAvailable(): boolean {
    try {
      this.executeCommand(["--version"]);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Gets the version of the `tezos-client` binary.
   * @returns The version string of the `tezos-client`.
   */
  public static getVersion(): string {
    return this.executeCommand(["--version"]);
  }

  /**
   * Initializes a mockup environment using `tezos-client`.
   * @param mockupDir The directory for the mockup environment.
   * @param options Optional parameters, including the protocol to use.
   */
  public static initializeMockup(mockupDir: string, protocol: string): void {
    if (fs.existsSync(mockupDir)) {
      fs.rmSync(mockupDir, { force: true, recursive: true });
      fs.mkdirSync(mockupDir);
    }

    Printer.print(`Initializing mockup environment with protocol '${protocol}' in ${mockupDir}...`);

    const args = ["--base-dir", mockupDir, "--protocol", protocol, "create", "mockup"];

    this.executeCommand(args);

    Printer.print("Mockup environment initialized successfully.");
  }

  /**
   * Sets the current block timestamp in the mockup environment.
   * @param mockupDir The directory for the mockup environment.
   * @param timestamp The desired timestamp (ISO 8601 or relative, e.g., `+1h`).
   */
  public static setMockupNow(mockupDir: string, timestamp: string): void {
    Printer.print(`Setting mockup timestamp to ${timestamp} in ${mockupDir}...`);
    this.executeCommand(["--base-dir", mockupDir, "set", "mockup", "now", timestamp]);
    Printer.print("Mockup timestamp updated successfully.");
  }

  /**
   * Gets the current block timestamp in the mockup environment.
   * @param mockupDir The directory for the mockup environment.
   * @returns The current mockup timestamp.
   */
  public static getMockupNow(mockupDir: string): string {
    Printer.print(`Fetching mockup timestamp from ${mockupDir}...`);
    const result = this.executeCommand(["--base-dir", mockupDir, "get", "mockup", "now"]);
    Printer.print(`Current mockup timestamp: ${result}`);
    return result;
  }

  /**
   * Lists mockup protocols using `tezos-client`.
   * @returns An array of protocol strings.
   */
  public static listMockupProtocols(): string[] {
    try {
      const output = this.executeCommand(["list", "mockup", "protocols"]);

      // Split the output into lines and filter out any empty lines
      const protocols = output.split("\n").filter((line) => line.trim() !== "");

      return protocols;
    } catch (error) {
      handleTezosError(error)
      return [];
    }
  }
}
