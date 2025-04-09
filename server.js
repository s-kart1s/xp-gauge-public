// server.js（Twitch + YouTube対応 + fallback付き + クォータ検出ログ対応 + XP2桁仕様）
import express from "express";
import { WebSocketServer } from "ws";
import * as ws from "ws";
import tmi from "tmi.js";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import dotenv from "dotenv";
dotenv.config();

// __dirname相当（ESM対応）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 環境変数（トークンやIDを記載）
const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const TWITCH_CHANNEL = process.env.TWITCH_CHANNEL;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID;
const YOUTUBE_VIDEO_ID = process.env.YOUTUBE_VIDEO_ID;
const YOUTUBE_CHAT_ID = process.env.YOUTUBE_CHAT_ID;

let ACCESS_TOKEN = ""; // 自動更新される
// ユーザーキャッシュ：Map<userId, avatarUrl>
const userCache = new Map();

// --- Express & WebSocket Setup ---
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, "public")));

wss.on("connection", (ws) => {
  console.log("✅ WebSocket connected");
});

// Twitch
const twitchClient = new tmi.Client({ channels: [TWITCH_CHANNEL] });
twitchClient.connect();

twitchClient.on("message", async (channel, tags, message, self) => {
  const match = message.match(/xp(\d{2})/i); // 2桁のみ取得
  if (match) {
    let xp = parseInt(match[1]);
    if (xp >= 5 && xp <= 30) {
      const username = tags["display-name"];
      const userId = tags["user-id"];

      const avatar = await getUserProfileImage(userId);
      sendToClients({ username, avatar, xp });
    }
  }
});

// --- Twitch API でプロフィール画像を取得（キャッシュあり）---
async function getUserProfileImage(userId) {
  if (userCache.has(userId)) return userCache.get(userId);
  try {
    const res = await fetch(`https://api.twitch.tv/helix/users?id=${userId}`, {
      headers: {
        "Client-ID": CLIENT_ID,
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
    });

    const json = await res.json();
    const user = json.data?.[0];
    const avatar = user?.profile_image_url || "https://placekitten.com/70/70";
    userCache.set(userId, avatar);
    return avatar;
  } catch (err) {
    console.error("❌ Twitchユーザー画像取得失敗:", err);
    return "https://placekitten.com/70/70";
  }
}

// --- アクセストークンの自動更新 ---
async function refreshAccessToken() {
  const url = "https://id.twitch.tv/oauth2/token";

  const params = new URLSearchParams();
  params.append("client_id", CLIENT_ID);
  params.append("client_secret", CLIENT_SECRET);
  params.append("grant_type", "client_credentials");

  try {
    const res = await fetch(url, { method: "POST", body: params });
    const json = await res.json();
    ACCESS_TOKEN = json.access_token;
    const expiresIn = json.expires_in;
    console.log(`🔑 Twitchトークン取得成功（有効: ${expiresIn}秒）`);
    setTimeout(refreshAccessToken, Math.min(expiresIn * 900, 2147483647));
  } catch (err) {
    console.error("❌ Twitchトークン更新失敗:", err);
    // setTimeout(refreshAccessToken, 10000);
  }
}

let youtubeNextPageToken = null;
let youtubeLiveChatId = null;

async function getLiveChatId() {
  const apiKey = YOUTUBE_API_KEY;
  if (YOUTUBE_VIDEO_ID) {
    try {
      const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${YOUTUBE_VIDEO_ID}&key=${apiKey}`;
      const videoRes = await fetch(videoUrl);
      const json = await videoRes.json();
      if (json.error?.errors?.[0]?.reason === "quotaExceeded") {
        console.error("🚫 YouTube APIクォータ超過（動画ID経由）");
        return null;
      }
      const liveChatId =
        json.items?.[0]?.liveStreamingDetails?.activeLiveChatId;
      if (liveChatId) {
        console.log("✅ 動画IDから liveChatId を取得しました:", liveChatId);
        return liveChatId;
      }
    } catch (err) {
      console.warn("⚠️ 動画IDからの liveChatId 取得エラー:", err);
    }
  }
  if (YOUTUBE_CHANNEL_ID) {
    try {
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=id&channelId=${YOUTUBE_CHANNEL_ID}&eventType=live&type=video&key=${apiKey}`;
      const searchRes = await fetch(searchUrl);
      const searchJson = await searchRes.json();
      const videoId = searchJson.items?.[0]?.id?.videoId;
      if (videoId) {
        const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${videoId}&key=${apiKey}`;
        const videoRes = await fetch(videoUrl);
        const videoJson = await videoRes.json();
        if (videoJson.error?.errors?.[0]?.reason === "quotaExceeded") {
          console.error("🚫 YouTube APIクォータ超過（チャンネル検索経由）");
          return null;
        }
        const liveChatId =
          videoJson.items?.[0]?.liveStreamingDetails?.activeLiveChatId;
        if (liveChatId) {
          console.log(
            "✅ チャンネルから liveChatId を取得しました:",
            liveChatId
          );
          return liveChatId;
        }
      }
    } catch (err) {
      console.warn("⚠️ チャンネルIDからの liveChatId 取得エラー:", err);
    }
  }
  if (YOUTUBE_CHAT_ID) {
    console.log("🔁 fallback: YOUTUBE_CHAT_ID を使用します");
    return YOUTUBE_CHAT_ID;
  }
  console.warn("🛑 liveChatId を取得できませんでした");
  return null;
}

async function startYouTubePolling() {
  youtubeLiveChatId = await getLiveChatId();
  if (!youtubeLiveChatId) return;
  setInterval(fetchYouTubeChat, 5000);
}

async function fetchYouTubeChat() {
  const url = new URL(
    "https://www.googleapis.com/youtube/v3/liveChat/messages"
  );
  url.searchParams.set("liveChatId", youtubeLiveChatId);
  url.searchParams.set("part", "snippet,authorDetails");
  url.searchParams.set("key", YOUTUBE_API_KEY);
  if (youtubeNextPageToken) {
    url.searchParams.set("pageToken", youtubeNextPageToken);
  }

  try {
    const res = await fetch(url);
    const json = await res.json();
    if (json.error?.errors?.[0]?.reason === "quotaExceeded") {
      console.error("🚫 YouTube APIクォータ超過（チャット取得）");
      return;
    }
    youtubeNextPageToken = json.nextPageToken;

    for (const item of json.items) {
      const message = item.snippet.displayMessage;
      const author = item.authorDetails.displayName;
      const avatar = item.authorDetails.profileImageUrl;
      const match = message.match(/xp(\d{2})/i); // 2桁のみ取得
      if (match) {
        let xp = parseInt(match[1]);
        if (xp >= 5 && xp <= 30) {
          sendToClients({ username: author, avatar, xp });
        }
      }
    }
  } catch (err) {
    console.error("❌ YouTubeチャット取得エラー:", err);
  }
}

function sendToClients(data) {
  const payload = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === ws.WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// --- 初期化 ---
const main = async () => {
  await refreshAccessToken();
  await startYouTubePolling();
  server.listen(3000, () => {
    console.log("🚀 サーバーが http://localhost:3000 で起動中");
  });
};

main();
