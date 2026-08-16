// Database Configuration
var SUPABASE_URL = "https://vewtbsdpwtbuzmpthrpl.supabase.co";
var SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZld3Ric2Rwd3RidXptcHRocnBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4NTYwNDUsImV4cCI6MjEwMjQzMjA0NX0.uDcxgjnox3X7wXXyn-TaCYb-7miIWr8w_ak3hgLgozY";

var PIN = "1234";

var dbClient = null;
var transactions = [];
var loans = [];

// Initialize Client
try {
  if (window.supabase) {
    dbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }
} catch (e) {
  console.error("Init Error:", e);
}

// Unlock Screen Action
async function unlockApp() {
  var pinInput = document.getElementById("pin-input");
  var enteredPin = pinInput ? pinInput.value.trim() : "";
  var errorMsg = document.getElementById("pin-error");

  if (enteredPin === PIN) {
    if (errorMsg) errorMsg.innerText = "";
    document.getElementById("auth-overlay").classList.add("hidden");
    document.getElementById("app-container").classList.remove("hidden");
    
    var dateInput = document.getElementById("tx-date");
    if (dateInput) dateInput.valueAsDate = new Date();

    await loadDataFromSupabase();
  } else {
    if (errorMsg) errorMsg.innerText = "Invalid PIN. (Default: 1234)";
  }
}

// Fetch Records
async function loadDataFromSupabase() {
  if (!dbClient) {
    renderAll();
    return;
  }

  try {
    var txRes = await dbClient
      .from("transactions")
      .select("*")
      .order("id", { ascending: false });

    if (!txRes.error) transactions = txRes.data || [];

    var loanRes = await dbClient
      .from("loans")
      .select("*")
      .order("id", { ascending: false });

    if (!loanRes.error) loans = loanRes.data || [];

    renderAll();
  } catch (err) {
    console.error("Fetch Error:", err);
    renderAll();
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

// Delete Handlers
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

// Summaries Calculation
function updateSummaries() {
  var todayStr = new Date().toISOString().split("T")[0];
  var totalBalance = 0;
  var todaySpent = 0;

  transactions.forEach(function (t) {
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

// Search Filter
function filterTransactions() {
  var query = document.getElementById("searchInput").value.toLowerCase();
  var filtered = transactions.filter(function (t) {
    return (
      t.category.toLowerCase().includes(query) ||
      t.account.toLowerCase().includes(query) ||
      (t.note && t.note.toLowerCase().includes(query)) ||
      t.type.toLowerCase().includes(query)
    );
  });
  renderTransactionTable(filtered);
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
  updateSummaries();
  renderTransactionTable();
  renderLoanTable();
}