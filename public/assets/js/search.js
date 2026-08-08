const DEFAULT_AVATAR = "https://api.dicebear.com/7.x/initials/svg?seed=";
let allSkills = [];
let currentUserId = null;

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

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = "login.html";
    return;
  }

  currentUserId = session.user.id;

  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", currentUserId)
    .single();

  const name = profile?.full_name || session.user.email;
  const avatarUrl = profile?.avatar_url || (DEFAULT_AVATAR + encodeURIComponent(name));
  document.getElementById("navAvatar").src = avatarUrl;

  const { data: skillsData } = await supabaseClient
    .from("skills")
    .select("id, name")
    .order("name");

  allSkills = skillsData || [];
}

init();

const searchInput = document.getElementById("searchInput");
const suggestionsBox = document.getElementById("searchSuggestions");
const resultsGrid = document.getElementById("searchResults");
const emptyState = document.getElementById("emptyState");

function showSuggestions() {
  const query = searchInput.value.trim().toLowerCase();
  suggestionsBox.innerHTML = "";

  if (!query) {
    suggestionsBox.classList.remove("open");
    return;
  }

  const matches = allSkills.filter(s => s.name.toLowerCase().includes(query)).slice(0, 8);

  matches.forEach(skill => {
    const item = document.createElement("div");
    item.className = "suggestion-item";
    item.textContent = skill.name;
    item.addEventListener("click", function () {
      searchInput.value = skill.name;
      suggestionsBox.classList.remove("open");
      runSearch(skill.id, skill.name);
    });
    suggestionsBox.appendChild(item);
  });

  suggestionsBox.classList.toggle("open", matches.length > 0);
}

searchInput.addEventListener("input", showSuggestions);
searchInput.addEventListener("focus", showSuggestions);

document.addEventListener("click", function (e) {
  if (!searchInput.contains(e.target) && !suggestionsBox.contains(e.target)) {
    suggestionsBox.classList.remove("open");
  }
});

async function runSearch(skillId, skillName) {
  resultsGrid.innerHTML = "";
  emptyState.classList.add("hidden");

  const { data: matches, error } = await supabaseClient
    .from("user_skills")
    .select("user_id")
    .eq("skill_id", skillId)
    .eq("type", "teach");

  if (error) {
    emptyState.textContent = "Something went wrong: " + error.message;
    emptyState.classList.remove("hidden");
    return;
  }

  const userIds = (matches || [])
    .map(m => m.user_id)
    .filter(id => id !== currentUserId);

  if (userIds.length === 0) {
    emptyState.textContent = `No students found teaching "${skillName}" yet.`;
    emptyState.classList.remove("hidden");
    return;
  }

  const { data: profilesData, error: profilesError } = await supabaseClient
    .from("profiles")
    .select("id, full_name, bio, avatar_url")
    .in("id", userIds);

  if (profilesError) {
    emptyState.textContent = "Something went wrong: " + profilesError.message;
    emptyState.classList.remove("hidden");
    return;
  }

  const students = profilesData || [];

  if (students.length === 0) {
    emptyState.textContent = `No students found teaching "${skillName}" yet.`;
    emptyState.classList.remove("hidden");
    return;
  }

  students.forEach(profile => {
    const avatarUrl = profile.avatar_url || (DEFAULT_AVATAR + encodeURIComponent(profile.full_name || "Student"));

    const card = document.createElement("a");
    card.href = `view-profile.html?user=${profile.id}`;
    card.className = "student-card";

    card.innerHTML = `
      <img src="${avatarUrl}" alt="">
      <div class="student-card-info">
        <h3>${profile.full_name || "Student"}</h3>
        <p>${profile.bio ? profile.bio.slice(0, 60) : "No bio added yet."}</p>
      </div>
    `;

    resultsGrid.appendChild(card);
  });
}

// Log out
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async function (e) {
    e.preventDefault();
    await supabaseClient.auth.signOut();
    window.location.href = "login.html";
  });
}
