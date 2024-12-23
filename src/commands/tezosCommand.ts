import fs from 'fs';
import path from 'path';
import { getViewReturnType, getBalanceFor, getChainId, isValidPkh, postRunView, postRunGetter, getEntrypoints, getContractScript, EntrypointsTezos, getContract } from "../utils/tezos";
import { handleError } from "../utils/errorHandler";
import { Options } from "../utils/options";
import { Printer } from "../utils/printer";
import { AccountsManager } from "../utils/managers/accountsManager";
import { ConfigManager } from "../utils/managers/configManager";
import { TezosClientManager } from "../utils/managers/tezosClientManager";
import { extract_trace_interp, extractFailWith, extractGlobalAddress, handle_fail } from "../utils/regExp";
import { ContractManager } from "../utils/managers/contractManager";
import { build_data_michelson, build_from_js, buildStorage, compute_tzstorage, expr_micheline_to_json, json_micheline_to_expr, process_code_const } from "../utils/michelson";
import { Expr } from '@taquito/michel-codec'
import { getTezos, taquitoExecuteSchema } from "../utils/taquito";
import { ArchetypeManager, Settings } from "../utils/managers/archetypeManager";
import { getAmount } from '../utils/archetype';
import { Account } from '../utils/types/configuration';
import { askQuestionBool } from '../utils/interaction';
import { ContractStorageType, DefaultContractType, OriginateParams, OriginationOperation, TransactionOperation } from '@taquito/taquito';
import * as codec from '@taquito/michel-codec';
import { LogManager, LogTransation } from '../utils/managers/logManager';

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

export async function checkMichelson(path: string, options: Options) {
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

async function run_internal(path: string, options: Options): Promise<string> {
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

  const args: string[] = [
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

export async function printRun(path: string, options: Options) {
  try {
    const stdout = await run_internal(path, options);
    Printer.print(stdout)
  } catch (error) {
    Printer.error((error as Error).toString().trim())
  }
}

export async function interp(path: string, options: Options) {
  let stdout;
  try {
    stdout = await run_internal(path, options);
  } catch (e) {
    return handle_fail((e as Error).toString())
  }
  return extract_trace_interp(stdout)
}

export async function printInterp(path: string, options: Options) {
  const json = await interp(path, options)
  Printer.print(JSON.stringify(json))
}

async function confirmTransfer(force: boolean, amount: number, from: Account, to: string) {
  if (force) { return true }

  const str = `Confirm transfer ${amount / 1000000} ꜩ from ${from.name} to ${to} on ${ConfigManager.getNetwork()}?`;
  return new Promise(resolve => { askQuestionBool(str, answer => { resolve(answer); }) });
}

export async function transfer(amount_raw: string, from_raw: string, to_raw: string, options: Options) {
  const force = options.force ?? false;

  const amount = getAmount(amount_raw);
  if (!amount) {
    Printer.print(`'${amount_raw}' is not valid.`);
    return;
  }

  const accountFrom = AccountsManager.getAccountByNameOrPkh(from_raw);
  if (!accountFrom) {
    Printer.print(`'${from_raw}' is not found.`);
    return;
  }
  var accountTo = AccountsManager.getAccountByNameOrPkh(to_raw);
  const to = accountTo ? accountTo.pkh : to_raw;
  if (!isValidPkh(to)) {
    Printer.error(`'${to_raw}' bad account or address.`);
    return;
  }

  var confirm = await confirmTransfer(force, amount, accountFrom, to);
  if (!confirm) {
    return;
  }

  const to_addr = accountTo ? accountTo.pkh : to;

  const network = ConfigManager.getNetworkByName(ConfigManager.getNetwork());

  Printer.print(`Transfering ${amount / 1000000} ꜩ from ${accountFrom.pkh} to ${to_addr}...`);
  if (ConfigManager.isMockupMode()) {
    const a = (amount / 1000000).toString();
    const args = ["transfer", a, "from", accountFrom.pkh, "to", to_addr, "--burn-cap", "0.06425"];
    const { stdout, stderr, failed } = await TezosClientManager.callTezosClient(args);
    if (failed) {
      return new Promise((resolve, reject) => { reject(stderr) });
    } else {
      Printer.print(stdout);
    }
    return new Promise(resolve => { resolve(null) });
  } else {
    const tezos = getTezos(accountFrom.name);
    return new Promise((resolve, reject) => {
      tezos.contract
        .transfer({ to: to_addr, amount: amount, mutez: true })
        .then((op: TransactionOperation) => {
          Printer.print(`Waiting for ${op.hash} to be confirmed...`);
          op.confirmation(1)
            .then((_: number) => {
              const op_inj = network && network.tzstat_url === undefined ? `${op.hash}` : `${network ? network.tzstat_url : ''}/${op.hash}`
              Printer.print(`Operation injected: ${op_inj}`);
              resolve(op.hash);
            })
            .catch((error: Error) => {
              reject(`Error: ${error} ${JSON.stringify(error, null, 2)}`);
            });
        })
        .catch((error: Error) => {
          reject(`Error: ${error} ${JSON.stringify(error, null, 2)}`);
        });
    });
  }
}

function print_deploy_settings(with_color: boolean, account: Account, contract_id: string, amount: number, storage: string, estimated_total_cost: number | null, network: string) {
  const cyan = '36';
  const start = with_color ? `\x1b[${cyan}m` : '';
  const end = with_color ? `\x1b[0m` : '';
  Printer.print(`Originate settings:`);
  Printer.print(`  ${start}network${end}\t: ${network}`);
  Printer.print(`  ${start}contract${end}\t: ${contract_id}`);
  Printer.print(`  ${start}as${end}\t\t: ${account.name}`);
  Printer.print(`  ${start}send${end}\t\t: ${amount / 1000000} ꜩ`);
  Printer.print(`  ${start}storage${end}\t: ${storage}`);
  if (estimated_total_cost != null) {
    Printer.print(`  ${start}total cost${end}\t: ${estimated_total_cost / 1000000} ꜩ`);
  }
}

async function confirmDeploy(force: boolean, account: Account, contract_id: string, amount: number, storage: string, estimated_total_cost: number, network: string) {
  if (force) { return true }

  print_deploy_settings(true, account, contract_id, amount, storage, estimated_total_cost, network);
  return new Promise(resolve => { askQuestionBool("Confirm settings", answer => { resolve(answer); }) });
}

async function confirmContract(force: boolean, id: string) {
  if (force || (ContractManager.getContractByName(id) == null)) { return true }

  const str = `${id} already exists, overwrite it?`;
  return new Promise(resolve => { askQuestionBool(str, answer => { resolve(answer); }) });
}

export async function deploy(file: string, originate: boolean, options: Options): Promise<[string, (OriginationOperation<DefaultContractType> | null)] | null> {
  const as = options.as;
  const force = options.force ?? false;
  const named = options.named;
  const networkName = ConfigManager.getNetwork();
  const network = ConfigManager.getNetworkByName(networkName);
  const dry = options.dry;
  const oinit = options.init;
  const contract_json = options.contract_json;
  const storage_json = options.storage_json;
  const parameters = options.iparameters !== undefined ? JSON.parse(options.iparameters) : options.parameters;
  const parametersMicheline = options.iparametersMicheline !== undefined ? JSON.parse(options.iparametersMicheline) : options.parametersMicheline;
  const otest = options.test;
  const mockup_mode = ConfigManager.isMockupMode();
  const force_tezos_client = options.force_tezos_client ?? ConfigManager.isForceOctezClient();
  const show_tezos_client_command = options.show_tezos_client_command === undefined ? false : options.show_tezos_client_command;
  const init_obj_mich = options.init_obj_mich;
  const is_sandbox_exec_here = ConfigManager.is_sandbox_exec(file);
  let sandbox_exec_address = options.sandbox_exec_address;

  if (!network) {
    const msg = `Network not found.`;
    return new Promise((resolve, reject) => { reject(msg) });
  }

  if (!sandbox_exec_address && is_sandbox_exec_here) {
    sandbox_exec_address = ConfigManager.getSandboxExecAddress(network.network);
    if (!sandbox_exec_address) {
      const msg = `Cannot fetch sandbox_exec address for network: ${network.network}.`;
      return new Promise((resolve, reject) => { reject(msg) });
    }
  }

  if (otest && originate) {
    const msg = `Cannot originate a contract in test mode.`;
    return new Promise((resolve, reject) => { reject(msg) });
  }

  if (otest && mockup_mode) {
    const msg = `Cannot deploy a contract in test mode on mockup mode.`;
    return new Promise((resolve, reject) => { reject(msg) });
  }

  if (otest && network.network === "main") {
    const msg = `Cannot deploy a contract in test mode on mainnet.`;
    return new Promise((resolve, reject) => { reject(msg) });
  }

  const alias = as ?? ConfigManager.getDefaultAccount();
  const account = AccountsManager.getAccountByNameOrPkh(alias);
  if (!account) {
    const msg = `Invalid account ${alias}.`;
    return new Promise((resolve, reject) => { reject(msg) });
  }

  let amount = 0;
  if (options.amount) {
    amount = getAmount(options.amount);
    if (!amount) {
      const msg = `Invalid amount`;
      return new Promise((resolve, reject) => { reject(msg) });
    }
  }

  let fee = 0;
  if (options.fee) {
    fee = getAmount(options.fee);
    if (!fee) {
      const msg = `Invalid fee`;
      return new Promise((resolve, reject) => { reject(msg) });
    }
  }

  if (!!(contract_json) && !named) {
    const msg = `\`named\` field missing`;
    return new Promise((resolve, reject) => { reject(msg) });
  }

  const contract_name = named === undefined ? path.basename(file).split('.').slice(0, -1).join('.') : named;
  var confirm = await confirmContract(force || show_tezos_client_command, contract_name);
  if (!confirm) {
    const msg = `Not confirmed`
    return new Promise((resolve, reject) => { reject(msg) });
  }

  let code;
  if (!!contract_json) {
    code = json_micheline_to_expr(contract_json);
  } else {
    if (!fs.existsSync(file)) {
      const msg = `File not found.`;
      return new Promise((resolve, reject) => { reject(msg) });
    }
    if (originate) {
      const input = fs.readFileSync(file).toString();
      if (file.endsWith(".json")) {
        const jinput = JSON.parse(input);
        code = json_micheline_to_expr(jinput);
      } else {
        code = input;
      }
    } else {
      try {
        code = await ArchetypeManager.callArchetype(options, file, {
          target: "michelson",
          sci: account.pkh,
          sandbox_exec_address: sandbox_exec_address
        });
      } catch (e) {
        return new Promise((resolve, reject) => { reject(e) });
      }
    }
  }

  let contract_parameter = null;
  if (!originate) {
    const with_parameters = await ArchetypeManager.callArchetype(options, file, {
      with_parameters: true
    });
    if (with_parameters !== "") {
      if (!parameters && !parametersMicheline) {
        const msg = `The contract has the following parameter:\n${with_parameters}\nPlease use '--parameters' to initialize.`;
        return new Promise((resolve, reject) => { reject(msg) });
      } else {
        contract_parameter = JSON.parse(with_parameters);
      }
    }
  }

  if (contract_parameter != null) {
    code = process_code_const(code, parameters, parametersMicheline, contract_parameter);
  }

  let m_storage;
  if (!!storage_json) {
    m_storage = storage_json;
  } else if (!!oinit) {
    m_storage = expr_micheline_to_json(oinit);
  } else if (!!init_obj_mich) {
    const m_code = (new codec.Parser()).parseScript(code.toString());
    if (!m_code) {
      const msg = `m_code null`
      return new Promise((resolve, reject) => { reject(msg) });
    }
    const obj_storage: any = m_code.find((x: any) => x?.prim === "storage");
    if (!obj_storage) {
      const msg = `obj_storage null`
      return new Promise((resolve, reject) => { reject(msg) });
    }
    const storageType = obj_storage.args[0];
    if (!storageType) {
      const msg = `storageType null`
      return new Promise((resolve, reject) => { reject(msg) });
    }

    m_storage = buildStorage(storageType, init_obj_mich);
  } else if (!originate) {
    if (!parameters && !parametersMicheline) {
      try {
        const storage = await ArchetypeManager.callArchetype(options, file, {
          target: "michelson-storage",
          sci: account.pkh,
          sandbox_exec_address: sandbox_exec_address
        });
        m_storage = expr_micheline_to_json(storage);
      } catch (e) {
        return new Promise((resolve, reject) => { reject(e) });
      }
    } else {
      try {
        const m_code: any = expr_micheline_to_json(code);
        const obj_storage: any = m_code.find((x: any) => x?.prim === "storage");
        if (!obj_storage) {
          const msg = `obj_storage null`
          return new Promise((resolve, reject) => { reject(msg) });
        }
        const storageType = obj_storage.args[0];
        m_storage = await compute_tzstorage(file, storageType, parameters, parametersMicheline, contract_parameter, options, ArchetypeManager.computeSettings(options), sandbox_exec_address);
      } catch (e) {
        return new Promise((resolve, reject) => { reject(e) });
      }
    }
  } else {
    m_storage = expr_micheline_to_json("Unit");
  }

  const ext = originate ? 'tz' : 'arl';
  let source = null;
  if (!!file) {
    source = ContractManager.writeSource(file, ext, contract_name);
  }
  const contract_path = ContractManager.writeContract(code, contract_name);
  const version = await ArchetypeManager.getVersion();

  const tezos = getTezos(account.name);

  const deployInternal = async (): Promise<{ contract_address: string, storage: string, originationOp: (OriginationOperation<DefaultContractType> | null) } | null> => {
    if (dry) {
      // taquito.RpcPacker.preapplyOperations();
      Printer.print("TODO")
      return null;
    } else if (mockup_mode || force_tezos_client || show_tezos_client_command) {
      const a = (amount / 1000000).toString();
      const storage = codec.emitMicheline(m_storage);
      const args = [
        "originate", "contract", contract_name,
        "transferring", a, "from", account.pkh,
        "running", contract_path, "--init", storage,
        "--burn-cap", "20", "--force", "--no-print-source"
      ];
      if (show_tezos_client_command) {
        const cmd = TezosClientManager.getTezosClientArgs(args);
        Printer.print(cmd);
        return new Promise((resolve) => { resolve(null) })
      } else {
        print_deploy_settings(false, account, contract_name, amount, storage, null, networkName);
        const { stdout, stderr, failed } = await TezosClientManager.callTezosClient(args);
        if (ConfigManager.isLogMode() && mockup_mode) {
          LogManager.addLogOrigination({
            args_command: args,
            stdout: stdout,
            stderr: stderr,
            failed: failed,
            source: account.pkh,
            storage: storage,
            amount: a,
            name: contract_name
          })
        }
        if (failed) {
          return new Promise((resolve, reject) => { reject(stderr) });
        } else {
          Printer.print(stdout);
        }
        const homedir = require('os').homedir();
        const completium_dir = homedir + '/.completium'
        const mockup_path = completium_dir + "/mockup";
        const tezos_client_dir = homedir + '/.tezos-client'
        const path_contracts = (mockup_mode ? mockup_path : tezos_client_dir) + "/contracts";
        const inputContracts = fs.readFileSync(path_contracts, 'utf8');
        const cobj = JSON.parse(inputContracts);
        const o = cobj.find((x: any) => { return (x.name === contract_name) });
        const contract_address = o.value ?? null;
        return { contract_address, storage, originationOp: null }
      }
    } else {

      let m_code: any = expr_micheline_to_json(code);

      const originateParam: OriginateParams<ContractStorageType<DefaultContractType>> = {
        balance: amount,
        fee: fee > 0 ? fee : undefined,
        code: m_code,
        init: m_storage,
        mutez: true
      };

      const storage = codec.emitMicheline(m_storage);

      try {
        const res_estimate = await tezos.estimate.originate(originateParam);
        const estimated_total_cost = res_estimate.totalCost + 100;
        const cont = await confirmDeploy(force, account, contract_name, amount, storage, estimated_total_cost, networkName);
        if (!cont) {
          return null;
        }
        if (force) {
          print_deploy_settings(false, account, contract_name, amount, storage, estimated_total_cost, ConfigManager.getNetwork());
        } else {
          Printer.print(`Forging operation...`);
        }

      } catch (e) {
        return new Promise((resolve, reject) => { reject(e) });
      }

      const originationOp = await tezos.contract.originate(originateParam);
      const contract = await originationOp.contract();
      const contract_address = contract.address;
      return { contract_address, storage, originationOp }
    }
  }
  const resDeployInternal = await deployInternal();
  if (!resDeployInternal) {
    return null;
  }
  const { contract_address, storage, originationOp } = resDeployInternal;

  ContractManager.addContract({
    name: contract_name,
    address: contract_address,
    network: network.network,
    language: originate ? 'michelson' : 'archetype',
    compiler_version: originate ? '0' : version,
    path: contract_path,
    initial_storage: storage,
    source: source
  });
  Printer.print(`Origination completed for ${contract_address} named ${contract_name}.`);
  if (!mockup_mode) {
    const url = network.bcd_url.replace('${address}', contract_address);
    Printer.print(url);
  }
  return [contract_name, originationOp]
}

function print_settings(with_color: boolean, account: Account, contract_id: string, amount: number, entry: string, arg: string, network: string, estimated_total_cost?: number) {
  const cyan = '36';
  const start = with_color ? `\x1b[${cyan}m` : '';
  const end = with_color ? `\x1b[0m` : '';
  Printer.print(`Call settings:`);
  Printer.print(`  ${start}network${end}\t: ${network}`);
  Printer.print(`  ${start}contract${end}\t: ${contract_id}`);
  Printer.print(`  ${start}as${end}\t\t: ${account.name}`);
  Printer.print(`  ${start}send${end}\t\t: ${amount / 1000000} ꜩ`);
  Printer.print(`  ${start}entrypoint${end}\t: ${entry}`);
  Printer.print(`  ${start}argument${end}\t: ${arg}`);
  if (estimated_total_cost !== undefined) {
    Printer.print(`  ${start}total cost${end}\t: ${estimated_total_cost / 1000000} ꜩ`);
  }
}

async function confirmCall(force: boolean, account: Account, contract_id: string, amount: number, entry: string, arg: string, network: string, estimated_total_cost?: number) {
  if (force) { return true }
  print_settings(true, account, contract_id, amount, entry, arg, network, estimated_total_cost);
  return new Promise(resolve => { askQuestionBool("Confirm settings", answer => { resolve(answer); }) });
}

async function callTransfer(options: Options, contract_id: string, arg: Expr): Promise<any> {
  const force = options.force ?? false;
  const entry = options.entry === undefined ? 'default' : options.entry;
  const quiet = options.quiet === undefined ? false : options.quiet;
  const dry = options.dry === undefined ? false : options.dry;
  const mockup_mode = ConfigManager.isMockupMode();
  const force_tezos_client = options.force_tezos_client === undefined ? false : options.force_tezos_client;
  const verbose = options.verbose === undefined ? false : options.verbose;
  const show_tezos_client_command = options.show_tezos_client_command === undefined ? false : options.show_tezos_client_command;
  const only_param = options.only_param === undefined ? false : options.only_param;
  const networkName = ConfigManager.getNetwork();

  const as = options.as ?? ConfigManager.getDefaultAccount();
  const account = AccountsManager.getAccountByNameOrPkh(as);
  if (!account) {
    const msg = `Invalid account: ${as}`;
    return new Promise((resolve, reject) => { reject(msg) });
  }

  const contract = ContractManager.getContractByNameOrAddress(contract_id);
  let contract_address = contract_id;
  if (contract) {
    contract_address = contract.address;
  }
  if (!contract_address || !contract_address.startsWith('KT')) {
    const msg = `Invalid contract: ${as}`;
    return new Promise((resolve, reject) => { reject(msg) });
  }

  let amount = 0;
  if (options.amount) {
    amount = getAmount(options.amount);
    if (!amount) {
      const msg = `Invalid amount`;
      return new Promise((resolve, reject) => { reject(msg) });
    }
  }

  let fee = 0;
  if (options.fee) {
    fee = getAmount(options.fee);
    if (!fee) {
      const msg = `Invalid fee`;
      return new Promise((resolve, reject) => { reject(msg) });
    }
  }

  const transferParam = { to: contract_address, amount: amount, fee: fee > 0 ? fee : undefined, mutez: true, parameter: { entrypoint: entry, value: arg } };

  if (only_param) {
    const res = { kind: 'transaction', ...transferParam, cost: undefined }
    return res;
  }

  if (force_tezos_client || dry || mockup_mode || show_tezos_client_command) {
    const a = (amount / 1000000).toString();
    const b = codec.emitMicheline(arg);
    const args = [
      "transfer", a, "from", account.pkh, "to", contract_address,
      "--entrypoint", entry, "--arg", b,
      "--burn-cap", "20", "--no-print-source"];
    if (dry) {
      args.push('-D')
    }
    if (show_tezos_client_command) {
      const cmd = TezosClientManager.getTezosClientArgs(args);
      Printer.print(cmd);
      return new Promise((resolve) => { resolve(null) })
    } else {
      print_settings(false, account, contract_id, amount, entry, b, networkName);
      const { stdout, stderr, failed } = await TezosClientManager.callTezosClient(args);
      if (ConfigManager.isLogMode() && ConfigManager.isMockupMode()) {
        const logItem: LogTransation = {
          contract_address,
          args_command: args,
          stdout: stdout,
          stderr: stderr,
          failed: failed,
          entrypoint: entry,
          amount: a,
          arg: b,
          destination: contract_address,
          source: account.pkh,
          arg_completium: options.arg
        };
        LogManager.addLogTransaction(logItem)
      }
      const resItem = LogManager.aaa(stdout, stderr, failed);
      return resItem;
    }
  } else {
    const tezos = getTezos(account.name);

    const network = ConfigManager.getNetworkByName(networkName);
    if (!network) {
      const msg = `Invalid network: ${networkName}`;
      return new Promise((resolve, reject) => { reject(msg) });
    }

    try {
      const res = await tezos.estimate.transfer(transferParam);
      const estimated_total_cost = res.totalCost + 100;
      const arg_michelson = codec.emitMicheline(arg);
      var confirm = await confirmCall(force, account, contract_id, amount, entry, arg_michelson, networkName, estimated_total_cost);
      if (!confirm) {
        return;
      }

      if (force) {
        print_settings(false, account, contract_id, amount, entry, arg_michelson, networkName, estimated_total_cost);
      } else {
        Printer.print(`Forging operation...`);
      }
    } catch (er) {
      const e: { errors: Array<any> } = er as { errors: Array<any> };
      if (!!e) {
        let msgs: string[] = [];
        let contract;
        const errors = e.errors.map(x => x);
        let res: any | null = null;

        errors.forEach(x => {
          if (x.kind === "temporary" &&
            x.id !== undefined &&
            x.id.endsWith(".script_rejected") &&
            x.with !== undefined) {
            const d = codec.emitMicheline(x.with);
            res = { value: d };
          }
          if (x.contract_handle !== undefined || x.contract !== undefined) {
            contract = x.contract_handle !== undefined ? x.contract_handle : x.contract;
            const cid = ContractManager.getContractByNameOrAddress(contract);
            let msg = `Error from contract ${contract}`;
            if (!!cid) {
              msg += ` (${cid.name})`
            }
            msg += ":";
            msgs.push(msg);
          } else if (x.kind === "temporary" &&
            x.location !== undefined &&
            x.with !== undefined) {
            const d = codec.emitMicheline(x.with);
            const msg = `failed at ${x.location} with ${d}`;
            msgs.push(msg);
          }
          if (x.expected_type !== undefined && x.wrong_expression !== undefined) {
            const etyp = codec.emitMicheline(x.expected_type);
            const wexp = codec.emitMicheline(x.wrong_expression);
            let msg = `Invalid argument value '${wexp}'; excepting value of type '${etyp}'`;
            msgs.push(msg);
          }
        })
        if (!!res) {
          return new Promise((resolve, reject) => { reject({ ...res, msgs: msgs }) });
        } else {
          throw new Error(msgs.join("\n"));
        }
      } else {
        throw e
      }
    }

    return new Promise((resolve, reject) => {
      tezos.contract
        .transfer(transferParam)
        .then((op) => {
          Printer.print(`Waiting for ${op.hash} to be confirmed...`);
          return op.confirmation(1).then(() => op);
        })
        .then((op) => {
          const a = network.tzstat_url !== undefined ? `${network.tzstat_url}/${op.hash}` : `${op.hash}`;
          Printer.print(`Operation injected: ${a}`);
          return resolve(op)
        })
        .catch(
          error => {
            if (!quiet)
              Printer.print({ ...error, errors: '...' });
            reject(error);
          }
        );
    });
  }
}

async function getParamTypeEntrypoint(entry: string, contract_address: string): Promise<codec.MichelsonType> {
  const res: EntrypointsTezos = await getEntrypoints(contract_address);
  if (res) {
    return res.entrypoints[entry];
  } else if (entry === "default") {
    const s = await getContractScript(contract_address);
    const p = s.code.find(x => x.prim === "parameter");
    if (!p) {
      throw new Error("error");
    }
    const t = p.args[0];
    return t;
  } else {
    throw new Error("error");
  }
}

function isEmptyObject(obj: any) {
  if (typeof obj === 'object' && obj != null && Object.keys(obj).length !== 0) {
    return false;
  } else {
    return true;
  }
}

async function isContractExists(contract_address: string) {
  const res = await getContract(contract_address);
  return res !== null;
}

async function computeArg(args: any, paramType: any) {
  const michelsonData = build_data_michelson(paramType, args, {}, {});
  return michelsonData;
}

export async function callContract(input: string, options: Options): Promise<any> {
  const args = options.arg !== undefined && !isEmptyObject(options.arg) ? options.arg : (options.iargs !== undefined ? JSON.parse(options.iargs) : { prim: "Unit" });
  var argJsonMichelson = options.argJsonMichelson;
  var argMichelson = options.argMichelson;
  var entry = options.entry === undefined ? 'default' : options.entry;
  const networkName = ConfigManager.getNetwork();
  var contract_address = input;

  const contract = ContractManager.getContractByNameOrAddress(input);
  if (!!contract) {
    if (contract.network !== networkName) {
      const msg = `Expecting network ${contract.network}. Switch endpoint and retry.`;
      throw new Error(msg);
    }
    contract_address = contract.address;
  } else {
    if (!contract_address.startsWith('KT1')) {
      const msg = `'${contract_address}' unknown contract alias or bad contract address.`;
      throw new Error(msg);
    }
  }

  const e = await isContractExists(contract_address);
  if (!e) {
    const msg = `'${contract_address}' not found on ${networkName}.`;
    throw new Error(msg);
  }

  let paramType = await getParamTypeEntrypoint(entry, contract_address);
  if (entry == "default") {
    paramType = { ...paramType, annots: undefined }
  }
  if (!paramType) {
    const msg = `'${entry}' entrypoint not found.`;
    throw new Error(msg);
  }

  let arg;
  if (argJsonMichelson !== undefined) {
    arg = expr_micheline_to_json(json_micheline_to_expr(JSON.parse(argJsonMichelson)));
  } else if (argMichelson !== undefined) {
    arg = expr_micheline_to_json(argMichelson);
  } else {
    arg = await computeArg(args, paramType);
  }

  const res = await callTransfer(options, contract_address, arg);
  return res;
}
