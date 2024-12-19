import fs from 'fs';
import { Options } from "../utils/options"
import { Printer } from '../utils/printer';

type Version = {
  archetype_ts_types: string,
  completium_cli: string,
  experiment_ts: string,
  ts_mocha: string,
  types_expect: string,
  types_mocha: string,
  types_node: string,
  typescript: string,
  eslint_plugin: string,
  eslint_parser: string,
  eslint: string,
}

const gen_contract_template = () => `
archetype hello

variable s : string = ""

entry exec() {
  s := "Hello Archetype World!"
}
`

const gen_run_test = () => `
#! /bin/sh

if [ $# -eq 0 ]; then
  ts-mocha --timeout 0 --slow 99999999999999999 ./tests/*.ts
else
  ts-mocha --timeout 0 --slow 99999999999999999 ./tests/$1.ts
fi
`

const gen_test_template = () => `
import {configure_experiment, get_account, set_mockup, set_mockup_now} from "@completium/experiment-ts";

import { hello } from './binding/hello'

import assert from 'assert'

/* Accounts ---------------------------------------------------------------- */

const alice = get_account('alice');

/* Initialisation ---------------------------------------------------------- */

describe('Initialisation', () => {
  it('Configure experiment', async () => {
    await configure_experiment({
      account: 'alice',
      endpoint: 'mockup',
      quiet: true,
    });
  });
  it('set_mockup', () => {
    set_mockup()
    // await mockup_init()
  });
  it('set_mockup_now', () => {
    set_mockup_now(new Date(Date.now()))
  });
})

/* Scenario ---------------------------------------------------------------- */

describe('[HELLO] Contract deployment', () => {
  it('Deploy test_binding', async () => {
    await hello.deploy({ as: alice })
  });
})

describe('[HELLO] Call entry', () => {
  it("Call 'myentry'", async () => {
    const s_before = await hello.get_s()
    assert(s_before === "")
    await hello.exec({ as : alice })
    const s_after = await hello.get_s()
    assert(s_after === "Hello Archetype World!")
  })
})
`

const gen_package_json = (name: string, versions: Version) => `
{
  "name": "${name}",
  "version": "1.0.0",
  "scripts": {
    "test": "./run_test.sh",
    "gen-binding": "completium-cli run binder-ts",
    "completium_init": "completium-cli init",
    "mockup_init": "completium-cli mockup init"
  },
  "dependencies": {
    "@completium/archetype-ts-types": "${versions.archetype_ts_types}",
    "@completium/completium-cli": "${versions.completium_cli}",
    "@completium/experiment-ts": "${versions.experiment_ts}"
  },
  "devDependencies": {
    "@types/expect": "${versions.types_expect}",
    "@types/mocha": "${versions.types_mocha}",
    "@types/node": "${versions.types_node}",
    "@typescript-eslint/eslint-plugin": "${versions.eslint_plugin}",
    "@typescript-eslint/parser": "${versions.eslint_parser}",
    "eslint": "${versions.eslint}",
    "ts-mocha": "${versions.ts_mocha}",
    "typescript": "${versions.typescript}"
  },
  "completium": {
    "binding_path": "./tests/binding/",
    "build_path": "./build/",
    "contracts_path": "./contracts/",
    "tests_path": "./tests/"
  }
}
`

const gen_tsconfig = () => `
{
  "compilerOptions": {
    /* Visit https://aka.ms/tsconfig.json to read more about this file */

    /* Projects */
    // "incremental": true,                              /* Enable incremental compilation */
    // "composite": true,                                /* Enable constraints that allow a TypeScript project to be used with project references. */
    // "tsBuildInfoFile": "./",                          /* Specify the folder for .tsbuildinfo incremental compilation files. */
    // "disableSourceOfProjectReferenceRedirect": true,  /* Disable preferring source files instead of declaration files when referencing composite projects */
    // "disableSolutionSearching": true,                 /* Opt a project out of multi-project reference checking when editing. */
    // "disableReferencedProjectLoad": true,             /* Reduce the number of projects loaded automatically by TypeScript. */

    /* Language and Environment */
    "target": "ES6",                                     /* Set the JavaScript language version for emitted JavaScript and include compatible library declarations. */
    // "lib": [],                                        /* Specify a set of bundled library declaration files that describe the target runtime environment. */
    // "jsx": "preserve",                                /* Specify what JSX code is generated. */
    // "experimentalDecorators": true,                   /* Enable experimental support for TC39 stage 2 draft decorators. */
    // "emitDecoratorMetadata": true,                    /* Emit design-type metadata for decorated declarations in source files. */
    // "jsxFactory": "",                                 /* Specify the JSX factory function used when targeting React JSX emit, e.g. 'React.createElement' or 'h' */
    // "jsxFragmentFactory": "",                         /* Specify the JSX Fragment reference used for fragments when targeting React JSX emit e.g. 'React.Fragment' or 'Fragment'. */
    // "jsxImportSource": "",                            /* Specify module specifier used to import the JSX factory functions when using 'jsx: react-jsx*'. */
    // "reactNamespace": "",                             /* Specify the object invoked for 'createElement'. This only applies when targeting 'react' JSX emit. */
    // "noLib": true,                                    /* Disable including any library files, including the default lib.d.ts. */
    // "useDefineForClassFields": true,                  /* Emit ECMAScript-standard-compliant class fields. */

    /* Modules */
    "module": "commonjs",                                /* Specify what module code is generated. */
    "rootDir": "./",                                     /* Specify the root folder within your source files. */
    // "moduleResolution": "node",                       /* Specify how TypeScript looks up a file from a given module specifier. */
    // "baseUrl": "./",                                  /* Specify the base directory to resolve non-relative module names. */
    // "paths": {},                                      /* Specify a set of entries that re-map imports to additional lookup locations. */
    // "rootDirs": [],                                   /* Allow multiple folders to be treated as one when resolving modules. */
    // "typeRoots": [],                                  /* Specify multiple folders that act like './node_modules/@types'. */
    // "types": [],                                      /* Specify type package names to be included without being referenced in a source file. */
    // "allowUmdGlobalAccess": true,                     /* Allow accessing UMD globals from modules. */
    // "resolveJsonModule": true,                        /* Enable importing .json files */
    // "noResolve": true,                                /* Disallow 'import's, 'require's or '<reference>'s from expanding the number of files TypeScript should add to a project. */

    /* JavaScript Support */
    // "allowJs": true,                                  /* Allow JavaScript files to be a part of your program. Use the 'checkJS' option to get errors from these files. */
    // "checkJs": true,                                  /* Enable error reporting in type-checked JavaScript files. */
    // "maxNodeModuleJsDepth": 1,                        /* Specify the maximum folder depth used for checking JavaScript files from 'node_modules'. Only applicable with 'allowJs'. */

    /* Emit */
    "declaration": true,                                 /* Generate .d.ts files from TypeScript and JavaScript files in your project. */
    "declarationMap": true,                              /* Create sourcemaps for d.ts files. */
    // "emitDeclarationOnly": true,                      /* Only output d.ts files and not JavaScript files. */
    "sourceMap": true,                                   /* Create source map files for emitted JavaScript files. */
    // "outFile": "./",                                  /* Specify a file that bundles all outputs into one JavaScript file. If 'declaration' is true, also designates a file that bundles all .d.ts output. */
    "outDir": "../build",                                /* Specify an output folder for all emitted files. */
    // "removeComments": true,                           /* Disable emitting comments. */
    // "noEmit": true,                                   /* Disable emitting files from a compilation. */
    // "importHelpers": true,                            /* Allow importing helper functions from tslib once per project, instead of including them per-file. */
    // "importsNotUsedAsValues": "remove",               /* Specify emit/checking behavior for imports that are only used for types */
    // "downlevelIteration": true,                       /* Emit more compliant, but verbose and less performant JavaScript for iteration. */
    // "sourceRoot": "",                                 /* Specify the root path for debuggers to find the reference source code. */
    // "mapRoot": "",                                    /* Specify the location where debugger should locate map files instead of generated locations. */
    // "inlineSourceMap": true,                          /* Include sourcemap files inside the emitted JavaScript. */
    // "inlineSources": true,                            /* Include source code in the sourcemaps inside the emitted JavaScript. */
    // "emitBOM": true,                                  /* Emit a UTF-8 Byte Order Mark (BOM) in the beginning of output files. */
    // "newLine": "crlf",                                /* Set the newline character for emitting files. */
    // "stripInternal": true,                            /* Disable emitting declarations that have '@internal' in their JSDoc comments. */
    // "noEmitHelpers": true,                            /* Disable generating custom helper functions like '__extends' in compiled output. */
    // "noEmitOnError": true,                            /* Disable emitting files if any type checking errors are reported. */
    // "preserveConstEnums": true,                       /* Disable erasing 'const enum' declarations in generated code. */
    // "declarationDir": "./",                           /* Specify the output directory for generated declaration files. */
    // "preserveValueImports": true,                     /* Preserve unused imported values in the JavaScript output that would otherwise be removed. */

    /* Interop Constraints */
    // "isolatedModules": true,                          /* Ensure that each file can be safely transpiled without relying on other imports. */
    // "allowSyntheticDefaultImports": true,             /* Allow 'import x from y' when a module doesn't have a default export. */
    "esModuleInterop": true,                             /* Emit additional JavaScript to ease support for importing CommonJS modules. This enables 'allowSyntheticDefaultImports' for type compatibility. */
    // "preserveSymlinks": true,                         /* Disable resolving symlinks to their realpath. This correlates to the same flag in node. */
    "forceConsistentCasingInFileNames": true,            /* Ensure that casing is correct in imports. */

    /* Type Checking */
    "strict": true,                                      /* Enable all strict type-checking options. */
    // "noImplicitAny": true,                            /* Enable error reporting for expressions and declarations with an implied 'any' type.. */
    // "strictNullChecks": true,                         /* When type checking, take into account 'null' and 'undefined'. */
    // "strictFunctionTypes": true,                      /* When assigning functions, check to ensure parameters and the return values are subtype-compatible. */
    // "strictBindCallApply": true,                      /* Check that the arguments for 'bind', 'call', and 'apply' methods match the original function. */
    // "strictPropertyInitialization": true,             /* Check for class properties that are declared but not set in the constructor. */
    // "noImplicitThis": true,                           /* Enable error reporting when 'this' is given the type 'any'. */
    // "useUnknownInCatchVariables": true,               /* Type catch clause variables as 'unknown' instead of 'any'. */
    // "alwaysStrict": true,                             /* Ensure 'use strict' is always emitted. */
    // "noUnusedLocals": true,                           /* Enable error reporting when a local variables aren't read. */
    // "noUnusedParameters": true,                       /* Raise an error when a function parameter isn't read */
    // "exactOptionalPropertyTypes": true,               /* Interpret optional property types as written, rather than adding 'undefined'. */
    // "noImplicitReturns": true,                        /* Enable error reporting for codepaths that do not explicitly return in a function. */
    // "noFallthroughCasesInSwitch": true,               /* Enable error reporting for fallthrough cases in switch statements. */
    // "noUncheckedIndexedAccess": true,                 /* Include 'undefined' in index signature results */
    // "noImplicitOverride": true,                       /* Ensure overriding members in derived classes are marked with an override modifier. */
    // "noPropertyAccessFromIndexSignature": true,       /* Enforces using indexed accessors for keys declared using an indexed type */
    // "allowUnusedLabels": true,                        /* Disable error reporting for unused labels. */
    // "allowUnreachableCode": true,                     /* Disable error reporting for unreachable code. */

    /* Completeness */
    // "skipDefaultLibCheck": true,                      /* Skip type checking .d.ts files that are included with TypeScript. */
    "skipLibCheck": true                                 /* Skip type checking all .d.ts files. */
  }
}
`

const gen_eslintrc_json = () => `
{
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 2020,
    "sourceType": "module",
    "project": "./tsconfig.json"
  },
  "plugins": ["@typescript-eslint"],
  "extends": [
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking"
  ],
  "rules": {
    "@typescript-eslint/await-thenable": "error",
    "@typescript-eslint/no-unsafe-argument": "warn",
    "@typescript-eslint/no-unsafe-assignment": "warn"
  }
}
`

export async function createProject(value: string, options: Options) {
  const project_name = value;
  const project_path = './' + project_name;
  const contracts_path = project_path + '/contracts';
  const tests_path = project_path + '/tests';
  const contract_path = contracts_path + `/hello.arl`;
  const test_path = tests_path + `/hello.spec.ts`;
  const package_path = project_path + '/package.json'
  const tsconfig_path = project_path + '/tsconfig.json'
  const eslintrc_path = project_path + '/.eslintrc.json'
  const run_test_path = project_path + `/run_test.sh`;

  fs.mkdirSync(project_path)
  fs.mkdirSync(contracts_path)
  fs.mkdirSync(tests_path)

  fs.writeFileSync(contract_path, gen_contract_template())
  fs.writeFileSync(test_path, gen_test_template())
  fs.writeFileSync(package_path, gen_package_json(project_name, {
    archetype_ts_types: 'latest',
    completium_cli: 'latest',
    experiment_ts: 'latest',
    ts_mocha: '^10.0.0',
    types_expect: "^24.3.0",
    types_mocha: '^10.0.0',
    types_node: 'latest',
    typescript: '4.7.4',
    eslint_plugin: "^6.13.1",
    eslint_parser: "^6.13.1",
    eslint: "^8.54.0"
  }))
  fs.writeFileSync(tsconfig_path, gen_tsconfig())
  fs.writeFileSync(eslintrc_path, gen_eslintrc_json())
  fs.writeFileSync(run_test_path, gen_run_test())
  fs.chmodSync(run_test_path, "755")
  Printer.print(`Project ${project_name} is created.`)
}


async function getCompletiumProperty(value: string, options: Options) : Promise<any> {
  const package_json_path = './package.json';
  if (!fs.existsSync(package_json_path)) {
    const msg = `'./package.json' not found`;
    return new Promise((resolve, reject) => { reject(msg) });
  }

  const json = JSON.parse(fs.readFileSync(package_json_path, 'utf8'));
  if (!json.completium) {
    const msg = `completium section in './package.json' not found`;
    return new Promise((resolve, reject) => { reject(msg) });
  }

  if (!json.completium[value]) {
    const msg = `${value} in completium section in './package.json' not found`;
    return new Promise((resolve, reject) => { reject(msg) });
  }

  return json.completium[value];
}

export async function printCompletiumProperty(value: string, options: Options) {
  const property = await getCompletiumProperty(value, options);
  Printer.print(property)
}
