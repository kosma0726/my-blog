const USERS_STORAGE_KEY = "beginner-blog-users";
const SESSION_STORAGE_KEY = "beginner-blog-current-user";
const FRIENDS_STORAGE_KEY = "beginner-blog-friends";
const DEFAULT_FILTER = "all";

const SUPABASE_URL = "https://lmuhbktyjslllbecrjzj.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtdWhia3R5anNsbGxiZWNyanpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MjE0NTMsImV4cCI6MjA4OTQ5NzQ1M30.nEs7C4FxSBouvS58-qEyrvQBkLD4I3aBtC8GBX-lyFA";

const supabaseClient =
  window.supabase &&
  SUPABASE_URL &&
  SUPABASE_ANON_KEY
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

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

function loadUsers() {
  const savedUsers = localStorage.getItem(USERS_STORAGE_KEY);
  if (!savedUsers) {
    return [];
  }

  try {
    return JSON.parse(savedUsers);
  } catch (error) {
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

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

function getCurrentUser() {
  return localStorage.getItem(SESSION_STORAGE_KEY);
}

function setCurrentUser(userName) {
  if (userName) {
    localStorage.setItem(SESSION_STORAGE_KEY, userName);
    return;
  }

  localStorage.removeItem(SESSION_STORAGE_KEY);
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

function findUserByName(userName) {
  return loadUsers().find((user) => user.name === userName);
}

function getUserProfile(userName) {
  return findUserByName(userName) || { name: userName, avatar: "" };
}

function getFilteredPosts(posts) {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    return posts;
  }

  if (currentFilter === "mine") {
    return posts.filter((post) => post.author === currentUser);
  }

  if (currentFilter === "friends") {
    const allowedAuthors = new Set([currentUser, ...getFriendsForUser(currentUser)]);
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
  const currentUser = getCurrentUser();
  const article = document.createElement("article");
  article.className = "post-card";
  article.dataset.postId = post.id;

  const header = document.createElement("div");
  header.className = "post-card__header";

  const profile = getUserProfile(post.author);
  const avatar = createAvatarElement(profile.name, profile.avatar, "avatar--small");

  const headingBox = document.createElement("div");
  headingBox.className = "post-card__heading";

  const meta = document.createElement("p");
  meta.className = "post-card__meta";
  meta.textContent = `${formatDate(post.date)} | 投稿者: ${post.author}`;

  const title = document.createElement("h3");
  title.textContent = post.title;

  headingBox.append(title, meta);

  if (currentUser && post.author === currentUser) {
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

  const currentUser = getCurrentUser();
  const friends = currentUser ? getFriendsForUser(currentUser) : [];
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

  const isLoggedIn = Boolean(getCurrentUser());
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

function requireLoginForProtectedPages() {
  const protectedPages = ["index.html", "change-name.html", "change-password.html"];

  if (protectedPages.includes(currentPage) && !getCurrentUser()) {
    goToPage("login.html");
  }

  if ((currentPage === "login.html" || currentPage === "register.html") && getCurrentUser()) {
    goToPage("index.html");
  }
}

if (registerForm) {
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(registerForm);
    const name = formData.get("registerName").toString().trim();
    const password = formData.get("registerPassword").toString().trim();
    const avatarFile = formData.get("registerAvatar");

    if (!name || !password) {
      if (authMessage) {
        authMessage.textContent = "名前とパスワードを両方入力してください。";
      }
      return;
    }

    if (password.length < 4) {
      if (authMessage) {
        authMessage.textContent = "パスワードは4文字以上にしてください。";
      }
      return;
    }

    if (findUserByName(name)) {
      if (authMessage) {
        authMessage.textContent = "その表示名はすでに使われています。別の名前にしてください。";
      }
      return;
    }

    const avatar = avatarFile instanceof File ? await fileToDataUrl(avatarFile) : "";
    const users = loadUsers();
    users.push({ name, password, avatar });
    saveUsers(users);
    setCurrentUser(name);
    registerForm.reset();

    if (authMessage) {
      authMessage.textContent = `新規登録できました。${name} さんでログイン中です。`;
    }

    goToPage("index.html");
  });
}

if (loginForm) {
  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(loginForm);
    const name = formData.get("loginName").toString().trim();
    const password = formData.get("loginPassword").toString().trim();
    const user = findUserByName(name);

    if (!user || user.password !== password) {
      if (authMessage) {
        authMessage.textContent = "表示名かパスワードが違います。";
      }
      return;
    }

    setCurrentUser(name);
    loginForm.reset();

    if (authMessage) {
      authMessage.textContent = `${name} さん、ログインできました。`;
    }

    goToPage("index.html");
  });
}

if (logoutButton) {
  logoutButton.addEventListener("click", () => {
    setCurrentUser("");
    if (blogForm) {
      blogForm.reset();
    }
    goToPage("login.html");
  });
}

if (avatarUpdateInput) {
  avatarUpdateInput.addEventListener("change", async (event) => {
    const currentUser = getCurrentUser();
    const file = event.target.files && event.target.files[0];

    if (!currentUser || !file) {
      return;
    }

    const users = loadUsers();
    const user = users.find((item) => item.name === currentUser);

    if (!user) {
      return;
    }

    user.avatar = await fileToDataUrl(file);
    saveUsers(users);

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

    const currentUser = getCurrentUser();

    if (!currentUser) {
      if (postMessage) {
        postMessage.textContent = "記事を書くには、先にログインしてください。";
      }
      return;
    }

    const formData = new FormData(blogForm);
    const newPost = {
      id: String(Date.now()),
      author: currentUser,
      title: formData.get("title").toString().trim(),
      summary: formData.get("summary").toString().trim(),
      content: formData.get("content").toString().trim(),
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
        postMessage.textContent = "投稿の保存に失敗しました。コンソールを確認してください。";
      }
      return;
    }

    await renderPosts();
    blogForm.reset();

    if (postMessage) {
      postMessage.textContent = `${currentUser} さんの記事を投稿できました。`;
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

    const currentUser = getCurrentUser();
    const post = cachedPosts.find((item) => item.id === postId);

    if (!currentUser || !post || post.author !== currentUser) {
      return;
    }

    const isConfirmed = window.confirm("この投稿を削除しますか？");

    if (!isConfirmed) {
      return;
    }

    const result = await deletePost(postId, currentUser);

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
  friendForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const currentUser = getCurrentUser();

    if (!currentUser) {
      goToPage("login.html");
      return;
    }

    const formData = new FormData(friendForm);
    const friendName = formData.get("friendName").toString().trim();

    if (!friendName) {
      if (friendMessage) {
        friendMessage.textContent = "追加したいユーザー名を入力してください。";
      }
      return;
    }

    if (friendName === currentUser) {
      if (friendMessage) {
        friendMessage.textContent = "自分自身は追加しなくて大丈夫です。";
      }
      return;
    }

    if (!findUserByName(friendName)) {
      if (friendMessage) {
        friendMessage.textContent = "そのユーザー名は存在しません。";
      }
      return;
    }

    const friends = getFriendsForUser(currentUser);

    if (friends.includes(friendName)) {
      if (friendMessage) {
        friendMessage.textContent = "そのユーザーはすでにフレンドです。";
      }
      return;
    }

    setFriendsForUser(currentUser, [...friends, friendName]);
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
    const currentUser = getCurrentUser();

    if (!friendName || !currentUser) {
      return;
    }

    const nextFriends = getFriendsForUser(currentUser).filter((name) => name !== friendName);
    setFriendsForUser(currentUser, nextFriends);

    if (friendMessage) {
      friendMessage.textContent = `${friendName} さんをフレンド一覧から外しました。`;
    }

    renderFriendList();
    renderPosts();
  });
}

filterTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    currentFilter = tab.dataset.filter || DEFAULT_FILTER;
    renderFilterTabs();
    renderPosts();
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
  const currentUser = getCurrentUser();

  if (currentNameInput) {
    currentNameInput.value = currentUser || "";
  }

  changeNameForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const currentName = getCurrentUser();
    const formData = new FormData(changeNameForm);
    const newUserName = formData.get("newUserName").toString().trim();

    if (!currentName) {
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

    if (findUserByName(newUserName)) {
      if (accountMessage) {
        accountMessage.textContent = "そのユーザー名はすでに使われています。";
      }
      return;
    }

    const users = loadUsers();
    const user = users.find((item) => item.name === currentName);

    if (!user) {
      goToPage("login.html");
      return;
    }

    user.name = newUserName;
    saveUsers(users);
    await updatePostsAuthorName(currentName, newUserName);
    renameFriendReferences(currentName, newUserName);
    setCurrentUser(newUserName);

    if (currentNameInput) {
      currentNameInput.value = newUserName;
    }

    if (accountMessage) {
      accountMessage.textContent = `ユーザー名を ${newUserName} に変更しました。`;
    }
  });
}

if (changePasswordForm) {
  changePasswordForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const currentUser = getCurrentUser();
    const formData = new FormData(changePasswordForm);
    const currentPassword = formData.get("currentPassword").toString().trim();
    const newPassword = formData.get("newPassword").toString().trim();

    if (!currentUser) {
      goToPage("login.html");
      return;
    }

    const users = loadUsers();
    const user = users.find((item) => item.name === currentUser);

    if (!user || user.password !== currentPassword) {
      if (accountMessage) {
        accountMessage.textContent = "今のパスワードが違います。";
      }
      return;
    }

    if (newPassword.length < 4) {
      if (accountMessage) {
        accountMessage.textContent = "新しいパスワードは4文字以上にしてください。";
      }
      return;
    }

    user.password = newPassword;
    saveUsers(users);
    changePasswordForm.reset();

    if (accountMessage) {
      accountMessage.textContent = "パスワードを変更しました。";
    }
  });
}

requireLoginForProtectedPages();
renderPosts();
updateAuthUi();
