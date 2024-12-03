import axios from "axios";
import { handleNetworkError } from "./errorHandler";
import BigNumber from "bignumber.js";
import { ConfigManager } from "./managers/configManager";
import { TezosClientManager } from "./managers/tezosClientManager";
import { RPC_URL } from "./constants";
import { rpcGet } from "./tools";

export function isValidPkh(value : string) {
  return value.startsWith("tz") || value.startsWith("KT") || value.startsWith("sr")
}

/**
 * Fetches the balance for a Tezos address using an RPC endpoint.
 * @param rpcUrl - The RPC URL to query.
 * @param address - The Tezos address (tz1...).
 * @returns The balance in `tez`.
 */
export async function getBalanceFor(address: string): Promise<BigNumber> {
  const a = `/chains/main/blocks/head/context/contracts/${address}/balance`;

  if (ConfigManager.isOctezClientConfig()) {
    const args = ["rpc", "get", a]
    const res = await TezosClientManager.callTezosClient(args);
    return new BigNumber(res.stdout)
  } else {
    try {
      const rpcUrl = ConfigManager.getEndpoint();
      const res = await rpcGet<string>(rpcUrl, a);
      return new BigNumber(res)
    } catch (err: any) {
      handleNetworkError(err); // Handle network-specific errors
      throw err; // Rethrow to stop further execution
    }
  }
}
