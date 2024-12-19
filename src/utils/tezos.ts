import axios from "axios";
import { handleNetworkError } from "./errorHandler";
import BigNumber from "bignumber.js";
import { ConfigManager } from "./managers/configManager";
import { TezosClientManager } from "./managers/tezosClientManager";
import { rpcGet } from "./tools";
import { Expr } from '@taquito/michel-codec'


export function get_event_well_script(): string {
  return `{ storage unit; parameter (bytes %event); code { UNPAIR; DROP; NIL operation; PAIR } }`
}

export function get_sandbox_exec_script(): string {
  return `{ storage unit; parameter (pair (list (ticket (pair nat (option bytes)))) (lambda (list (ticket (pair nat (option bytes)))) (list operation))); code { UNPAIR; UNPAIR; EXEC; PAIR} }`
}

export function isValidPkh(value: string) {
  return value.startsWith("tz") || value.startsWith("KT") || value.startsWith("sr")
}

async function octezClientGET(a: string): Promise<string> {
  if (ConfigManager.isOctezClientConfig()) {
    const args = ["rpc", "get", a]
    const res = await TezosClientManager.callTezosClient(args);
    return res.stdout;
  } else {
    try {
      const rpcUrl = ConfigManager.getEndpoint();
      const res = await rpcGet<string>(rpcUrl, a);
      return res;
    } catch (err: any) {
      handleNetworkError(err); // Handle network-specific errors
      throw err; // Rethrow to stop further execution
    }
  }
}

/**
 * Fetches the balance for a Tezos address using an RPC endpoint.
 * @param rpcUrl - The RPC URL to query.
 * @param address - The Tezos address (tz1...).
 * @returns The balance in `tez`.
 */
export async function getBalanceFor(address: string): Promise<BigNumber> {
  const a = `/chains/main/blocks/head/context/contracts/${address}/balance`;
  const res = await octezClientGET(a);
  return new BigNumber(res)
}


export async function getRawStorage(address: string): Promise<Expr> {
  const uri = `/chains/main/blocks/head/context/contracts/${address}/storage`;
  const storage = await octezClientGET(uri);
  return JSON.parse(storage);
}

export async function getRawScript(address: string): Promise<any> {
  const uri = `/chains/main/blocks/head/context/contracts/${address}/script`;
  const script = await octezClientGET(uri);
  return JSON.parse(script);
}
