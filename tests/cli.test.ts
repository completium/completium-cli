import { cli } from "../src/cli";
import { getBalanceCommand } from "../src/commands/getBalance";
import { emptyOptions } from "../src/utils/types/options";

jest.mock("../src/commands/getBalance");

describe("CLI - get balance for", () => {
  const mockGetBalanceCommand = getBalanceCommand as jest.Mock;

  beforeEach(() => {
    mockGetBalanceCommand.mockClear();
  });

  it("should execute the getBalanceCommand with the correct address", async () => {
    // Arrange
    const address = "tz1VnWuemMTvW9bKCi2tTsbRhgpPGccY1JhV";
    const consoleLogSpy = jest.spyOn(console, "log").mockImplementation(); // To capture console.log
    mockGetBalanceCommand.mockResolvedValueOnce(undefined); // Mock the command execution

    const args = [
      "node",
      "completium-cli",
      "get",
      "balance",
      "for",
      address,
    ];

    // Act
    await cli(args);

    // Assert
    expect(mockGetBalanceCommand).toHaveBeenCalledWith(address, emptyOptions); // Verify the address passed
    expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining("[Error]")); // Ensure no errors were logged

    // Cleanup
    consoleLogSpy.mockRestore();
  });

  // it("should handle invalid Tezos address gracefully", async () => {
  //   // Arrange
  //   const invalidAddress = "fake_pkh";
  //   const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
  //   // const processExitSpy = jest.spyOn(process, "exit").mockImplementation((code?: number) => {
  //   //   throw new Error(`process.exit called with code ${code}`);
  //   // });

  //   const args = ["node", "completium-cli", "get", "balance", "for", invalidAddress];

  //   // Act & Assert
  //   await expect(cli(args)).rejects.toThrow("[Error]: Invalid Tezos address. It should start with 'tz'.");

  //   expect(consoleErrorSpy).toHaveBeenCalledWith(
  //     "[Error]: Invalid Tezos address. It should start with 'tz'."
  //   );
  //   // expect(processExitSpy).toHaveBeenCalledWith(1);

  //   // Cleanup
  //   consoleErrorSpy.mockRestore();
  //   // processExitSpy.mockRestore();
  // });
});
