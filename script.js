const FRIENDS_STORAGE_KEY = "beginner-blog-friends";
const DEFAULT_FILTER = "all";
const SUPABASE_AUTH_STORAGE_KEY = "sb-lmuhbktyjslllbecrjzj-auth-token";

const SUPABASE_URL = "https://lmuhbktyjslllbecrjzj.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtdWhia3R5anNsbGxiZWNyanpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MjE0NTMsImV4cCI6MjA4OTQ5NzQ1M30.nEs7C4FxSBouvS58-qEyrvQBkLD4I3aBtC8GBX-lyFA";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage,
    },
  }
);

console.log("SUPABASE_URL:", SUPABASE_URL);
console.log("SUPABASE_ANON_KEY:", SUPABASE_ANON_KEY);
console.log("URL一致?", SUPABASE_URL === "https://lmuhbktyjslllbecrjzj.supabase.co");
console.log(
  "KEY一致?",
  SUPABASE_ANON_KEY ===
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtdWhia3R5anNsbGxiZWNyanpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MjE0NTMsImV4cCI6MjA4OTQ5NzQ1M30.nEs7C4FxSBouvS58-qEyrvQBkLD4I3aBtC8GBX-lyFA"
);
console.log("AUTH_STORAGE_KEY:", SUPABASE_AUTH_STORAGE_KEY);

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

function logAuthSnapshot(context, session = null) {
  const resolvedSession = session || null;
  console.log(`[${context}] auth snapshot`, {
    hasSession: Boolean(resolvedSession),
    userId: resolvedSession?.user?.id || currentAuthUser?.id || null,
    currentAuthUserId: currentAuthUser?.id || null,
  });
}

async function getActiveSession(context) {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    console.error(`[${context}] getSession failed`, error);
    currentAuthUser = null;
    return null;
  }

  currentAuthUser = data.session?.user || null;
  logAuthSnapshot(context, data.session || null);
  return data.session || null;
}

async function requireAuthenticatedUser(context) {
  const session = await getActiveSession(context);

  if (!session?.user?.id) {
    console.error(`[${context}] authenticated user not found`);
    currentAuthUser = null;
    return null;
  }

  currentAuthUser = session.user;
  return session.user;
}

function loadFriendMap() {
  const saved = localStorage.getItem(FRIENDS_STORAGE_KEY);
  if (!saved) {
    return {};
  }

  try {
    return JSON.parse(saved);
  } catch (error) {
    console.error("[loadFriendMap] parse failed", error);
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
  const session = await getActiveSession("refreshCurrentAuthUser");
  currentAuthUser = session?.user || null;
  return currentAuthUser;
}

async function syncCurrentUserProfile() {
  const user = await requireAuthenticatedUser("syncCurrentUserProfile");

  if (!user) {
    return { ok: false };
  }

  try {
    const { error } = await supabaseClient.from("profiles").upsert([
      {
        id: user.id,
        display_name: getDisplayNameFromUser(user),
        avatar_url: getAvatarFromUser(user),
        email: user.email || "",
      },
    ]);

    if (error) {
      console.error("[syncCurrentUserProfile] upsert failed", error);
      return { ok: false };
    }

    return { ok: true };
  } catch (error) {
    console.error("[syncCurrentUserProfile] request failed", error);
    return { ok: false };
  }
}

async function findExistingUserByName(displayName) {
  await getActiveSession("findExistingUserByName");

  try {
    const { data, error } = await supabaseClient
      .from("profiles")
      .select("id, display_name")
      .eq("display_name", displayName)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[findExistingUserByName] select failed", error);
      return null;
    }

    return data || null;
  } catch (error) {
    console.error("[findExistingUserByName] request failed", error);
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
    console.error("[fetchPosts] Supabase client is not ready");
    cachedPosts = [];
    return { ok: false, posts: [] };
  }

  await getActiveSession("fetchPosts");

  try {
    const { data, error } = await supabaseClient
      .from("posts")
      .select("id, user_id, author, avatar, title, summary, content, date")
      .order("date", { ascending: false })
      .limit(20);

    if (error) {
      console.error("[fetchPosts] select failed", error);
      cachedPosts = [];
      return { ok: false, posts: [] };
    }

    cachedPosts = Array.isArray(data) ? data : [];
    return { ok: true, posts: cachedPosts };
  } catch (error) {
    console.error("[fetchPosts] request failed", error);
    cachedPosts = [];
    return { ok: false, posts: [] };
  }
}

async function insertPost(post) {
  if (!isSupabaseReady()) {
    console.error("[insertPost] Supabase client is not ready");
    return { ok: false, reason: "not_ready" };
  }

  const user = await requireAuthenticatedUser("insertPost");

  if (!user?.id) {
    return { ok: false, reason: "not_authenticated" };
  }

  try {
    const { data, error } = await supabaseClient
      .from("posts")
      .insert([post])
      .select("id, user_id")
      .single();

    if (error) {
      console.error("[insertPost] insert failed", error);
      return { ok: false, reason: "insert_failed" };
    }

    if (!data?.id) {
      console.error("[insertPost] inserted row not returned", data);
      return { ok: false, reason: "insert_not_confirmed" };
    }

    return { ok: true };
  } catch (error) {
    console.error("[insertPost] request failed", error);
    return { ok: false, reason: "network_error" };
  }
}

async function deletePost(postId, currentUserId) {
  if (!isSupabaseReady()) {
    console.error("[deletePost] Supabase client is not ready");
    return { ok: false, reason: "not_ready" };
  }

  const user = await requireAuthenticatedUser("deletePost");

  if (!user?.id || user.id !== currentUserId) {
    console.error("[deletePost] authenticated user mismatch", {
      currentUserId,
      sessionUserId: user?.id || null,
    });
    return { ok: false, reason: "not_authenticated" };
  }

  try {
    const { data, error } = await supabaseClient
      .from("posts")
      .delete()
      .eq("id", postId)
      .eq("user_id", currentUserId)
      .select("id");

    if (error) {
      console.error("[deletePost] delete failed", error);
      return { ok: false, reason: "delete_failed" };
    }

    if (!Array.isArray(data) || data.length === 0) {
      console.error("[deletePost] row was not deleted", {
        postId,
        currentUserId,
        data,
      });
      return { ok: false, reason: "not_deleted" };
    }

    return { ok: true };
  } catch (error) {
    console.error("[deletePost] request failed", error);
    return { ok: false, reason: "network_error" };
  }
}

async function updatePostsAuthorName(oldName, newName, currentUserId) {
  if (!isSupabaseReady()) {
    console.error("[updatePostsAuthorName] Supabase client is not ready");
    return;
  }

  const user = await requireAuthenticatedUser("updatePostsAuthorName");

  if (!user?.id || user.id !== currentUserId) {
    console.error("[updatePostsAuthorName] authenticated user mismatch", {
      currentUserId,
      sessionUserId: user?.id || null,
    });
    return;
  }

  try {
    const { error } = await supabaseClient
      .from("posts")
      .update({ author: newName })
      .eq("user_id", currentUserId)
      .eq("author", oldName);

    if (error) {
      console.error("[updatePostsAuthorName] update failed", error);
    }
  } catch (error) {
    console.error("[updatePostsAuthorName] request failed", error);
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

  postList.innerHTML = "";

  const loadingState = document.createElement("div");
  loadingState.className = "empty-state";
  loadingState.textContent = "ちょい待ち...";
  postList.appendChild(loadingState);

  const result = await fetchPosts();
  const posts = getFilteredPosts(result.posts);
  postList.innerHTML = "";

  if (!result.ok) {
    const errorState = document.createElement("div");
    errorState.className = "empty-state";
    errorState.textContent =
      "投稿の読み込みに失敗しました。時間をおいて再読み込みしてください。";
    postList.appendChild(errorState);
    return;
  }

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
  const isLoggedIn = Boolean(currentAuthUser);

  if (protectedPages.includes(currentPage) && !isLoggedIn) {
    goToPage("login.html");
    return false;
  }

  if (
    (currentPage === "login.html" || currentPage === "register.html") &&
    isLoggedIn
  ) {
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
      console.error("[register] signUp failed", error);
      if (authMessage) {
        authMessage.textContent = "登録に失敗しました。";
      }
      return;
    }

    registerForm.reset();

    if (data.session?.user) {
      currentAuthUser = data.session.user;
      goToPage("index.html");
      return;
    }

    if (authMessage) {
      authMessage.textContent = "登録できました。メール確認後にログインしてください。";
    }

    goToPage("login.html");
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
      console.error("[login] signIn failed", error);
      if (authMessage) {
        authMessage.textContent = "メールアドレスかパスワードが違います。";
      }
      return;
    }

    loginForm.reset();

    if (authMessage) {
      authMessage.textContent = "ログインできました。";
    }

    if (data.session?.user) {
      currentAuthUser = data.session.user;
      goToPage("index.html");
    }
  });
}

if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    try {
      const { error } = await supabaseClient.auth.signOut();

      if (error) {
        console.error("[logout] signOut failed", error);
      }
    } catch (error) {
      console.error("[logout] request failed", error);
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
      console.error("[avatarUpdate] updateUser failed", error);
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

    const user = await requireAuthenticatedUser("blogForm.submit");
    const currentUserName = getCurrentUserName();

    if (!user?.id || !currentUserName) {
      if (postMessage) {
        postMessage.textContent = "記事を書くには、先にログインしてください。";
      }
      return;
    }

    const formData = new FormData(blogForm);
    const newPost = {
      id: crypto.randomUUID(),
      user_id: user.id,
      author: currentUserName,
      avatar: getCurrentUserAvatar(),
      title: formData.get("title")?.toString().trim() || "",
      summary: formData.get("summary")?.toString().trim() || "",
      content: formData.get("content")?.toString().trim() || "",
      date: new Date().toISOString(),
    };

    if (!newPost.title || !newPost.summary || !newPost.content) {
      if (postMessage) {
        postMessage.textContent = "空欄があるので、全部入力してください。";
      }
      return;
    }

    const result = await insertPost(newPost);

    if (!result.ok) {
      if (postMessage) {
        postMessage.textContent =
          result.reason === "not_authenticated"
            ? "ログイン状態が切れています。もう一度ログインしてください。"
            : "投稿の保存に失敗しました。コンソールを確認してください。";
      }
      return;
    }

    await renderPosts();
    blogForm.reset();

    if (postMessage) {
      postMessage.textContent = `${currentUserName} さんの記事を投稿できました。`;
    }
  });
}

if (postList) {
  postList.addEventListener("click", async (event) => {
    const target = event.target;

    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    const postId = target.dataset.deletePostId;

    if (!postId) {
      return;
    }

    const user = await requireAuthenticatedUser("postList.delete");
    const currentUserName = getCurrentUserName();
    const post = cachedPosts.find((item) => item.id === postId);

    if (!user?.id || !currentUserName || !post || post.author !== currentUserName) {
      return;
    }

    const isConfirmed = window.confirm("この投稿を削除しますか？");

    if (!isConfirmed) {
      return;
    }

    const result = await deletePost(postId, user.id);

    if (!result.ok) {
      if (postMessage) {
        postMessage.textContent = "投稿の削除に失敗しました。コンソールを確認してください。";
      }
      return;
    }

    await renderPosts();

    if (postMessage) {
      postMessage.textContent = "投稿を削除しました。";
    }
  });
}

if (friendForm) {
  friendForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const currentUserName = getCurrentUserName();

    if (!currentUserName) {
      goToPage("login.html");
      return;
    }

    const formData = new FormData(friendForm);
    const friendName = formData.get("friendName")?.toString().trim() || "";

    if (!friendName) {
      if (friendMessage) {
        friendMessage.textContent = "追加したいユーザー名を入力してください。";
      }
      return;
    }

    if (friendName === currentUserName) {
      if (friendMessage) {
        friendMessage.textContent = "自分自身は追加しなくて大丈夫です。";
      }
      return;
    }

    const existingUser = await findExistingUserByName(friendName);

    if (!existingUser) {
      if (friendMessage) {
        friendMessage.textContent = "そのユーザー名は存在しません。";
      }
      return;
    }

    const friends = getFriendsForUser(currentUserName);

    if (friends.includes(friendName)) {
      if (friendMessage) {
        friendMessage.textContent = "そのユーザーはすでにフレンドです。";
      }
      return;
    }

    setFriendsForUser(currentUserName, [...friends, friendName]);
    friendForm.reset();

    if (friendMessage) {
      friendMessage.textContent = `${friendName} さんをフレンドに追加しました。`;
    }

    renderFriendList();
    renderPosts();
  });
}

if (friendList) {
  friendList.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    const friendName = target.dataset.friendName;
    const currentUserName = getCurrentUserName();

    if (!friendName || !currentUserName) {
      return;
    }

    const nextFriends = getFriendsForUser(currentUserName).filter((name) => name !== friendName);
    setFriendsForUser(currentUserName, nextFriends);

    if (friendMessage) {
      friendMessage.textContent = `${friendName} さんをフレンド一覧から外しました。`;
    }

    renderFriendList();
    renderPosts();
  });
}

filterTabs.forEach((tab) => {
  tab.addEventListener("click", async () => {
    currentFilter = tab.dataset.filter || DEFAULT_FILTER;
    renderFilterTabs();
    await renderPosts();
  });
});

passwordToggleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const wrapper = button.closest(".password-field");
    const input = wrapper ? wrapper.querySelector("input") : null;

    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    const isHidden = input.type === "password";
    input.type = isHidden ? "text" : "password";
    button.textContent = isHidden ? "非表示" : "表示";
  });
});

if (changeNameForm) {
  if (currentNameInput) {
    currentNameInput.value = getCurrentUserName() || "";
  }

  changeNameForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const user = await requireAuthenticatedUser("changeNameForm.submit");
    const currentName = getCurrentUserName();
    const formData = new FormData(changeNameForm);
    const newUserName = formData.get("newUserName")?.toString().trim() || "";

    if (!user?.id || !currentName) {
      goToPage("login.html");
      return;
    }

    if (!newUserName) {
      if (accountMessage) {
        accountMessage.textContent = "新しいユーザー名を入力してください。";
      }
      return;
    }

    if (newUserName === currentName) {
      if (accountMessage) {
        accountMessage.textContent = "今と同じ名前です。別の名前を入力してください。";
      }
      return;
    }

    const { error } = await supabaseClient.auth.updateUser({
      data: {
        display_name: newUserName,
        avatar_url: getCurrentUserAvatar(),
      },
    });

    if (error) {
      console.error("[changeName] updateUser failed", error);
      if (accountMessage) {
        accountMessage.textContent = "ユーザー名の変更に失敗しました。";
      }
      return;
    }

    await updatePostsAuthorName(currentName, newUserName, user.id);
    renameFriendReferences(currentName, newUserName);
    await refreshCurrentAuthUser();
    await syncCurrentUserProfile();
    await renderPosts();

    if (currentNameInput) {
      currentNameInput.value = newUserName;
    }

    if (accountMessage) {
      accountMessage.textContent = `ユーザー名を ${newUserName} に変更しました。`;
    }
  });
}

if (changePasswordForm) {
  changePasswordForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const user = await requireAuthenticatedUser("changePasswordForm.submit");

    if (!user?.id) {
      goToPage("login.html");
      return;
    }

    const formData = new FormData(changePasswordForm);
    const newPassword = formData.get("newPassword")?.toString().trim() || "";

    if (newPassword.length < 6) {
      if (accountMessage) {
        accountMessage.textContent = "新しいパスワードは6文字以上にしてください。";
      }
      return;
    }

    const { error } = await supabaseClient.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      console.error("[changePassword] updateUser failed", error);
      if (accountMessage) {
        accountMessage.textContent = "パスワード変更に失敗しました。";
      }
      return;
    }

    changePasswordForm.reset();

    if (accountMessage) {
      accountMessage.textContent = "パスワードを変更しました。";
    }
  });
}

supabaseClient.auth.onAuthStateChange(async (event, session) => {
  currentAuthUser = session?.user || null;
  logAuthSnapshot(`onAuthStateChange:${event}`, session || null);

  if (currentNameInput) {
    currentNameInput.value = getCurrentUserName() || "";
  }

  updateAuthUi();

  if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
    await syncCurrentUserProfile();
  }
});

(async () => {
  await refreshCurrentAuthUser();
  const canStay = await requireLoginForProtectedPages();

  if (!canStay) {
    return;
  }

  showPageIfReady();

  if (currentNameInput) {
    currentNameInput.value = getCurrentUserName() || "";
  }

  updateAuthUi();

  if (currentAuthUser) {
    await syncCurrentUserProfile();
  }

  await renderPosts();
})();
