import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('packages');const files=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory()&&!['node_modules','dist','build'].includes(e.name))walk(p);else if(e.isFile()&&/\.(ts|tsx)$/.test(e.name))files.push(p);}}
walk(root);const failures=[];for(const file of files){fs.readFileSync(file,'utf8').split(/\r?\n/).forEach((line,i)=>{if(/[ \t]+$/.test(line))failures.push(`${file}:${i+1}: trailing whitespace`);});}
if(failures.length){console.error(failures.join('\n'));process.exit(1);}console.log(`lint passed (${files.length} TypeScript files checked)`);
