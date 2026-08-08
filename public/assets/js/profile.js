let currentUserId = null;
let allSkills = [];
let selectedTeach = new Set();
let selectedLearn = new Set();

const DEFAULT_AVATAR = "https://api.dicebear.com/7.x/initials/svg?seed=";

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

// Edit form show/hide
const editToggleBtn = document.getElementById("editToggleBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const profileForm = document.getElementById("profileForm");

if (editToggleBtn) {
  editToggleBtn.addEventListener("click", function () {
    profileForm.classList.remove("hidden");
    profileForm.scrollIntoView({ behavior: "smooth" });
  });
}

if (cancelEditBtn) {
  cancelEditBtn.addEventListener("click", function () {
    profileForm.classList.add("hidden");
  });
}

// Render display chips (read-only view)
function renderDisplayChips(containerId, skillNames) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  skillNames.forEach(name => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = name;
    container.appendChild(chip);
  });
}

// Build the category-grouped picker UI
function renderPicker(containerId, selectedSet) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  const byCategory = {};
  allSkills.forEach(skill => {
    const catName = skill.categories?.name || "Other";
    if (!byCategory[catName]) byCategory[catName] = [];
    byCategory[catName].push(skill);
  });

  Object.keys(byCategory).forEach(catName => {
    const catDiv = document.createElement("div");
    catDiv.className = "picker-category";

    const heading = document.createElement("h5");
    heading.textContent = catName;
    catDiv.appendChild(heading);

    const optionsDiv = document.createElement("div");
    optionsDiv.className = "picker-options";

    byCategory[catName].forEach(skill => {
      const chip = document.createElement("span");
      chip.className = "picker-chip";
      chip.textContent = skill.name;
      chip.dataset.skillId = skill.id;

      if (selectedSet.has(skill.id)) chip.classList.add("selected");

      chip.addEventListener("click", function () {
        if (selectedSet.has(skill.id)) {
          selectedSet.delete(skill.id);
          chip.classList.remove("selected");
        } else {
          selectedSet.add(skill.id);
          chip.classList.add("selected");
        }
      });

      optionsDiv.appendChild(chip);
    });

    catDiv.appendChild(optionsDiv);
    container.appendChild(catDiv);
  });
}

// Load profile + protect page
async function loadProfile() {
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = "login.html";
    return;
  }

  currentUserId = session.user.id;

  // Load all available skills with their category names
  const { data: skillsData } = await supabaseClient
    .from("skills")
    .select("id, name, categories(name)")
    .order("name");

  allSkills = skillsData || [];

  // Load this user's profile
  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", currentUserId)
    .single();

  // Load this user's selected skills
  const { data: userSkills } = await supabaseClient
    .from("user_skills")
    .select("skill_id, type, skills(name)")
    .eq("user_id", currentUserId);

  selectedTeach = new Set((userSkills || []).filter(s => s.type === "teach").map(s => s.skill_id));
  selectedLearn = new Set((userSkills || []).filter(s => s.type === "learn").map(s => s.skill_id));

  const teachNames = (userSkills || []).filter(s => s.type === "teach").map(s => s.skills.name);
  const learnNames = (userSkills || []).filter(s => s.type === "learn").map(s => s.skills.name);

  const name = profile?.full_name || session.user.user_metadata?.full_name || "Student";
  const avatarUrl = profile?.avatar_url || (DEFAULT_AVATAR + encodeURIComponent(name));

  document.getElementById("displayName").textContent = name;
  document.getElementById("displayBio").textContent = profile?.bio || "No bio added yet.";
  document.getElementById("avatarPreview").src = avatarUrl;
  document.getElementById("navAvatar").src = avatarUrl;

  renderDisplayChips("teachChips", teachNames);
  renderDisplayChips("learnChips", learnNames);

  document.getElementById("fullName").value = name;
  document.getElementById("bio").value = profile?.bio || "";

  renderPicker("teachSkillsPicker", selectedTeach);
  renderPicker("learnSkillsPicker", selectedLearn);
}

loadProfile();

// Avatar upload
const avatarInput = document.getElementById("avatarInput");

if (avatarInput) {
  avatarInput.addEventListener("change", async function () {
    const file = avatarInput.files[0];
    if (!file) return;

    const filePath = `${currentUserId}/avatar.png`;

    const { error: uploadError } = await supabaseClient.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      alert("Upload failed: " + uploadError.message);
      return;
    }

    const { data: urlData } = supabaseClient.storage
      .from("avatars")
      .getPublicUrl(filePath);

    const publicUrl = urlData.publicUrl + "?t=" + Date.now();

    await supabaseClient
      .from("profiles")
      .upsert({ id: currentUserId, avatar_url: publicUrl });

    document.getElementById("avatarPreview").src = publicUrl;
    document.getElementById("navAvatar").src = publicUrl;
  });
}

// Save profile form
if (profileForm) {
  profileForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const messageBox = document.getElementById("profileMessage");
    const submitBtn = profileForm.querySelector("button[type=submit]");

    const fullName = document.getElementById("fullName").value.trim();
    const bio = document.getElementById("bio").value.trim();

    if (fullName.length < 2) {
      messageBox.textContent = "Please enter your full name.";
      messageBox.className = "form-message error";
      return;
    }

    messageBox.textContent = "Saving...";
    messageBox.className = "form-message";
    submitBtn.disabled = true;

    // Save bio/name
    const { error: profileError } = await supabaseClient
      .from("profiles")
      .upsert({ id: currentUserId, full_name: fullName, bio: bio });

    if (profileError) {
      messageBox.textContent = profileError.message;
      messageBox.className = "form-message error";
      submitBtn.disabled = false;
      return;
    }

    // Replace this user's skill selections: delete old, insert current
    await supabaseClient.from("user_skills").delete().eq("user_id", currentUserId);

    const rowsToInsert = [];
    selectedTeach.forEach(skillId => {
      rowsToInsert.push({ user_id: currentUserId, skill_id: skillId, type: "teach" });
    });
    selectedLearn.forEach(skillId => {
      rowsToInsert.push({ user_id: currentUserId, skill_id: skillId, type: "learn" });
    });

    if (rowsToInsert.length > 0) {
      const { error: skillsError } = await supabaseClient.from("user_skills").insert(rowsToInsert);
      if (skillsError) {
        messageBox.textContent = skillsError.message;
        messageBox.className = "form-message error";
        submitBtn.disabled = false;
        return;
      }
    }

    submitBtn.disabled = false;
    messageBox.textContent = "Profile saved!";
    messageBox.className = "form-message success";
    profileForm.classList.add("hidden");
    loadProfile();
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
