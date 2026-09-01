// js/app.js

import { ui } from './ui.js';
import { authService } from './auth.js';
import { leaguesService } from './leagues.js';

// ============================================================
// APLICACIÓN PRINCIPAL
// ============================================================

export const app = {

    // --------------------------------------------------------
    // INICIALIZACIÓN
    // --------------------------------------------------------
    init: () => {

        console.log(
            '🚀 Inicializando FMS Fantasy...'
        );

        // Inicializar autenticación
        authService.init(
            app.onAuthStateChanged
        );

        // Configurar botones globales
        app.setupGlobalListeners();

        // Inicializar módulo de ligas
        leaguesService.init();

        console.log(
            '✅ FMS Fantasy inicializado.'
        );
    },

    // --------------------------------------------------------
    // CAMBIO DE ESTADO DE AUTENTICACIÓN
    // --------------------------------------------------------
    onAuthStateChanged: async (user) => {

        if (user) {

            console.log(
                '👤 Usuario detectado:',
                user.uid
            );

            try {

                // Obtener perfil Firestore
                const userData =
                    await authService.loadUserProfile(
                        user.uid
                    );

                // Mostrar username
                ui.setHeaderUsername(
                    userData.username
                );

                // Mostrar header
                ui.toggleHeader(true);

                // Mostrar aplicación principal
                app.router.load(
                    'my-leagues'
                );

            } catch (error) {

                console.error(
                    '❌ Error cargando perfil:',
                    error
                );

                ui.showNotification(
                    'No se pudo cargar tu perfil.',
                    'error'
                );

                await authService.logout();
            }

        } else {

            console.log(
                '⚪ Usuario no autenticado.'
            );

            ui.toggleHeader(false);

            // Mostrar pantalla de autenticación
            ui.showView('auth');
        }
    },

    // --------------------------------------------------------
    // LISTENERS GLOBALES
    // --------------------------------------------------------
    setupGlobalListeners: () => {

        // ----------------------------------------------------
        // LOGOUT
        // ----------------------------------------------------
        const logoutButton =
            document.getElementById(
                'btn-logout'
            );

        if (logoutButton) {

            logoutButton.addEventListener(
                'click',
                async () => {
                    await authService.logout();
                }
            );
        }

        // ----------------------------------------------------
        // CAMBIAR A REGISTRO
        // ----------------------------------------------------
        const showRegister =
            document.getElementById(
                'show-register'
            );

        if (showRegister) {

            showRegister.addEventListener(
                'click',
                () => {

                    document
                        .querySelectorAll('.auth-form')
                        .forEach((form) => {
                            form.style.display = 'none';
                        });

                    const registerForm =
                        document.getElementById(
                            'form-register'
                        );

                    if (registerForm) {
                        registerForm.style.display =
                            'block';
                    }
                }
            );
        }

        // ----------------------------------------------------
        // CAMBIAR A LOGIN
        // ----------------------------------------------------
        const showLogin =
            document.getElementById(
                'show-login'
            );

        if (showLogin) {

            showLogin.addEventListener(
                'click',
                () => {

                    document
                        .querySelectorAll('.auth-form')
                        .forEach((form) => {
                            form.style.display = 'none';
                        });

                    const loginForm =
                        document.getElementById(
                            'form-login'
                        );

                    if (loginForm) {
                        loginForm.style.display =
                            'block';
                    }
                }
            );
        }

        // ----------------------------------------------------
        // LOGIN
        // ----------------------------------------------------
        const loginForm =
            document.getElementById(
                'form-login'
            );

        if (loginForm) {

            loginForm.addEventListener(
                'submit',
                async (event) => {

                    event.preventDefault();

                    const email =
                        loginForm.elements.email
                            ?.value
                            .trim();

                    const password =
                        loginForm.elements.password
                            ?.value;

                    if (!email || !password) {

                        ui.showNotification(
                            'Introduce email y contraseña.',
                            'error'
                        );

                        return;
                    }

                    try {

                        await authService.login(
                            email,
                            password
                        );

                    } catch (error) {

                        console.error(
                            'Login fallido:',
                            error
                        );
                    }
                }
            );
        }

        // ----------------------------------------------------
        // REGISTRO
        // ----------------------------------------------------
        const registerForm =
            document.getElementById(
                'form-register'
            );

        if (registerForm) {

            registerForm.addEventListener(
                'submit',
                async (event) => {

                    event.preventDefault();

                    const username =
                        registerForm.elements.username
                            ?.value
                            .trim();

                    const email =
                        registerForm.elements.email
                            ?.value
                            .trim();

                    const password =
                        registerForm.elements.password
                            ?.value;

                    const passwordConfirm =
                        registerForm.elements.passwordConfirm
                            ?.value;

                    if (
                        !username ||
                        !email ||
                        !password
                    ) {

                        ui.showNotification(
                            'Completa todos los campos.',
                            'error'
                        );

                        return;
                    }

                    if (
                        password !==
                        passwordConfirm
                    ) {

                        ui.showNotification(
                            'Las contraseñas no coinciden.',
                            'error'
                        );

                        return;
                    }

                    try {

                        await authService.register(
                            username,
                            email,
                            password
                        );

                        registerForm.reset();

                    } catch (error) {

                        console.error(
                            'Registro fallido:',
                            error
                        );
                    }
                }
            );
        }

        // ----------------------------------------------------
        // RECUPERACIÓN DE CONTRASEÑA
        // ----------------------------------------------------
        const resetForm =
            document.getElementById(
                'form-reset-password'
            );

        if (resetForm) {

            resetForm.addEventListener(
                'submit',
                async (event) => {

                    event.preventDefault();

                    const email =
                        resetForm.elements.email
                            ?.value
                            .trim();

                    try {

                        await authService
                            .sendPasswordReset(
                                email
                            );

                        resetForm.reset();

                    } catch (error) {

                        console.error(
                            'Error recuperación:',
                            error
                        );
                    }
                }
            );
        }

        // ----------------------------------------------------
        // NAVEGACIÓN ENTRE VISTAS
        // ----------------------------------------------------
        document.addEventListener(
            'click',
            (event) => {

                const navigation =
                    event.target.closest(
                        '[data-view]'
                    );

                if (!navigation) {
                    return;
                }

                const viewId =
                    navigation.dataset.view;

                if (viewId) {

                    app.router.load(
                        viewId
                    );
                }
            }
        );
    },

    // ========================================================
    // ROUTER
    // ========================================================
    router: {

        load: (viewId, params = {}) => {

            console.log(
                `➡️ Navegando a: ${viewId}`
            );

            ui.showView(
                viewId
            );

            // -----------------------------------------------
            // MIS LIGAS
            // -----------------------------------------------
            if (
                viewId === 'my-leagues'
            ) {

                leaguesService
                    .loadUserLeaguesList();
            }

            // -----------------------------------------------
            // DETALLE DE LIGA
            // -----------------------------------------------
            else if (
                viewId === 'league-detail' &&
                params.leagueId
            ) {

                leaguesService
                    .loadLeagueDetail(
                        params.leagueId
                    );
            }
        }
    }
};

// ============================================================
// ARRANQUE
// ============================================================

document.addEventListener(
    'DOMContentLoaded',
    () => {
        app.init();
    }
);
