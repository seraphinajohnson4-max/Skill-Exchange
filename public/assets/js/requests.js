const DEFAULT_AVATAR = "https://api.dicebear.com/7.x/initials/svg?seed=";
let currentUserId = null;

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

async function getProfilesByIds(ids) {
  if (ids.length === 0) return {};
  const { data } = await supabaseClient
    .from("profiles")
    .select("id, full_name, avatar_url")
    .in("id", ids);

  const map = {};
  (data || []).forEach(p => { map[p.id] = p; });
  return map;
}

async function loadRequests() {
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

  const { data: incoming } = await supabaseClient
    .from("exchange_requests")
    .select("id, sender_id, status, created_at")
    .eq("receiver_id", currentUserId)
    .order("created_at", { ascending: false });

  const incomingContainer = document.getElementById("incomingRequests");
  const incomingEmpty = document.getElementById("incomingEmpty");
  incomingContainer.innerHTML = "";

  if (!incoming || incoming.length === 0) {
    incomingEmpty.classList.remove("hidden");
  } else {
    const senderIds = incoming.map(r => r.sender_id);
    const profileMap = await getProfilesByIds(senderIds);

    incoming.forEach(req => {
      const profile = profileMap[req.sender_id];
      if (!profile) return;

      const avatarUrl = profile.avatar_url || (DEFAULT_AVATAR + encodeURIComponent(profile.full_name || "Student"));
      const card = document.createElement("div");
      card.className = "request-card";

      let actionsHtml = "";
      if (req.status === "pending") {
        actionsHtml = `
          <div class="request-actions">
            <button class="btn-small btn-accept" data-id="${req.id}" data-action="accepted">Accept</button>
            <button class="btn-small btn-decline" data-id="${req.id}" data-action="declined">Decline</button>
          </div>
        `;
      } else {
        actionsHtml = `<span class="status-badge status-${req.status}">${req.status}</span>`;
      }

      card.innerHTML = `
        <img src="${avatarUrl}" alt="">
        <div class="request-card-info">
          <h3>${profile.full_name || "Student"}</h3>
          <p>Wants to connect with you</p>
        </div>
        ${actionsHtml}
      `;
      incomingContainer.appendChild(card);
    });

    incomingContainer.querySelectorAll("button[data-action]").forEach(btn => {
      btn.addEventListener("click", async function () {
        const requestId = btn.dataset.id;
        const newStatus = btn.dataset.action;

        await supabaseClient
          .from("exchange_requests")
          .update({ status: newStatus })
          .eq("id", requestId);

        loadRequests();
      });
    });
  }

  const { data: outgoing } = await supabaseClient
    .from("exchange_requests")
    .select("id, receiver_id, status, created_at")
    .eq("sender_id", currentUserId)
    .order("created_at", { ascending: false });

  const outgoingContainer = document.getElementById("outgoingRequests");
  const outgoingEmpty = document.getElementById("outgoingEmpty");
  outgoingContainer.innerHTML = "";

  if (!outgoing || outgoing.length === 0) {
    outgoingEmpty.classList.remove("hidden");
  } else {
    const receiverIds = outgoing.map(r => r.receiver_id);
    const profileMap = await getProfilesByIds(receiverIds);

    outgoing.forEach(req => {
      const profile = profileMap[req.receiver_id];
      if (!profile) return;

      const avatarUrl = profile.avatar_url || (DEFAULT_AVATAR + encodeURIComponent(profile.full_name || "Student"));
      const card = document.createElement("div");
      card.className = "request-card";

      card.innerHTML = `
        <img src="${avatarUrl}" alt="">
        <div class="request-card-info">
          <h3>${profile.full_name || "Student"}</h3>
          <p>Request sent</p>
        </div>
        <span class="status-badge status-${req.status}">${req.status}</span>
      `;
      outgoingContainer.appendChild(card);
    });
  }
}

loadRequests();

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async function (e) {
    e.preventDefault();
    await supabaseClient.auth.signOut();
    window.location.href = "login.html";
  });
}
