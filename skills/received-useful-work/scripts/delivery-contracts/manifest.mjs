import { lstat, readFile, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { createHash } from "node:crypto";
import { DeliveryContractError, digestOf } from "./contracts.mjs";

export async function executableManifest(root, files, {maxBytes=4*1024*1024}={}) {
  if (!Array.isArray(files) || !files.length || files.length > 512 || new Set(files).size !== files.length ||
      !Number.isSafeInteger(maxBytes) || maxBytes < 0)
    throw new DeliveryContractError("manifest_invalid", "a bounded unique executable closure is required");
  const base = await realpath(root);
  let bytes = 0;
  const entries=[];
  for (const file of [...files].sort()) {
    if (typeof file !== "string" || !file || isAbsolute(file) || file.includes("\\") ||
        file.split("/").some(part=>!part || part==="." || part===".."))
      throw new DeliveryContractError("manifest_path", "closure paths must be normalized relative files");
    const target=resolve(base,file), info=await lstat(target), actual=await realpath(target);
    if (!info.isFile() || info.isSymbolicLink() || relative(base,actual).startsWith("..") || isAbsolute(relative(base,actual)))
      throw new DeliveryContractError("manifest_path", "closure file must remain within its acquired root");
    // Parent aliases are also refused, not silently resolved as an equivalent root.
    if (actual!==target || (await realpath(dirname(target)))!==dirname(target))
      throw new DeliveryContractError("manifest_path", "closure must not use symlink aliases");
    bytes+=info.size;
    if(bytes>maxBytes) throw new DeliveryContractError("manifest_limit","executable closure exceeds its budget");
    const body=await readFile(target);
    if(body.length!==info.size) throw new DeliveryContractError("manifest_changed","closure changed during acquisition");
    entries.push({path:file,bytes:body.length,sha256:createHash("sha256").update(body).digest("hex")});
  }
  const document={schema:"neomorphic.delivery-executable-manifest.v1",entries};
  return {...document,bytes,digest:digestOf(document)};
}
export async function verifyExecutableManifest(root, enrolled, options) {
  if(!enrolled || enrolled.schema!=="neomorphic.delivery-executable-manifest.v1" || !Array.isArray(enrolled.entries))
    throw new DeliveryContractError("manifest_missing","enrolled executable manifest is missing");
  const current=await executableManifest(root,enrolled.entries.map(e=>e.path),options);
  if(current.digest!==enrolled.digest) throw new DeliveryContractError("executable_changed","acquired executable does not match enrollment");
  return current;
}
// Caller must serialize state-changing operations and keep the acquired tree
// immutable while verifying/using it. This manifest is not a sandbox/TOCTOU lock.
