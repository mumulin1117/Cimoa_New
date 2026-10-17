import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
const root='docs/evidence/auto-match/',started=Date.now(),device='D9B138D2-1B08-4646-B8D0-8A2242AECD7D'
let token=''
for(let attempt=0;attempt<180;attempt++){
  const ready=root+'native-background-ready.txt'
  if(fs.existsSync(ready)&&fs.statSync(ready).mtimeMs>=started){token=fs.readFileSync(ready,'utf8');break}
  await new Promise(resolve=>setTimeout(resolve,500))
}
if(!token)throw Error('Native Auto Match test did not reach the paused background checkpoint')
try{
  console.log(execFileSync('xcrun',['simctl','launch',device,'com.apple.mobilesafari'],{encoding:'utf8',timeout:15000}))
  await new Promise(resolve=>setTimeout(resolve,1200))
}finally{
  console.log(execFileSync('xcrun',['simctl','launch',device,'com.cimoa.neapo.dev'],{encoding:'utf8',timeout:15000}))
}
fs.writeFileSync(root+'native-background-done.txt',token)
fs.writeFileSync(root+'native-background.json',JSON.stringify({passed:true,token,device,background_app:'com.apple.mobilesafari',foreground_app:'com.cimoa.neapo.dev',duration_ms:Date.now()-started},null,2)+'\n')
