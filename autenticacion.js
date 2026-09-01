// js/auth.js

let currentUser = null;
let unsubscribeAuth = null;

// Expresión regular validación cliente (debe coincidir con backend)
const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,20}$/;

// --- INICIALIZACIÓN ---
function initAuth() {
    console.log("Inicializando Auth (con Cloud Functions)...");
    setupAuthListeners();
    // Registro, Login, Reset, Logout listeners se añaden abajo
}

// --- 1. DETECTAR ESTADO DE SESIÓN ---
function setupAuthListeners() {
    unsubscribeAuth = auth.onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            console.log("✅ Usuario autenticado:", user.uid);
            loadUserProfile(user.uid); // Carga UI principal
        } else {
            currentUser = null;
            console.log("⚪ No hay sesión activa.");
            ui_hideLoading();
            showScreen('auth-screen'); // Muestra Login/Registro
        }
    });
}

// --- 2. CARGAR PERFIL (Firestore) ---
async function loadUserProfile(uid) {
    ui_showLoading("Cargando perfil...");
    try {
        const userDocRef = db.collection('users').doc(uid);
        const doc = await userDocRef.get();

        if (doc.exists) {
            const userData = doc.data();
            console.log("Perfil cargado:", userData);
            
            // Actualizar UI global (funciones en ui.js)
            if (typeof updateHeaderUsername === 'function') updateHeaderUsername(userData.username);
            if (typeof populateProfileForm === 'function') populateProfileForm(userData);

            showScreen('main-app');
            
            // IMPORTANTE: Aquí en el futuro app.js cargará las ligas del usuario.
            // Por ahora solo nos aseguramos de que la app principal se ve.
            if (typeof loadUserLeagues === 'function') loadUserLeagues(uid);

        } else {
            console.error("❌ Perfil no encontrado en Firestore.");
            auth.signOut();
            ui_showError('login-form', "Tu cuenta no está correctamente inicializada. Contacta soporte.");
        }
    } catch (error) {
        console.error("Error cargando perfil:", error);
        auth.signOut();
        ui_showError('login-form', "Error al conectar con la base de datos.");
    } finally {
        ui_hideLoading();
    }
}


// --- 3. REGISTRO (LLAMADA A CLOUD FUNCTION) ---
const registerForm = document.getElementById('register-form');
if (registerForm) {
    registerForm.addEventListener('submit', handleRegister);
}

async function handleRegister(e) {
    e.preventDefault();
    clearAuthErrors('register-form');

    const username = document.getElementById('register-username').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value.trim();
    const passwordConfirm = document.getElementById('register-password-confirm').value.trim();

    // --- Validaciones Cliente (UX) ---
    let isValid = true;
    let errors = [];

    if (!username) {
        isValid = false;
        errors.push({ field: 'register-username', msg: "El nombre de usuario es obligatorio." });
    } else if (!USERNAME_REGEX.test(username)) {
        isValid = false;
        errors.push({ field: 'register-username', msg: "3-20 caracteres (letras, números, _, -)." });
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        isValid = false;
        errors.push({ field: 'register-email', msg: "Introduce un email válido." });
    }

    if (password.length < 6) {
        isValid = false;
        errors.push({ field: 'register-password', msg: "La contraseña debe tener al menos 6 caracteres." });
    }
    if (password !== passwordConfirm) {
        isValid = false;
        errors.push({ field: 'register-password-confirm', msg: "Las contraseñas no coinciden." });
    }

    if (!isValid) {
        if (typeof ui_showMultipleErrors === 'function') {
            ui_showMultipleErrors('register-form', errors);
        } else {
            // Fallback si ui.js no tiene esta función
            alert(errors.map(e => e.msg).join('\n'));
        }
        return;
    }

    ui_showLoading("Creando cuenta en FMS Fantasy...");

    try {
        // 🔴 LLAMADA A LA CLOUD FUNCTION 'registerUser'
        const registerUserFunc = functions.httpsCallable('registerUser');
        
        // Enviamos los datos al backend
        const result = await registerUserFunc({ 
            username: username, 
            email: email, 
            password: password 
        });

        console.log("🎉 Función de registro ejecutada:", result.data);
        
        // La función devuelve éxito. Ahora necesitamos iniciar sesión en el cliente
        // para que onAuthStateChanged detecte la sesión y cargue la UI.
        // Firebase Auth no inicia sesión automáticamente tras crear usuario vía Function.
        ui_showLoading("Iniciando sesión...");
        await auth.signInWithEmailAndPassword(email, password);
        
        // Auth state changed se disparará aquí, llamando a loadUserProfile y mostrando main-app.
        registerForm.reset();

    } catch (error) {
        console.error("Error en registro:", error);
        
        let msg = "Error desconocido al crear la cuenta.";
        
        // Manejo de errores específicos de HttpsError (devueltos por la Cloud Function)
        if (error.code) {
            switch (error.code) {
                case 'already-exists':
                    // Específico para el nombre de usuario o email duplicado
                    if (error.message.includes('nombre de usuario')) {
                         ui_showMultipleErrors('register-form', [{ field: 'register-username', msg: error.message }]);
                         return; // Salimos para no mostrar el alert de abajo
                    }
                    msg = error.message;
                    break;
                case 'invalid-argument':
                    msg = error.message;
                    break;
                case 'deadline-exceeded':
                    msg = "La operación ha tardado demasiado. Comprueba tu conexión.";
                    break;
                default:
                    msg = "Error del servidor: " + error.message;
            }
        }
        
        // Mostrar error general
        if (typeof ui_showError === 'function') {
            ui_showError('register-form', msg);
        } else {
            alert(msg);
        }
        
    } finally {
        ui_hideLoading();
    }
}


// --- 4. LOGIN (Directo - Sin cambios) ---
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
}

async function handleLogin(e) {
    e.preventDefault();
    clearAuthErrors('login-form');
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value.trim();

    if (!email || !password) {
        ui_showError('login-form', "Introduce email y contraseña.");
        return;
    }

    ui_showLoading("Iniciando sesión...");
    try {
        await auth.signInWithEmailAndPassword(email, password);
        console.log("🔓 Login correcto.");
        loginForm.reset();
    } catch (error) {
        console.error("Login error:", error);
        let msg = "Error al iniciar sesión.";
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            msg = "Email o contraseña incorrectos.";
        } else if (error.code === 'auth/too-many-requests') {
            msg = "Demasiados intentos. Cuenta bloqueada temporalmente.";
        }
        ui_showError('login-form', msg);
    } finally {
        ui_hideLoading();
    }
}


// --- 5. RECUPERAR CONTRASEÑA (Directo - Sin cambios) ---
const resetForm = document.getElementById('reset-form');
if (resetForm) {
    resetForm.addEventListener('submit', handleResetPassword);
}

async function handleResetPassword(e) {
    e.preventDefault();
    const email = document.getElementById('reset-email').value.trim();
    clearAuthErrors('reset-form');

    if (!email) {
        ui_showError('reset-form', "Introduce tu email.");
        return;
    }

    ui_showLoading("Enviando email...");
    try {
        await auth.sendPasswordResetEmail(email);
        ui_showSuccess('reset-form', "✅ Email enviado. Revisa tu bandeja de entrada y spam.");
        document.getElementById('reset-email').value = '';
    } catch (error) {
        console.error("Reset error:", error);
        let msg = "Error al enviar email.";
        if (error.code === 'auth/user-not-found') msg = "No existe usuario con ese email.";
        ui_showError('reset-form', msg);
    } finally {
        ui_hideLoading();
    }
}


// --- 6. CERRAR SESIÓN (Directo - Sin cambios) ---
const btnLogout = document.getElementById('btn-logout');
if (btnLogout) {
    btnLogout.addEventListener('click', handleLogout);
}

async function handleLogout() {
    ui_showLoading("Cerrando sesión...");
    try {
        await auth.signOut();
    } catch (error) {
        console.error("Logout error:", error);
        ui_hideLoading();
    }
}


// --- UTILIDADES ---
function clearAuthErrors(formId) {
    const form = document.getElementById(formId);
    if (!form) return;
    form.querySelectorAll('.error-text, .success-text').forEach(el => el.remove());
    form.querySelectorAll('.input-group.error').forEach(el => el.classList.remove('error'));
}