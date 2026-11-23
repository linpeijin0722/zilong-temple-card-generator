import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("./public/", import.meta.url));
const sources = {
  substitute: { id: "1rthGYkz-Z9Kgpra5ued65WeZbfiEc-tQ8Swba7x6vCU", sheets: ["特別祭改 【男】", "特別祭改 【女】"] },
  lamp: { id: "1RqkwLY3HTO6NsdKiSaCsxRDFHBzSYkUJ8IbA8KpB10E", sheets: ["安太歲", "平安燈", "光明燈", "文昌燈", "開運燈", "姻緣燈"] }
};
const mime = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".jpg":"image/jpeg" };

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/api/sheets") {
      const type=url.searchParams.get("type"), sheet=url.searchParams.get("sheet"), source=sources[type];
      if (!source || !source.sheets.includes(sheet)) { res.writeHead(400,{"Content-Type":"application/json"}); return res.end(JSON.stringify({error:"不允許的資料來源"})); }
      const response=await fetch(`https://docs.google.com/spreadsheets/d/${source.id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}`);
      if(!response.ok) throw new Error(`Google ${response.status}`);
      res.writeHead(200,{"Content-Type":"text/csv; charset=utf-8","Cache-Control":"no-store"}); return res.end(await response.text());
    }
    const relative = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
    const path = normalize(join(root, relative));
    if (!path.startsWith(root)) { res.writeHead(403); return res.end(); }
    const data = await readFile(path);
    res.writeHead(200,{"Content-Type":mime[extname(path)]||"application/octet-stream"}); res.end(data);
  } catch (error) { res.writeHead(404,{"Content-Type":"text/plain; charset=utf-8"}); res.end(error.message); }
}).listen(4173,"127.0.0.1",()=>console.log("Local: http://127.0.0.1:4173"));
