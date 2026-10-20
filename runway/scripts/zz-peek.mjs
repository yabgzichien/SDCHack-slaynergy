import fs from "node:fs";
import { unzipSync, strFromU8 } from "fflate";
const z = unzipSync(new Uint8Array(fs.readFileSync(process.argv[2])));
const ss = strFromU8(z["xl/sharedStrings.xml"]);
const strs=[...ss.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m=>m[1].replace(/<[^>]+>/g,"").replace(/\s+/g," "));
const sheets = Object.keys(z).filter(k=>/xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort((a,b)=>parseInt(a.match(/\d+/))-parseInt(b.match(/\d+/)));
for (const sh of sheets) {
  const x = strFromU8(z[sh]);
  const firstStr = [...x.matchAll(/<c r="([A-Z]+\d+)"[^>]*t="s"[^>]*>\s*<v>(\d+)<\/v>/g)].slice(0,4).map(m=>m[1]+": "+strs[+m[2]].slice(0,140));
  console.log(sh, firstStr);
}
