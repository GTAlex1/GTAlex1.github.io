import { supabaseUrl, supabasePublicKey } from './config.js';

function isPublicKey(key) {
    if (/^sb_publishable_[a-z0-9_-]+$/i.test(key)) return true;
    try {
        const payload = key.split('.')[1].replaceAll('-', '+').replaceAll('_', '/');
        return JSON.parse(atob(payload)).role === 'anon';
    } catch {
        return false;
    }
}

export async function connect(onAccount) {
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl)
        || !isPublicKey(supabasePublicKey) || !globalThis.supabase) return null;

    const client = globalThis.supabase.createClient(supabaseUrl, supabasePublicKey, {
        auth: { storage: sessionStorage, storageKey: 'compra-auth' },
        realtime: { transport: WebSocket }
    });
    const meals = () => client.from('shopping_meals');

    client.auth.onAuthStateChange((_event, session) => {
        setTimeout(() => onAccount(session?.user ?? null), 0);
    });

    return {
        canSignUp: true,
        async signIn(email, password) {
            const { error } = await client.auth.signInWithPassword({ email, password });
            if (error) throw error;
        },
        async signUp(email, password) {
            const { error } = await client.auth.signUp({
                email, password, options: { emailRedirectTo: new URL('./', location.href).href }
            });
            if (error) throw error;
        },
        async signOut() {
            const { error } = await client.auth.signOut({ scope: 'local' });
            if (error) throw error;
        },
        async listMeals() {
            const pageSize = 100;
            const result = [];
            let offset = 0;
            while (true) {
                const { data, error } = await meals().select('id,name,category,ingredients')
                    .order('id').range(offset, offset + pageSize - 1);
                if (error) throw error;
                result.push(...data);
                if (data.length < pageSize) break;
                offset += pageSize;
            }
            return result.sort((a, b) => a.name.localeCompare(b.name, 'es'));
        },
        async saveMeal(_user, id, meal) {
            const query = id ? meals().update(meal).eq('id', id) : meals().insert(meal);
            const { data, error } = await query.select('id,name,category,ingredients').single();
            if (error) throw error;
            return data;
        },
        async deleteMeal(_user, id) {
            const { error } = await meals().delete().eq('id', id).select('id').single();
            if (error) throw error;
        }
    };
}
