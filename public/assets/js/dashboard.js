// Protects this page: redirect to login if not signed in
async function checkAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = "login.html";
    return;
  }

  // Show the user's name if available
  const nameSpan = document.getElementById("userName");
  if (nameSpan) {
    const fullName = session.user.user_metadata?.full_name;
    nameSpan.textContent = fullName || session.user.email;
  }
}

checkAuth();

// Log out button
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async function (e) {
    e.preventDefault();
    await supabaseClient.auth.signOut();
    window.location.href = "login.html";
  });
}
