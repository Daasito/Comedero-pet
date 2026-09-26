# Comedero Pet

Interfaz web estática para el comedero con ESP32. No requiere instalar dependencias.

## Abrirla

Abre `index.html` en cualquier navegador moderno. Para una prueba local más parecida a producción, sirve esta carpeta con la extensión Live Server de VS Code o con cualquier servidor web estático.

## Conectar al ESP32 más adelante

La interfaz llama a `sendServeCommandToESP32(durationSeconds)` en `script.js`. Envía a la API un tiempo de giro entre 0 y 60 segundos. Nunca incluyas claves Wi-Fi o credenciales privadas en estos archivos del navegador.

La imagen de mascota utilizada por la página está incluida en `assets/perrito-comedero.png`.
