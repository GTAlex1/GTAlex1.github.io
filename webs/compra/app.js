import { catalogo } from './catalogo.js';
import { connect } from './backend.js';

const get = id => document.getElementById(id);
const temperatures = ['Ambiente', 'Nevera', 'Congelador'];
const aisles = ['Pasillo seco', 'Refrigerados', 'Congelados'];
const categories = Object.keys(catalogo);
const catalogChecks = get('catalog');
const personalChecks = get('personal-meals');
const authDialog = get('auth-dialog');
const mealDialog = get('meal-dialog');
const deleteDialog = get('delete-dialog');
const purchased = new Set();
let backend;
let account;
let accountVersion = 0;
let editing;
let deleting;
let signup = false;

function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
}

function button(text, action) {
    const node = element('button', text);
    node.type = 'button';
    node.addEventListener('click', action);
    return node;
}

function productCheck(name, temperature, shopping = false) {
    const check = element('input');
    check.type = 'checkbox';
    const label = element('label', undefined, 'check');
    label.append(check, element('span', name, shopping ? 'shopping-name' : undefined));
    if (!shopping) {
        label.append(element('span', temperatures[temperature], 'temperature-label'));
        check.dataset.name = name;
        check.dataset.temperature = temperature;
    }
    const row = element('li');
    row.append(label);
    return { row, check };
}

function mealCard(meal, personal = false) {
    const card = element('article', undefined, 'card');
    const top = element('div', undefined, 'card-top');
    const all = element('input');
    all.type = 'checkbox';
    all.className = 'select-meal';
    all.setAttribute('aria-label', `Seleccionar todos los ingredientes de ${meal.name}`);
    const details = element('details');
    const summary = element('summary');
    summary.append(element('span', meal.name));
    const number = meal.ingredients.length;
    summary.append(element('span', `${number} ${number === 1 ? 'ingrediente' : 'ingredientes'}`, 'ingredient-count'));
    const list = element('ul', undefined, 'ingredients');
    const checks = meal.ingredients.map(({ n, t }) => {
        const { row, check } = productCheck(n, t);
        list.append(row);
        return check;
    });
    const update = () => {
        const selected = checks.filter(input => input.checked).length;
        all.checked = selected === checks.length;
        all.indeterminate = selected > 0 && !all.checked;
        card.classList.toggle('selected', selected > 0);
        updateSelection();
    };
    all.addEventListener('change', () => {
        checks.forEach(input => { input.checked = all.checked; });
        if (all.checked) details.open = true;
        update();
    });
    list.addEventListener('change', update);
    details.append(summary, list);
    top.append(all, details);
    card.append(top);
    if (personal) {
        card.dataset.id = meal.id;
        const actions = element('div', undefined, 'card-actions');
        actions.append(element('span', meal.category, 'temperature-label'),
            button('Editar', () => openMeal(meal)),
            button('Eliminar', () => openDelete(meal)));
        card.append(actions);
    }
    return card;
}

function renderCatalog() {
    for (const [category, meals] of Object.entries(catalogo)) {
        const section = element('section', undefined, 'category');
        const heading = element('h2', category);
        if (category === 'Comida' || category === 'Cena') {
            const counter = element('span', '0 platos seleccionados', 'category-count');
            heading.append(counter);
            section.addEventListener('change', () => {
                const count = section.querySelectorAll('.select-meal:checked').length;
                counter.textContent = `${count} ${count === 1 ? 'plato seleccionado' : 'platos seleccionados'}`;
            });
        }
        const grid = element('div', undefined, 'grid');
        grid.append(...meals.map(meal => mealCard(meal)));
        section.append(heading, grid);
        catalogChecks.append(section);
    }
}

function selectedProducts() {
    const products = new Map();
    for (const check of get('menu').querySelectorAll('input[data-name]:checked')) {
        const { name, temperature } = check.dataset;
        const key = name.normalize('NFC').toLocaleLowerCase('es');
        if (!products.has(key)) products.set(key, { name, temperature: Number(temperature) });
    }
    return products;
}

function updateSelection() {
    const count = selectedProducts().size;
    get('selection-count').textContent = `${count} ${count === 1 ? 'producto seleccionado' : 'productos seleccionados'}`;
    get('generate').disabled = count === 0;
}

function showShopping(focus = true) {
    const products = selectedProducts();
    if (!products.size) {
        showMenu();
        return;
    }
    const shopping = get('shopping');
    shopping.replaceChildren();
    const lists = aisles.map((title, index) => {
        const section = element('section', undefined, `temperature temp-${index}`);
        const list = element('ul');
        section.append(element('h3', title), list);
        shopping.append(section);
        return list;
    });
    const syncProgress = () => {
        const count = [...products.keys()].filter(key => purchased.has(key)).length;
        get('progress').textContent = `${count} de ${products.size} productos en el carro`;
    };
    for (const [key, { name, temperature }] of [...products].sort((a, b) => a[1].name.localeCompare(b[1].name, 'es'))) {
        const { row, check } = productCheck(name, temperature, true);
        check.checked = purchased.has(key);
        check.addEventListener('change', () => {
            if (check.checked) purchased.add(key);
            else purchased.delete(key);
            syncProgress();
        });
        lists[temperature].append(row);
    }
    lists.filter(list => !list.children.length).forEach(list => list.parentElement.remove());
    syncProgress();
    get('menu').hidden = true;
    get('results').hidden = false;
    if (focus) get('results-title').focus();
}

function showMenu() {
    get('results').hidden = true;
    get('shopping').replaceChildren();
    get('menu').hidden = false;
    (get('generate').disabled ? get('show-catalog') : get('generate')).focus();
}

function showPersonal(personal) {
    catalogChecks.hidden = personal;
    get('personal').hidden = !personal;
    get('show-catalog').setAttribute('aria-pressed', String(!personal));
    get('show-personal').setAttribute('aria-pressed', String(personal));
}

function guestMessage() {
    get('personal-message').textContent = backend
        ? 'Inicia sesión para crear tus propias comidas.'
        : 'El acceso a cuentas todavía no está disponible.';
}

async function loadMeals() {
    const version = accountVersion;
    get('retry').hidden = true;
    get('add-meal').disabled = true;
    get('personal-message').textContent = 'Cargando tus comidas…';
    try {
        const meals = await backend.listMeals(account);
        if (version !== accountVersion) return;
        personalChecks.replaceChildren(...meals.map(meal => mealCard(meal, true)));
        get('personal-message').textContent = meals.length ? '' : 'Todavía no tienes comidas. Añade la primera.';
    } catch {
        if (version !== accountVersion) return;
        get('retry').hidden = false;
        get('personal-message').textContent = 'No se pudieron cargar tus comidas.';
    } finally {
        if (version === accountVersion) get('add-meal').disabled = false;
    }
}

function setAccount(user) {
    if (account?.id === user?.id) return;
    account = user;
    accountVersion++;
    personalChecks.replaceChildren();
    purchased.clear();
    updateSelection();
    if (!get('results').hidden) showShopping(false);
    mealDialog.close();
    deleteDialog.close();
    get('retry').hidden = true;
    get('login').hidden = Boolean(user);
    get('logout').hidden = !user;
    get('add-meal').hidden = !user;
    get('account-email').hidden = !user;
    get('account-email').textContent = user?.email ?? '';

    if (user) {
        authDialog.close();
        showPersonal(true);
        void loadMeals();
    } else {
        guestMessage();
    }
}

function setAuthMode(mode) {
    signup = mode;
    get('auth-title').textContent = signup ? 'Crea tu cuenta' : 'Iniciar sesión';
    get('auth-submit').textContent = signup ? 'Crear cuenta' : 'Entrar';
    get('auth-mode').textContent = signup ? 'Ya tengo cuenta' : 'Crear una cuenta';
    get('auth-mode').hidden = !backend?.canSignUp;
    get('password').autocomplete = signup ? 'new-password' : 'current-password';
    get('password').minLength = signup ? 8 : 0;
    get('auth-message').textContent = '';
}

function openAuth() {
    get('auth-form').reset();
    setAuthMode(false);
    get('auth-fields').disabled = !backend;
    get('auth-description').textContent = backend
        ? 'Entra para guardar y editar tus propias comidas.'
        : 'El acceso a cuentas todavía no está disponible. Puedes usar el catálogo y generar tu lista.';
    authDialog.showModal();
}

get('auth-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!backend) return;
    get('auth-fields').disabled = true;
    get('auth-message').textContent = '';
    try {
        const email = get('email').value.trim();
        const password = get('password').value;
        if (signup) {
            await backend.signUp(email, password);
            setAuthMode(false);
            get('auth-message').textContent = 'Revisa tu correo para confirmar la cuenta y, después, inicia sesión.';
        } else {
            await backend.signIn(email, password);
        }
    } catch {
        get('auth-message').textContent = signup
            ? 'No se pudo crear la cuenta. Revisa los datos o inténtalo más tarde.'
            : 'No se pudo iniciar sesión. Revisa el correo y la contraseña o inténtalo más tarde.';
    } finally {
        get('password').value = '';
        get('auth-fields').disabled = false;
    }
});

function addIngredient(ingredient = { n: '', t: 0 }, focus = false) {
    const row = element('div', undefined, 'ingredient-fields-row');
    const name = element('input');
    name.required = true;
    name.maxLength = 80;
    name.value = ingredient.n;
    const temperature = element('select');
    temperatures.forEach((label, index) => temperature.add(new Option(label, index)));
    temperature.value = String(ingredient.t);
    const nameLabel = element('label', 'Ingrediente');
    const temperatureLabel = element('label', 'Conservación');
    nameLabel.append(name);
    temperatureLabel.append(temperature);
    const remove = button('Quitar', () => {
        row.remove();
        updateIngredientButtons();
    });
    row.append(nameLabel, temperatureLabel, remove);
    get('ingredient-fields').append(row);
    updateIngredientButtons();
    if (focus) name.focus();
}

function updateIngredientButtons() {
    const rows = get('ingredient-fields').children;
    get('add-ingredient').disabled = rows.length >= 40;
    for (const row of rows) row.querySelector('button').disabled = rows.length <= 1;
}

function openMeal(meal) {
    editing = meal;
    get('meal-title').textContent = meal ? 'Editar comida' : 'Nueva comida';
    get('meal-name').value = meal?.name ?? '';
    get('meal-category').value = meal?.category ?? 'Comida';
    get('meal-message').textContent = '';
    get('ingredient-fields').replaceChildren();
    (meal?.ingredients ?? [undefined]).forEach(ingredient => addIngredient(ingredient));
    mealDialog.showModal();
}

function updatePersonalCard(meal, previous) {
    const oldCard = [...personalChecks.children].find(card => card.dataset.id === (previous ?? meal.id));
    if (meal) {
        const newCard = mealCard(meal, true);
        if (oldCard) oldCard.replaceWith(newCard);
        else personalChecks.prepend(newCard);
    } else {
        oldCard?.remove();
    }
    get('personal-message').textContent = personalChecks.children.length ? '' : 'Todavía no tienes comidas. Añade la primera.';
    updateSelection();
}

get('meal-form').addEventListener('submit', async event => {
    event.preventDefault();
    const version = accountVersion;
    const name = get('meal-name').value.trim();
    const ingredients = [...get('ingredient-fields').children].map(row => ({
        n: row.querySelector('input').value.trim(),
        t: Number(row.querySelector('select').value)
    }));
    const message = get('meal-message');
    if (!name || ingredients.some(ingredient => !ingredient.n)) {
        message.textContent = 'Escribe un nombre para la comida y para cada ingrediente.';
        return;
    }
    get('meal-fields').disabled = true;
    message.textContent = 'Guardando…';
    try {
        const meal = { name, category: get('meal-category').value, ingredients };
        const saved = await backend.saveMeal(account, editing?.id, meal);
        if (version !== accountVersion) return;
        updatePersonalCard(saved);
        mealDialog.close();
        get('status').textContent = 'Comida guardada.';
    } catch {
        if (version === accountVersion) message.textContent = 'No se pudo guardar la comida. Inténtalo de nuevo.';
    } finally {
        get('meal-fields').disabled = false;
    }
});

function openDelete(meal) {
    deleting = meal.id;
    get('delete-description').textContent = `Se eliminará «${meal.name}» de tus comidas.`;
    get('delete-message').textContent = '';
    deleteDialog.showModal();
}

get('delete-form').addEventListener('submit', async event => {
    event.preventDefault();
    const version = accountVersion;
    const id = deleting;
    get('delete-confirm').disabled = true;
    try {
        await backend.deleteMeal(account, id);
        if (version !== accountVersion) return;
        updatePersonalCard(null, id);
        deleteDialog.close();
        get('status').textContent = 'Comida eliminada.';
    } catch {
        if (version === accountVersion) get('delete-message').textContent = 'No se pudo eliminar la comida. Inténtalo de nuevo.';
    } finally {
        get('delete-confirm').disabled = false;
    }
});

for (const dialog of [authDialog, mealDialog, deleteDialog]) {
    const busy = () => Boolean(dialog.querySelector('fieldset:disabled, button[type="submit"]:disabled'));
    dialog.querySelector('[data-close]').addEventListener('click', () => {
        if (!busy() || (dialog === authDialog && !backend)) dialog.close();
    });
    dialog.addEventListener('cancel', event => {
        if (busy() && !(dialog === authDialog && !backend)) event.preventDefault();
    });
}
authDialog.addEventListener('close', () => { get('password').value = ''; });
categories.forEach(category => get('meal-category').add(new Option(category, category)));
get('show-catalog').addEventListener('click', () => showPersonal(false));
get('show-personal').addEventListener('click', () => showPersonal(true));
get('generate').addEventListener('click', () => showShopping());
get('back').addEventListener('click', showMenu);
get('login').addEventListener('click', openAuth);
get('auth-mode').addEventListener('click', () => setAuthMode(!signup));
get('logout').addEventListener('click', async () => {
    get('logout').disabled = true;
    try {
        await backend.signOut();
        get('status').textContent = '';
    } catch {
        get('status').textContent = 'No se pudo cerrar la sesión. Inténtalo de nuevo.';
    } finally {
        get('logout').disabled = false;
    }
});
get('add-meal').addEventListener('click', () => openMeal());
get('add-ingredient').addEventListener('click', () => addIngredient(undefined, true));
get('retry').addEventListener('click', loadMeals);

renderCatalog();
guestMessage();
connect(setAccount).then(connection => {
    backend = connection;
    if (!account) guestMessage();
}).catch(() => {
    guestMessage();
});
