import { handleError } from "../utils/errorHandler";
import { askQuestionBool } from "../utils/interaction";
import { ConfigManager } from "../utils/managers/configManager";
import { ContractManager } from "../utils/managers/contractManager";
import { Options } from "../utils/options";
import { Printer } from "../utils/printer";
import { get_sandbox_exec_script } from "../utils/tezos";
import { Contract } from "../utils/types/configuration";

export function showContracts() {
  const contracts = ContractManager.getAllContracts();

  contracts.forEach((x: Contract) => {
    Printer.print(`${x.address}\t${x.network}\t${x.name}`);
  });
}

export function showContract(value: string) {
  var contract = ContractManager.getContractByName(value);
  if (!contract) {
    contract = ContractManager.getContractByAddress(value);
  }

  if (!contract) {
    return handleError(`Contract '${value}' is not found.`)
  }

  const network = ConfigManager.getNetworkByName(contract.network);
  var url = null
  if (network) {
    url = network.bcd_url.replace('${address}', contract.address);
  }

  const with_color = true;
  const cyan = '36';
  const start = with_color ? `\x1b[${cyan}m` : '';
  const end = with_color ? `\x1b[0m` : '';

  Printer.print(`${start}Name${end}     : ${contract.name}`);
  Printer.print(`${start}Network${end}  : ${contract.network}`);
  Printer.print(`${start}Address${end}  : ${contract.address}`);
  Printer.print(`${start}Source${end}   : ${contract.source}`);
  Printer.print(`${start}Language${end} : ${contract.language}`);
  Printer.print(`${start}Version${end}  : ${contract.compiler_version}`);
  if (!url) {
    Printer.print(`${start}Url${end}      : ${url}`);
  }
  if (contract.path !== undefined) {
    Printer.print(`${start}Path${end}     : ${contract.path}`);
  }
  if (contract.initial_storage !== undefined) {
    Printer.print(`${start}Storage${end}  : ${contract.initial_storage}`);
  }
}

export function printContract(name: string) {
  let script = undefined;
  switch (name) {
    case "sandbox_exec":
      script = get_sandbox_exec_script()
      break;
    default:
      const msg = `Unknown contract ${name}.`;
      return new Promise((resolve, reject) => { reject(msg) });
  }
  Printer.print(script)
}

export function importContract(value: string, name: string) {
  try {
    const existingContractByName = ContractManager.getContractByName(name);
    if (existingContractByName) {
      handleError(`Contract with name '${name}' already exists.`);
    }

    const existingContractByAddress = ContractManager.getContractByAddress(value);
    if (existingContractByAddress) {
      handleError(`Contract with address '${value}' already exists.`);
    }

    // TODO: check if address exists in the network

    const contract: Contract = {
      name,
      address: value,
      network: ConfigManager.getNetwork(),
      source: null,
      language: null,
      compiler_version: null,
      initial_storage: null,
      path: null,
    };

    ContractManager.addContract(contract);

    Printer.print(`Contract '${name}' (${value}) has been successfully imported.`);
  } catch (error) {
    const err = error as Error;
    Printer.error(`Failed to import contract: ${err.message}`);
  }
}

export async function renameContract(from: string, to: string, options: Options) {
  try {
    const force = options.force ?? false;

    let contract = ContractManager.getContractByName(from);
    if (!contract) {
      contract = ContractManager.getContractByAddress(from);
    }

    if (!contract) {
      handleError(`'${from}' is not found.`);
      return;
    }

    const existingContract = ContractManager.getContractByName(to);
    if (existingContract) {
      if (!force) {
        handleError(`Contract with name '${to}' already exists.`);
        return;
      }
      ContractManager.removeContractByName(to);
      Printer.print(`Contract '${to}' was removed to allow renaming.`);
    }

    const updatedContract = { ...contract, name: to };
    ContractManager.removeContractByName(contract.name);
    ContractManager.addContract(updatedContract);

    Printer.print(`Contract '${contract.name}' has been renamed to '${to}'.`);
  } catch (error) {
    const err = error as Error;
    Printer.error(`Failed to rename contract: ${err.message}`);
  }
}

/**
 * Asks the user for confirmation to overwrite an existing account.
 * If `force` is true or the account doesn't exist, it automatically confirms.
 * @param force A boolean indicating whether to skip confirmation and force overwrite.
 * @param contract The contract name to check for confirmation.
 * @returns A promise that resolves to `true` if the user confirms, otherwise `false`.
 */
export async function confirmOperation(
  force: boolean,
  contract: Contract
): Promise<boolean> {
  // Automatically confirm if force is true or the account does not exist
  if (force) {
    return true;
  }

  // Construct the confirmation message
  const confirmationMessage = `Are you sure you want to remove the contract '${contract.name}'?`;

  // Use askQuestionBool to get confirmation from the user
  return new Promise((resolve) => {
    askQuestionBool(confirmationMessage, (answer) => resolve(answer), false);
  });
}

export async function removeContract(value: string, options: Options) {
  try {
    const force = options.force ?? false;

    let contract = ContractManager.getContractByName(value);
    if (!contract) {
      contract = ContractManager.getContractByAddress(value);
    }

    if (!contract) {
      handleError(`Contract '${value}' is not found.`);
      return;
    }

    if (!force) {
      const confirm = await confirmOperation(force, contract);
      if (!confirm) {
        Printer.print("Contract removal cancelled.");
        return;
      }
    }

    ContractManager.removeContractByName(contract.name);

    Printer.print(`Contract '${contract.name}' has been removed.`);
  } catch (error) {
    const err = error as Error;
    Printer.error(`Failed to remove contract: ${err.message}`);
  }
}