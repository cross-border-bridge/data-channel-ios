// Copyright © 2017 DWANGO Co., Ltd.

var dataBus = new CBB.WebViewDataBus(); // DataBus を作成
var dc = require('@cross-border-bridge/data-channel'); // data-channel.js を require して利用できるようにする
var channel = new dc.DataChannel(dataBus); // DataChannel を作成

// ネイティブ側から電文受信時の処理
channel.addHandler(function (packet, callback) {
	if (callback) {
		// callback が undefined ではない場合, REQUEST を受信 (応答を返信しなければならない)
		var text = "received REQUEST from Native: packet=" + packet;
		console.log(text);
		callback.call(this, "THANKS FOR YOUR REQUEST!"); // 応答を返信 (MUST)
	} else {
		// callback が undefined の場合, PUSH を受信
		var text = "received PUSH from Native: packet=" + packet;
		console.log(text);
		alert(text); // 受信した PUSH を alert で表示
	}
});

// 応答を必要としない電文 (PUSH) を送信
function OnSendButtonClick1() {
	console.log("button clicked: send push");
	channel.send("PUSH-FROM-JS (DO NOT REPLY)");
}

// 応答を必要とする電文 (REQUEST) を送信
function OnSendButtonClick2() {
	console.log("button clicked: send request");
	channel.send("REQUEST-FROM-JS (NEED REPLY)", function (error, packet) {
		if (error) {
			var text = "an error occurred: " + error;
			console.log(text);
			alert(text); // 受信したエラーを alert で表示
		} else {
			var text = "received result from Native: packet=" + packet;
			console.log(text);
			alert(text); // 受信した応答を alert で表示
		}
	});
}

// 破棄
function OnDestroyButtonClick() {
	console.log("button clicked: destroy");
	channel.destroy();
	dataBus.destroy();
}
