
 export interface Config {
  account: string;
  mode: {
    archetype: "js" | "docker" | "binary";
    "tezos-client": "binary";
  };
  bin: {
    archetype: string;
    "tezos-client": string;
  };
  tezos: {
    force_tezos_client: boolean;
    network: string;
    endpoint: string;
    list: {
      network: string;
      bcd_url: string;
      tzstat_url?: string;
      endpoints: string[];
      sandbox_exec_address?: string;
    }[];
  };
};


export interface AccountKey {
  kind: "private_key";
  value: string;
}

export interface Account {
  name: string;
  pkh: string;
  pubk: string;
  key: AccountKey;
}

export interface AccountsFile {
  accounts: Account[];
}

export interface Contract {
  name: string;
  address: string;
  network: string;
  language: string;
  compiler_version: string;
  path: string;
  initial_storage: string;
  source: string;
}

export interface ContractsFile {
  contracts: Contract[];
}
