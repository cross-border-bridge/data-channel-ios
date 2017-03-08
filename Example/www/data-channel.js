require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Copyright © 2017 DWANGO Co., Ltd.
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
/**
 * データ種別コード
 */
var DATA_TYPE_PUSH = 1;
var DATA_TYPE_REQUEST = 2;
var DATA_TYPE_RESPONSE = 3;
var DATA_TYPE_ERROR = 4;
/**
 * DataChannel内部エラー
 */
var DataChannelError = (function (_super) {
    __extends(DataChannelError, _super);
    function DataChannelError() {
        _super.apply(this, arguments);
    }
    return DataChannelError;
})(Error);
exports.DataChannelError = DataChannelError;
/**
 * DataBus上で単純なリクエスト＆レスポンス機構を提供する。
 */
var DataChannel = (function () {
    function DataChannel(dataBus) {
        this._handler = undefined;
        this._handlers = [];
        this._tagCount = 0;
        this._waitingCallbacks = {};
        this._timeoutObjects = {};
        this._dataBus = dataBus;
    }
    /**
     * DataChannelを破棄する際に実行する。
     * このメソッドを実行するとすべてのハンドラが解放され、レスポンス待ちの処理についてはエラーが返る。
     */
    DataChannel.prototype.destroy = function () {
        var _this = this;
        if (!this._dataBus)
            return;
        this.unregister();
        this._dataBus = undefined;
        this._handlers = undefined;
        Object.keys(this._waitingCallbacks).forEach(function (tag) {
            var error = new Error("plugin channel destroyed.");
            error.type = "Closed";
            _this.processCallback(tag, error);
        });
        this._waitingCallbacks = undefined;
    };
    /**
     * このDataChannelが既に破棄されたかどうかを返す
     *
     * @return 破棄されていればtrue、されていなければfalse
     */
    DataChannel.prototype.destroyed = function () {
        return !this._dataBus;
    };
    /**
     * メッセージハンドラの登録を行う
     *
     * @param handler メッセージ受信時に実行されるハンドラ
     * @return ハンドラID
     */
    DataChannel.prototype.addHandler = function (handler) {
        if (!Object.keys(this._handlers).length) {
            this.register();
        }
        if (this._handlers.indexOf(handler) === -1) {
            this._handlers.push(handler);
        }
    };
    /**
     * メッセージハンドラの解除を行う
     *
     * @param handlerId ハンドラ登録時に取得したハンドラID
     */
    DataChannel.prototype.removeHandler = function (handler) {
        this._handlers = this._handlers.filter(function (h) { return h !== handler; });
        if (!Object.keys(this._handlers).length) {
            this.unregister();
        }
    };
    /**
     * 登録されているすべてのメッセージハンドラの解除を行う
     */
    DataChannel.prototype.removeAllHandlers = function () {
        if (!Object.keys(this._handlers).length)
            return;
        this._handlers = [];
        this.unregister();
    };
    /**
     * メッセージの送信を行う。
     *
     * @param packet メッセージの実データ。フォーマットによって内容は自由に定義できる
     * @param callback メッセージに対してのレスポンスを受け取るコールバック。任意指定
     * @param timeout レスポンスを待つ待機時間。待機時間を過ぎるとcallbackにtimeoutエラーが返る。未指定時はタイムアウトしない。
     */
    DataChannel.prototype.send = function (packet, callback, timeout) {
        var _this = this;
        if (timeout === void 0) { timeout = 0; }
        if (callback) {
            this.register();
            var tag = this.acquireTag();
            if (0 < timeout) {
                var timeoutObject = setTimeout(function () {
                    var error = new Error("send timeout.");
                    error.type = "Timeout";
                    _this.processCallback(tag, error);
                }, timeout);
                this._timeoutObjects[tag] = timeoutObject;
            }
            this._waitingCallbacks[tag] = callback;
            this._dataBus.send(DATA_TYPE_REQUEST, [tag, packet]);
        }
        else {
            this._dataBus.send(DATA_TYPE_PUSH, [packet]);
        }
    };
    DataChannel.prototype.register = function () {
        var _this = this;
        if (this._handler)
            return;
        this._handler = function (dataType, data) {
            switch (dataType) {
                case DATA_TYPE_ERROR: {
                    var error = new DataChannelError();
                    error.type = data[1];
                    _this.processCallback(data[0], error);
                    return;
                }
                case DATA_TYPE_RESPONSE:
                    _this.processCallback(data[0], null, data[1]);
                    return;
                case DATA_TYPE_PUSH:
                    _this._handlers.forEach(function (handler) {
                        handler(data[0]);
                    });
                    return;
                case DATA_TYPE_REQUEST: {
                    var responseCallback = function (rpacket) {
                        _this._dataBus.send(DATA_TYPE_RESPONSE, [data[0], rpacket]);
                    };
                    _this._handlers.forEach(function (handler) {
                        handler(data[1], responseCallback);
                    });
                    return;
                }
            }
        };
        this._dataBus.addHandler(this._handler);
    };
    DataChannel.prototype.unregister = function () {
        if (!this._handler)
            return;
        this._dataBus.removeHandler(this._handler);
        this._handler = undefined;
    };
    DataChannel.prototype.processCallback = function (targetTag, error, packet) {
        var callback = this._waitingCallbacks[targetTag];
        if (callback) {
            delete this._waitingCallbacks[targetTag];
            delete this._timeoutObjects[targetTag];
            callback(error, packet);
            return true;
        }
        return false;
    };
    DataChannel.prototype.acquireTag = function () {
        return "c:" + ++this._tagCount;
    };
    return DataChannel;
})();
exports.DataChannel = DataChannel;

},{}],"@cross-border-bridge/data-channel":[function(require,module,exports){
// Copyright © 2017 DWANGO Co., Ltd.
var DataChannel_1 = require('./DataChannel');
exports.DataChannel = DataChannel_1.DataChannel;
exports.DataChannelError = DataChannel_1.DataChannelError;

},{"./DataChannel":1}]},{},[])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJsaWIvRGF0YUNoYW5uZWwuanMiLCJsaWIvaW5kZXguanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkxBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLy8gQ29weXJpZ2h0IMKpIDIwMTcgRFdBTkdPIENvLiwgTHRkLlxudmFyIF9fZXh0ZW5kcyA9ICh0aGlzICYmIHRoaXMuX19leHRlbmRzKSB8fCBmdW5jdGlvbiAoZCwgYikge1xuICAgIGZvciAodmFyIHAgaW4gYikgaWYgKGIuaGFzT3duUHJvcGVydHkocCkpIGRbcF0gPSBiW3BdO1xuICAgIGZ1bmN0aW9uIF9fKCkgeyB0aGlzLmNvbnN0cnVjdG9yID0gZDsgfVxuICAgIGQucHJvdG90eXBlID0gYiA9PT0gbnVsbCA/IE9iamVjdC5jcmVhdGUoYikgOiAoX18ucHJvdG90eXBlID0gYi5wcm90b3R5cGUsIG5ldyBfXygpKTtcbn07XG4vKipcbiAqIOODh+ODvOOCv+eoruWIpeOCs+ODvOODiVxuICovXG52YXIgREFUQV9UWVBFX1BVU0ggPSAxO1xudmFyIERBVEFfVFlQRV9SRVFVRVNUID0gMjtcbnZhciBEQVRBX1RZUEVfUkVTUE9OU0UgPSAzO1xudmFyIERBVEFfVFlQRV9FUlJPUiA9IDQ7XG4vKipcbiAqIERhdGFDaGFubmVs5YaF6YOo44Ko44Op44O8XG4gKi9cbnZhciBEYXRhQ2hhbm5lbEVycm9yID0gKGZ1bmN0aW9uIChfc3VwZXIpIHtcbiAgICBfX2V4dGVuZHMoRGF0YUNoYW5uZWxFcnJvciwgX3N1cGVyKTtcbiAgICBmdW5jdGlvbiBEYXRhQ2hhbm5lbEVycm9yKCkge1xuICAgICAgICBfc3VwZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gICAgcmV0dXJuIERhdGFDaGFubmVsRXJyb3I7XG59KShFcnJvcik7XG5leHBvcnRzLkRhdGFDaGFubmVsRXJyb3IgPSBEYXRhQ2hhbm5lbEVycm9yO1xuLyoqXG4gKiBEYXRhQnVz5LiK44Gn5Y2Y57SU44Gq44Oq44Kv44Ko44K544OI77yG44Os44K544Od44Oz44K55qmf5qeL44KS5o+Q5L6b44GZ44KL44CCXG4gKi9cbnZhciBEYXRhQ2hhbm5lbCA9IChmdW5jdGlvbiAoKSB7XG4gICAgZnVuY3Rpb24gRGF0YUNoYW5uZWwoZGF0YUJ1cykge1xuICAgICAgICB0aGlzLl9oYW5kbGVyID0gdW5kZWZpbmVkO1xuICAgICAgICB0aGlzLl9oYW5kbGVycyA9IFtdO1xuICAgICAgICB0aGlzLl90YWdDb3VudCA9IDA7XG4gICAgICAgIHRoaXMuX3dhaXRpbmdDYWxsYmFja3MgPSB7fTtcbiAgICAgICAgdGhpcy5fdGltZW91dE9iamVjdHMgPSB7fTtcbiAgICAgICAgdGhpcy5fZGF0YUJ1cyA9IGRhdGFCdXM7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIERhdGFDaGFubmVs44KS56C05qOE44GZ44KL6Zqb44Gr5a6f6KGM44GZ44KL44CCXG4gICAgICog44GT44Gu44Oh44K944OD44OJ44KS5a6f6KGM44GZ44KL44Go44GZ44G544Gm44Gu44OP44Oz44OJ44Op44GM6Kej5pS+44GV44KM44CB44Os44K544Od44Oz44K55b6F44Gh44Gu5Yem55CG44Gr44Gk44GE44Gm44Gv44Ko44Op44O844GM6L+U44KL44CCXG4gICAgICovXG4gICAgRGF0YUNoYW5uZWwucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XG4gICAgICAgIGlmICghdGhpcy5fZGF0YUJ1cylcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgdGhpcy51bnJlZ2lzdGVyKCk7XG4gICAgICAgIHRoaXMuX2RhdGFCdXMgPSB1bmRlZmluZWQ7XG4gICAgICAgIHRoaXMuX2hhbmRsZXJzID0gdW5kZWZpbmVkO1xuICAgICAgICBPYmplY3Qua2V5cyh0aGlzLl93YWl0aW5nQ2FsbGJhY2tzKS5mb3JFYWNoKGZ1bmN0aW9uICh0YWcpIHtcbiAgICAgICAgICAgIHZhciBlcnJvciA9IG5ldyBFcnJvcihcInBsdWdpbiBjaGFubmVsIGRlc3Ryb3llZC5cIik7XG4gICAgICAgICAgICBlcnJvci50eXBlID0gXCJDbG9zZWRcIjtcbiAgICAgICAgICAgIF90aGlzLnByb2Nlc3NDYWxsYmFjayh0YWcsIGVycm9yKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX3dhaXRpbmdDYWxsYmFja3MgPSB1bmRlZmluZWQ7XG4gICAgfTtcbiAgICAvKipcbiAgICAgKiDjgZPjga5EYXRhQ2hhbm5lbOOBjOaXouOBq+egtOajhOOBleOCjOOBn+OBi+OBqeOBhuOBi+OCkui/lOOBmVxuICAgICAqXG4gICAgICogQHJldHVybiDnoLTmo4TjgZXjgozjgabjgYTjgozjgbB0cnVl44CB44GV44KM44Gm44GE44Gq44GR44KM44GwZmFsc2VcbiAgICAgKi9cbiAgICBEYXRhQ2hhbm5lbC5wcm90b3R5cGUuZGVzdHJveWVkID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gIXRoaXMuX2RhdGFCdXM7XG4gICAgfTtcbiAgICAvKipcbiAgICAgKiDjg6Hjg4Pjgrvjg7zjgrjjg4/jg7Pjg4njg6njga7nmbvpjLLjgpLooYzjgYZcbiAgICAgKlxuICAgICAqIEBwYXJhbSBoYW5kbGVyIOODoeODg+OCu+ODvOOCuOWPl+S/oeaZguOBq+Wun+ihjOOBleOCjOOCi+ODj+ODs+ODieODqVxuICAgICAqIEByZXR1cm4g44OP44Oz44OJ44OpSURcbiAgICAgKi9cbiAgICBEYXRhQ2hhbm5lbC5wcm90b3R5cGUuYWRkSGFuZGxlciA9IGZ1bmN0aW9uIChoYW5kbGVyKSB7XG4gICAgICAgIGlmICghT2JqZWN0LmtleXModGhpcy5faGFuZGxlcnMpLmxlbmd0aCkge1xuICAgICAgICAgICAgdGhpcy5yZWdpc3RlcigpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLl9oYW5kbGVycy5pbmRleE9mKGhhbmRsZXIpID09PSAtMSkge1xuICAgICAgICAgICAgdGhpcy5faGFuZGxlcnMucHVzaChoYW5kbGVyKTtcbiAgICAgICAgfVxuICAgIH07XG4gICAgLyoqXG4gICAgICog44Oh44OD44K744O844K444OP44Oz44OJ44Op44Gu6Kej6Zmk44KS6KGM44GGXG4gICAgICpcbiAgICAgKiBAcGFyYW0gaGFuZGxlcklkIOODj+ODs+ODieODqeeZu+mMsuaZguOBq+WPluW+l+OBl+OBn+ODj+ODs+ODieODqUlEXG4gICAgICovXG4gICAgRGF0YUNoYW5uZWwucHJvdG90eXBlLnJlbW92ZUhhbmRsZXIgPSBmdW5jdGlvbiAoaGFuZGxlcikge1xuICAgICAgICB0aGlzLl9oYW5kbGVycyA9IHRoaXMuX2hhbmRsZXJzLmZpbHRlcihmdW5jdGlvbiAoaCkgeyByZXR1cm4gaCAhPT0gaGFuZGxlcjsgfSk7XG4gICAgICAgIGlmICghT2JqZWN0LmtleXModGhpcy5faGFuZGxlcnMpLmxlbmd0aCkge1xuICAgICAgICAgICAgdGhpcy51bnJlZ2lzdGVyKCk7XG4gICAgICAgIH1cbiAgICB9O1xuICAgIC8qKlxuICAgICAqIOeZu+mMsuOBleOCjOOBpuOBhOOCi+OBmeOBueOBpuOBruODoeODg+OCu+ODvOOCuOODj+ODs+ODieODqeOBruino+mZpOOCkuihjOOBhlxuICAgICAqL1xuICAgIERhdGFDaGFubmVsLnByb3RvdHlwZS5yZW1vdmVBbGxIYW5kbGVycyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKCFPYmplY3Qua2V5cyh0aGlzLl9oYW5kbGVycykubGVuZ3RoKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB0aGlzLl9oYW5kbGVycyA9IFtdO1xuICAgICAgICB0aGlzLnVucmVnaXN0ZXIoKTtcbiAgICB9O1xuICAgIC8qKlxuICAgICAqIOODoeODg+OCu+ODvOOCuOOBrumAgeS/oeOCkuihjOOBhuOAglxuICAgICAqXG4gICAgICogQHBhcmFtIHBhY2tldCDjg6Hjg4Pjgrvjg7zjgrjjga7lrp/jg4fjg7zjgr/jgILjg5Xjgqnjg7zjg57jg4Pjg4jjgavjgojjgaPjgablhoXlrrnjga/oh6rnlLHjgavlrprnvqnjgafjgY3jgotcbiAgICAgKiBAcGFyYW0gY2FsbGJhY2sg44Oh44OD44K744O844K444Gr5a++44GX44Gm44Gu44Os44K544Od44Oz44K544KS5Y+X44GR5Y+W44KL44Kz44O844Or44OQ44OD44Kv44CC5Lu75oSP5oyH5a6aXG4gICAgICogQHBhcmFtIHRpbWVvdXQg44Os44K544Od44Oz44K544KS5b6F44Gk5b6F5qmf5pmC6ZaT44CC5b6F5qmf5pmC6ZaT44KS6YGO44GO44KL44GoY2FsbGJhY2vjgat0aW1lb3V044Ko44Op44O844GM6L+U44KL44CC5pyq5oyH5a6a5pmC44Gv44K/44Kk44Og44Ki44Km44OI44GX44Gq44GE44CCXG4gICAgICovXG4gICAgRGF0YUNoYW5uZWwucHJvdG90eXBlLnNlbmQgPSBmdW5jdGlvbiAocGFja2V0LCBjYWxsYmFjaywgdGltZW91dCkge1xuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xuICAgICAgICBpZiAodGltZW91dCA9PT0gdm9pZCAwKSB7IHRpbWVvdXQgPSAwOyB9XG4gICAgICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgICAgICAgdGhpcy5yZWdpc3RlcigpO1xuICAgICAgICAgICAgdmFyIHRhZyA9IHRoaXMuYWNxdWlyZVRhZygpO1xuICAgICAgICAgICAgaWYgKDAgPCB0aW1lb3V0KSB7XG4gICAgICAgICAgICAgICAgdmFyIHRpbWVvdXRPYmplY3QgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGVycm9yID0gbmV3IEVycm9yKFwic2VuZCB0aW1lb3V0LlwiKTtcbiAgICAgICAgICAgICAgICAgICAgZXJyb3IudHlwZSA9IFwiVGltZW91dFwiO1xuICAgICAgICAgICAgICAgICAgICBfdGhpcy5wcm9jZXNzQ2FsbGJhY2sodGFnLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgfSwgdGltZW91dCk7XG4gICAgICAgICAgICAgICAgdGhpcy5fdGltZW91dE9iamVjdHNbdGFnXSA9IHRpbWVvdXRPYmplY3Q7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl93YWl0aW5nQ2FsbGJhY2tzW3RhZ10gPSBjYWxsYmFjaztcbiAgICAgICAgICAgIHRoaXMuX2RhdGFCdXMuc2VuZChEQVRBX1RZUEVfUkVRVUVTVCwgW3RhZywgcGFja2V0XSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9kYXRhQnVzLnNlbmQoREFUQV9UWVBFX1BVU0gsIFtwYWNrZXRdKTtcbiAgICAgICAgfVxuICAgIH07XG4gICAgRGF0YUNoYW5uZWwucHJvdG90eXBlLnJlZ2lzdGVyID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xuICAgICAgICBpZiAodGhpcy5faGFuZGxlcilcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgdGhpcy5faGFuZGxlciA9IGZ1bmN0aW9uIChkYXRhVHlwZSwgZGF0YSkge1xuICAgICAgICAgICAgc3dpdGNoIChkYXRhVHlwZSkge1xuICAgICAgICAgICAgICAgIGNhc2UgREFUQV9UWVBFX0VSUk9SOiB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBlcnJvciA9IG5ldyBEYXRhQ2hhbm5lbEVycm9yKCk7XG4gICAgICAgICAgICAgICAgICAgIGVycm9yLnR5cGUgPSBkYXRhWzFdO1xuICAgICAgICAgICAgICAgICAgICBfdGhpcy5wcm9jZXNzQ2FsbGJhY2soZGF0YVswXSwgZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhc2UgREFUQV9UWVBFX1JFU1BPTlNFOlxuICAgICAgICAgICAgICAgICAgICBfdGhpcy5wcm9jZXNzQ2FsbGJhY2soZGF0YVswXSwgbnVsbCwgZGF0YVsxXSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICBjYXNlIERBVEFfVFlQRV9QVVNIOlxuICAgICAgICAgICAgICAgICAgICBfdGhpcy5faGFuZGxlcnMuZm9yRWFjaChmdW5jdGlvbiAoaGFuZGxlcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgaGFuZGxlcihkYXRhWzBdKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICBjYXNlIERBVEFfVFlQRV9SRVFVRVNUOiB7XG4gICAgICAgICAgICAgICAgICAgIHZhciByZXNwb25zZUNhbGxiYWNrID0gZnVuY3Rpb24gKHJwYWNrZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIF90aGlzLl9kYXRhQnVzLnNlbmQoREFUQV9UWVBFX1JFU1BPTlNFLCBbZGF0YVswXSwgcnBhY2tldF0pO1xuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICBfdGhpcy5faGFuZGxlcnMuZm9yRWFjaChmdW5jdGlvbiAoaGFuZGxlcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgaGFuZGxlcihkYXRhWzFdLCByZXNwb25zZUNhbGxiYWNrKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuX2RhdGFCdXMuYWRkSGFuZGxlcih0aGlzLl9oYW5kbGVyKTtcbiAgICB9O1xuICAgIERhdGFDaGFubmVsLnByb3RvdHlwZS51bnJlZ2lzdGVyID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoIXRoaXMuX2hhbmRsZXIpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIHRoaXMuX2RhdGFCdXMucmVtb3ZlSGFuZGxlcih0aGlzLl9oYW5kbGVyKTtcbiAgICAgICAgdGhpcy5faGFuZGxlciA9IHVuZGVmaW5lZDtcbiAgICB9O1xuICAgIERhdGFDaGFubmVsLnByb3RvdHlwZS5wcm9jZXNzQ2FsbGJhY2sgPSBmdW5jdGlvbiAodGFyZ2V0VGFnLCBlcnJvciwgcGFja2V0KSB7XG4gICAgICAgIHZhciBjYWxsYmFjayA9IHRoaXMuX3dhaXRpbmdDYWxsYmFja3NbdGFyZ2V0VGFnXTtcbiAgICAgICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fd2FpdGluZ0NhbGxiYWNrc1t0YXJnZXRUYWddO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX3RpbWVvdXRPYmplY3RzW3RhcmdldFRhZ107XG4gICAgICAgICAgICBjYWxsYmFjayhlcnJvciwgcGFja2V0KTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9O1xuICAgIERhdGFDaGFubmVsLnByb3RvdHlwZS5hY3F1aXJlVGFnID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gXCJjOlwiICsgKyt0aGlzLl90YWdDb3VudDtcbiAgICB9O1xuICAgIHJldHVybiBEYXRhQ2hhbm5lbDtcbn0pKCk7XG5leHBvcnRzLkRhdGFDaGFubmVsID0gRGF0YUNoYW5uZWw7XG4iLCIvLyBDb3B5cmlnaHQgwqkgMjAxNyBEV0FOR08gQ28uLCBMdGQuXG52YXIgRGF0YUNoYW5uZWxfMSA9IHJlcXVpcmUoJy4vRGF0YUNoYW5uZWwnKTtcbmV4cG9ydHMuRGF0YUNoYW5uZWwgPSBEYXRhQ2hhbm5lbF8xLkRhdGFDaGFubmVsO1xuZXhwb3J0cy5EYXRhQ2hhbm5lbEVycm9yID0gRGF0YUNoYW5uZWxfMS5EYXRhQ2hhbm5lbEVycm9yO1xuIl19
