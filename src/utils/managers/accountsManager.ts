import fs from "fs";
import path from "path";

import { AccountsFile, Account } from "../types/configuration";

export class AccountsManager {
  private static readonly accountsFilePath = path.join(
    process.env.HOME || ".",
    ".completium",
    "accounts.json"
  );

  private static loadAccounts(): AccountsFile {
    try {
      if (fs.existsSync(AccountsManager.accountsFilePath)) {
        const rawData = fs.readFileSync(AccountsManager.accountsFilePath, "utf8");
        return JSON.parse(rawData) as AccountsFile;
      }
    } catch (error) {
      console.error(`Error loading accounts: ${(error as Error).message}`);
    }
    return { accounts: [] }; // Return empty structure in case of an error
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
   * Finds an account by its name or its pkh.
   * @param value The value of the account to find.
   */
  public static getAccountByNameOrPkh(value: string): Account | undefined {
    return this.loadAccounts().accounts.find((account) => account.name === value || account.pkh === value);
  }

  /**
   * Checks if an account exists by its name.
   * @param name The name of the account to check.
   * @returns True if the account exists, otherwise false.
   */
  public static accountExists(name: string): boolean {
    return !!AccountsManager.getAccountByName(name); // Converts the result to a boolean
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
   * Removes an account by its name.
   * If the account is not found, an error is thrown.
   * @param name The name of the account to remove.
   */
  public static removeAccountByName(name: string): void {
    const accountsData = this.loadAccounts();

    const initialLength = accountsData.accounts.length;

    accountsData.accounts = accountsData.accounts.filter(
      (account) => account.name !== name
    );

    if (accountsData.accounts.length === initialLength) {
      throw new Error(`Account '${name}' not found.`);
    }

    this.saveAccounts(accountsData);
  }

  /**
   * Adds a new account or updates an existing account.
   * If an account with the same name exists, it is updated.
   * @param account The account to add or update.
   */
  public static addOrUpdateAccount(account: Account): void {
    const accountsData = this.loadAccounts();

    // Check if an account with the same name exists
    const existingAccountByName = this.getAccountByName(account.name);
    if (existingAccountByName) {
      // Update the existing account with the new values
      Object.assign(existingAccountByName, account);
      this.saveAccounts(accountsData);
      return;
    }

    // If no existing account is found, add the new account
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
