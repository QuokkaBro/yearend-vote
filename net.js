// 전달 통로. 기본은 ntfy.sh, 주소 끝에 ?local=1 이면 같은 브라우저 안에서만(시험용).
(function () {
  var LOCAL = /[?&]local=1/.test(location.search);
  var BASE = "https://ntfy.sh/";

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // 보내기: 실패하면 1·2·4·8초 쉬고 다시. onState로 화면에 상태를 알려요.
  async function send(topic, obj, onState) {
    var body = JSON.stringify(obj);
    if (LOCAL) {
      var ch = new BroadcastChannel("lpv-" + topic);
      ch.postMessage(body); ch.close();
      if (onState) onState("ok");
      return true;
    }
    var wait = 1000;
    for (var i = 0; i < 6; i++) {
      try {
        var r = await fetch(BASE + topic, { method: "POST", body: body });
        if (r.ok) { if (onState) onState("ok"); return true; }
      } catch (e) { /* 다시 시도 */ }
      if (onState) onState("retry");
      await sleep(wait); wait = Math.min(wait * 2, 8000);
    }
    if (onState) onState("fail");
    return false;
  }

  // 받기: since = 유닉스 초 또는 "6h" 같은 기간. 끊기면 EventSource가 스스로 다시 붙어요.
  function listen(topic, since, onMsg, onConn) {
    if (LOCAL) {
      var ch = new BroadcastChannel("lpv-" + topic);
      ch.onmessage = function (e) { try { onMsg(JSON.parse(e.data)); } catch (x) {} };
      if (onConn) onConn(true);
      return { close: function () { ch.close(); } };
    }
    var seen = {};
    var es = new EventSource(BASE + topic + "/sse?since=" + since);
    es.onopen = function () { if (onConn) onConn(true); };
    es.onerror = function () { if (onConn) onConn(false); };
    es.onmessage = function (e) {
      try {
        var m = JSON.parse(e.data);
        if (m.event !== "message" || seen[m.id]) return;
        seen[m.id] = 1;
        onMsg(JSON.parse(m.message));
      } catch (x) {}
    };
    return { close: function () { es.close(); } };
  }

  window.NET = { send: send, listen: listen, LOCAL: LOCAL };
})();
