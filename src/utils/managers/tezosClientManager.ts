import fs from "fs";
import path from "path";
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
  public static setMockupNow(mockupDir: string, isoTimestamp: string): void {
    const contextPath = path.join(mockupDir, "mockup", "context.json");

    if (!fs.existsSync(contextPath)) {
      throw new Error(`Mockup context file not found at ${contextPath}.`);
    }
  
    // Update the timestamp in the context file
    const context = JSON.parse(fs.readFileSync(contextPath, "utf-8"));
    context.context.shell_header.timestamp = isoTimestamp;
  
    // Save the updated context back to the file
    fs.writeFileSync(contextPath, JSON.stringify(context, null, 2), "utf-8");
  
    Printer.print(`Set mockup now to: ${isoTimestamp}`);
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
