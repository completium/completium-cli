import BigNumber from "bignumber.js";
import { getBalanceFor } from "./utils/tezos";
import { RPC_URL } from "./utils/constants";

/**
 * Placeholder for other services to be implemented.
 * Throws an error indicating that the service is not implemented yet.
 * @param serviceName - The name of the service being accessed.
 */
export function notImplemented(serviceName: string): never {
  throw new Error(`[Library Error]: The service "${serviceName}" is not implemented yet.`);
}

export const deploy = () => notImplemented("deploy")
export const originate = () => notImplemented("originate")
export const call = () => notImplemented("call")
export const runGetter = () => notImplemented("runGetter")
export const runView = () => notImplemented("runView")
export const getStorage = () => notImplemented("getStorage")
export const getContract = () => notImplemented("getContract")

export async function getBalance(alias: string, obj : any): Promise<BigNumber> {
  return await getBalanceFor(alias);
}

export const retrieveBalanceFor = () => notImplemented("retrieveBalanceFor")
export const setAccount = () => notImplemented("setAccount")
export const setEndpoint = () => notImplemented("setEndpoint")
export const getAddress = () => notImplemented("getAddress")
export const getAccount = () => notImplemented("getAccount")
export const pack = () => notImplemented("pack")
export const packTyped = () => notImplemented("packTyped")
export const blake2b = () => notImplemented("blake2b")
export const keccak = () => notImplemented("keccak")
export const setNow = () => notImplemented("setNow")
export const setMockupNow = () => notImplemented("setMockupNow")
export const getMockupNow = () => notImplemented("getMockupNow")
export const setMockupLevel = () => notImplemented("setMockupLevel")
export const getMockupLevel = () => notImplemented("getMockupLevel")
export const setMockupChainId = () => notImplemented("setMockupChainId")
export const getChainId = () => notImplemented("getChainId")
export const mockupBake = () => notImplemented("mockupBake")
export const transfer = () => notImplemented("transfer")
export const sign = () => notImplemented("sign")
export const signFromSk = () => notImplemented("signFromSk")
export const exprMichelineToJson = () => notImplemented("exprMichelineToJson")
export const jsonMichelineToExpr = () => notImplemented("jsonMichelineToExpr")
export const setQuiet = () => notImplemented("setQuiet")
export const checkBalanceDelta = () => notImplemented("checkBalanceDelta")
export const getValueFromBigMap = () => notImplemented("getValueFromBigMap")
export const expectToThrow = () => notImplemented("expectToThrow")
export const getEndpoint = () => notImplemented("getEndpoint")
export const isMockup = () => notImplemented("isMockup")
export const exprMichelineFromArg = () => notImplemented("exprMichelineFromArg")
export const taquitoExecuteSchema = () => notImplemented("taquitoExecuteSchema")
export const generateContractInterface = () => notImplemented("generateContractInterface")
export const getRawStorage = () => notImplemented("getRawStorage")
export const exec_batch = () => notImplemented("exec_batch")
export const getKeysFrom = () => notImplemented("getKeysFrom")
export const registerGlobalConstant = () => notImplemented("registerGlobalConstant")
export const mockupInit = () => notImplemented("mockupInit")
export const importContract = () => notImplemented("importContract")
export const rpcGet = () => notImplemented("rpcGet")
export const getContractScript = () => notImplemented("getContractScript")
export const getStorageType = () => notImplemented("getStorageType")
export const getParameterType = () => notImplemented("getParameterType")
export const build_json_type = () => notImplemented("build_json_type")
export const get_sandbox_exec_address = () => notImplemented("get_sandbox_exec_address")
export const interp = () => notImplemented("interp")




