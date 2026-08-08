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

// Render read-only display chips
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

// Sets up a tag-style autocomplete input. Returns a function to re-render its tags.
function setupTagInput(inputId, tagsId, suggestionsId, selectedSet) {
  const input = document.getElementById(inputId);
  const tagsContainer = document.getElementById(tagsId);
  const suggestionsBox = document.getElementById(suggestionsId);

  function renderTags() {
    tagsContainer.innerHTML = "";
    selectedSet.forEach(skillId => {
      const skill = allSkills.find(s => s.id === skillId);
      if (!skill) return;

      const chip = document.createElement("span");
      chip.className = "tag-chip";

      const label = document.createElement("span");
      label.textContent = skill.name;
      chip.appendChild(label);

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.textContent = "×";
      removeBtn.addEventListener("click", function () {
        selectedSet.delete(skillId);
        renderTags();
      });
      chip.appendChild(removeBtn);

      tagsContainer.appendChild(chip);
    });
  }

  function showSuggestions() {
    const query = input.value.trim().toLowerCase();
    suggestionsBox.innerHTML = "";

    if (!query) {
      suggestionsBox.classList.remove("open");
      return;
    }

    const matches = allSkills
      .filter(s => s.name.toLowerCase().includes(query) && !selectedSet.has(s.id))
      .slice(0, 8);

    matches.forEach(skill => {
      const item = document.createElement("div");
      item.className = "suggestion-item";
      item.textContent = skill.name;
      item.addEventListener("click", function () {
        selectedSet.add(skill.id);
        renderTags();
        input.value = "";
        suggestionsBox.classList.remove("open");
      });
      suggestionsBox.appendChild(item);
    });

    const exactMatch = allSkills.some(s => s.name.toLowerCase() === query);
    if (!exactMatch) {
      const addItem = document.createElement("div");
      addItem.className = "suggestion-item add-new";
      addItem.textContent = `+ Add "${input.value.trim()}" as a new skill`;
      addItem.addEventListener("click", async function () {
        const newName = input.value.trim();
        const { data: newSkill, error } = await supabaseClient
          .from("skills")
          .insert({ name: newName, category_id: null })
          .select()
          .single();

        if (error) {
          alert("Could not add skill: " + error.message);
          return;
        }

        allSkills.push({ id: newSkill.id, name: newSkill.name, categories: null });
        selectedSet.add(newSkill.id);
        renderTags();
        input.value = "";
        suggestionsBox.classList.remove("open");
      });
      suggestionsBox.appendChild(addItem);
    }

    suggestionsBox.classList.add("open");
  }

  input.addEventListener("input", showSuggestions);
  input.addEventListener("focus", showSuggestions);

  document.addEventListener("click", function (e) {
    if (!input.contains(e.target) && !suggestionsBox.contains(e.target)) {
      suggestionsBox.classList.remove("open");
    }
  });

  renderTags();
  return renderTags;
}

let renderTeachTags = null;
let renderLearnTags = null;

// Refresh the read-only display without reloading everything from the database
function refreshDisplay() {
  const fullName = document.getElementById("fullName").value.trim();
  const bio = document.getElementById("bio").value.trim();

  document.getElementById("displayName").textContent = fullName;
  document.getElementById("displayBio").textContent = bio || "No bio added yet.";

  const teachNames = [...selectedTeach].map(id => allSkills.find(s => s.id === id)?.name).filter(Boolean);
  const learnNames = [...selectedLearn].map(id => allSkills.find(s => s.id === id)?.name).filter(Boolean);

  renderDisplayChips("teachChips", teachNames);
  renderDisplayChips("learnChips", learnNames);
}

// Load profile + protect page (runs once on page load)
async function loadProfile() {
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = "login.html";
    return;
  }

  currentUserId = session.user.id;

  const { data: skillsData } = await supabaseClient
    .from("skills")
    .select("id, name, categories(name)")
    .order("name");

  allSkills = skillsData || [];

  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", currentUserId)
    .single();

  const { data: userSkills } = await supabaseClient
    .from("user_skills")
    .select("skill_id, type")
    .eq("user_id", currentUserId);

  (userSkills || []).filter(s => s.type === "teach").forEach(s => selectedTeach.add(s.skill_id));
  (userSkills || []).filter(s => s.type === "learn").forEach(s => selectedLearn.add(s.skill_id));

  const name = profile?.full_name || session.user.user_metadata?.full_name || "Student";
  const avatarUrl = profile?.avatar_url || (DEFAULT_AVATAR + encodeURIComponent(name));

  document.getElementById("avatarPreview").src = avatarUrl;
  document.getElementById("navAvatar").src = avatarUrl;
  document.getElementById("fullName").value = name;
  document.getElementById("bio").value = profile?.bio || "";

  renderTeachTags = setupTagInput("teachSkillsInput", "teachTags", "teachSuggestions", selectedTeach);
  renderLearnTags = setupTagInput("learnSkillsInput", "learnTags", "learnSuggestions", selectedLearn);

  refreshDisplay();
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

    const { error: profileError } = await supabaseClient
      .from("profiles")
      .upsert({ id: currentUserId, full_name: fullName, bio: bio });

    if (profileError) {
      messageBox.textContent = profileError.message;
      messageBox.className = "form-message error";
      submitBtn.disabled = false;
      return;
    }

    await supabaseClient.from("user_skills").delete().eq("user_id", currentUserId);

    const rowsToInsert = [];
    selectedTeach.forEach(skillId => rowsToInsert.push({ user_id: currentUserId, skill_id: skillId, type: "teach" }));
    selectedLearn.forEach(skillId => rowsToInsert.push({ user_id: currentUserId, skill_id: skillId, type: "learn" }));

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
    refreshDisplay();
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
