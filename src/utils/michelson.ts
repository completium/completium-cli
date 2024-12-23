import { emitMicheline, Expr, MichelsonType, Parser, Prim } from '@taquito/michel-codec';
import { Schema } from '@taquito/michelson-encoder';
import { handleError } from './errorHandler';
import { ArchetypeContractParameters, CompletiumParameter, getAmount } from './archetype';
import BigNumber from 'bignumber.js';
import { ArchetypeManager, Settings } from './managers/archetypeManager';
import { Options } from './options';

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

function removePrefix(str: string): string {
  return str.startsWith("%") ? str.substring(1) : str;
}

type Micheline = {
  annots?: string[];
  prim?: string;
  args?: Micheline[];
};

type InitObject = {
  [key: string]: string;
};

function visitMicheline(obj: Micheline, init: InitObject): unknown {
  if (obj.annots && obj.annots.length > 0) {
    const annot = removePrefix(obj.annots[0]);
    const objAnnot = init[annot];
    if (objAnnot) {
      return expr_micheline_to_json(objAnnot);
    }
  }
  if (obj.prim && obj.prim === "pair") {
    const args = obj.args ? obj.args.map((x) => visitMicheline(x, init)) : undefined;
    return { ...obj, prim: "Pair", args: args };
  }
  throw new Error(`Error in visitMicheline: ${JSON.stringify(obj)}`);
}

export function buildStorage(storageType: Micheline, initObjMich: InitObject): unknown {
  return visitMicheline(storageType, initObjMich);
}




var objValues: any = {};

export function build_data_michelson(type: any, storage_values: any, parameters: CompletiumParameter, parametersMicheline: any) {
  const is_micheline = !!parametersMicheline;
  const p = is_micheline ? parametersMicheline : parameters;
  if (type.annots !== undefined && type.annots.length > 0) {
    const annot1 = type.annots[0];
    const annot = annot1.startsWith("%") ? annot1.substring(1) : annot1;

    if (p[annot] !== undefined) {
      const t = type;
      let data = null;
      if (is_micheline) {
        data = p[annot]
      } else {
        const d = p[annot];
        data = build_from_js(t, d);
      }
      objValues[annot] = data;
      return data;
    } else if (storage_values[annot] !== undefined) {
      const data = expr_micheline_to_json(storage_values[annot]);
      return data;
    } else {
      throw new Error(annot + " is not found.");
    }

  } else if (type.prim !== undefined && type.prim === "pair" && type.annots === undefined
    // && (type.args.length > 2 && type.args[0].prim === "int" && type.args[1].prim === "nat"
    //   && type.args[0].annots.length == 0 && type.args[1].annots.length == 0)
  ) {

    let args;
    if (Object.keys(storage_values).length == 0 && Object.keys(parameters).length == 1) {
      const ds: any = Object.values(p)[0];
      args = [];
      for (let i = 0; i < type.args.length; ++i) {
        let a = null
        if (is_micheline) {
          a = ds[i]
        } else {
          const d = ds[i];
          const t = type.args[i];
          a = build_from_js(t, d);
        }
        args.push(a);
      }
    } else {
      args = type.args.map((t: any) => {
        return build_data_michelson(t, storage_values, parameters, parametersMicheline);
      });
    }

    return { "prim": "Pair", args: args };
  } else {
    if (is_micheline) {
      return Object.values(p)[0]
    } else {
      const d = Object.values(p)[0];
      return build_from_js(type, d);
    }
  }
}

function replaceAll(data: any, objValues: any): any {
  if (data.prim !== undefined) {
    if (objValues[data.prim] !== undefined) {
      return objValues[data.prim];
    } else if (data.args !== undefined) {
      const nargs = data.args.map((x: any) => replaceAll(x, objValues));
      return { ...data, args: nargs }
    } else {
      return data;
    }
  } else if (Array.isArray(data)) {
    return data.map((x: any) => replaceAll(x, objValues))
  } else {
    return data;
  }
}

function replace_json(obj: any, id: string, data: any): any {
  if (Array.isArray(obj)) {
    return obj.map((x: any) => replace_json(x, id, data));
  } else if (obj.prim) {
    const prim = obj.prim;
    if (prim === id) {
      return data;
    }
    if (obj.args) {
      return { ...obj, args: obj.args.map((x: any) => replace_json(x, id, data)) };
    }
  }
  return obj;
}

function process_const(obj: any, parameters: CompletiumParameter, parametersMicheline: any, contract_parameter: ArchetypeContractParameters) {
  const is_micheline = !!parametersMicheline;
  for (let i = 0; i < contract_parameter.length; ++i) {
    const cp = contract_parameter[i];
    if (cp.const) {
      const name = cp.name;
      const value = is_micheline ? parametersMicheline[name] : parameters[name];
      if (!value) {
        throw new Error(`Error: parameter "${name}" not found.`)
      }
      let data = null;
      if (is_micheline) {
        data = value;
      } else {
        const ty = expr_micheline_to_json(cp.type_);
        data = build_from_js(ty, value);
      }
      obj = replace_json(obj, name, data)
    }
  }
  return obj;
}

export async function compute_tzstorage(file: string, storageType: string, parameters: CompletiumParameter, parametersMicheline: any, contract_parameter: ArchetypeContractParameters, options: Options, s: Settings, sandbox_exec_address: string | undefined) {
  const is_micheline = !!(parametersMicheline);
  const parameters_var = []
  const parameters_const = []
  if (!!(contract_parameter)) {
    for (let i = 0; i < contract_parameter.length; ++i) {
      const cp = contract_parameter[i];
      const name = cp.name;
      const p = is_micheline ? parametersMicheline[name] : parameters[name];
      if (p !== undefined) {
        if (cp.const) {
          parameters_const.push(p)
        } else {
          parameters_var.push(p)
        }
      } else {
        throw new Error(`Error: parameter "${name}" not found.`)
      }
    }
  }
  let michelsonData;
  if (parameters_var.length > 0) {
    const storage_values = await ArchetypeManager.callArchetype({}, file, {
      ...s,
      get_storage_values: true,
      sandbox_exec_address: sandbox_exec_address ?? ''
    });
    const jsv: unknown[] = JSON.parse(storage_values);
    const sv = jsv.map((x) => x);
    const obj: Record<string, unknown> = {};
    sv.forEach((x: any) => {
      obj[x.id] = x.value;
    });

    objValues = {};
    const data = build_data_michelson(storageType, obj, parameters, parametersMicheline);
    michelsonData = replaceAll(data, objValues);
  } else {
    const storage_values = await ArchetypeManager.callArchetype(options, file, {
      target: "michelson-storage",
      sandbox_exec_address: sandbox_exec_address ?? ''
    });
    michelsonData = expr_micheline_to_json(storage_values);
  }

  if (parameters_const.length > 0) {
    michelsonData = process_const(michelsonData, parameters, parametersMicheline, contract_parameter);
  }

  return michelsonData;
}
