# Asistente de compras

El catálogo y la lista funcionan sin cuenta. En **Mis comidas**, cada usuario puede guardar platos con sus ingredientes, elegir la temperatura de conservación y añadirlos a la misma lista que los platos del catálogo.

## Firebase

El frontend usa el proyecto `listadelacompr4` y el proveedor de correo y contraseña. Para guardar comidas, el usuario debe confirmar primero su correo. [firestore.rules](firestore.rules) contiene las reglas del proyecto. Comprueba que la versión publicada en Firebase coincide con este archivo después de editar las reglas.

La sesión se conserva en la pestaña. Todas las páginas del mismo origen comparten su perímetro de confianza. Un origen dedicado aislaría el asistente de las otras webs y permitiría aplicar `frame-ancestors` con una cabecera HTTP.
