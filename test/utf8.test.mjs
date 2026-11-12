import {test} from 'node:test';
import assert from 'node:assert/strict';
import {request} from 'node:http';
import {createBureauServer} from '../server.mjs';

test('une consigne conserve les accents et emojis coupés entre morceaux réseau', async t => {
  const calls = [];
  const bridge = {
    list: async () => [],
    prompt: async (id, message) => { calls.push({id, message}); return {ok:true}; },
  };
  const server = createBureauServer({bridge});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const port = server.address().port;
  const origin = `http://127.0.0.1:${port}`;
  const {token} = await (await fetch(`${origin}/api/state`,{headers:{'Sec-Fetch-Site':'same-origin'}})).json();

  for (const message of ['Réparer', 'Bonjour 👋']) {
    const bytes = Buffer.from(JSON.stringify({id:'agent-1', message}));
    const character = message.includes('é') ? 'é' : '👋';
    const cut = bytes.indexOf(Buffer.from(character)) + 1;
    let receivedFirst;
    const firstReceived = new Promise(resolve => { receivedFirst = resolve; });
    server.prependOnceListener('request', req => req.once('data', receivedFirst));
    const response = await new Promise((resolve, reject) => {
      const req = request({hostname:'127.0.0.1', port, path:'/api/prompt', method:'POST', headers:{
        Origin:origin, 'Content-Type':'application/json', 'X-Bureau-Token':token,
      }}, res => {
        res.resume();
        res.on('end', () => resolve(res.statusCode));
      });
      req.on('error', reject);
      req.write(bytes.subarray(0, cut));
      firstReceived.then(() => req.end(bytes.subarray(cut)), reject);
    });
    assert.equal(response, 200);
    assert.deepEqual(calls.at(-1), {id:'agent-1', message});
  }
});
