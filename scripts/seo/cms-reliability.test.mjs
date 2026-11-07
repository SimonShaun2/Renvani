/** Runtime contract checks against repository modules, with the CMS/network and JSX renderer mocked.
 * Requires the repository's TypeScript dev dependency. TYPESCRIPT_PATH is optional for isolated local validation.
 * These checks do not replace the app's Vitest, Next.js build, or browser acceptance.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import vm from "node:vm";
const require = createRequire(import.meta.url);
const ts = require(process.env.TYPESCRIPT_PATH || "typescript");
const web = resolve(dirname(fileURLToPath(import.meta.url)), "../../apps/web");
const prod = { VERCEL_ENV: "production", VERCEL_TARGET_ENV: "production", PUBLIC_SITE_URL: "https://getrenvani.com" };
const configured = { NEXT_PUBLIC_SANITY_PROJECT_ID: "test-project", NEXT_PUBLIC_SANITY_DATASET: "production" };
const doc = { title: "Booking guide", slug: "booking-guide", metaDescription: "Useful guidance.", author: "Renvani", publishedAt: "2026-11-01T00:00:00Z", faq: [{question:"Question?",answer:"Answer."}] };
const plain = value => JSON.parse(JSON.stringify(value));
function loadSandbox(env = {}, implementation = async () => null) {
  const cache = new Map(), calls = [], clients = [], logs = [];
  function load(path) {
    if (cache.has(path)) return cache.get(path).exports;
    const src = readFileSync(path, "utf8");
    const output = ts.transpileModule(src, { fileName: path, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } });
    const errors = output.diagnostics?.filter(item => item.category === ts.DiagnosticCategory.Error) ?? [];
    assert.equal(errors.length, 0, `Syntax diagnostics in ${path}`);
    const module = { exports: {} }; cache.set(path, module);
    const localRequire = spec => {
      if (spec === "next-sanity") return { createClient: config => { clients.push(config); return { fetch: async (...args) => { calls.push(args); return implementation(...args); } }; } };
      if (spec === "next/link") return { __esModule:true, default:"a" };
      if (spec === "react/jsx-runtime") return { jsx: (type,props) => ({type,props}), jsxs: (type,props) => ({type,props}), Fragment:"fragment" };
      const prefix = spec.startsWith("@/") ? resolve(web, spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(path), spec) : null;
      if (!prefix) throw new Error(`Unexpected runtime import: ${spec}`);
      const found = [prefix, `${prefix}.ts`, `${prefix}.tsx`].find(p => existsSync(p));
      if (!found) throw new Error(`Missing runtime dependency: ${spec}`);
      return load(found);
    };
    const evaluate = vm.runInNewContext(`(function(require,module,exports,process,console){${output.outputText}\n})`, { URL }, { filename:path });
    evaluate(localRequire,module,module.exports,{env},{error:(...args)=>logs.push(args)});
    return module.exports;
  }
  return { load: path => load(resolve(web,path)), calls, clients, logs };
}
const nonproduction = [
 {}, {VERCEL_ENV:"preview"}, {VERCEL_ENV:"development"}, {VERCEL_ENV:"staging"},
 {VERCEL_ENV:"production",VERCEL_TARGET_ENV:"preview"}, {VERCEL_ENV:"production",VERCEL_TARGET_ENV:""},
 {VERCEL_ENV:"production",VERCEL_TARGET_ENV:"qa"}, {VERCEL_ENV:"Production"}
];
for (const type of ["post","comparisonPage"]) {
  for (const [i,env] of nonproduction.entries()) test(`${type} blocks indexing in nonproduction case ${i}`, () => {
    const {cmsMetadata}=loadSandbox().load("src/lib/seo/cms-seo.ts");
    const result=cmsMetadata(type,doc,{...env,PUBLIC_SITE_URL:"https://getrenvani.com"});
    assert.deepEqual(plain(result.robots),{index:false,follow:false});
  });
  test(`${type} production uses own canonical and index/follow`,()=>{
    const result=loadSandbox().load("src/lib/seo/cms-seo.ts").cmsMetadata(type,doc,prod);
    assert.deepEqual(plain(result.robots),{index:true,follow:true});
    assert.equal(result.alternates.canonical,`https://getrenvani.com/${type==="post"?"blog":"compare"}/booking-guide`);
    assert.equal(result.openGraph.type,"article");
  });
}
for (const origin of ["javascript:alert(1)","https://user:password@example.test","invalid"]) test(`invalid canonical configuration is non-indexable: ${origin}`,()=>{
 const result=loadSandbox().load("src/lib/seo/cms-seo.ts").cmsMetadata("post",doc,{...prod,PUBLIC_SITE_URL:origin});
 assert.equal(result.robots.index,false);
});
test("retains legacy relative canonical fallback",()=>assert.equal(loadSandbox().load("src/lib/seo/cms-seo.ts").cmsMetadata("post",doc,{}).alternates.canonical,"/blog/booking-guide"));
test("preserves article/FAQ schema without inventing ratings",()=>{
 const result=loadSandbox().load("src/lib/seo/cms-seo.ts").cmsJsonLd("post",doc,prod);
 assert.deepEqual(plain(result.map(x=>x["@type"])),["Article","FAQPage"]);
 assert.doesNotMatch(JSON.stringify(result),/aggregateRating|reviewCount/);
});
test("JSON-LD escaping survives script delimiters",()=>{
 const {serializeJsonLd}=loadSandbox().load("src/lib/seo/cms-seo.ts");
 const input={title:"</script><script>bad</script>"};const output=serializeJsonLd(input);
 assert.ok(!output.includes("<"));assert.deepEqual(JSON.parse(output),input);
});
for (const [i,env] of nonproduction.entries()) test(`blog index is explicitly noindex case ${i}`,()=>{
 const result=loadSandbox({...env,PUBLIC_SITE_URL:"https://getrenvani.com"}).load("app/(marketing)/blog/page.tsx").generateMetadata();
 assert.deepEqual(plain(result.robots),{index:false,follow:false});assert.equal(result.alternates,null);
});
test("blog index production canonical",()=>{
 const result=loadSandbox(prod).load("app/(marketing)/blog/page.tsx").generateMetadata();
 assert.equal(result.alternates.canonical,"https://getrenvani.com/blog");assert.equal(result.robots.index,true);
});
for (const method of ["fetchCmsList","fetchCmsDoc","fetchCmsSlugs"]) {
 test(`${method} does not request unconfigured CMS`,async()=>{
   const sandbox=loadSandbox();const result=await sandbox.load("src/sanity/fetch.ts")[method]("post","guide");
   assert.deepEqual(plain(result),method==="fetchCmsDoc"?null:[]);assert.equal(sandbox.calls.length,0);
 });
 test(`${method} rejects configured provider failure with sanitized error`,async()=>{
   const sandbox=loadSandbox(configured,async()=>{throw Error("PRIVATE provider token=do-not-log");});
   await assert.rejects(()=>sandbox.load("src/sanity/fetch.ts")[method]("post","guide"),error=>error.name==="CmsReadError"&&error.code==="CMS_READ_UNAVAILABLE"&&!error.message.includes("PRIVATE")&&error.cause===undefined);
   assert.equal(sandbox.logs.length,1);assert.doesNotMatch(JSON.stringify(sandbox.logs),/PRIVATE|do-not-log|guide/);
 });
 test(`${method} retains successful null fallback`,async()=>{
   const sandbox=loadSandbox(configured);const result=await sandbox.load("src/sanity/fetch.ts")[method]("post","guide");
   assert.deepEqual(plain(result),method==="fetchCmsDoc"?null:[]);
 });
}
test("configured fetch preserves published perspective and request tags",async()=>{
 const sandbox=loadSandbox(configured,async()=>doc);const result=await sandbox.load("src/sanity/fetch.ts").fetchCmsDoc("post","booking-guide");
 assert.equal(result,doc);assert.equal(sandbox.clients[0].perspective,"published");assert.equal(sandbox.clients[0].useCdn,true);
 assert.deepEqual(plain(sandbox.calls[0][2]),{next:{revalidate:60,tags:["post","post:booking-guide"]}});
 assert.match(sandbox.calls[0][0],/drafts/);
});
test("read token remains a provider-only client option",async()=>{
 const sandbox=loadSandbox({...configured,SANITY_API_READ_TOKEN:"private-test-token"},async()=>[]);
 await sandbox.load("src/sanity/fetch.ts").fetchCmsList("post");
 assert.equal(sandbox.clients[0].token,"private-test-token");assert.equal(sandbox.clients[0].useCdn,false);assert.equal(sandbox.logs.length,0);
});
test("blog outage rejects before returning an empty-state view",async()=>{
 const sandbox=loadSandbox(configured,async()=>{throw Error("offline");});
 await assert.rejects(()=>sandbox.load("app/(marketing)/blog/page.tsx").default(),error=>error.code==="CMS_READ_UNAVAILABLE");
});
test("generic reader preserves successful falsy values",async()=>{
 const {readCmsResult}=loadSandbox().load("src/sanity/read-result.ts");
 for(const value of [false,0,""]) assert.equal(await readCmsResult(async()=>value,"fallback"),value);
});
test("generic reader sanitizes synchronous failures",async()=>{
 const {readCmsResult}=loadSandbox().load("src/sanity/read-result.ts");
 await assert.rejects(()=>readCmsResult(()=>{throw "private detail";},null),error=>error.code==="CMS_READ_UNAVAILABLE"&&!error.message.includes("private"));
});
