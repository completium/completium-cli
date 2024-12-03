import * as bip39 from "bip39";
import { InMemorySigner } from "@taquito/signer";
import { b58cencode, prefix } from "@taquito/utils";
import { confirmAccount } from "../utils/interaction";
import { Printer } from "../utils/printer";
import { Options } from "../utils/options";
import { AccountsManager } from "../utils/managers/accountsManager";
import { Account } from "../utils/types/configuration";

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
    const confirm = await confirmAccount(force, alias, AccountsManager.accountExists);
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
