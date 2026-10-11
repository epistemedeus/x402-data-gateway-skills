// Entry for `node --import ./tests/recipes/lib/fixture-deps.mjs`.
// Registers the viem resolver against S88_MERCHANT_SOURCE_DIR/node_modules.
import { register } from "node:module";

register("./fixture-resolve-hook.mjs", {
  parentURL: import.meta.url,
  data: { merchant: process.env.S88_MERCHANT_SOURCE_DIR || "" },
});
