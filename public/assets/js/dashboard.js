const DEFAULT_AVATAR = "https://api.dicebear.com/7.x/initials/svg?seed=";

async function loadNotifBadge(userId) {
  const { count: requestCount } = await supabaseClient
    .from("exchange_requests")
    .select("id", { count: "exact", head: true })
    .eq("receiver_id", userId)
    .eq("status", "pending");

  const { data: myConversations } = await supabaseClient
    .from("conversations")
    .select("id")
    .or(`user_one.eq.${userId},user_two.eq.${userId}`);

  const convIds = (myConversations || []).map(c => c.id);

  let unreadMessages = 0;
  if (convIds.length > 0) {
    const { count } = await supabaseClient
      .from("messages")
      .select("id", { count: "exact", head: true })
      .in("conversation_id", convIds)
      .eq("is_read", false)
      .neq("sender_id", userId);

    unreadMessages = count || 0;
  }

  const total = (requestCount || 0) + unreadMessages;

  const badge = document.getElementById("notifBadge");
  if (badge) {
    if (total > 0) {
      badge.textContent = total > 9 ? "9+" : total;
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  }
}

// Protects this page: redirect to login if not signed in
async function checkAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = "login.html";
    return;
  }

  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", session.user.id)
    .single();

  const fullName = profile?.full_name || session.user.user_metadata?.full_name || session.user.email;
  const avatarUrl = profile?.avatar_url || (DEFAULT_AVATAR + encodeURIComponent(fullName));

  const nameSpan = document.getElementById("userName");
  if (nameSpan) nameSpan.textContent = fullName;

  const navAvatar = document.getElementById("navAvatar");
  if (navAvatar) navAvatar.src = avatarUrl;

  loadNotifBadge(session.user.id);
}

checkAuth();

// Dropdown menu toggle
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

// Log out button
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async function (e) {
    e.preventDefault();
    await supabaseClient.auth.signOut();
    window.location.href = "login.html";
  });
    }
