#!/usr/bin/env node

import { getBalanceCommand } from "./commands/getBalance";

/**
 * Parse command-line arguments to identify the command and its options.
 * @param args - The arguments from process.argv.
 * @returns Parsed command and options.
 */
function parseCommand(args: string[]) {
  const length = args.length;

  if (length > 5 && args[2] === "get" && args[3] === "balance" && args[4] === "for") {
    return { command: "get_balance_for", value: args[5] };
  }

  // TODO: Add other command parsing logic here
  return { command: undefined };
}

/**
 * Execute the appropriate command based on the parsed input.
 * @param options - The parsed command and its parameters.
 */
async function execCommand(options: { command?: string; value?: string }) {
  try {
    switch (options.command) {
      case "get_balance_for":
        if (!options.value) {
          throw new Error("No address provided for 'get balance for'.");
        }
        await getBalanceCommand(options.value);
        break;

      case undefined:
        console.error("[Error]: Command not found.");
        console.error('Type "completium-cli help" for a list of available commands.');
        process.exit(1); // General error code for invalid commands

      default:
        console.error("[Error]: Command not implemented yet.");
        console.error("Please refer to the documentation or check back later.");
        process.exit(255); // Special error code for unimplemented commands
    }
  } catch (err: any) {
    console.error(`[Error]: ${err.message}`);
    process.exit(1); // General error code
  }
}

/**
 * Main entry point for the CLI.
 * @param args - The arguments from process.argv.
 */
export async function cli(args: string[]) {
  const options = parseCommand(args);

  if (!options.command) {
    console.error("Invalid or missing command.");
    console.error('Type "completium-cli help" for more information.');
    process.exit(1); // General error code
  }

  await execCommand(options);
}


