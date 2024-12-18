import { emitMicheline, Expr, Parser, Prim } from '@taquito/michel-codec';
import { Schema } from '@taquito/michelson-encoder';
import { handleError } from './errorHandler';
import { ArchetypeContractParameters, CompletiumParameter, getAmount } from './archetype';
import BigNumber from 'bignumber.js';

export function expr_micheline_to_json(input: string): Expr {
  const parser = new Parser();
  const res = parser.parseMichelineExpression(input);
  if (!res) {
    throw (`Cannot convert to json: ${input}`)
  }
  return res;
}

export function json_micheline_to_expr(input: Expr): string {
  return emitMicheline(input);
}

function is_number(v: any) {
  try {
    const bigNumber = new BigNumber(v);
    if (bigNumber.isNaN()) {
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

export function build_from_js(type: Expr, jdata: any): any {

  const encode = (schema: Schema, type: Expr, jdata: any) => {
    try {
      return schema.Encode(jdata);
    } catch (e) {
      throw {
        message: 'Typecheck error',
        data: jdata,
        type: json_micheline_to_expr(type)
      }
    }
  }

  const tprim = type as Prim;
  if (tprim) {
    if (tprim.prim !== undefined) {
      const schema = new Schema(type);
      const prim = tprim.prim;
      switch (prim) {
        case 'address':
        case 'bls12_381_fr':
        case 'bls12_381_g1':
        case 'bls12_381_g2':
        case 'bool':
        case 'chain_id':
        case 'contract':
        case 'int':
        case 'key':
        case 'key_hash':
        case 'lambda':
        case 'nat':
        case 'never':
        case 'operation':
        case 'sapling_state':
        case 'sapling_transaction':
        case 'signature':
        case 'string':
        case 'ticket':
        case 'unit':
          return encode(schema, tprim, jdata)
        case 'bytes':
        case 'chest':
        case 'chest_key':
          let bdata = jdata;
          if (bdata.startsWith && bdata.startsWith("0x")) {
            bdata = bdata.substring(2);
          }
          return { bytes: bdata }
        case 'mutez':
          if (typeof jdata === "string" && jdata.endsWith("tz")) {
            const v = getAmount(jdata);
            return { "int": v.toString() }
          } else {
            return encode(schema, tprim, jdata)
          }
        case 'timestamp':
          let vdate;
          if (is_number(jdata)) {
            vdate = jdata.toString();
          } else {
            const toTimestamp = (strDate: any) => {
              var datum = Date.parse(strDate);
              return (datum / 1000).toString();
            }
            vdate = toTimestamp(jdata);
          }
          return encode(schema, tprim, vdate)
        case 'big_map':
        case 'map':
          if (!tprim.args || tprim.args.length <= 1) {
            throw ('');
          }
          const kmtype = tprim.args[0];
          const vmtype = tprim.args[1];
          if (jdata instanceof Array) {
            const mdata = jdata.map((x) => {
              if (x.key === undefined || x.value === undefined) {
                throw new Error("Type map error: no 'key' or 'value' for one item")
              }
              const k = build_from_js(kmtype, x.key);
              const v = build_from_js(vmtype, x.value);
              return { "prim": "Elt", args: [k, v] };
            });
            return mdata;
          } else {
            throw new Error(`Type map error: ${jdata} is not a map`)
          }
        case 'or':
          if (jdata.kind === undefined || jdata.value === undefined) {
            throw new Error("Type or error: no 'kind' or 'value' field")
          }
          if (!tprim.args || tprim.args.length <= 1) {
            throw new Error(`Error or`);
          }
          const odata = jdata.value;
          switch (jdata.kind.toLowerCase()) {
            case 'left':
              const ldata = build_from_js(tprim.args[0], odata);
              return { "prim": "Left", args: [ldata] };
            case 'right':
              const rdata = build_from_js(tprim.args[1], odata);
              return { "prim": "Right", args: [rdata] };
            default:
              throw new Error("Unknown type or: " + jdata.kind)
          }
        case 'pair':
          const pargs = [];
          if (!tprim.args) {
            throw new Error("Unknown type pair: none argument");
          }
          if (jdata.length < tprim.args.length) {
            throw new Error("Unknown type pair: length error data:" + jdata.length + " type: " + tprim.args.length);
          }
          for (let i = 0; i < tprim.args.length; ++i) {
            const data = build_from_js(tprim.args[i], jdata[i]);
            pargs.push(data);
          }
          return { "prim": "Pair", args: pargs };
        case 'set':
        case 'list':
          const largs = [];
          if (!tprim.args || tprim.args.length == 0) {
            throw new Error("Unknown type list");
          }
          for (let i = 0; i < jdata.length; ++i) {
            const data = build_from_js(tprim.args[0], jdata[i]);
            largs.push(data);
          }
          return largs;
        case 'option':
          if (jdata == null) {
            return encode(schema, type, jdata)
          } else {
            if (!tprim.args || tprim.args.length == 0) {
              throw new Error("Unknown type option");
            }
            let arg = jdata;
            // if (typeof jdata !== "string" && jdata.length && jdata.length > 0) {
            //   arg = jdata[0];
            // }
            const v = build_from_js(tprim.args[0], arg);
            return { prim: "Some", args: [v] };
          }
        default:
          throw new Error("Unknown type prim: " + prim)
      }

    } else {
      throw new Error("Unknown type.")
    }
  } else {
    throw new Error(`${JSON.stringify(type)} is not Prim.`)
  }
}

export function process_code_const(str: string, parameters: CompletiumParameter, parametersMicheline: any, contract_parameter: ArchetypeContractParameters) {
  const is_micheline = !!parametersMicheline;
  for (let i = 0; i < contract_parameter.length; ++i) {
    const cp = contract_parameter[i];
    if (cp.const) {
      const name = cp.name;
      let data = null;
      if (is_micheline) {
        data = parametersMicheline[name]
      } else {
        const value = parameters[name];
        if (!value) {
          handleError(`Error: parameter "${name}" not found.`)
        }
        const ty = expr_micheline_to_json(cp.type_);
        data = build_from_js(ty, value);
      }
      const str_data = json_micheline_to_expr(data);
      const pattern = 'const_' + name + '__';
      str = str.replaceAll(pattern, str_data);
    }
  }
  return str;
}