// Copyright © 2017 DWANGO Co., Ltd.

import UIKit
import WebKit

class ViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    var webView: WKWebView = WKWebView()
    var dataBus: CBBDataBus?
    var dataChannel: CBBDataChannel?
    var handlerIds: NSMutableArray?
    
    override func viewDidLoad() {
        super.viewDidLoad()
        handlerIds = NSMutableArray()
        let width = self.view.frame.size.width
        let height = self.view.frame.size.height
        let label = UILabel(frame: CGRect(x: 4, y: 30, width: width - 8, height: 30))
        label.text = "CBBWKWebViewDataBus (native)"
        self.view.addSubview(label)
        
        // ボタンを準備
        self.addButton(frame: CGRect(x: 4, y:70, width: 312, height: 30), title: "Send PUSH to JavaScript", action:#selector(self.sendPush(sender:)))
        self.addButton(frame: CGRect(x: 4, y:110, width: 312, height: 30), title: "Send REQUEST to JavaScript", action:#selector(self.sendRequest(sender:)))
        self.addButton(frame: CGRect(x: 4, y:150, width: 200, height: 30), title: "Destroy", action:#selector(self.destroy(sender:)))
        
        // WKWebViewを準備（※この時点ではまだコンテンツを読み込まない）
        self.webView.frame = CGRect(x: 4, y: height / 2 + 4, width: width - 8, height: height / 2 - 8)
        self.webView.layer.borderWidth = 2.0
        self.webView.layer.borderColor = UIColor.blue.cgColor
        self.webView.layer.cornerRadius = 10.0
        self.webView.navigationDelegate = self
        self.webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        self.webView.uiDelegate = self
        
        // WKWebView　は App bundle のファイルを読めない為, bundleの内容を tmp
        // へコピーしてそこから読み込む
        self.copy(target: "index.html")
        self.copy(target: "script.js")
        self.copy(target: "data-channel.js")
        self.view.addSubview(self.webView)
        
        // CBBDataChannelを準備
        self.dataBus = CBBWKWebViewDataBus(wkWebView: self.webView)
        self.dataChannel = CBBDataChannel(dataBus: self.dataBus!)
        
        // JavaScript側から電文を送信された時のハンドラを設定
        self.dataChannel?.addHandler({ (packet: Any?, callback: CBBDataChannelResponseCallback?) in
            if (nil != callback) {
                // 応答が必要な電文（REQUEST）を受信時の処理
                callback!("Thank you for your REQUEST by Native")
            } else {
                // 応答不要な電文（PUSH）を受信時の処理
                let alert = UIAlertController(title: "Alert from Native", message: NSString.localizedStringWithFormat("Received PUSH\npacket = %@", packet as! CVarArg) as String, preferredStyle: UIAlertControllerStyle.alert)
                let ok = UIAlertAction(title: "OK", style: UIAlertActionStyle.default, handler: { (action) in
                    alert.dismiss(animated: true, completion: nil)
                })
                alert.addAction(ok)
                self.present(alert, animated: true, completion: nil)
            }
        })

        // WKWebView にコンテンツを読み込む（CBBDataBusがインジェクトされる）
        let urlString = NSString.localizedStringWithFormat("file://%@/index.html", self.tmpFolder()) as String
        let url = URL(fileURLWithPath: urlString)
        self.webView.loadFileURL(url, allowingReadAccessTo: url)
    }
    
    func addButton(frame: CGRect, title: String, action: Selector) {
        let b = UIButton(type: UIButtonType.roundedRect)
        b.frame = frame
        b.layer.cornerRadius = 2.0
        b.layer.borderColor = UIColor.blue.cgColor
        b.layer.borderWidth = 1.0
        b.setTitle(title, for: UIControlState.normal)
        b.addTarget(self, action: action, for: UIControlEvents.touchUpInside)
        self.view.addSubview(b)
    }
    
    func sendPush(sender: Any) {
        self.dataChannel?.sendPush("Hello this is native (Swift)")
    }
    
    func sendRequest(sender: Any) {
        self.dataChannel?.sendRequest("GIVE ME RESPONSE!", callback: { (error, packet) in
            let alert = UIAlertController(title: "Alert from Native", message: NSString.localizedStringWithFormat("Received RESPONSE\npacket = %@", packet as! CVarArg) as String, preferredStyle: UIAlertControllerStyle.alert)
            let ok = UIAlertAction(title: "OK", style: UIAlertActionStyle.default, handler: { (action) in
                alert.dismiss(animated: true, completion: nil)
            })
            alert.addAction(ok)
            self.present(alert, animated: true, completion: nil)
        })
    }
    
    func destroy(sender: Any) {
        self.dataBus?.destroy()
    }
    
    func tmpFolder() -> String {
        return NSTemporaryDirectory().appending("www")
    }
    
    // AppBundleの内容はWKWebViewから参照できないのでテンポラリディレクトリにコピーして用いる
    func copy(target: String) {
        let sourceFile = Bundle.main.path(forResource:target, ofType:nil)
        let destFile = self.tmpFolder().appending("/").appending(target)
        let fm = FileManager.default
        if !fm.fileExists(atPath: sourceFile!) {
            return
        }
        if fm.fileExists(atPath: destFile) {
            try! fm.removeItem(atPath: destFile)
        }
        try! fm.createDirectory(atPath: self.tmpFolder(), withIntermediateDirectories: true, attributes: nil)
        try! fm.copyItem(atPath: sourceFile!, toPath: destFile)
    }
    
    // JavaScript側でalertを発行した時の処理
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: "Alert from JS", message: NSString.localizedStringWithFormat("Received message\n%@", message) as String, preferredStyle: UIAlertControllerStyle.alert)
        let ok = UIAlertAction(title: "OK", style: UIAlertActionStyle.default, handler: { (action) in
            alert.dismiss(animated: true, completion: nil)
            completionHandler()
        })
        alert.addAction(ok)
        self.present(alert, animated: true, completion: nil)
    }
    
    override func didReceiveMemoryWarning() {
        super.didReceiveMemoryWarning()
    }
}
