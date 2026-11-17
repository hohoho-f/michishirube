// ほほほレポート → スプレッドシート格納 (Google Apps Script)
// 使い方:
// 1. スプレッドシートを新規作成 → 拡張機能 → Apps Script → このコードを貼る
// 2. デプロイ → 新しいデプロイ → 種類「ウェブアプリ」
//    実行ユーザー: 自分 / アクセスできるユーザー: 全員
// 3. 発行されたURLを report.html の「スタッフ用設定 → 送信先URL」に貼る
// 写真は同じGoogleドライブの「歩歩歩_写真」フォルダに保存されます。

const SHEET_NAME = '報告';
const FOLDER_NAME = '歩歩歩_写真';

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName(SHEET_NAME);
    if (!sh) sh = ss.insertSheet(SHEET_NAME);
    if (sh.getLastRow() === 0) {
      sh.appendRow(['受信時刻','記録時刻','記録者','分類(アプリ)','危険度(1-5仮)','緯度','経度','精度m',
                    '写真1(近景)','写真2(遠景)','検品状態','管轄(幹事入力)','フォーム区分(幹事確定)',
                    '状況文(AI下書き→幹事確認)','送信日','備考']);
      sh.setFrozenRows(1);
    }
    const folder = getFolder_();
    const stamp = String(d.ts || new Date().toISOString()).replace(/[:.]/g, '-');
    const url1 = d.p1 ? savePhoto_(folder, d.p1, stamp + '_近景.jpg') : '';
    const url2 = d.p2 ? savePhoto_(folder, d.p2, stamp + '_遠景.jpg') : '';
    sh.appendRow([new Date(), d.ts || '', d.name || '', d.what || '', d.how || '',
                  d.lat || '', d.lng || '', d.acc || '', url1, url2, '未検品', '', '', '', '', '']);
    return ContentService.createTextOutput('ok');
  } catch (err) {
    return ContentService.createTextOutput('error: ' + err);
  }
}

function getFolder_() {
  const it = DriveApp.getFoldersByName(FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
}

function savePhoto_(folder, dataUrl, name) {
  const base64 = String(dataUrl).split(',')[1];
  const blob = Utilities.newBlob(Utilities.base64Decode(base64), 'image/jpeg', name);
  return folder.createFile(blob).getUrl();
}
