// Database Configuration
var SUPABASE_URL = "https://vewtbsdpwtbuzmpthrpl.supabase.co";
var SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZld3Ric2Rwd3RidXptcHRocnBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4NTYwNDUsImV4cCI6MjEwMjQzMjA0NX0.uDcxgjnox3X7wXXyn-TaCYb-7miIWr8w_ak3hgLgozY";

var dbClient = null;
var transactions = [];
var loans = [];
var debts = [];
var appSecurity = { pin: "1234", recovery_phone: "9999999999" };
var showSettled = false;

// Initialize Supabase Client
try {
  if (window.supabase) {
    dbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    fetchSecuritySettings();
  }
} catch (e) {
  console.error("Init Error:", e);
}

// Fetch PIN and Recovery Details
async function fetchSecuritySettings() {
  if (!dbClient) return;
  try {
    var res = await dbClient.from("app_settings").select("*").eq("id", 1).single();
    if (res.data) {
      appSecurity = res.data;
    }
  } catch (err) {
    console.error("Settings load error:", err);
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

    var debtRes = await dbClient.from("debts").select("*").order("id", { ascending: false });
    if (!debtRes.error) debts = debtRes.data || [];

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

// Add Debt / Receivable
async function addDebt(e) {
  e.preventDefault();
  var debt = {
    person_name: document.getElementById("debt-person").value.trim(),
    type: document.getElementById("debt-type").value,
    amount: parseFloat(document.getElementById("debt-amount").value),
    reason: document.getElementById("debt-reason").value.trim(),
    due_date: document.getElementById("debt-date").value || null,
    note: document.getElementById("debt-note").value.trim() || "",
    is_settled: false
  };

  if (dbClient) {
    var res = await dbClient.from("debts").insert([debt]);
    if (res.error) alert("Save Error: " + res.error.message);
  }

  document.getElementById("debt-form").reset();
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

// Action Handlers
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

// PDF Generation for Individual Record
function generatePersonStatementPDF(debtId) {
  var item = debts.find(function(d) { return d.id === debtId; });
  if (!item) return;

  var { jsPDF } = window.jspdf;
  var doc = new jsPDF();

  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, 210, 28, 'F');
  
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text("PAYMENT STATEMENT & RECEIPT", 14, 18);

  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  doc.text("Generated On: " + new Date().toLocaleDateString('en-IN'), 14, 38);
  doc.text("Statement For: " + item.person_name, 14, 44);
  doc.text("Status: " + (item.is_settled ? "SETTLED / PAID" : "PENDING DUES"), 14, 50);

  var tableData = [
    ["Type / Relationship", item.type === "give" ? "Receivable (Lent / Given)" : "Payable (Borrowed)"],
    ["Total Amount", "Rs. " + parseFloat(item.amount).toLocaleString('en-IN')],
    ["Purpose / Category", item.reason],
    ["Expected Due Date", item.due_date ? item.due_date : "Not Specified"],
    ["Remarks / Note", item.note ? item.note : "None"],
    ["Payment Status", item.is_settled ? "Cleared" : "Unsettled / Active"]
  ];

  doc.autoTable({
    startY: 56,
    theme: 'grid',
    head: [['Particulars', 'Details']],
    body: tableData,
    headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 11, cellPadding: 6 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 70 },
      1: { cellWidth: 110 }
    }
  });

  var finalY = doc.lastAutoTable.finalY + 15;
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text("This is an electronically generated statement of record.", 14, finalY);

  var safeName = item.person_name.replace(/[^a-zA-Z0-9]/g, "_");
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

// Render Tables
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

    var row = document.createElement("tr");
    row.innerHTML =
      "<td><strong>" + d.person_name + "</strong><br><small>" + (d.note || "") + "</small></td>" +
      "<td>" + typeBadge + "</td>" +
      "<td>" + d.reason + "</td>" +
      "<td>₹" + parseFloat(d.amount).toLocaleString() + "</td>" +
      "<td>" + (d.due_date || "—") + "</td>" +
      '<td>' +
        '<button class="btn-pdf" onclick="generatePersonStatementPDF(' + d.id + ')">📄 PDF</button>' +
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

// Mobile CSV Export
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

// Security & Password Handlers
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