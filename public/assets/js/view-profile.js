const DEFAULT_AVATAR = "https://api.dicebear.com/7.x/initials/svg?seed=";

// Dropdown menu
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
    requestBtn.addEventListener("click", function () {
      alert("Exchange requests are coming in the next phase!");
    });
  }
}

init();

// Log out
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async function (e) {
    e.preventDefault();
    await supabaseClient.auth.signOut();
    window.location.href = "login.html";
  });
}
