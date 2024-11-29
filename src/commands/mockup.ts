import { TezosClientManager } from "../utils/managers/tezosClientManager";
import { Printer } from "../utils/printer";
import path from "path";
import { Options } from "../utils/types/options";
import { ConfigManager } from "../utils/managers/configManager";

/**
 * Handles the `mockup init` command.
 * Initializes a mockup environment using the `tezos-client`.
 * @param option Command-line options passed to the command.
 */
export async function mockupInitCommand(option: Options): Promise<void> {
  try {
    const mockupDir = ConfigManager.getMockupDir();

    let protocol = option.protocol;

    if (!protocol) {

      const protocols = TezosClientManager.listMockupProtocols();

      // Ensure there are at least two protocols available
      if (protocols.length < 2) {
        Printer.error(
          "Not enough mockup protocols available. Please ensure the Tezos client is correctly configured."
        );
        return;
      } else {
        protocol = protocols[1];
      }
    }

    // Directly call the initialize method without additional print
    TezosClientManager.initializeMockup(mockupDir, protocol);
  } catch (error) {
    const err = error as Error;
    Printer.error(`Failed to initialize mockup environment: ${err.message}`);
  }
}
