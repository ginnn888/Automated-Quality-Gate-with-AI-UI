import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import {seal} from '../src/lib/session';
import {POST as install} from '../src/app/api/install/route';
import {POST as prepare} from '../src/app/api/preparation/route';
import {POST as service} from '../src/app/api/services/[service]/route';

test('stale tabs cannot install, prepare or save credentials using another logged-in account', async () => {
  const oldFetch=globalThis.fetch, oldSecret=process.env.SESSION_SECRET, oldUrl=process.env.APP_URL;
  process.env.SESSION_SECRET='account-guard-test-secret-at-least-32-characters';
  process.env.APP_URL='http://localhost:3000';
  try {
    globalThis.fetch=async (url, init) => {
      assert.equal(String(url),'https://api.github.com/user');
      const token=new Headers(init?.headers).get('Authorization');
      return Response.json({id:token==='Bearer alice' ? 1 : 2, login:'test',name:null});
    };
    const sessions=await Promise.all(['alice','bob'].map(seal));
    for (const route of [install,prepare,(r:NextRequest)=>service(r,{params:Promise.resolve({service:'secret'})}),(r:NextRequest)=>service(r,{params:Promise.resolve({service:'sonar'})})]) {
      for (const [index,expected] of [[1,'1'],[0,'2'],[0,'']] as const) {
        const response=await route(new NextRequest('http://localhost:3000/api/install',{method:'POST',headers:{origin:process.env.APP_URL,cookie:`qg_session=${sessions[index]}`,'x-qg-user-id':expected},body:'{}'}));
        assert.equal(response.status,409); assert.equal((await response.json()).code,'ACCOUNT_CHANGED');
      }
      const response=await route(new NextRequest('http://localhost:3000/api/install',{method:'POST',headers:{origin:process.env.APP_URL,cookie:`qg_session=${sessions[0]}`,'x-qg-user-id':'1'},body:'{}'}));
      assert.equal(response.status,400,'matching account proceeds to payload validation');
    }
  } finally {
    globalThis.fetch=oldFetch;
    if (oldSecret===undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET=oldSecret;
    if (oldUrl===undefined) delete process.env.APP_URL; else process.env.APP_URL=oldUrl;
  }
});
