const DEFAULT_AVATAR = "https://api.dicebear.com/7.x/initials/svg?seed=";

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

function renderChips(containerId, names) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  names.forEach(name => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = name;
    container.appendChild(chip);
  });
}

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = "login.html";
    return;
  }

  const { data: myProfile } = await supabaseClient
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", session.user.id)
    .single();

  const myName = myProfile?.full_name || session.user.email;
  document.getElementById("navAvatar").src = myProfile?.avatar_url || (DEFAULT_AVATAR + encodeURIComponent(myName));

  loadNotifBadge(session.user.id);

  const params = new URLSearchParams(window.location.search);
  const viewedUserId = params.get("user");

  if (!viewedUserId) {
    document.getElementById("viewName").textContent = "Student not found";
    return;
  }

  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", viewedUserId)
    .single();

  const { data: userSkills } = await supabaseClient
    .from("user_skills")
    .select("type, skills(name)")
    .eq("user_id", viewedUserId);

  const name = profile?.full_name || "Student";
  const avatarUrl = profile?.avatar_url || (DEFAULT_AVATAR + encodeURIComponent(name));

  document.getElementById("viewName").textContent = name;
  document.getElementById("viewBio").textContent = profile?.bio || "No bio added yet.";
  document.getElementById("viewAvatar").src = avatarUrl;

  const teachNames = (userSkills || []).filter(s => s.type === "teach").map(s => s.skills.name);
  const learnNames = (userSkills || []).filter(s => s.type === "learn").map(s => s.skills.name);

  renderChips("viewTeachChips", teachNames);
  renderChips("viewLearnChips", learnNames);

  const requestBtn = document.getElementById("requestBtn");
  if (viewedUserId === session.user.id) {
    requestBtn.style.display = "none";
  } else {
    const { data: existing } = await supabaseClient
      .from("exchange_requests")
      .select("id, status")
      .or(`and(sender_id.eq.${session.user.id},receiver_id.eq.${viewedUserId}),and(sender_id.eq.${viewedUserId},receiver_id.eq.${session.user.id})`)
      .maybeSingle();

    if (existing) {
      requestBtn.textContent = existing.status === "pending" ? "Request Pending" : "Already Connected";
      requestBtn.disabled = true;
      requestBtn.classList.add("btn-disabled");
    } else {
      requestBtn.addEventListener("click", async function () {
        requestBtn.disabled = true;
        requestBtn.textContent = "Sending...";

        const { error } = await supabaseClient
          .from("exchange_requests")
          .insert({ sender_id: session.user.id, receiver_id: viewedUserId });

        if (error) {
          alert("Could not send request: " + error.message);
          requestBtn.disabled = false;
          requestBtn.textContent = "Request Skill Exchange";
          return;
        }

        requestBtn.textContent = "Request Pending";
        requestBtn.classList.add("btn-disabled");
      });
    }
  }
}

init();

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async function (e) {
    e.preventDefault();
    await supabaseClient.auth.signOut();
    window.location.href = "login.html";
  });
}
