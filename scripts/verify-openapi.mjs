/**
 * Offline structural check for the agent API contract.
 *
 * The contract is JSON on purpose: it validates with plain Node and no new
 * dependency, so reviewers and CI never need a YAML parser or the network.
 *
 *   node scripts/verify-openapi.mjs [path-to-spec.json]
 *
 * Exits 0 with `OK …`, or 1 with exactly one `FAIL …` line.
 */

import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")

const EXPECTED_PATHS = {
  "/v1/agent/state": { verb: "get", statuses: ["200", "401", "403", "409", "429"] },
  "/v1/agent/orders": { verb: "post", statuses: ["200", "400", "401", "403", "409", "429"] },
  "/v1/agent/pay": { verb: "post", statuses: ["200", "400", "401", "403", "409", "429"] },
  "/v1/agent/swap": { verb: "post", statuses: ["200", "400", "401", "403", "409", "429"] },
  "/v1/agent/invoice": { verb: "post", statuses: ["200", "400", "401", "403", "409", "429"] },
}

const EXPECTED_SCHEMAS = [
  "Policy",
  "PolicyState",
  "Overview",
  "OrderRequest",
  "Fill",
  "OrderResult",
  "InvoiceRequest",
  "Invoice",
  "PayRequest",
  "PayIntent",
  "SwapRequest",
  "Error",
]

const HTTP_VERBS = ["get", "put", "post", "delete", "patch", "options", "head", "trace"]

function fail(reason) {
  console.log(`FAIL ${reason}`)
  process.exit(1)
}

const target = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : resolve(ROOT, "docs", "api", "agent.openapi.json")

if (!existsSync(target)) fail(`file not found: ${target}`)

let spec
try {
  spec = JSON.parse(readFileSync(target, "utf8"))
} catch (error) {
  fail(`not valid JSON: ${error.message}`)
}

if (typeof spec.openapi !== "string" || !spec.openapi.startsWith("3.1")) {
  fail(`openapi must be 3.1.x, got ${JSON.stringify(spec.openapi)}`)
}

const paths = spec.paths && typeof spec.paths === "object" ? spec.paths : {}
const agentPaths = Object.keys(paths).filter((key) => key.startsWith("/v1/agent/"))
const expectedKeys = Object.keys(EXPECTED_PATHS)

for (const key of expectedKeys) {
  if (!paths[key]) fail(`missing path ${key}`)
}
for (const key of agentPaths) {
  if (!expectedKeys.includes(key)) fail(`unexpected agent path ${key}`)
}

const schemas = (spec.components && spec.components.schemas) || {}
for (const name of EXPECTED_SCHEMAS) {
  if (!schemas[name]) fail(`missing schema ${name}`)
}

const resolvePointer = (pointer) => {
  if (typeof pointer !== "string" || !pointer.startsWith("#/")) return undefined
  return pointer
    .slice(2)
    .split("/")
    .map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"))
    .reduce((node, part) => (node && typeof node === "object" ? node[part] : undefined), spec)
}

let refCount = 0

function walk(node, trail) {
  if (!node || typeof node !== "object") return
  if (Array.isArray(node)) {
    node.forEach((item, index) => walk(item, `${trail}[${index}]`))
    return
  }
  if (typeof node.$ref === "string") {
    refCount++
    if (resolvePointer(node.$ref) === undefined) fail(`unresolved $ref ${node.$ref} at ${trail}`)
  }
  for (const [key, value] of Object.entries(node)) walk(value, `${trail}.${key}`)
}

walk(spec, "$")

for (const [key, expected] of Object.entries(EXPECTED_PATHS)) {
  const item = paths[key]
  const verbs = Object.keys(item).filter((name) => HTTP_VERBS.includes(name))
  if (verbs.length !== 1 || verbs[0] !== expected.verb) {
    fail(`${key} must define exactly ${expected.verb}, got ${verbs.join(", ") || "nothing"}`)
  }

  const responses = item[expected.verb].responses || {}
  const actual = Object.keys(responses).sort()
  const wanted = [...expected.statuses].sort()
  if (actual.join(",") !== wanted.join(",")) {
    fail(`${key} statuses must be ${wanted.join("/")}, got ${actual.join("/") || "none"}`)
  }
  if ("503" in responses) fail(`${key} must not document 503`)

  for (const status of actual) {
    if (status === "200") continue
    const response = responses[status].$ref ? resolvePointer(responses[status].$ref) : responses[status]
    if (!response) fail(`${key} ${status} points at a missing response`)
    const schemaRef = response.content && response.content["application/json"] && response.content["application/json"].schema
    if (!schemaRef || schemaRef.$ref !== "#/components/schemas/Error") {
      fail(`${key} ${status} must reference Error`)
    }
  }
}

const errorSchema = schemas.Error
if (!Array.isArray(errorSchema.required) || !errorSchema.required.includes("error")) {
  fail("Error.required must include error")
}
for (const field of ["message", "details"]) {
  if (!errorSchema.properties || !errorSchema.properties[field]) {
    fail(`Error must expose an optional ${field}`)
  }
}

console.log(`OK ${agentPaths.length} paths · ${Object.keys(schemas).length} schemas · ${refCount} refs`)
