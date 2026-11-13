// config.example.js
// このファイルを config.js にコピーして使用してください（config.js は .gitignore 対象です）。
//   cp config.example.js config.js
//
// GTM_ID に設定した値によって埋め込まれるタグが切り替わります。
//   - "GTM-" から始まる場合 : Google Tag Manager のタグ (gtm.js)
//   - それ以外 (例: "G-...")  : Google Analytics のタグ (gtag.js)
// 未設定（コメントアウト）の場合はトラッキングを行いません。

// Google Tag Manager を使用する場合
// window.GTM_ID = 'GTM-XXXXXXX';

// Google Analytics を使用する場合
// window.GTM_ID = 'G-XXXXXXXXXX';

// 後方互換: GA_TRACKING_ID も利用可能です（GTM_ID が優先されます）
// window.GA_TRACKING_ID = 'G-XXXXXXXXXX';
