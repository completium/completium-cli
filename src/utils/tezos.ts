import axios from "axios";
import { handleNetworkError } from "./errorHandler";
import BigNumber from "bignumber.js";

/**
 * Fetches the balance for a Tezos address using an RPC endpoint.
 * @param rpcUrl - The RPC URL to query.
 * @param address - The Tezos address (tz1...).
 * @returns The balance in `tez`.
 */
export async function getBalanceFor(rpcUrl: string, address: string): Promise<BigNumber> {
  try {
    const response = await axios.get(`${rpcUrl}/chains/main/blocks/head/context/contracts/${address}/balance`);
    const res = response.data;
    return new BigNumber(res)
  } catch (err: any) {
    handleNetworkError(err); // Handle network-specific errors
    throw err; // Rethrow to stop further execution
  }
}
