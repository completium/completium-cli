#!/usr/bin/env node

import { cli } from "./cli";

/**
 * Entry point of the CLI.
 * Delegates command processing to the `cli` function.
 */
cli(process.argv).catch((err) => {
  console.error(`[Critical Error]: ${err.message}`);
  process.exit(1);
});
