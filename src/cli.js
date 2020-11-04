import arg from 'arg';
import inquirer from 'inquirer';
import { process } from './main';

function parseArgumentsIntoOptions(rawArgs) {
  const args = arg(
    {
      '--init': Boolean,
      '--deploy': String,
      '--account': String,
      '--dry': Boolean,
      '--verbose': Boolean,
      '--transfer': String,
      '--from': String,
      '--to': String,
      '--set': Boolean,
      '--property': String,
      '--value': String,
      '--contract': String,
      //
      '-y': '--yes',
      '-d': '--dry',
      '-v': '--verbose',
    },
    {
      argv: rawArgs.slice(2),
    }
  );
  // console.log(args);
  return {
    init:        args['--init'] || false,
    deploy:      args['--deploy'] !== undefined,
    deployfile:  args['--deploy'],
    account:     args['--account'],
    dry:         args['--dry'] || false,
    verbose:     args['--verbose'] || false,
    transfer:    args['--transfer'] !== undefined && args['--from'] !== undefined && args['--to'] !== undefined,
    amount:      args['--transfer'],
    from:        args['--from'],
    to:          args['--to'],
    setProperty: args['--set'] && args['--property'] !== undefined && args['--value'] !== undefined,
    property:    args['--property'],
    value:       args['--value'],
    contract:    args['--contract'],
  };
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
  let options = parseArgumentsIntoOptions(args);
  // console.log(options);
  // options = await promptForMissingOptions(options);
  await process(options);
}
