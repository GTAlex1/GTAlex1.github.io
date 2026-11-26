# Asistente de compras

En **Mis comidas**, cada cuenta puede empezar desde cero o pulsar **Aplicar plantilla** para copiar una selección inicial de categorías y platos. La plantilla se puede aplicar una vez por cuenta. Puedes editar tus platos y gestionar tus categorías. Al quitar una categoría, sus platos pasan a **Sin categoría**.

## Firebase

El frontend usa el proyecto `listadelacompr4` y el proveedor de correo y contraseña. Para guardar comidas, el usuario debe confirmar primero su correo. [firestore.rules](firestore.rules) contiene las reglas del proyecto. Comprueba que la versión publicada en Firebase coincide con este archivo después de editar las reglas.

La sesión se conserva en la pestaña. Todas las páginas del mismo origen comparten su perímetro de confianza. Un origen dedicado aislaría el asistente de las otras webs y permitiría aplicar `frame-ancestors` con una cabecera HTTP.
