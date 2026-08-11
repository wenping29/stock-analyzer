import axios from "axios";

async function main() {
  // Try Sina K-line with scale=240 (daily), datalen for different gold symbols
  const symbols = [
    { sym: "hf_GC", desc: "COMEX黄金" },
    { sym: "hf_XAU", desc: "伦敦金现货" },  
    { sym: "hf_SI", desc: "白银" },
    { sym: "gc00y", desc: "黄金指数" },
  ];

  for (const s of symbols) {
    try {
      const resp = await axios.get("https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData", {
        params: { symbol: s.sym, scale: 240, datalen: 5 },
        headers: { "User-Agent": "Mozilla/5.0", Referer: "https://finance.sina.com.cn/" },
      });
      const data = resp.data;
      if (Array.isArray(data) && data.length > 0) {
        console.log(`${s.desc}(${s.sym}): ${data.length} rows - ${JSON.stringify(data[0])}`);
      } else if (data != null) {
        console.log(`${s.desc}(${s.sym}): type=${typeof data}, value=${JSON.stringify(data)?.substring(0, 100)}`);
      } else {
        console.log(`${s.desc}(${s.sym}): null`);
      }
    } catch (e: any) {
      console.log(`${s.desc}(${s.sym}): FAILED - ${e.message}`);
    }
  }

  // Try Sina spot quote to understand the format
  try {
    const resp = await axios.get("https://hq.sinajs.cn/list=hf_GC", {
      headers: { "User-Agent": "Mozilla/5.0", Referer: "https://finance.sina.com.cn/" },
      responseType: "arraybuffer",
    });
    const text = new TextDecoder("gbk").decode(new Uint8Array(resp.data));
    console.log("\nSina hf_GC spot:", text.trim());
  } catch (e: any) {
    console.log("Sina spot: FAILED -", e.message);
  }

  // Try fetching historical data via eastmoney web API
  try {
    const resp = await axios.post("https://datacenter-web.eastmoney.com/api/data/v1/get", {
      sortColumns: "TRADE_DATE",
      sortTypes: "-1",
      pageSize: 5,
      pageNumber: 1,
      reportName: "RPT_DAILY_GOLD",
      columns: "ALL",
      source: "WEB",
      client: "WEB",
    }, {
      headers: { 
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Content-Type": "application/json",
        "Referer": "https://data.eastmoney.com/"
      },
      timeout: 10000,
    });
    console.log("\nEastMoney gold data:", JSON.stringify(resp.data)?.substring(0, 500));
  } catch (e: any) {
    console.log("\nEastMoney RPT_DAILY_GOLD: FAILED -", e.message);
  }

  // Try another eastmoney endpoint
  try {
    const resp = await axios.get("https://datacenter-web.eastmoney.com/api/data/v1/get", {
      params: {
        sortColumns: "TRADE_DATE",
        sortTypes: "-1",
        pageSize: 5,
        pageNumber: 1,
        reportName: "RPT_DAILY_GOLD",
        columns: "ALL",
        source: "WEB",
        client: "WEB",
      },
      headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://data.eastmoney.com/" },
      timeout: 10000,
    });
    console.log("\nEastMoney RPT_DAILY_GOLD GET:", JSON.stringify(resp.data)?.substring(0, 500));
  } catch (e: any) {
    console.log("\nEastMoney GET: FAILED -", e.message);
  }

  // Try sina alternative: hq.sinajs.cn with different gold symbols
  try {
    const resp = await axios.get("https://hq.sinajs.cn/list=hf_GC,hf_AU,hf_XAU,hf_SI,hf_PT", {
      headers: { "User-Agent": "Mozilla/5.0", Referer: "https://finance.sina.com.cn/" },
      responseType: "arraybuffer",
    });
    const text = new TextDecoder("gbk").decode(new Uint8Array(resp.data));
    console.log("\nSina gold futures spot:");
    console.log(text);
  } catch (e: any) {
    console.log("\nSina spot multi: FAILED -", e.message);
  }
}

main();