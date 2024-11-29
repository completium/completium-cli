import { getBalanceFor } from "../utils/tezos";
import { handleError } from "../utils/errorHandler";
import { RPC_URL } from "../utils/constants";
import { Options } from "../utils/types";
import { Printer } from "../utils/printer";

/**
 * Handles the `get balance for` command.
 * @param address - The Tezos address to fetch the balance for.
 */
export const getBalanceCommand = async (value: string, options : Options) => {
  if (!value.startsWith("tz")) {
    handleError("Invalid Tezos address. It should start with 'tz'.");
  }

  try {
    const balance = await getBalanceFor(RPC_URL, value);
    Printer.print(`${balance.toNumber() / 1000000} ꜩ`);
  } catch (err) {
    handleError(`Failed to fetch balance for ${value}`);
  }
};
