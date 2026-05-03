/**
 * WEBHOOK DE LEADS — OSASCO EXPRESS
 * Planilha: https://docs.google.com/spreadsheets/d/1sW9TSOeWODXXz9iYAxFbKnX5ryYVS9Y1If9ptR3P4QE/edit
 *
 * Como usar:
 * 1. Abra a planilha > Extensões > Apps Script.
 * 2. Apague o código antigo e cole este arquivo inteiro.
 * 3. Salve.
 * 4. Rode a função setup() uma vez e autorize.
 * 5. Implante como App da Web.
 * 6. Use a URL /exec no index.html do site.
 */

const CONFIG = {
  SPREADSHEET_ID: '1sW9TSOeWODXXz9iYAxFbKnX5ryYVS9Y1If9ptR3P4QE',
  SHEET_NAME: 'Leads Site',
  HEADERS: [
    'Recebido em',
    'Origem',
    'Página',
    'Nome',
    'WhatsApp',
    'WhatsApp limpo',
    'Tipo de operação',
    'Volume delivery',
    'Maior gargalo',
    'Status',
    'User Agent'
  ]
};

function doGet() {
  setup();
  return json_({
    ok: true,
    service: 'Webhook Leads Osasco Express',
    message: 'Webhook ativo. Use POST para enviar leads.',
    sheet: CONFIG.SHEET_NAME
  });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = setup();
    const data = parsePayload_(e);

    const lead = normalizeLead_(data);

    if (!lead.nome || !lead.whatsapp) {
      return json_({
        ok: false,
        error: 'Nome e WhatsApp são obrigatórios.'
      });
    }

    sheet.appendRow([
      new Date(),
      lead.origem,
      lead.pagina,
      lead.nome,
      lead.whatsapp,
      lead.whatsappLimpo,
      lead.tipoOperacao,
      lead.volumeDelivery,
      lead.maiorGargalo,
      lead.status,
      lead.userAgent
    ]);

    return json_({
      ok: true,
      message: 'Lead registrado com sucesso.'
    });

  } catch (err) {
    return json_({
      ok: false,
      error: String(err && err.message ? err.message : err)
    });
  } finally {
    lock.releaseLock();
  }
}

function setup() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(CONFIG.SHEET_NAME);
  }

  const firstRow = sheet.getRange(1, 1, 1, CONFIG.HEADERS.length).getValues()[0];
  const hasHeader = firstRow.some(value => String(value || '').trim() !== '');

  if (!hasHeader) {
    sheet.getRange(1, 1, 1, CONFIG.HEADERS.length).setValues([CONFIG.HEADERS]);
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, CONFIG.HEADERS.length);
  }

  return sheet;
}

function testeManual() {
  const fakeEvent = {
    postData: {
      type: 'application/json',
      contents: JSON.stringify({
        origem: 'Teste manual Apps Script',
        pagina: 'Execução interna',
        nome: 'Lead Teste Osasco Express',
        whatsapp: '(11) 97033-4125',
        whatsapp_limpo: '11970334125',
        tipo_operacao: 'Restaurante',
        volume_delivery: '31 a 60 pedidos por dia',
        maior_gargalo: 'Falta de entregador no pico',
        status: 'Teste',
        user_agent: 'Apps Script'
      })
    }
  };

  return doPost(fakeEvent);
}

function parsePayload_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return {};
  }

  const raw = e.postData.contents;
  const type = String(e.postData.type || '').toLowerCase();

  if (type.includes('application/json') || looksLikeJson_(raw)) {
    return JSON.parse(raw);
  }

  return parseFormEncoded_(raw);
}

function normalizeLead_(data) {
  const whatsapp = clean_(data.whatsapp || data.telefone || data.phone);

  return {
    origem: clean_(data.origem || 'Site Osasco Express'),
    pagina: clean_(data.pagina || data.page || ''),
    nome: clean_(data.nome || data.name || ''),
    whatsapp,
    whatsappLimpo: onlyNumbers_(data.whatsapp_limpo || whatsapp),
    tipoOperacao: clean_(data.tipo_operacao || data.tipoOperacao || data.perfil || ''),
    volumeDelivery: clean_(data.volume_delivery || data.volumeDelivery || data.mediaPedidos || ''),
    maiorGargalo: clean_(data.maior_gargalo || data.maiorGargalo || data.gargalo || ''),
    status: clean_(data.status || 'Novo lead'),
    userAgent: clean_(data.user_agent || data.userAgent || '')
  };
}

function parseFormEncoded_(raw) {
  const obj = {};
  raw.split('&').forEach(pair => {
    const parts = pair.split('=');
    const key = decodeURIComponent(parts[0] || '').trim();
    const value = decodeURIComponent((parts.slice(1).join('=') || '').replace(/\+/g, ' ')).trim();
    if (key) obj[key] = value;
  });
  return obj;
}

function looksLikeJson_(text) {
  const value = String(text || '').trim();
  return value.startsWith('{') && value.endsWith('}');
}

function clean_(value) {
  return String(value == null ? '' : value).trim();
}

function onlyNumbers_(value) {
  return clean_(value).replace(/\D/g, '');
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
