/** Portable contract tests against actual source. CMS, React runtime and unrelated page inventories are mocked.
 * Run with the repository TypeScript dependency; TYPESCRIPT_PATH / PLAYBOOK_TEST_DEPENDENCIES support isolated checks.
 * Not a substitute for repository Vitest, app typecheck, browser acceptance, independent QA or batch CI.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require(process.env.TYPESCRIPT_PATH || 'typescript');
const web = resolve(dirname(fileURLToPath(import.meta.url)), '../../apps/web');
const plain = value => JSON.parse(JSON.stringify(value));
const prod = { VERCEL_ENV:'production', VERCEL_TARGET_ENV:'production', PUBLIC_SITE_URL:'https://getrenvani.com' };
export function sandbox(env = {}, posts = []) {
  const cache = new Map(), calls = [], states = [];
  let cursor = 0;
  const element = (type,props) => ({type,props});
  function load(relative) {
    const full = resolve(web, relative);
    if(cache.has(full)) return cache.get(full).exports;
    const fallback = process.env.PLAYBOOK_TEST_DEPENDENCIES && resolve(process.env.PLAYBOOK_TEST_DEPENDENCIES, relative);
    const file = existsSync(full) ? full : fallback;
    if(!file || !existsSync(file)) throw Error(`Missing source ${relative}`);
    const src = readFileSync(file,'utf8');
    const result = ts.transpileModule(src, { fileName:full, reportDiagnostics:true, compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true} });
    assert.equal(result.diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error).length ?? 0,0,relative);
    const module = {exports:{}};cache.set(full,module);
    function localRequire(spec) {
      if(spec==='react/jsx-runtime') return {jsx:element,jsxs:element,Fragment:'fragment'};
      if(spec==='react') return {useId:()=> 'playbook-test',useState:initial=> {const index=cursor++;if(!(index in states))states[index]=initial;return [states[index],value=>{states[index]=value;}];}};
      if(spec==='next/link') return {__esModule:true,default:'a'};
      if(spec==='next/navigation') return {notFound:()=>{throw Error('NEXT_NOT_FOUND');}};
      if(spec==='lucide-react') return new Proxy({}, {get:(_,name)=>props=>element('svg',{'data-icon':String(name),...props})});
      if(spec.endsWith('.module.css')) return {__esModule:true,default:new Proxy({}, {get:(_,name)=>String(name)})};
      if(spec==='@/src/sanity/fetch') return {fetchCmsList:async type=>{calls.push(type);if(posts instanceof Error)throw posts;if(typeof posts==='function')return posts(load('src/sanity/read-result.ts').CmsReadError);return posts;},fetchCmsSlugs:async()=>[]};
      if(spec==='@/src/sanity/env') return {CMS_TYPES:{post:'/blog',comparisonPage:'/compare'}};
      if(spec.endsWith('/industry-registry')) return {INDUSTRY_PAGES:[{href:'/industries/hvac'}]};
      if(spec.endsWith('/service-area-pages')) return {listServiceAreaPages:()=>[],serviceAreaPath:()=>''};
      if(spec.endsWith('/public-booking-server')) return {fetchPublicBookingSettingsBySlug:async()=>{throw Error('Unexpected private/shop request');}};
      if(spec==='./flagship-registry') return {productLinkFor:()=>null};
      if(['./MaybeLink','./IndustriesMenuPanel','./MenuFooter','./fonts','./IndustryMenu','./HeaderDisclosure','../site/HeaderDisclosure','../site/MenuFooter'].includes(spec)) return new Proxy({}, {get:()=>props=>element('div',props)});
      const path = spec.startsWith('@/') ? spec.slice(2) : spec.startsWith('.') ? resolve(dirname(full),spec).slice(web.length+1) : null;
      if(!path) throw Error(`Unexpected dependency ${spec}`);
      for(const suffix of ['', '.ts','.tsx']) {
        if(existsSync(resolve(web,path+suffix)) || (process.env.PLAYBOOK_TEST_DEPENDENCIES && existsSync(resolve(process.env.PLAYBOOK_TEST_DEPENDENCIES,path+suffix)))) return load(path+suffix);
      }
      throw Error(`Missing module ${path}`);
    }
    const fn = vm.runInNewContext(`(function(require,module,exports,process){${result.outputText}\n})`,{URL,Response,Request,Headers,Error,console});
    fn(localRequire,module,module.exports,{env});return module.exports;
  }
  function render(node) {
    if(Array.isArray(node))return node.flatMap(render);
    if(node==null || typeof node==='boolean')return [];
    if(typeof node!=='object')return [node];
    if(typeof node.type==='function')return render(node.type(node.props));
    return [{...node,props:{...node.props,children:render(node.props?.children)}}];
  }
  return {load,render,calls,states,resetCursor:()=>{cursor=0;}};
}
const nodes = tree => tree.flatMap(node=>typeof node==='object'&&node ? [node,...nodes(node.props.children||[])] : []);
const text = tree => tree.map(node=>typeof node==='object'&&node ? text(node.props.children||[]):String(node)).join(' ');
const lib='src/lib/resources/playbook.ts';
const s=sandbox(), catalog=s.load(lib), routes=s.load('src/lib/route-access.ts');
test('catalog has three real templates and unique public page paths',()=>{assert.equal(catalog.PLAYBOOK_TEMPLATES.length,3);assert.equal(new Set(catalog.PLAYBOOK_PATHS).size,4);});
for(const template of catalog.PLAYBOOK_TEMPLATES) {
  test(`complete template: ${template.slug}`,()=>{assert.equal(catalog.findTemplate(template.slug),template);assert.ok(template.sections.length>=3);assert.ok(catalog.templateText(template).length>1000);assert.ok(catalog.templateText(template).includes(template.title));});
  for(const path of [catalog.templatePath(template.slug),catalog.templatePath(template.slug)+'/download'])test(`public path: ${path}`,()=>assert.equal(routes.isPublicRoute(path),true));
  test(`download is genuine whitelisted text: ${template.slug}`,async()=>{const {GET}=s.load('app/(marketing)/resources/templates/[slug]/download/route.ts');const res=await GET(new Request('https://example.test'),{params:Promise.resolve({slug:template.slug})});assert.equal(res.status,200);assert.equal(res.headers.get('x-robots-tag'),'noindex');assert.ok(res.headers.get('content-disposition').includes(template.slug+'.txt'));assert.equal(await res.text(),catalog.templateText(template));});
}
for(const path of ['/dashboard','/studio','/api/private','/resources-admin','/resources/private','/resources/templates/a/private','/resources/templates/../settings','/resources/templates/%2e%2e','/resources/templates/a/download/private','/resources/templates/a?token=x'])test(`private or malformed remains gated: ${path}`,()=>assert.equal(routes.isPublicRoute(path),false));
test('resource root public; unknown template reaches real 404',async()=>{assert.equal(routes.isPublicRoute('/resources'),true);assert.equal(routes.isPublicRoute('/resources/templates/does-not-exist'),true);const {GET}=s.load('app/(marketing)/resources/templates/[slug]/download/route.ts');assert.equal((await GET(new Request('https://example.test'),{params:Promise.resolve({slug:'../../secret'})})).status,404);});
test('published cards preserve blog URLs and reject bad routes/duplicates',()=>{const cards=catalog.articleCards([{title:'Guide',slug:'estimate-follow-up'},{title:'Duplicate',slug:'estimate-follow-up'},{title:'Bad',slug:'../admin'},{title:'Blank',slug:''}]);assert.deepEqual(plain(cards.map(x=>x.href)),['/blog/estimate-follow-up']);});
test('search is case-insensitive, word-based and format-aware',()=>{const cards=[...catalog.templateCards(),...catalog.articleCards([{title:'HVAC booking guide',slug:'hvac-booking'}])];assert.equal(catalog.filterResources(cards,' DISPATCH ', 'template').length,1);assert.equal(catalog.filterResources(cards,'booking HVAC','article').length,1);assert.equal(catalog.filterResources(cards,'nothing-matches').length,0);assert.equal(catalog.filterResources(cards,'','all').length,4);});
for(const env of [prod,{}, {...prod,VERCEL_ENV:'preview'}, {...prod,VERCEL_TARGET_ENV:'qa'}])test(`metadata and sitemap identity ${JSON.stringify(env)}`,async()=>{const run=sandbox(env);const page=run.load('app/(marketing)/resources/page.tsx');const indexable=env===prod;assert.equal(page.metadata.robots.index,indexable);assert.equal(page.metadata.alternates?.canonical,indexable?'https://getrenvani.com/resources':undefined);const map=run.load('src/lib/seo/public-sitemap.ts').buildMarketingSitemap(env);for(const path of catalog.PLAYBOOK_PATHS)assert.equal(map.some(x=>x.url==='https://getrenvani.com'+path),indexable);assert.equal(map.some(x=>x.url.endsWith('/download')),false);const t=run.load('app/(marketing)/resources/templates/[slug]/page.tsx');const meta=await t.generateMetadata({params:Promise.resolve({slug:catalog.PLAYBOOK_TEMPLATES[0].slug})});assert.equal(meta.robots.index,indexable);});
test('server-rendered hub contains all templates and no placeholder articles',async()=>{const run=sandbox(prod);const tree=run.render(await run.load('app/(marketing)/resources/page.tsx').default());const hrefs=nodes(tree).filter(n=>n.type==='a').map(n=>n.props.href);for(const template of catalog.PLAYBOOK_TEMPLATES)assert.ok(hrefs.includes(catalog.templatePath(template.slug)));assert.deepEqual(run.calls,['post']);assert.ok(!text(tree).includes('No posts yet'));assert.equal(nodes(tree).filter(n=>n.type==='h1').length,1);});
test('published CMS article enters rendered hub with original href',async()=>{const run=sandbox(prod,[{title:'Our real guide',slug:'original-guide'}]);const tree=run.render(await run.load('app/(marketing)/resources/page.tsx').default());assert.ok(nodes(tree).some(n=>n.type==='a'&&n.props.href==='/blog/original-guide'));});
test('known CMS outage is disclosed while templates remain useful',async()=>{const run=sandbox(prod,ErrorClass=>{throw new ErrorClass();});const tree=run.render(await run.load('app/(marketing)/resources/page.tsx').default());assert.ok(text(tree).includes('Articles are temporarily unavailable'));assert.equal(nodes(tree).filter(n=>n.type==='h3').length,3);});
test('unexpected programming failures are not silently swallowed',async()=>{const run=sandbox(prod,new Error('Unexpected programming failure'));await assert.rejects(run.load('app/(marketing)/resources/page.tsx').default(),/Unexpected programming failure/);});
test('search and clear controls change the rendered results',()=>{const run=sandbox(prod);const {ResourceLibrary}=run.load('src/components/marketing/resources/ResourceLibrary.tsx');const resources=run.load(lib).templateCards();const draw=()=>{run.resetCursor();return run.render(ResourceLibrary({resources}));};let tree=draw();assert.equal(nodes(tree).filter(n=>n.type==='h3').length,3);nodes(tree).find(n=>n.type==='input').props.onChange({target:{value:'dispatch'}});tree=draw();assert.equal(nodes(tree).filter(n=>n.type==='h3').length,1);assert.ok(text(tree).includes('Daily dispatch checklist'));nodes(tree).find(n=>n.type==='input').props.onChange({target:{value:'zzzz-not-found'}});tree=draw();assert.ok(text(tree).includes('No matching resources.'));nodes(tree).find(n=>n.type==='button'&&text(n.props.children)==='Clear filters').props.onClick();tree=draw();assert.equal(nodes(tree).filter(n=>n.type==='h3').length,3);});
test('template unknown slug invokes notFound',async()=>{await assert.rejects(s.load('app/(marketing)/resources/templates/[slug]/page.tsx').default({params:Promise.resolve({slug:'no-such-template'})}),/NEXT_NOT_FOUND/);});
test('desktop/footer/mobile navigation expose Resources; existing blog paths remain',()=>{const config=s.load('src/components/marketing/site/site-config.ts');for(const links of [config.SITE_NAV.links,config.SITE_FOOTER.links])assert.equal(links.filter(l=>l.href==='/resources').length,1);const mobile=readFileSync(resolve(web,'src/components/marketing/site/ProductsMenuPanel.tsx'),'utf8');assert.ok(mobile.includes('{ label: "Resources", href: "/resources" }'));assert.ok(readFileSync(resolve(web,'app/(marketing)/blog/page.tsx'),'utf8').includes('href="/resources"'));});
