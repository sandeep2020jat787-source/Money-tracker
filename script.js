// Database Configuration
var SUPABASE_URL = "https://vewtbsdpwtbuzmpthrpl.supabase.co";
var SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZld3Ric2Rwd3RidXptcHRocnBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4NTYwNDUsImV4cCI6MjEwMjQzMjA0NX0.uDcxgjnox3X7wXXyn-TaCYb-7miIWr8w_ak3hgLgozY";

var dbClient = null;
var currentUser = null;
var isSignUpMode = false;

var transactions = [];
var loans = [];
var debts = [];
var showSettled = false;

// Initialize Supabase & Session Check
try {
  if (window.supabase) {
    dbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    checkCurrentSession();
  }
} catch (e) {
  console.error("Init Error:", e);
}

// Session Check on Page Load
async function checkCurrentSession() {
  if (!dbClient) return;
  var { data } = await dbClient.auth.getSession();
  if (data && data.session && data.session.user) {
    currentUser = data.session.user;
    launchDashboard();
  }
}

// Auth Toggle (Login <-> Sign Up)
function toggleAuthMode() {
  isSignUpMode = !isSignUpMode;
  var title = document.getElementById("auth-title");
  var submitBtn = document.getElementById("auth-submit-btn");
  var toggleText = document.getElementById("auth-toggle-text");
  var toggleLink = document.getElementById("auth-toggle-link");
  var errorMsg = document.getElementById("auth-error");

  errorMsg.innerText = "";

  if (isSignUpMode) {
    title.innerText = "Create New Account";
    submitBtn.innerText = "Sign Up";
    toggleText.innerText = "Already have an account?";
    toggleLink.innerText = "Login";
  } else {
    title.innerText = "Login to Account";
    submitBtn.innerText = "Login";
    toggleText.innerText = "Don't have an account?";
    toggleLink.innerText = "Sign Up";
  }
}

// Auth Submission Handler
async function handleAuth() {
  var email = document.getElementById("auth-email").value.trim();
  var password = document.getElementById("auth-password").value.trim();
  var errorMsg = document.getElementById("auth-error");

  if (!email || !password) {
    errorMsg.innerText = "Please enter email and password.";
    return;
  }

  if (isSignUpMode) {
    var res = await dbClient.auth.signUp({ email: email, password: password });
    if (res.error) {
      errorMsg.innerText = res.error.message;
    } else {
      currentUser = res.data.user;
      launchDashboard();
    }
  } else {
    var res = await dbClient.auth.signInWithPassword({ email: email, password: password });
    if (res.error) {
      errorMsg.innerText = res.error.message;
    } else {
      currentUser = res.data.user;
      launchDashboard();
    }
  }
}

// Logout Handler
async function handleLogout() {
  if (dbClient) {
    await dbClient.auth.signOut();
  }
  currentUser = null;
  document.getElementById("app-container").classList.add("hidden");
  document.getElementById("auth-overlay").classList.remove("hidden");
  document.getElementById("auth-email").value = "";
  document.getElementById("auth-password").value = "";
}

// Launch Dashboard After Login
async function launchDashboard() {
  document.getElementById("auth-overlay").classList.add("hidden");
  document.getElementById("app-container").classList.remove("hidden");

  var userDisplay = document.getElementById("user-display");
  if (userDisplay && currentUser) {
    userDisplay.innerText = "Logged in as: " + currentUser.email;
  }

  var todayStr = new Date().toISOString().split("T")[0];
  var dateInput = document.getElementById("tx-date");
  if (dateInput) dateInput.value = todayStr;

  var debtDateInput = document.getElementById("debt-date");
  if (debtDateInput) debtDateInput.value = todayStr;

  var currentMonth = new Date().toISOString().slice(0, 7);
  var monthFilter = document.getElementById("monthFilter");
  if (monthFilter) monthFilter.value = currentMonth;

  await loadDataFromSupabase();
}

// Load Authenticated User Data
async function loadDataFromSupabase() {
  if (!dbClient || !currentUser) return;

  try {
    var txRes = await dbClient.from("transactions").select("*").order("id", { ascending: false });
    if (!txRes.error) transactions = txRes.data || [];

    var loanRes = await dbClient.from("loans").select("*").order("id", { ascending: false });
    if (!loanRes.error) loans = loanRes.data || [];

    var debtRes = await dbClient.from("debts").select("*").order("id", { ascending: false });
    if (!debtRes.error) debts = debtRes.data || [];

    applyFilters();
  } catch (err) {
    console.error("Fetch Error:", err);
    applyFilters();
  }
}

// Add Transaction (Linked with user_id)
async function addTransaction(e) {
  e.preventDefault();
  if (!currentUser) return;

  var tx = {
    user_id: currentUser.id,
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
  if (dateInput) dateInput.value = new Date().toISOString().split("T")[0];
  await loadDataFromSupabase();
}

// Add Debt (Linked with user_id)
async function addDebt(e) {
  e.preventDefault();
  if (!currentUser) return;

  var debt = {
    user_id: currentUser.id,
    person_name: document.getElementById("debt-person").value.trim(),
    type: document.getElementById("debt-type").value,
    amount: parseFloat(document.getElementById("debt-amount").value),
    reason: document.getElementById("debt-reason").value.trim(),
    due_date: document.getElementById("debt-date").value || new Date().toISOString().split("T")[0],
    note: document.getElementById("debt-note").value.trim() || "",
    is_settled: false
  };

  if (dbClient) {
    var res = await dbClient.from("debts").insert([debt]);
    if (res.error) alert("Save Error: " + res.error.message);
  }

  document.getElementById("debt-form").reset();
  var debtDateInput = document.getElementById("debt-date");
  if (debtDateInput) debtDateInput.value = new Date().toISOString().split("T")[0];
  await loadDataFromSupabase();
}

// Add Loan (Linked with user_id)
async function addLoan(e) {
  e.preventDefault();
  if (!currentUser) return;

  var loan = {
    user_id: currentUser.id,
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

// Actions
async function toggleSettleDebt(id, currentStatus) {
  if (dbClient) {
    await dbClient.from("debts").update({ is_settled: !currentStatus }).eq("id", id);
    await loadDataFromSupabase();
  }
}

async function deleteTransaction(id) {
  if (dbClient) {
    await dbClient.from("transactions").delete().eq("id", id);
  }
  await loadDataFromSupabase();
}

async function deleteDebt(id) {
  if (confirm("Delete this record permanently?")) {
    if (dbClient) {
      await dbClient.from("debts").delete().eq("id", id);
      await loadDataFromSupabase();
    }
  }
}

async function deleteLoan(id) {
  if (dbClient) {
    await dbClient.from("loans").delete().eq("id", id);
  }
  await loadDataFromSupabase();
}

function toggleSettledView() {
  showSettled = !showSettled;
  document.getElementById("settled-toggle-btn").innerText = showSettled ? "Hide Settled" : "Show Settled";
  renderDebtTable();
}

// Consolidated Person Statement PDF
function generatePersonStatementPDF(targetPersonName) {
  var personRecords = debts.filter(function(d) {
    return d.person_name.trim().toLowerCase() === targetPersonName.trim().toLowerCase() && !d.is_settled;
  });

  if (personRecords.length === 0) {
    personRecords = debts.filter(function(d) {
      return d.person_name.trim().toLowerCase() === targetPersonName.trim().toLowerCase();
    });
  }

  if (personRecords.length === 0) {
    alert("No records found for " + targetPersonName);
    return;
  }

  var { jsPDF } = window.jspdf;
  var doc = new jsPDF();

  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, 210, 30, 'F');
  
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("STATEMENT OF ACCOUNT", 14, 18);

  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  doc.setFont("helvetica", "normal");
  doc.text("Statement Date: " + new Date().toLocaleDateString('en-IN'), 14, 40);
  doc.text("Statement For: " + targetPersonName, 14, 46);
  doc.text("Account Owner: " + (currentUser ? currentUser.email : "Self"), 14, 52);

  var totalLent = 0;
  var totalBorrowed = 0;

  var tableBody = personRecords.map(function(item, index) {
    var amt = parseFloat(item.amount) || 0;
    var isLent = (item.type === "give");

    if (isLent) totalLent += amt;
    else totalBorrowed += amt;

    return [
      index + 1,
      item.due_date ? item.due_date : "—",
      item.reason + (item.note ? "\n(" + item.note + ")" : ""),
      isLent ? "You Lent (+)" : "You Borrowed (-)",
      isLent ? "Rs. " + amt.toLocaleString('en-IN') : "-",
      !isLent ? "Rs. " + amt.toLocaleString('en-IN') : "-"
    ];
  });

  doc.autoTable({
    startY: 58,
    theme: 'grid',
    head: [['#', 'Txn Date', 'Purpose / Note', 'Type', 'Lent (Dr)', 'Borrowed (Cr)']],
    body: tableBody,
    headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 10, cellPadding: 5 },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 26 },
      2: { cellWidth: 60 },
      3: { cellWidth: 32 },
      4: { cellWidth: 28, halign: 'right' },
      5: { cellWidth: 28, halign: 'right' }
    }
  });

  var netBalance = totalLent - totalBorrowed;
  var finalY = doc.lastAutoTable.finalY + 10;

  doc.setFillColor(245, 247, 250);
  doc.rect(14, finalY, 182, 36, 'F');
  doc.setDrawColor(209, 213, 219);
  doc.rect(14, finalY, 182, 36, 'S');

  doc.setFontSize(10);
  doc.setTextColor(55, 65, 81);
  doc.setFont("helvetica", "normal");
  doc.text("Total Amount Lent (Aapne Diye):", 20, finalY + 8);
  doc.text("Rs. " + totalLent.toLocaleString('en-IN'), 185, finalY + 8, { align: 'right' });

  doc.text("Total Amount Borrowed (Aapne Liye):", 20, finalY + 16);
  doc.text("Rs. " + totalBorrowed.toLocaleString('en-IN'), 185, finalY + 16, { align: 'right' });

  doc.setLineWidth(0.3);
  doc.line(20, finalY + 20, 190, finalY + 20);

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  
  if (netBalance >= 0) {
    doc.setTextColor(22, 163, 74);
    doc.text("FINAL NET RECEIVABLE (To Receive):", 20, finalY + 29);
    doc.text("Rs. " + netBalance.toLocaleString('en-IN'), 185, finalY + 29, { align: 'right' });
  } else {
    doc.setTextColor(220, 38, 38);
    doc.text("FINAL NET PAYABLE (To Return):", 20, finalY + 29);
    doc.text("Rs. " + Math.abs(netBalance).toLocaleString('en-IN'), 185, finalY + 29, { align: 'right' });
  }

  doc.setFontSize(9);
  doc.setTextColor(140, 140, 140);
  doc.setFont("helvetica", "italic");
  doc.text("This is an electronically generated statement of record.", 14, finalY + 45);

  var safeName = targetPersonName.replace(/[^a-zA-Z0-9]/g, "_");
  doc.save("Statement_" + safeName + ".pdf");
}

// Summary Calculation
function updateSummaries(dataForTotals) {
  var dataList = dataForTotals || transactions;
  var totalBalance = 0;
  var filteredSpent = 0;

  dataList.forEach(function (t) {
    var amt = parseFloat(t.amount) || 0;
    if (t.type === "Income") {
      totalBalance += amt;
    } else {
      totalBalance -= amt;
      filteredSpent += amt;
    }
  });

  var totalEMI = loans.reduce(function (sum, l) {
    return sum + (parseFloat(l.emi) || 0);
  }, 0);

  var totalToReceive = 0;
  var totalToPay = 0;

  debts.forEach(function(d) {
    if (!d.is_settled) {
      var amt = parseFloat(d.amount) || 0;
      if (d.type === "give") {
        totalToReceive += amt;
      } else {
        totalToPay += amt;
      }
    }
  });

  var elBal = document.getElementById("total-balance-val");
  var elSpent = document.getElementById("today-spent-val");
  var elEmi = document.getElementById("total-emi-val");
  var elReceive = document.getElementById("total-receive-val");
  var elPay = document.getElementById("total-pay-val");

  if (elBal) elBal.innerText = "₹" + totalBalance.toLocaleString();
  if (elSpent) elSpent.innerText = "₹" + filteredSpent.toLocaleString();
  if (elEmi) elEmi.innerText = "₹" + totalEMI.toLocaleString() + " /mo";
  if (elReceive) elReceive.innerText = "₹" + totalToReceive.toLocaleString();
  if (elPay) elPay.innerText = "₹" + totalToPay.toLocaleString();
}

// Search & Filter
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
  renderDebtTable();
  renderLoanTable();
}

function clearMonthFilter() {
  var m = document.getElementById("monthFilter");
  if (m) m.value = "";
  applyFilters();
}

function filterTransactions() {
  applyFilters();
}

// Render DOM Tables
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

function renderDebtTable() {
  var debtList = document.getElementById("debt-list");
  if (!debtList) return;
  debtList.innerHTML = "";

  var filteredDebts = debts.filter(function(d) {
    return showSettled ? true : !d.is_settled;
  });

  if (filteredDebts.length === 0) {
    debtList.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#888;">No active records found</td></tr>';
    return;
  }

  filteredDebts.forEach(function (d) {
    var typeBadge = d.is_settled 
      ? '<span class="badge-settled">Settled</span>'
      : (d.type === "give" 
          ? '<span class="badge-give">Receivable 🟢</span>' 
          : '<span class="badge-take">Payable 🔴</span>');

    var cleanPersonParam = encodeURIComponent(d.person_name);

    var row = document.createElement("tr");
    row.innerHTML =
      "<td>" + (d.due_date || "—") + "</td>" +
      "<td><strong>" + d.person_name + "</strong><br><small>" + (d.note || "") + "</small></td>" +
      "<td>" + typeBadge + "</td>" +
      "<td>" + d.reason + "</td>" +
      "<td>₹" + parseFloat(d.amount).toLocaleString() + "</td>" +
      '<td>' +
        '<button class="btn-pdf" onclick="generatePersonStatementPDF(decodeURIComponent(\'' + cleanPersonParam + '\'))">📄 PDF</button>' +
        '<button class="btn-settle" onclick="toggleSettleDebt(' + d.id + ', ' + d.is_settled + ')">' + (d.is_settled ? 'Reopen' : '✓ Settle') + '</button>' +
        '<button class="btn-del" onclick="deleteDebt(' + d.id + ')">Del</button>' +
      '</td>';
    debtList.appendChild(row);
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
  applyFilters();
}

// Export CSV
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