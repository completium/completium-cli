const { setEndpoint, exec_batch, getStorage, getAccount, getValueFromBigMap, getContract, pack, sign, exprMichelineToJson,
  jsonMichelineToExpr, getAddress, isMockup, keccak, deploy, call, originate, setMockupNow, exprMichelineFromArg, blake2b, packTyped, getBalance, runGetter, generateContractInterface } = require('../src/completium');
const { setQuiet, extract, GetAmount, setAccount } = require('../src/main');
const { verifySignature } = require('@taquito/utils');
const codec = require('@taquito/michel-codec');
const encoder = require('@taquito/michelson-encoder');
const fs = require('fs')
const assert = require('assert')

setEndpoint('mockup')
setQuiet(true)

async function test() {
  try {
    const contract_json = [
      {
        "prim": "storage",
        "args": [
          {
            "prim": "option",
            "args": [
              {
                "prim": "nat"
              }
            ]
          }
        ]
      },
      {
        "prim": "parameter",
        "args": [
          {
            "prim": "nat",
            "annots": [
              "%callback"
            ]
          }
        ]
      },
      {
        "prim": "code",
        "args": [
          [
            {
              "prim": "CAR"
            },
            {
              "prim": "SOME"
            },
            {
              "prim": "NIL",
              "args": [
                {
                  "prim": "operation"
                }
              ]
            },
            {
              "prim": "PAIR"
            }
          ]
        ]
      }
    ];

    const storage_json = { "prim": "None" };

    const [c, _] = await originate(null, {
      named: 'sample_test',
      contract_json: contract_json,
      storage_json: storage_json
    });
    const storage_before = await c.getStorage();
    assert(storage_before == null);
  } catch (e) {
    console.error(e)
  }
}

test();
