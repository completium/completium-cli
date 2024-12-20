import * as encoder from '@taquito/michelson-encoder';
import { MichelsonV1Expression } from '@taquito/rpc';
import { Expr } from '@taquito/michel-codec';

export function taquitoExecuteSchema(data : Expr, type : MichelsonV1Expression) {
  const schema = new encoder.Schema(type);
  const r = schema.Execute(data);
  return r;
}
