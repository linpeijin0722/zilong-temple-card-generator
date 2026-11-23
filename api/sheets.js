const SOURCES = {
  substitute: {
    id: "1rthGYkz-Z9Kgpra5ued65WeZbfiEc-tQ8Swba7x6vCU",
    sheets: ["特別祭改 【男】", "特別祭改 【女】"]
  },
  lamp: {
    id: "1RqkwLY3HTO6NsdKiSaCsxRDFHBzSYkUJ8IbA8KpB10E",
    sheets: ["安太歲", "平安燈", "光明燈", "文昌燈", "開運燈", "姻緣燈"]
  }
};

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "只支援 GET" });
  const type = String(req.query.type || "");
  const sheet = String(req.query.sheet || "");
  const source = SOURCES[type];
  if (!source || !source.sheets.includes(sheet)) {
    return res.status(400).json({ error: "不允許的資料來源或工作表" });
  }
  const url = `https://docs.google.com/spreadsheets/d/${source.id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}`;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 ZilingTempleGenerator/1.0" },
      signal: AbortSignal.timeout(25000)
    });
    if (!response.ok) throw new Error(`Google 回應 ${response.status}`);
    const csv = await response.text();
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    return res.status(200).send(csv);
  } catch (error) {
    return res.status(502).json({ error: `讀取試算表失敗：${error.message}` });
  }
}
