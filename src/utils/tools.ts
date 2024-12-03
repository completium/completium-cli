import axios, { AxiosResponse } from "axios";

export interface ExecResult {
  stdout: string,
  stderr: string,
  failed: boolean,
  exitCode?: number
}

export async function exec(bin : string, args : string[]) : Promise<ExecResult> {
  const { execa } = await import("execa");
  const { stdout, stderr, failed, exitCode } = await execa(bin, args, {});
  return { stdout, stderr, failed, exitCode }
}


/**
 * Performs an HTTP GET request to a specified RPC endpoint.
 * Throws an error if the request fails, allowing it to be handled by the caller.
 * @param baseUrl The base URL of the RPC server.
 * @param resourcePath The specific endpoint to query.
 * @returns A promise resolving to the parsed response data.
 */
export async function rpcGet<T>(baseUrl: string, resourcePath: string): Promise<T> {
  try {
    const url = new URL(resourcePath, baseUrl).toString(); // Ensure proper URL concatenation
    const response: AxiosResponse<T> = await axios.get(url, {
      headers: {
        "Accept": "application/json",
      },
      timeout: 5000, // Set a timeout of 5 seconds
    });
    return response.data;
  } catch (error) {
    // if (axios.isAxiosError(error)) {
    //   console.error(`RPC GET failed: ${error.message} (URL: ${rpcUrl}/${endpoint})`);
    // } else {
    //   console.error(`Unexpected error: ${error}`);
    // }
    throw error; // Let the caller handle the error
  }
}

/**
 * Performs an HTTP POST request to a specified RPC endpoint.
 * Throws an error if the request fails, allowing it to be handled by the caller.
 * @param baseUrl The base URL of the RPC server.
 * @param resourcePath The specific resource or endpoint to query.
 * @param data The payload to send in the POST request.
 * @returns A promise resolving to the parsed response data.
 */
export async function rpcPost<T, U>(baseUrl: string, resourcePath: string, data: T): Promise<U> {
  try {
    const url = new URL(resourcePath, baseUrl).toString();
    const response: AxiosResponse<U> = await axios.post(url, data, {
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      timeout: 5000,
    });
    return response.data;
  } catch (error) {
    // if (axios.isAxiosError(error)) {
    //   console.error(`RPC POST failed: ${error.message} (URL: ${baseUrl}/${resourcePath})`);
    // } else {
    //   console.error(`Unexpected error: ${error}`);
    // }
    throw error;
  }
}
