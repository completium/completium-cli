import { ConfigManager } from "../utils/managers/configManager";
import { Printer } from "../utils/printer";

/**
 * Allows the user to switch the active Tezos endpoint.
 * Displays a list of all available endpoints and updates the configuration
 * based on the user's selection using ConfigManager.setEndpoint.
 */
export async function switchEndpoint(): Promise<void> {
  try {
    // Retrieve the current configuration and network list
    const config = ConfigManager.getConfig();
    const networks = config.tezos.list;

    // Create a map to store endpoint values and corresponding display names
    const endpointMap = new Map<string, string>();

    // Prepare choices for the selection prompt
    const choices = networks.flatMap((network) =>
      network.endpoints.map((endpoint) => {
        const displayName = `${network.network.padEnd(10)} ${endpoint}`;
        endpointMap.set(displayName, endpoint); // Map the display name to the endpoint
        return displayName; // Use displayName for the prompt
      })
    );

    const { Select } = require("enquirer");

    // Display the selection prompt
    const prompt = new Select({
      name: "endpoint",
      message: "Switch endpoint",
      choices,
    });

    const selectedDisplayName = await prompt.run();

    // Retrieve the actual endpoint value from the map
    const selectedEndpoint = endpointMap.get(selectedDisplayName);

    if (!selectedEndpoint) {
      throw new Error("Unexpected error: selected endpoint not found.");
    }

    // Update the configuration with the selected endpoint
    ConfigManager.setEndpoint(selectedEndpoint);

    Printer.print(`Endpoint switched to '${selectedEndpoint}'.`);
  } catch (err) {
    const error = err as Error;
    Printer.error(`Failed to switch endpoint: ${error.message}`);
  }
}
