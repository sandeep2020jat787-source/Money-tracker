// Supabase Configuration
var SUPABASE_URL = "https://vewtbsdpwtbuzmpthrpl.supabase.co";
var SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZld3Ric2Rwd3RidXptcHRocnBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4NTYwNDUsImV4cCI6MjEwMjQzMjA0NX0.uDcxgjnox3X7wXXyn-TaCYb-7miIWr8w_ak3hgLgozY";

var dbClient = null;
var currentUser = null;
var userProfile = null;
var isSignUpMode = false;
var uploadedPhotoBase64 = null;
var editPhotoBase64 = null;

var transactions = [];
var loans = [];
var debts = [];
var showSettled = false;

// Initialize Supabase Client
try {
  if (window.supabase) {
    dbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    checkCurrentSession();
  }
} catch (e) {
  console.error("Init Error:", e);
}

// Payment Mode Switcher (Cash vs Online Bank Dropdown)
function handlePaymentModeChange() {
  var modeSelect = document.getElementById("tx-payment-mode");
  var bankGroup = document.getElementById("bank-select-group");
  if (!modeSelect || !bankGroup) return;

  if (modeSelect.value === "Cash") {
    bankGroup.classList.add("hidden");
  } else {
    bankGroup.classList.remove("hidden");
  }
}

// Session Check on Load
async function checkCurrentSession() {
  if (!dbClient) return;

  dbClient.auth.onAuthStateChange(function(event, session) {
    if (event === "PASSWORD_RECOVERY") {
      document.getElementById("auth-overlay").classList.remove("hidden");
      document.getElementById("auth-main-box").classList.add("hidden");
      document.getElementById("auth-forgot-box").classList.add("hidden");
      document.getElementById("auth-new-pass-box").classList.remove("hidden");
    }
  });

  var { data } = await dbClient.auth.getSession();
  if (data && data.session && data.session.user) {
    currentUser = data.session.user;
    await fetchUserProfile();
    launchDashboard();
  }
}

// Fetch Profile from DB using maybeSingle (406 Fix)
async function fetchUserProfile() {
  if (!dbClient || !currentUser) return;

  try {
    var { data, error } = await dbClient
      .from("profiles")
      .select("*")
      .eq("id", currentUser.id)
      .maybeSingle();

    if (data) {
      userProfile = data;
    } else {
      var meta = currentUser.user_metadata || {};
      userProfile = {
        id: currentUser.id,
        full_name: meta.full_name || currentUser.email.split("@")[0],
        dob: meta.dob || "",
        avatar_url: meta.avatar_url || "https://api.dicebear.com/7.x/bottts/svg?seed=" + encodeURIComponent(currentUser.email)
      };

      await dbClient.from("profiles").upsert(userProfile);
    }
  } catch (err) {
    console.error("Profile Fetch Notice:", err);
    userProfile = {
      id: currentUser.id,
      full_name: currentUser.email.split("@")[0],
      dob: "",
      avatar_url: "https://api.dicebear.com/7.x/bottts/svg?seed=" + encodeURIComponent(currentUser.email)
    };
  }
}

// Handle Sign-Up Gallery Photo Upload & Compress
function handlePhotoUpload(event) {
  var file = event.target.files[0];
  if (!file) return;

  var reader = new FileReader();
  reader.onload = function(e) {
    var img = new Image();
    img.onload = function() {
      var canvas = document.createElement("canvas");
      var ctx = canvas.getContext("2d");
      var maxDim = 150;
      var width = img.width;
      var height = img.height;

      if (width > height) {
        if (width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      uploadedPhotoBase64 = canvas.toDataURL("image/jpeg", 0.85);
      var preview = document.getElementById("avatar-preview-img");
      if (preview) preview.src = uploadedPhotoBase64;
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// Handle Edit Profile Gallery Photo Upload
function handleEditPhotoUpload(event) {
  var file = event.target.files[0];
  if (!file) return;

  var reader = new FileReader();
  reader.onload = function(e) {
    var img = new Image();
    img.onload = function() {
      var canvas = document.createElement("canvas");
      var ctx = canvas.getContext("2d");
      var maxDim = 150;
      var width = img.width;
      var height = img.height;

      if (width > height) {
        if (width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      editPhotoBase64 = canvas.toDataURL("image/jpeg", 0.85);
      var preview = document.getElementById("edit-avatar-preview-img");
      if (preview) preview.src = editPhotoBase64;
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// Edit Profile Modal Controls
function openEditProfileModal() {
  if (!userProfile) return;
  document.getElementById("edit-fullname").value = userProfile.full_name || "";
  document.getElementById("edit-dob").value = userProfile.dob || "";
  document.getElementById("edit-avatar-preview-img").src = userProfile.avatar_url || "";
  document.getElementById("edit-profile-msg").innerText = "";
  editPhotoBase64 = null;
  document.getElementById("edit-profile-modal").classList.remove("hidden");
}

function closeEditProfileModal() {
  document.getElementById("edit-profile-modal").classList.add("hidden");
}

// Save Profile Changes
async function saveProfileChanges() {
  if (!currentUser || !dbClient) return;

  var newName = document.getElementById("edit-fullname").value.trim();
  var newDob = document.getElementById("edit-dob").value;
  var msg = document.getElementById("edit-profile-msg");

  if (!newName) {
    msg.style.color = "#f87171";
    msg.innerText = "Name cannot be empty.";
    return;
  }

  var updatedAvatar = editPhotoBase64 || userProfile.avatar_url;

  var updates = {
    id: currentUser.id,
    full_name: newName,
    dob: newDob,
    avatar_url: updatedAvatar,
    updated_at: new Date()
  };

  var { error } = await dbClient.from("profiles").upsert(updates);
  if (error) {
    msg.style.color = "#f87171";
    msg.innerText = "Error: " + error.message;
    return;
  }

  userProfile = updates;
  msg.style.color = "#4ade80";
  msg.innerText = "Profile updated successfully!";

  document.getElementById("user-name-display").innerText = userProfile.full_name;
  document.getElementById("user-avatar-img").src = userProfile.avatar_url;

  setTimeout(function() {
    closeEditProfileModal();
  }, 1000);
}

// Auth Toggle
function toggleAuthMode() {
  isSignUpMode = !isSignUpMode;
  var title = document.getElementById("auth-title");
  var subText = document.getElementById("auth-sub-text");
  var submitBtn = document.getElementById("auth-submit-btn");
  var toggleText = document.getElementById("auth-toggle-text");
  var toggleLink = document.getElementById("auth-toggle-link");
  var extraFields = document.getElementById("signup-extra-fields");
  var errorMsg = document.getElementById("auth-error");

  errorMsg.innerText = "";

  if (isSignUpMode) {
    title.innerText = "Create New Account";
    subText.innerText = "Join Apex Finance & manage your cashflow seamlessly";
    submitBtn.innerText = "Sign Up";
    toggleText.innerText = "Already have an account?";
    toggleLink.innerText = "Sign In";
    extraFields.classList.remove("hidden");
  } else {
    title.innerText = "Welcome Back";
    subText.innerText = "Enter your credentials to access your personal dashboard";
    submitBtn.innerText = "Sign In";
    toggleText.innerText = "Don't have an account?";
    toggleLink.innerText = "Create Account";
    extraFields.classList.add("hidden");
  }
}

// Auth Handler
async function handleAuth() {
  var email = document.getElementById("auth-email").value.trim();
  var password = document.getElementById("auth-password").value.trim();
  var errorMsg = document.getElementById("auth-error");

  if (!email || !password) {
    errorMsg.innerText = "Please enter email and password.";
    return;
  }

  if (isSignUpMode) {
    var fullName = document.getElementById("signup-fullname").value.trim() || email.split("@")[0];
    var dob = document.getElementById("signup-dob").value || "";
    var avatarUrl = uploadedPhotoBase64 || ("https://api.dicebear.com/7.x/bottts/svg?seed=" + encodeURIComponent(fullName));

    var res = await dbClient.auth.signUp({
      email: email,
      password: password,
      options: {
        data: { full_name: fullName, dob: dob, avatar_url: avatarUrl }
      }
    });

    if (res.error) {
      errorMsg.innerText = res.error.message;
      return;
    }

    currentUser = res.data.user;

    if (currentUser) {
      await dbClient.from("profiles").upsert({
        id: currentUser.id,
        full_name: fullName,
        dob: dob,
        avatar_url: avatarUrl
      });
    }

    await fetchUserProfile();
    launchDashboard();
  } else {
    var res = await dbClient.auth.signInWithPassword({ email: email, password: password });
    if (res.error) {
      errorMsg.innerText = res.error.message;
    } else {
      currentUser = res.data.user;
      await fetchUserProfile();
      launchDashboard();
    }
  }
}

// Forgot Password Flow
function openForgotPasswordModal() {
  document.getElementById("auth-main-box").classList.add("hidden");
  document.getElementById("auth-forgot-box").classList.remove("hidden");
  document.getElementById("forgot-msg").innerText = "";
}

function closeForgotPasswordModal() {
  document.getElementById("auth-forgot-box").classList.add("hidden");
  document.getElementById("auth-main-box").classList.remove("hidden");
  document.getElementById("forgot-msg").innerText = "";
}

async function sendPasswordResetEmail() {
  var email = document.getElementById("forgot-email-input").value.trim();
  var msg = document.getElementById("forgot-msg");

  if (!email) {
    msg.style.color = "#f87171";
    msg.innerText = "Please enter your email.";
    return;
  }

  var lastSentKey = "last_reset_sent_" + email.toLowerCase();
  var lastSentTime = localStorage.getItem(lastSentKey);
  var now = Date.now();

  if (lastSentTime) {
    var diffMinutes = Math.floor((now - parseInt(lastSentTime, 10)) / (1000 * 60));
    if (diffMinutes < 60) {
      var remaining = 60 - diffMinutes;
      msg.style.color = "#f87171";
      msg.innerText = "You can only request password reset once in 60 min. Try again in " + remaining + " minute(s).";
      return;
    }
  }

  var currentUrl = window.location.href.split("#")[0];
  var res = await dbClient.auth.resetPasswordForEmail(email, { redirectTo: currentUrl });

  if (res.error) {
    msg.style.color = "#f87171";
    msg.innerText = res.error.message;
  } else {
    localStorage.setItem(lastSentKey, now.toString());
    msg.style.color = "#4ade80";
    msg.innerText = "Recovery email sent! Check your Inbox / Spam folder.";
  }
}

async function updateNewPassword() {
  var newPass = document.getElementById("new-password-input").value.trim();
  var msg = document.getElementById("new-pass-msg");

  if (newPass.length < 6) {
    msg.style.color = "#f87171";
    msg.innerText = "Password must be at least 6 characters.";
    return;
  }

  var lastChangedTime = localStorage.getItem("last_password_changed_time");
  var now = Date.now();

  if (lastChangedTime) {
    var diffMinutes = Math.floor((now - parseInt(lastChangedTime, 10)) / (1000 * 60));
    if (diffMinutes < 60) {
      var remaining = 60 - diffMinutes;
      msg.style.color = "#f87171";
      msg.innerText = "Password can only be changed once in 60 min. Try after " + remaining + " min.";
      return;
    }
  }

  var res = await dbClient.auth.updateUser({ password: newPass });

  if (res.error) {
    msg.style.color = "#f87171";
    msg.innerText = res.error.message;
  } else {
    localStorage.setItem("last_password_changed_time", now.toString());
    msg.style.color = "#4ade80";
    msg.innerText = "Password updated successfully! Redirecting...";
    setTimeout(function() {
      document.getElementById("auth-new-pass-box").classList.add("hidden");
      document.getElementById("auth-main-box").classList.remove("hidden");
      handleLogout();
    }, 1500);
  }
}

// Logout Handler
async function handleLogout() {
  if (dbClient) await dbClient.auth.signOut();
  currentUser = null;
  userProfile = null;
  uploadedPhotoBase64 = null;
  document.getElementById("app-container").classList.add("hidden");
  document.getElementById("auth-overlay").classList.remove("hidden");
  document.getElementById("auth-main-box").classList.remove("hidden");
  document.getElementById("auth-forgot-box").classList.add("hidden");
  document.getElementById("auth-new-pass-box").classList.add("hidden");
  document.getElementById("auth-email").value = "";
  document.getElementById("auth-password").value = "";
}

// Launch Dashboard
async function launchDashboard() {
  document.getElementById("auth-overlay").classList.add("hidden");
  document.getElementById("app-container").classList.remove("hidden");

  if (userProfile && currentUser) {
    var nameEl = document.getElementById("user-name-display");
    var emailEl = document.getElementById("user-email-display");
    var avatarEl = document.getElementById("user-avatar-img");

    if (nameEl) nameEl.innerText = userProfile.full_name || "User";
    if (emailEl) emailEl.innerText = currentUser.email;
    if (avatarEl) avatarEl.src = userProfile.avatar_url || "https://api.dicebear.com/7.x/bottts/svg?seed=Sandy";
  }

  var todayStr = new Date().toISOString().split("T")[0];
  var dateInput = document.getElementById("tx-date");
  if (dateInput) dateInput.value = todayStr;

  var debtDateInput = document.getElementById("debt-date");
  if (debtDateInput) debtDateInput.value = todayStr;

  var currentMonth = new Date().toISOString().slice(0, 7);
  var monthFilter = document.getElementById("monthFilter");
  if (monthFilter) monthFilter.value = currentMonth;

  handlePaymentModeChange();
  await loadDataFromSupabase();
}

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

// Add Transaction with Cash vs Bank resolution
async function addTransaction(e) {
  e.preventDefault();
  if (!currentUser) return;

  var paymentMode = document.getElementById("tx-payment-mode").value;
  var chosenAccount = paymentMode === "Cash" 
    ? "Cash / Wallet" 
    : document.getElementById("tx-bank-name").value;

  var tx = {
    user_id: currentUser.id,
    date: document.getElementById("tx-date").value,
    account: chosenAccount,
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
  handlePaymentModeChange();
  await loadDataFromSupabase();
}

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
  if (confirm("Delete this ledger entry permanently?")) {
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
  doc.text("Account Created By: " + (userProfile ? userProfile.full_name : "User"), 14, 52);

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
  doc.text("Generated by Apex Finance | Crafted with Passion by Sandeep Choudhary", 14, finalY + 45);

  var safeName = targetPersonName.replace(/[^a-zA-Z0-9]/g, "_");
  doc.save("Statement_" + safeName + ".pdf");
}

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

function renderTransactionTable(dataToRender) {
  var data = dataToRender || transactions;
  var txList = document.getElementById("tx-list");
  var badge = document.getElementById("tx-count-badge");
  if (badge) badge.innerText = data.length + " Records";
  if (!txList) return;
  txList.innerHTML = "";

  data.forEach(function (t) {
    var row = document.createElement("tr");
    row.innerHTML =
      "<td>" + t.date + "</td>" +
      "<td><strong>" + t.category + "</strong><br><small style='color:#94a3b8;'>" + (t.note || "") + "</small></td>" +
      "<td>" + t.account + "</td>" +
      '<td class="' + (t.type === "Expense" ? "badge-expense" : "badge-income") + '">' + t.type + "</td>" +
      "<td>₹" + parseFloat(t.amount).toLocaleString() + "</td>" +
      '<td><button class="btn-del" onclick="deleteTransaction(' + t.id + ')">Delete</button></td>';
    txList.appendChild(row);
  });
}

function renderDebtTable() {
  var debtList = document.getElementById("debt-list");
  var badge = document.getElementById("debt-count-badge");
  if (!debtList) return;
  debtList.innerHTML = "";

  var filteredDebts = debts.filter(function(d) {
    return showSettled ? true : !d.is_settled;
  });

  if (badge) badge.innerText = filteredDebts.length + " People";

  if (filteredDebts.length === 0) {
    debtList.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#64748b;">No active ledger records</td></tr>';
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
      "<td><strong>" + d.person_name + "</strong><br><small style='color:#94a3b8;'>" + (d.note || "") + "</small></td>" +
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
  var badge = document.getElementById("loan-count-badge");
  if (badge) badge.innerText = loans.length + " Loans";
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
    ["ID", "Date", "Category", "Type", "Amount (INR)", "Payment Source", "Note"]
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

// AI Sandy
function openAISandyModal() {
  document.getElementById("ai-sandy-modal").classList.remove("hidden");
}

function closeAISandyModal() {
  document.getElementById("ai-sandy-modal").classList.add("hidden");
}

function handleAIAssistantKey(e) {
  if (e.key === "Enter") sendQueryToAISandy();
}

function sendQuickPrompt(promptText) {
  var input = document.getElementById("ai-user-query");
  if (input) input.value = promptText;
  sendQueryToAISandy();
}

function sendQueryToAISandy() {
  var input = document.getElementById("ai-user-query");
  var query = input.value.trim();
  if (!query) return;

  var chatBody = document.getElementById("ai-chat-body");
  var userDiv = document.createElement("div");
  userDiv.className = "ai-message user";
  userDiv.innerHTML = "<strong>You:</strong><p>" + query + "</p>";
  chatBody.appendChild(userDiv);
  input.value = "";
  chatBody.scrollTop = chatBody.scrollHeight;

  setTimeout(function() {
    var response = generateAISandyResponse(query);
    var botDiv = document.createElement("div");
    botDiv.className = "ai-message bot";
    botDiv.innerHTML = "<strong>AI Sandy:</strong><p>" + response + "</p>";
    chatBody.appendChild(botDiv);
    chatBody.scrollTop = chatBody.scrollHeight;
  }, 600);
}

function generateAISandyResponse(q) {
  var lower = q.toLowerCase();

  if (lower.includes("cash") || lower.includes("bank") || lower.includes("source") || lower.includes("online")) {
    return "When adding a transaction, select <strong>Cash / Physical Wallet</strong> for cash transactions or <strong>Online / Net Banking / UPI</strong> to select from India's major public, private, and payment banks!";
  }

  if (lower.includes("pdf") || lower.includes("statement") || lower.includes("share")) {
    return "To generate a PDF statement for anyone: Go to <strong>Dues & Receivables (Ledger)</strong> on the right side. Click the <strong>📄 PDF</strong> button to download an official itemized PDF statement.";
  }

  if (lower.includes("khata") || lower.includes("due") || lower.includes("receivable") || lower.includes("lent") || lower.includes("borrow")) {
    return "The <strong>Dues & Receivables (Khata)</strong> section lets you record when you give money (Receivable 🟢) or borrow money (Payable 🔴) with automatic net-balancing.";
  }

  if (lower.includes("excel") || lower.includes("csv") || lower.includes("export") || lower.includes("download")) {
    return "Click the green <strong>📥 Export Excel (CSV)</strong> button at the top right toolbar to download your lifetime or monthly records.";
  }

  if (lower.includes("profile") || lower.includes("edit") || lower.includes("photo") || lower.includes("picture")) {
    return "You can update your profile name, date of birth, or profile gallery photo anytime by clicking the gear icon (⚙️) next to your logout button in the top navigation bar.";
  }

  if (lower.includes("creator") || lower.includes("who made") || lower.includes("sandeep") || lower.includes("developer")) {
    return "Apex Finance is proudly designed and built by <strong>Sandeep Choudhary</strong>, an Automotive Tech & Software Engineer!";
  }

  return "I'm always here to assist you with Apex Finance! Ask me about cash vs bank sources, borrower PDF statements, loans, or profile updates.";
}