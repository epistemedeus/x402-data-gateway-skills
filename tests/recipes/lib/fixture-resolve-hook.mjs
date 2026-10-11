// Resolve the recipe tests' viem import from the pinned merchant checkout.
// Node 22 ESM ignores NODE_PATH, so the specifier has to be parented at that
// fixture package. Other specifiers keep the default resolver.
import path from "node:path";
import { pathToFileURL } from "node:url";

let merchant = "";

export function initialize(data) {
  merchant = data?.merchant || process.env.S88_MERCHANT_SOURCE_DIR || "";
}

export async function resolve(specifier, context, nextResolve) {
  if (!merchant) merchant = process.env.S88_MERCHANT_SOURCE_DIR || "";
  if (merchant && (specifier === "viem" || specifier.startsWith("viem/"))) {
    return nextResolve(specifier, {
      ...context,
      parentURL: pathToFileURL(path.join(merchant, "package.json")).href,
    });
  }
  return nextResolve(specifier, context);
}
