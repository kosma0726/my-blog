const FRIENDS_STORAGE_KEY = "beginner-blog-friends";
const DEFAULT_FILTER = "all";
const SUPABASE_AUTH_STORAGE_KEY = "sb-lmuhbktyjslllbecrjzj-auth-token";

const SUPABASE_URL = "https://lmuhbktyjslllbecrjzj.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtdWhia3R5anNsbGxiZWNyanpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MjE0NTMsImV4cCI6MjA4OTQ5NzQ1M30.nEs7C4FxSBouvS58-qEyrvQBkLD4I3aBtC8GBX-lyFA";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

console.log("SUPABASE_URL:", SUPABASE_URL);
console.log("SUPABASE_ANON_KEY:", SUPABASE_ANON_KEY);
console.log("URL一致?", SUPABASE_URL === "https://lmuhbktyjslllbecrjzj.supabase.co");
console.log(
  "KEY一致?",
  SUPABASE_ANON_KEY ===
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtdWhia3R5anNsbGxiZWNyanpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MjE0NTMsImV4cCI6MjA4OTQ5NzQ1M30.nEs7C4FxSBouvS58-qEyrvQBkLD4I3aBtC8GBX-lyFA"
);

const registerForm = document.getElementById("register-form");
const loginForm = document.getElementById("login-form");
const blogForm = document.getElementById("blog-form");
const authMessage = document.getElementById("auth-message");
const postMessage = document.getElementById("post-message");
const postList = document.getElementById("post-list");
const friendForm = document.getElementById("friend-form");
const friendList = document.getElementById("friend-list");
const friendMessage = document.getElementById("friend-message");
const filterTabs = document.querySelectorAll(".filter-tab");
const avatarUpdateInput = document.getElementById("avatar-update-input");
const logoutButton = document.getElementById("logout-button");
const composerSection = document.querySelector(".composer");
const changeNameForm = document.getElementById("change-name-form");
const changePasswordForm = document.getElementById("change-password-form");
const accountMessage = document.getElementById("account-message");
const currentNameInput = document.getElementById("current-name");
const currentPage = window.location.pathname.split("/").pop() || "index.html";
const passwordToggleButtons = document.querySelectorAll("[data-password-toggle]");
const protectedPages = ["index.html", "change-name.html", "change-password.html"];

let currentFilter = DEFAULT_FILTER;
let cachedPosts = [];
let currentAuthUser = null;

function loadFriendMap() {
  const saved = localStorage.getItem(FRIENDS_STORAGE_KEY);
  if (!saved) {
    return {};
  }

  try {
    return JSON.parse(saved);
  } catch (error) {
    console.log(error);
    return {};
  }
}

function saveFriendMap(friendMap) {
  localStorage.setItem(FRIENDS_STORAGE_KEY, JSON.stringify(friendMap));
}

function getFriendsForUser(userName) {
  const friendMap = loadFriendMap();
  return Array.isArray(friendMap[userName]) ? friendMap[userName] : [];
}

function setFriendsForUser(userName, friends) {
  const friendMap = loadFriendMap();
  friendMap[userName] = friends;
  saveFriendMap(friendMap);
}

function renameFriendReferences(oldName, newName) {
  const friendMap = loadFriendMap();
  const nextMap = {};

  Object.entries(friendMap).forEach(([owner, friends]) => {
    const nextOwner = owner === oldName ? newName : owner;
    nextMap[nextOwner] = (Array.isArray(friends) ? friends : []).map((friend) =>
      friend === oldName ? newName : friend
    );
  });

  saveFriendMap(nextMap);
}

function goToPage(page) {
  window.location.href = page;
}

function showPageIfReady() {
  document.body.classList.remove("auth-guard");
}

function formatDate(dateText) {
  const date = new Date(dateText);
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getInitial(name) {
  return (name || "?").trim().charAt(0).toUpperCase() || "?";
}

function createAvatarElement(userName, avatar, sizeClass) {
  const avatarBox = document.createElement("div");
  avatarBox.className = `avatar ${sizeClass}`;

  if (avatar) {
    const image = document.createElement("img");
    image.src = avatar;
    image.alt = `${userName} のアイコン`;
    avatarBox.appendChild(image);
  } else {
    avatarBox.textContent = getInitial(userName);
  }

  return avatarBox;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("画像の読み込みに失敗しました。"));
    reader.readAsDataURL(file);
  });
}

function getDisplayNameFromUser(user) {
  if (!user) {
    return "";
  }

  return user.user_metadata?.display_name || user.email || "";
}

function getAvatarFromUser(user) {
  if (!user) {
    return "";
  }

  return user.user_metadata?.avatar_url || "";
}

function getCurrentUserName() {
  return getDisplayNameFromUser(currentAuthUser);
}

function getCurrentUserAvatar() {
  return getAvatarFromUser(currentAuthUser);
}

function getCurrentUserId() {
  return currentAuthUser?.id || "";
}

async function refreshCurrentAuthUser() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    console.log(error);
    currentAuthUser = null;
    return null;
  }

  currentAuthUser = data.session?.user || null;
  return currentAuthUser;
}

async function syncCurrentUserProfile() {
  if (!currentAuthUser) {
    return;
  }

  try {
    const { error } = await supabaseClient.from("profiles").upsert([
      {
        id: currentAuthUser.id,
        display_name: getCurrentUserName(),
        avatar_url: getCurrentUserAvatar(),
        email: currentAuthUser.email || "",
      },
    ]);

    if (error) {
      console.log(error);
    }
  } catch (error) {
    console.log(error);
  }
}

async function findExistingUserByName(displayName) {
  try {
    const { data, error } = await supabaseClient
      .from("profiles")
      .select("id, display_name")
      .eq("display_name", displayName)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.log(error);
      return null;
    }

    return data || null;
  } catch (error) {
    console.log(error);
    return null;
  }
}

function getFilteredPosts(posts) {
  const currentUserName = getCurrentUserName();

  if (!currentUserName) {
    return posts;
  }

  if (currentFilter === "mine") {
    return posts.filter((post) => post.author === currentUserName);
  }

  if (currentFilter === "friends") {
    const allowedAuthors = new Set([
      currentUserName,
      ...getFriendsForUser(currentUserName),
    ]);
    return posts.filter((post) => allowedAuthors.has(post.author));
  }

  return posts;
}

function isSupabaseReady() {
  return Boolean(supabaseClient);
}

async function fetchPosts() {
  if (!isSupabaseReady()) {
    console.log(new Error("Supabaseの接続情報が未設定です。"));
    cachedPosts = [];
    return { ok: false, posts: [] };
  }

  try {
    const { data, error } = await supabaseClient
      .from("posts")
      .select("id, user_id, author, avatar, title, summary, content, date")
      .order("date", { ascending: false })
      .limit(20);

    if (error) {
      console.log(error);
      cachedPosts = [];
      return { ok: false, posts: [] };
    }

    cachedPosts = Array.isArray(data) ? data : [];
    return { ok: true, posts: cachedPosts };
  } catch (error) {
    console.log(error);
    cachedPosts = [];
    return { ok: false, posts: [] };
  }
}

async function insertPost(post) {
  if (!isSupabaseReady()) {
    console.log(new Error("Supabaseの接続情報が未設定のため、投稿できません。"));
    return { ok: false, reason: "not_ready" };
  }

  const { data, error: sessionError } = await supabaseClient.auth.getSession();

  if (sessionError) {
    console.log(sessionError);
    return { ok: false, reason: "session_error" };
  }

  if (!data.session?.user) {
    return { ok: false, reason: "not_authenticated" };
  }

  try {
    const { error } = await supabaseClient.from("posts").insert([post]);

    if (error) {
      console.log(error);
      return { ok: false, reason: "insert_failed" };
    }

    return { ok: true };
  } catch (error) {
    console.log(error);
    return { ok: false, reason: "network_error" };
  }
}

async function deletePost(postId, currentUserId) {
  if (!isSupabaseReady()) {
    console.log(new Error("Supabaseの接続情報が未設定のため、削除できません。"));
    return { ok: false };
  }

  try {
    const { error } = await supabaseClient
      .from("posts")
      .delete()
      .eq("id", postId)
      .eq("user_id", currentUserId);

    if (error) {
      console.log(error);
      return { ok: false };
    }

    return { ok: true };
  } catch (error) {
    console.log(error);
    return { ok: false };
  }
}

async function updatePostsAuthorName(oldName, newName, currentUserId) {
  if (!isSupabaseReady()) {
    console.log(new Error("Supabaseの接続情報が未設定のため、投稿者名を更新できません。"));
    return;
  }

  try {
    const { error } = await supabaseClient
      .from("posts")
      .update({ author: newName })
      .eq("user_id", currentUserId)
      .eq("author", oldName);

    if (error) {
      console.log(error);
    }
  } catch (error) {
    console.log(error);
  }
}

function createPostCard(post) {
  const currentUserName = getCurrentUserName();
  const article = document.createElement("article");
  article.className = "post-card";
  article.dataset.postId = post.id;

  const header = document.createElement("div");
  header.className = "post-card__header";

  const avatar = createAvatarElement(
    post.author,
    post.avatar || "",
    "avatar--small"
  );

  const headingBox = document.createElement("div");
  headingBox.className = "post-card__heading";

  const meta = document.createElement("p");
  meta.className = "post-card__meta";
  meta.textContent = `${formatDate(post.date)} | 投稿者: ${post.author}`;

  const title = document.createElement("h3");
  title.textContent = post.title;

  headingBox.append(title, meta);

  if (currentUserName && post.author === currentUserName) {
    const deleteButton
