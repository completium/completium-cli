import fs from "fs";
import path from "path";
import { Printer } from "../printer";

export interface MockupConfig {
  event_well: string;
  sandbox_exec: string;
}

export class MockupConfigManager {
  private static readonly configPath = path.resolve(
    process.env.HOME || "",
    ".completium/mockup.conf.json"
  );

  /**
   * Checks if the mockup configuration file exists.
   * @returns True if the file exists, otherwise false.
   */
  public static configExists(): boolean {
    return fs.existsSync(this.configPath);
  }

  /**
   * Loads the mockup configuration from the file system.
   * If the file does not exist, it throws an error.
   * @returns The loaded mockup configuration.
   */
  public static loadConfig(): MockupConfig {
    if (!this.configExists()) {
      throw new Error("Mockup configuration file not found. Please initialize it.");
    }

    const rawData = fs.readFileSync(this.configPath, "utf-8");
    return JSON.parse(rawData) as MockupConfig;
  }

  /**
   * Saves the mockup configuration to the file system.
   * @param config The mockup configuration to save.
   */
  public static saveConfig(config: MockupConfig): void {
    const configDir = path.dirname(this.configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), "utf-8");
    Printer.print("Mockup configuration saved successfully.");
  }

  /**
   * Gets the current `event_well` address from the configuration.
   * @returns The `event_well` value.
   */
  public static getEventWell(): string {
    const config = this.loadConfig();
    return config.event_well;
  }

  /**
   * Sets the `event_well` address in the configuration.
   * @param address The new `event_well` address.
   */
  public static setEventWell(address: string): void {
    const config = this.loadConfig();
    config.event_well = address;
    this.saveConfig(config);
    Printer.print(`Updated 'event_well' address to '${address}'.`);
  }

  /**
   * Gets the current `sandbox_exec` address from the configuration.
   * @returns The `sandbox_exec` value.
   */
  public static getSandboxExec(): string {
    const config = this.loadConfig();
    return config.sandbox_exec;
  }

  /**
   * Sets the `sandbox_exec` address in the configuration.
   * @param address The new `sandbox_exec` address.
   */
  public static setSandboxExec(address: string): void {
    const config = this.loadConfig();
    config.sandbox_exec = address;
    this.saveConfig(config);
    Printer.print(`Updated 'sandbox_exec' address to '${address}'.`);
  }

  /**
   * Initializes a new mockup configuration file with default values.
   * If the file already exists, it does nothing.
   * @param defaultConfig Optional default configuration.
   */
  public static initializeConfig(defaultConfig?: Partial<MockupConfig>): void {
    if (this.configExists()) {
      Printer.print("Mockup configuration already exists. Skipping initialization.");
      return;
    }

    const initialConfig: MockupConfig = {
      event_well: defaultConfig?.event_well ?? "KT1DefaultEventWellAddress",
      sandbox_exec: defaultConfig?.sandbox_exec ?? "KT1DefaultSandboxExecAddress",
    };

    this.saveConfig(initialConfig);
    Printer.print("Mockup configuration initialized successfully.");
  }
}
