## I **Laravel Enterprise Auth Module** 

Rate Limiting · 2FA · Social Login · Audit Log · Session Management · RBAC 

||**15+**<br>endpoints||**8**<br>paquetes||**2FA**<br>Google Auth||**RBAC**<br>5 roles|
|---|---|---|---|---|---|---|---|



## II **Stack tecnológico** 

|**Capa**|**Tecnología**|
|---|---|
|`Backend`|Laravel 13 + PHP 8.5|
|`Frontend`|Inertia.js + Vue 3 / React + TypeScript|
|`Auth API`|Laravel Sanctum (SPA + tokens)|
|`Social`|Laravel Socialite (Google, GitHub)|
|`2FA`|pragmarx/google2fa-laravel (TOTP)|
|`Permisos`|spatie/laravel-permission (RBAC)|
|`Audit`|spatie/laravel-activitylog|
|`Cache/RL`|Redis (rate limiting, sessions, cache)|
|`CSS`|Tailwind CSS v4|



## I **Instalación de paquetes** 

```
./vendor/bin/sail composer require \
    laravel/sanctum \
    laravel/socialite \
    pragmarx/google2fa-laravel \
    bacon/bacon-qr-code \
    spatie/laravel-permission \
    spatie/laravel-activitylog
./vendor/bin/sail artisan install:api
```

```
./vendor/bin/sail artisan vendor:publish --provider="PragmaRX\Google2FALaravel\ServiceProvider"
./vendor/bin/sail artisan vendor:publish --provider="Spatie\Permission\PermissionServiceProvider"
./vendor/bin/sail artisan vendor:publish --provider="Spatie\Activitylog\ActivitylogServiceProvider" -
-tag="activitylog-migrations"
./vendor/bin/sail artisan migrate
```

## I **Módulos del sistema** 

## **1. Registro y Login base** 

- Registro email + password (bcrypt, mín 12 chars) 

- Verificación de email obligatoria antes de acceder 

- Remember me con token seguro 

- Logout individual y logout de todos los dispositivos 

## **2. Rate Limiting y Brute Force Protection** 

- Login: máx 5 intentos / IP+email / minuto (Redis) 

- Registro: máx 3 por IP / hora 

- Reset password: máx 3 por IP / 15 minutos 

- 2FA: máx 5 intentos / usuario / 5 minutos 

- Bloqueo de cuenta 15 min tras 10 fallos 

- Header Retry-After en respuestas limitadas 

- Log de cada intento fallido con IP + user agent 

## **3. Two-Factor Auth — Google Authenticator** 

- QR Code con pragmarx/google2fa (TOTP RFC 6238) 

- Compatible: Google Auth, Authy, Microsoft Auth 

- 8 backup codes hasheados (uso único) 

- Regeneración de backup codes con confirmación de password 

- Middleware '2fa' en rutas protegidas 

- Opción 'confiar dispositivo 30 días' (cookie firmada) 

- 2FA obligatorio para roles admin/superadmin 

## **4. Social Login — OAuth** 

- Google OAuth2 y GitHub OAuth2 (Socialite) 

- Vincular cuenta social a usuario existente (por email) 

- Crear usuario nuevo si no existe 

- Tabla linked_social_accounts (provider, token, etc.) 

- Desvincular proveedor desde perfil 

- Protección account takeover (verificar email del provider) 

## **5. Gestión de contraseñas** 

- Reset por email (token expira 60 min, uso único) 

- Historial últimas 5 passwords (no reutilizar) 

- Política: 12+ chars, mayúscula, número, símbolo 

- Invalidar sesión al cambiar password 

- Email de notificación al cambiar password 

## **6. Sesiones y dispositivos** 

- Listar sesiones activas (IP, user agent, última actividad) 

- Revocar sesión individual o todas menos la actual 

- Email de alerta al detectar nuevo dispositivo/IP 

- Rotación automática de token Sanctum en cada login 

- Expiración configurable: 24h usuarios, 1h admin 

## **7. Audit Log completo** 

- Login/logout, intentos fallidos, cambios de password 

- Activación/desactivación 2FA, uso de backup codes 

- Login social, revocación de sesión, bloqueo de cuenta 

- Campos extra: ip_address, user_agent, country 

## **8. RBAC — Roles y permisos** 

- superadmin, admin, moderator, user, guest 

- Middleware de roles en rutas 

- Policies para recursos 

- Props Inertia para mostrar/ocultar UI por rol 

## II **Rutas principales** 

|**Método**|**Ruta**|**Descripción**|
|---|---|---|
|`POST`|/register|Registro de usuario|
|`POST`|/login|Login (throttle:5,1)|
|`POST`|/logout|Logout sesión actual|
|`POST`|/forgot-password|Reset password (throttle:3,15)|
|`POST`|/reset-password|Confirmar nuevo password|
|`GET`|/email/verify/{id}/{hash}|Verificar email|
|`GET`|/auth/{provider}/redirect|OAuth redirect (google/github)|
|`GET`|/auth/{provider}/callback|OAuth callback|
|`POST`|/two-factor/verify|Verificar TOTP (throttle:5,5)|
|`POST`|/two-factor/use-backup-code|Usar backup code|
|`GET`|/two-factor/setup|Setup QR code 2FA|
|`POST`|/two-factor/enable|Activar 2FA|
|`POST`|/two-factor/disable|Desactivar 2FA|
|`GET`|/sessions|Ver sesiones activas|



|`DELETE`|/sessions/{session}|Revocar sesión|
|---|---|---|
|`POST`|/api/auth/login|API login→token|
|`POST`|/api/auth/refresh|Rotar token API|
|`GET`|/api/auth/me|Datos usuario API|



## I **Estructura de archivos** 

`app/` III `Http/Controllers/Auth/` I III `LoginController.php` I III `RegisterController.php` I III `TwoFactorController.php` I III `SocialAuthController.php` I III `SessionController.php` III `Http/Requests/Auth/` I III `LoginRequest.php` ← `rate limiting aquí` I III `RegisterRequest.php` I III `TwoFactorRequest.php` III `Http/Middleware/` I III `TwoFactorMiddleware.php` I III `SecurityHeaders.php` III `Services/Auth/` I III `AuthService.php` ← `lógica principal` I III `TwoFactorService.php` ← `TOTP + QR + backup codes` I III `SocialAuthService.php` ← `Socialite` I III `SessionService.php` ← `device management` III `Notifications/` III `NewDeviceLogin.php` III `PasswordChanged.php resources/js/Pages/Auth/` 

III `Login.tsx / Login.vue` 

III `Register.tsx` 

III `TwoFactor.tsx` ← `TOTP input + backup toggle` III `TwoFactorSetup.tsx` ← `QR Code` III `BackupCodes.tsx` 

III `Sessions.tsx` ← `gestión de dispositivos` 

## I **Checklist de seguridad enterprise** 

I Rate limiting en TODOS los endpoints de auth (Redis) 

I 2FA TOTP compatible con Google Authenticator / Authy 

I Backup codes hasheados + uso único + regeneración 

I Social login con protección account takeover 

I Detección de nuevo dispositivo/IP con email de alerta 

I Gestión de sesiones activas con revocación individual 

I Audit log completo de cada acción de autenticación 

I Password history — no reutilizar últimas 5 contraseñas 

I Token Sanctum con rotación automática y expiración 

I Security headers en todas las respuestas HTTP 

I Email verificado obligatorio antes de acceder 

I Bloqueo temporal (15 min) tras 10 intentos fallidos 

- I Encriptación de 2FA secret y backup codes en DB 

I CSRF en todos los formularios Inertia 

I Session regeneration (session()->regenerate()) en login 

I APP_DEBUG=false en producción 

- I Tokens de reset de password de uso único (expiran 60 min) 

- I 2FA obligatorio para roles admin y superadmin 

## I **Variables .env requeridas** 

```
CACHE_DRIVER=redis
SESSION_DRIVER=redis
QUEUE_CONNECTION=redis
SANCTUM_STATEFUL_DOMAINS=localhost,127.0.0.1
```

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URL=${APP_URL}/auth/google/callback
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_REDIRECT_URL=${APP_URL}/auth/github/callback
GOOGLE2FA_SECRET_LENGTH=32
GOOGLE2FA_WINDOW=1
```

I Nunca hardcodear credenciales. Usar .env y config() helpers. El APP_KEY debe regenerarse en cada entorno con: php artisan key:generate 

