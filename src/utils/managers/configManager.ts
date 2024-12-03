import fs from "fs";
import path from "path";
import { Config } from "../types/configuration";
import { handleError } from "../errorHandler";
import { Printer } from "../printer";

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

  // public static findNetwork(network: string): Config['tezos']['list'][number] {
  //   const config = this.loadConfig();
  //   const target = config.tezos.list.find((net) => net.network === network);
  //   if (!target) {
  //     throw new Error(`Network ${network} not found in configuration.`);
  //   }
  //   return target
  // }

  // public static getNetworks(): string[] {
  //   const config = this.loadConfig();

  //   const networks = config.tezos.list.map(x => x.network);
  //   return networks
  // }


  public static showEndpoint() {
    Printer.print(`Current network: ${ConfigManager.getNetwork()}`);
    Printer.print(`Current endpoint: ${ConfigManager.getEndpoint()}`);
  }

  /**
 * Sets the Tezos endpoint in the configuration.
 * Updates the current network and endpoint based on the provided value.
 * Throws an error if the endpoint is not found in any network.
 * @param endpoint The endpoint URL to set as the default.
 */
  public static setEndpoint(endpoint: string): void {
    const config = this.getConfig();

    // Search for the network containing the specified endpoint
    const targetNetwork = config.tezos.list.find((network) =>
      network.endpoints.includes(endpoint)
    );

    if (!targetNetwork) {
      throw new Error(`Endpoint '${endpoint}' is not found in any configured network.`);
    }

    // Update the default network and endpoint
    config.tezos.network = targetNetwork.network;
    config.tezos.endpoint = endpoint;

    // Save the updated configuration
    this.saveConfig(config);

    // Print a success message
    Printer.print(`Endpoint '${endpoint}' set for network '${targetNetwork.network}'.`);
  }

  /**
   * Updates the configuration for a specific network by adding a new endpoint.
   * If the endpoint already exists, no changes are made.
   * @param network The name of the network to update.
   * @param endpoint The new endpoint to add.
   */
  public static addEndpoint(network: string, endpoint: string): void {
    const config = this.loadConfig();

    // Find the network in the configuration
    const targetNetwork = config.tezos.list.find((net) => net.network === network);

    if (!targetNetwork) {
      return handleError(`Network '${network}' not found in configuration.`);
    }

    // Check if the endpoint already exists
    if (!targetNetwork.endpoints.includes(endpoint)) {
      targetNetwork.endpoints.push(endpoint);
      this.saveConfig(config);
      Printer.print(`Successfully added endpoint '${endpoint}' to network '${network}'.`);
    } else {
      return handleError(`Endpoint '${endpoint}' already exists for network '${network}'.`);
    }
  }

  /**
   * Removes a specified endpoint from all networks in the configuration.
   * If the endpoint is the current default endpoint, an error message is printed, and no changes are made.
   * @param endpoint The endpoint to remove.
   */
  public static removeEndpoint(endpoint: string): void {
    const config = this.loadConfig();

    // Check if the endpoint is the current default
    if (config.tezos.endpoint === endpoint) {
      Printer.print(
        `Cannot remove endpoint '${endpoint}' because it is currently set as the default endpoint. Switch to another endpoint before removing.`
      );
      return;
    }

    // Iterate over all networks to remove the endpoint
    let found = false;
    config.tezos.list.forEach((network) => {
      const initialLength = network.endpoints.length;
      network.endpoints = network.endpoints.filter((ep) => ep !== endpoint);

      if (network.endpoints.length < initialLength) {
        found = true;
        Printer.print(
          `Removed endpoint '${endpoint}' from network '${network.network}'.`
        );
      }
    });

    if (!found) {
      Printer.print(`Endpoint '${endpoint}' not found in any network.`);
      return;
    }

    // Save the updated configuration
    this.saveConfig(config);
  }

}
