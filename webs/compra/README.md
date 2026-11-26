# Asistente de compras

El catálogo y la lista funcionan sin cuenta. En **Mis comidas**, cada usuario puede guardar platos con sus ingredientes, elegir la temperatura de conservación y añadirlos a la misma lista que los platos del catálogo. La selección y los productos marcados se conservan mientras la página está abierta.

## Activar las cuentas

1. Usa un proyecto dedicado de Supabase y ejecuta una vez [schema.sql](schema.sql) en su SQL Editor. Si el proyecto restringe las tablas expuestas por la Data API, expón `public.shopping_meals`.
2. Rellena [config.js](config.js) con la URL HTTPS del proyecto, sin barra final, y la clave pública `sb_publishable_…` o la clave heredada `anon`.
3. En Authentication, activa el proveedor de correo y la confirmación de correo. Configura la URL de la página, incluyendo la barra final, como URL de redirección permitida. Para altas de usuarios externos, configura un servidor SMTP propio y revisa los límites de Auth.
4. Prueba con dos cuentas. Comprueba que cada una puede crear, editar y borrar sus comidas, y que las comidas de la primera cuenta no aparecen en la segunda ni al cerrar la sesión.

La sesión en GitHub Pages se guarda en la pestaña. Todas las páginas del mismo origen comparten su perímetro de confianza. Un origen dedicado aislaría el asistente de las otras webs y permitiría aplicar `frame-ancestors` con una cabecera HTTP.
