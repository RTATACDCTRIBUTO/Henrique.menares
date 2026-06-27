const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "deploy", "public");
const sdkScripts = [
  '<script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js"></script>',
  '<script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js"></script>',
  '<script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore-compat.js"></script>',
  '<script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-storage-compat.js"></script>'
].join("\n  ");

fs.mkdirSync(root, { recursive: true });

for (const file of ["indexadm.html", "site-content.js", "site-admin.js"]) {
  fs.copyFileSync(path.resolve(__dirname, file), path.join(root, file));
}

for (const file of ["indexadm.html", "indexaularitmica.html", "indexinstruçãomotorista.html", "indexshow.html"]) {
  const fullPath = path.join(root, file);
  let html = fs.readFileSync(fullPath, "utf8");
  html = html.replace(/\s*<script src="https:\/\/www\.gstatic\.com\/firebasejs\/10\.12\.5\/firebase-app-compat\.js"><\/script>\s*<script src="https:\/\/www\.gstatic\.com\/firebasejs\/10\.12\.5\/firebase-auth-compat\.js"><\/script>\s*<script src="https:\/\/www\.gstatic\.com\/firebasejs\/10\.12\.5\/firebase-firestore-compat\.js"><\/script>\s*(<script src="https:\/\/www\.gstatic\.com\/firebasejs\/10\.12\.5\/firebase-storage-compat\.js"><\/script>)?/g, "");
  html = html.replace(/(\s*<script src="site-content\.js"><\/script>\s*<script src="site-admin\.js"><\/script>)/, "\n  " + sdkScripts + "\n  $1");
  fs.writeFileSync(fullPath, html, "utf8");
}

console.log("Deploy public preparado em " + root);
