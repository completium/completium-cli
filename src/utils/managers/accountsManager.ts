import fs from "fs";
import path from "path";

import { AccountsFile, Account } from "../types/configuration";

export class AccountsManager {
  private static readonly accountsFilePath = path.join(
    process.env.HOME || ".",
    ".completium",
    "accounts.json"
  );

  /**
   * Loads the accounts from the file system.
   * If the file does not exist, an empty structure is initialized.
   */
  private static loadAccounts(): AccountsFile {
    if (fs.existsSync(AccountsManager.accountsFilePath)) {
      const rawData = fs.readFileSync(AccountsManager.accountsFilePath, "utf8");
      return JSON.parse(rawData) as AccountsFile;
    } else {
      return { accounts: [] };
    }
  }

  /**
   * Saves the current accounts data to the file system.
   */
  private static saveAccounts(accountsData: AccountsFile): void {
    const dirPath = path.dirname(AccountsManager.accountsFilePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    fs.writeFileSync(
      AccountsManager.accountsFilePath,
      JSON.stringify(accountsData, null, 2),
      "utf8"
    );
  }

  /**
   * Returns all accounts.
   */
  public static getAccounts(): Account[] {
    return this.loadAccounts().accounts;
  }

  /**
   * Finds an account by its name.
   * @param name The name of the account to find.
   */
  public static getAccountByName(name: string): Account | undefined {
    return this.loadAccounts().accounts.find((account) => account.name === name);
  }

  /**
   * Finds an account by its public key hash (pkh).
   * @param pkh The public key hash of the account to find.
   */
  public static getAccountByPkh(pkh: string): Account | undefined {
    return this.loadAccounts().accounts.find((account) => account.pkh === pkh);
  }

  /**
   * Adds a new account.
   * @param account The account to add.
   */
  public static addAccount(account: Account): void {
    const accountsData = this.loadAccounts();
    if (this.getAccountByName(account.name) || this.getAccountByPkh(account.pkh)) {
      throw new Error(`Account with name '${account.name}' or pkh '${account.pkh}' already exists.`);
    }
    accountsData.accounts.push(account);
    this.saveAccounts(accountsData);
  }

  /**
   * Updates an existing account by name.
   * Throws an error if the account does not exist.
   * @param name The name of the account to update.
   * @param updatedAccount The updated account data.
   */
  public static updateAccount(name: string, updatedAccount: Partial<Account>): void {
    const accountsData = this.loadAccounts();
    const account = accountsData.accounts.find((account) => account.name === name);
    if (!account) {
      throw new Error(`Account with name '${name}' not found.`);
    }
    Object.assign(account, updatedAccount);
    this.saveAccounts(accountsData);
  }

  /**
   * Deletes an account by its name.
   * @param name The name of the account to delete.
   */
  public static deleteAccount(name: string): void {
    const accountsData = this.loadAccounts();
    const initialLength = accountsData.accounts.length;
    accountsData.accounts = accountsData.accounts.filter(
      (account) => account.name !== name
    );
    if (accountsData.accounts.length === initialLength) {
      throw new Error(`Account with name '${name}' not found.`);
    }
    this.saveAccounts(accountsData);
  }

  /**
   * Validates if the account structure is correct.
   * @param account The account to validate.
   */
  public static validateAccount(account: Account): boolean {
    return (
      typeof account.name === "string" &&
      typeof account.pkh === "string" &&
      typeof account.pubk === "string" &&
      account.key &&
      account.key.kind === "private_key" &&
      typeof account.key.value === "string"
    );
  }
}
