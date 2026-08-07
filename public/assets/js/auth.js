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
    const submitBtn = signupForm.querySelector("button[type=submit]");

    const fullName = fullNameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInputField.value;

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    submitBtn.disabled = true;

    try {
      // If Supabase takes longer than 10 seconds, stop waiting and show an error
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out. Check your internet connection and try again.")), 10000)
      );

      const signupPromise = supabaseClient.auth.signUp({
        email: email,
        password: password,
        options: {
          data: { full_name: fullName }
        }
      });

      const { data, error } = await Promise.race([signupPromise, timeoutPromise]);

      if (error) {
        messageBox.textContent = error.message;
        messageBox.className = "form-message error";
        submitBtn.disabled = false;
        return;
      }

      messageBox.textContent = "Account created! Redirecting to login...";
      messageBox.className = "form-message success";

      setTimeout(function () {
        window.location.href = "login.html";
      }, 1500);

    } catch (err) {
      messageBox.textContent = err.message || "Something went wrong. Please try again.";
      messageBox.className = "form-message error";
      submitBtn.disabled = false;
    }
  });
      }
