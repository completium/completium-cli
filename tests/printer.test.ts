import { Printer } from "../src/utils/printer";

describe("Printer", () => {
  const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
  const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

  afterEach(() => {
    consoleLogSpy.mockClear();
    consoleErrorSpy.mockClear();
    Printer.setQuiet(false);
  });

  it("should print messages to stdout when not in quiet mode", () => {
    Printer.print("Standard output message");
    expect(consoleLogSpy).toHaveBeenCalledWith("Standard output message");
  });

  it("should not print messages to stdout in quiet mode", () => {
    Printer.setQuiet(true);
    Printer.print("Standard output message");
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it("should print error messages to stderr", () => {
    Printer.error("Error message");
    expect(consoleErrorSpy).toHaveBeenCalledWith("Error message");
  });

  it("should print error messages even in quiet mode", () => {
    Printer.setQuiet(true);
    Printer.error("Error message");
    expect(consoleErrorSpy).toHaveBeenCalledWith("Error message");
  });
});
