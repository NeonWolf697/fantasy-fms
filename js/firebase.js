```js
// js/firebase.js

// ============================================================
// FIREBASE SDK - API COMPAT
// ============================================================

import firebase from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js";
import "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth-compat.js";
import "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js";
import "https://www.gstatic.com/firebasejs/10.8.0/firebase-functions-compat.js";

// ============================================================
// CONFIGURACIÓN DEL PROYECTO
// ============================================================

const firebaseConfig = {
    apiKey: "AIzaSyBC0jaGh0_-Zl7GkpcdScYk09-s9LZ9daQ",
    authDomain: "fms-fantasy-cf746.firebaseapp.com",
    projectId: "fms-fantasy-cf746",
    storageBucket: "fms-fantasy-cf746.firebasestorage.app",
    messagingSenderId: "705474226193",
    appId: "1:705474226193:web:b2f473a9b5d5fea1bb69b0",
    measurementId: "G-V65T9FCKTD"
};

// ============================================================
// INICIALIZAR FIREBASE
// ============================================================

const app = firebase.initializeApp(firebaseConfig);

// ============================================================
// SERVICIOS
// ============================================================

// Firebase Authentication
const auth = firebase.auth();

// Firestore
const db = firebase.firestore();

// Cloud Functions
const functions = firebase.functions();

// ============================================================
// EXPORTACIONES
// ============================================================

export {
    app,
    auth,
    db,
    functions
};
```
