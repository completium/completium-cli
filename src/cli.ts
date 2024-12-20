#!/usr/bin/env node

import { checkMichelson, getBalanceCommand, printRunGetter, printRunView, registerGlobalConstant } from "./commands/tezosCommand";
import arg from 'arg';
import { Options } from "./utils/options";
import { Printer } from "./utils/printer";
import { initCompletium } from "./commands/init";
import { VERSION } from "./utils/constants";
import { ArchetypeManager } from "./utils/managers/archetypeManager";
import { TezosClientManager } from "./utils/managers/tezosClientManager";
import { mockupInitCommand, mockupSetNowCommand } from "./commands/mockup";
import { handleError } from "./utils/errorHandler";
import { switchAccount, switchEndpoint, switchMode } from "./commands/switchCommand";
import { ConfigManager } from "./utils/managers/configManager";
import { Config } from "./utils/types/configuration";
import { generateAccount, importPrivatekey, removeAccount, renameAccount, setAccount, showAccount, showAccounts, showKeysFrom } from "./commands/account";
import { importContract, printContract, removeContract, renameContract, showAddress, showContract, showContracts, showEntries, showScript, showSource, showStorage, showUrl } from "./commands/contract";
import { generateJavascript, generateMichelson, printDecompile, printGenerateBindingDappTs, printGenerateBindingTs, printGenerateContractInterface, printGenerateEventBindingJs, printGenerateEventBindingTs, printGenerateWhyml } from "./commands/archetypeCommand";
import { LogManager } from "./utils/managers/logManager";
import { createProject, printCompletiumProperty } from "./commands/projectCommand";

interface ParsedCommand {
  command?: string;
  value?: string;
  name?: string;
  bin?: string;
  network_?: string;
  endpoint?: string;
  account?: string;
  from?: string;
  to?: string;
  file?: string;
  originate?: boolean,
  contract?: string,
  path?: string,
  getterid?: string,
  viewid?: string,
  options: Options;
}

/**
 * Parse command-line arguments to identify the command and its options.
 * @param args - The arguments from process.argv.
 * @returns Parsed command and options.
 */
function parseCommand(args: string[]): ParsedCommand {
  const length = args.length;

  var res = {};
  var nargs: string[] = [];

  // init
  if (length > 2 && args[2] === "init") {
    res = { command: "init" };
    nargs = args.slice(3);
    // help
  } else if (length > 2 && args[2] === "help") {
    res = { command: "help" };
    nargs = args.slice(3);
    // version
  } else if (length > 2 && args[2] === "version") {
    res = { command: "show_version" };
    nargs = args.slice(3);
    // archetype version
  } else if (length > 3 && args[2] === "archetype" && args[3] === "version") {
    res = { command: "show_archetype_version" };
    nargs = args.slice(4);
    // octez-client version
  } else if (length > 3 && args[2] === "octez-client" && args[3] === "version") {
    res = { command: "show_octez_client_version" };
    nargs = args.slice(4);
    // install
  } else if (length > 2 && args[2] === "install") {
    res = { command: "install", bin: args[3] };
    nargs = args.slice(4);
    // mockup init
  } else if (length > 3 && args[2] === "mockup" && args[3] === "init") {
    res = { command: "mockup_init" };
    nargs = args.slice(4);
    // mockup set now
  } else if (length > 3 && args[2] === "mockup" && args[3] === "set" && args[4] === "now") {
    res = { command: "mockup_set_now", value: args[5] };
    nargs = args.slice(6);
    // show endpoint
  } else if (length > 3 && args[2] === "show" && args[3] === "endpoint") {
    res = { command: "show_endpoint" };
    nargs = args.slice(4);
    // switch endpoint
  } else if (length > 3 && args[2] === "switch" && args[3] === "endpoint") {
    res = { command: "switch_endpoint" };
    nargs = args.slice(4);
    // add endpoint (main|ghost|sandbox) <ENDPOINT_URL>
  } else if (length > 5 && args[2] === "add" && args[3] === "endpoint") {
    res = { command: "add_endpoint", network_: args[4], endpoint: args[5] };
    nargs = args.slice(6);
    // set account <ACCOUNT_ALIAS>
  } else if (length > 4 && args[2] === "set" && args[3] === "endpoint") {
    res = { command: "set_endpoint", endpoint: args[4] };
    nargs = args.slice(5);
    // remove endpoint [<ENDPOINT_URL>]
  } else if (length > 4 && args[2] === "remove" && args[3] === "endpoint") {
    res = { command: "remove_endpoint", endpoint: args[4] };
    nargs = args.slice(6);
    // set mode <bin> <mode>
  } else if (length > 5 && args[2] === "set" && args[3] === "mode" && args[4] === "archetype") {
    res = { command: "set_mode_archetype", value: args[5] };
    nargs = args.slice(6);
    // switch mode <bin>
  } else if (length > 4 && args[2] === "switch" && args[3] === "mode" && args[4] === "archetype") {
    res = { command: "switch_mode_archetype" };
    nargs = args.slice(5);
    // show mode <bin>
  } else if (length > 4 && args[2] === "show" && args[3] === "mode") {
    res = { command: "show_mode", bin: args[4] };
    nargs = args.slice(5);
    // set path <bin> <value>
  } else if (length > 6 && args[2] === "set" && args[3] === "binary" && args[4] === "path") {
    res = { command: "set_bin_path", bin: args[5], value: args[6] };
    nargs = args.slice(7);
    // show binary path <bin> <value>
  } else if (length > 5 && args[2] === "show" && args[3] === "binary" && args[4] === "path") {
    res = { command: "show_bin_path", bin: args[5] };
    nargs = args.slice(6);
    // generate account as <ACCOUNT_ALIAS> [--with-tezos-client] [--force]
  } else if (length > 5 && args[2] === "generate" && args[3] === "account" && args[4] === "as") {
    res = { command: "generate_account", value: args[5] };
    nargs = args.slice(6);
    // import privatekey <PRIVATE_KEY> as <ACCOUNT_ALIAS> [--force]
  } else if (length > 6 && args[2] === "import" && args[3] === "privatekey" && args[5] === "as") {
    res = { command: "import_privatekey", value: args[4], account: args[6] };
    nargs = args.slice(7);
    // show accounts
  } else if (length > 3 && args[2] === "show" && args[3] === "accounts") {
    res = { command: "show_accounts" };
    nargs = args.slice(4);
    // show account
  } else if (length > 3 && args[2] === "show" && args[3] === "account") {
    res = { command: "show_account" };
    nargs = args.slice(4);
    // show keys from
  } else if (length > 5 && args[2] === "show" && args[3] === "keys" && args[4] === "from") {
    res = { command: "show_keys_from", value: args[5] };
    nargs = args.slice(6);
    // set account <ACCOUNT_ALIAS>
  } else if (length > 4 && args[2] === "set" && args[3] === "account") {
    res = { command: "set_account", value: args[4] };
    nargs = args.slice(5);
    // switch account
  } else if (length > 3 && args[2] === "switch" && args[3] === "account") {
    res = { command: "switch_account" };
    nargs = args.slice(4);
    // rename account <ACCOUNT_ALIAS> to <ACCOUNT_ALIAS>
  } else if (length > 4 && args[2] === "rename" && args[3] === "account" && args[5] === "by") {
    res = { command: "rename_account", from: args[4], to: args[6] };
    nargs = args.slice(7);
    // remove account <ACCOUNT_ALIAS>
  } else if (length > 4 && args[2] === "remove" && args[3] === "account") {
    res = { command: "remove_account", value: args[4] };
    nargs = args.slice(5);
    // show contracts
  } else if (length > 3 && args[2] === "show" && args[3] === "contracts") {
    res = { command: "show_contracts" };
    nargs = args.slice(4);
    // show contract <CONTRACT_ALIAS|CONTRACT_ADDRESS>
  } else if (length > 4 && args[2] === "show" && args[3] === "contract") {
    res = { command: "show_contract", value: args[4] };
    nargs = args.slice(5);
    // print contract <CONTRACT_NAME>
  } else if (length > 4 && args[2] === "print" && args[3] === "contract") {
    res = { command: "print_contract", value: args[4] };
    nargs = args.slice(5);
    // import contract <ADDRESS> as <ACCOUNT_ALIAS> [--force]
  } else if (length > 5 && args[2] === "import" && args[3] === "contract" && args[5] === "as") {
    res = { command: "import_contract", value: args[4], name: args[6] };
    nargs = args.slice(7);
    // rename contract <CONTRACT_ALIAS> to <CONTRACT_ALIAS>
  } else if (length > 4 && args[2] === "rename" && args[3] === "contract" && args[5] === "by") {
    res = { command: "rename_contract", from: args[4], to: args[6] };
    nargs = args.slice(7);
    // remove contract <CONTRACT_ALIAS|CONTRACT_ADDRESS>
  } else if (length > 4 && args[2] === "remove" && args[3] === "contract") {
    res = { command: "remove_contract", value: args[4] };
    nargs = args.slice(5);
    // transfer <AMOUNT>(tz|utz) from <ACCOUNT_NAME> to <ACCOUNT_NAME|CONTRACT_ALIAS>
  } else if (length > 7 && args[2] === "transfer" && args[4] === "from" && args[6] === "to") {
    res = { command: "transfer", vamount: args[3], from: args[5], to: args[7] };
    nargs = args.slice(8);
    // deploy <FILE.arl> [--as <ACCOUNT_NAME>] [--named <CONTRACT_ALIAS>] [--amount <AMOUNT>(tz|utz)] [--init <PARAMETERS>] [--force]
  } else if (length > 3 && args[2] === "deploy") {
    res = { command: "deploy", file: args[3], originate: false };
    nargs = args.slice(4);
  } else if (length > 3 && args[2] === "originate") {
    res = { command: "deploy", file: args[3], originate: true };
    nargs = args.slice(4);
    // call <CONTRACT_ALIAS> [--as <ACCOUNT_NAME>] [--entry <ENTRYNAME>] [--with <ARG>] [--amount <AMOUNT>(tz|utz)]
  } else if (length > 3 && args[2] === "call") {
    res = { command: "call_contract", contract: args[3] };
    nargs = args.slice(4);
    // generate michelson <FILE.arl>
  } else if (length > 4 && args[2] === "generate" && args[3] === "michelson") {
    res = { command: "generate_michelson", path: args[4] };
    nargs = args.slice(5);
    // generate javascript <FILE.arl>
  } else if (length > 4 && args[2] === "generate" && args[3] === "javascript") {
    res = { command: "generate_javascript", path: args[4] };
    nargs = args.slice(5);
    // generate whyml <FILE.arl>
  } else if (length > 4 && args[2] === "generate" && args[3] === "whyml") {
    res = { command: "generate_whyml", path: args[4] };
    nargs = args.slice(5);
    // generate event-binding-js <FILE.arl>
  } else if (length > 4 && args[2] === "generate" && args[3] === "event-binding-js") {
    res = { command: "generate_event_binding_js", path: args[4] };
    nargs = args.slice(5);
    // generate event-binding-ts <FILE.arl>
  } else if (length > 4 && args[2] === "generate" && args[3] === "event-binding-ts") {
    res = { command: "generate_event_binding_ts", path: args[4] };
    nargs = args.slice(5);
    // generate binding-ts <FILE.arl> [--input-path <PATH>  --output-path <PATH>]
  } else if (length > 4 && args[2] === "generate" && args[3] === "binding-ts") {
    res = { command: "generate_binding_ts", path: args[4] };
    nargs = args.slice(5);
    // generate binding-dapp-ts <FILE.arl>
  } else if (length > 4 && args[2] === "generate" && args[3] === "binding-dapp-ts") {
    res = { command: "generate_binding_dapp_ts", path: args[4] };
    nargs = args.slice(5);
    // generate contract interface <FILE.arl|FILE.tz|CONTRACT_ALIAS>
  } else if (length > 5 && args[2] === "generate" && args[3] === "contract" && args[4] === "interface") {
    res = { command: "generate_contract_interface", path: args[5] };
    nargs = args.slice(6);
    // check michelson <FILE.arl>
  } else if (length > 4 && args[2] === "check" && args[3] === "michelson") {
    res = { command: "check_michelson", path: args[4] };
    nargs = args.slice(5);
    // run getter <VIEW_ID> on <CONTRACT_ALIAS|CONTRACT_ADDRESS>
  } else if (length > 6 && args[2] === "run" && args[3] === "getter" && args[5] === "on") {
    res = { command: "run_getter", getterid: args[4], contract: args[6] };
    nargs = args.slice(7);
    // run view <VIEW_ID> on <CONTRACT_ALIAS|CONTRACT_ADDRESS>
  } else if (length > 6 && args[2] === "run" && args[3] === "view" && args[5] === "on") {
    res = { command: "run_view", viewid: args[4], contract: args[6] };
    nargs = args.slice(7);
    // run binder-ts
  } else if (length > 3 && args[2] === "run" && args[3] === "binder-ts") {
    res = { command: "run_binder_ts" };
    nargs = args.slice(4);
    // run <FILE.arl>
  } else if (length > 3 && args[2] === "run") {
    res = { command: "run", path: args[3] };
    nargs = args.slice(4);
    // interp <FILE.[arl|tz]>
  } else if (length > 3 && args[2] === "interp") {
    res = { command: "interp", path: args[3] };
    nargs = args.slice(4);
    // show entries of <CONTRACT_ADDRESS>
  } else if (length > 4 && args[2] === "show" && args[3] === "entries") {
    res = { command: "show_entries", value: args[4] };
    nargs = args.slice(5);
    // show url <CONTRACT_ALIAS>
  } else if (length > 4 && args[2] === "show" && args[3] === "url") {
    res = { command: "show_url", value: args[4] };
    nargs = args.slice(5);
    // show source <CONTRACT_ALIAS>
  } else if (length > 4 && args[2] === "show" && args[3] === "source") {
    res = { command: "show_source", value: args[4] };
    nargs = args.slice(5);
    // show address <CONTRACT_ALIAS>
  } else if (length > 4 && args[2] === "show" && args[3] === "address") {
    res = { command: "show_address", value: args[4] };
    nargs = args.slice(5);
    // show storage <CONTRACT_ALIAS>
  } else if (length > 4 && args[2] === "show" && args[3] === "storage") {
    res = { command: "show_storage", value: args[4] };
    nargs = args.slice(5);
    // show script <CONTRACT_ALIAS>
  } else if (length > 4 && args[2] === "show" && args[3] === "script") {
    res = { command: "show_script", value: args[4] };
    nargs = args.slice(5);
    // get balance for <ACCOUNT_NAME|ACCOUNT_ADDRESS>
  } else if (length > 5 && args[2] === "get" && args[3] === "balance" && args[4] === "for") {
    res = { command: "get_balance_for", value: args[5] };
    nargs = args.slice(6);
    // get completium property <VALUE>
  } else if (length > 5 && args[2] === "get" && args[3] === "completium" && args[4] === "property") {
    res = { command: "get_completium_property", value: args[5] };
    nargs = args.slice(6);
  } else if (length > 3 && args[2] === "log" && args[3] === "enable") {
    res = { command: "log_enable" };
    nargs = args.slice(4);
  } else if (length > 3 && args[2] === "log" && args[3] === "disable") {
    res = { command: "log_disable" };
    nargs = args.slice(4);
  } else if (length > 3 && args[2] === "log" && args[3] === "status") {
    res = { command: "log_status" };
    nargs = args.slice(4);
  } else if (length > 3 && args[2] === "log" && args[3] === "clear") {
    res = { command: "log_clear" };
    nargs = args.slice(4);
  } else if (length > 3 && args[2] === "log" && args[3] === "dump") {
    res = { command: "log_dump" };
    nargs = args.slice(4);
  } else if (length > 3 && args[2] === "create" && args[3] === "project") {
    res = { command: "create_project", value: args[4] };
    nargs = args.slice(5);
  } else if (length > 4 && args[2] === "register" && args[3] === "global" && args[4] === "constant") {
    res = { command: "register_global_constant", value: args[5] };
    nargs = args.slice(6);
    // decompile <CONTRACT_ADDRESS|FILE.[tz|json]>
  } else if (length > 2 && args[2] === "decompile") {
    res = { command: "decompile", value: args[3] };
    nargs = args.slice(3);
  } else if (length > 2 && args[2] === "completion") {
    res = { command: "completion" };
    nargs = args.slice(2);
  } else if (length > 2 && args[2] === "nop") {
    res = { command: "nop" };
    nargs = args.slice(2);
  } else {
    res = { command: undefined }
  }

  const options = arg(
    {
      '--dry': Boolean,
      '--from-faucet': String,
      '--with-secret': Boolean,
      '--with-private-key': Boolean,
      '--amount': String,
      '--fee': String,
      '--as': String,
      '--alias': String,
      '--named': String,
      '--entry': String,
      '--arg': String,
      '--arg-michelson': String,
      '--arg-json-michelson': String,
      '--force': Boolean,
      '--verbose': Boolean,
      '--init': String,
      '--parameters': String,
      '--parameters-micheline': String,
      '--metadata-storage': String,
      '--metadata-uri': String,
      '--test-mode': Boolean,
      '--json': Boolean,
      '--trace': Boolean,
      '--force-tezos-client': Boolean,
      '--with-tezos-client': Boolean,
      '--protocol': String,
      '--storage': String,
      '--show-tezos-client-command': Boolean,
      '--input-path': String,
      '--output-path': String,
      '--taquito-schema': Boolean,
      '--with-dapp-originate': Boolean,
      '--network': String,
      '--sandbox-exec-address': String,
      '--balance': String,
      '--source': String,
      '--payer': String,
      '--self-address': String,
      '--now': String,
      '--level': String,
      '--burn-cap': String,

      // '-y': '--yes',
      '-d': '--dry',
      '-f': '--force',
      '-v': '--verbose',
    },
    {
      argv: nargs,
    }
  );

  const result: ParsedCommand = {
    ...res,
    options: {
      dry: options['--dry'] || false,
      withSecret: options['--with-secret'] || false,
      withPrivateKey: options['--with-private-key'] || false,
      amount: options['--amount'],
      fee: options['--fee'],
      burnCap: options['--burn-cap'],
      as: options['--as'],
      alias: options['--alias'],
      named: options['--named'],
      entry: options['--entry'],
      iargs: options['--arg'],
      argMichelson: options['--arg-michelson'],
      argJsonMichelson: options['--arg-json-michelson'],
      force: options['--force'] || false,
      verbose: options['--verbose'] || false,
      init: options['--init'],
      iparameters: options['--parameters'],
      iparametersMicheline: options['--parameters-micheline'],
      metadata_storage: options['--metadata-storage'],
      metadata_uri: options['--metadata-uri'],
      test: options['--test-mode'] || false,
      json: options['--json'] || false,
      trace: options['--trace'] || false,
      force_tezos_client: options['--force-tezos-client'] || false,
      with_tezos_client: options['--with-tezos-client'] || false,
      protocol: options['--protocol'],
      storage: options['--storage'],
      show_tezos_client_command: options['--show-tezos-client-command'] || false,
      input_path: options['--input-path'],
      output_path: options['--output-path'],
      taquito_schema: options['--taquito-schema'],
      with_dapp_originate: options['--with-dapp-originate'] || false,
      network: options['--network'],
      sandbox_exec_address: options['--sandbox-exec-address'],
      opt_balance: options['--balance'],
      opt_source: options['--source'],
      opt_payer: options['--payer'],
      opt_self_address: options['--self-address'],
      opt_now: options['--now'],
      opt_level: options['--level'],
    }
  };

  return result;
}

/**
 * Execute the appropriate command based on the parsed input.
 * @param options - The parsed command and its parameters.
 */
async function execCommand(parsedCommand: ParsedCommand) {
  if (!parsedCommand.command) {
    console.error("[Error]: Command not found.");
    console.error('Type "completium-cli help" for a list of available commands.');
    process.exit(1); // General error code for invalid commands
  }
  try {
    switch (parsedCommand.command) {
      case "init":
        await initCompletium()
        break;

      case "help":
        const h = help();
        Printer.print(h);
        break;

      case "completion":
        const scriptCompletion = completion();
        Printer.print(scriptCompletion);
        break;

      case "show_version":
        Printer.print(VERSION);
        break;

      case "show_archetype_version":
        const archetypeVersion = await ArchetypeManager.getVersion();
        Printer.print(archetypeVersion);
        break;

      case "show_octez_client_version":
        const tezosVersion = await TezosClientManager.getVersion();
        Printer.print(tezosVersion);
        break;

      case "install":
        throw new Error("TODO: install");

      case "mockup_init":
        await mockupInitCommand(parsedCommand.options);
        break;

      case "mockup_set_now":
        if (!parsedCommand.value) {
          Printer.error(`[Error]: Value unset.`);
          process.exit(1);
        }
        await mockupSetNowCommand(parsedCommand.value, null);
        break;

      case "show_endpoint":
        ConfigManager.showEndpoint()
        break;

      case "switch_endpoint":
        switchEndpoint()
        break;

      case "add_endpoint":
        if (!parsedCommand.network_) {
          Printer.error(`[Error]: network unset.`);
          process.exit(1);
        }
        if (!parsedCommand.endpoint) {
          Printer.error(`[Error]: endpoint unset.`);
          process.exit(1);
        }
        ConfigManager.addEndpoint(parsedCommand.network_, parsedCommand.endpoint)
        break;

      case "set_endpoint":
        if (!parsedCommand.endpoint) {
          Printer.error(`[Error]: endpoint unset.`);
          process.exit(1);
        }
        ConfigManager.setEndpoint(parsedCommand.endpoint);
        break;

      case "remove_endpoint":
        if (!parsedCommand.endpoint) {
          Printer.error(`[Error]: endpoint unset.`);
          process.exit(1);
        }
        ConfigManager.removeEndpoint(parsedCommand.endpoint);
        break;

      case "set_mode_archetype":
        if (!parsedCommand.value) {
          Printer.error(`[Error]: Value unset.`);
          process.exit(1);
        }
        const validModes = ["js", "docker", "binary"] as const;
        if (!validModes.includes(parsedCommand.value as any)) {
          Printer.error(`[Error]: Invalid value: '${parsedCommand.value}', expected one of: ${validModes.join(", ")}.`);
          process.exit(1);
        }
        const mode: Config["mode"]["archetype"] = parsedCommand.value as Config["mode"]["archetype"];
        ConfigManager.setModeArchetype(mode);
        break;

      case "switch_mode_archetype":
        switchMode("archetype");
        break;

      case "show_mode":
        if (!parsedCommand.bin) {
          Printer.error(`[Error]: Bin unset.`);
          process.exit(1);
        }
        if (parsedCommand.bin != "archetype" && parsedCommand.bin != "tezos-client") {
          Printer.error(`[Error]: Invalid Bin value.`);
          process.exit(1);
        }
        ConfigManager.showMode(parsedCommand.bin);
        break;

      case "set_bin_path":
        const validBins_set_bin_path = ["archetype", "tezos-client"] as const;

        // Check if the binary name is unset
        if (!parsedCommand.bin) {
          Printer.error("[Error]: Bin not provided.");
          process.exit(1);
        }

        // Check if the binary name is valid
        if (!validBins_set_bin_path.includes(parsedCommand.bin as any)) {
          Printer.error(`[Error]: Invalid bin value: '${parsedCommand.bin}', expected 'archetype' or 'tezos-client'.`);
          process.exit(1);
        }

        // Check if the path is unset
        if (!parsedCommand.value) {
          Printer.error("[Error]: Path not provided.");
          process.exit(1);
        }

        // Convert the bin into its type and set the binary path
        const bin_set_bin_path: keyof Config["bin"] = parsedCommand.bin as keyof Config["bin"];
        ConfigManager.setBinaryPath(bin_set_bin_path, parsedCommand.value);
        Printer.print(`Binary path for '${bin_set_bin_path}' successfully set to '${parsedCommand.value}'.`);
        break;


      case "show_bin_path":
        if (!parsedCommand.bin) {
          Printer.error(`[Error]: bin unset.`);
          process.exit(1);
        }

        const validBins_show_bin_path = ["archetype", "tezos-client"] as const;

        // Check if the binary name is valid
        if (!validBins_show_bin_path.includes(parsedCommand.bin as any)) {
          Printer.error(`[Error]: Invalid bin value: '${parsedCommand.bin}', expected 'archetype' or 'tezos-client'.`);
          process.exit(1);
        }

        // Convert the bin into its type and set the binary path
        const bin_show_bin_path: keyof Config["bin"] = parsedCommand.bin as keyof Config["bin"];

        ConfigManager.showBinaryPath(bin_show_bin_path);
        break;

      case "generate_account":
        if (!parsedCommand.value) {
          Printer.error(`[Error]: value unset.`);
          process.exit(1);
        }

        await generateAccount(parsedCommand.value, parsedCommand.options);
        break;

      case "import_privatekey":
        if (!parsedCommand.value) {
          Printer.error(`[Error]: value unset.`);
          process.exit(1);
        }
        if (!parsedCommand.account) {
          Printer.error(`[Error]: account unset.`);
          process.exit(1);
        }
        await importPrivatekey(parsedCommand.value, parsedCommand.account, parsedCommand.options)
        break;

      case "show_accounts":
        await showAccounts();
        break;

      case "show_account":
        await showAccount(parsedCommand.options);
        break;

      case "show_keys_from":
        if (!parsedCommand.value) {
          Printer.error(`[Error]: value unset.`);
          process.exit(1);
        }
        await showKeysFrom(parsedCommand.value);
        break;

      case "set_account":
        if (!parsedCommand.value) {
          Printer.error(`[Error]: value unset.`);
          process.exit(1);
        }
        setAccount(parsedCommand.value)
        break;

      case "switch_account":
        await switchAccount();
        break;

      case "rename_account":
        if (!parsedCommand.from) {
          Printer.error(`[Error]: from unset.`);
          process.exit(1);
        }
        if (!parsedCommand.to) {
          Printer.error(`[Error]: to unset.`);
          process.exit(1);
        }
        await renameAccount(parsedCommand.from, parsedCommand.to, parsedCommand.options);
        break;

      case "remove_account":
        if (!parsedCommand.value) {
          Printer.error(`[Error]: value unset.`);
          process.exit(1);
        }
        await removeAccount(parsedCommand.value, parsedCommand.options);
        break;

      case "show_contracts":
        showContracts();
        break;

      case "show_contract":
        if (!parsedCommand.value) {
          Printer.error(`[Error]: value unset.`);
          process.exit(1);
        }
        showContract(parsedCommand.value);
        break;

      case "print_contract":
        if (!parsedCommand.value) {
          Printer.error(`[Error]: value unset.`);
          process.exit(1);
        }
        printContract(parsedCommand.value)
        break;

      case "import_contract":
        if (!parsedCommand.value) {
          Printer.error(`[Error]: value unset.`);
          process.exit(1);
        }
        if (!parsedCommand.name) {
          Printer.error(`[Error]: value name.`);
          process.exit(1);
        }
        importContract(parsedCommand.value, parsedCommand.name)
        break;

      case "rename_contract":
        if (!parsedCommand.from) {
          Printer.error(`[Error]: from unset.`);
          process.exit(1);
        }
        if (!parsedCommand.to) {
          Printer.error(`[Error]: to unset.`);
          process.exit(1);
        }
        await renameContract(parsedCommand.from, parsedCommand.to, parsedCommand.options);
        break;

      case "remove_contract":
        if (!parsedCommand.value) {
          Printer.error(`[Error]: value unset.`);
          process.exit(1);
        }
        await removeContract(parsedCommand.value, parsedCommand.options);
        break;

      case "transfer":
        throw new Error("TODO: transfer");

      case "deploy":
        throw new Error("TODO: deploy");

      case "call_contract":
        throw new Error("TODO: call_contract");

      case "generate_michelson":
        if (!parsedCommand.path) {
          Printer.error(`[Error]: path unset.`);
          process.exit(1);
        }
        await generateMichelson(parsedCommand.path, parsedCommand.options);
        break;

      case "generate_javascript":
        if (!parsedCommand.path) {
          Printer.error(`[Error]: path unset.`);
          process.exit(1);
        }
        await generateJavascript(parsedCommand.path, parsedCommand.options);
        break;

      case "generate_whyml":
        if (!parsedCommand.path) {
          Printer.error(`[Error]: path unset.`);
          process.exit(1);
        }
        await printGenerateWhyml(parsedCommand.path, parsedCommand.options);
        break;

      case "generate_event_binding_js":
        if (!parsedCommand.path) {
          Printer.error(`[Error]: path unset.`);
          process.exit(1);
        }
        await printGenerateEventBindingJs(parsedCommand.path, parsedCommand.options);
        break;

      case "generate_event_binding_ts":
        if (!parsedCommand.path) {
          Printer.error(`[Error]: path unset.`);
          process.exit(1);
        }
        await printGenerateEventBindingTs(parsedCommand.path, parsedCommand.options);
        break;

      case "generate_binding_ts":
        if (!parsedCommand.path) {
          Printer.error(`[Error]: path unset.`);
          process.exit(1);
        }
        await printGenerateBindingTs(parsedCommand.path, parsedCommand.options);
        break;

      case "generate_binding_dapp_ts":
        if (!parsedCommand.path) {
          Printer.error(`[Error]: path unset.`);
          process.exit(1);
        }
        await printGenerateBindingDappTs(parsedCommand.path, parsedCommand.options);
        break;

      case "generate_contract_interface":
        if (!parsedCommand.path) {
          Printer.error(`[Error]: path unset.`);
          process.exit(1);
        }
        await printGenerateContractInterface(parsedCommand.path, parsedCommand.options);
        break;

      case "check_michelson":
        if (!parsedCommand.path) {
          Printer.error(`[Error]: path unset.`);
          process.exit(1);
        }
        await checkMichelson(parsedCommand.path, parsedCommand.options);
        break;

      case "run_getter":
        if (!parsedCommand.getterid) {
          throw new Error("[Error]: getterid unset.");
        }
        if (!parsedCommand.contract) {
          throw new Error("[Error]: contract unset.");
        }
        await printRunGetter(parsedCommand.getterid, parsedCommand.contract, parsedCommand.options);
        break;

      case "run_view":
        if (!parsedCommand.viewid) {
          throw new Error("[Error]: viewid unset.");
        }
        if (!parsedCommand.contract) {
          throw new Error("[Error]: contract unset.");
        }
        await printRunView(parsedCommand.viewid, parsedCommand.contract, parsedCommand.options);
        break;

      case "run_binder_ts":
        throw new Error("TODO: run_binder_ts");

      case "run":
        throw new Error("TODO: run");

      case "interp":
        throw new Error("TODO: interp");

      case "show_entries":
        if (!parsedCommand.value) {
          throw new Error("[Error]: value unset.");
        }
        await showEntries(parsedCommand.value, parsedCommand.options)
        break;

      case "show_url":
        if (!parsedCommand.value) {
          throw new Error("[Error]: value unset.");
        }
        await showUrl(parsedCommand.value, parsedCommand.options)
        break;

      case "show_source":
        if (!parsedCommand.value) {
          throw new Error("[Error]: value unset.");
        }
        await showSource(parsedCommand.value, parsedCommand.options)
        break;

      case "show_address":
        if (!parsedCommand.value) {
          throw new Error("[Error]: value unset.");
        }
        await showAddress(parsedCommand.value, parsedCommand.options)
        break;

      case "show_storage":
        if (!parsedCommand.value) {
          throw new Error("[Error]: value unset.");
        }
        await showStorage(parsedCommand.value, parsedCommand.options)
        break;

      case "show_script":
        if (!parsedCommand.value) {
          throw new Error("[Error]: value unset.");
        }
        await showScript(parsedCommand.value, parsedCommand.options)
        break;

      case "get_balance_for":
        if (!parsedCommand.value) {
          throw new Error("No address provided for 'get balance for'.");
        }
        await getBalanceCommand(parsedCommand.value, parsedCommand.options);
        break;

      case "get_completium_property":
        if (!parsedCommand.value) {
          throw new Error("No address provided for 'get completium property'.");
        }
        await printCompletiumProperty(parsedCommand.value, parsedCommand.options);
        break;

      case "log_enable":
        LogManager.logEnable();
        break;

      case "log_disable":
        LogManager.logDisable();
        break;

      case "log_status":
        LogManager.logStatus();
        break;

      case "log_clear":
        await LogManager.logClear(parsedCommand.options)
        break;

      case "log_dump":
        LogManager.logDump();
        break;

      case "create_project":
        if (!parsedCommand.value) {
          throw new Error("No value provided for 'create project'.");
        }
        await createProject(parsedCommand.value, parsedCommand.options);
        break;

      case "register_global_constant":
        if (!parsedCommand.value) {
          throw new Error("No value provided for 'register global constant'.");
        }
        await registerGlobalConstant(parsedCommand.value, parsedCommand.options);
        break;

      case "decompile":
        if (!parsedCommand.value) {
          throw new Error("No value provided for 'decompile'.");
        }
        await printDecompile(parsedCommand.value, parsedCommand.options);
        break;

      case "nop":
        break;

      default:
        console.error(`[Error]: Command ${parsedCommand.command} not implemented yet.`);
        console.error("Please refer to the documentation or check back later.");
        process.exit(255); // Special error code for unimplemented commands
    }
  } catch (err: any) {
    return handleError(err.message)
  }
}

/**
 * Main entry point for the CLI.
 * @param args - The arguments from process.argv.
 */
export async function cli(args: string[]) {
  const parsedCommand = parseCommand(args);

  await execCommand(parsedCommand);
}


function help(): string {
  const res =
    `
usage: [command] [options]
command:
  init
  help
  completion
  version
  archetype version
  octez-client version
  install archetype

  mockup init [--protocol <VALUE>]
  mockup set now <value>

  show endpoint
  switch endpoint
  add endpoint (main|ghost|sandbox) <ENDPOINT_URL>
  set endpoint <ENDPOINT_URL>
  remove endpoint <ENDPOINT_URL>

  set mode archetype (js|docker|binary)
  switch mode archetype
  show mode archetype
  set binary path (archetype|tezos-client) <PATH>
  show binary path (archetype|tezos-client)

  generate account as <ACCOUNT_ALIAS> [--with-tezos-client] [--force]
  import privatekey <PRIVATE_KEY> as <ACCOUNT_ALIAS> [--with-tezos-client] [--force]
  show accounts
  show account [--with-private-key] [--alias <ALIAS>]
  show keys from <PRIVATE_KEY>
  set account <ACCOUNT_ALIAS>
  switch account
  rename account <ACCOUNT_ALIAS|ACCOUNT_ADDRESS> by <ACCOUNT_ALIAS> [--force]
  remove account <ACCOUNT_ALIAS>

  show contracts
  show contract <CONTRACT_ALIAS|CONTRACT_ADDRESS>
  print contract <CONTRACT_NAME>
  import contract <CONTRACT_ADDRESS> as <CONTRACT_ALIAS> [--network <NETWORK>]
  rename contract <CONTRACT_ALIAS|CONTRACT_ADDRESS> by <CONTRACT_ALIAS> [--force]
  remove contract <CONTRACT_ALIAS>

  transfer <AMOUNT>(tz|utz) from <ACCOUNT_ALIAS|ACCOUNT_ADDRESS> to <ACCOUNT_ALIAS|ACCOUNT_ADDRESS> [--force]
  deploy <FILE.arl> [--as <ACCOUNT_ALIAS>] [--named <CONTRACT_ALIAS>] [--amount <AMOUNT>(tz|utz)] [--fee <FEE>(tz|utz)] [--init <MICHELSON_DATA> | --parameters <PARAMETERS> | --parameters-micheline <PARAMETERS>] [--metadata-storage <PATH_TO_JSON> | --metadata-uri <VALUE_URI>] [--force] [--show-tezos-client-command]
  originate <FILE.tz> [--as <ACCOUNT_ALIAS>] [--named <CONTRACT_ALIAS>] [--amount <AMOUNT>(tz|utz)] [--fee <FEE>(tz|utz)]  [--force-tezos-client] [--force] [--show-tezos-client-command]
  call <CONTRACT_ALIAS> [--as <ACCOUNT_ALIAS>] [--entry <ENTRYPOINT>] [--arg <ARGS> | --arg-michelson <MICHELSON_DATA>] [--amount <AMOUNT>(tz|utz)] [--fee <FEE>(tz|utz)] [--force] [--show-tezos-client-command]
  run <FILE.arl> [--entry <ENTRYPOINT>] [--arg-michelson <MICHELSON_DATA>] [--amount <AMOUNT>(tz|utz)] [--trace] [--force]
  run getter <GETTER_ID> on <CONTRACT_ALIAS|CONTRACT_ADDRESS> [--arg-michelson <MICHELSON_DATA>] [--arg-json-michelson <MICHELSON_JSON>] [--as <CALLER_ADDRESS>]
  run view <VIEW_ID> on <CONTRACT_ALIAS|CONTRACT_ADDRESS> [--arg-michelson <MICHELSON_DATA>] [--arg-json-michelson <MICHELSON_JSON>] [--as <CALLER_ADDRESS>]
  interp <FILE.[arl|tz]> [--entry <ENTRYPOINT>] [--arg-michelson <MICHELSON_DATA>] [--amount <AMOUNT>(tz|utz)] [--force]
  register global constant <MICHELSON_DATA> [--as <CALLER_ADDRESS>] [--force]

  generate michelson <FILE.arl|CONTRACT_ALIAS>
  generate javascript <FILE.arl|CONTRACT_ALIAS>
  generate whyml <FILE.arl|CONTRACT_ALIAS>
  generate event-binding-js <FILE.arl|CONTRACT_ALIAS>
  generate event-binding-ts <FILE.arl|CONTRACT_ALIAS>
  generate binding-ts <FILE.arl|CONTRACT_ALIAS> [--input-path <PATH>  --output-path <PATH>]
  generate binding-dapp-ts <FILE.arl|CONTRACT_ALIAS> [--input-path <PATH> --output-path <PATH>] [--with-dapp-originate]
  generate contract interface <FILE.arl|FILE.tz|CONTRACT_ALIAS>

  show entries <CONTRACT_ADDRESS>
  show url <CONTRACT_ALIAS>
  show source <CONTRACT_ALIAS>
  show address <CONTRACT_ALIAS|ACCOUNT_ALIAS>
  show storage <CONTRACT_ALIAS|CONTRACT_ADDRESS> [--json]
  show script <CONTRACT_ALIAS|CONTRACT_ADDRESS> [--json]
  get balance for <ACCOUNT_NAME|ACCOUNT_ADDRESS>

  log enable
  log disable
  log status
  log clear [--force]
  log dump

  create project <PROJECT_NAME>
  get completium property <VALUE>`;
  return res;
}


function completion(): string {
  return `
_completium_cli_completions() {
  local cur prev words cword
  _init_completion || return

  local commands="init help version archetype install mockup show switch add set remove generate import rename transfer deploy originate call run interp register log create get"

  local subcommands_mockup="init set"
  local subcommands_show="endpoint accounts account contracts contract entries url source address storage script"
  local subcommands_switch="endpoint account mode"
  local subcommands_add="endpoint"
  local subcommands_set="endpoint mode account contract"
  local subcommands_remove="endpoint account contract"
  local subcommands_generate="account michelson javascript whyml event-binding-js event-binding-ts binding-ts binding-dapp-ts contract interface"
  local subcommands_log="enable disable clear dump"
  local subcommands_get="balance completium"

  case $prev in
    completium-cli)
      COMPREPLY=($(compgen -W "$commands" -- "$cur"))
      ;;
    mockup)
      COMPREPLY=($(compgen -W "$subcommands_mockup" -- "$cur"))
      ;;
    show)
      COMPREPLY=($(compgen -W "$subcommands_show" -- "$cur"))
      ;;
    switch)
      COMPREPLY=($(compgen -W "$subcommands_switch" -- "$cur"))
      ;;
    add)
      COMPREPLY=($(compgen -W "$subcommands_add" -- "$cur"))
      ;;
    set)
      COMPREPLY=($(compgen -W "$subcommands_set" -- "$cur"))
      ;;
    remove)
      COMPREPLY=($(compgen -W "$subcommands_remove" -- "$cur"))
      ;;
    generate)
      COMPREPLY=($(compgen -W "$subcommands_generate" -- "$cur"))
      ;;
    log)
      COMPREPLY=($(compgen -W "$subcommands_log" -- "$cur"))
      ;;
    get)
      COMPREPLY=($(compgen -W "$subcommands_get" -- "$cur"))
      ;;
    *)
      COMPREPLY=()
      ;;
  esac
}
complete -F _completium_cli_completions completium-cli
  `;
};