import { AccountsManager } from "../utils/managers/accountsManager";
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

/**
 * Allows the user to switch the mode for a specific binary.
 * Displays a list of modes (`js`, `docker`, `binary`) and updates the configuration
 * based on the user's selection using ConfigManager.
 * @param bin The binary for which the mode should be switched ('archetype' or 'tezos-client').
 */
export async function switchMode(bin: "archetype" | "tezos-client"): Promise<void> {
  try {
    // Validate the binary type
    if (!["archetype", "tezos-client"].includes(bin)) {
      throw new Error(`Invalid binary: '${bin}'. Expected 'archetype' or 'tezos-client'.`);
    }

    // Retrieve the current mode for the binary
    const currentMode = ConfigManager.getConfig().mode[bin];
    Printer.print(`Current mode for '${bin}': '${currentMode}'`);

    const { Select } = require("enquirer");

    // Display the selection prompt for available modes
    const prompt = new Select({
      name: "mode",
      message: `Switch ${bin} mode`,
      choices: ["js", "docker", "binary"],
    });

    const selectedMode = await prompt.run();

    // Update the mode in the configuration
    ConfigManager.setModeArchetype(selectedMode as "js" | "docker" | "binary");
  } catch (err) {
    const error = err as Error;
    Printer.error(`Failed to switch mode for '${bin}': ${error.message}`);
  }
}

/**
 * Allows the user to switch the default account.
 * Displays a list of available accounts and updates the default account
 * in the configuration based on the user's selection.
 */
export async function switchAccount(): Promise<void> {
  try {
    // Retrieve the current configuration and accounts
    const currentAccount = ConfigManager.getDefaultAccount();
    const accounts = AccountsManager.getAccounts();

    // Notify the user of the current default account
    if (currentAccount) {
      Printer.print(`Current account: ${currentAccount}`);
    }

    const accountMap = new Map<string, string>();

    // Prepare choices for the selection prompt
    const choices = accounts.flatMap((account) => {
      const displayName = `${account.name.padEnd(60)} ${account.pkh}`;
      accountMap.set(displayName, account.name);
      return displayName;
    });


    const { Select } = require("enquirer");

    // Create the selection prompt
    const prompt = new Select({
      name: "account",
      message: "Switch account",
      choices,
    });

    // Display the prompt and handle the user's selection
    const selectedAnswer = await prompt.run();
    const selectedAccount = accountMap.get(selectedAnswer);

    if (!selectedAccount) {
      throw new Error("Unexpected error: selected account not found.");
    }

    // Update the default account in the configuration
    ConfigManager.setDefaultAccount(selectedAccount);

    Printer.print(`Account switched to '${selectedAccount}'.`);
  } catch (err) {
    const error = err as Error;
    Printer.error(`Failed to switch account: ${error.message}`);
  }
}