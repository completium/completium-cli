import { TezosClientManager } from "../utils/managers/tezosClientManager";
import { Printer } from "../utils/printer";
import path from "path";
import { Options } from "../utils/options";
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

      const protocols = await TezosClientManager.listMockupProtocols();

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

export async function mockupSetNowCommand(value : string, date ?: any): Promise<void> {
  // Ensure the current mode is mockup
  if (!ConfigManager.isMockupMode()) {
    throw new Error("Mode mockup is required for setMockupNow.");
  }

  let targetDate: Date;

  // Determine the target date
  if (date) {
    if (typeof date === "number") {
      // Check if the timestamp is valid
      if (date > 253400000000) {
        throw new Error("Invalid value (expecting timestamp in seconds).");
      }
      targetDate = new Date(date * 1000); // Convert seconds to milliseconds
    } else {
      targetDate = date;
    }
  } else {
    if (!value) {
      throw new Error("No value provided for setMockupNow.");
    }
    targetDate = new Date(value);
  }

  // Adjust the date to remove milliseconds and subtract 1 second
  targetDate.setMilliseconds(0);
  targetDate.setSeconds(targetDate.getSeconds() - 1);

  // Format the date to ISO string
  const isoTimestamp = targetDate.toISOString();

  // Load the mockup context
  const mockupDir = ConfigManager.getMockupDir();
  TezosClientManager.setMockupNow(mockupDir, isoTimestamp);

}