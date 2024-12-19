import fs from "fs";
import path from "path";
import { Contract, ContractsFile } from "../types/configuration";
import { ConfigManager } from "./configManager";
import { askQuestionBool } from "../interaction";
import { Options } from "../options";
import { Printer } from "../printer";

export interface LogTransation {
  args_command: string[],
  stdout: string,
  stderr: string,
  failed: boolean,
  entrypoint: string,
  amount: string,
  arg: string,
  destination: string,
  contract_address: string,
  source: string,
  arg_completium: any
}

export class LogManager {
  private static readonly logPath = path.join(
    process.env.HOME || "",
    ".completium/log.json"
  );

  private static loadLog(): any {
    return JSON.parse(fs.readFileSync(LogManager.logPath, 'utf8'));
  }

  private static saveLog(c: any) {
    const content = JSON.stringify(c, null, 2);
    fs.writeFileSync(LogManager.logPath, content);
  }


  public static writeEmptyLog() {
    const input = {
      log: []
    }

    this.saveLog(input);
  }

  private static async confirmLogClear(force: boolean) {
    if (force) { return true }
    return new Promise(resolve => { askQuestionBool(`Are you sure to clear log ?`, answer => { resolve(answer); }) });
  }

  private static addLog(data: any) {
    const log = this.loadLog().log.push(data);

    this.saveLog(log)
  }


  // private initLogData(kind, input) {
  //   let command = "";
  //   if (input.args_command) {
  //     input.args_command.forEach(x => {
  //       const y = x.includes(' ') || x.includes('"') ? `'${x}'` : x
  //       command += " " + y
  //     })
  //   }
  //   command = command.trim()

  //   const data = {
  //     kind: kind,
  //     date: new Date().toISOString(),
  //     command: command,
  //     stdout: input.stdout,
  //     stderr: input.stderr,
  //     failed: input.failed,
  //   }

  //   return data;
  // }

  // private extractUpdatedStorage(input) {
  //   // const rx = /.*\Updated storage: (.*).*/g;
  //   /*
  //   ** lib_client/operation_result.ml file around 555 line
  //   */
  //   let rx = null;
  //   if (input.includes('Storage size:')) {
  //     rx = /Updated storage:\s*([^]*?)\s*Storage size:/g;
  //   } else if (input.includes('Updated big_maps:')) {
  //     rx = /Updated storage:\s*([^]*?)\s*Updated big_maps:/g;
  //   } else if (input.includes('Paid storage size diff:')) {
  //     rx = /Updated storage:\s*([^]*?)\s*Paid storage size diff:/g;
  //   } else {
  //     rx = /Updated storage:\s*([^]*?)\s*Consumed gas:/g;
  //   }
  //   const arr = rx.exec(input);
  //   if (!isNull(arr)) {
  //     const res = unescape(arr[1]);
  //     return res
  //   } else {
  //     return null
  //   }
  // }

  // private extractStorageSize(input) {
  //   const rx = /.*\Storage size: (.*) bytes/g;
  //   const arr = rx.exec(input);
  //   if (!isNull(arr)) {
  //     const res = unescape(arr[1]);
  //     return res
  //   } else {
  //     return null
  //   }
  // }

  // private extractBalanceUpdates(input) {
  //   if (input.indexOf("Balance updates:") == -1) {
  //     return undefined
  //   }
  //   const result = [];

  //   const lines = input.split('\n');
  //   let startParsing = false;

  //   for (let i = 0; i < lines.length; i++) {
  //     const line = lines[i].trim();

  //     if (startParsing) {
  //       const parts = line.split(" ");
  //       const address = parts.slice(0, parts.length - 2).join(' ');
  //       const value = parts[parts.length - 1];
  //       if (address && address.length > 0 && value && value.length > 0) {
  //         result.push({ dest: address, value: value });
  //       }

  //     } else if (line.startsWith("Balance updates:")) {
  //       startParsing = true;
  //     }
  //   }

  //   return result;
  // }

  // private extractMainBalanceUpdates(input) {
  //   const begin = input.indexOf("Transaction:")
  //   if (begin == -1) {
  //     return undefined
  //   }
  //   const end = input.indexOf("Internal operations:")
  //   let o;
  //   if (end == -1) {
  //     o = input.substring(begin)
  //   } else {
  //     o = input.substring(begin, end)
  //   }
  //   return extractBalanceUpdates(o)
  // }

  // private extractDestination(input) {
  //   const rx = /.*\To: (.*)/g;
  //   const arr = rx.exec(input);
  //   if (!isNull(arr)) {
  //     const res = unescape(arr[1]);
  //     return res
  //   } else {
  //     return null
  //   }
  // }

  // private extractConsumedGas(input) {
  //   const rx = /.*\Consumed gas: (.*)/g;
  //   const arr = rx.exec(input);
  //   if (!isNull(arr)) {
  //     const res = unescape(arr[1]);
  //     return res
  //   } else {
  //     return null
  //   }
  // }

  // private extractAddressOriginition(input) {
  //   const rx = /.*\New contract (.*) originated/g;
  //   const arr = rx.exec(input);
  //   if (!isNull(arr)) {
  //     const res = unescape(arr[1]);
  //     return res
  //   } else {
  //     return null
  //   }
  // }

  // private extractPaidStorageSizeDiff(input) {
  //   const rx = /.*\Paid storage size diff: (.*) bytes/g;
  //   const arr = rx.exec(input);
  //   if (!isNull(arr)) {
  //     const res = unescape(arr[1]);
  //     return res
  //   } else {
  //     return null
  //   }
  // }


  // private extractOperationHash(input) {
  //   const rx = /.*\Operation hash is '(.*)'.*/g;
  //   const arr = rx.exec(input);
  //   if (!isNull(arr)) {
  //     const res = unescape(arr[1]);
  //     return res
  //   } else {
  //     return null
  //   }
  // }

  // private extractFailData(input) {
  //   const rx = /.*\with (.*)/g;
  //   const arr = rx.exec(input);
  //   if (!isNull(arr)) {
  //     const res = unescape(arr[1]);
  //     return res
  //   } else {
  //     return null
  //   }
  // }
  
  // exports.extract = extractFailData

  // private addLogAs(data, source) {
  //   const account = getAccountFromIdOrAddr(source)
  //   if (account && account.name) {
  //     data = { ...data, as: account.name }
  //   }
  //   return data
  // }

  // private addLogOrigination(input) {
  //   let data = initLogData('origination', input);
  //   data = {
  //     ...data,
  //     amount: input.amount,
  //     storage: input.storage,
  //     source: input.source,
  //     amount: input.amount,
  //     storage: input.storage,
  //     name: input.name,
  //   }

  //   data = addLogAs(data, input.source)

  //   if (!input.failed && input.stdout) {
  //     const output = input.stdout;

  //     data = {
  //       ...data,
  //       operation: extractOperationHash(output),
  //       storage_size: extractStorageSize(output),
  //       consumed_gas: extractConsumedGas(output),
  //       paid_storage_size_diff: extractPaidStorageSizeDiff(output),
  //       address: extractAddressOriginition(output),
  //     }
  //   }

  //   addLog(data)
  // }

  // private process_internal_transactions(input) {
  //   let transactions = [];

  //   const a = input.split('Internal Transaction:')
  //   for (b of a) {
  //     const c = b.trim() + '\n';
  //     if (c.length > 2 && c.indexOf("Internal Event:") == -1) {
  //       const from = extract_regexp(/From: ((.)+)\n/g, c)
  //       const to = extract_regexp(/To: ((.)+)\n/g, c)
  //       const amount = extract_regexp(/Amount: ((.)+)\n/g, c)
  //       const entrypoint = c.indexOf("Entrypoint:") != -1 ? extract_regexp(/Entrypoint: ((.)+)\n/g, c) : undefined;
  //       const parameter = c.indexOf("Parameter:") != -1 ? extract_regexp(/Parameter: ((.)+)\n/g, c) : undefined;
  //       const consumed_gas = c.indexOf("Consumed gas:") != -1 ? extract_regexp(/Consumed gas: ((.)+)\n/g, c) : undefined;
  //       const updated_storage = c.indexOf("Entrypoint:") != -1 ? extractUpdatedStorage(c) : undefined;
  //       const storage_size = c.indexOf("Storage size:") != -1 ? extractStorageSize(c) : undefined;
  //       const balance_updates = c.indexOf("Balance updates:") != -1 ? extractBalanceUpdates(c) : undefined;
  //       const paid_storage_size_diff = c.indexOf("Paid storage size diff:") != -1 ? extractPaidStorageSizeDiff(c) : undefined;


  //       if (from && to && consumed_gas) {
  //         transactions.push({
  //           source: from,
  //           destination: to,
  //           amount: amount.includes("ꜩ") ? amount.split("ꜩ").join("") : amount,
  //           entrypoint: entrypoint,
  //           arg: parameter,
  //           consumed_gas: consumed_gas,
  //           updated_storage: updated_storage,
  //           storage_size: storage_size,
  //           balance_updates: balance_updates,
  //           paid_storage_size_diff: paid_storage_size_diff
  //         })
  //       }
  //     }
  //   }
  //   return transactions
  // }

  // private buildLogTransaction(input: LogTransation) {
  //   let data = initLogData('transaction', input);

  //   const now = getMockupNow();
  //   const level = getMockupLevel();

  //   data = {
  //     ...data,
  //     entrypoint: input.entrypoint,
  //     amount: input.amount,
  //     arg: input.arg,
  //     entrypoint: input.entrypoint,
  //     source: input.source,
  //     amount: input.amount,
  //     destination: input.contract_address,
  //     arg_completium: input.arg_completium,
  //     now: now,
  //     level: level
  //   }

  //   data = addLogAs(data, input.source)

  //   if (input.failed && input.stderr) {
  //     const stderr = input.stderr;

  //     data = {
  //       ...data,
  //       "fail": extractFailData(stderr)
  //     }
  //   }

  //   if (!input.failed && input.stdout) {
  //     const output = input.stdout;

  //     data = {
  //       ...data,
  //       destination: extractDestination(output),
  //       operation: extractOperationHash(output),
  //       updated_storage: extractUpdatedStorage(output),
  //       storage_size: extractStorageSize(output),
  //       consumed_gas: extractConsumedGas(output),
  //       balance_updates: extractMainBalanceUpdates(output),
  //       paid_storage_size_diff: extractPaidStorageSizeDiff(output)
  //     }
  //   }

  //   const internal_operations_sep = "Internal operations:";
  //   if (input.stdout && input.stdout.includes(internal_operations_sep)) {
  //     const start_index = input.stdout.indexOf(internal_operations_sep)
  //     const output = input.stdout.slice(start_index + internal_operations_sep.length)

  //     const internal_operations = process_internal_transactions(output);
  //     data = {
  //       ...data,
  //       internal_operations: internal_operations
  //     }
  //   }

  //   return data
  // }

  // private addLogTransaction(input: LogTransation) {
  //   const data = this.buildLogTransaction(input)
  //   this.addLog(data)
  // }


  public static logInit() {
    if (!fs.existsSync(this.logPath)) {
      this.writeEmptyLog();
    }
  }
  
  public static logEnable() {
    ConfigManager.setLogMode(true);
    Printer.print(`Enable logging.`);
  }

  public static logDisable() {
    ConfigManager.setLogMode(false);
    Printer.print(`Disable logging.`);
  }

  public static logStatus() {
    const res = ConfigManager.isLogMode();
    Printer.print(`Logging is ${res ? 'enabled' : 'disabled'}.`);
  }

  public static async logClear(options: Options) {
    const force = options.force ?? false;

    const confirm = await this.confirmLogClear(force);
    if (!confirm) {
      return;
    }

    this.writeEmptyLog();

    Printer.print(`Log is cleared.`)
  }

  public static logDump() {
    Printer.print(JSON.stringify(this.loadLog(), null, 2))
  }

}
