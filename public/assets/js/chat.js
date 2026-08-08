const DEFAULT_AVATAR = "https://api.dicebear.com/7.x/initials/svg?seed=";
let currentUserId = null;
let conversationId = null;
let otherUserId = null;

const chatMessages = document.getElementById("chatMessages");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const fileInput = document.getElementById("fileInput");
const uploadStatus = document.getElementById("uploadStatus");

function renderMessage(msg) {
  const bubble = document.createElement("div");
  bubble.className = "message-bubble " + (msg.sender_id === currentUserId ? "message-mine" : "message-theirs");

  let innerHtml = "";

  if (msg.content) {
    innerHtml += `<div>${escapeHtml(msg.content)}</div>`;
  }

  if (msg.file_url) {
    if (msg.file_type === "image") {
      innerHtml += `<img src="${msg.file_url}" class="message-image" alt="Shared image">`;
    } else if (msg.file_type === "video") {
      innerHtml += `<video src="${msg.file_url}" controls></video>`;
    } else if (msg.file_type === "audio") {
      innerHtml += `<audio src="${msg.file_url}" controls></audio>`;
    } else {
      innerHtml += `<a href="${msg.file_url}" target="_blank" class="message-file-link">📄 Download file</a>`;
    }
  }

  bubble.innerHTML = innerHtml;
  chatMessages.appendChild(bubble);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = "login.html";
    return;
  }

  currentUserId = session.user.id;

  const params = new URLSearchParams(window.location.search);
  conversationId = params.get("conv");

  if (!conversationId) {
    document.getElementById("chatName").textContent = "Conversation not found";
    return;
  }

  const { data: conversation, error: convError } = await supabaseClient
    .from("conversations")
    .select("user_one, user_two")
    .eq("id", conversationId)
    .single();

  if (convError || !conversation) {
    document.getElementById("chatName").textContent = "Conversation not found";
    return;
  }

  otherUserId = conversation.user_one === currentUserId ? conversation.user_two : conversation.user_one;

  const { data: otherProfile } = await supabaseClient
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", otherUserId)
    .single();

  const otherName = otherProfile?.full_name || "Student";
  document.getElementById("chatName").textContent = otherName;
  document.getElementById("chatAvatar").src = otherProfile?.avatar_url || (DEFAULT_AVATAR + encodeURIComponent(otherName));

  // Load existing messages
  const { data: messages } = await supabaseClient
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  (messages || []).forEach(renderMessage);
  scrollToBottom();

  // Mark all messages from the other person as read
  await supabaseClient
    .from("messages")
    .update({ is_read: true })
    .eq("conversation_id", conversationId)
    .neq("sender_id", currentUserId)
    .eq("is_read", false);

  // Listen for new messages in real time
  supabaseClient
    .channel("messages-" + conversationId)
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "messages",
      filter: `conversation_id=eq.${conversationId}`
    }, (payload) => {
      renderMessage(payload.new);
      scrollToBottom();
    })
    .subscribe();
}

init();

// Send text message
chatForm.addEventListener("submit", async function (e) {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;

  chatInput.value = "";

  const { data, error } = await supabaseClient.from("messages").insert({
    conversation_id: conversationId,
    sender_id: currentUserId,
    content: text
  }).select().single();

  if (error) {
    alert("Message failed to send: " + error.message);
    return;
  }

  renderMessage(data);
  scrollToBottom();
});

// Send file
fileInput.addEventListener("change", async function () {
  const file = fileInput.files[0];
  if (!file) return;

  uploadStatus.textContent = "Uploading...";
  uploadStatus.classList.remove("hidden");

  const filePath = `${conversationId}/${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabaseClient.storage
    .from("message-files")
    .upload(filePath, file);

  if (uploadError) {
    uploadStatus.textContent = "Upload failed: " + uploadError.message;
    return;
  }

  const { data: urlData } = supabaseClient.storage
    .from("message-files")
    .getPublicUrl(filePath);

  let fileType = "file";
  if (file.type.startsWith("image/")) fileType = "image";
  else if (file.type.startsWith("video/")) fileType = "video";
  else if (file.type.startsWith("audio/")) fileType = "audio";

  await supabaseClient.from("messages").insert({
    conversation_id: conversationId,
    sender_id: currentUserId,
    file_url: urlData.publicUrl,
    file_type: fileType
  });

  uploadStatus.classList.add("hidden");
  fileInput.value = "";
});
