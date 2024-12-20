import fs from 'fs';
import { getViewReturnType, getBalanceFor, getChainId, isValidPkh, postRunView, postRunGetter } from "../utils/tezos";
import { handleError } from "../utils/errorHandler";
import { Options } from "../utils/options";
import { Printer } from "../utils/printer";
import { AccountsManager } from "../utils/managers/accountsManager";
import { ConfigManager } from "../utils/managers/configManager";
import { TezosClientManager } from "../utils/managers/tezosClientManager";
import { extractGlobalAddress } from "../utils/regExp";
import { ContractManager } from "../utils/managers/contractManager";
import { expr_micheline_to_json, json_micheline_to_expr } from "../utils/michelson";
import { Expr } from '@taquito/michel-codec'
import { taquitoExecuteSchema } from "../utils/taquito";
import { ArchetypeManager } from "../utils/managers/archetypeManager";

function buildJArg(options: Options) {
  let jarg;
  if (options.arg) {
    jarg = expr_micheline_to_json(options.arg)
  } else if (options.argMichelson) {
    jarg = expr_micheline_to_json(options.argMichelson)
  } else if (options.argJsonMichelson) {
    const expr: Expr = JSON.parse(options.argJsonMichelson);
    jarg = expr_micheline_to_json(json_micheline_to_expr(expr));
  } else {
    jarg = expr_micheline_to_json("Unit")
  }
  return jarg;
}

/**
 * Handles the `get balance for` command.
 * @param address - The Tezos address to fetch the balance for.
 */
export const getBalanceCommand = async (value: string, options: Options) => {
  let pkh = value;
  const account = AccountsManager.getAccountByName(value)
  if (account) {
    pkh = account.pkh;
  }

  if (!isValidPkh(pkh)) {
    handleError(`Invalid Tezos address: ${pkh}`);
  }

  try {
    const balance = await getBalanceFor(pkh);
    Printer.print(`${balance.toNumber() / 1000000} ꜩ`);
  } catch (err) {
    handleError(`Failed to fetch balance for ${pkh}`);
  }
};

export async function registerGlobalConstant(value: string, options: Options) {
  const force = options.force;

  const alias = options.as ?? ConfigManager.getDefaultAccount();
  const account = AccountsManager.getAccountByNameOrPkh(alias);

  if (!account) {
    const msg = `Account '${alias}' is not found.`;
    return new Promise((resolve, reject) => { reject(msg) });
  }

  const args = ["register", "global", "constant", value, "from", account.pkh, "--burn-cap", "20"];
  const { stdout, stderr, failed } = await TezosClientManager.callDryTezosClient(args);
  if (failed) {
    if (!force) {
      throw (stderr)
    } else {
      return {
        status: "error",
        stdout: stdout,
        stderr: stderr
      }
    }
  } else {
    Printer.print(stdout);
    const global_address = extractGlobalAddress(stdout);
    return {
      status: "passed",
      global_address: global_address,
      stdout: stdout,
      stderr: stderr
    }
  }
}

export async function runView(viewId: string, contractId: string, options: Options): Promise<string> {
  const json = options.json;
  const taquito_schema = options.taquito_schema === undefined ? false : options.taquito_schema;

  const jarg = buildJArg(options);

  let contract_address = null;
  if (contractId.startsWith("KT1")) {
    contract_address = contractId;
  } else {
    const contract = ContractManager.getContractByName(contractId);
    if (contract) {
      contract_address = contract.address;
    }
  }

  if (contract_address == null) {
    const msg = `Contract not found: ${contractId}`;
    return new Promise((resolve, reject) => { reject(msg) });
  }

  const as = options.as ?? ConfigManager.getDefaultAccount();
  const account = AccountsManager.getAccountByNameOrPkh(as);
  let account_address = as;
  if (account) {
    account_address = account.pkh;
  }
  if (!isValidPkh(account_address)) {
    const msg = `Invalid address: ${account_address}`;
    return new Promise((resolve, reject) => { reject(msg) });
  }

  const chainid = await getChainId();

  const payload = {
    "chain_id": chainid,
    "contract": contract_address,
    "view": viewId,
    "unlimited_gas": true,
    "gas": undefined,
    "input": jarg,
    "payer": account_address,
    "source": account_address,
    "now": undefined,
    "level": undefined,
    "unparsing_mode": "Readable"
  }

  const res: { data: Expr } = await postRunView(payload);

  if (taquito_schema) {
    const ty = await getViewReturnType(contract_address, viewId);
    return taquitoExecuteSchema(res.data, ty);
  }
  if (json) {
    return JSON.stringify(res.data);
  }
  return json_micheline_to_expr(res.data);
}

export async function printRunView(viewId: string, contract: string, options: Options) {
  try {
    const res = await runView(viewId, contract, options);
    Printer.print(res);
  } catch (error) {
    Printer.error(error)
  }
}

export async function checkMichelson(path : string, options: Options) {
  if (!fs.existsSync(path)) {
    Printer.error(`File not found.`);
    return new Promise(resolve => { resolve(null) });
  }

  let michelson_path = null
  if (path.endsWith('tz')) {
    michelson_path = path
  } else {
    const res = await ArchetypeManager.callArchetype(options, path, {
      target: 'michelson'
    });

    const tmp = require('tmp');
    const tmpobj = tmp.fileSync();

    michelson_path = tmpobj.name;
    fs.writeFileSync(michelson_path, res);
  }

  const args = ["typecheck", "script", michelson_path];
  const { stdout, stderr, failed } = await TezosClientManager.callMockupTezosClient(args);
  if (failed) {
    Printer.error(stderr.trim());
  } else {
    Printer.print(stdout.trim());
  }
}

export async function runGetter(getterId: string, contractId: string, options: Options): Promise<string> {
  const json = options.json;

  const jarg = buildJArg(options);

  let contract_address = null;
  if (contractId.startsWith("KT1")) {
    contract_address = contractId;
  } else {
    const contract = ContractManager.getContractByName(contractId);
    if (contract) {
      contract_address = contract.address;
    }
  }

  if (contract_address == null) {
    const msg = `Contract not found: ${contractId}`;
    return new Promise((resolve, reject) => { reject(msg) });
  }

  const as = options.as ?? ConfigManager.getDefaultAccount();
  const account = AccountsManager.getAccountByNameOrPkh(as);
  let account_address = as;
  if (account) {
    account_address = account.pkh;
  }
  if (!isValidPkh(account_address)) {
    const msg = `Invalid address: ${account_address}`;
    return new Promise((resolve, reject) => { reject(msg) });
  }

  const chainid = await getChainId();

  const payload = {
    "chain_id": chainid,
    "contract": contract_address,
    "entrypoint": getterId,
    "gas": "100000",
    "input": jarg,
    "payer": account_address,
    "source": account_address,
    "unparsing_mode": "Readable"
  }

  const res: { data: Expr } = await postRunGetter(payload);

  if (json) {
    return JSON.stringify(res.data);
  }
  return json_micheline_to_expr(res.data);
}

export async function printRunGetter(getterId: string, contract: string, options: Options) {
  try {
    const res = await runGetter(getterId, contract, options);
    Printer.print(res);
  } catch (error) {
    Printer.error(error)
  }
}