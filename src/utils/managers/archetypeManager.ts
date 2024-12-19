import fs from 'fs';
import { Printer } from "../printer";
import { exec } from "../tools";
import { Options } from "../options";
import { ConfigManager } from "./configManager";
import { getRawScript } from '../tezos';
// import * as archetype from "@completium/archetype"

export type Settings = {
  compiler_json?: boolean,
  compiler_raw_json?: boolean,
  contract_interface_michelson?: boolean,
  contract_interface?: boolean,
  get_storage_values?: boolean,
  json?: boolean,
  metadata_storage?: string,
  metadata_uri?: string,
  sandbox_exec_address?: string,
  sci?: string,
  target?: string,
  test_mode?: boolean,
  version?: boolean,
  with_parameters?: boolean,
  entries?: boolean,
  decompile?: boolean,
  ijson?: boolean,
}

export type ArchetypeSettingsTS = {
  target?: string;
  with_init_caller?: boolean;
  json?: boolean;
  ijson?: boolean;
  rjson?: boolean;
  pt?: boolean;
  extpt?: boolean;
  ext?: boolean;
  ast?: boolean;
  mdl?: boolean;
  omdl?: boolean;
  typed?: boolean;
  ir?: boolean;
  dir?: boolean;
  mic?: boolean;
  mici?: boolean;
  all_parenthesis?: boolean;
  m?: boolean;
  raw?: boolean;
  raw_ir?: boolean;
  raw_michelson?: boolean;
  caller?: string;
  decomp?: boolean;
  trace?: boolean;
  metadata_uri?: string;
  metadata_storage?: string;
  with_metadata?: boolean;
  expr?: string;
  entrypoint?: string;
  type?: string;
  with_contract?: boolean;
  code_only?: boolean;
  expr_only?: boolean;
  init?: string;
  no_js_header?: boolean;
  sdir?: boolean;
  test_mode?: boolean;
  property_focused?: string;
  get_storage_values?: boolean;
  with_parameters?: boolean;
  contract_interface?: boolean;
  contract_interface_michelson?: boolean;
  sandbox_exec_address?: string;
  g?: boolean;
};

/**
 * Manages interactions with the Archetype binary.
 */
export class ArchetypeManager {

  private static archetype: any = null;

  private static computeSettings(options: Options, settings: Settings) {

    const metadata_storage = options.metadata_storage ? options.metadata_storage : (settings ? settings.metadata_storage : undefined);
    const metadata_uri = options.metadata_uri ? options.metadata_uri : (settings ? settings.metadata_uri : undefined);
    const otest = options.test || (settings !== undefined && settings.test_mode);
    const compiler_json = false;

    return {
      ...settings,
      test_mode: otest,
      metadata_storage: metadata_storage,
      metadata_uri: metadata_uri,
      json: compiler_json
    }
  }

  private static computeArgsSettings(options: Options, settings: Settings, path: string): string[] {
    const args = []
    if (settings.version) {
      args.push('--version')
    } else {
      if (settings.with_parameters) {
        args.push('--with-parameters')
      } else {
        if (settings.target) {
          args.push('--target');
          args.push(settings.target);
        }
        if (settings.contract_interface) {
          args.push('--show-contract-interface');
        }
        if (settings.contract_interface_michelson) {
          args.push('--show-contract-interface-michelson');
        }
        if (settings.sci) {
          args.push('--set-caller-init');
          args.push(settings.sci);
        }
        if (settings.get_storage_values) {
          args.push('--get-storage-values')
        }

        if (options.metadata_storage) {
          args.push('--metadata-storage');
          args.push(options.metadata_storage);
        } else if (settings.metadata_storage) {
          args.push('--metadata-storage');
          args.push(settings.metadata_storage);
        }

        if (options.metadata_uri) {
          args.push('--metadata-uri');
          args.push(options.metadata_uri);
        } else if (settings.metadata_uri) {
          args.push('--metadata-uri');
          args.push(settings.metadata_uri);
        }

        if (options.test || (settings !== undefined && settings.test_mode)) {
          args.push('--test-mode');
        }
        // if (options.no_js_header) {
        //   args.push('--no-js-header');
        // }
        if (settings.sandbox_exec_address) {
          args.push('--sandbox-exec-address');
          args.push(settings.sandbox_exec_address);
        }
        if (settings.entries) {
          args.push('--show-entries');
        }
        if (settings.compiler_raw_json) {
          args.push('--raw-json');
        }
        if (settings.compiler_json) {
          args.push('--json');
        }
        if (settings.decompile) {
          args.push('--decompile');
        }
        if (settings.ijson) {
          args.push('--input-json')
        }
      }
      args.push(path);
    }
    return args;
  }

  public static async callArchetype(options: Options, path: string, s: Settings): Promise<string> {
    const verbose = options.verbose;

    const archetypeMode = ConfigManager.getModeArchetype();

    switch (archetypeMode) {
      case 'binary':
        {
          const bin = ConfigManager.getBinArchetype();
          const args = this.computeArgsSettings(options, s, path);

          if (verbose) {
            Printer.print(args);
          }

          return new Promise(async (resolve, reject) => {
            try {
              const { stdout, stderr, failed } = await exec(bin, args);
              if (failed) {
                const msg = "Archetype compiler: " + stderr;
                reject(msg);
              } else {
                resolve(stdout);
              }
            } catch (e) {
              reject(e);
            }
          })
        };
      case 'js':
        {
          if (this.archetype == null) {
            this.archetype = require('@completium/archetype');
          }
          const archetype = this.archetype;
          if (s.version) {
            return archetype.version()
          } else if (s.entries) {
            return archetype.show_entries(path, {
              json: s.compiler_json ?? false,
              rjson: s.compiler_raw_json ?? false,
            });
          } else if (s.decompile) {
            return archetype.decompile(path, s);
          } else {
            try {
              const settings = this.computeSettings(options, s);

              if (verbose) {
                Printer.print(settings);
              }

              const a = await archetype.compile(path, settings);
              return a;
            } catch (err) {
              const error = err as Error;
              if (error.message) {
                const msg = "Archetype compiler: " + error.message;
                throw msg;
              } else {
                throw error;
              }
            }
          }
        }
      case 'docker':
        {
          const docker_bin = 'docker';
          const cwd = process.cwd();
          const args = ['run', '--platform=linux/amd64', '--rm', '-v', `${cwd}:${cwd}`, '-w', `${cwd}`, 'completium/archetype:latest'].concat(this.computeArgsSettings(options, s, path));

          if (verbose) {
            Printer.print(args);
          }

          return new Promise(async (resolve, reject) => {
            try {
              const { stdout, stderr, failed } = await exec(docker_bin, args);
              if (failed) {
                const msg = "Archetype compiler: " + stderr;
                reject(msg);
              } else {
                resolve(stdout);
              }
            } catch (e) {
              reject(e);
            }
          });
        }
      default:
        throw 'Archetype compiler: unknown mode';
    }
  }

  /**
   * Retrieves the version of the Archetype binary.
   * Throws an error if the version cannot be determined.
   * @returns The version of the Archetype binary as a string.
   */
  public static async getVersion(): Promise<string> {
    const v = await this.callArchetype({}, '', { version: true });
    return v;
  }

  public static async showEntries(i: string, rjson: boolean) {
    const archetypeMode = ConfigManager.getModeArchetype();
    let path = i;
    switch (archetypeMode) {
      case "binary":
      case "docker":
        const tmp = require('tmp');
        const tmpobj = tmp.fileSync({ postfix: '.json' });

        path = tmpobj.name;
        fs.writeFileSync(path, i);
        break;
      case "js":
        path = i;
        break;
    }
    const res = await this.callArchetype({}, path, { entries: true, compiler_json: true, compiler_raw_json: rjson });
    return res;
  }

  public static async decompile(value: string): Promise<string> {
    let path = value;
    let ijson = false;
    if (value.endsWith(".tz") || value.endsWith(".json")) {
      if (value.endsWith(".json")) {
        ijson = true;
      }
    } else if (value.startsWith("KT1")) {
      const content = await getRawScript(value)

      const tmp = require('tmp');
      const tmpobj = tmp.fileSync({ prefix: value, postfix: '.json' });

      path = tmpobj.name;
      fs.writeFileSync(path, content);
      ijson = true;
    } else {
      const msg = `Invalid value: ${value}.`;
      return new Promise((resolve, reject) => { reject(msg) });
    }
    const res = await this.callArchetype({}, path, { decompile: true, ijson });
    return res;
  }
}
