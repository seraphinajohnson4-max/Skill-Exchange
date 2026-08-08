let currentUserId = null;
let allSkills = [];
let selectedTeach = new Set();
let selectedLearn = new Set();

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
  return total;
}

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

// Sets up a tag-style autocomplete input
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

// Load profile + protect page
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

  await loadNotifBadge(currentUserId);

  const { count: pendingRequests } = await supabaseClient
    .from("exchange_requests")
    .select("id", { count: "exact", head: true })
    .eq("receiver_id", currentUserId)
    .eq("status", "pending");

  const requestBanner = document.getElementById("requestBanner");
  if (pendingRequests > 0) {
    document.getElementById("requestBannerText").textContent =
      pendingRequests === 1
        ? "You have 1 pending exchange request."
        : `You have ${pendingRequests} pending exchange requests.`;
    requestBanner.classList.remove("hidden");
  } else {
    requestBanner.classList.add("hidden");
  }

  const { data: myConversations } = await supabaseClient
    .from("conversations")
    .select("id")
    .or(`user_one.eq.${currentUserId},user_two.eq.${currentUserId}`);

  const convIds = (myConversations || []).map(c => c.id);
  let unreadMessages = 0;

  if (convIds.length > 0) {
    const { count } = await supabaseClient
      .from("messages")
      .select("id", { count: "exact", head: true })
      .in("conversation_id", convIds)
      .eq("is_read", false)
      .neq("sender_id", currentUserId);

    unreadMessages = count || 0;
  }

  const messageBanner = document.getElementById("messageBanner");
  if (unreadMessages > 0) {
    document.getElementById("messageBannerText").textContent =
      unreadMessages === 1
        ? "You have 1 unread message."
        : `You have ${unreadMessages} unread messages.`;
    messageBanner.classList.remove("hidden");
  } else {
    messageBanner.classList.add("hidden");
  }

  setupTagInput("teachSkillsInput", "teachTags", "teachSuggestions", selectedTeach);
  setupTagInput("learnSkillsInput", "learnTags", "learnSuggestions", selectedLearn);

  refreshDisplay();
}

loadProfile();

// Avatar upload
const avatarInput = document.getElementById("avatarInput");

function compressImage(file, maxSize = 400) {
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = function (e) {
      img.onload = function () {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > height && width > maxSize) {
          height = height * (maxSize / width);
          width = maxSize;
        } else if (height > maxSize) {
          width = width * (maxSize / height);
          height = maxSize;
        }

        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.8);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

if (avatarInput) {
  avatarInput.addEventListener("change", async function () {
    const file = avatarInput.files[0];
    if (!file) return;

    const compressedBlob = await compressImage(file);
    const filePath = `${currentUserId}/avatar.png`;

    const { error: uploadError } = await supabaseClient.storage
      .from("avatars")
      .upload(filePath, compressedBlob, { upsert: true, contentType: "image/jpeg" });

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
