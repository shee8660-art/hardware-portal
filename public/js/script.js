const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (data.success) {
      // Redirect based on role
      if (data.role === "Admin") window.location.href = "/admin";
      else alert("Role not implemented yet.");
    } else alert("❌ " + data.message);
  });
}

async function logout() {
  await fetch("/api/logout", { method: "POST" });
  window.location.href = "/";
}
