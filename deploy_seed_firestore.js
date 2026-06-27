const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { execSync } = require("child_process");

const projectId = "app-web-ea867";
const contentPath = path.resolve(__dirname, "deploy", "public", "site-content.js");
const source = fs.readFileSync(contentPath, "utf8");
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(source, sandbox);

const content = sandbox.window.HNE_SITE_CONTENT;
if (!content || !content.sites) {
  throw new Error("Conteúdo do site não encontrado.");
}

function toFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFirestoreValue) } };
  }
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === "object") {
    const fields = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      fields[key] = toFirestoreValue(nestedValue);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

async function main() {
  const token = execSync("gcloud auth print-access-token", { encoding: "utf8", shell: true }).trim();
  const body = { fields: toFirestoreValue(content).mapValue.fields };
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/hne_site/content`, {
    method: "PATCH",
    headers: {
      "authorization": `Bearer ${token}`,
      "content-type": "application/json",
      "x-goog-user-project": projectId
    },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Firestore seed falhou (${response.status}): ${text}`);
  }
  console.log("Documento hne_site/content atualizado no Firestore.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
