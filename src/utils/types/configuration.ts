
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
  log_mode?: boolean;
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
  language: string | null;
  compiler_version: string | null;
  path: string | null;
  initial_storage: string | null;
  source: string | null;
}

export interface ContractsFile {
  contracts: Contract[];
}
