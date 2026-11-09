/*
 * Verification of Domain Visit Filtering:
 * 1. Search Engine Result Pages (SERP)
 * 2. Chrome Automatic Account Login, Identity Providers & Account Registration Pages
 *
 * Run: npm run verify:domain-visit-filters   (from Client-Extension/)
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");

let checks = 0;
const failures = [];

function check(label, ok, detail) {
  checks++;
  if (!ok) failures.push(detail ? label + " — " + detail : label);
}

// Build VM context with config.js loaded
const sandbox = {
  console,
  URL,
  Date,
  setTimeout,
  clearTimeout,
};
sandbox.globalThis = sandbox;
sandbox.window = sandbox;

vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, "config.js"), "utf8"), sandbox, { filename: "config.js" });

const { isSearchResultUrl, isAuthOrAccountUrl, shouldIgnoreDomainVisit } = sandbox;
if (typeof isSearchResultUrl !== "function" || typeof isAuthOrAccountUrl !== "function" || typeof shouldIgnoreDomainVisit !== "function") {
  throw new Error("config.js did not expose required filter functions");
}

function main() {
  // ── 1. Chrome Automatic Account Login & Google Accounts ─────────────────
  {
    check("Chrome sync URL is ignored", isAuthOrAccountUrl("https://accounts.google.com/signin/chrome/sync"));
    check("Chrome sync with params is ignored", isAuthOrAccountUrl("https://accounts.google.com/signin/chrome/sync?ssp=1&continue=..."));
    check("Chrome automatic signin is ignored", isAuthOrAccountUrl("https://accounts.google.com/signin/chrome"));
    check("Google ServiceLogin is ignored", isAuthOrAccountUrl("https://accounts.google.com/ServiceLogin?service=mail"));
    check("Google AccountChooser is ignored", isAuthOrAccountUrl("https://accounts.google.com/AccountChooser?continue=..."));
    check("Google AddSession is ignored", isAuthOrAccountUrl("https://accounts.google.com/AddSession?service=lso"));
    check("Google OAuth authorization is ignored", isAuthOrAccountUrl("https://accounts.google.com/o/oauth2/v2/auth?client_id=123"));
    check("chrome://chrome-signin is ignored", isAuthOrAccountUrl("chrome://chrome-signin"));
    check("chrome://signin-internals is ignored", isAuthOrAccountUrl("chrome://signin-internals"));
  }

  // ── 2. Dedicated Third-Party Identity Providers & Enterprise SSO ───────
  {
    check("Microsoft Online OAuth is ignored", isAuthOrAccountUrl("https://login.microsoftonline.com/common/oauth2/v2.0/authorize"));
    check("Microsoft Live login is ignored", isAuthOrAccountUrl("https://login.live.com/oauth20_authorize.srf"));
    check("Microsoft account portal is ignored", isAuthOrAccountUrl("https://account.microsoft.com/"));
    check("Apple ID authorization is ignored", isAuthOrAccountUrl("https://appleid.apple.com/auth/authorize"));
    check("Okta organization login is ignored", isAuthOrAccountUrl("https://mycompany.okta.com/login/default"));
    check("Auth0 tenant authorization is ignored", isAuthOrAccountUrl("https://identity.auth0.com/authorize"));
    check("OneLogin portal is ignored", isAuthOrAccountUrl("https://company.onelogin.com/login"));
    check("PingIdentity SSO is ignored", isAuthOrAccountUrl("https://auth.pingidentity.com/as/authorization.oauth2"));
  }

  // ── 3. First-Party Account Registration & Login Flows ──────────────────
  {
    check("GitHub login is ignored", isAuthOrAccountUrl("https://github.com/login"));
    check("GitHub join/register is ignored", isAuthOrAccountUrl("https://github.com/join"));
    check("GitHub signup is ignored", isAuthOrAccountUrl("https://github.com/signup"));
    check("Slack signin is ignored", isAuthOrAccountUrl("https://slack.com/signin"));
    check("Slack sign-in hyphenated is ignored", isAuthOrAccountUrl("https://slack.com/sign-in"));
    check("Notion signup is ignored", isAuthOrAccountUrl("https://notion.so/signup"));
    check("Generic /register path is ignored", isAuthOrAccountUrl("https://example.com/register"));
    check("Generic /create-account path is ignored", isAuthOrAccountUrl("https://example.com/create-account"));
    check("Universal /oauth/authorize path is ignored", isAuthOrAccountUrl("https://api.example.com/oauth/authorize?client_id=abc"));
    check("Universal /saml/sso path is ignored", isAuthOrAccountUrl("https://idp.example.com/saml/sso"));
    check("OAuth callback path is ignored", isAuthOrAccountUrl("https://example.com/auth/callback?code=xyz"));
  }

  // ── 4. Guardrails: Legitimate Applications Must NOT Be Ignored ─────────
  {
    check("Google Docs document is not an auth page", !isAuthOrAccountUrl("https://docs.google.com/document/d/123456"));
    check("Google Drive home is not an auth page", !isAuthOrAccountUrl("https://drive.google.com/drive/my-drive"));
    check("Gmail inbox is not an auth page", !isAuthOrAccountUrl("https://mail.google.com/mail/u/0/#inbox"));
    check("GitHub repository is not an auth page", !isAuthOrAccountUrl("https://github.com/facebook/react"));
    check("Slack web app is not an auth page", !isAuthOrAccountUrl("https://app.slack.com/client/T123/C456"));
    check("Notion workspace is not an auth page", !isAuthOrAccountUrl("https://notion.so/Engineering-Wiki-123"));
    check("Normal website dashboard is not an auth page", !isAuthOrAccountUrl("https://example.com/dashboard"));
    check("Normal website pricing is not an auth page", !isAuthOrAccountUrl("https://example.com/pricing"));
  }

  // ── 5. Search Engine Result Pages (SERP) ───────────────────────────────
  {
    check("Google search query is ignored", isSearchResultUrl("https://www.google.com/search?q=cybersecurity"));
    check("Google search homepage is ignored", isSearchResultUrl("https://www.google.com/"));
    check("Google UK search is ignored", isSearchResultUrl("https://www.google.co.uk/search?q=able"));
    check("Google Philippines search is ignored", isSearchResultUrl("https://www.google.com.ph/search?q=test"));
    check("Google search redirect URL is ignored", isSearchResultUrl("https://www.google.com/url?sa=t&url=https%3A%2F%2Fexample.com"));
    check("Yahoo search is ignored", isSearchResultUrl("https://search.yahoo.com/search?p=infosec"));
    check("Bing search is ignored", isSearchResultUrl("https://www.bing.com/search?q=privacy"));
    check("Bing China is ignored", isSearchResultUrl("https://cn.bing.com/search?q=test"));
    check("DuckDuckGo search is ignored", isSearchResultUrl("https://duckduckgo.com/?q=shadow+it"));
    check("Baidu search is ignored", isSearchResultUrl("https://www.baidu.com/s?wd=able"));
    check("Yandex search is ignored", isSearchResultUrl("https://yandex.com/search/?text=security"));
    check("Brave search is ignored", isSearchResultUrl("https://search.brave.com/search?q=browser+extension"));
    check("Ecosia search is ignored", isSearchResultUrl("https://www.ecosia.org/search?q=green"));
    check("Kagi search is ignored", isSearchResultUrl("https://kagi.com/search?q=fast"));
    check("Naver search is ignored", isSearchResultUrl("https://search.naver.com/search.naver?query=korea"));
    check("Sogou search is ignored", isSearchResultUrl("https://search.sogou.com/web?query=china"));
    check("Seznam search is ignored", isSearchResultUrl("https://search.seznam.cz/?q=czech"));

    // Negative SERP cases
    check("Google Cloud console is not search", !isSearchResultUrl("https://console.cloud.google.com/home"));
    check("Yahoo Finance is not search", !isSearchResultUrl("https://finance.yahoo.com/quote/AAPL"));
    check("Non-search portal is not search", !isSearchResultUrl("https://wikipedia.org/wiki/Search_engine"));
  }

  // ── 6. Master shouldIgnoreDomainVisit() Dispatch ────────────────────────
  {
    check("localhost is ignored", shouldIgnoreDomainVisit("http://localhost:8000/api"));
    check("127.0.0.1 is ignored", shouldIgnoreDomainVisit("http://127.0.0.1:3000/"));
    check("Google Chrome sync is ignored via master check", shouldIgnoreDomainVisit("https://accounts.google.com/signin/chrome/sync"));
    check("Microsoft login is ignored via master check", shouldIgnoreDomainVisit("https://login.microsoftonline.com/oauth"));
    check("Google search is ignored via master check", shouldIgnoreDomainVisit("https://www.google.com/search?q=test"));
    check("Legitimate business SaaS is NOT ignored", !shouldIgnoreDomainVisit("https://app.asana.com/0/12345/list"));
    check("Legitimate cloud console is NOT ignored", !shouldIgnoreDomainVisit("https://us-east-1.console.aws.amazon.com/"));
  }

  // ── Report ──────────────────────────────────────────────────────────────
  console.log("\nABLE domain visit filtering verification");
  console.log("=".repeat(60));
  console.log("Checks run: " + checks);
  if (failures.length === 0) {
    console.log("RESULT: PASS — all " + checks + " checks passed");
  } else {
    console.log("RESULT: FAIL — " + failures.length + " failure(s)");
    failures.forEach((f) => console.log("  x " + f));
  }
  process.exit(failures.length === 0 ? 0 : 1);
}

main();
