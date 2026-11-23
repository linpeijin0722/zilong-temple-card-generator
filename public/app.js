const CONFIG = {
  substitute: {
    sheets: ["特別祭改 【男】", "特別祭改 【女】"],
    required: ["姓名", "農曆生日", "出生時辰", "地址", "編號"]
  },
  lamp: {
    sheets: ["安太歲", "平安燈", "光明燈", "文昌燈", "開運燈", "姻緣燈"],
    required: ["姓名", "性別", "地址", "生肖", "國曆生日", "農曆生日", "出生時辰", "編號"]
  }
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const normalizeHeader = (value) => {
  const v = String(value || "").replace(/^\uFEFF/, "").replace(/\s+/g, "");
  return v.endsWith("姓名") ? "姓名" : v;
};
const normalizePerson = (value) => String(value || "").replace(/\s+/g, " ").trim();
const safeName = (value) => (String(value || "未命名").replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/[. ]+$/g, "") || "未命名").slice(0, 120);

function parseCSV(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ""; }
    else if (ch === '\n') { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

async function fetchRows(type, sheet) {
  const response = await fetch(`/api/sheets?type=${encodeURIComponent(type)}&sheet=${encodeURIComponent(sheet)}`, { cache: "no-store" });
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try { message = (await response.json()).error || message; } catch {}
    throw new Error(message);
  }
  const rows = parseCSV(await response.text());
  const required = CONFIG[type].required;
  const headerIndex = rows.slice(0, 30).findIndex(row => required.every(key => row.map(normalizeHeader).includes(key)));
  if (headerIndex < 0) throw new Error(`${sheet} 找不到必要欄位`);
  const headers = rows[headerIndex].map(normalizeHeader);
  return rows.slice(headerIndex + 1).map(row => Object.fromEntries(required.map(key => [key, (row[headers.indexOf(key)] || "").trim()])))
    .filter(item => item["姓名"] || item["編號"]);
}

async function loadImage(source) {
  const url = source instanceof File ? URL.createObjectURL(source) : source;
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return image;
  } finally {
    if (source instanceof File) URL.revokeObjectURL(url);
  }
}

function canvasFromImage(image) {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  canvas.getContext("2d").drawImage(image, 0, 0);
  return canvas;
}

function shiftedSubstituteCanvas(image) {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d"), shift = Math.round(canvas.height * 76 / 1474);
  ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 2, 2, canvas.width - 4, canvas.height - shift - 4, 2, shift + 2, canvas.width - 4, canvas.height - shift - 4);
  ctx.strokeStyle = "#7b3c16"; ctx.lineWidth = 2; ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
  return canvas;
}

function fitFont(ctx, text, maxSize, minSize, maxWidth, weight = 400) {
  let size = maxSize;
  do {
    ctx.font = `${weight} ${size}px "Noto Sans TC", sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) return size;
    size--;
  } while (size > minSize);
  return minSize;
}

function wrapText(ctx, text, maxWidth) {
  const tokens = /[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*|\s+|./gu;
  const lines = [], parts = text.match(tokens) || [], current = { value: "" };
  for (const part of parts) {
    const trial = current.value + part;
    if (current.value && ctx.measureText(trial).width > maxWidth) {
      lines.push(current.value.trimEnd()); current.value = part.trimStart();
    } else current.value = trial;
  }
  if (current.value) lines.push(current.value.trimEnd());
  return lines;
}

function drawRotatedLines(canvas, text, box, options = {}) {
  const [rx0, ry0, rx1, ry1] = box;
  const x0 = rx0 * canvas.width, y0 = ry0 * canvas.height, x1 = rx1 * canvas.width, y1 = ry1 * canvas.height;
  const layer = document.createElement("canvas");
  layer.width = Math.round(y1 - y0); layer.height = Math.round(x1 - x0);
  const ctx = layer.getContext("2d");
  const max = Math.round((options.fontRatio || .044) * canvas.height), min = Math.round((options.minFontRatio || .032) * canvas.height);
  let size = max, lines, lineHeight;
  do {
    ctx.font = `${options.weight || 400} ${size}px "Noto Sans TC", sans-serif`;
    lines = wrapText(ctx, text, layer.width);
    lineHeight = Math.round(size * (options.lineHeight || 1.12));
    if ((lines.length <= (options.maxLines || 2) && lines.length * lineHeight <= layer.height) || size <= min) break;
    size--;
  } while (true);
  ctx.fillStyle = options.color || "#310700"; ctx.textBaseline = "alphabetic";
  const top = (layer.height - lines.length * lineHeight) / 2;
  lines.forEach((line, i) => ctx.fillText(line, 0, top + i * lineHeight + size));
  const target = canvas.getContext("2d");
  target.save(); target.translate(x0, y1); target.rotate(-Math.PI / 2); target.drawImage(layer, 0, 0); target.restore();
}

function drawSubstituteName(canvas, name) {
  const ctx = canvas.getContext("2d"), box = [.25, .34, .75, .91];
  if (/[A-Za-z]/.test(name)) return drawRotatedLines(canvas, name, box, { fontRatio: .09, minFontRatio: .055, maxLines: 1, weight: 800 });
  const chars = [...normalizePerson(name)], x0 = box[0] * canvas.width, y0 = box[1] * canvas.height, x1 = box[2] * canvas.width, y1 = box[3] * canvas.height;
  const max = .15 * canvas.height, min = .085 * canvas.height, gap = .018 * canvas.height;
  const size = Math.max(min, Math.min(max, (x1 - x0) * .9, ((y1 - y0) - gap * Math.max(0, chars.length - 1)) / chars.length));
  ctx.font = `800 ${size}px "Noto Sans TC", sans-serif`; ctx.fillStyle = "#310700"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const first = y0 + size * .52, last = y1 - size * .52;
  chars.forEach((char, i) => ctx.fillText(char, (x0 + x1) / 2, chars.length === 1 ? (y0 + y1) / 2 : first + i * (last - first) / (chars.length - 1)));
}

async function renderSubstitute(row, gender, template) {
  const canvas = shiftedSubstituteCanvas(template), hour = String(row["出生時辰"] || "").trim().slice(0, 1), dy = 76 / 1474;
  const name = normalizePerson(row["姓名"]), address = `地址：${normalizePerson(row["地址"])}`;
  const numberText = `編號：(${gender})-${String(row["編號"] || "").trim()}`;
  const ctx = canvas.getContext("2d");
  const numberSize = fitFont(ctx, numberText, Math.round(canvas.height * 54 / 1474), Math.round(canvas.height * 40 / 1474), canvas.width * .86, 800);
  ctx.font = `800 ${numberSize}px "Noto Sans TC", sans-serif`; ctx.fillStyle = "#310700"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(numberText, canvas.width / 2, canvas.height * 54 / 1474);
  drawSubstituteName(canvas, name);
  drawRotatedLines(canvas, `農：${String(row["農曆生日"] || "").replace(/\s+/g, "")}${hour ? `(${hour})` : ""}`, [.035,.03+dy,.23,.67+dy], { fontRatio:.046,minFontRatio:.034,maxLines:2 });
  drawRotatedLines(canvas, address, [.73,.03+dy,.965,.90+dy], { fontRatio:.044,minFontRatio:.032,maxLines:2 });
  return canvasToBytes(canvas);
}

function drawUpsideDownTop(canvas, row) {
  const ctx = canvas.getContext("2d"), x = .055*canvas.width, y=.035*canvas.height, w=.895*canvas.width, h=.43*canvas.height;
  const layer = document.createElement("canvas"); layer.width=w; layer.height=h; const c=layer.getContext("2d");
  const text = `${normalizePerson(row["姓名"])} / ${row["性別"]} / ${String(row["農曆生日"]||"").replace(/\s+/g,"")} / ${String(row["出生時辰"]||"").replace(/\s+/g,"")} / ${normalizePerson(row["地址"])}`;
  let size=.07*canvas.height, lines, lineHeight;
  do { c.font=`400 ${size}px "Noto Sans TC", sans-serif`; lines=wrapText(c,text,w); lineHeight=size*1.28; if((lines.length<=4&&lines.length*lineHeight<=h)||size<=.052*canvas.height)break; size--; } while(true);
  c.fillStyle="#3b2d27"; c.textBaseline="alphabetic"; const top=(h-lines.length*lineHeight)/2;
  lines.forEach((line,i)=>c.fillText(line,0,top+i*lineHeight+size));
  ctx.save(); ctx.translate(x+w,y+h); ctx.rotate(Math.PI); ctx.drawImage(layer,0,0); ctx.restore();
}

async function renderLamp(row, sheet, template) {
  const canvas=canvasFromImage(template),ctx=canvas.getContext("2d"); drawUpsideDownTop(canvas,row);
  const name=normalizePerson(row["姓名"]), x0=.035*canvas.width,x1=.965*canvas.width,y0=.53*canvas.height,y1=.84*canvas.height;
  const size=fitFont(ctx,name,.30*canvas.height,.13*canvas.height,x1-x0,800); ctx.font=`800 ${size}px "Noto Sans TC", sans-serif`;ctx.fillStyle="#3b2d27";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(name,(x0+x1)/2,(y0+y1)/2);
  ctx.font=`400 ${.078*canvas.height}px "Noto Sans TC", sans-serif`;ctx.textAlign="left";ctx.textBaseline="alphabetic";ctx.fillText(`${sheet.slice(0,1)} ${row["編號"]}`, .055*canvas.width,.855*canvas.height+.078*canvas.height);
  return canvasToBytes(canvas);
}

function canvasToBytes(canvas) { return new Promise((resolve,reject)=>canvas.toBlob(async b=>b?resolve(new Uint8Array(await b.arrayBuffer())):reject(new Error("圖片輸出失敗")),"image/jpeg",.95)); }

function crc32(bytes) { let crc=0xffffffff; for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);} return (crc^0xffffffff)>>>0; }
function dosDateTime(date=new Date()){const time=(date.getHours()<<11)|(date.getMinutes()<<5)|(date.getSeconds()>>1);const day=((date.getFullYear()-1980)<<9)|((date.getMonth()+1)<<5)|date.getDate();return [time,day];}
function makeZip(files){const enc=new TextEncoder(),locals=[],centrals=[];let offset=0;const [time,date]=dosDateTime();const u16=n=>new Uint8Array([n&255,(n>>>8)&255]);const u32=n=>new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]);const concat=parts=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const p of parts){out.set(p,at);at+=p.length;}return out;};for(const f of files){const name=enc.encode(f.name.replace(/\\/g,"/")),data=f.data,crc=crc32(data);const local=concat([u32(0x04034b50),u16(20),u16(0x800),u16(0),u16(time),u16(date),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),name,data]);locals.push(local);const central=concat([u32(0x02014b50),u16(20),u16(20),u16(0x800),u16(0),u16(time),u16(date),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name]);centrals.push(central);offset+=local.length;}const central=concat(centrals),end=concat([u32(0x06054b50),u16(0),u16(0),u16(files.length),u16(files.length),u32(central.length),u32(offset),u16(0)]);return new Blob([...locals,central,end],{type:"application/zip"});}

function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function existingNames(type){
  const input=$(`#${type==='lamp'?'lamp':'sub'}-existing`);
  return new Set([...input.files].map(file=>(file.webkitRelativePath||file.name).replace(/\\/g,"/").toLowerCase()));
}
function hasExisting(existing,key,filename){
  const normalized=key.toLowerCase();
  return existing.has(filename.toLowerCase()) || [...existing].some(path=>path===normalized || path.endsWith(`/${normalized}`));
}
function history(type){
  try {
    const value=JSON.parse(localStorage.getItem(`ziling-${type}-fingerprints`)||"{}");
    return value && !Array.isArray(value) && typeof value==="object" ? value : {};
  } catch { return {}; }
}
function saveHistory(type,value){localStorage.setItem(`ziling-${type}-fingerprints`,JSON.stringify(value));}
function fingerprint(type,sheet,row){
  const fields=CONFIG[type].required;
  const content=JSON.stringify([sheet,...fields.map(field=>normalizePerson(row[field]))]);
  let hash=2166136261;
  for(let i=0;i<content.length;i++){hash^=content.charCodeAt(i);hash=Math.imul(hash,16777619);}
  return (hash>>>0).toString(16).padStart(8,"0");
}

async function run(type, mode) {
  const status=$(`#status-${type}`),buttons=$$(`[data-type="${type}"]`);buttons.forEach(b=>b.disabled=true);status.className="status busy";status.textContent="正在讀取試算表…";
  try {
    await document.fonts.load('800 80px "Noto Sans TC"'); await document.fonts.ready;
    const all=[];for(const sheet of CONFIG[type].sheets){const rows=await fetchRows(type,sheet);all.push({sheet,rows});status.textContent+=`\n${sheet}：${rows.length} 筆`;}
    if(mode==="test"){status.className="status success";status.textContent+=`\n資料與欄位檢查成功，共 ${all.reduce((n,x)=>n+x.rows.length,0)} 筆。`;return;}
    if(mode==="all" && !confirm("確定要重新產生目前試算表中的全部資料嗎？")){status.className="status";status.textContent="已取消重新產生全部資料。";return;}
    const existing=existingNames(type),records=history(type),files=[];let skipped=0,failed=0;
    let templates;
    if(type==="substitute")templates={男:await loadImage($("#sub-male-template").files[0]||"/assets/男替身底圖.jpg"),女:await loadImage($("#sub-female-template").files[0]||"/assets/女替身底圖.jpg")};
    else templates={lamp:await loadImage($("#lamp-template").files[0]||"/assets/安燈小卡底圖.jpg")};
    for(const group of all){for(const row of group.rows){
      const filename=`${safeName([row["編號"],row["姓名"]].filter(Boolean).join("-")||"未命名")}.jpg`;
      const folder=type==="substitute"?(group.sheet.includes("男")?"男":"女"):group.sheet;
      const key=`${folder}/${filename}`, signature=fingerprint(type,group.sheet,row), previous=records[key];
      if(mode==="changed" && (previous===signature || (!previous && hasExisting(existing,key,filename)))){skipped++;continue;}
      try{let data;if(type==="substitute"){const gender=group.sheet.includes("男")?"男":"女";data=await renderSubstitute(row,gender,templates[gender]);}else data=await renderLamp(row,group.sheet,templates.lamp);files.push({name:key,data});records[key]=signature;status.textContent=`正在產生圖片… ${files.length} 張`;await new Promise(r=>setTimeout(r,0));}catch(error){failed++;console.error(error);}
    }}
    if(!files.length){status.className="status success";status.textContent=`沒有新圖片需要產生；略過 ${skipped} 張。`;return;}
    download(makeZip(files),`${type==='substitute'?'祭改替身':'安燈小卡'}_${new Date().toISOString().slice(0,10)}.zip`);saveHistory(type,records);status.className="status success";status.textContent=`完成：下載 ${files.length} 張，略過 ${skipped} 張，失敗 ${failed} 張。`;
  } catch(error){status.className="status error";status.textContent=`執行失敗：${error.message}`;}
  finally{buttons.forEach(b=>b.disabled=false);}
}

$$('.tab').forEach(button=>button.addEventListener('click',()=>{$$('.tab').forEach(b=>b.classList.toggle('active',b===button));$$('.panel').forEach(p=>p.classList.toggle('active',p.id===`panel-${button.dataset.tab}`));}));
$$('[data-action]').forEach(button=>button.addEventListener('click',()=>run(button.dataset.type,button.dataset.action==='test'?'test':button.dataset.action==='generate-all'?'all':'changed')));
