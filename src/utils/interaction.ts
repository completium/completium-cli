import readline from "readline";
import { AccountsManager } from "./managers/accountsManager";

/**
 * Asks the user a yes/no question via the command line.
 * @param msg The message to display for the question.
 * @param callback A function to execute with the boolean result.
 * @param defaultValue The default boolean value if the user provides no input.
 */
export function askQuestionBool(
  msg: string,
  callback: (result: boolean) => void,
  defaultValue: boolean = false
): void {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  /**
   * Converts user input into a boolean value.
   * @param input The raw user input.
   * @param defaultValue The default boolean value if no input is provided.
   * @returns The boolean interpretation of the input.
   */
  const getBool = (input: string | null, defaultValue: boolean): boolean => {
    if (input != null && input.trim() !== "") {
      return /^(y(es)?|true)$/i.test(input.trim());
    }
    return !defaultValue;
  };

  const yn = defaultValue ? "[yN]" : "[Yn]";
  const start = `\x1b[01m`; // Bold text
  const end = `\x1b[0m`; // Reset text style

  rl.question(`${start}${msg}${end} ${yn} `, (answer: string) => {
    const result = getBool(answer, defaultValue);
    callback(result);
    rl.close();
  });
}


/**
 * Asks the user for confirmation to overwrite an existing account.
 * If `force` is true or the account doesn't exist, it automatically confirms.
 * @param force A boolean indicating whether to skip confirmation and force overwrite.
 * @param account The account name to check for confirmation.
 * @param accountExists A callback function to check if the account exists.
 * @returns A promise that resolves to `true` if the user confirms, otherwise `false`.
 */
export async function confirmAccount(
  force: boolean,
  account: string
): Promise<boolean> {
  // Automatically confirm if force is true or the account does not exist
  if (force || !AccountsManager.accountExists(account)) {
    return true;
  }

  // Construct the confirmation message
  const confirmationMessage = `${account} already exists. Do you want to overwrite?`;

  // Use askQuestionBool to get confirmation from the user
  return new Promise((resolve) => {
    askQuestionBool(confirmationMessage, (answer) => resolve(answer), false);
  });
}


/**
 * Asks the user for confirmation to remove an existing account.
 * If `force` is true or the account does not exist, it automatically confirms.
 * @param force A boolean indicating whether to skip confirmation and force removal.
 * @param account The account name to check for confirmation.
 * @returns A promise that resolves to `true` if the user confirms, otherwise `false`.
 */
export async function confirmRemoveAccount(
  force: boolean,
  account: string
): Promise<boolean> {
  // Automatically confirm if force is true or the account does not exist
  if (force || !AccountsManager.accountExists(account)) {
    return true;
  }

  // Construct the confirmation message
  const confirmationMessage = `Are you sure you want to remove the account '${account}'? This action cannot be undone.`;

  // Use askQuestionBool to get confirmation from the user
  return new Promise((resolve) => {
    askQuestionBool(confirmationMessage, (answer) => resolve(answer), true);
  });
}
