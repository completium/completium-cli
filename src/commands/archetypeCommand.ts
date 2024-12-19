import fs from "fs";
import glob from 'glob';
import path from 'path';
import { ContractManager } from "../utils/managers/contractManager";
import { Options } from "../utils/options";
import { Printer } from "../utils/printer";
import { handleError } from "../utils/errorHandler";
import { ArchetypeManager, Settings } from "../utils/managers/archetypeManager";
import { process_code_const } from "../utils/michelson";
import { ArchetypeContractParameters } from "../utils/archetype";
import { ConfigManager } from "../utils/managers/configManager";
import * as binderTs from '@completium/archetype-binder-ts';
import { MockupConfigManager } from "../utils/managers/mockupConfigManager";

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

async function generateGen(value: string, options: Options, settings: Settings): Promise<string | null> {

  const contract = ContractManager.getContractByNameOrAddress(value);

  let path = value;
  if (!!contract && contract.source) {
    path = contract.source;
  }

  if (!fs.existsSync(path)) {
    handleError(`File not found.`)
  }

  try {
    const res = await ArchetypeManager.callArchetype(options, path, settings);
    return res
  } catch (e) {
    return null
  }
}

async function generate_target(path: string, options: Options, target: string) {
  return await generateGen(path, options, {
    target: target
  })
}

async function printGenerateTarget(path: string, options: Options, target: string): Promise<void> {
  const res = await generate_target(path, options, target);
  Printer.print(res)
}

async function generateUnitBindingTs(ipath: string, target: binderTs.Target, with_dapp_originate: boolean): Promise<string | null> {
  try {
    const is_michelson = ipath.endsWith(".tz");
    const is_archetype = ipath.endsWith(".arl");
    let sandbox_exec_address = undefined
    if (is_archetype && ConfigManager.is_sandbox_exec(ipath)) {
      const network = ConfigManager.getNetwork();
      sandbox_exec_address = ConfigManager.getSandboxExecAddress(network);
    }
    const dir_path = path.dirname(ipath) + '/';
    const contract_interface = await generateContractInterface(ipath, { sandbox_exec_address: sandbox_exec_address }, is_michelson);
    if (!contract_interface) {
      return null;
    }
    const json = JSON.parse(contract_interface);
    let settings: binderTs.BindingSettings = {
      target: target,
      language: is_michelson ? binderTs.Language.Michelson : binderTs.Language.Archetype,
      path: dir_path,
      with_dapp_originate: undefined,
      mich_code: undefined,
      mich_storage: undefined,
    }
    if (with_dapp_originate && target == binderTs.Target.Dapp && !is_michelson) {
      const input = await ArchetypeManager.callArchetype({}, ipath, {
        target: "michelson",
        compiler_json: true
      });
      if (input) {
        const v_input = JSON.parse(input);
        const mich_code = v_input.code;
        const mich_storage = v_input.storage;
        settings = {
          ...settings,
          with_dapp_originate: with_dapp_originate,
          mich_code: mich_code,
          mich_storage: mich_storage
        }
      }
    }
    const binding = binderTs.generate_binding(json, settings);
    return binding;
  } catch (e) {
    return null
  }
}

async function printGenerateBindingTsGen(ipath: string, options: Options, target: binderTs.Target) {
  const input_path = options.input_path;
  const output_path = options.output_path;
  const with_dapp_originate = options.with_dapp_originate ?? false;
  if (!!input_path) {
    if (!output_path) {
      const msg = `output path not set (--output-path)`;
      return new Promise((resolve, reject) => { reject(msg) });
    }

    const files = glob.sync(`${input_path}/**/*[.arl|.tz]`)

    for (let i = 0; i < files.length; i++) {
      const input = files[i];
      if (fs.lstatSync(input).isDirectory()) {
        continue
      }
      if (input.endsWith(".tz")) {
        const file_arl = input.substring(0, input.length - 2) + 'arl';
        if (fs.existsSync(file_arl)) {
          continue
        }
      }
      const output_tmp = input.replace(input_path, output_path);
      const output = path.format({ ...path.parse(output_tmp), base: '', ext: '.ts' })

      const content = await generateUnitBindingTs(input, target, with_dapp_originate)
      if (content == null) {
        Printer.error(`Invalid file ${input}`)
        continue;
      }

      const output_dir = path.dirname(output);

      if (!fs.existsSync(ipath)) {
        fs.mkdirSync(output_dir, { recursive: true });
      }

      fs.writeFileSync(output, content);
      Printer.print(`Wrote ${output}`);
    }
  } else {
    const res = await generateUnitBindingTs(ipath, target, with_dapp_originate);
    Printer.print(res)
  }
}

async function generateContractInterface(path: string, options: Options, is_michelson: boolean) {
  let obj;
  if (is_michelson) {
    obj = {
      contract_interface_michelson: true,
      sandbox_exec_address: options.sandbox_exec_address
    }
  } else {
    obj = {
      contract_interface: true,
      sandbox_exec_address: options.sandbox_exec_address
    }
  }
  return await generateGen(path, options, obj)
}

export async function generateMichelson(path: string, options: Options): Promise<void> {
  await generateCodeGen(path, options, 'michelson')
}

export async function generateJavascript(path: string, options: Options): Promise<void> {
  await generateCodeGen(path, options, 'javascript')
}

export async function printGenerateWhyml(path: string, options: Options): Promise<void> {
  await printGenerateTarget(path, options, 'whyml')
}

export async function printGenerateEventBindingJs(path: string, options: Options): Promise<void> {
  await printGenerateTarget(path, options, 'bindings-js')
}

export async function printGenerateEventBindingTs(path: string, options: Options): Promise<void> {
  await printGenerateTarget(path, options, 'bindings-ts')
}

export async function printGenerateBindingTs(path: string, options: Options) {
  await printGenerateBindingTsGen(path, options, binderTs.Target.Experiment);
}

export async function printGenerateBindingDappTs(path: string, options: Options) {
  await printGenerateBindingTsGen(path, options, binderTs.Target.Dapp);
}

export async function printGenerateContractInterface(path: string, options: Options) {
  const is_michelson = path.endsWith(".tz");
  const res = await generateContractInterface(path, options, is_michelson);
  Printer.print(res)
}

export async function printDecompile(value : string, options : Options) {
  const output = await ArchetypeManager.decompile(value);
  Printer.print(output)
}
