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
}
