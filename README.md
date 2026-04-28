# 📈 GraphEditor: Control Visual de Curvas y Velocidad en After Effects

**GraphEditor** es la herramienta definitiva para motion designers que quieren llevar sus animaciones al siguiente nivel de pulido profesional. Olvídate de pelear con el editor de gráficos nativo y toma el control total de tus curvas Bezier desde un panel intuitivo y potente.

Esta extensión te permite visualizar y manipular la influencia y velocidad de tus keyframes de forma gráfica, facilitando la creación de movimientos orgánicos, aceleraciones dramáticas y frenados suaves con una precisión quirúrgica.

<img width="913" height="405" alt="CurveAE" src="https://github.com/user-attachments/assets/39b61f69-170d-4fab-83a8-85cb064c9f04" />

---

## ✨ Características Principales

*   🎮 **Editor Visual de Curvas**: Manipula los manejadores de influencia y velocidad directamente desde una interfaz amigable.
*   🚀 **Control de Influencia y Speed**: Ajusta numéricamente o de forma visual el comportamiento de tus animaciones.
*   📐 **Soporte Multicapa**: Funciona con múltiples propiedades y keyframes seleccionados simultáneamente.
*   🎨 **Interfaz Integrada**: Diseñada para sentirse como una parte nativa de After Effects, optimizando el espacio de trabajo.
*   ⚡ **Aplicación en Tiempo Real**: Mira los cambios de tus curvas reflejados instantáneamente en el Graph Editor nativo.
*   🔄 **Presets de Curvatura**: Aplica rápidamente configuraciones de facilidad (Ease) predefinidas para flujos de trabajo veloces.

<img width="701" height="606" alt="Captura de pantalla 2026-04-28 033018" src="https://github.com/user-attachments/assets/aefa94f3-6cb0-4675-b798-effcfbefe021" />

---

## 🚀 Instalación (Paso a Paso)

1.  **Descarga**: Descarga el contenido de este repositorio.
2.  **Mover Carpeta**: Mueve la carpeta de la extensión a la ruta de Adobe:
    *   **Windows**: `C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\`
    *   **macOS**: `/Library/Application Support/Adobe/CEP/extensions/`

---

## ⚠️ Configuración Necesaria (Solo la primera vez)

Como esta es una extensión de código abierto desarrollada para la comunidad, debes habilitar el modo de depuración de Adobe para que After Effects la cargue correctamente:

### Para Windows:
Abre el **Símbolo del sistema (CMD)** como administrador y ejecuta estos comandos:
```cmd
reg add "HKCU\Software\Adobe\CSXS.10" /v PlayerDebugMode /t REG_SZ /d 1 /f
reg add "HKCU\Software\Adobe\CSXS.11" /v PlayerDebugMode /t REG_SZ /d 1 /f
reg add "HKCU\Software\Adobe\CSXS.12" /v PlayerDebugMode /t REG_SZ /d 1 /f
```

### Para macOS:
Abre la **Terminal** y ejecuta estos comandos:
```bash
defaults write com.adobe.CSXS.10 PlayerDebugMode 1
defaults write com.adobe.CSXS.11 PlayerDebugMode 1
defaults write com.adobe.CSXS.12 PlayerDebugMode 1
```
*(Nota: Hemos incluido las versiones 10, 11 y 12 para cubrir desde AE 2021 hasta AE 2024/2025+)*.

---

## 📖 Cómo usar

1.  **Reinicia** After Effects.
2.  Ve al menú superior: **Window > Extensions > GraphEditor**.
3.  **Selecciona** tus keyframes en el timeline.
4.  **Manipula** los puntos de control en el panel visual para ajustar la aceleración y frenado.
5.  ¡Observa cómo tu animación se suaviza al instante!

---

## 🤝 Contribución

¿Tienes ideas para mejorar la precisión de las curvas? ¡Abre un **Issue** o envía un **Pull Request**!

Desarrollado con ❤️ por [Animateoo](https://github.com/Animateoo).
