import axios from "axios";
import { handleNetworkError } from "./errorHandler";
import BigNumber from "bignumber.js";
import { ConfigManager } from "./managers/configManager";
import { TezosClientManager } from "./managers/tezosClientManager";
import { rpcGet, rpcPost } from "./tools";
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

async function octezClientGET(uri: string): Promise<any> {
  if (ConfigManager.isOctezClientConfig()) {
    const args = ["rpc", "get", uri]
    const res = await TezosClientManager.callTezosClient(args);
    return JSON.stringify(res.stdout);
  } else {
    try {
      const rpcUrl = ConfigManager.getEndpoint();
      const res = await rpcGet<any>(rpcUrl, uri);
      return res;
    } catch (err: any) {
      handleNetworkError(err); // Handle network-specific errors
      throw err; // Rethrow to stop further execution
    }
  }
}

async function octezClientPOST<T>(uri: string, payload: T): Promise<any> {
  if (ConfigManager.isOctezClientConfig()) {
    const args = ["rpc", "post", uri, "with", JSON.stringify(payload)];
    const res = await TezosClientManager.callTezosClient(args);
    return res.stdout;
  } else {
    try {
      const rpcUrl = ConfigManager.getEndpoint();
      const res = await rpcPost<T, string>(rpcUrl, uri, payload);
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

export async function postRunView(payload : any): Promise<any> {
  const uri = `/chains/main/blocks/head/helpers/scripts/run_script_view`;
  const res = await octezClientPOST<any>(uri, payload);
  return res;
}

export async function postRunGetter(payload : any): Promise<any> {
  const uri = `/chains/main/blocks/head/helpers/scripts/run_view`;
  const res = await octezClientPOST<any>(uri, payload);
  return res;
}

async function getMainBlocksHeadHeader<T>(): Promise<T> {
  const uri = `/chains/main/blocks/head/header`;
  const res = await octezClientGET(uri);
  return res as T;
}

export async function getProtocol(): Promise<string> {
  const res = await getMainBlocksHeadHeader<{protocol : string}>();
  return res.protocol;
}

export async function getChainId(): Promise<string> {
  const res = await getMainBlocksHeadHeader<{chain_id : string}>();
  return res.chain_id;
}

export async function getLevel(): Promise<number> {
  const res = await getMainBlocksHeadHeader<{level : number}>();
  return res.level;
}

export async function getViewReturnType(contract_address : string, viewid : string) {
  const uri = `/chains/main/blocks/head/context/contracts/${contract_address}`;
  const c = await octezClientGET(uri);
  for (let i = 0; i < c.script.code.length; ++i) {
    const p = c.script.code[i];
    if (p.prim == "view" && p.args[0].string == viewid) {
      return p.args[2]
    }
  }
  throw new Error(`Error: view "${viewid}" not found.`)
}