let currentUserId = null;

// Protect this page + load existing profile data
async function loadProfile() {
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = "login.html";
    return;
  }

  currentUserId = session.user.id;

  const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", currentUserId)
    .single();

  if (profile) {
    document.getElementById("fullName").value = profile.full_name || "";
    document.getElementById("bio").value = profile.bio || "";
    document.getElementById("skillsToTeach").value = profile.skills_to_teach || "";
    document.getElementById("skillsToLearn").value = profile.skills_to_learn || "";
  } else {
    // No profile row yet — prefill name from signup metadata
    document.getElementById("fullName").value = session.user.user_metadata?.full_name || "";
  }
}

loadProfile();

// Save profile on submit
const profileForm = document.getElementById("profileForm");

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

    if (error) {
      messageBox.textContent = error.message;
      messageBox.className = "form-message error";
      submitBtn.disabled = false;
      return;
    }

    messageBox.textContent = "Profile saved!";
    messageBox.className = "form-message success";
    submitBtn.disabled = false;
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
