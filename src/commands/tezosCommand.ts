import { getBalanceFor, isValidPkh } from "../utils/tezos";
import { handleError } from "../utils/errorHandler";
import { Options } from "../utils/options";
import { Printer } from "../utils/printer";
import { AccountsManager } from "../utils/managers/accountsManager";
import { ConfigManager } from "../utils/managers/configManager";
import { TezosClientManager } from "../utils/managers/tezosClientManager";
import { extractGlobalAddress } from "../utils/regExp";

/**
 * Handles the `get balance for` command.
 * @param address - The Tezos address to fetch the balance for.
 */
export const getBalanceCommand = async (value: string, options: Options) => {
  let pkh = value;
  const account = AccountsManager.getAccountByName(value)
  if (account) {
    pkh = account.pkh;
  }

  if (!isValidPkh(pkh)) {
    handleError(`Invalid Tezos address: ${pkh}`);
  }

  try {
    const balance = await getBalanceFor(pkh);
    Printer.print(`${balance.toNumber() / 1000000} ꜩ`);
  } catch (err) {
    handleError(`Failed to fetch balance for ${pkh}`);
  }
};

export async function registerGlobalConstant(value: string, options: Options) {
  const force = options.force;

  const alias = options.as ?? ConfigManager.getDefaultAccount();
  const account = AccountsManager.getAccountByNameOrPkh(alias);

  if (!account) {
    const msg = `Account '${alias}' is not found.`;
    return new Promise((resolve, reject) => { reject(msg) });
  }

  const args = ["register", "global", "constant", value, "from", account.pkh, "--burn-cap", "20"];
  const { stdout, stderr, failed } = await TezosClientManager.callDryTezosClient(args);
  if (failed) {
    if (!force) {
      throw (stderr)
    } else {
      return {
        status: "error",
        stdout: stdout,
        stderr: stderr
      }
    }
  } else {
    Printer.print(stdout);
    const global_address = extractGlobalAddress(stdout);
    return {
      status: "passed",
      global_address: global_address,
      stdout: stdout,
      stderr: stderr
    }
  }
}
