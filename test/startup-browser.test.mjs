// Opt-in ; réseau et choix de projet simulés, aucun appel Herdr.
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';

const enabled=process.env.MYTEAM_BROWSER_TESTS==='1';
let browser,server,origin;
before(async()=>{
 if(!enabled)return;
 const {chromium}=await import(process.env.MYTEAM_PLAYWRIGHT_MODULE||'playwright');
 browser=await chromium.launch({headless:true,executablePath:process.env.MYTEAM_CHROMIUM});
 server=createServer(async(req,res)=>{
  const name={'/':'start.html','/start.js':'start.js','/start.css':'start.css'}[req.url];
  if(!name){res.writeHead(404);return res.end();}
  res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html');
  res.end(await readFile(new URL('../public/'+name,import.meta.url)));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${server.address().port}`;
});
after(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));});

for(const lang of ['fr','en'])for(const width of [390,1280])test(`démarrage ${lang}, ${width}px : choix explicite, langue persistante et kit localisé`,{skip:!enabled},async()=>{
 const context=await browser.newContext({locale:lang,viewport:{width,height:900}}),page=await context.newPage(),posts=[],errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/api/projet**',route=>{
  const request=route.request(),url=new URL(request.url());
  if(request.method()==='POST'){
   posts.push(request.postDataJSON());return route.fulfill({status:400,json:{error:'Simulé'}});
  }
  return route.fulfill({json:url.pathname.endsWith('/dossiers')?{directories:url.searchParams.get('chemin')?[]:['demo']}:{token:'simulation',places:['home'],project:null}});
 });
 await page.goto(origin);await page.waitForFunction(()=>document.querySelector('#place').options.length===1);
 assert.equal(await page.locator('html').getAttribute('lang'),lang);
 assert.equal(await page.locator('#back').isVisible(),false);
 assert.equal(await page.locator('#folder').isVisible(),false);
 const submit=page.locator('[type=submit]');assert.equal(await submit.isDisabled(),true);
 await page.locator('[value=project]').check();await page.waitForFunction(()=>document.querySelector('#directories button'));
 assert.equal(await submit.isDisabled(),true);
 assert.equal(await page.locator('#selection-hint').textContent(),lang==='fr'?'Ouvre un sous-dossier pour continuer':'Open a subfolder to continue');
 await page.getByRole('button',{name:'demo',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('[type=submit]').disabled);
 if(process.env.MYTEAM_REFRESH_CAPTURES==='1')await page.screenshot({path:new URL(`../docs/captures/30-demarrage-${lang}-${width}.png`,import.meta.url).pathname,fullPage:true});
 await page.locator('#kit').check();await submit.click();await page.waitForFunction(()=>!document.querySelector('[type=submit]').disabled);
 assert.equal(posts.length,1);assert.equal(posts[0].path,'demo');assert.equal(posts[0].lang,lang);assert.equal(posts[0].prepareKit,true);
 const other=lang==='fr'?'en':'fr';await page.locator('#language').selectOption(other);
 assert.equal(await page.evaluate(()=>localStorage.getItem('bureau.langue')),other);
 await page.reload();await page.waitForFunction(()=>document.querySelector('#place').options.length===1);
 assert.equal(await page.locator('html').getAttribute('lang'),other);
 await page.locator('[value=myteam]').check();assert.equal(await submit.isEnabled(),true);
 assert.equal(await submit.textContent(),other==='en'?'Open MyTeam':'Ouvrir MyTeam');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(errors,[]);await context.close();
});

test('lien du contexte projet traduit dans le bureau',{skip:!enabled},async()=>{
 const context=await browser.newContext(),page=await context.newPage();
 await page.route('**/api/projet',route=>route.fulfill({json:{project:{mode:'project',root:'/projects/demo'}}}));
 await page.goto(origin);await page.evaluate(()=>{document.body.innerHTML='<a id="project-context"></a>';window.getLangue=()=> 'en';});
 await page.addScriptTag({content:await readFile(new URL('../public/project-context.js',import.meta.url),'utf8')});
 await page.waitForFunction(()=>document.querySelector('#project-context').textContent==='Project: demo');
 assert.equal(await page.locator('#project-context').getAttribute('title'),'/projects/demo · Change project');
 await context.close();
});
