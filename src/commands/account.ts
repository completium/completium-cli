import * as bip39 from "bip39";
import { TezosToolkit } from "@taquito/taquito"
import { InMemorySigner } from "@taquito/signer";
import { b58cencode, prefix } from "@taquito/utils";
import { confirmAccount } from "../utils/interaction";
import { Printer } from "../utils/printer";
import { Options } from "../utils/options";
import { AccountsManager } from "../utils/managers/accountsManager";
import { Account } from "../utils/types/configuration";
import { ConfigManager } from "../utils/managers/configManager";
import { RPC_URL } from "../utils/constants";
import { TezosClientManager } from "../utils/managers/tezosClientManager";
import { getBalanceFor } from "../utils/tezos";

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

export async function showKeyInfo(pubk : string, pkh : string, prik : string | null) {
  Printer.print(`Public  key hash:\t${pkh}`);
  Printer.print(`Public  key:\t\t${pubk}`);
  if (prik) {
    Printer.print(`Private key:\t\t${prik}`);
  }
}

export async function showAccount(options : Options) {
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

export async function showKeysFrom(value : string) {
  const signer = new InMemorySigner(value);
  const pubk = await signer.publicKey();
  const pkh = await signer.publicKeyHash();
  let sk = await signer.secretKey();
  if (!sk) {
    sk = value;
  }
  showKeyInfo(pubk, pkh, sk);
}
