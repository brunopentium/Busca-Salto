const readline = require("readline");
const { createPasswordHash } = require("../api/_lib/admin-auth");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("Senha do admin: ", (password) => {
  if (!password || password.length < 12) {
    console.error("Use uma senha com pelo menos 12 caracteres.");
    rl.close();
    process.exitCode = 1;
    return;
  }

  console.log(createPasswordHash(password));
  rl.close();
});
