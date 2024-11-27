/**
 * Log an error message and exit the process with a given code.
 * @param message - The error message to display.
 * @param exitCode - The code to exit the process with (default: 1).
 */
export function handleError(message: string, exitCode = 1): void {
  console.error(`[Error]: ${message}`);
  process.exit(exitCode);
}

/**
 * Handle system errors such as file system issues.
 * @param err - The error object thrown by the system.
 */
export function handleSystemError(err: any): void {
  console.error(`[System Error]: ${err.message}`);
  process.exit(1);
}

/**
 * Handle network-related errors, providing clear feedback to the user.
 * @param err - The error object thrown by a network call.
 */
export function handleNetworkError(err: any): void {
  if (err.code === "ECONNABORTED") {
    console.error("[Network Error]: Request timed out.");
  } else if (err.response) {
    console.error(`[Network Error]: ${err.response.status} - ${err.response.data}`);
  } else {
    console.error(`[Network Error]: ${err.message}`);
  }
  process.exit(1);
}
