// Supabase connection setup
const SUPABASE_URL = "https://jpjvmrzubqorygfoqdlg.supabase.co";
const SUPABASE_KEY = "sb_publishable_kxlrSOI8r586Tv_vwgM6TA_SoL8Y-JN";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Signs out any user whose account has been suspended by an admin
async function enforceActiveAccount() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return;

  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("is_disabled")
    .eq("id", session.user.id)
    .single();

  if (profile?.is_disabled) {
    await supabaseClient.auth.signOut();
    alert("Your account has been suspended. Please contact an administrator.");
    window.location.href = "login.html";
  }
}

enforceActiveAccount();
