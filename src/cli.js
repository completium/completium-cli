import arg from 'arg';
import inquirer from 'inquirer';
import { process } from './main';

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
    // update binaries
  } else if (length > 3 && args[2] === "update" && args[3] === "binaries") {
    res = { command: "update_binaries" };
    nargs = args.slice(4);
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
    // remove endpoint [<ENDPOINT_URL>]
  } else if (length > 4 && args[2] === "remove" && args[3] === "endpoint") {
    res = { command: "remove_endpoint", endpoint: args[4] };
    nargs = args.slice(6);
    // import faucet <FAUCET_FILE> as <ACCOUNT_ALIAS> [--force]
  } else if (length > 6 && args[2] === "import" && args[3] === "faucet" && args[5] === "as") {
    res = { command: "import_faucet", value: args[4], account: args[6] };
    nargs = args.slice(7);
    // import privatekey <PRIVATE_KEY> as <ACCOUNT_ALIAS> [--force]
  } else if (length > 6 && args[2] === "import" && args[3] === "privatekey" && args[5] === "as") {
    res = { command: "import_privatekey", value: args[4], account: args[6] };
    nargs = args.slice(7);
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
    // remove account <ACCOUNT_ALIAS>
  } else if (length > 4 && args[2] === "remove" && args[3] === "account") {
    res = { command: "remove_account", account: args[4] };
    nargs = args.slice(5);
    // transfer <AMOUNT>(tz|utz) from <ACCOUNT_NAME> to <ACCOUNT_NAME|CONTRACT_NAME>
  } else if (length > 7 && args[2] === "transfer" && args[4] === "from" && args[6] === "to") {
    res = { command: "transfer", vamount: args[3], from: args[5], to: args[7] };
    nargs = args.slice(8);
    // deploy <FILE.arl> [--as <ACCOUNT_NAME>] [--named <CONTRACT_NAME>] [--amount <AMOUNT>(tz|utz)] [--init <PARAMETERS>] [--force]
  } else if (length > 3 && args[2] === "deploy") {
    res = { command: "deploy", file: args[3] };
    nargs = args.slice(4);
    // call <CONTRACT_NAME> [--as <ACCOUNT_NAME>] [--entry <ENTRYNAME>] [--with <ARG>] [--amount <AMOUNT>(tz|utz)]
  } else if (length > 3 && args[2] === "call") {
    res = { command: "call_contract", contract: args[3] };
    nargs = args.slice(4);
    // generate json <FILE.arl>
  } else if (length > 4 && args[2] === "generate" && args[3] === "json") {
    res = { command: "generate_json", path: args[4] };
    nargs = args.slice(5);
    // show entries of <CONTRACT_ADDRESS>
  } else if (length > 5 && args[2] === "show" && args[3] === "entries" && args[4] === "of") {
    res = { command: "show_entries_of", contract: args[5] };
    nargs = args.slice(6);
    // show contract <CONTRACT_NAME>
  } else if (length > 4 && args[2] === "show" && args[3] === "contract") {
    res = { command: "show_contract", contract: args[4] };
    nargs = args.slice(5);
    // remove contract <CONTRACT_NAME>
  } else if (length > 4 && args[2] === "remove" && args[3] === "contract") {
    res = { command: "remove_contract", account: args[4] };
    nargs = args.slice(5);
    // show url <CONTRACT_NAME>
  } else if (length > 4 && args[2] === "show" && args[3] === "url") {
    res = { command: "show_url", contract: args[4] };
    nargs = args.slice(5);
  }

  // console.log(res);
  // console.log('nargs: ' + nargs);
  const options = arg(
    {
      '--dry': Boolean,
      '--from-faucet': String,
      '--with-secret': Boolean,
      '--amount': String,
      '--as': String,
      '--named': String,
      '--entry': String,
      '--with': String,
      '--force': Boolean,
      '--verbose': Boolean,
      '--init': String,

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
    amount: options['--amount'],
    burnCap: options['--burn-cap'],
    as: options['--as'],
    named: options['--named'],
    entry: options['--entry'],
    with: options['--with'],
    force: options['--force'] || false,
    verbose: options['--verbose'] || false,
    init: options['--init'],
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
  let options = parseCommand(args);
  // console.log(options);
  // options = await promptForMissingOptions(options);
  await process(options);
}
