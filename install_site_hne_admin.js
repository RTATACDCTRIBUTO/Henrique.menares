const fs = require("fs");
const path = require("path");

const sourceDir = __dirname;
const targetDir = "C:\\Users\\User\\Documents\\site hne";
const htmlFiles = [
  "indexadm.html",
  "indexaularitmica.html",
  "indexinstruçãomotorista.html",
  "indexshow.html"
];

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function write(filePath, content) {
  fs.writeFileSync(filePath, content, "utf8");
}

function ensureBackup() {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
  const backupDir = path.join(targetDir, `backup-admin-${stamp}`);
  fs.mkdirSync(backupDir, { recursive: true });
  htmlFiles.forEach((file) => {
    const source = path.join(targetDir, file);
    if (fs.existsSync(source)) {
      fs.copyFileSync(source, path.join(backupDir, file));
    }
  });
  return backupDir;
}

function installSharedFiles() {
  ["indexadm.html", "site-content.js", "site-admin.js"].forEach((file) => {
    write(path.join(targetDir, file), read(path.join(sourceDir, file)));
  });
}

function injectPublicScripts(file) {
  const fullPath = path.join(targetDir, file);
  let html = read(fullPath);
  html = html.replace(/\s*<script src="site-content\.js"><\/script>\s*<script src="site-admin\.js"><\/script>/g, "");
  const snippet = '\n  <script src="site-content.js"></script>\n  <script src="site-admin.js"></script>\n';
  if (!/<\/body>/i.test(html)) {
    throw new Error(`Nao encontrei </body> em ${file}`);
  }
  html = html.replace(/<\/body>/i, `${snippet}</body>`);
  write(fullPath, html);
}

function main() {
  if (!fs.existsSync(targetDir)) {
    throw new Error(`Pasta nao encontrada: ${targetDir}`);
  }
  const backupDir = ensureBackup();
  installSharedFiles();
  ["indexaularitmica.html", "indexinstruçãomotorista.html", "indexshow.html"].forEach(injectPublicScripts);
  console.log(`Backup criado em: ${backupDir}`);
  console.log("Painel admin instalado com sucesso.");
}

main();
