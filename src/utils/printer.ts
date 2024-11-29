export class Printer {
  private static isQuiet = false;

  /**
   * Enable or disable quiet mode.
   * @param quiet - If true, suppress all standard outputs.
   */
  public static setQuiet(quiet: boolean): void {
    Printer.isQuiet = quiet;
  }

  /**
   * Print a standard message to the console (stdout).
   * @param msg - The message to print.
   */
  public static print(msg: string): void {
    if (!Printer.isQuiet) {
      console.log(msg);
    }
  }

  /**
   * Print an error message to the console (stderr).
   * @param msg - The error message to print.
   */
  public static error(msg: string): void {
    console.error(msg);
  }
}
