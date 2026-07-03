// ============================================
// FIREBASE CONFIGURATION
// ============================================
const firebaseConfig = {
    apiKey: "AIzaSyDLUo4kxlqf7uNeSAAmKScukS40LJDjcFc",
    authDomain: "donation-29958.firebaseapp.com",
    projectId: "donation-29958",
    storageBucket: "donation-29958.firebasestorage.app",
    messagingSenderId: "1000245549571",
    appId: "1:1000245549571:web:b0b5a0ba0aca6397834c36"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ============================================
// PAYSTACK CONFIGURATION
// ============================================
const PAYSTACK_PUBLIC_KEY = "pk_test_45266cc0f0e405eca9e31657971fe88ee5b375f8";

// ============================================
// CURRENCY SETTINGS - NIGERIAN NAIRA
// ============================================
const CURRENCY = 'NGN'; // Nigerian Naira
const CURRENCY_SYMBOL = '₦'; // Naira symbol

// ============================================
// STATE MANAGEMENT
// ============================================
let currentUser = null;
let isAdmin = false;
let unsubscribeDonations = null;
let unsubscribeExpenses = null;
let unsubscribeCategories = null;
let listenersStarted = false;

// ============================================
// DOM REFERENCES WITH ERROR CHECKING
// ============================================
function getElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.warn(`Element with id "${id}" not found`);
    }
    return element;
}

const sections = {
    home: getElement('homeSection'),
    login: getElement('loginSection'),
    register: getElement('registerSection'),
    donate: getElement('donateSection'),
    admin: getElement('adminSection')
};

const nav = {
    home: getElement('homeLink'),
    donate: getElement('donateLink'),
    admin: getElement('adminLink'),
    login: getElement('loginBtn'),
    register: getElement('registerBtn'),
    logout: getElement('logoutBtn')
};

const forms = {
    login: getElement('loginForm'),
    register: getElement('registerForm'),
    donation: getElement('donationForm'),
    expense: getElement('expenseForm'),
    addCategory: getElement('addCategoryForm')
};

// ============================================
// TOAST NOTIFICATION
// ============================================
function showToast(message, type = 'success') {
    const toast = getElement('toast');
    if (!toast) {
        console.log('Toast:', message, type);
        return;
    }
    toast.textContent = message;
    toast.className = `toast ${type}`;
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);
    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

// ============================================
// NAVIGATION
// ============================================
function showSection(sectionId) {
    Object.values(sections).forEach(section => {
        if (section) section.classList.remove('active');
    });
    
    const target = getElement(sectionId);
    if (target) {
        target.classList.add('active');
    }

    document.querySelectorAll('.nav-links a').forEach(link => {
        link.classList.remove('active');
    });

    const linkMap = {
        'homeSection': nav.home,
        'loginSection': nav.login,
        'registerSection': nav.register,
        'donateSection': nav.donate,
        'adminSection': nav.admin
    };

    if (linkMap[sectionId] && linkMap[sectionId]) {
        linkMap[sectionId].classList.add('active');
    }
}

if (nav.home) {
    nav.home.addEventListener('click', (e) => {
        e.preventDefault();
        showSection('homeSection');
        loadHomeStats();
        loadCategories();
    });
}

if (nav.donate) {
    nav.donate.addEventListener('click', (e) => {
        e.preventDefault();
        if (currentUser) {
            showSection('donateSection');
            const donorEmail = getElement('donorEmail');
            if (donorEmail) donorEmail.value = currentUser.email;
        } else {
            showToast('Please login first to make a donation', 'error');
            showSection('loginSection');
        }
    });
}

if (nav.admin) {
    nav.admin.addEventListener('click', (e) => {
        e.preventDefault();
        if (isAdmin) {
            showSection('adminSection');
            startRealTimeListeners();
        } else {
            showToast('Admin access required', 'error');
        }
    });
}

if (nav.login) {
    nav.login.addEventListener('click', (e) => {
        e.preventDefault();
        showSection('loginSection');
    });
}

if (nav.register) {
    nav.register.addEventListener('click', (e) => {
        e.preventDefault();
        showSection('registerSection');
    });
}

if (nav.logout) {
    nav.logout.addEventListener('click', (e) => {
        e.preventDefault();
        auth.signOut();
    });
}

// ============================================
// AUTHENTICATION
// ============================================
if (forms.login) {
    forms.login.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = getElement('loginEmail');
        const password = getElement('loginPassword');
        
        if (!email || !password) {
            showToast('Please fill in all fields', 'error');
            return;
        }

        try {
            await auth.signInWithEmailAndPassword(email.value, password.value);
            showToast('Login successful!');
            forms.login.reset();
            showSection('homeSection');
            loadHomeStats();
        } catch (error) {
            showToast(error.message, 'error');
        }
    });
}

if (forms.register) {
    forms.register.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = getElement('registerName');
        const email = getElement('registerEmail');
        const password = getElement('registerPassword');

        if (!name || !email || !password) {
            showToast('Please fill in all fields', 'error');
            return;
        }

        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email.value, password.value);
            await db.collection('users').doc(userCredential.user.uid).set({
                name: name.value,
                email: email.value,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                isAdmin: false
            });
            showToast('Registration successful!');
            forms.register.reset();
            showSection('homeSection');
            loadHomeStats();
        } catch (error) {
            showToast(error.message, 'error');
        }
    });
}

// Auth State Observer
auth.onAuthStateChanged(async (user) => {
    console.log('Auth state changed:', user ? 'Logged in' : 'Logged out');
    
    if (user) {
        currentUser = user;
        if (nav.login) nav.login.style.display = 'none';
        if (nav.register) nav.register.style.display = 'none';
        if (nav.logout) nav.logout.style.display = 'inline-block';
        if (nav.donate) nav.donate.style.display = 'inline-block';

        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (userDoc.exists) {
                isAdmin = userDoc.data().isAdmin || false;
                console.log('Is admin:', isAdmin);
                if (isAdmin) {
                    if (nav.admin) nav.admin.style.display = 'inline-block';
                    if (sections.admin && sections.admin.classList.contains('active')) {
                        startRealTimeListeners();
                    }
                } else {
                    if (nav.admin) nav.admin.style.display = 'none';
                }
            }
        } catch (error) {
            console.error('Error checking admin status:', error);
        }

        const donorEmail = getElement('donorEmail');
        if (donorEmail) donorEmail.value = user.email;
        
        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (userDoc.exists && userDoc.data().name) {
                const donorName = getElement('donorName');
                if (donorName) donorName.value = userDoc.data().name;
            }
        } catch (error) {
            console.error('Error fetching user name:', error);
        }
    } else {
        currentUser = null;
        isAdmin = false;
        if (nav.login) nav.login.style.display = 'inline-block';
        if (nav.register) nav.register.style.display = 'inline-block';
        if (nav.logout) nav.logout.style.display = 'none';
        if (nav.donate) nav.donate.style.display = 'none';
        if (nav.admin) nav.admin.style.display = 'none';
        
        stopRealTimeListeners();
        listenersStarted = false;
    }
});

// ============================================
// 🚀 REAL-TIME LISTENERS
// ============================================

function startRealTimeListeners() {
    console.log('Starting real-time listeners...');
    
    if (listenersStarted) {
        console.log('Listeners already started');
        return;
    }
    
    if (!sections.admin || !sections.admin.classList.contains('active')) {
        console.log('Admin section not active, will start when admin tab is clicked');
        return;
    }
    
    stopRealTimeListeners();
    
    try {
        console.log('Setting up donations listener...');
        unsubscribeDonations = db.collection('donations')
            .where('status', '==', 'completed')
            .onSnapshot((snapshot) => {
                console.log('🔄 Donations updated in real-time (count:', snapshot.size, ')');
                renderDonations(snapshot);
                loadHomeStats();
            }, (error) => {
                console.error('Error listening to donations:', error);
                if (error.message && error.message.includes('index')) {
                    showToast('⚠️ Please create the required index in Firebase Console', 'error');
                    console.log('Create index at:', error.message.match(/https:\/\/[^\s]+/)?.[0] || 'Firebase Console');
                } else {
                    showToast('Error loading donations: ' + error.message, 'error');
                }
            });
        console.log('✅ Donations listener started');
        listenersStarted = true;
    } catch (error) {
        console.error('Failed to start donations listener:', error);
    }
    
    try {
        unsubscribeExpenses = db.collection('expenses')
            .orderBy('date', 'desc')
            .onSnapshot((snapshot) => {
                console.log('🔄 Expenses updated in real-time');
                renderExpenses(snapshot);
            }, (error) => {
                console.error('Error listening to expenses:', error);
            });
        console.log('✅ Expenses listener started');
    } catch (error) {
        console.error('Failed to start expenses listener:', error);
    }
    
    try {
        unsubscribeCategories = db.collection('categories')
            .orderBy('createdAt', 'desc')
            .onSnapshot((snapshot) => {
                console.log('🔄 Categories updated in real-time');
                renderCategories(snapshot);
            }, (error) => {
                console.error('Error listening to categories:', error);
            });
        console.log('✅ Categories listener started');
    } catch (error) {
        console.error('Failed to start categories listener:', error);
    }
    
    showToast('🔄 Real-time updates active', 'info');
}

function stopRealTimeListeners() {
    console.log('Stopping real-time listeners...');
    
    if (unsubscribeDonations) {
        unsubscribeDonations();
        unsubscribeDonations = null;
        console.log('✅ Donations listener stopped');
    }
    if (unsubscribeExpenses) {
        unsubscribeExpenses();
        unsubscribeExpenses = null;
        console.log('✅ Expenses listener stopped');
    }
    if (unsubscribeCategories) {
        unsubscribeCategories();
        unsubscribeCategories = null;
        console.log('✅ Categories listener stopped');
    }
    listenersStarted = false;
}

// ============================================
// RENDER DONATIONS - WITH NAIRA CURRENCY
// ============================================

function renderDonations(snapshot) {
    const list = getElement('donationsList');
    if (!list) {
        console.warn('donationsList element not found');
        return;
    }

    list.innerHTML = '';

    let totalAmount = 0;
    let totalDonations = 0;
    let uniqueDonors = new Set();

    if (snapshot.empty) {
        list.innerHTML = '<p style="text-align: center; color: #888; padding: 40px;">No donations yet</p>';
        const adminTotalDonations = getElement('adminTotalDonations');
        const adminTotalAmount = getElement('adminTotalAmount');
        const adminTotalDonors = getElement('adminTotalDonors');
        if (adminTotalDonations) adminTotalDonations.textContent = '0';
        if (adminTotalAmount) adminTotalAmount.textContent = `${CURRENCY_SYMBOL}0`;
        if (adminTotalDonors) adminTotalDonors.textContent = '0';
        return;
    }

    const donations = [];
    snapshot.forEach(doc => {
        const data = doc.data();
        data.id = doc.id;
        donations.push(data);
    });
    
    donations.sort((a, b) => {
        const dateA = a.createdAt ? a.createdAt.toDate?.() || new Date(0) : new Date(0);
        const dateB = b.createdAt ? b.createdAt.toDate?.() || new Date(0) : new Date(0);
        return dateB - dateA;
    });

    donations.forEach(data => {
        totalAmount += data.amount || 0;
        totalDonations++;
        if (data.donorEmail) {
            uniqueDonors.add(data.donorEmail);
        }

        const item = document.createElement('div');
        item.className = 'donation-item';
        
        let date = 'N/A';
        if (data.createdAt) {
            try {
                date = data.createdAt.toDate ? data.createdAt.toDate().toLocaleDateString() : 'N/A';
            } catch (e) {
                date = 'N/A';
            }
        }
        
        const categoryName = data.category || 'Uncategorized';
        
        item.innerHTML = `
            <div class="donor-info">
                <div class="donor-name">${data.donorName || 'Anonymous'}</div>
                <div class="donor-email">${data.donorEmail || 'No email'}</div>
                <span class="donor-category">${categoryName}</span>
                ${data.message ? `<div class="donor-message">"${data.message}"</div>` : ''}
                <div class="donation-date">${date}</div>
                ${data.paymentReference ? `<div style="font-size:0.7rem;color:#aaa;">Ref: ${data.paymentReference}</div>` : ''}
            </div>
            <div style="text-align: right;">
                <div class="donation-amount">${CURRENCY_SYMBOL}${(data.amount || 0).toFixed(2)}</div>
                <span class="payment-status">✅ Paid</span>
            </div>
        `;
        list.appendChild(item);
    });

    const adminTotalDonations = getElement('adminTotalDonations');
    const adminTotalAmount = getElement('adminTotalAmount');
    const adminTotalDonors = getElement('adminTotalDonors');
    
    if (adminTotalDonations) adminTotalDonations.textContent = totalDonations;
    if (adminTotalAmount) adminTotalAmount.textContent = `${CURRENCY_SYMBOL}${totalAmount.toFixed(2)}`;
    if (adminTotalDonors) adminTotalDonors.textContent = uniqueDonors.size;
}

// ============================================
// RENDER EXPENSES - WITH NAIRA CURRENCY
// ============================================

function renderExpenses(snapshot) {
    const list = getElement('expensesList');
    if (!list) {
        console.warn('expensesList element not found');
        return;
    }

    list.innerHTML = '';

    let totalExpenses = 0;

    if (snapshot.empty) {
        list.innerHTML = '<p style="text-align: center; color: #888; padding: 40px;">No expenses recorded yet</p>';
        const totalExpensesEl = getElement('totalExpenses');
        if (totalExpensesEl) totalExpensesEl.textContent = `${CURRENCY_SYMBOL}0`;
        return;
    }

    snapshot.forEach(doc => {
        const data = doc.data();
        totalExpenses += data.amount || 0;

        const item = document.createElement('div');
        item.className = 'expense-item';
        item.innerHTML = `
            <div class="expense-info">
                <div class="expense-desc">${data.description || 'No description'}</div>
                <div class="expense-category">${data.category || 'Uncategorized'}</div>
                ${data.notes ? `<div class="expense-notes">${data.notes}</div>` : ''}
                <div class="expense-date">${data.date || 'N/A'}</div>
            </div>
            <div style="display: flex; align-items: center;">
                <div class="expense-amount">${CURRENCY_SYMBOL}${(data.amount || 0).toFixed(2)}</div>
                <button class="delete-expense" onclick="deleteExpense('${doc.id}')">×</button>
            </div>
        `;
        list.appendChild(item);
    });

    const totalExpensesEl = getElement('totalExpenses');
    if (totalExpensesEl) totalExpensesEl.textContent = `${CURRENCY_SYMBOL}${totalExpenses.toFixed(2)}`;

    db.collection('donations')
        .where('status', '==', 'completed')
        .get()
        .then((donationSnapshot) => {
            let totalDonations = 0;
            donationSnapshot.forEach(doc => {
                totalDonations += doc.data().amount || 0;
            });
            const remaining = totalDonations - totalExpenses;
            const remainingEl = getElement('remainingFunds');
            if (remainingEl) remainingEl.textContent = `${CURRENCY_SYMBOL}${remaining.toFixed(2)}`;
        })
        .catch(error => {
            console.error('Error calculating remaining funds:', error);
        });
}

// ============================================
// RENDER CATEGORIES - WITH NAIRA CURRENCY
// ============================================

function renderCategories(snapshot) {
    console.log('Rendering categories, count:', snapshot.size);
    
    const grid = getElement('categoryGrid');
    if (grid) {
        grid.innerHTML = '';
        
        if (snapshot.empty) {
            grid.innerHTML = '<p style="text-align:center;color:#888;grid-column:1/-1;">No categories yet</p>';
            return;
        }
        
        db.collection('donations')
            .where('status', '==', 'completed')
            .get()
            .then((donationSnapshot) => {
                const categoryTotals = {};
                donationSnapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.category) {
                        categoryTotals[data.category] = (categoryTotals[data.category] || 0) + data.amount;
                    }
                });

                snapshot.forEach(doc => {
                    const data = doc.data();
                    const total = categoryTotals[data.name] || 0;
                    const card = document.createElement('div');
                    card.className = 'category-card';
                    card.innerHTML = `
                        <div class="icon">${data.icon || '📦'}</div>
                        <h4>${data.name || 'Unnamed'}</h4>
                        <div class="raised">${CURRENCY_SYMBOL}${total.toFixed(2)} raised</div>
                    `;
                    grid.appendChild(card);
                });
            })
            .catch(error => {
                console.error('Error getting category totals:', error);
            });
    }

    const list = getElement('categoriesList');
    if (list && isAdmin) {
        list.innerHTML = '';
        
        if (snapshot.empty) {
            list.innerHTML = '<p style="text-align:center;color:#888;padding:20px;">No categories created yet</p>';
            return;
        }
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const item = document.createElement('div');
            item.className = 'category-item';
            item.innerHTML = `
                <div class="category-info">
                    <span class="category-icon">${data.icon || '📦'}</span>
                    <div>
                        <div class="category-name">${data.name || 'Unnamed'}</div>
                        <div class="category-desc">${data.description || ''}</div>
                    </div>
                </div>
                <div>
                    <button class="delete-category" onclick="deleteCategory('${doc.id}')">Delete</button>
                </div>
            `;
            list.appendChild(item);
        });
    }

    const select = getElement('donationCategory');
    if (select) {
        select.innerHTML = '<option value="">Select a category...</option>';
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const option = document.createElement('option');
            option.value = data.name || 'other';
            option.textContent = `${data.icon || '📦'} ${data.name || 'Unnamed'}`;
            select.appendChild(option);
        });

        const otherOption = document.createElement('option');
        otherOption.value = 'other';
        otherOption.textContent = '❤️ Other';
        select.appendChild(otherOption);
    }
}

// ============================================
// 🎯 PAYMENT INTEGRATION - PAYSTACK (NGN)
// ============================================

function initializePaystackPayment(donationData) {
    return new Promise((resolve, reject) => {
        const reference = 'DON-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
        
        try {
            const handler = PaystackPop.setup({
                key: PAYSTACK_PUBLIC_KEY,
                email: donationData.donorEmail,
                amount: donationData.amount * 100, // Convert to kobo (NGN smallest unit)
                currency: CURRENCY, // 'NGN' for Nigerian Naira
                ref: reference,
                metadata: {
                    custom_fields: [
                        {
                            display_name: "Donor Name",
                            variable_name: "donor_name",
                            value: donationData.donorName
                        },
                        {
                            display_name: "Category",
                            variable_name: "category",
                            value: donationData.category
                        }
                    ]
                },
                callback: function(response) {
                    resolve({
                        success: true,
                        reference: response.reference,
                        transactionId: response.transaction,
                        status: 'success'
                    });
                },
                onClose: function() {
                    reject(new Error('Payment window closed by user'));
                }
            });

            handler.openIframe();
        } catch (error) {
            reject(new Error('Failed to initialize payment: ' + error.message));
        }
    });
}

// ============================================
// SAVE DONATION TO FIREBASE
// ============================================

async function saveDonationToFirebase(donationData) {
    try {
        await db.collection('donations').add({
            donorName: donationData.donorName,
            donorEmail: donationData.donorEmail,
            category: donationData.category,
            amount: donationData.amount,
            message: donationData.message || '',
            userId: currentUser.uid,
            status: 'completed',
            paymentReference: donationData.paymentReference,
            transactionId: donationData.transactionId,
            currency: CURRENCY, // Store currency type
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            paymentDate: firebase.firestore.FieldValue.serverTimestamp()
        });
        return true;
    } catch (error) {
        console.error('Error saving donation:', error);
        throw error;
    }
}

// ============================================
// 🎯 DONATION FORM HANDLER
// ============================================

if (forms.donation) {
    forms.donation.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!currentUser) {
            showToast('Please login to make a donation', 'error');
            showSection('loginSection');
            return;
        }

        const name = getElement('donorName');
        const email = getElement('donorEmail');
        const category = getElement('donationCategory');
        const amount = getElement('donationAmount');
        const message = getElement('donationMessage');

        if (!name || !email || !category || !amount) {
            showToast('Please fill in all fields', 'error');
            return;
        }

        const amountValue = parseFloat(amount.value);
        
        if (!name.value || !email.value || !category.value || !amountValue || amountValue < 1) {
            showToast('Please fill in all fields correctly', 'error');
            return;
        }

        const payBtn = getElement('payNowBtn');
        if (payBtn) {
            payBtn.disabled = true;
            payBtn.textContent = 'Processing...';
        }

        try {
            const donationData = {
                donorName: name.value,
                donorEmail: email.value,
                category: category.value,
                amount: amountValue,
                message: message ? message.value : ''
            };

            const paymentResult = await initializePaystackPayment(donationData);

            await saveDonationToFirebase({
                ...donationData,
                paymentReference: paymentResult.reference,
                transactionId: paymentResult.transactionId
            });

            showToast(`🎉 Thank you for your donation of ${CURRENCY_SYMBOL}${amountValue}!`, 'success');
            
            forms.donation.reset();
            if (email) email.value = currentUser.email;
            
            loadHomeStats();
            showSection('homeSection');
            
        } catch (error) {
            if (error.message === 'Payment window closed by user') {
                showToast('Payment was cancelled', 'info');
            } else {
                showToast('Payment failed: ' + error.message, 'error');
                console.error('Payment error:', error);
            }
        } finally {
            if (payBtn) {
                payBtn.disabled = false;
                payBtn.textContent = `💳 Pay Now with Paystack (${CURRENCY_SYMBOL})`;
            }
        }
    });
}

// ============================================
// ADMIN FUNCTIONS
// ============================================

async function clearAllDonations() {
    if (!isAdmin) {
        showToast('Admin access required', 'error');
        return;
    }

    if (!confirm('⚠️ Are you sure you want to delete ALL donations? This action cannot be undone!')) {
        return;
    }

    try {
        const snapshot = await db.collection('donations').get();
        const batch = db.batch();
        snapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        showToast('All donations cleared');
    } catch (error) {
        showToast('Error clearing donations: ' + error.message, 'error');
    }
}

async function deleteExpense(expenseId) {
    if (!isAdmin) {
        showToast('Admin access required', 'error');
        return;
    }

    if (!confirm('Delete this expense?')) return;

    try {
        await db.collection('expenses').doc(expenseId).delete();
        showToast('Expense deleted');
    } catch (error) {
        showToast('Error deleting expense: ' + error.message, 'error');
    }
}

function showAddExpense() {
    const modal = getElement('expenseModal');
    if (!modal) return;
    modal.style.display = 'block';
    
    const dateInput = getElement('expenseDate');
    if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }
}

function closeModal(modalId) {
    const modal = getElement(modalId);
    if (modal) modal.style.display = 'none';
}

window.onclick = function(event) {
    const modal = getElement('expenseModal');
    if (event.target == modal) {
        modal.style.display = 'none';
    }
}

if (forms.expense) {
    forms.expense.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!isAdmin) {
            showToast('Admin access required', 'error');
            return;
        }

        const description = getElement('expenseDescription');
        const category = getElement('expenseCategory');
        const amount = getElement('expenseAmount');
        const date = getElement('expenseDate');
        const notes = getElement('expenseNotes');

        if (!description || !category || !amount || !date) {
            showToast('Please fill in all fields', 'error');
            return;
        }

        try {
            await db.collection('expenses').add({
                description: description.value,
                category: category.value,
                amount: parseFloat(amount.value),
                date: date.value,
                notes: notes ? notes.value : '',
                createdBy: currentUser.uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            showToast('Expense added successfully!');
            forms.expense.reset();
            closeModal('expenseModal');
        } catch (error) {
            showToast('Error adding expense: ' + error.message, 'error');
        }
    });
}

// ============================================
// CATEGORY FUNCTIONS
// ============================================

if (forms.addCategory) {
    forms.addCategory.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!isAdmin) {
            showToast('Admin access required', 'error');
            return;
        }

        const name = getElement('newCategoryName');
        const icon = getElement('newCategoryIcon');
        const description = getElement('newCategoryDesc');

        if (!name || !icon) {
            showToast('Please fill in name and icon', 'error');
            return;
        }

        try {
            await db.collection('categories').add({
                name: name.value,
                icon: icon.value || '📦',
                description: description ? description.value : '',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdBy: currentUser.uid
            });

            showToast('Category added successfully!');
            forms.addCategory.reset();
        } catch (error) {
            showToast('Error adding category: ' + error.message, 'error');
        }
    });
}

async function deleteCategory(categoryId) {
    if (!isAdmin) {
        showToast('Admin access required', 'error');
        return;
    }

    if (!confirm('Delete this category?')) return;

    try {
        await db.collection('categories').doc(categoryId).delete();
        showToast('Category deleted');
    } catch (error) {
        showToast('Error deleting category: ' + error.message, 'error');
    }
}

// ============================================
// LOAD FUNCTIONS
// ============================================

async function loadDonations() {
    showToast('🔄 Refreshing data...', 'info');
}

async function loadExpenses() {
    showToast('🔄 Refreshing data...', 'info');
}

async function loadCategories() {
    try {
        const snapshot = await db.collection('categories')
            .orderBy('createdAt', 'desc')
            .get();
        renderCategories(snapshot);
    } catch (error) {
        console.error('Error loading categories:', error);
        showToast('Error loading categories: ' + error.message, 'error');
    }
}

// ============================================
// EXPORT TO CSV
// ============================================

async function exportToCSV() {
    if (!isAdmin) {
        showToast('Admin access required', 'error');
        return;
    }

    try {
        const snapshot = await db.collection('donations')
            .where('status', '==', 'completed')
            .orderBy('createdAt', 'desc')
            .get();

        if (snapshot.empty) {
            showToast('No donations to export', 'info');
            return;
        }

        let csv = 'Donor Name,Email,Category,Amount (NGN),Message,Date,Payment Reference\n';
        
        snapshot.forEach(doc => {
            const data = doc.data();
            let date = 'N/A';
            if (data.createdAt) {
                try {
                    date = data.createdAt.toDate ? data.createdAt.toDate().toLocaleDateString() : 'N/A';
                } catch (e) {
                    date = 'N/A';
                }
            }
            csv += `"${data.donorName || 'Anonymous'}","${data.donorEmail || ''}","${data.category || 'Uncategorized'}",${data.amount || 0},"${data.message || ''}","${date}","${data.paymentReference || ''}"\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `donations-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        showToast('CSV exported successfully!');
    } catch (error) {
        showToast('Error exporting CSV: ' + error.message, 'error');
    }
}

// ============================================
// HOME STATS - WITH NAIRA CURRENCY
// ============================================

async function loadHomeStats() {
    try {
        const snapshot = await db.collection('donations')
            .where('status', '==', 'completed')
            .get();
        
        let totalAmount = 0;
        let totalDonations = 0;
        let uniqueDonors = new Set();

        snapshot.forEach(doc => {
            const data = doc.data();
            totalAmount += data.amount || 0;
            totalDonations++;
            if (data.donorEmail) {
                uniqueDonors.add(data.donorEmail);
            }
        });

        const totalDonorsEl = getElement('totalDonors');
        const totalRaisedEl = getElement('totalRaised');
        const totalDonationsEl = getElement('totalDonations');
        
        if (totalDonorsEl) totalDonorsEl.textContent = uniqueDonors.size;
        if (totalRaisedEl) totalRaisedEl.textContent = `${CURRENCY_SYMBOL}${totalAmount.toFixed(2)}`;
        if (totalDonationsEl) totalDonationsEl.textContent = totalDonations;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// ============================================
// ADMIN TABS
// ============================================

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        
        this.classList.add('active');
        const tabId = this.dataset.tab + 'Tab';
        const tabContent = getElement(tabId);
        if (tabContent) tabContent.classList.add('active');
        
        if (isAdmin && sections.admin && sections.admin.classList.contains('active')) {
            startRealTimeListeners();
        }
    });
});

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 App initialized with currency:', CURRENCY);
    console.log('Currency symbol:', CURRENCY_SYMBOL);
    showSection('homeSection');
    loadHomeStats();
    loadCategories();
    
    if (isAdmin) {
        setTimeout(() => {
            startRealTimeListeners();
        }, 1000);
    }
});

window.addEventListener('beforeunload', () => {
    stopRealTimeListeners();
});

window.onerror = function(message, source, lineno, colno, error) {
    console.error('Uncaught error:', message, error);
    showToast('An error occurred. Check console for details.', 'error');
    return false;
};