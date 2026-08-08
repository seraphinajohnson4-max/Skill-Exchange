let currentUserId = null;

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

// Render comma-separated skills as chips
function renderChips(containerId, skillsString) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  if (!skillsString) return;

  const skills = skillsString.split(",").map(s => s.trim()).filter(Boolean);
  skills.forEach(skill => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = skill;
    container.appendChild(chip);
  });
}

const DEFAULT_AVATAR = "https://api.dicebear.com/7.x/initials/svg?seed=";

// Load profile + protect page
async function loadProfile() {
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = "login.html";
    return;
  }

  currentUserId = session.user.id;

  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", currentUserId)
    .single();

  const name = profile?.full_name || session.user.user_metadata?.full_name || "Student";
  const avatarUrl = profile?.avatar_url || (DEFAULT_AVATAR + encodeURIComponent(name));

  document.getElementById("displayName").textContent = name;
  document.getElementById("displayBio").textContent = profile?.bio || "No bio added yet.";
  document.getElementById("avatarPreview").src = avatarUrl;
  document.getElementById("navAvatar").src = avatarUrl;

  renderChips("teachChips", profile?.skills_to_teach);
  renderChips("learnChips", profile?.skills_to_learn);

  // Prefill edit form
  document.getElementById("fullName").value = name;
  document.getElementById("bio").value = profile?.bio || "";
  document.getElementById("skillsToTeach").value = profile?.skills_to_teach || "";
  document.getElementById("skillsToLearn").value = profile?.skills_to_learn || "";
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
    const skillsToTeach = document.getElementById("skillsToTeach").value.trim();
    const skillsToLearn = document.getElementById("skillsToLearn").value.trim();

    if (fullName.length < 2) {
      messageBox.textContent = "Please enter your full name.";
      messageBox.className = "form-message error";
      return;
    }

    messageBox.textContent = "Saving...";
    messageBox.className = "form-message";
    submitBtn.disabled = true;

    const { error } = await supabaseClient
      .from("profiles")
      .upsert({
        id: currentUserId,
        full_name: fullName,
        bio: bio,
        skills_to_teach: skillsToTeach,
        skills_to_learn: skillsToLearn
      });

    submitBtn.disabled = false;

    if (error) {
      messageBox.textContent = error.message;
      messageBox.className = "form-message error";
      return;
    }

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
