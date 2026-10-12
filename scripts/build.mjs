import {mkdir,copyFile,rm,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
await rm(resolve(root,'dist'),{recursive:true,force:true});
for(const path of ['index.html','assets/favicon.svg','src/styles.css','src/model.js','src/reforecast.js','src/inputs.js','src/tooltips.js','src/fm-data.json','src/app.js','src/model-data.json']){
 const to=resolve(root,'dist',path);await mkdir(dirname(to),{recursive:true});await copyFile(resolve(root,path),to);
}
await writeFile(resolve(root,'dist','robots.txt'),'User-agent: *\nDisallow: /\n');
await writeFile(resolve(root,'dist','.nojekyll'),'');
console.log('Built ./dist with only the intended static application assets.');
