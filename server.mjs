import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {createHerdr} from './src/herdr.mjs';

const publicDir=fileURLToPath(new URL('./public/',import.meta.url));
export function createBureauServer({bridge=createHerdr()}={}) {
  const token=randomBytes(32).toString('hex');
  const server=createServer(async(req,res)=> {
    const port=server.address()?.port;
    const origin=`http://127.0.0.1:${port}`;
    const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
      'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"};
    const json=(status,data)=>{res.writeHead(status,{...headers,'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
    if(req.headers.host!==`127.0.0.1:${port}`) return json(403,{error:'Adresse locale requise.'});
    if(req.headers.origin && req.headers.origin!==origin) return json(403,{error:'Origine non autorisée.'});
    if(req.headers['sec-fetch-site']==='cross-site') return json(403,{error:'Accès extérieur refusé.'});
    let url;
    try {url=new URL(req.url,origin);} catch {return json(400,{error:'Adresse invalide.'});}
    try {
      if(req.method==='GET'&&url.pathname==='/api/state') {
        try {return json(200,{connected:true,agents:await bridge.list(),updatedAt:new Date().toISOString(),token});}
        catch(error) {return json(200,{connected:false,agents:[],error:error.message,updatedAt:new Date().toISOString(),token});}
      }
      if(req.method==='GET'&&url.pathname==='/api/read') return json(200,await bridge.read(url.searchParams.get('id')));
      if(req.method==='POST'&&url.pathname==='/api/prompt') {
        const sent=Buffer.from(req.headers['x-bureau-token']||'');
        const expected=Buffer.from(token);
        if(req.headers.origin!==origin||sent.length!==expected.length||!timingSafeEqual(sent,expected)) return json(403,{error:'Session expirée. Actualisez le bureau.'});
        if(!req.headers['content-type']?.startsWith('application/json')) return json(415,{error:'Format de consigne invalide.'});
        let size=0;
        const chunks=[];
        for await(const chunk of req) {
          size+=chunk.length;
          if(size>60000) return json(413,{error:'Consigne trop longue.'});
          chunks.push(chunk);
        }
        let parsed;
        try {parsed=JSON.parse(Buffer.concat(chunks).toString('utf8'));} catch {return json(400,{error:'Consigne illisible.'});}
        if(typeof parsed.id!=='string') return json(400,{error:'Sélectionnez un agent.'});
        return json(200,await bridge.prompt(parsed.id,parsed.message));
      }
      const files={'/':'index.html','/index.html':'index.html','/style.css':'style.css','/app.js':'app.js'};
      if(req.method!=='GET'||!files[url.pathname]) return json(404,{error:'Page introuvable.'});
      const filename=files[url.pathname];
      const content=await readFile(join(publicDir,filename));
      const type=filename.endsWith('.css')?'text/css':filename.endsWith('.js')?'text/javascript':'text/html';
      res.writeHead(200,{...headers,'Content-Type':`${type}; charset=utf-8`});res.end(content);
    } catch(error) {json(400,{error:error.message||'La demande n’a pas abouti.'});}
  });
  server.requestTimeout=20000;
  return server;
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]) {
  const port=Number(process.env.BUREAU_PORT||4317);
  const server=createBureauServer();
  server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'Le port du bureau est déjà utilisé. Essayez un autre BUREAU_PORT.':'Le bureau n’a pas pu démarrer.');process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>console.log(`Bureau des agents ouvert sur http://127.0.0.1:${port}`));
}
