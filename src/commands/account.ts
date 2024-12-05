import * as bip39 from "bip39";
import { TezosToolkit } from "@taquito/taquito"
import { InMemorySigner } from "@taquito/signer";
import { b58cencode, prefix } from "@taquito/utils";
import { confirmAccount, confirmRemoveAccount } from "../utils/interaction";
import { Printer } from "../utils/printer";
import { Options } from "../utils/options";
import { AccountsManager } from "../utils/managers/accountsManager";
import { Account } from "../utils/types/configuration";
import { ConfigManager } from "../utils/managers/configManager";
import { RPC_URL } from "../utils/constants";
import { TezosClientManager } from "../utils/managers/tezosClientManager";
import { getBalanceFor } from "../utils/tezos";
import { handleError } from "../utils/errorHandler";

/**
 * Generates a new account with a mnemonic, public/private key pair, and saves it.
 * @param options Options containing the account alias and force overwrite flag.
 * @param options.value The alias for the account.
 * @param options.force Whether to overwrite an existing account without confirmation.
 */
export async function generateAccount(alias: string, options: Options): Promise<void> {
  try {
    const force = options.force ?? false;

    // Confirm account overwrite if necessary
    const confirm = await confirmAccount(force, alias);
    if (!confirm) {
      Printer.print("Account generation cancelled.");
      return;
    }

    // Generate mnemonic and derive seed
    const mnemonic = bip39.generateMnemonic(256);
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const buffer = seed.slice(0, 32);

    // Generate keys
    const privateKey = b58cencode(buffer, prefix.edsk2);
    const signer = await InMemorySigner.fromSecretKey(privateKey);

    const publicKey = await signer.publicKey();
    const publicKeyHash = await signer.publicKeyHash();
    const secretKey = await signer.secretKey();

    // Save the account
    await saveAccountWithId(alias, publicKey, publicKeyHash, secretKey);
  } catch (error) {
    const err = error as Error;
    Printer.error(`Failed to generate account: ${err.message}`);
  }
}

/**
 * Saves an account with the specified alias, public key, public key hash, and private key.
 * Prints a success message upon saving.
 * @param alias The alias of the account.
 * @param pubk The public key of the account.
 * @param pkh The public key hash of the account.
 * @param prik The private key of the account.
 */
async function saveAccountWithId(alias: string, pubk: string, pkh: string, prik: string): Promise<void> {
  try {
    const account: Account = {
      name: alias,
      pubk,
      pkh,
      key: {
        kind: "private_key",
        value: prik,
      },
    };

    // Use the AccountsManager to add the account
    AccountsManager.addOrUpdateAccount(account);

    // Print success message
    Printer.print(`Account ${pkh} is registered as '${alias}'.`);
  } catch (error) {
    const err = error as Error;
    Printer.error(`Failed to save account: ${err.message}`);
  }
}

export async function importPrivatekey(privateSk: string, alias: string, options: Options) {
  const force = options.force ?? false;
  const with_tezos_client = options.with_tezos_client;

  var confirm = await confirmAccount(force, alias);
  if (!confirm) {
    return;
  }

  const signer = new InMemorySigner(privateSk);
  const pubk = await signer.publicKey();
  const pkh = await signer.publicKeyHash();
  let sk = await signer.secretKey();
  if (!sk) {
    sk = privateSk;
  }
  const acc = AccountsManager.getAccountByPkh(pkh);
  if (acc) {
    handleError(`Account '${pkh}' already exists as '${acc.name}'.`);
  }
  saveAccountWithId(alias, pubk, pkh, sk);
  if (with_tezos_client || ConfigManager.isMockupMode()) {
    const args = ["import", "secret", "key", alias, ("unencrypted:" + sk)];
    await TezosClientManager.callDryTezosClient(args);
    if (ConfigManager.isMockupMode()) {
      await TezosClientManager.callTezosClient(["transfer", "10000", "from", "bootstrap1", "to", pkh, "--burn-cap", "0.06425"]);
    }
  }
}

export async function showAccounts() {
  const accounts = AccountsManager.getAccounts();

  accounts.forEach(x => {
    Printer.print(`${x.name.padEnd(30)}\t\t${x.pkh}`);
  });
}

export async function showKeyInfo(pubk: string, pkh: string, prik: string | null) {
  Printer.print(`Public  key hash:\t${pkh}`);
  Printer.print(`Public  key:\t\t${pubk}`);
  if (prik) {
    Printer.print(`Private key:\t\t${prik}`);
  }
}

export async function showAccount(options: Options) {
  const alias = options.alias ?? ConfigManager.getDefaultAccount();
  const withPrivateKey = options.withPrivateKey;

  let account = AccountsManager.getAccountByName(alias);
  if (!account) {
    account = AccountsManager.getAccountByPkh(alias);
  }

  if (!account) {
    Printer.print(`'${alias}' is not found.`);
  } else {
    Printer.print(`Current account:\t${account.name}`);
    showKeyInfo(account.pubk, account.pkh, withPrivateKey ? account.key.value : null);
    var balance = await getBalanceFor(account.pkh);
    Printer.print(`Balance on ${ConfigManager.getNetwork()}:\t${balance.toNumber() / 1000000} ꜩ`);
  }
}

export async function showKeysFrom(value: string) {
  const signer = new InMemorySigner(value);
  const pubk = await signer.publicKey();
  const pkh = await signer.publicKeyHash();
  let sk = await signer.secretKey();
  if (!sk) {
    sk = value;
  }
  showKeyInfo(pubk, pkh, sk);
}

export function setAccount(alias: string) {
  const account = AccountsManager.getAccountByName(alias);
  if (!account) {
    handleError(`'${alias}' is not found.`);
  }
  ConfigManager.setDefaultAccount(alias);
  Printer.print(`Default account set to '${alias}'.`);
}

/**
 * Removes an account.
 * Ensures the account exists and is not the default account before removal.
 * @param value The name of the account to remove.
 * @param options Options for the operation.
 */
export async function removeAccount(value: string, options: Options): Promise<void> {
  try {
    const force = options.force ?? false;

    // Retrieve the account to remove
    const account = AccountsManager.getAccountByName(value);
    if (!account) {
      return Printer.error(`'${value}' is not found.`);
    }

    // Ensure the account to remove is not the default account
    if (ConfigManager.getDefaultAccount() === value) {
      return Printer.error(`Cannot remove account '${value}' because it is currently set as the default account. Switch to another account before removing.`);
    }

    const confirm = await confirmRemoveAccount(force, value);
    if (!confirm) {
      Printer.print("Account removal cancelled.");
      return;
    }

    // Remove the account
    AccountsManager.removeAccountByName(value);

    Printer.print(`Account '${value}' has been removed.`);
  } catch (error) {
    const err = error as Error;
    Printer.error(`Failed to remove account: ${err.message}`);
  }
}


/**
 * Renames an account.
 * Ensures the account exists and is not the default account before renaming.
 * If the target name already exists, it removes the target before renaming.
 * @param from The current name of the account.
 * @param to The new name for the account.
 * @param options Options containing the force overwrite flag.
 */
export async function renameAccount(from: string, to: string, options: Options): Promise<void> {
  try {
    const force = options.force ?? false;

    // Retrieve the account to rename
    const accountFrom = AccountsManager.getAccountByName(from);
    if (!accountFrom) {
      handleError(`'${from}' is not found.`);
      return;
    }

    // Ensure the account to rename is not the default account
    if (ConfigManager.getDefaultAccount() === from) {
      handleError(`Cannot rename account '${from}' because it is currently set as the default account. Switch to another account before renaming.`);
    }

    // Confirm overwriting if necessary
    const confirm = await confirmAccount(force, to);
    if (!confirm) {
      handleError("Account renaming cancelled.");
      return;
    }

    // Check if the target name already exists and remove it if necessary
    const accountTo = AccountsManager.getAccountByName(to);
    if (accountTo) {
      AccountsManager.removeAccountByName(to);
      Printer.print(`Account '${to}' was removed to allow renaming.`);
    }

    // Remove the old account and add it back with the new name
    AccountsManager.removeAccountByName(from);
    const renamedAccount = { ...accountFrom, name: to };
    AccountsManager.addAccount(renamedAccount);

    Printer.print(`Account '${accountFrom.pkh}' has been renamed from '${from}' to '${to}'.`);
  } catch (error) {
    const err = error as Error;
    Printer.error(`Failed to rename account: ${err.message}`);
  }
}
