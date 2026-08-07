// Handles Sign Up form submission
const signupForm = document.getElementById("signupForm");

if (signupForm) {
  signupForm.addEventListener("submit", async function (e) {
      e.preventDefault();

          const fullName = document.getElementById("fullName").value.trim();
              const email = document.getElementById("email").value.trim();
                  const password = document.getElementById("password").value;
                      const messageBox = document.getElementById("formMessage");

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