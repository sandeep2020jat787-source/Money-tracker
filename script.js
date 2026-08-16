var SUPABASE_URL = "https://vewtbsdpwtbuzmpthrpl.supabase.co";
var SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZld3Ric2Rwd3RidXptcHRocnBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4NTYwNDUsImV4cCI6MjEwMjQzMjA0NX0.uDcxgjnox3X7wXXyn-TaCYb-7miIWr8w_ak3hgLgozY";

var dbClient = null;
var transactions = [];
var loans = [];
var appSecurity = { pin: "1234", recovery_phone: "9999999999" };

// Initialize Supabase
try {
  if (window.supabase) {
    dbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    fetchSecuritySettings();
  }
} catch (e) {
  console.error("Init Error:", e);
}

// Fetch PIN and Recovery from Supabase
async function fetchSecuritySettings() {
  if (!dbClient) return;
  var res = await dbClient.from("app_settings").select("*").eq("id", 1).single();
  if (res.data) {
    appSecurity = res.data;
  }
}

// Unlock Action
async function unlockApp() {
  await fetchSecuritySettings();
  var pinInput = document.getElementById("pin-input");
  var enteredPin = pinInput ? pinInput.value.trim() : "";
  var errorMsg = document.getElementById("pin-error");

  if (enteredPin === appSecurity.pin) {
    if (errorMsg) errorMsg.innerText = "";
    document.getElementById("auth-overlay").classList.add("hidden");
    document.getElementById("app-container").classList.remove("hidden");
    
    var dateInput = document.getElementById("tx-date");
    if (dateInput) dateInput.valueAsDate = new Date();

    var currentMonth = new Date().toISOString().slice(0, 7);
    var monthFilter = document.getElementById("monthFilter");
    if (monthFilter) monthFilter.value = currentMonth;

    await loadDataFromSupabase();
  } else {
    if (errorMsg) errorMsg.innerText = "Invalid PIN. Try again.";
  }
}

// Forgot Password / Reset Logic
function openForgotModal() {
  document.getElementById("forgot-modal").classList.remove("hidden");
}

function closeForgotModal() {
  document.getElementById("forgot-modal").classList.add("hidden");
  document.getElementById("recovery-phone-input").value = "";
  document.getElementById("reset-new-pin").value = "";
  document.getElementById("forgot-modal-msg").innerText = "";
}

async function processPinReset() {
  var phone = document.getElementById("recovery-phone-input").value.trim();
  var newP = document.getElementById("reset-new-pin").value.trim();
  var msg = document.getElementById("forgot-modal-msg");

  await fetchSecuritySettings();

  if (phone !== appSecurity.recovery_phone) {
    msg.style.color = "#dc2626";
    msg.innerText = "Phone number does not match records.";
    return;
  }

  if (newP.length < 4) {
    msg.style.color = "#dc2626";
    msg.innerText = "PIN must be at least 4 digits.";
    return;
  }

  if (dbClient) {
    var res = await dbClient.from("app_settings").update({ pin: newP }).eq("id", 1);
    if (res.error) {
      msg.innerText = "Update error: " + res.error.message;
      return;
    }
  }

  appSecurity.pin = newP;
  msg.style.color = "#16a34a";
  msg.innerText = "PIN Reset Success! You can login now.";
  setTimeout(function() {
    closeForgotModal();
    document.getElementById("pin-input").value = newP;
  }, 1200);
}

// In-Dashboard Security Update
function openPinModal() {
  document.getElementById("pin-modal").classList.remove("hidden");
  document.getElementById("new-phone").value = appSecurity.recovery_phone || "";
}

function closePinModal() {
  document.getElementById("pin-modal").classList.add("hidden");
  document.getElementById("current-pin").value = "";
  document.getElementById("new-pin").value = "";
  document.getElementById("pin-modal-msg").innerText = "";
}

async function saveNewSecurityDetails() {
  var curr = document.getElementById("current-pin").value.trim();
  var newP = document.getElementById("new-pin").value.trim();
  var newPhone = document.getElementById("new-phone").value.trim();
  var msg = document.getElementById("pin-modal-msg");

  if (curr !== appSecurity.pin) {
    msg.style.color = "#dc2626";
    msg.innerText = "Current PIN is incorrect.";
    return;
  }

  var updates = {};
  if (newP) {
    if (newP.length < 4) {
      msg.style.color = "#dc2626";
      msg.innerText = "New PIN must be 4 digits.";
      return;
    }
    updates.pin = newP;
  }
  if (newPhone) {
    updates.recovery_phone = newPhone;
  }

  if (dbClient && Object.keys(updates).length > 0) {
    var res = await dbClient.from("app_settings").update(updates).eq("id", 1);
    if (res.error) {
      msg.innerText = "Save failed: " + res.error.message;
      return;
    }
  }

  await fetchSecuritySettings();
  msg.style.color = "#16a34a";
  msg.innerText = "Settings updated successfully!";
  setTimeout(closePinModal, 1200);
}

// Mobile-Compatible CSV/Excel Export (Using Blob)
function exportToCSV() {
  var selectedMonth = document.getElementById("monthFilter").value;
  var dataToExport = transactions;

  if (selectedMonth) {
    dataToExport = transactions.filter(function(t) {
      return t.date && t.date.startsWith(selectedMonth);
    });
  }

  if (dataToExport.length === 0) {
    alert("No records found to export!");
    return;
  }

  var rows = [
    ["ID", "Date", "Category", "Type", "Amount (INR)", "Account", "Note"]
  ];

  dataToExport.forEach(function (t) {
    var cleanNote = (t.note || "").replace(/"/g, '""');
    rows.push([
      t.id,
      t.date,
      '"' + t.category + '"',
      t.type,
      t.amount,
      '"' + t.account + '"',
      '"' + cleanNote + '"'
    ]);
  });

  var csvContent = rows.map(function(e) { return e.join(","); }).join("\n");
  var blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  var url = URL.createObjectURL(blob);
  
  var link = document.createElement("a");
  var fileName = selectedMonth ? "Expenses_" + selectedMonth + ".csv" : "All_Expenses.csv";
  
  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Load Data from Supabase
async function loadDataFromSupabase() {
  if (!dbClient) {
    renderAll();
    return;
  }

  try {
    var txRes = await dbClient.from("transactions").select("*").order("id", { ascending: false });
    if (!txRes.error) transactions = txRes.data || [];

    var loanRes = await dbClient.from("loans").select("*").order("id", { ascending: false });
    if (!loanRes.error) loans = loanRes.data || [];

    applyFilters();
  } catch (err) {
    console.error("Fetch Error:", err);
    applyFilters();
  }
}

// Add Transaction
async function addTransaction(e) {
  e.preventDefault();
  var tx = {
    date: document.getElementById("tx-date").value,
    account: document.getElementById("tx-account").value,
    type: document.getElementById("tx-type").value,
    category: document.getElementById("tx-category").value,
    amount: parseFloat(document.getElementById("tx-amount").value),
    note: document.getElementById("tx-note").value || ""
  };

  if (dbClient) {
    var res = await dbClient.from("transactions").insert([tx]);
    if (res.error) alert("Save Error: " + res.error.message);
  }

  document.getElementById("tx-form").reset();
  var dateInput = document.getElementById("tx-date");
  if (dateInput) dateInput.valueAsDate = new Date();
  await loadDataFromSupabase();
}

// Add Loan
async function addLoan(e) {
  e.preventDefault();
  var loan = {
    name: document.getElementById("loan-name").value,
    emi: parseFloat(document.getElementById("loan-emi").value),
    remaining: parseFloat(document.getElementById("loan-remaining").value),
    due_date: parseInt(document.getElementById("loan-date").value)
  };

  if (dbClient) {
    var res = await dbClient.from("loans").insert([loan]);
    if (res.error) alert("Save Error: " + res.error.message);
  }

  document.getElementById("loan-form").reset();
  await loadDataFromSupabase();
}

// Delete
async function deleteTransaction(id) {
  if (dbClient) {
    await dbClient.from("transactions").delete().eq("id", id);
  }
  await loadDataFromSupabase();
}

async function deleteLoan(id) {
  if (dbClient) {
    await dbClient.from("loans").delete().eq("id", id);
  }
  await loadDataFromSupabase();
}

// Summary Calculation
function updateSummaries(dataForTotals) {
  var dataList = dataForTotals || transactions;
  var todayStr = new Date().toISOString().split("T")[0];
  var totalBalance = 0;
  var todaySpent = 0;

  dataList.forEach(function (t) {
    var amt = parseFloat(t.amount) || 0;
    if (t.type === "Income") {
      totalBalance += amt;
    } else {
      totalBalance -= amt;
      if (t.date === todayStr) {
        todaySpent += amt;
      }
    }
  });

  var totalEMI = loans.reduce(function (sum, l) {
    return sum + (parseFloat(l.emi) || 0);
  }, 0);

  var elBal = document.getElementById("total-balance-val");
  var elSpent = document.getElementById("today-spent-val");
  var elEmi = document.getElementById("total-emi-val");

  if (elBal) elBal.innerText = "₹" + totalBalance.toLocaleString();
  if (elSpent) elSpent.innerText = "₹" + todaySpent.toLocaleString();
  if (elEmi) elEmi.innerText = "₹" + totalEMI.toLocaleString() + " /mo";
}

// Filter
function applyFilters() {
  var searchInput = document.getElementById("searchInput");
  var query = searchInput ? searchInput.value.toLowerCase() : "";
  var monthFilter = document.getElementById("monthFilter");
  var selectedMonth = monthFilter ? monthFilter.value : "";

  var filtered = transactions.filter(function (t) {
    var matchSearch = (
      t.category.toLowerCase().includes(query) ||
      t.account.toLowerCase().includes(query) ||
      (t.note && t.note.toLowerCase().includes(query)) ||
      t.type.toLowerCase().includes(query)
    );

    var matchMonth = true;
    if (selectedMonth && t.date) {
      matchMonth = t.date.startsWith(selectedMonth);
    }

    return matchSearch && matchMonth;
  });

  renderTransactionTable(filtered);
  updateSummaries(filtered);
}

function clearMonthFilter() {
  var m = document.getElementById("monthFilter");
  if (m) m.value = "";
  applyFilters();
}

function filterTransactions() {
  applyFilters();
}

// Render DOM
function renderTransactionTable(dataToRender) {
  var data = dataToRender || transactions;
  var txList = document.getElementById("tx-list");
  if (!txList) return;
  txList.innerHTML = "";

  data.forEach(function (t) {
    var row = document.createElement("tr");
    row.innerHTML =
      "<td>" + t.date + "</td>" +
      "<td><strong>" + t.category + "</strong><br><small>" + (t.note || "") + "</small></td>" +
      "<td>" + t.account + "</td>" +
      '<td class="' + (t.type === "Expense" ? "badge-expense" : "badge-income") + '">' + t.type + "</td>" +
      "<td>₹" + parseFloat(t.amount).toLocaleString() + "</td>" +
      '<td><button class="btn-del" onclick="deleteTransaction(' + t.id + ')">Delete</button></td>';
    txList.appendChild(row);
  });
}

function renderLoanTable() {
  var loanList = document.getElementById("loan-list");
  if (!loanList) return;
  loanList.innerHTML = "";

  loans.forEach(function (l) {
    var row = document.createElement("tr");
    row.innerHTML =
      "<td>" + l.name + "</td>" +
      "<td>₹" + parseFloat(l.emi).toLocaleString() + "</td>" +
      "<td>₹" + parseFloat(l.remaining).toLocaleString() + "</td>" +
      "<td>" + l.due_date + "th of every month</td>" +
      '<td><button class="btn-del" onclick="deleteLoan(' + l.id + ')">Delete</button></td>';
    loanList.appendChild(row);
  });
}

function renderAll() {
  renderLoanTable();
  applyFilters();
}