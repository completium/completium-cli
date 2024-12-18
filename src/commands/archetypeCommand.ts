import fs from "fs";
import { ContractManager } from "../utils/managers/contractManager";
import { Options } from "../utils/options";
import { Printer } from "../utils/printer";
import { handleError } from "../utils/errorHandler";
import { ArchetypeManager } from "../utils/managers/archetypeManager";
import { process_code_const } from "../utils/michelson";
import { ArchetypeContractParameters } from "../utils/archetype";
import { ConfigManager } from "../utils/managers/configManager";

async function generateCodeGen(path: string, options: Options, target: 'michelson' | 'javascript') {
  const value = path;
  const parameters = options.iparameters !== undefined ? JSON.parse(options.iparameters) : undefined;
  const parametersMicheline = options.iparametersMicheline !== undefined ? JSON.parse(options.iparametersMicheline) : options.iparametersMicheline;
  const json = options.json || false;
  let sandbox_exec_address = options.sandbox_exec_address;

  const contract = ContractManager.getContractByName(value);

  let file: string = value;
  if (contract && contract.source) {
    file = contract.source;
  }

  if (!file || !fs.existsSync(file)) {
    handleError(`File not found: '${file}'`)
  }

  const is_sandbox_exec_here = ConfigManager.is_sandbox_exec(file);
  if (!sandbox_exec_address && is_sandbox_exec_here) {
    const network = ConfigManager.getNetwork();
    sandbox_exec_address = ConfigManager.getSandboxExecAddress(network);
    if (!sandbox_exec_address) {
      handleError(`Cannot fetch sandbox_exec address for network: ${network}.`)
    }
  }

  let code = await ArchetypeManager.callArchetype(options, file, {
    target: target,
    json: json,
    sandbox_exec_address: sandbox_exec_address
  });

  const with_parameters = await ArchetypeManager.callArchetype(options, file, {
    with_parameters: true,
    sandbox_exec_address: sandbox_exec_address
  });
  if (with_parameters !== "") {
    const contract_parameter: ArchetypeContractParameters = JSON.parse(with_parameters);
    code = process_code_const(code, parameters, parametersMicheline, contract_parameter);
  }

  Printer.print(code);
}


export async function generateMichelson(path: string, options: Options) {
  await generateCodeGen(path, options, 'michelson')
}

export async function generateJavascript(path: string, options: Options) {
  await generateCodeGen(path, options, 'javascript')
}
