import { Printer } from "../printer";
import { exec } from "../tools";
import { Options } from "../options";
import { ConfigManager } from "./configManager";
// import * as archetype from "@completium/archetype"

export type Settings = {
  compiler_json?: boolean,
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
}

/**
 * Manages interactions with the Archetype binary.
 */
export class ArchetypeManager {

  private static archetype : any = null;

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
        // if (settings.compiler_json) {
        //   args.push('--json');
        // }
        if (settings.sandbox_exec_address) {
          args.push('--sandbox-exec-address');
          args.push(settings.sandbox_exec_address);
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

}
