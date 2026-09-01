const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Inicializar la app de administración de Firebase
admin.initializeApp();

const db = admin.firestore();

// Expresión regular para validar username (letras, números, _ , -)
const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,20}$/;

// =======================================================================================
// D E P R E C A T E D / R E F A C T O R I N G
// =======================================================================================
// La función 'createLeague' original que tenías dependía de la generación de códigos
// en el cliente. Para garantizar la seguridad y unicidad real, debe moverse al backend
// o usar una transacción atómica. Se mantiene aquí por compatibilidad con tu petición,
// pero se recomienda refactorizarla posteriormente para usar transacciones.

// =======================================================================================
// M Ó D U L O : L I G A S (Funciones existentes)
// =======================================================================================

exports.createLeague = functions.https.onCall(async (data, context) => {
    // 1. Autenticación
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Debes iniciar sesión para crear una liga.');
    }

    const { name, maxMembers } = data;
    const ownerId = context.auth.uid;

    // Validaciones básicas
    if (!name || name.length < 3) {
        throw new functions.https.HttpsError('invalid-argument', 'El nombre de la liga debe tener al menos 3 caracteres.');
    }

    const membersLimit = maxMembers || 16;

    // 2. Generar código de invitación (6 caracteres)
    // NOTA: Esto es una implementación simple. Para unicidad garantizada al 100% 
    // bajo concurrencia alta, se requeriría una transacción más compleja.
    const generateCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    };

    const inviteCode = generateCode();

    try {
        // 3. Crear documento de la liga
        const leagueRef = db.collection('leagues').doc();
        const leagueId = leagueRef.id;

        const leagueData = {
            id: leagueId,
            name: name,
            ownerId: ownerId,
            inviteCode: inviteCode,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            maxMembers: membersLimit,
            memberCount: 1 // El creador se añade automáticamente
        };

        // 4. Obtener datos del creador para añadirlo como miembro inicial
        const userDoc = await db.collection('users').doc(ownerId).get();
        if (!userDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'El perfil del usuario creador no existe.');
        }
        const userData = userDoc.data();

        // 5. Usar Batch para asegurar creación de liga y subcolección miembros
        const batch = db.batch();

        batch.set(leagueRef, leagueData);

        // Añadir al creador como miembro con rol 'admin'
        const memberRef = leagueRef.collection('members').doc(ownerId);
        batch.set(memberRef, {
            uid: ownerId,
            username: userData.username,
            teamName: userData.teamName || `${userData.username} FC`,
            joinedAt: admin.firestore.FieldValue.serverTimestamp(),
            role: 'admin',
            points: 0
        });

        await batch.commit();

        return { leagueId: leagueId, inviteCode: inviteCode };

    } catch (error) {
        console.error('Error creando liga:', error);
        if (error instanceof functions.https.HttpsError) throw error;
        throw new functions.https.HttpsError('internal', 'Error interno al crear la liga.');
    }
});


// =======================================================================================
// M Ó D U L O : A U T E N T I C A C I Ó N (Nuevo registro seguro)
// =======================================================================================

/**
 * Cloud Function: registerUser
 * Orquesta el registro de un nuevo usuario de forma segura.
 * Garantiza la unicidad del nombre de usuario y mantiene la consistencia entre Auth y DB.
 */
exports.registerUser = functions.https.onCall(async (data, context) => {
    const { username, email, password } = data;

    // 1. Validación exhaustiva de datos en el backend (Requisito #1)
    if (!username || !USERNAME_REGEX.test(username)) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'El nombre de usuario no es válido. Debe tener entre 3 y 20 caracteres y contener solo letras, números, guiones bajos o guiones.'
        );
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new functions.https.HttpsError('invalid-argument', 'Formato de email inválido.');
    }

    if (!password || password.length < 6) {
        throw new functions.https.HttpsError('invalid-argument', 'La contraseña debe tener al menos 6 caracteres.');
    }

    const normalizedUsername = username.toLowerCase();
    const usernameDocRef = db.collection('usernames').doc(normalizedUsername);

    // Variables para control de limpieza en caso de error
    let authCreated = false;
    let usernameReserved = false;
    let createdUid = null;

    try {
        // 2. Garantizar nombre de usuario único mediante Transacción (Requisito #2)
        // Esto evita condiciones de carrera donde dos usuarios se registran igual a la vez.
        await db.runTransaction(async (transaction) => {
            const usernameDoc = await transaction.get(usernameDocRef);
            if (usernameDoc.exists) {
                throw new functions.https.HttpsError('already-exists', 'El nombre de usuario ya está en uso. Por favor, elige otro.');
            }
            // Reservar nombre temporalmente
            transaction.set(usernameDocRef, { pending: true });
        });
        usernameReserved = true;

        // 3. Crear usuario en Firebase Authentication (Requisito #3)
        const userRecord = await admin.auth().createUser({
            email: email,
            password: password,
            displayName: username // Guardamos el nombre original
        });
        authCreated = true;
        createdUid = userRecord.uid;

        // 4. Crear documento de perfil en Firestore: users/{uid} (Requisito #4)
        // NUNCA almacenar contraseña.
        const userProfile = {
            uid: createdUid,
            username: username, // Guardamos el nombre original con mayúsculas si las tiene
            email: email,
            teamName: `${username} FC`,
            balance: 150, // Saldo inicial Fantasy
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            // Estructura preparada para el Fantasy (vacía inicialmente)
            fantasyPoints: 0,
            squad: [], // Array de IDs de jugadores
            leagueIds: [] // IDs de ligas a las que pertenece
        };

        const batch = db.batch();

        // Crear perfil
        batch.set(db.collection('users').doc(createdUid), userProfile);

        // 5. Consolidar asociación usernames/{normalized} -> UID (Requisito #5)
        batch.update(usernameDocRef, {
            uid: createdUid,
            email: email,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Ejecutar operaciones atómicas
        await batch.commit();

    } catch (error) {
        console.error('Error en flujo de registro:', error);

        // 6. Manejo de errores y consistencia (Requisito #6)
        // Si algo falló después de crear el usuario en Auth, debemos limpiar para no dejar huérfanos.

        // Si el error es que el username ya existe (lanzado por la transacción), no limpiamos nada, solo relanzamos.
        if (error.code === 'already-exists') {
            throw error; 
        }

        // Si el email ya estaba en uso (lanzado por createUser), limpiamos la reserva de username si se hizo.
        if (error.code === 'auth/email-already-in-use') {
             if (usernameReserved) await usernameDocRef.delete();
             throw new functions.https.HttpsError('already-exists', 'El email ya está registrado.');
        }
        
        // ERROR CRÍTICO: Ocurrió un error durante la creación de perfil o consolidación.
        // El usuario se creó en Auth pero no tiene perfil en DB.
        if (authCreated && createdUid) {
            try {
                console.log(`Intentando limpiar usuario de Auth: ${createdUid}`);
                await admin.auth().deleteUser(createdUid);
                // Limpiar también la reserva de username
                if (usernameReserved) await usernameDocRef.delete();
            } catch (cleanupError) {
                console.error('Error fatal durante limpieza de consistencia:', cleanupError);
                // No lanzamos cleanupError, sino el original para informar al cliente.
            }
        } 
        // Si falló antes de crear Auth pero después de reservar username (raro en transacción), limpiamos username.
        else if (usernameReserved && !authCreated) {
             try { await usernameDocRef.delete(); } catch(e) {}
        }

        // Relanzar error genérico al cliente
        throw new functions.https.HttpsError('internal', 'Error interno al crear la cuenta. Por favor, inténtalo de nuevo más tarde.');
    }

    // 7. Registro exitoso (Requisito #11)
    return { 
        uid: createdUid,
        username: username,
        message: 'Usuario registrado correctamente.'
    };
});
// ============================================================
// CLOUD FUNCTION: joinLeague
// ============================================================

exports.joinLeague = functions.https.onCall(async (data, context) => {

    // --------------------------------------------------------
    // 1. AUTENTICACIÓN
    // --------------------------------------------------------

    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'Debes iniciar sesión para unirte a una liga.'
        );
    }

    const uid = context.auth.uid;

    // --------------------------------------------------------
    // 2. VALIDAR CÓDIGO
    // --------------------------------------------------------

    const inviteCode =
        typeof data?.inviteCode === 'string'
            ? data.inviteCode.trim().toUpperCase()
            : '';

    if (!inviteCode || inviteCode.length !== 6) {

        throw new functions.https.HttpsError(
            'invalid-argument',
            'El código de invitación no es válido.'
        );
    }

    try {

        // ----------------------------------------------------
        // 3. BUSCAR LIGA POR CÓDIGO
        // ----------------------------------------------------

        const leaguesSnapshot =
            await db
                .collection('leagues')
                .where(
                    'inviteCode',
                    '==',
                    inviteCode
                )
                .limit(1)
                .get();

        if (leaguesSnapshot.empty) {

            throw new functions.https.HttpsError(
                'not-found',
                'No existe ninguna liga con ese código.'
            );
        }

        const leagueDoc =
            leaguesSnapshot.docs[0];

        const leagueRef =
            leagueDoc.ref;

        const leagueId =
            leagueDoc.id;

        const memberRef =
            leagueRef
                .collection('members')
                .doc(uid);

        const userRef =
            db
                .collection('users')
                .doc(uid);

        // ----------------------------------------------------
        // 4. TRANSACCIÓN
        // ----------------------------------------------------

        await db.runTransaction(
            async (transaction) => {

                const leagueSnapshot =
                    await transaction.get(
                        leagueRef
                    );

                const memberSnapshot =
                    await transaction.get(
                        memberRef
                    );

                const userSnapshot =
                    await transaction.get(
                        userRef
                    );

                if (!leagueSnapshot.exists) {

                    throw new functions.https.HttpsError(
                        'not-found',
                        'La liga ya no existe.'
                    );
                }

                if (!userSnapshot.exists) {

                    throw new functions.https.HttpsError(
                        'not-found',
                        'Tu perfil de usuario no existe.'
                    );
                }

                // --------------------------------------------
                // Ya es miembro
                // --------------------------------------------

                if (memberSnapshot.exists) {

                    throw new functions.https.HttpsError(
                        'already-exists',
                        'Ya perteneces a esta liga.'
                    );
                }

                const leagueData =
                    leagueSnapshot.data();

                // --------------------------------------------
                // Comprobar capacidad
                // --------------------------------------------

                const maxMembers =
                    Number(
                        leagueData.maxMembers || 16
                    );

                const memberCount =
                    Number(
                        leagueData.memberCount || 0
                    );

                if (
                    memberCount >= maxMembers
                ) {

                    throw new functions.https.HttpsError(
                        'resource-exhausted',
                        'La liga está llena.'
                    );
                }

                const userData =
                    userSnapshot.data();

                // --------------------------------------------
                // Crear miembro
                // --------------------------------------------

                transaction.set(
                    memberRef,
                    {
                        uid: uid,
                        username:
                            userData.username,
                        teamName:
                            userData.teamName ||
                            `${userData.username} FC`,
                        joinedAt:
                            admin.firestore
                                .FieldValue
                                .serverTimestamp(),
                        role: 'member',
                        points: 0
                    }
                );

                // --------------------------------------------
                // Actualizar contador
                // --------------------------------------------

                transaction.update(
                    leagueRef,
                    {
                        memberCount:
                            admin.firestore
                                .FieldValue
                                .increment(1)
                    }
                );

                // --------------------------------------------
                // Añadir liga al usuario
                // --------------------------------------------

                transaction.update(
                    userRef,
                    {
                        leagueIds:
                            admin.firestore
                                .FieldValue
                                .arrayUnion(
                                    leagueId
                                )
                    }
                );
            }
        );

        // ----------------------------------------------------
        // 5. RESPUESTA
        // ----------------------------------------------------

        return {
            success: true,
            leagueId: leagueId,
            inviteCode: inviteCode,
            message:
                'Te has unido a la liga correctamente.'
        };

    } catch (error) {

        console.error(
            '❌ Error en joinLeague:',
            error
        );

        // Mantener HttpsErrors que nosotros mismos lanzamos
        if (
            error instanceof
            functions.https.HttpsError
        ) {
            throw error;
        }

        throw new functions.https.HttpsError(
            'internal',
            'Error interno al unirse a la liga.'
        );
    }
});
