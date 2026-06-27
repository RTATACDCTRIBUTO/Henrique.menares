const fs = require("fs");
const path = require("path");

const filePath = path.resolve(__dirname, "deploy", "storage.rules");
const adminEmail = "contato.henriquemenares@gmail.com";
let rules = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");

if (!rules.includes("match /hne_site/{allPaths=**}")) {
  const helperMarker = "    // ─── Files de companies";
  const helperBlock = `    function isHneAdmin() {
      return isAuthed()
          && request.auth.token.email != null
          && request.auth.token.email.lower() == '${adminEmail}';
    }

`;
  if (!rules.includes(helperMarker)) {
    throw new Error("Marcador de helper não encontrado nas regras do Storage.");
  }
  rules = rules.replace(helperMarker, helperBlock + helperMarker);

  const closeMarker = "  }\n}";
  const hneBlock = `
    // ─── Site Henrique Menares: fotos publicadas pelo painel admin ─────────
    match /hne_site/{allPaths=**} {
      allow read: if true;
      allow write: if isHneAdmin()
                   && request.resource.size < 10 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
      allow delete: if isHneAdmin();
    }
`;
  if (!rules.includes(closeMarker)) {
    throw new Error("Fechamento da regra não encontrado.");
  }
  rules = rules.replace(closeMarker, hneBlock + closeMarker);
}

fs.writeFileSync(filePath, rules, "utf8");
console.log("Regra hne_site pronta no Storage.");
