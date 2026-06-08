# La Blonda — Sistema de Reservas Completo

## Archivos del proyecto

```
lablonda_final/
├── public/
│   ├── index.html      → App del encargado (mesas, reservas, chat, informe)
│   ├── admin.html      → Panel admin (eventos, mesas, derecho de reserva, links)
│   ├── evento.html     → Página pública de evento para clientes
│   ├── manifest.json   → Config PWA (app instalable)
│   └── sw.js           → Service Worker (funciona offline)
├── api/
│   └── chat.js         → Serverless function con Claude (asistente IA)
├── vercel.json         → Rutas y redirects
└── README.md           → Este archivo
```

## Pasos para subir a Vercel

### 1. Crear repo en GitHub
1. Entrá a github.com → New repository → nombre: `la-blonda`
2. Descomprimí el ZIP en tu computadora
3. Abrí la carpeta y ejecutá en terminal:
```bash
git init
git add .
git commit -m "La Blonda v1 completo"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/la-blonda.git
git push -u origin main
```

### 2. Conectar con Vercel
1. Entrá a vercel.com con tu cuenta
2. "Add New Project" → importá el repo `la-blonda`
3. Framework Preset: **Other**
4. Root Directory: dejar vacío
5. Click en "Deploy"

### 3. Agregar API Key de Claude
1. En Vercel → tu proyecto → Settings → Environment Variables
2. Agregar:
   - Name: `ANTHROPIC_API_KEY`
   - Value: tu API key (la encontrás en console.anthropic.com)
3. Redeploy el proyecto

### 4. Configurar el admin
1. Entrá a `tu-dominio.vercel.app/admin`
2. Contraseña por defecto: **admin123** (cambiala inmediatamente)
3. En Config → poné el dominio que te dio Vercel
4. Configurá las mesas, eventos y el derecho de reserva

## URLs del sistema

| URL | Descripción |
|-----|-------------|
| `tu-dominio.vercel.app` | App del encargado |
| `tu-dominio.vercel.app/admin` | Panel admin (con contraseña) |
| `tu-dominio.vercel.app/e/karaoke` | Link de evento para Instagram |
| `tu-dominio.vercel.app/e/tan-bionica` | Otro link de evento |

## Links de Instagram
Desde el panel admin → sección Links → creás los slugs.
Ese link va en el bio de Instagram. Cuando alguien lo toca, ve el evento con foto, info y chat para reservar.

## Cómo funciona el asistente Claude
- El chat en la app del encargado (pestaña "Reservar") usa Claude
- Lee la config de mesas, eventos activos y derecho de reserva en tiempo real
- Cuando el cliente completa todos los datos, Claude confirma la reserva y aparece botón de WhatsApp
- Si el grupo supera el límite configurado, Claude informa el derecho de reserva automáticamente
- Los links `/e/slug` llevan a una página del evento con el chat ya contextualizado

## Flujo de trabajo diario
1. Abrís `tu-dominio.vercel.app` → ves el estado de mesas
2. Las alertas del día te avisan cuándo mandar recordatorios
3. Al llegar los clientes → "Sentar" → cuando se van → "Liberar"
4. Si vinieron todos → "🏆 La Palabra" → se envía el mensaje de premio por WhatsApp

## Eventos y shows
1. Admin → Eventos → "+ Nuevo evento"
2. Subís la placa/foto, ponés nombre, tipo, fecha, precio
3. Escribís el mensaje para Claude (qué mesas recomendar, datos del show)
4. Activás el evento → aparece en el pop-up automáticamente
5. Copiás el link desde la sección Links y lo pegás en Instagram

## Variables de entorno requeridas
```
ANTHROPIC_API_KEY=sk-ant-...
```

## Soporte
Sistema desarrollado con Claude (Anthropic).
