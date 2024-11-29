import { AccountsManager } from "../utils/managers/accountsManager";
import { ConfigManager } from "../utils/managers/configManager";
import { ContractManager } from "../utils/managers/contractManager";
import { Printer } from "../utils/printer";
import { Account, Config, ContractsFile } from "../utils/types/configuration";

/**
 * Initializes Completium CLI by setting up default configurations, accounts, and directories.
 * If configuration already exists, it updates with defaults while preserving existing values.
 */
export async function initCompletium(): Promise<void> {
  const defaultConfig: Config = {
    account: "alice",
    mode: {
      archetype: "js",
      "tezos-client": "binary",
    },
    bin: {
      archetype: "archetype",
      "tezos-client": "octez-client",
    },
    tezos: {
      force_tezos_client: false,
      network: "ghost",
      endpoint: "https://ghostnet.ecadinfra.com",
      list: [
        {
          network: "main",
          bcd_url: "https://better-call.dev/mainnet/${address}",
          tzstat_url: "https://tzstats.com",
          endpoints: [
            "https://mainnet.api.tez.ie",
            "https://mainnet.smartpy.io",
            "https://mainnet.tezos.marigold.dev",
            "https://mainnet-tezos.giganode.io",
            "https://rpc.tzbeta.net",
          ],
          sandbox_exec_address: "KT19wkxScvCZghXQbpZNaP2AwTJ63gBhdofE",
        },
        {
          network: "ghost",
          bcd_url: "https://better-call.dev/ghostnet/${address}",
          tzstat_url: "https://tzstats.com",
          endpoints: [
            "https://ghostnet.ecadinfra.com",
            "https://ghostnet.smartpy.io",
            "https://ghostnet.tezos.marigold.dev",
          ],
          sandbox_exec_address: "KT1MS3bjqJHYkg4mEiRgVmfXGoGUHAdXUuLL",
        },
        {
          network: "nairobi",
          bcd_url: "https://better-call.dev/nairobinet/${address}",
          tzstat_url: "https://nairobi.tzstats.com",
          endpoints: [
            "https://nairobinet.ecadinfra.com",
            "https://nairobinet.smartpy.io",
            "https://nairobinet.tezos.marigold.dev",
          ],
        },
        {
          network: "oxford",
          bcd_url: "https://better-call.dev/oxfordnet/${address}",
          tzstat_url: "https://oxford.tzstats.com",
          endpoints: [
            "https://oxfordnet.ecadinfra.com",
            "https://oxfordnet.smartpy.io",
            "https://oxfordnet.tezos.marigold.dev",
          ],
        },
        {
          network: "sandbox",
          bcd_url: "https://localhost:8080/sandbox/${address}",
          endpoints: ["http://localhost:20000", "http://localhost:8732"],
        },
        {
          network: "mockup",
          bcd_url: "",
          endpoints: ["mockup"],
        },
      ],
    },
  };

  const defaultAccounts: Account[] = [
    {
      "name": "alice",
      "pkh": "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb",
      "pubk": "edpkvGfYw3LyB1UcCahKQk4rF2tvbMUk8GFiTuMjL75uGXrpvKXhjn",
      "key": {
        "kind": "private_key",
        "value": "edsk3QoqBuvdamxouPhin7swCvkQNgq4jP5KZPbwWNnwdZpSpJiEbq"
      }
    },
    {
      "name": "bob",
      "pkh": "tz1aSkwEot3L2kmUvcoxzjMomb9mvBNuzFK6",
      "pubk": "edpkurPsQ8eUApnLUJ9ZPDvu98E8VNj4KtJa1aZr16Cr5ow5VHKnz4",
      "key": {
        "kind": "private_key",
        "value": "edsk3RFfvaFaxbHx8BMtEW1rKQcPtDML3LXjNqMNLCzC3wLC1bWbAt"
      }
    },
    {
      "name": "carl",
      "pubk": "edpkugep78JxqeTzJ6N2dvAUKBGdHrHVbytAzUHGLLHrfXweSzX2oG",
      "pkh": "tz1aGDrJ58LbcnD47CkwSk3myfTxJxipYJyk",
      "key": {
        "kind": "private_key",
        "value": "edskS8eMgJopZofUWiuzRTrQJPGRoR3mcYEhhp2BTpR91ZMjmvHMEdfoPFfGaiXSV9M1NG21r4zQcz5QYPY1BtqigMSrd8eVUv"
      }
    },
    {
      "name": "bootstrap1",
      "pkh": "tz1KqTpEZ7Yob7QbPE4Hy4Wo8fHG8LhKxZSx",
      "pubk": "edpkuBknW28nW72KG6RoHtYW7p12T6GKc7nAbwYX5m8Wd9sDVC9yav",
      "key": {
        "kind": "private_key",
        "value": "edsk3gUfUPyBSfrS9CCgmCiQsTCHGkviBDusMxDJstFtojtc1zcpsh"
      }
    },
    {
      "name": "bootstrap2",
      "pkh": "tz1gjaF81ZRRvdzjobyfVNsAeSC6PScjfQwN",
      "pubk": "edpktzNbDAUjUk697W7gYg2CRuBQjyPxbEg8dLccYYwKSKvkPvjtV9",
      "key": {
        "kind": "private_key",
        "value": "edsk39qAm1fiMjgmPkw1EgQYkMzkJezLNewd7PLNHTkr6w9XA2zdfo"
      }
    },
    {
      "name": "bootstrap3",
      "pkh": "tz1faswCTDciRzE4oJ9jn2Vm2dvjeyA9fUzU",
      "pubk": "edpkuTXkJDGcFd5nh6VvMz8phXxU3Bi7h6hqgywNFi1vZTfQNnS1RV",
      "key": {
        "kind": "private_key",
        "value": "edsk4ArLQgBTLWG5FJmnGnT689VKoqhXwmDPBuGx3z4cvwU9MmrPZZ"
      }
    },
    {
      "name": "bootstrap4",
      "pkh": "tz1b7tUupMgCNw2cCLpKTkSD1NZzB5TkP2sv",
      "pubk": "edpkuFrRoDSEbJYgxRtLx2ps82UdaYc1WwfS9sE11yhauZt5DgCHbU",
      "key": {
        "kind": "private_key",
        "value": "edsk2uqQB9AY4FvioK2YMdfmyMrer5R8mGFyuaLLFfSRo8EoyNdht3"
      }
    },
    {
      "name": "bootstrap5",
      "pkh": "tz1ddb9NMYHZi5UzPdzTZMYQQZoMub195zgv",
      "pubk": "edpkv8EUUH68jmo3f7Um5PezmfGrRF24gnfLpH3sVNwJnV5bVCxL2n",
      "key": {
        "kind": "private_key",
        "value": "edsk4QLrcijEffxV31gGdN2HU7UpyJjA8drFoNcmnB28n89YjPNRFm"
      }
    }
  ];

  // Configuration initialization
  try {
    ConfigManager.getConfig();
    Printer.print("Configuration already exists. Skipping creation.");
  } catch {
    ConfigManager.updateConfig(defaultConfig);
    Printer.print("Configuration initialized successfully.");
  }

  // Accounts initialization
  try {
    const existingAccounts = AccountsManager.getAccounts();
    if (existingAccounts.length === 0) {
      defaultAccounts.forEach((account) => AccountsManager.addAccount(account));
      Printer.print("Default accounts created successfully.");
    } else {
      Printer.print("Accounts already exist. Skipping creation.");
    }
  } catch {
    defaultAccounts.forEach((account) => AccountsManager.addAccount(account));
    Printer.print("Accounts initialized successfully.");
  }

  // Contracts initialization
  try {
    const contracts = ContractManager.getAllContracts();
    if (contracts.length === 0) {
      Printer.print("Contracts already initialized.");
    }
  } catch {
    Printer.print("No contracts found. Initializing empty contracts file.");
    const contractsFile: ContractsFile = { contracts: [] };
    ContractManager.saveContracts(contractsFile);
  }
}
