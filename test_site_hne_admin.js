const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const targetDir = "C:\\Users\\User\\Documents\\site hne";
const store = new Map();
const sandbox = {
  window: {},
  document: {
    readyState: "loading",
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getElementById() { return null; }
  },
  localStorage: {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(key, String(value)); },
    removeItem(key) { store.delete(key); }
  },
  Blob: function Blob() {},
  URL,
  confirm() { return true; },
  setTimeout,
  console
};
sandbox.window = sandbox;
sandbox.window.addEventListener = function () {};
sandbox.addEventListener = function () {};

vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(targetDir, "site-content.js"), "utf8"), sandbox);
vm.runInContext(fs.readFileSync(path.join(targetDir, "site-admin.js"), "utf8"), sandbox);

assert.ok(sandbox.HNESiteAdmin, "HNESiteAdmin exportado");

const content = sandbox.HNESiteAdmin.getContent();
assert.deepStrictEqual(Object.keys(content.sites), ["aularitmica", "motorista", "show"]);
assert.strictEqual(content.sites.aularitmica.fields.subtitle, "Instrutor e Professor de Violão e Rítmica");
assert.strictEqual(content.sites.show.fields.mainText.includes("Música ao vivo"), true);

assert.strictEqual(
  sandbox.HNESiteAdmin.normalizeYoutubeUrl("https://www.youtube.com/watch?v=uGNnLW2x2PQ"),
  "https://www.youtube.com/embed/uGNnLW2x2PQ"
);
assert.strictEqual(
  sandbox.HNESiteAdmin.normalizeYoutubeUrl("https://youtu.be/abc123DEF45"),
  "https://www.youtube.com/embed/abc123DEF45"
);
assert.strictEqual(
  sandbox.HNESiteAdmin.normalizeYoutubeUrl("https://www.youtube.com/shorts/xyz987QWE65"),
  "https://www.youtube.com/embed/xyz987QWE65"
);

sandbox.HNESiteAdmin.saveContent({
  sites: {
    show: {
      fields: {
        heroTitle: "Teste Admin"
      }
    }
  }
});
assert.strictEqual(sandbox.HNESiteAdmin.getContent().sites.show.fields.heroTitle, "Teste Admin");
assert.strictEqual(sandbox.HNESiteAdmin.getContent().sites.motorista.fields.heroTitle, "Henrique Menares");

[
  "indexadm.html",
  "indexaularitmica.html",
  "indexinstruçãomotorista.html",
  "indexshow.html"
].forEach((file) => {
  const html = fs.readFileSync(path.join(targetDir, file), "utf8");
  assert.strictEqual((html.match(/site-content\.js/g) || []).length, 1, `${file} site-content.js`);
  assert.strictEqual((html.match(/site-admin\.js/g) || []).length, 1, `${file} site-admin.js`);
});

console.log("Validacao concluida com sucesso.");
