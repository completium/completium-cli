import * as encoder from '@taquito/michelson-encoder';
import { MichelsonV1Expression } from '@taquito/rpc';
import { Expr } from '@taquito/michel-codec';
import { ConfigManager } from './managers/configManager';
import { TezosToolkit } from '@taquito/taquito';
import { AccountsManager } from './managers/accountsManager';
import { InMemorySigner } from '@taquito/signer';
import { Printer } from './printer';

export function getSigner(forceAccount: string): { signer: InMemorySigner } | null {
  const account = ConfigManager.getDefaultAccount();
  if (!forceAccount && !account) {
    Printer.print("Cannot execute this command, please generate an account first.");
    return null;
  }
  var a = forceAccount ?? account;
  var ac = AccountsManager.getAccountByNameOrPkh(a);
  if (!ac) {
    Printer.print(`${account} is not found.`);
    return null;
  }
  return {
    signer: new InMemorySigner(ac.key.value)
  }
}

export function getTezos(forceAccount : string): TezosToolkit {
  const tezos_endpoint = ConfigManager.getEndpoint();
  const tezos = new TezosToolkit(tezos_endpoint);
  const signer = getSigner(forceAccount);
  if (!signer) {
    throw new Error('Invalid Signer');
  }
  tezos.setProvider(signer);
  return tezos;
}

export function taquitoExecuteSchema(data: Expr, type: MichelsonV1Expression) {
  const schema = new encoder.Schema(type);
  const r = schema.Execute(data);
  return r;
}
