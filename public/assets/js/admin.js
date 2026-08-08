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

async function loadAdminPanel() {
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = "login.html";
    return;
  }

  const { data: myProfile } = await supabaseClient
    .from("profiles")
    .select("full_name, avatar_url, is_admin")
    .eq("id", session.user.id)
    .single();

  if (!myProfile || myProfile.is_admin !== true) {
    document.querySelector(".search-page").innerHTML = `
      <div class="access-denied">
        <h1>Access Denied</h1>
        <p>You don't have permission to view this page.</p>
      </div>
    `;
    return;
  }

  const myName = myProfile.full_name || session.user.email;
  document.getElementById("navAvatar").src = myProfile.avatar_url || (DEFAULT_AVATAR + encodeURIComponent(myName));

  loadNotifBadge(session.user.id);

  const { count: userCount } = await supabaseClient.from("profiles").select("id", { count: "exact", head: true });
  const { count: skillCount } = await supabaseClient.from("skills").select("id", { count: "exact", head: true });
  const { count: requestCount } = await supabaseClient.from("exchange_requests").select("id", { count: "exact", head: true });
  const { count: messageCount } = await supabaseClient.from("messages").select("id", { count: "exact", head: true });

  document.getElementById("statUsers").textContent = userCount || 0;
  document.getElementById("statSkills").textContent = skillCount || 0;
  document.getElementById("statRequests").textContent = requestCount || 0;
  document.getElementById("statMessages").textContent = messageCount || 0;

  // User list — clickable, with suspend/restore
  const { data: users } = await supabaseClient
    .from("profiles")
    .select("id, full_name, bio, avatar_url, is_admin, is_disabled")
    .order("full_name");

  const userListContainer = document.getElementById("userList");
  userListContainer.innerHTML = "";

  (users || []).forEach(user => {
    const avatarUrl = user.avatar_url || (DEFAULT_AVATAR + encodeURIComponent(user.full_name || "Student"));

    const wrapper = document.createElement("div");
    wrapper.className = "admin-user-row";

    const link = document.createElement("a");
    link.href = `view-profile.html?user=${user.id}`;
    link.className = "student-card";
    link.innerHTML = `
      <img src="${avatarUrl}" alt="">
      <div class="student-card-info">
        <h3>${user.full_name || "Unnamed"} ${user.is_admin ? '<span class="admin-tag">Admin</span>' : ""} ${user.is_disabled ? '<span class="admin-tag suspended-tag">Suspended</span>' : ""}</h3>
        <p>${user.bio ? user.bio.slice(0, 60) : "No bio added yet."}</p>
      </div>
    `;
    wrapper.appendChild(link);

    if (!user.is_admin) {
      const actionBtn = document.createElement("button");
      actionBtn.className = user.is_disabled ? "btn-small btn-accept" : "btn-small btn-decline";
      actionBtn.textContent = user.is_disabled ? "Restore" : "Suspend";
      actionBtn.addEventListener("click", async function () {
        const confirmed = confirm(
          user.is_disabled
            ? `Restore ${user.full_name || "this student"}'s access?`
            : `Suspend ${user.full_name || "this student"}? They won't be able to log in until restored.`
        );
        if (!confirmed) return;

        const { error } = await supabaseClient
          .from("profiles")
          .update({ is_disabled: !user.is_disabled })
          .eq("id", user.id);

        if (error) {
          alert("Action failed: " + error.message);
          return;
        }
        loadAdminPanel();
      });
      wrapper.appendChild(actionBtn);
    }

    userListContainer.appendChild(wrapper);
  });

  // Skills list
  const { data: skills, error: skillsLoadError } = await supabaseClient
    .from("skills")
    .select("id, name")
    .order("name");

  const skillsListContainer = document.getElementById("skillsList");
  skillsListContainer.innerHTML = "";

  if (skillsLoadError) {
    skillsListContainer.textContent = "Could not load skills: " + skillsLoadError.message;
  }

  (skills || []).forEach(skill => {
    const chip = document.createElement("span");
    chip.className = "skill-admin-chip";
    chip.innerHTML = `${skill.name} <button data-id="${skill.id}" type="button">×</button>`;
    skillsListContainer.appendChild(chip);
  });

  skillsListContainer.querySelectorAll("button[data-id]").forEach(btn => {
    btn.addEventListener("click", async function () {
      const confirmed = confirm("Delete this skill? This will remove it from all student profiles.");
      if (!confirmed) return;

      const { error } = await supabaseClient.from("skills").delete().eq("id", btn.dataset.id);
      if (error) {
        alert("Could not delete: " + error.message);
        return;
      }
      loadAdminPanel();
    });
  });
}

loadAdminPanel();

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async function (e) {
    e.preventDefault();
    await supabaseClient.auth.signOut();
    window.location.href = "login.html";
  });
      }
