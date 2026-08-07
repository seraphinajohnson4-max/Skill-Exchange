// Password show/hide toggle
const toggleBtn = document.getElementById("togglePassword");
const passwordInput = document.getElementById("password");

if (toggleBtn) {
  toggleBtn.addEventListener("click", function () {
    if (passwordInput.type === "password") {
      passwordInput.type = "text";
      toggleBtn.textContent = "Hide";
    } else {
      passwordInput.type = "password";
      toggleBtn.textContent = "Show";
    }
  });
}

// Handles Sign Up form submission
const signupForm = document.getElementById("signupForm");

if (signupForm) {
  signupForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const fullNameInput = document.getElementById("fullName");
    const emailInput = document.getElementById("email");
    const passwordInputField = document.getElementById("password");
    const messageBox = document.getElementById("formMessage");

    const fullName = fullNameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInputField.value;

    // Basic email format check
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Validate each field, focus and stop at the first problem
    if (fullName.length < 2) {
      messageBox.textContent = "Please enter your full name.";
      messageBox.className = "form-message error";
      fullNameInput.focus();
      return;
    }

    if (!emailPattern.test(email)) {
      messageBox.textContent = "Please enter a valid email address.";
      messageBox.className = "form-message error";
      emailInput.focus();
      return;
    }

    if (password.length < 6) {
      messageBox.textContent = "Password must be at least 6 characters.";
      messageBox.className = "form-message error";
      passwordInputField.focus();
      return;
    }

    messageBox.textContent = "Creating your account...";
    messageBox.className = "form-message";

    const { data, error } = await supabaseClient.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          full_name: fullName
        }
      }
    });

    if (error) {
      messageBox.textContent = error.message;
      messageBox.className = "form-message error";
      return;
    }

    messageBox.textContent = "Account created! Redirecting to login...";
    messageBox.className = "form-message success";

    setTimeout(function () {
      window.location.href = "login.html";
    }, 1500);
  });
    }
