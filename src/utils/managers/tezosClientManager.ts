import fs from "fs";
import path from "path";
import { ConfigManager } from "./configManager";
import { Printer } from "../printer";
import { handleTezosError } from "../errorHandler";
import { exec, ExecResult } from "../tools";

/**
 * Manages interactions with the `tezos-client` binary.
 */
export class TezosClientManager {

  private static async callTezosClientInteral(args: string[], mode: 'mockup' | 'rpc' | 'none'): Promise<ExecResult> {
    let execArgs: string[] = [];
    switch (mode) {
      case "mockup":
        const mockupDir = ConfigManager.getMockupDir();
        execArgs = ["--mode", "mockup", "--base-dir", mockupDir].concat(args);
        break;
      case "rpc":
        const tezos_endpoint = ConfigManager.getEndpoint();
        execArgs = ["--endpoint", tezos_endpoint].concat(args);
        break;
      case "none":
        break;
    }
    try {
      const binaryPath = ConfigManager.getBinOctezClient();
      const execResult = await exec(binaryPath, execArgs);
      return execResult
    } catch (e) {
      throw e
      // return e;
    }
  }

  public static async callTezosClient(args: string[]) : Promise<ExecResult> {
    const mode = ConfigManager.isMockupMode() ? 'mockup' : 'rpc';
    return await this.callTezosClientInteral(args, mode);
  }

  public static async callDryTezosClient(args: string[]) : Promise<ExecResult> {
    return await this.callTezosClientInteral(args, "none");
  }

  /**
   * Checks if the `tezos-client` binary is accessible.
   * @returns `true` if the binary is accessible, `false` otherwise.
   */
  public static isBinaryAvailable(): boolean {
    try {
      this.callDryTezosClient(["--version"]);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Gets the version of the `tezos-client` binary.
   * @returns The version string of the `tezos-client`.
   */
  public static async getVersion(): Promise<string> {
    const res = await this.callDryTezosClient(["--version"]);
    return res.stdout;
  }

  /**
   * Initializes a mockup environment using `tezos-client`.
   * @param mockupDir The directory for the mockup environment.
   * @param options Optional parameters, including the protocol to use.
   */
  public static async initializeMockup(mockupDir: string, protocol: string): Promise<void> {
    if (fs.existsSync(mockupDir)) {
      fs.rmSync(mockupDir, { force: true, recursive: true });
      fs.mkdirSync(mockupDir);
    }

    Printer.print(`Initializing mockup environment with protocol '${protocol}' in ${mockupDir}...`);

    const args = ["--base-dir", mockupDir, "--protocol", protocol, "create", "mockup"];

    await this.callDryTezosClient(args);

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
  public static async listMockupProtocols(): Promise<string[]> {
    try {
      const res = await this.callDryTezosClient(["list", "mockup", "protocols"]);
      const output = res.stdout;

      // Split the output into lines and filter out any empty lines
      const protocols = output.split("\n").filter((line) => line.trim() !== "");

      return protocols;
    } catch (error) {
      handleTezosError(error)
      return [];
    }
  }
}
