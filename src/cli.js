import arg from 'arg';
import inquirer from 'inquirer';
import { process } from './main';

function parseCommand(args) {
  const length = args.length;

  var res = {};
  var nargs = [];

  if (length > 2 && args[2] === "help") {
    res = { command: "help" };
    nargs = args.slice(3);
  } else if (length > 2 && args[2] === "init") {
    res = { command: "init" };
    nargs = args.slice(3);
  } else if (length > 3 && args[2] === "update" && args[3] === "binaries") {
    res = { command: "update_binaries" };
    nargs = args.slice(4);
  } else if (length > 4 && args[2] === "generate" && args[3] === "account") {
    res = { command: "generate_account", account: args[4] };
    nargs = args.slice(5);
  } else if (length > 7 && args[2] === "transfer" && args[4] === "from" && args[6] === "to") {
    res = { command: "transfer", vamount: args[3], from: args[5], to: args[7] };
    nargs = args.slice(8);
  } else if (length > 3 && args[2] === "remove" && args[3] === "account") {
    res = { command: "remove_account", account: args[4] };
    nargs = args.slice(5);
  } else if (length > 3 && args[2] === "remove" && args[3] === "contract") {
    res = { command: "remove_contract", account: args[4] };
    nargs = args.slice(5);
  } else if (length > 3 && args[2] === "deploy") {
    res = { command: "deploy", file: args[3] };
    nargs = args.slice(4);
  } else if (length > 3 && args[2] === "call") {
    res = { command: "call_contract", contract: args[3] };
    nargs = args.slice(4);
  } else if (length > 5 && args[2] === "show" && args[3] === "entries" && args[4] === "of") {
    res = { command: "show_entries_of", contract: args[5] };
    nargs = args.slice(6);
  } else if (length > 4 && args[2] === "generate" && args[3] === "json") {
    res = { command: "generate_json", path: args[4] };
    nargs = args.slice(5);
  } else if (length > 3 && args[2] === "show" && args[3] === "endpoint") {
    res = { command: "show_endpoint" };
    nargs = args.slice(4);
  } else if (length > 3 && args[2] === "switch" && args[3] === "endpoint") {
    res = { command: "switch_endpoint" };
    nargs = args.slice(4);
  } else if (length > 3 && args[2] === "show" && args[3] === "account") {
    res = { command: "show_account" };
    nargs = args.slice(5);
  } else if (length > 3 && args[2] === "switch" && args[3] === "account") {
    res = { command: "switch_account" };
    nargs = args.slice(4);
  } else if (length > 4 && args[2] === "set" && args[3] === "account") {
    res = { command: "set_account", account: args[4] };
    nargs = args.slice(5);
  } else if (length > 4 && args[2] === "show" && args[3] === "contract") {
    res = { command: "show_contract", contract: args[4] };
    nargs = args.slice(5);
  } else if (length > 4 && args[2] === "show" && args[3] === "url") {
    res = { command: "show_url", contract: args[4] };
    nargs = args.slice(5);
  } else {
    console.log("command not found");
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
    fromFaucet: options['--from-faucet'],
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