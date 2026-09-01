// js/auth.js

import { ui } from './ui.js';
import { auth, db, functions } from './firebase.js';

// Usuario actualmente autenticado.
// Se exporta para que otros módulos puedan consultarlo.
export let currentUser = null;

// ============================================================
// AUTH SERVICE
// ============================================================

export const authService = {

    // --------------------------------------------------------
    // Inicializar listener de autenticación
    // --------------------------------------------------------
    init: (callback) => {
        return auth.onAuthStateChanged(async (user) => {

            currentUser = user || null;

            console.log(
                user
                    ? `✅ Usuario autenticado: ${user.uid}`
                    : '⚪ No hay sesión activa.'
            );

            if (typeof callback === 'function') {
                await callback(user);
            }
        });
    },

    // --------------------------------------------------------
    // REGISTRO
    // --------------------------------------------------------
    register: async (username, email, password) => {

        username = username.trim();
        email = email.trim();

        if (!username || !email || !password) {
            throw new Error('Todos los campos son obligatorios.');
        }

        if (!/^[a-zA-Z0-9_-]{3,20}$/.test(username)) {
            throw new Error(
                'El nombre de usuario debe tener entre 3 y 20 caracteres y solo puede contener letras, números, _ o -.'
            );
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new Error('Introduce un email válido.');
        }

        if (password.length < 6) {
            throw new Error(
                'La contraseña debe tener al menos 6 caracteres.'
            );
        }

        try {

            ui.showNotification(
                'Creando cuenta...',
                'info'
            );

            const registerUserFunc =
                functions.httpsCallable('registerUser');

            const result = await registerUserFunc({
                username,
                email,
                password
            });

            console.log(
                '✅ Usuario registrado mediante Cloud Function:',
                result.data
            );

            /*
             * registerUser crea el usuario en Firebase Auth,
             * pero no inicia sesión automáticamente.
             *
             * Por eso iniciamos sesión aquí.
             */
            await auth.signInWithEmailAndPassword(
                email,
                password
            );

            ui.showNotification(
                '¡Cuenta creada correctamente!',
                'success'
            );

            return result.data;

        } catch (error) {

            console.error(
                '❌ Error en registro:',
                error
            );

            let message = 'Error al registrarse.';

            switch (error.code) {

                case 'functions/already-exists':
                    if (
                        error.message &&
                        error.message
                            .toLowerCase()
                            .includes('nombre de usuario')
                    ) {
                        message =
                            'El nombre de usuario ya está en uso.';
                    } else {
                        message =
                            'El email ya está registrado.';
                    }
                    break;

                case 'functions/invalid-argument':
                    message =
                        error.message ||
                        'Los datos introducidos no son válidos.';
                    break;

                case 'functions/unauthenticated':
                    message =
                        'No se pudo verificar la autenticación.';
                    break;

                case 'functions/internal':
                    message =
                        'Error interno del servidor. Inténtalo de nuevo.';
                    break;

                case 'auth/email-already-in-use':
                    message =
                        'El email ya está registrado.';
                    break;

                case 'auth/invalid-email':
                    message =
                        'El email no es válido.';
                    break;

                default:
                    if (error.message) {
                        message = error.message;
                    }
            }

            ui.showNotification(
                message,
                'error'
            );

            throw error;
        }
    },

    // --------------------------------------------------------
    // LOGIN
    // --------------------------------------------------------
    login: async (email, password) => {

        email = email.trim();

        if (!email || !password) {
            throw new Error(
                'Introduce email y contraseña.'
            );
        }

        try {

            ui.showNotification(
                'Iniciando sesión...',
                'info'
            );

            const credential =
                await auth.signInWithEmailAndPassword(
                    email,
                    password
                );

            currentUser = credential.user;

            console.log(
                '🔓 Login correcto:',
                currentUser.uid
            );

            ui.showNotification(
                'Sesión iniciada correctamente.',
                'success'
            );

            return credential.user;

        } catch (error) {

            console.error(
                '❌ Error en login:',
                error
            );

            let message =
                'Email o contraseña incorrectos.';

            if (
                error.code === 'auth/too-many-requests'
            ) {
                message =
                    'Demasiados intentos. Inténtalo más tarde.';
            }

            ui.showNotification(
                message,
                'error'
            );

            throw error;
        }
    },

    // --------------------------------------------------------
    // LOGOUT
    // --------------------------------------------------------
    logout: async () => {

        try {

            await auth.signOut();

            currentUser = null;

            ui.showNotification(
                'Sesión cerrada.',
                'info'
            );

        } catch (error) {

            console.error(
                '❌ Error al cerrar sesión:',
                error
            );

            ui.showNotification(
                'No se pudo cerrar la sesión.',
                'error'
            );

            throw error;
        }
    },

    // --------------------------------------------------------
    // RECUPERACIÓN DE CONTRASEÑA
    // --------------------------------------------------------
    sendPasswordReset: async (email) => {

        email = email.trim();

        if (!email) {
            throw new Error(
                'Introduce tu email.'
            );
        }

        try {

            ui.showNotification(
                'Enviando correo de recuperación...',
                'info'
            );

            await auth.sendPasswordResetEmail(
                email
            );

            ui.showNotification(
                'Correo enviado. Revisa tu bandeja de entrada.',
                'success'
            );

        } catch (error) {

            console.error(
                '❌ Error recuperando contraseña:',
                error
            );

            let message =
                'No se pudo enviar el correo de recuperación.';

            if (
                error.code === 'auth/user-not-found'
            ) {
                message =
                    'No existe ninguna cuenta con ese email.';
            }

            ui.showNotification(
                message,
                'error'
            );

            throw error;
        }
    },

    // --------------------------------------------------------
    // OBTENER PERFIL DE FIRESTORE
    // --------------------------------------------------------
    loadUserProfile: async (uid) => {

        if (!uid) {
            throw new Error(
                'UID de usuario no válido.'
            );
        }

        try {

            const userDoc =
                await db
                    .collection('users')
                    .doc(uid)
                    .get();

            if (!userDoc.exists) {
                throw new Error(
                    'El perfil del usuario no existe.'
                );
            }

            const userData =
                userDoc.data();

            console.log(
                '👤 Perfil cargado:',
                userData
            );

            return userData;

        } catch (error) {

            console.error(
                '❌ Error cargando perfil:',
                error
            );

            throw error;
        }
    }
};
