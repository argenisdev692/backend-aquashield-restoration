# Detección de Paquetes Deprecados

Guía de comandos y herramientas para identificar dependencias obsoletas, no utilizadas o con vulnerabilidades de seguridad en proyectos Node.js / NestJS.

---

## 1. Comandos npm nativos

### `npm outdated`
Muestra una tabla con los paquetes instalados, la versión actual, la wanted (última dentro del rango de `package.json`) y la latest disponible. Tambien indica si es un cambio `major`, `minor` o `patch`.

```bash
npm outdated
```

### `npm audit`
Analiza el árbol de dependencias en busca de vulnerabilidades de seguridad conocidas. Genera un reporte con severidad (`low`, `moderate`, `high`, `critical`) y sugerencias de fix.

```bash
npm audit
```

### `npm info <paquete>`
Muestra metadata completa de un paquete específico. Si está deprecado, aparece el campo `deprecated` con el mensaje del autor.

```bash
npm info class-validator
npm info @prisma/client
```

---

## 2. Herramientas especializadas (ejecutables con npx)

### `npm-check`
Interfaz interactiva que muestra:
- Paquetes desactualizados (con colores por severidad)
- Paquetes no utilizados
- Paquetes con licencias problemáticas

```bash
npx npm-check
```

> Requiere Node.js >= 14. Para usarlo en modo no-interactivo: `npx npm-check --json`

### `depcheck`
Detecta dependencias listadas en `package.json` que no se importan en el código, y dependencias usadas en el código pero no listadas en `package.json`.

```bash
npx depcheck
```

> Ignora archivos de test y carpetas como `node_modules/` por defecto. Puedes añadir excepciones con un archivo `.depcheckrc`.

### `npm-audit-resolver`
Herramienta interactiva para gestionar findings de `npm audit`. Permite ignorar vulnerabilidades aceptadas temporalmente y documentar decisiones.

```bash
npx npm-audit-resolver
```

---

## 3. Señales visuales de deprecación

| Canal | Qué observar |
|-------|--------------|
| **Terminal** | Warnings amarillos durante `npm install`: `npm WARN deprecated <pkg>@<version>: <mensaje>` |
| **npmjs.com** | Banda roja o amarilla en la página del paquete con el mensaje del autor |
| **package.json** | Campo `deprecated` en la metadata del paquete (visible con `npm info`) |
| **GitHub** | Issues o README del repositorio con avisos de fin de soporte |

---

## 4. Comandos de diagnóstico útiles

### Listado de dependencias de primer nivel
```bash
npm ls --depth=0
```

### Árbol completo de dependencias
```bash
npm ls
```

### Ver versión instalada de un paquete
```bash
npm ls <paquete>
# Ejemplo: npm ls @nestjs/core
```

### Forzar actualización del árbol de dependencias
```bash
npm update
```

---

## 5. Flujo de trabajo recomendado

Ejecuta periódicamente (semanalmente o antes de releases):

```bash
# 1. Detectar desactualizados
npm outdated

# 2. Detectar vulnerabilidades
npm audit

# 3. Detectar paquetes no usados
npx depcheck

# 4. Revisión interactiva completa
npx npm-check
```

---

## 6. Tabla resumen de herramientas

| Herramienta | Propósito principal | Requiere instalar |
|-------------|---------------------|-------------------|
| `npm outdated` | Versiones desactualizadas | No (incluido en npm) |
| `npm audit` | Vulnerabilidades de seguridad | No (incluido en npm) |
| `npm info` | Metadata de un paquete específico | No (incluido en npm) |
| `npm-check` | Vista interactiva completa | Solo con npx |
| `depcheck` | Dependencias no usadas / faltantes | Solo con npx |
| `npm-audit-resolver` | Gestionar findings de audit | Solo con npx |

---

> **Nota:** La información de deprecación depende de los autores de los paquetes marcándolos como tales en el registro de npm. Un paquete puede estar obsoleto (sin mantenimiento) sin estar formalmente deprecado.
