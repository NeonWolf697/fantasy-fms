```javascript
// js/ui.js

// ============================================================
// UI SERVICE
// Gestión centralizada de la interfaz de FMS Fantasy
// ============================================================

const appRoot = document.getElementById('app-root');
const header = document.getElementById('main-header');
const notificationBar = document.getElementById('notification-bar');

export const ui = {

    // ========================================================
    // VISTAS
    // ========================================================

    /**
     * Muestra una vista y oculta todas las demás.
     *
     * Ejemplo:
     * ui.showView('auth');
     * ui.showView('my-leagues');
     * ui.showView('league-detail');
     */
    showView: (viewId) => {
        const views = document.querySelectorAll('.view');

        views.forEach(view => {
            view.style.display = 'none';
        });

        const targetView = document.getElementById(`view-${viewId}`);

        if (!targetView) {
            console.error(`❌ Vista no encontrada: view-${viewId}`);
            return;
        }

        targetView.style.display = 'block';
    },


    // ========================================================
    // CABECERA
    // ========================================================

    /**
     * Muestra u oculta la cabecera principal.
     */
    toggleHeader: (show) => {

        if (!header) {
            console.warn('⚠️ #main-header no existe en index.html');
            return;
        }

        header.style.display = show ? 'flex' : 'none';
    },


    /**
     * Actualiza el nombre del usuario en la cabecera.
     */
    setHeaderUsername: (username) => {

        const usernameElement =
            document.getElementById('header-username');

        if (!usernameElement) {
            console.warn('⚠️ #header-username no existe en index.html');
            return;
        }

        usernameElement.textContent = username || '';
    },


    // ========================================================
    // NOTIFICACIONES
    // ========================================================

    /**
     * Muestra una notificación.
     *
     * type:
     * - info
     * - success
     * - error
     */
    showNotification: (message, type = 'info') => {

        const bar =
            document.getElementById('notification-bar');

        if (!bar) {
            console.warn(
                '⚠️ #notification-bar no existe en index.html'
            );

            // Fallback
            console.log(`[${type.toUpperCase()}] ${message}`);
            return;
        }

        bar.textContent = message;

        // Limpiamos clases anteriores
        bar.classList.remove(
            'info',
            'success',
            'error'
        );

        bar.classList.add(type);

        bar.style.display = 'block';

        // Evitar múltiples timers acumulados
        if (ui._notificationTimer) {
            clearTimeout(ui._notificationTimer);
        }

        ui._notificationTimer = setTimeout(() => {
            bar.style.display = 'none';
        }, 3000);
    },


    // ========================================================
    // LOADING
    // ========================================================

    /**
     * Muestra estado de carga.
     *
     * Si index.html tiene #loading-overlay se utiliza.
     */
    showLoading: (message = 'Cargando...') => {

        const loading =
            document.getElementById('loading-overlay');

        const loadingMessage =
            document.getElementById('loading-message');

        if (loading) {
            loading.style.display = 'flex';
        }

        if (loadingMessage) {
            loadingMessage.textContent = message;
        }
    },


    /**
     * Oculta el estado de carga.
     */
    hideLoading: () => {

        const loading =
            document.getElementById('loading-overlay');

        if (loading) {
            loading.style.display = 'none';
        }
    },


    // ========================================================
    // ERRORES / ÉXITO
    // ========================================================

    /**
     * Muestra error mediante notificación.
     */
    showError: (message) => {
        ui.showNotification(message, 'error');
    },


    /**
     * Muestra mensaje de éxito.
     */
    showSuccess: (message) => {
        ui.showNotification(message, 'success');
    },


    // ========================================================
    // AUTENTICACIÓN
    // ========================================================

    /**
     * Cambia entre formulario de login y registro.
     *
     * form:
     * - login
     * - register
     */
    showAuthForm: (form) => {

        const loginForm =
            document.getElementById('form-login');

        const registerForm =
            document.getElementById('form-register');

        if (loginForm) {
            loginForm.style.display = 'none';
        }

        if (registerForm) {
            registerForm.style.display = 'none';
        }

        if (form === 'login' && loginForm) {
            loginForm.style.display = 'block';
        }

        if (form === 'register' && registerForm) {
            registerForm.style.display = 'block';
        }
    },


    // ========================================================
    // RANKING DE LIGA
    // ========================================================

    /**
     * Renderiza la clasificación de una liga.
     *
     * membersArray:
     * [
     *   {
     *      username: "Jugador",
     *      points: 120
     *   }
     * ]
     */
    renderRanking: (membersArray = []) => {

        const tbody =
            document.getElementById('ranking-body');

        if (!tbody) {
            console.warn(
                '⚠️ #ranking-body no existe en index.html'
            );
            return;
        }

        tbody.innerHTML = '';

        // Copia para no modificar el array original
        const members = [...membersArray];

        // Ordenar por puntos descendente
        members.sort((a, b) => {
            return (Number(b.points) || 0) -
                   (Number(a.points) || 0);
        });

        if (members.length === 0) {

            const row = document.createElement('tr');

            row.innerHTML = `
                <td colspan="3">
                    No hay miembros en esta liga.
                </td>
            `;

            tbody.appendChild(row);
            return;
        }

        members.forEach((member, index) => {

            const row =
                document.createElement('tr');

            const username =
                member.username || 'Usuario';

            const points =
                Number(member.points) || 0;

            row.innerHTML = `
                <td>#${index + 1}</td>
                <td>${escapeHtml(username)}</td>
                <td>${points}</td>
            `;

            tbody.appendChild(row);
        });
    },


    // ========================================================
    // LIGAS
    // ========================================================

    /**
     * Renderiza las tarjetas de "Mis Ligas".
     */
    renderLeagues: (leagues = [], onOpenLeague) => {

        const container =
            document.getElementById(
                'leagues-list-container'
            );

        if (!container) {
            console.warn(
                '⚠️ #leagues-list-container no existe'
            );
            return;
        }

        container.innerHTML = '';

        if (leagues.length === 0) {

            container.innerHTML = `
                <p class="empty-state">
                    No perteneces a ninguna liga.
                    Crea una o únete a una.
                </p>
            `;

            return;
        }

        leagues.forEach(league => {

            const card =
                document.createElement('div');

            card.className = 'league-card';

            const name =
                escapeHtml(league.name || 'Liga');

            const code =
                escapeHtml(league.inviteCode || '');

            card.innerHTML = `
                <h4>${name}</h4>

                <p>
                    Código:
                    <strong>${code}</strong>
                </p>

                <button
                    type="button"
                    class="btn-view-league">
                    Ver clasificación
                </button>
            `;

            const button =
                card.querySelector('.btn-view-league');

            button.addEventListener('click', () => {

                if (typeof onOpenLeague === 'function') {
                    onOpenLeague(league.id);
                }
            });

            container.appendChild(card);
        });
    },


    // ========================================================
    // MODALES
    // ========================================================

    /**
     * Muestra un modal.
     */
    showModal: (modalId) => {

        const modal =
            document.getElementById(modalId);

        if (!modal) {
            console.warn(
                `⚠️ Modal no encontrado: ${modalId}`
            );
            return;
        }

        modal.style.display = 'flex';
    },


    /**
     * Oculta un modal.
     */
    hideModal: (modalId) => {

        const modal =
            document.getElementById(modalId);

        if (!modal) {
            return;
        }

        modal.style.display = 'none';
    },


    // ========================================================
    // UTILIDADES
    // ========================================================

    /**
     * Limpia un formulario.
     */
    resetForm: (formId) => {

        const form =
            document.getElementById(formId);

        if (form) {
            form.reset();
        }
    },


    /**
     * Activa/desactiva un botón.
     */
    setButtonLoading: (button, loading, text = 'Cargando...') => {

        if (!button) {
            return;
        }

        if (loading) {

            button.dataset.originalText =
                button.textContent;

            button.disabled = true;
            button.textContent = text;

        } else {

            button.disabled = false;

            if (button.dataset.originalText) {
                button.textContent =
                    button.dataset.originalText;
            }
        }
    }
};


// ============================================================
// TIMER INTERNO DE NOTIFICACIONES
// ============================================================

ui._notificationTimer = null;


// ============================================================
// ESCAPE HTML
// Evita insertar directamente contenido introducido
// por usuarios en HTML.
// ============================================================

function escapeHtml(value) {

    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
```
