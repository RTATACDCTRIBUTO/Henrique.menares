const fs = require("fs");
const path = require("path");

const filePath = path.resolve(__dirname, "deploy", "firestore.rules");
const adminEmail = "contato.henriquemenares@gmail.com";
let rules = fs.readFileSync(filePath, "utf8");

if (!rules.includes("match /hne_site/content")) {
  const marker = "    // ─── collectionGroup query: pesquisar invite";
  const block = `    // ─── Site Henrique Menares: páginas públicas + painel admin ─────────────
    match /hne_site/content {
      allow read: if true;
      allow write: if isAuthed()
                   && request.auth.token.email != null
                   && request.auth.token.email.lower() == '${adminEmail}';
    }

`;

  if (!rules.includes(marker)) {
    throw new Error("Marcador de inserção não encontrado nas regras atuais.");
  }

  rules = rules.replace(marker, block + marker);
  fs.writeFileSync(filePath, rules, "utf8");
}

console.log("Regra hne_site/content pronta.");
