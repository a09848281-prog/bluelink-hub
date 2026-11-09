# BlueLink Hub

Bluetooth Low Energy (BLE) の探索・GATT解析・データ読み書きを行う、GitHub Pages向けのブラウザアプリです。

## 公開方法（GitHub Pages）

1. リポジトリの **Settings** を開く
2. 左メニューの **Pages** を開く
3. **Build and deployment** の Source を **Deploy from a branch** にする
4. Branch を **main**、Folder を **/ (root)** にして Save
5. 数分後、 `https://a09848281-prog.github.io/bluelink-hub/` で公開

## 使い方

1. 対応するブラウザでHTTPSの公開URLを開く
2. 「デバイスを接続」→ ブラウザのBluetooth選択画面で機器を選ぶ
3. 接続後、公開されているGATTサービスとCharacteristicを確認
4. 対応するCharacteristicで読み取り・通知購読・書き込みを実行

独自サービスUUIDが必要な機器は、接続前に「追加でアクセスするサービスUUID」に入力してください。複数はカンマ区切りです。

## 技術・制限事項

- HTML / CSS / JavaScriptのみ。サーバー、GAS、DB、APIキーは不要です。
- Web Bluetooth APIを使用します。HTTPSとユーザー操作、ブラウザの許可が必要です。
- BLE機器がGATTサービスを公開している必要があります。すべてのBluetooth機器に対応するものではありません。
- ブラウザは安全上、ユーザーが選択・許可したデバイスだけにアクセスできます。周囲の機器を無断で一括スキャンする機能ではありません。
- iOS / iPadOS SafariはWeb Bluetoothに対応していないため、iPhone/iPadから直接BLE接続できません。ダッシュボードやログ表示は利用できます。
- 遠隔地にあるBLE機器をインターネット越しに操作するには、対象機器の近くに常時稼働するネットワーク接続ゲートウェイが別途必要です。GitHub Pages単体では遠隔中継できません。
- データはブラウザのlocalStorageに保存されます。端末間同期はありません。

## ファイル

- `index.html` - 画面構造
- `styles.css` - レスポンシブUI
- `app.js` - Web Bluetooth接続・GATT操作・ログ管理

## 安全上の注意

書き込み可能なCharacteristicへの送信は、接続機器の動作に影響する場合があります。機器の仕様を確認し、意味が分かる値だけ送信してください。
