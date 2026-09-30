const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const html = fs.readFileSync(path.join(__dirname, "..", "comerciantes.html"), "utf8");
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0]?.[1];
assert.ok(script, "Merchant checkout script not found");

function checkout(plan, userAgent, mobile = false) {
  const status = { textContent: "" };
  const location = { href: "", pathname: "/comerciantes.html" };
  const context = vm.createContext({
    document: { getElementById: () => status, querySelectorAll: () => [] },
    navigator: { userAgent, userAgentData: { mobile } },
    location,
    Blob,
  });
  new vm.Script(script).runInContext(context);
  vm.runInContext(`startCheckout(${JSON.stringify(plan)})`, context);
  return { url: location.href, status: status.textContent };
}

assert.equal(checkout("parceiro", "Windows").url, "https://mpago.la/2u3qwGJ");
assert.equal(checkout("destaque", "Windows").url, "https://mpago.la/2adTAjs");
const desktopFree = checkout("gratuito", "Windows");
assert.ok(desktopFree.url.startsWith("https://web.whatsapp.com/send?phone=5511953116573&text="));
assert.ok(decodeURIComponent(desktopFree.url).includes("cadastro gratuito"));
const mobileFree = checkout("gratuito", "Mozilla/5.0 (Linux; Android 15)");
assert.ok(mobileFree.url.startsWith("whatsapp://send?phone=5511953116573&text="));
console.log("Merchant plan destinations passed for paid plans, desktop and mobile free plan.");
