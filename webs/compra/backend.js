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
    const userItems = (user, path) => dbSdk.collection(db, 'shopping_users', user.id, path);
    const meals = user => userItems(user, 'meals');
    const categories = user => userItems(user, 'categories');
    const templateMarker = user => dbSdk.doc(userItems(user, 'settings'), 'template');
    const entries = snapshot => snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }))
        .sort((a, b) => a.name.localeCompare(b.name, 'es'));

    authSdk.onAuthStateChanged(auth, user => {
        setTimeout(() => onAccount(user?.emailVerified ? { id: user.uid, email: user.email } : null), 0);
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
        async listMenu(user) {
            const [mealData, categoryData, marker] = await Promise.all([
                dbSdk.getDocs(meals(user)), dbSdk.getDocs(categories(user)), dbSdk.getDoc(templateMarker(user))
            ]);
            return { meals: entries(mealData), categories: entries(categoryData), templateApplied: marker.exists() };
        },
        async saveCategory(user, id, name) {
            const ref = id ? dbSdk.doc(categories(user), id) : dbSdk.doc(categories(user));
            const data = { name, removed: false };
            await dbSdk.setDoc(ref, data);
            return { ...data, id: ref.id };
        },
        async removeCategory(user, category) {
            await dbSdk.setDoc(dbSdk.doc(categories(user), category.id), { name: category.name, removed: true });
        },
        async applyTemplate(user, template, currentCategories, currentMeals) {
            const batch = dbSdk.writeBatch(db);
            batch.set(templateMarker(user), { applied: true });
            for (const [name, dishes] of template) {
                const sameName = [...currentCategories.values()].find(category =>
                    !category.removed && category.name.localeCompare(name, 'es', { sensitivity: 'base' }) === 0);
                const category = currentCategories.get(name) ?? sameName;
                if (category?.removed) continue;
                const id = category?.id ?? name;
                if (!category || category.legacy) {
                    batch.set(dbSdk.doc(categories(user), id), { name, removed: false });
                }
                for (const dish of dishes) {
                    if (currentMeals.some(meal => meal.category === id &&
                        meal.name.localeCompare(dish.name, 'es', { sensitivity: 'base' }) === 0)) continue;
                    batch.set(dbSdk.doc(meals(user)), { ...dish, category: id });
                }
            }
            await batch.commit();
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
