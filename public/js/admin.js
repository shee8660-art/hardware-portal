// ==============================
// LOAD HARDWARE REQUESTS
// ==============================
async function loadRequests() {
  const res = await fetch("/api/requests");
  const data = await res.json();

  const tbody = document.querySelector("#requestsTable tbody");
  tbody.innerHTML = "";

  data.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.ticket_no || ""}</td>
      <td>${r.branch_name || ""}</td>
      <td>${r.date_reported || ""}</td>
      <td>${r.date_acknowledged || ""}</td>
      <td>${r.aging || ""}</td>
      <td>${r.category || ""}</td>
      <td>${r.brand || ""}</td>
      <td>${r.model || ""}</td>
      <td>${r.serial_no || ""}</td>
      <td>${r.status || ""}</td>
      <td>${r.remarks || ""}</td>
      <td>${r.hardware_age || ""}</td>
      <td>
        <button class="btn btn-sm btn-warning" onclick="editReq(${r.id})">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deleteReq(${r.id})">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ==============================
// SAVE NEW HARDWARE REQUEST
// ==============================
async function saveRequest() {
  const form = document.getElementById("addRequestForm");
  const data = Object.fromEntries(new FormData(form));

  const res = await fetch("/api/requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

  const json = await res.json();
  if (json.success) {
    alert("Saved!");
    form.reset();
    bootstrap.Modal.getInstance(document.getElementById("addRequestModal")).hide();
    loadRequests();
  } else {
    alert("Error: " + json.message);
  }
}

// ==============================
// EDIT HARDWARE REQUEST
// ==============================
async function editReq(id) {
  const res = await fetch("/api/requests");
  const data = await res.json();
  const reqItem = data.find(r => r.id === id);
  if (!reqItem) return alert("Request not found");

  const form = document.getElementById("editRequestForm");
  form.id.value = reqItem.id;
  form.ticket_no.value = reqItem.ticket_no || "";
  form.branch_name.value = reqItem.branch_name || "";
  form.date_reported.value = reqItem.date_reported || "";
  form.date_acknowledged.value = reqItem.date_acknowledged || "";
  form.category.value = reqItem.category || "--Please Select--";
  form.brand.value = reqItem.brand || "";
  form.model.value = reqItem.model || "";
  form.serial_no.value = reqItem.serial_no || "";
  form.status.value = reqItem.status || "Prepared";
  form.remarks.value = reqItem.remarks || "";
  form.hardware_age.value = reqItem.hardware_age || "1-2yrs";

  const modal = new bootstrap.Modal(document.getElementById("editRequestModal"));
  modal.show();
}

// ==============================
// UPDATE HARDWARE REQUEST
// ==============================
async function updateRequest() {
  const form = document.getElementById("editRequestForm");
  const id = form.id.value;
  const data = Object.fromEntries(new FormData(form));

  const res = await fetch(`/api/requests/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

  const json = await res.json();
  if (json.success) {
    alert("Updated!");
    form.reset();
    bootstrap.Modal.getInstance(document.getElementById("editRequestModal")).hide();
    loadRequests();
  } else {
    alert("Error: " + json.message);
  }
}

// ==============================
// DELETE HARDWARE REQUEST
// ==============================
async function deleteReq(id) {
  if (!confirm("Delete this request?")) return;

  const res = await fetch(`/api/requests/${id}`, { method: "DELETE" });
  const json = await res.json();
  if (json.success) {
    alert("Deleted");
    loadRequests();
  } else {
    alert("Error: " + json.message);
  }
}

// ==============================
// USER MANAGEMENT
// ==============================
async function loadUsers() {
  const res = await fetch("/api/users");
  const users = await res.json();

  const usersDiv = document.getElementById("usersTab");
  let table = document.getElementById("usersTable");

  if (!table) {
    table = document.createElement("table");
    table.id = "usersTable";
    table.className = "table table-bordered table-striped";
    table.innerHTML = `
      <thead class="table-dark">
        <tr><th>ID</th><th>Username</th><th>Role</th><th>Actions</th></tr>
      </thead>
      <tbody></tbody>
    `;
    usersDiv.appendChild(table);
  }

  const tbody = table.querySelector("tbody");
  tbody.innerHTML = "";

  users.forEach(u => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${u.id}</td>
      <td>${u.username}</td>
      <td>${u.role}</td>
      <td>
        <button class="btn btn-sm btn-danger" onclick="deleteUser(${u.id})">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function addUser() {
  const username = prompt("Enter username:");
  if (!username) return;
  const password = prompt("Enter password:");
  if (!password) return;
  const role = prompt("Enter role (Admin/User):");
  if (!role) return;

  const res = await fetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, role })
  });

  const json = await res.json();
  if (json.success) {
    alert("User added!");
    loadUsers();
  } else {
    alert("Error: " + json.message);
  }
}

async function deleteUser(id) {
  if (!confirm("Delete this user?")) return;

  const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
  const json = await res.json();
  if (json.success) {
    alert("Deleted");
    loadUsers();
  } else {
    alert("Error: " + json.message);
  }
}

// ==============================
// LOGOUT
// ==============================
function logout() {
  fetch("/api/logout", { method: "POST" }).then(() => {
    window.location.href = "/login";
  });
}

// ==============================
// INIT
// ==============================
document.addEventListener("DOMContentLoaded", () => {
  loadRequests();
  loadUsers();

  // Bind Add User button explicitly
  const addUserBtn = document.querySelector("#usersTab > button.btn-success");
  if (addUserBtn) addUserBtn.onclick = addUser;

  // Bind Save button for Add Request
  document.querySelector("#addRequestModal .btn-primary").onclick = saveRequest;

  // Bind Save Changes button for Edit Request
  document.querySelector("#editRequestModal .btn-primary").onclick = updateRequest;
});
