function fmtDate(d) {
  if (!d) return '';
  var dt = new Date(d);
  return dt.getFullYear() + '/' + String(dt.getMonth() + 1).padStart(2, '0') + '/' + String(dt.getDate()).padStart(2, '0');
}

export function openReceiptCompilationPDF(entries, year, month, userName) {
  var withReceipts = entries.filter(function(e) { return e.receipt_data; });
  if (withReceipts.length === 0) { alert('領収書が添付された経費がありません。'); return; }

  // Check if any PDF receipts exist
  var hasPdf = false;
  for (var k = 0; k < entries.length; k++) {
    if (!entries[k].receipt_data) continue;
    if (entries[k].receipt_filename && entries[k].receipt_filename.toLowerCase().endsWith('.pdf')) {
      hasPdf = true;
      break;
    }
  }

  var html = '<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8">'
    + '<title>領収書一覧 ' + year + '年' + month + '月 - ' + userName + '</title>';

  // Load pdf.js from CDN only if needed
  if (hasPdf) {
    html += '<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"><\/script>';
  }

  html += '<style>'
    + '@page{size:A4 portrait;margin:10mm;}'
    + '*{margin:0;padding:0;box-sizing:border-box;}'
    + 'html,body{width:100%;overflow-x:hidden;}'
    + 'body{font-family:"Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo",sans-serif;font-size:11px;color:#1a1a2e;padding:8mm;}'
    + 'h1{font-size:18px;text-align:center;margin-bottom:8px;letter-spacing:4px;font-weight:800;}'
    + '.meta{text-align:center;margin-bottom:12px;font-size:11px;color:#64748b;}'
    + 'table{width:100%;border-collapse:collapse;font-size:10px;margin-bottom:12px;table-layout:fixed;}'
    + 'th,td{border:1px solid #94a3b8;padding:4px 6px;text-align:center;overflow:hidden;text-overflow:ellipsis;word-break:break-all;}'
    + 'th{background:#1e293b;color:#f1f5f9;font-weight:600;-webkit-print-color-adjust:exact;print-color-adjust:exact;}'
    + 'td.left{text-align:left;}'
    + 'td.right{text-align:right;font-weight:600;}'
    + '.receipt-page{page-break-before:always;}'
    + '.receipt-header{background:#1e293b;color:#f1f5f9;padding:6px 10px;font-size:11px;font-weight:600;margin-bottom:2px;border-radius:3px;-webkit-print-color-adjust:exact;print-color-adjust:exact;overflow:hidden;}'
    + '.receipt-header .no{font-size:12px;font-weight:800;float:left;}'
    + '.receipt-header .info{float:right;font-size:10px;}'
    + '.receipt-header::after{content:"";display:table;clear:both;}'
    + '.receipt-content{text-align:center;}'
    + '.receipt-content img{display:block;margin:0 auto;border:1px solid #e2e8f0;border-radius:4px;}'
    + '.pdf-loading{text-align:center;color:#64748b;padding:40px 20px;font-size:13px;}'
    + '</style></head><body>';

  // Page 1: Index table
  html += '<h1>領 収 書 一 覧</h1>';
  html += '<div class="meta">' + userName + ' — ' + year + '年' + month + '月 (' + withReceipts.length + '件)</div>';

  html += '<table><thead><tr>';
  html += '<th style="width:8%">No.</th>';
  html += '<th style="width:16%">日付</th>';
  html += '<th style="width:18%">費目</th>';
  html += '<th style="width:40%">内容</th>';
  html += '<th style="width:18%">金額</th>';
  html += '</tr></thead><tbody>';

  for (var i = 0; i < entries.length; i++) {
    var e = entries[i];
    if (!e.receipt_data) continue;
    var detail = '';
    if (e.category === '旅費交通費') {
      var parts = [];
      if (e.travel_from || e.travel_to) parts.push((e.travel_from || '') + '→' + (e.travel_to || ''));
      if (e.travel_method) parts.push(e.travel_method);
      detail = parts.join(' / ');
    } else if (e.category === '書籍代' && e.book_title) {
      detail = e.book_title;
    } else {
      detail = e.description || '';
    }
    html += '<tr>';
    html += '<td>' + (i + 1) + '</td>';
    html += '<td>' + fmtDate(e.expense_date) + '</td>';
    html += '<td>' + e.category + '</td>';
    html += '<td class="left">' + detail + '</td>';
    html += '<td class="right">&yen;' + e.amount.toLocaleString() + '</td>';
    html += '</tr>';
  }
  html += '</tbody></table>';

  // Pages 2+: Each receipt
  for (var j = 0; j < entries.length; j++) {
    var entry = entries[j];
    if (!entry.receipt_data) continue;
    var isPdf = entry.receipt_filename && entry.receipt_filename.toLowerCase().endsWith('.pdf');

    html += '<div class="receipt-page">';
    html += '<div class="receipt-header">';
    html += '<span class="no">No.' + (j + 1) + '</span>';
    html += '<span class="info">' + fmtDate(entry.expense_date) + ' — ' + entry.category + ' — &yen;' + entry.amount.toLocaleString() + '</span>';
    html += '</div>';
    html += '<div class="receipt-content">';

    if (isPdf) {
      html += '<div id="pdf-container-' + j + '" class="pdf-loading">PDF領収書を画像に変換中...</div>';
    } else {
      html += '<img src="data:image/png;base64,' + entry.receipt_data + '" alt="領収書 No.' + (j + 1) + '" />';
    }
    html += '</div></div>';
  }

  // Script
  html += '<script>';
  html += 'var MAX_IMG_W = 680, MAX_IMG_H = 880;';

  // resizeAllImages: set explicit width/height attributes on every receipt image
  // so the browser print engine knows the exact layout size
  html += 'function resizeAllImages() {';
  html += '  var imgs = document.querySelectorAll(".receipt-content img");';
  html += '  for (var i = 0; i < imgs.length; i++) {';
  html += '    var img = imgs[i];';
  html += '    var natW = img.naturalWidth || img.width;';
  html += '    var natH = img.naturalHeight || img.height;';
  html += '    if (natW <= 0 || natH <= 0) continue;';
  html += '    var ratio = Math.min(MAX_IMG_W / natW, MAX_IMG_H / natH, 1);';
  html += '    img.width = Math.round(natW * ratio);';
  html += '    img.height = Math.round(natH * ratio);';
  html += '    img.style.maxWidth = "100%";';
  html += '  }';
  html += '}';

  html += 'window.onload = function() {';

  if (hasPdf) {
    html += 'var pdfEntries = ' + JSON.stringify(entries.map(function(e, idx) {
      var ip = !!(e.receipt_filename && e.receipt_filename.toLowerCase().endsWith('.pdf'));
      return { idx: idx, isPdf: ip, data: ip ? e.receipt_data : null };
    })) + ';';

    html += 'pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";';

    // Render PDF to canvas at exactly the target display size (no excess pixels)
    html += 'function renderPdf(entry) {';
    html += '  if (!entry.isPdf || !entry.data) return Promise.resolve();';
    html += '  var container = document.getElementById("pdf-container-" + entry.idx);';
    html += '  if (!container) return Promise.resolve();';
    html += '  try {';
    html += '    var binary = atob(entry.data);';
    html += '    var arr = new Uint8Array(binary.length);';
    html += '    for (var i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);';
    html += '    return pdfjsLib.getDocument({ data: arr }).promise.then(function(pdf) {';
    html += '      var promises = [];';
    html += '      for (var p = 1; p <= pdf.numPages; p++) {';
    html += '        promises.push((function(pageNum) {';
    html += '          return pdf.getPage(pageNum).then(function(page) {';
    html += '            var vp1 = page.getViewport({ scale: 1.0 });';
    html += '            var scale = Math.min(MAX_IMG_W / vp1.width, MAX_IMG_H / vp1.height);';
    html += '            var viewport = page.getViewport({ scale: scale });';
    html += '            var canvas = document.createElement("canvas");';
    html += '            canvas.width = Math.round(viewport.width);';
    html += '            canvas.height = Math.round(viewport.height);';
    html += '            var ctx = canvas.getContext("2d");';
    html += '            return page.render({ canvasContext: ctx, viewport: viewport }).promise.then(function() {';
    html += '              return { url: canvas.toDataURL("image/png"), w: canvas.width, h: canvas.height };';
    html += '            });';
    html += '          });';
    html += '        })(p));';
    html += '      }';
    html += '      return Promise.all(promises).then(function(pages) {';
    html += '        var h = "";';
    html += '        pages.forEach(function(pg, i) {';
    html += '          if (i > 0) h += "<div style=\\"height:4px\\"></div>";';
    html += '          h += \'<img src="\' + pg.url + \'" width="\' + pg.w + \'" height="\' + pg.h + \'" alt="PDF page \' + (i+1) + \'" />\';';
    html += '        });';
    html += '        container.innerHTML = h;';
    html += '      });';
    html += '    });';
    html += '  } catch(err) {';
    html += '    console.error("PDF render error:", err);';
    html += '    container.innerHTML = "PDF領収書の変換に失敗しました: " + (entry.idx + 1);';
    html += '    return Promise.resolve();';
    html += '  }';
    html += '}';

    html += 'var chain = Promise.resolve();';
    html += 'pdfEntries.forEach(function(e) {';
    html += '  chain = chain.then(function() { return renderPdf(e); });';
    html += '});';
    html += 'chain.then(function() {';
    html += '  resizeAllImages();';
    html += '  setTimeout(function(){ window.print(); }, 500);';
    html += '}).catch(function(err) {';
    html += '  console.error(err);';
    html += '  resizeAllImages();';
    html += '  setTimeout(function(){ window.print(); }, 500);';
    html += '});';
  } else {
    html += 'resizeAllImages();';
    html += 'setTimeout(function(){ window.print(); }, 500);';
  }

  html += '};';
  html += '<\/script>';
  html += '</body></html>';

  var w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
}
