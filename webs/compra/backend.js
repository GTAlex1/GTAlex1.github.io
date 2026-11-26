import { firebaseConfig } from './config.js';

export async function connect(onAccount) {
    const [appSdk, authSdk, dbSdk] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js'),
        import('https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore-lite.js')
    ]);
    const app = appSdk.initializeApp(firebaseConfig);
    const auth = authSdk.initializeAuth(app, { persistence: authSdk.browserSessionPersistence });
    auth.languageCode = 'es';
    const db = dbSdk.getFirestore(app);
    const meals = user => dbSdk.collection(db, 'shopping_users', user.id, 'meals');

    authSdk.onAuthStateChanged(auth, user => {
        onAccount(user?.emailVerified ? { id: user.uid, email: user.email } : null);
    });

    return {
        canSignUp: true,
        async signIn(email, password) {
            const { user } = await authSdk.signInWithEmailAndPassword(auth, email, password);
            if (user.emailVerified) return;
            try {
                await authSdk.sendEmailVerification(user);
            } finally {
                await authSdk.signOut(auth);
            }
            return 'Confirma tu cuenta desde el correo que te acabamos de enviar y vuelve a entrar.';
        },
        async signUp(email, password) {
            const { user } = await authSdk.createUserWithEmailAndPassword(auth, email, password);
            try {
                await authSdk.sendEmailVerification(user);
            } finally {
                await authSdk.signOut(auth);
            }
        },
        async signOut() {
            await authSdk.signOut(auth);
        },
        async listMeals(user) {
            const snapshot = await dbSdk.getDocs(meals(user));
            return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }))
                .sort((a, b) => a.name.localeCompare(b.name, 'es'));
        },
        async saveMeal(user, id, meal) {
            if (id) {
                await dbSdk.updateDoc(dbSdk.doc(meals(user), id), meal);
            } else {
                const created = await dbSdk.addDoc(meals(user), meal);
                id = created.id;
            }
            return { ...meal, id };
        },
        async deleteMeal(user, id) {
            await dbSdk.deleteDoc(dbSdk.doc(meals(user), id));
        }
    };
}
