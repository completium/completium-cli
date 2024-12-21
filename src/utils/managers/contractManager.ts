import fs from "fs";
import path from "path";
import { Contract, ContractsFile } from "../types/configuration";

export class ContractManager {
  private static readonly contractsFilePath = path.join(
    process.env.HOME || "",
    ".completium/contracts.json"
  );

  /**
   * Loads the contracts from the file system.
   * If the file doesn't exist, returns an empty list.
   */
  private static loadContracts(): ContractsFile {
    if (fs.existsSync(ContractManager.contractsFilePath)) {
      const rawData = fs.readFileSync(ContractManager.contractsFilePath, "utf-8");
      return JSON.parse(rawData) as ContractsFile;
    } else {
      return { contracts: [] };
    }
  }

  /**
   * Saves the current contracts data to the file system.
   */
  public static saveContracts(contractsData: ContractsFile): void {
    const dirPath = path.dirname(ContractManager.contractsFilePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    fs.writeFileSync(
      ContractManager.contractsFilePath,
      JSON.stringify(contractsData, null, 2),
      "utf-8"
    );
  }

  /**
   * Gets all contracts.
   */
  public static getAllContracts(): Contract[] {
    return this.loadContracts().contracts;
  }

  /**
   * Gets a contract by its name.
   */
  public static getContractByName(name: string): Contract | null {
    const contracts = this.getAllContracts();
    return contracts.find((contract) => contract.name === name) || null;
  }

  /**
   * Gets a contract by its address.
   */
  public static getContractByAddress(address: string): Contract | null {
    const contracts = this.getAllContracts();
    return contracts.find((contract) => contract.address === address) || null;
  }

  /**
   * Gets a contract by its name or address.
   */
  public static getContractByNameOrAddress(identifier: string): Contract | null {
    const contracts = this.getAllContracts();
    return (
      contracts.find(
        (contract) => contract.name === identifier || contract.address === identifier
      ) || null
    );
  }

  /**
   * Adds a new contract to the list.
   */
  public static addContract(contract: Contract): void {
    const contractsData = this.loadContracts();
    if (
      contractsData.contracts.find((c) => c.name === contract.name) ||
      contractsData.contracts.find((c) => c.address === contract.address)
    ) {
      throw new Error(
        `Contract with name "${contract.name}" or address "${contract.address}" already exists.`
      );
    }
    contractsData.contracts.push(contract);
    this.saveContracts(contractsData);
  }

  public static removeContractByName(name: string): void {
    const contractsData = this.loadContracts();
    const filteredContracts = contractsData.contracts.filter((contract) => contract.name !== name);

    if (filteredContracts.length === contractsData.contracts.length) {
      throw new Error(`Contract with name '${name}' does not exist.`);
    }

    contractsData.contracts = filteredContracts;
    this.saveContracts(contractsData);
  }

  /**
   * Writes the source code file synchronously.
   * @param arl - Path to the source file.
   * @param ext - Extension for the output file.
   * @param contractName - Name of the contract.
   * @returns The path to the written file.
   */
  public static writeSource(arl: string, ext: string, contract_name: string): string {
    const sources_dir = path.join(process.env.HOME || "", ".completium", "sources");
    if (!fs.existsSync(sources_dir)) {
      fs.mkdirSync(sources_dir, { recursive: true });
    }
  
    const data = fs.readFileSync(arl, "utf8");
    const source_path = path.join(sources_dir, `${contract_name}.${ext}`);
    fs.writeFileSync(source_path, data, "utf8");
  
    return source_path;
  }
  
  /**
   * Writes the contract file synchronously.
   * @param data - Contract data to write.
   * @param contractName - Name of the contract.
   * @returns The path to the written file.
   */
  public static writeContract(data: string | NodeJS.ArrayBufferView, contract_name: string): string {
    const contracts_dir = path.join(process.env.HOME || "", ".completium", "contracts");
    if (!fs.existsSync(contracts_dir)) {
      fs.mkdirSync(contracts_dir, { recursive: true });
    }
  
    const contract_path = path.join(contracts_dir, `${contract_name}.tz`);
    fs.writeFileSync(contract_path, data);
  
    return contract_path;
  }
  
}
