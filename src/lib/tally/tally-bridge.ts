/** TallyPrime HTTP bridge — export request templates. */
export function tallyExportLedgersXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>Ledgers</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="Ledgers">
            <TYPE>Ledger</TYPE>
            <FETCH>Name, Parent, GUID, Alias, OpeningBalance, IsDeemedPositive, IncomeTaxNumber, PartyGSTIN</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
}

export function tallyExportGroupsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>Groups</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="Groups">
            <TYPE>Group</TYPE>
            <FETCH>Name, Parent, GUID, ReservedName</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
}

export function tallyExportStockItemsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>StockItems</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="StockItems">
            <TYPE>Stock Item</TYPE>
            <FETCH>Name, Parent, GUID, BaseUnits, OpeningBalance, OpeningValue, HSNCODE, GSTRate</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
}

export function tallyExportVouchersXml(fromDate?: string, toDate?: string): string {
  const from = fromDate ?? "20200401";
  const to = toDate ?? "20301231";
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>Vouchers</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        <SVFROMDATE>${from}</SVFROMDATE>
        <SVTODATE>${to}</SVTODATE>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="Vouchers">
            <TYPE>Voucher</TYPE>
            <FETCH>Date, VoucherTypeName, VoucherNumber, GUID, Narration, AllLedgerEntries</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
}

export async function fetchTallyXml(baseUrl: string, requestXml: string, timeoutMs = 120_000): Promise<{ ok: boolean; xml: string; message: string }> {
  const url = baseUrl.replace(/\/$/, "");
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/xml" },
      body: requestXml,
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const xml = await res.text();
    if (!res.ok) return { ok: false, xml, message: `HTTP ${res.status}` };
    if (!xml.includes("<ENVELOPE") && !xml.includes("<LEDGER") && !xml.includes("<GROUP")) {
      return { ok: false, xml, message: "Response does not look like Tally XML." };
    }
    return { ok: true, xml, message: "Export received." };
  } catch (e) {
    return { ok: false, xml: "", message: e instanceof Error ? e.message : "Tally bridge request failed" };
  }
}

export async function testTallyBridgePost(baseUrl: string): Promise<{ ok: boolean; message: string }> {
  const ping = `<?xml version="1.0"?><ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE><ID>Ping</ID></HEADER><BODY/></ENVELOPE>`;
  const r = await fetchTallyXml(baseUrl, ping, 8000);
  return { ok: r.ok, message: r.message };
}
