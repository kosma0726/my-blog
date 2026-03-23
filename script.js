const FRIENDS_STORAGE_KEY = "beginner-blog-friends";
const DEFAULT_FILTER = "all";

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
  SUPABASE_ANON_KEY === "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtdWhia3R5anNsbGxiZWNyanpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MjE0NTMsImV4cCI6MjA4OTQ5NzQ1M30.nEs7C4FxSBouvS58-qEyrvQBkLD4I3aBtC8GBX-lyFA"
);

const testClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log("testClient:", testClient);
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
    return [];
  }

  try {
    const { data, error } = await supabaseClient
      .from("posts")
      .select("*")
      .order("date", { ascending: false });

    if (error) {
      console.log(error);
      cachedPosts = [];
      return [];
    }

    cachedPosts = Array.isArray(data) ? data : [];
    return cachedPosts;
  } catch (error) {
    console.log(error);
    cachedPosts = [];
    return [];
  }
}

async function insertPost(post) {
  if (!isSupabaseReady()) {
    console.log(new Error("Supabaseの接続情報が未設定のため、投稿できません。"));
    return { ok: false };
  }

  try {
    const { error } = await supabaseClient.from("posts").insert([post]);

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

async function deletePost(postId, currentUser) {
  if (!isSupabaseReady()) {
    console.log(new Error("Supabaseの接続情報が未設定のため、削除できません。"));
    return { ok: false };
  }

  try {
    const { error } = await supabaseClient
      .from("posts")
      .delete()
      .eq("id", postId)
      .eq("author", currentUser);

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

async function updatePostsAuthorName(oldName, newName) {
  if (!isSupabaseReady()) {
    console.log(new Error("Supabaseの接続情報が未設定のため、投稿者名を更新できません。"));
    return;
  }

  try {
    const { error } = await supabaseClient
      .from("posts")
      .update({ author: newName })
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
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "post-card__delete";
    deleteButton.dataset.deletePostId = post.id;
    deleteButton.textContent = "削除";
    header.append(avatar, headingBox, deleteButton);
  } else {
    header.append(avatar, headingBox);
  }

  const summary = document.createElement("p");
  summary.className = "post-card__summary";
  summary.textContent = post.summary;

  const content = document.createElement("div");
  content.className = "post-card__content";
  content.textContent = post.content;

  article.append(header, summary, content);

  return article;
}

async function renderPosts() {
  if (!postList) {
    return;
  }

  const posts = getFilteredPosts(await fetchPosts());
  postList.innerHTML = "";

  if (!posts.length) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.textContent = "条件に合う投稿がまだありません。";
    postList.appendChild(emptyState);
    return;
  }

  posts.forEach((post) => {
    postList.appendChild(createPostCard(post));
  });
}

function renderFilterTabs() {
  filterTabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.filter === currentFilter);
  });
}

function renderFriendList() {
  if (!friendList) {
    return;
  }

  const currentUserName = getCurrentUserName();
  const friends = currentUserName ? getFriendsForUser(currentUserName) : [];
  friendList.innerHTML = "";

  if (!friends.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "まだフレンドがいません。ユーザー名を入れて追加できます。";
    friendList.appendChild(empty);
    return;
  }

  friends.forEach((friendName) => {
    const chip = document.createElement("div");
    chip.className = "friend-chip";

    const name = document.createElement("span");
    name.textContent = friendName;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.textContent = "×";
    removeButton.dataset.friendName = friendName;

    chip.append(name, removeButton);
    friendList.appendChild(chip);
  });
}

function updateAuthUi() {
  if (!composerSection || !logoutButton || !blogForm) {
    return;
  }

  const isLoggedIn = Boolean(currentAuthUser);
  composerSection.classList.toggle("composer--disabled", !isLoggedIn);

  Array.from(blogForm.elements).forEach((element) => {
    element.disabled = !isLoggedIn;
  });

  logoutButton.disabled = !isLoggedIn;

  if (avatarUpdateInput) {
    avatarUpdateInput.disabled = !isLoggedIn;
  }

  if (postMessage && !isLoggedIn) {
    postMessage.textContent = "記事を書くには、先にログインしてください。";
  } else if (postMessage) {
    postMessage.textContent = "";
  }

  renderFilterTabs();
  renderFriendList();
}

async function requireLoginForProtectedPages() {
  const protectedPages = ["index.html", "change-name.html", "change-password.html"];
  const isLoggedIn = Boolean(currentAuthUser);

  if (protectedPages.includes(currentPage) && !isLoggedIn) {
    goToPage("login.html");
    return false;
  }

  if ((currentPage === "login.html" || currentPage === "register.html") && isLoggedIn) {
    goToPage("index.html");
    return false;
  }

  return true;
}

if (registerForm) {
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(registerForm);
    const name = formData.get("registerName")?.toString().trim() || "";
    const email = formData.get("registerEmail")?.toString().trim() || "";
    const password = formData.get("registerPassword")?.toString().trim() || "";
    const avatarFile = formData.get("registerAvatar");

    if (!name || !email || !password) {
      if (authMessage) {
        authMessage.textContent = "名前・メール・パスワードを入力してください。";
      }
      return;
    }

    if (password.length < 6) {
      if (authMessage) {
        authMessage.textContent = "パスワードは6文字以上にしてください。";
      }
      return;
    }

    const avatar = avatarFile instanceof File ? await fileToDataUrl(avatarFile) : "";

    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: name,
          avatar_url: avatar,
        },
      },
    });

    if (error) {
      console.log(error);
      if (authMessage) {
        authMessage.textContent = "登録に失敗しました。";
      }
      return;
    }

    registerForm.reset();

    if (authMessage) {
      authMessage.textContent = "登録できました。";
    }

    if (data.user) {
      await refreshCurrentAuthUser();
      await syncCurrentUserProfile();
      goToPage("index.html");
    }
  });
}

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(loginForm);
    const email = formData.get("loginEmail")?.toString().trim() || "";
    const password = formData.get("loginPassword")?.toString().trim() || "";

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.log(error);
      if (authMessage) {
        authMessage.textContent = "メールアドレスかパスワードが違います。";
      }
      return;
    }

    loginForm.reset();

    if (authMessage) {
      authMessage.textContent = "ログインできました。";
    }

    if (data.user) {
      await refreshCurrentAuthUser();
      goToPage("index.html");
    }
  });
}

if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    try {
      const { error } = await supabaseClient.auth.signOut();

      if (error) {
        console.log(error);
      }
    } catch (error) {
      console.log(error);
    } finally {
      currentAuthUser = null;
      goToPage("login.html");
    }
  });
}

if (avatarUpdateInput) {
  avatarUpdateInput.addEventListener("change", async (event) => {
    const file = event.target.files && event.target.files[0];

    if (!currentAuthUser || !file) {
      return;
    }

    const avatar = await fileToDataUrl(file);

    const { error } = await supabaseClient.auth.updateUser({
      data: {
        display_name: getCurrentUserName(),
        avatar_url: avatar,
      },
    });

    if (error) {
      console.log(error);
      if (postMessage) {
        postMessage.textContent = "アイコン更新に失敗しました。";
      }
      return;
    }

    await refreshCurrentAuthUser();
    await syncCurrentUserProfile();

    if (postMessage) {
      postMessage.textContent = "アイコンを更新しました。";
    }

    await renderPosts();
    avatarUpdateInput.value = "";
  });
}

if (blogForm) {
  blogForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    console.log("投稿ボタン押された");

    try {
      console.log("refresh前");
      await refreshCurrentAuthUser();
      console.log("refresh後", currentAuthUser);

      const currentUserName = getCurrentUserName();
      console.log("currentUserName", currentUserName);

      if (!currentAuthUser || !currentUserName) {
        console.log("ログイン情報なしで停止");
        if (postMessage) {
          postMessage.textContent = "記事を書くには、先にログインしてください。";
        }
        return;
      }

      const formData = new FormData(blogForm);
      const newPost = {
        id: crypto.randomUUID(),
        author: currentUserName,
        avatar: getCurrentUserAvatar(),
        title: formData.get("title")?.toString().trim() || "",
        summary: formData.get("summary")?.toString().trim() || "",
        content: formData.get("content")?.toString().trim() || "",
        date: new Date().toISOString(),
      };

      console.log("newPost", newPost);

      if (!newPost.title || !newPost.summary || !newPost.content) {
        console.log("空欄で停止");
        if (postMessage) {
          postMessage.textContent = "空欄があるので、全部入力してください。";
        }
        return;
      }

      const result = await insertPost(newPost);
      console.log("insert結果", result);

      if (!result.ok) {
        if (postMessage) {
          postMessage.textContent = "投稿の保存に失敗しました。コンソールを確認してください。";
        }
        return;
      }

      await renderPosts();
      blogForm.reset();

      if (postMessage) {
        postMessage.textContent = `${currentUserName} さんの記事を投稿できました。`;
      }
    } catch (error) {
      console.log("submit
