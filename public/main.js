// public/main.js（XP仕様に合わせたクライアント側処理）
const ws = new WebSocket("ws://localhost:3000");
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  addXpToGauge(data.username, data.avatar, data.xp);
};

function addXpToGauge(username, avatarUrl, xp) {
  updateGaugeStyle(xp);
  const minXp = 5;
  const maxXp = 30;
  const containerHeight = 600;
  const ratio = (xp - minXp) / (maxXp - minXp);
  const y = containerHeight * (1 - ratio);
  const container = document.getElementById("gauge-container");

  // テキストの色だけ設定
  let textColor = "#ccc"; // 初期色（グレー）

  if (xp >= 25) {
    textColor = "#ff2cc4"; // ネオンピンク（XP高）
  } else if (xp >= 20) {
    textColor = "#39ff14"; // ネオグリーン
  } else if (xp >= 15) {
    textColor = "#ffa500"; // オレンジ
  } else {
    textColor = "#eeeeee"; // 明るめグレー（初心者）
  }

  // すでに表示されている場合は更新だけ（再前面化）
  const existing = document.querySelector(`[data-user="${username}"]`);
  if (existing) {
    existing.style.top = `${y}px`;

    // XP数値の方を更新
    const xpEl = existing.querySelector(".xp-value");
    xpEl.textContent = `xp${xp}`;
    xpEl.style.color = textColor;

    // 🔔 bounceを一度削除して再適用してアニメ再発火
    existing.classList.remove("bounce");
    void existing.offsetWidth; // ← 再計算で強制リセット！
    existing.classList.add("bounce");

    // 名前部分はそのままでもOK（変わらないので）
    // 表示順を上に（再追加）
    container.removeChild(existing);
    container.appendChild(existing);
    return;
  }

  // 新しい要素を作成
  const el = document.createElement("div");
  el.className = "viewer";
  el.setAttribute("data-user", username);
  el.style.top = `${y}px`;

  el.innerHTML = `
  <div class="viewer-inner" style="background: rgba(255, 255, 255, 0.1);">
    <div class="xp-value" style="color: ${textColor};">xp${xp}</div>
    <img src="${avatarUrl}" />
    <div class="xp-text">${username}</div>
  </div>
`;

  container.appendChild(el);

  // アニメーション表示
  requestAnimationFrame(() => {
    el.classList.add("show", "bounce"); // ← bounce追加
  });

  // フェードアウト＆削除（必要なら解除）
  // setTimeout(() => {
  //   el.classList.remove('show');
  //   setTimeout(() => el.remove(), 500);
  // }, 10000);
}

const gauge = document.getElementById("gauge-container");

// XPに応じてゲージのクラスを変える
function updateGaugeStyle(xp) {
  gauge.classList.remove("gauge-low", "gauge-mid", "gauge-high");

  if (xp >= 25) {
    gauge.classList.add("gauge-high");
  } else if (xp >= 15) {
    gauge.classList.add("gauge-mid");
  } else {
    gauge.classList.add("gauge-low");
  }
}
