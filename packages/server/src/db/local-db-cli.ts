import fs from 'node:fs';
import { createLocalDatabase, localDbPath } from './local-db.js';
const action=process.argv[2]||'migrate';
async function main(){if(action==='reset'&&fs.existsSync(localDbPath))fs.rmSync(localDbPath);await createLocalDatabase();console.log(action==='reset'?'Local Espera database reset and migrated.':'Local Espera database migrated.');}
void main();
