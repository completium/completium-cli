/*!
 * completium-cli <https://github.com/completium/completium-cli>
 *
 * Copyright (c) 2021-2023, edukera, SAS.
 * Released under the MIT License.
 */

import arg from 'arg';
// import inquirer from 'inquirer';
import { exec } from './main';

function parseCommand(args) {
  const length = args.length;

  var res = {};
  var nargs = [];


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
    // install
  } else if (length > 2 && args[2] === "install") {
    res = { command: "install", bin: args[3] };
    nargs = args.slice(4);
    // start sandbox
  } else if (length > 3 && args[2] === "start" && args[3] === "sandbox") {
    res = { command: "start_sandbox" };
    nargs = args.slice(4);
    // stop sandbox
  } else if (length > 3 && args[2] === "stop" && args[3] === "sandbox") {
    res = { command: "stop_sandbox" };
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
    // add endpoint (main|edo|florence) <ENDPOINT_URL>
  } else if (length > 5 && args[2] === "add" && args[3] === "endpoint") {
    res = { command: "add_endpoint", network: args[4], endpoint: args[5] };
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
  } else if (length > 5 && args[2] === "set" && args[3] === "mode") {
    res = { command: "set_mode", bin: args[4], value: args[5] };
    nargs = args.slice(6);
    // switch mode <bin>
  } else if (length > 4 && args[2] === "switch" && args[3] === "mode") {
    res = { command: "switch_mode", bin: args[4] };
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
    // generate account as <ACCOUNT_ALIAS> [--force]
  } else if (length > 5 && args[2] === "generate" && args[3] === "account" && args[4] === "as") {
    res = { command: "generate_account", value: args[5] };
    nargs = args.slice(6);
    // import faucet <FAUCET_FILE> as <ACCOUNT_ALIAS> [--force]
  } else if (length > 6 && args[2] === "import" && args[3] === "faucet" && args[5] === "as") {
    res = { command: "import_faucet", value: args[4], account: args[6] };
    nargs = args.slice(7);
    // import privatekey <PRIVATE_KEY> as <ACCOUNT_ALIAS> [--force]
  } else if (length > 6 && args[2] === "import" && args[3] === "privatekey" && args[5] === "as") {
    res = { command: "import_privatekey", value: args[4], account: args[6] };
    nargs = args.slice(7);
    // show keys from
  } else if (length > 5 && args[2] === "show" && args[3] === "keys" && args[4] === "from") {
    res = { command: "show_keys_from", value: args[5] };
    nargs = args.slice(6);
    // show accounts
  } else if (length > 3 && args[2] === "show" && args[3] === "accounts") {
    res = { command: "show_accounts" };
    nargs = args.slice(4);
    // show account
  } else if (length > 3 && args[2] === "show" && args[3] === "account") {
    res = { command: "show_account" };
    nargs = args.slice(4);
    // set account <ACCOUNT_ALIAS>
  } else if (length > 4 && args[2] === "set" && args[3] === "account") {
    res = { command: "set_account", account: args[4] };
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
    res = { command: "remove_account", account: args[4] };
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
    // generate binding-ts <FILE.arl>
  } else if (length > 4 && args[2] === "generate" && args[3] === "binding-ts") {
    res = { command: "generate_binding_ts", path: args[4] };
    nargs = args.slice(5);
    // generate binding-dapp-ts <FILE.arl>
  } else if (length > 4 && args[2] === "generate" && args[3] === "binding-dapp-ts") {
    res = { command: "generate_binding_dapp_ts", path: args[4] };
    nargs = args.slice(5);
    // generate contract interface <FILE.arl>
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
    // show entries of <CONTRACT_ADDRESS>
  } else if (length > 4 && args[2] === "show" && args[3] === "entries") {
    res = { command: "show_entries", contract: args[4] };
    nargs = args.slice(5);
    // show contracts
  } else if (length > 3 && args[2] === "show" && args[3] === "contracts") {
    res = { command: "show_contracts" };
    nargs = args.slice(4);
    // show contract <CONTRACT_ALIAS|CONTRACT_ADDRESS>
  } else if (length > 4 && args[2] === "show" && args[3] === "contract") {
    res = { command: "show_contract", contract: args[4] };
    nargs = args.slice(5);
    // rename contract <CONTRACT_ALIAS> to <CONTRACT_ALIAS>
  } else if (length > 4 && args[2] === "rename" && args[3] === "contract" && args[5] === "by") {
    res = { command: "rename_contract", from: args[4], to: args[6] };
    nargs = args.slice(7);
    // remove contract <CONTRACT_ALIAS|CONTRACT_ADDRESS>
  } else if (length > 4 && args[2] === "remove" && args[3] === "contract") {
    res = { command: "remove_contract", contract: args[4] };
    nargs = args.slice(5);
    // show url <CONTRACT_ALIAS>
  } else if (length > 4 && args[2] === "show" && args[3] === "url") {
    res = { command: "show_url", contract: args[4] };
    nargs = args.slice(5);
    // show source <CONTRACT_ALIAS>
  } else if (length > 4 && args[2] === "show" && args[3] === "source") {
    res = { command: "show_source", contract: args[4] };
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

      // '-y': '--yes',
      '-d': '--dry',
      '-f': '--force',
      '-v': '--verbose',
    },
    {
      argv: nargs,
    }
  );
  return {
    ...res,
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
    show_tezos_client_command: options['--show-tezos-client-command'],
    input_path: options['--input-path'],
    output_path: options['--output-path'],
    taquito_schema: options['--taquito-schema'],
    with_dapp_originate: options['--with-dapp-originate'] || false,
  }
}

async function promptForMissingOptions(options) {

  // const questions = [];

  // const answers = await inquirer.prompt(questions);
  // return {
  //   ...options,
  //   template: options.template || answers.template,
  //   git: options.git || answers.git,
  // };
}

export async function cli(args) {
  try {
    let options = parseCommand(args);

    if (options.command === undefined) {
      if (args.length > 2) {
        console.log(`Invalid command: ${args[2]}`);
      }
      console.log(`Type "completium-cli help" for more information.`);
    } else {
      var r = await exec(options);
      if (r != 0) {
        process.exit(r);
      }
    }
  } catch (e) {
    if (e.message !== undefined) {
      console.error(e.message);
    } else {
      throw e;
    }
  }
}
