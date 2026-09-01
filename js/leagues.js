// js/leagues.js

import { db, functions } from './firebase.js';
import { currentUser } from './auth.js';
import { ui } from './ui.js';

// ============================================================
// LEAGUES SERVICE
// ============================================================

export const leaguesService = {

    // --------------------------------------------------------
    // INICIALIZACIÓN
    // --------------------------------------------------------
    init: () => {

        // Crear liga
        const createButton =
            document.getElementById(
                'btn-create-league-action'
            );

        if (createButton) {

            createButton.addEventListener(
                'click',
                () => {

                    const form =
                        document.getElementById(
                            'form-create-league'
                        );

                    if (form) {
                        form.style.display =
                            'block';
                    }
                }
            );
        }

        // Formulario crear liga
        const createForm =
            document.getElementById(
                'form-create-league'
            );

        if (createForm) {

            createForm.addEventListener(
                'submit',
                leaguesService.handleCreateLeague
            );
        }

        // Formulario unirse a liga
        const joinForm =
            document.getElementById(
                'form-join-league'
            );

        if (joinForm) {

            joinForm.addEventListener(
                'submit',
                leaguesService.handleJoinLeague
            );
        }

        // -----------------------------------------------
        // Delegación para botones "Ver clasificación"
        // -----------------------------------------------
        document.addEventListener(
            'click',
            (event) => {

                const button =
                    event.target.closest(
                        '[data-league-id]'
                    );

                if (!button) {
                    return;
                }

                const leagueId =
                    button.dataset.leagueId;

                if (!leagueId) {
                    return;
                }

                // Evitamos depender de app.js
                document.dispatchEvent(
                    new CustomEvent(
                        'fms:navigate',
                        {
                            detail: {
                                viewId:
                                    'league-detail',
                                params: {
                                    leagueId
                                }
                            }
                        }
                    )
                );
            }
        );

        // Escuchar navegación producida por este módulo
        document.addEventListener(
            'fms:navigate',
            (event) => {

                const {
                    viewId,
                    params
                } = event.detail;

                ui.showView(viewId);

                if (
                    viewId ===
                    'league-detail'
                ) {

                    leaguesService
                        .loadLeagueDetail(
                            params.leagueId
                        );
                }
            }
        );
    },

    // ========================================================
    // CARGAR MIS LIGAS
    // ========================================================
    loadUserLeaguesList: async () => {

        const container =
            document.getElementById(
                'leagues-list-container'
            );

        if (!container) {
            console.error(
                'No existe #leagues-list-container'
            );
            return;
        }

        if (!currentUser) {

            container.innerHTML =
                '<p>Debes iniciar sesión.</p>';

            return;
        }

        container.innerHTML =
            '<p>Cargando ligas...</p>';

        try {

            // Obtener perfil del usuario
            const userDoc =
                await db
                    .collection('users')
                    .doc(currentUser.uid)
                    .get();

            if (!userDoc.exists) {

                throw new Error(
                    'No se encontró tu perfil.'
                );
            }

            const userData =
                userDoc.data();

            const leagueIds =
                Array.isArray(
                    userData.leagueIds
                )
                    ? userData.leagueIds
                    : [];

            if (leagueIds.length === 0) {

                container.innerHTML = `
                    <p>No perteneces a ninguna liga.</p>
                    <p>Crea una liga o únete a una existente.</p>
                `;

                return;
            }

            container.innerHTML = '';

            // Firestore limita las consultas "in" a determinados
            // tamaños, así que obtenemos las ligas una a una.
            const leaguePromises =
                leagueIds.map(
                    async (leagueId) => {

                        const leagueDoc =
                            await db
                                .collection('leagues')
                                .doc(leagueId)
                                .get();

                        if (!leagueDoc.exists) {
                            return null;
                        }

                        return {
                            id: leagueDoc.id,
                            ...leagueDoc.data()
                        };
                    }
                );

            const leagues =
                await Promise.all(
                    leaguePromises
                );

            const validLeagues =
                leagues.filter(
                    (league) => league !== null
                );

            if (validLeagues.length === 0) {

                container.innerHTML =
                    '<p>No se encontraron tus ligas.</p>';

                return;
            }

            validLeagues.forEach(
                (league) => {

                    const card =
                        document.createElement(
                            'div'
                        );

                    card.className =
                        'league-card';

                    card.innerHTML = `
                        <h4>${escapeHtml(league.name)}</h4>

                        <p>
                            Código:
                            <strong>
                                ${escapeHtml(league.inviteCode || '')}
                            </strong>
                        </p>

                        <p>
                            Miembros:
                            ${league.memberCount || 0}
                            /
                            ${league.maxMembers || 16}
                        </p>

                        <button
                            type="button"
                            data-league-id="${escapeHtml(league.id)}"
                        >
                            Ver clasificación
                        </button>
                    `;

                    container.appendChild(
                        card
                    );
                }
            );

        } catch (error) {

            console.error(
                '❌ Error cargando ligas:',
                error
            );

            container.innerHTML =
                '<p>Error al cargar tus ligas.</p>';

            ui.showNotification(
                'No se pudieron cargar las ligas.',
                'error'
            );
        }
    },

    // ========================================================
    // CREAR LIGA
    // ========================================================
    handleCreateLeague: async (event) => {

        event.preventDefault();

        if (!currentUser) {

            ui.showNotification(
                'Debes iniciar sesión.',
                'error'
            );

            return;
        }

        const form =
            event.target;

        const name =
            form.elements.leagueName
                ?.value
                .trim();

        if (!name || name.length < 3) {

            ui.showNotification(
                'El nombre debe tener al menos 3 caracteres.',
                'error'
            );

            return;
        }

        try {

            ui.showNotification(
                'Creando liga...',
                'info'
            );

            const createLeagueFunc =
                functions.httpsCallable(
                    'createLeague'
                );

            const result =
                await createLeagueFunc({
                    name: name
                });

            console.log(
                '✅ Liga creada:',
                result.data
            );

            ui.showNotification(
                `Liga creada. Código: ${result.data.inviteCode}`,
                'success'
            );

            form.reset();

            await leaguesService
                .loadUserLeaguesList();

        } catch (error) {

            console.error(
                '❌ Error creando liga:',
                error
            );

            ui.showNotification(
                error.message ||
                'No se pudo crear la liga.',
                'error'
            );
        }
    },

    // ========================================================
    // UNIRSE A LIGA
    // ========================================================
    handleJoinLeague: async (event) => {

        event.preventDefault();

        if (!currentUser) {

            ui.showNotification(
                'Debes iniciar sesión.',
                'error'
            );

            return;
        }

        const form =
            event.target;

        const code =
            form.elements.inviteCode
                ?.value
                .trim()
                .toUpperCase();

        if (!code) {

            ui.showNotification(
                'Introduce un código de invitación.',
                'error'
            );

            return;
        }

        try {

            ui.showNotification(
                'Uniéndote a la liga...',
                'info'
            );

            /*
             * La operación sensible se realiza en el backend.
             *
             * La Cloud Function:
             * - verifica autenticación
             * - busca la liga
             * - comprueba capacidad
             * - comprueba si ya somos miembros
             * - crea el miembro
             * - actualiza leagueIds del usuario
             * - incrementa memberCount
             */
            const joinLeagueFunc =
                functions.httpsCallable(
                    'joinLeague'
                );

            const result =
                await joinLeagueFunc({
                    inviteCode: code
                });

            console.log(
                '✅ Unido a liga:',
                result.data
            );

            ui.showNotification(
                'Te has unido a la liga correctamente.',
                'success'
            );

            form.reset();

            // Ir directamente al detalle
            ui.showView(
                'league-detail'
            );

            await leaguesService
                .loadLeagueDetail(
                    result.data.leagueId
                );

        } catch (error) {

            console.error(
                '❌ Error uniéndose a liga:',
                error
            );

            let message =
                'No se pudo unir a la liga.';

            switch (error.code) {

                case 'functions/not-found':
                    message =
                        'El código de invitación no es válido.';
                    break;

                case 'functions/already-exists':
                    message =
                        'Ya perteneces a esta liga.';
                    break;

                case 'functions/resource-exhausted':
                    message =
                        'La liga está llena.';
                    break;

                case 'functions/unauthenticated':
                    message =
                        'Debes iniciar sesión.';
                    break;

                case 'functions/invalid-argument':
                    message =
                        'El código de invitación no es válido.';
                    break;

                default:
                    if (error.message) {
                        message =
                            error.message;
                    }
            }

            ui.showNotification(
                message,
                'error'
            );
        }
    },

    // ========================================================
    // DETALLE DE LIGA
    // ========================================================
    loadLeagueDetail: async (leagueId) => {

        if (!leagueId) {
            return;
        }

        const rankingBody =
            document.getElementById(
                'ranking-body'
            );

        if (rankingBody) {

            rankingBody.innerHTML = `
                <tr>
                    <td colspan="3">
                        Cargando clasificación...
                    </td>
                </tr>
            `;
        }

        try {

            // Obtener liga
            const leagueDoc =
                await db
                    .collection('leagues')
                    .doc(leagueId)
                    .get();

            if (!leagueDoc.exists) {

                throw new Error(
                    'La liga no existe.'
                );
            }

            const leagueData =
                leagueDoc.data();

            // ------------------------------------------------
            // Comprobar que el usuario pertenece a la liga
            // ------------------------------------------------
            if (currentUser) {

                const memberDoc =
                    await db
                        .collection('leagues')
                        .doc(leagueId)
                        .collection('members')
                        .doc(currentUser.uid)
                        .get();

                if (!memberDoc.exists) {

                    throw new Error(
                        'No perteneces a esta liga.'
                    );
                }
            }

            // ------------------------------------------------
            // Cabecera
            // ------------------------------------------------
            const title =
                document.getElementById(
                    'league-name-title'
                );

            if (title) {
                title.textContent =
                    leagueData.name;
            }

            const code =
                document.getElementById(
                    'league-code-display'
                );

            if (code) {
                code.textContent =
                    leagueData.inviteCode || '';
            }

            // ------------------------------------------------
            // Controles de administrador
            // ------------------------------------------------
            const adminControls =
                document.getElementById(
                    'admin-controls'
                );

            if (adminControls) {

                if (
                    currentUser &&
                    currentUser.uid ===
                        leagueData.ownerId
                ) {

                    adminControls.style.display =
                        'block';

                } else {

                    adminControls.style.display =
                        'none';
                }
            }

            // ------------------------------------------------
            // Obtener miembros
            // ------------------------------------------------
            const membersSnapshot =
                await db
                    .collection('leagues')
                    .doc(leagueId)
                    .collection('members')
                    .get();

            const members = [];

            membersSnapshot.forEach(
                (memberDoc) => {

                    members.push({
                        id: memberDoc.id,
                        ...memberDoc.data()
                    });
                }
            );

            // ------------------------------------------------
            // Clasificación
            // ------------------------------------------------
            ui.renderRanking(
                members
            );

        } catch (error) {

            console.error(
                '❌ Error cargando detalle:',
                error
            );

            ui.showNotification(
                error.message ||
                'No se pudo cargar la liga.',
                'error'
            );

            ui.showView(
                'my-leagues'
            );

            await leaguesService
                .loadUserLeaguesList();
        }
    }
};

// ============================================================
// SEGURIDAD HTML
// ============================================================

function escapeHtml(value) {

    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
