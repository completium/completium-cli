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
import { getAmount } from '../utils/archetype';

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

async function run_internal(path : string, options : Options) : Promise<string> {
  const arg = options.argMichelson !== undefined ? options.argMichelson : "Unit";
  const entry = options.entry !== undefined ? options.entry : "default";
  const trace = options.trace === undefined ? false : options.trace;
  const verbose = options.verbose === undefined ? false : options.verbose;

  let amount = 0;
  if (options.amount) {
    amount = getAmount(options.amount);
    if (!amount) {
      const msg = `Invalid amount`;
      return new Promise((resolve, reject) => { reject(msg) });
    }
  }

  let michelson_path = null;
  let d_storage = options.storage;
  if (path.endsWith('tz')) {
    michelson_path = path
    if (d_storage === undefined) {
      d_storage = 'Unit'
    }
  } else {
    const tmp = require('tmp');
    const tmpobj = tmp.fileSync();

    const script_raw = await ArchetypeManager.callArchetype(options, path, { target: "michelson" }); // TODO: handle parameters
    const d_path_script = tmpobj.name;
    fs.writeFileSync(d_path_script, script_raw);

    if (d_storage === undefined) {
      d_storage = await ArchetypeManager.callArchetype(options, path, { target: "michelson-storage" });
    }
    michelson_path = tmpobj.name;
  }

  const d_amount = (amount / 1000000).toString();

  const args : string[] = [
    "run", "script", michelson_path, "on", "storage", d_storage, "and", "input", arg, "--entrypoint", entry, "--amount", d_amount
  ];
  if (options.opt_balance) {
    args.push("--balance")
    args.push(options.opt_balance)
  }
  if (options.opt_source) {
    args.push("--source")
    args.push(options.opt_source)
  }
  if (options.opt_payer) {
    args.push("--payer")
    args.push(options.opt_payer)
  }
  if (options.opt_self_address) {
    args.push("--self-address")
    args.push(options.opt_self_address)
  }
  if (options.opt_now) {
    args.push("--now")
    args.push(options.opt_now)
  }
  if (options.opt_level) {
    args.push("--level")
    args.push(options.opt_level)
  }

  if (trace) {
    args.push("--trace-stack");
  }

  if (verbose) {
    Printer.print(args);
  }
  const { stdout, stderr, failed } = await TezosClientManager.callTezosClient(args);
  if (failed) {
    return new Promise((resolve, reject) => { reject(stderr) });
  } else {
    return new Promise((resolve, reject) => { resolve(stdout) });
  }
}

export async function printRun(path : string, options : Options) {
  try {
    const stdout = await run_internal(path, options);
    Printer.print(stdout.trim())
  } catch (error) {
    Printer.error((error as Error).toString().trim())
  }
}