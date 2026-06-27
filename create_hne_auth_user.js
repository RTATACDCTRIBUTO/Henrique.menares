const crypto = require("crypto");

const apiKey = "AIzaSyATfe4eRm_lXI-TNoa9vuYffb9DCpJf5Ec";
const email = "contato.henriquemenares@gmail.com";

async function firebaseAuth(endpoint, body) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/${endpoint}?key=${apiKey}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { ok: response.ok, status: response.status, data };
}

async function main() {
  const temporaryPassword = crypto.randomBytes(24).toString("base64url") + "aA1!";
  const created = await firebaseAuth("accounts:signUp", {
    email,
    password: temporaryPassword,
    returnSecureToken: false
  });

  if (!created.ok && created.data?.error?.message !== "EMAIL_EXISTS") {
    throw new Error(`Não foi possível criar usuário: ${created.data?.error?.message || created.status}`);
  }

  const reset = await firebaseAuth("accounts:sendOobCode", {
    requestType: "PASSWORD_RESET",
    email
  });

  if (!reset.ok) {
    throw new Error(`Usuário ${created.ok ? "criado, mas " : ""}não foi possível enviar redefinição: ${reset.data?.error?.message || reset.status}`);
  }

  console.log(created.ok ? "Usuário criado e e-mail de senha enviado." : "Usuário já existia; e-mail de senha enviado.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
