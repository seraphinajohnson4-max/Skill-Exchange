const DEFAULT_AVATAR = "https://api.dicebear.com/7.x/initials/svg?seed=";
let currentUserId = null;

const menuToggle = document.getElementById("menuToggle");
const dropdownMenu = document.getElementById("dropdownMenu");

if (menuToggle) {
  menuToggle.addEventListener("click", function (e) {
    e.stopPropagation();
    dropdownMenu.classList.toggle("open");
  });
  document.addEventListener("click", function () {
    dropdownMenu.classList.remove("open");
  });
}

async function loadNotifBadge(userId) {
  const { count } = await supabaseClient
    .from("exchange_requests")
    .select("id", { count: "exact", head: true })
    .eq("receiver_id", userId)
    .eq("status", "pending");

  const badge = document.getElementById("notifBadge");
  if (badge) {
    if (count > 0) {
      badge.textContent = count > 9 ? "9+" : count;
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  }
}

async function loadConversations() {
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = "login.html";
    return;
  }

  currentUserId = session.user.id;

  const { data: myProfile } = await supabaseClient
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", currentUserId)
    .single();

  const myName = myProfile?.full_name || session.user.email;
  document.getElementById("navAvatar").src = myProfile?.avatar_url || (DEFAULT_AVATAR + encodeURIComponent(myName));

  loadNotifBadge(currentUserId);

  const { data: conversations } = await supabaseClient
    .from("conversations")
    .select("id, user_one, user_two, created_at")
    .or(`user_one.eq.${currentUserId},user_two.eq.${currentUserId}`)
    .order("created_at", { ascending: false });

  const container = document.getElementById("conversationsList");
  const emptyState = document.getElementById("conversationsEmpty");
  container.innerHTML = "";

  if (!conversations || conversations.length === 0) {
    emptyState.classList.remove("hidden");
    return;
  }

  const otherUserIds = conversations.map(c => c.user_one === currentUserId ? c.user_two : c.user_one);

  const { data: profiles } = await supabaseClient
    .from("profiles")
    .select("id, full_name, avatar_url")
    .in("id", otherUserIds);

  const profileMap = {};
  (profiles || []).forEach(p => { profileMap[p.id] = p; });

  for (const conv of conversations) {
    const otherId = conv.user_one === currentUserId ? conv.user_two : conv.user_one;
    const profile = profileMap[otherId];
    if (!profile) continue;

    const { data: lastMsg } = await supabaseClient
      .from("messages")
      .select("content, file_type, created_at")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let preview = "Say hello 👋";
    if (lastMsg) {
      if (lastMsg.content) preview = lastMsg.content;
      else if (lastMsg.file_type) preview = `📎 Sent a ${lastMsg.file_type}`;
    }

    const avatarUrl = profile.avatar_url || (DEFAULT_AVATAR + encodeURIComponent(profile.full_name || "Student"));

    const card = document.createElement("a");
    card.href = `chat.html?conv=${conv.id}`;
    card.className = "conversation-card";
    card.innerHTML = `
      <img src="${avatarUrl}" alt="">
      <div class="conversation-card-info">
        <h3>${profile.full_name || "Student"}</h3>
        <p>${preview}</p>
      </div>
    `;
    container.appendChild(card);
  }
}

loadConversations();

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async function (e) {
    e.preventDefault();
    await supabaseClient.auth.signOut();
    window.location.href = "login.html";
  });
}
