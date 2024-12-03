import fs from "fs";
import path from "path";
import { Config } from "../types/configuration";

export class ConfigManager {
  private static readonly configPath = path.resolve(
    process.env.HOME || "",
    ".completium/config.json"
  );

  /**
   * Checks if the configuration file exists.
   * @returns True if the configuration file exists, otherwise false.
   */
  public static configExists(): boolean {
    return fs.existsSync(this.configPath);
  }

  /**
   * Creates a new configuration file with the provided default values.
   * If the parent directory does not exist, it is created.
   * @param config The default configuration to write to the file.
   */
  public static createConfig(config: Config): void {
    const configDir = path.dirname(ConfigManager.configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(ConfigManager.configPath, JSON.stringify(config, null, 2), "utf-8");
  }

  /**
   * Loads the configuration from the file system.
   * Throws an error if the configuration file does not exist.
   */
  private static loadConfig(): Config {
    if (fs.existsSync(ConfigManager.configPath)) {
      const rawData = fs.readFileSync(ConfigManager.configPath, "utf-8");
      return JSON.parse(rawData) as Config;
    } else {
      throw new Error("Configuration file not found. Please run `completium-cli init`.");
    }
  }

  /**
   * Saves the configuration to the file system.
   */
  private static saveConfig(config: Config): void {
    const configDir = path.dirname(ConfigManager.configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(ConfigManager.configPath, JSON.stringify(config, null, 2), "utf-8");
  }

  /**
   * Updates the configuration with the provided values and saves it.
   * @param updatedConfig The new configuration values to merge with the existing configuration.
   */
  public static updateConfig(updatedConfig: Partial<Config>): void {
    const config = { ...this.loadConfig(), ...updatedConfig };
    this.saveConfig(config);
  }

  /**
   * Retrieves the current configuration.
   */
  public static getConfig(): Config {
    return this.loadConfig();
  }

  /**
   * Retrieves the default account from the configuration.
   */
  public static getDefaultAccount(): string {
    return this.getConfig().account;
  }

  /**
   * Retrieves the mode for Archetype from the configuration.
   * @returns The mode for Archetype (e.g., "js", "docker", or "binary").
   */
  public static getModeArchetype(): Config["mode"]["archetype"] {
    return this.getConfig().mode.archetype;
  }

  /**
   * Retrieves the binary path for Archetype from the configuration.
   * @returns The path to the Archetype binary.
   */
  public static getBinArchetype(): string {
    return this.getConfig().bin.archetype;
  }

  /**
   * Retrieves the binary path for Octez Client (tezos-client) from the configuration.
   * @returns The path to the Octez Client binary.
   */
  public static getBinOctezClient(): string {
    return this.getConfig().bin["tezos-client"];
  }

  /**
   * Checks if the `force_tezos_client` option is enabled in the configuration.
   * @returns `true` if `force_tezos_client` is enabled, otherwise `false`.
   */
  public static isForceOctezClient(): boolean {
    return this.getConfig().tezos.force_tezos_client;
  }

  /**
   * Retrieves the current Tezos endpoint from the configuration.
   * @returns The current Tezos RPC endpoint.
   */
  public static getEndpoint(): string {
    return this.getConfig().tezos.endpoint;
  }

  /**
   * Retrieves the current Tezos network name from the configuration.
   * @returns The name of the active Tezos network.
   */
  public static getNetwork(): string {
    return this.getConfig().tezos.network;
  }

  /**
   * Checks if the current mode is set to "mockup".
   * @returns `true` if the endpoint is "mockup", otherwise `false`.
   */
  public static isMockupMode(): boolean {
    return this.getEndpoint() === "mockup";
  }

  public static isOctezClientConfig() {
    return this.isMockupMode() || this.isForceOctezClient();
  }

  /**
   * Switches the current Tezos network and updates the active endpoint.
   */
  public static switchTezosNetwork(network: string): void {
    const config = this.loadConfig();
    const target = config.tezos.list.find((net) => net.network === network);
    if (!target) {
      throw new Error(`Network ${network} not found in configuration.`);
    }
    config.tezos.network = target.network;
    config.tezos.endpoint = target.endpoints[0];
    this.saveConfig(config);
  }

  /**
 * Gets the path for the mockup directory.
 * Ensures the directory exists.
 * @returns The path to the mockup directory.
 */
  public static getMockupDir(): string {
    const homeDir = process.env.HOME || ".";
    const mockupDir = path.join(homeDir, ".completium", "mockup");
    return mockupDir;
  }

}
