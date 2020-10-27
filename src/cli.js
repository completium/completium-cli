import arg from 'arg';
import inquirer from 'inquirer';
import { process } from './main';

function parseArgumentsIntoOptions(rawArgs) {
  const args = arg(
    {
      '-y': '--yes',
      '-a:' : '--account',
      '-f' : '--file',
      '--init': Boolean,
      '--deploy': Boolean,
    },
    {
      argv: rawArgs.slice(2),
    }
  );
  return {
    init:    args['--init'] || false,
    deploy:  args['--deploy'] || false,
    account: args['--account'],
    file:    args['--file'],
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
  // options = await promptForMissingOptions(options);
  await process(options);
}
