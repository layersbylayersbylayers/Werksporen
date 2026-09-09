import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root,"dist");
fs.rmSync(dist,{recursive:true,force:true});
fs.mkdirSync(path.join(dist,"client"),{recursive:true});
fs.mkdirSync(path.join(dist,"server"),{recursive:true});
const clientFiles = ["portfolio-werksporen.html","portfolio-admin.html","portfolio-admin-data.js","manifest.webmanifest","sw.js","werksporen-admin-icon.svg"];
for (const file of clientFiles) fs.copyFileSync(path.join(root,file),path.join(dist,"client",file));
if (fs.existsSync(path.join(root,"portfolio-thumbs"))) fs.cpSync(path.join(root,"portfolio-thumbs"),path.join(dist,"client","portfolio-thumbs"),{recursive:true});
fs.copyFileSync(path.join(root,"portfolio-werksporen.html"),path.join(dist,"client","index.html"));
fs.copyFileSync(path.join(root,"portfolio-admin-data.json"),path.join(dist,"client","seed.json"));
fs.copyFileSync(path.join(root,"studio","worker.js"),path.join(dist,"server","index.js"));
function removeAppleDouble(directory) {
  for (const entry of fs.readdirSync(directory,{withFileTypes:true})) {
    const target = path.join(directory,entry.name);
    if (entry.name.startsWith("._")) fs.rmSync(target,{recursive:true,force:true});
    else if (entry.isDirectory()) removeAppleDouble(target);
  }
}
removeAppleDouble(dist);
console.log(`Sites-build gereed: ${clientFiles.length + 3} bestanden`);
