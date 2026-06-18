<!DOCTYPE html>
<html>

<head>
    <meta charset="UTF-8">
    <title>✅ ¡Información Recibida! - V General Contractors</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }

        .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 10px;
        }

        .logo {
            text-align: center;
            margin-bottom: 25px;
        }

        .logo img {
            max-width: 180px;
            height: auto;
        }

        .details {
            line-height: 1.6;
            color: #333333;
        }

        .footer {
            margin-top: 25px;
            text-align: center;
            color: #666666;
            font-size: 14px;
        }

        .social-icons {
            margin: 20px 0;
            text-align: center;
        }

        .social-icons a {
            margin: 0 10px;
            display: inline-block;
        }

        .highlight-blue {
            color: #1e90ff;
            font-weight: bold;
        }

        .confirmation-banner {
            background: #e6f4ff;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }
    </style>
</head>

<body>
    <div class="container">
        <!-- Logo -->
        <div class="logo">
            <img src="https://vgeneralcontractors.com/assets/logo/logo-png.png" width="180"
                alt="Logo V General Contractors">
        </div>

        <!-- Contenido de Confirmación -->
        <div class="details">
            <h2 style="color: #1e90ff; text-align: center; border-bottom: 2px solid #1e90ff; padding-bottom: 10px;">
                ✅ ¡Gracias por contactarnos!
            </h2>

            <div class="confirmation-banner">
                <p style="text-align: center; margin: 0;">
                    <strong>Hemos recibido tu información exitosamente.</strong>
                </p>
            </div>

            <!-- Línea actualizada con nombre en negrita -->
            {{-- Replace placeholder with Blade variable --}}
            <p style="margin: 20px 0;">Hola <strong> {{ $full_name }} </strong>, ¡gracias por contactarnos! 🙌</p>

            <p>Al completar este formulario, autorizas a
                <strong>{{ \App\Models\CompanyData::first()->company_name ?? 'V General Contractors' }}</strong> a
                contactarte
                para
                coordinar tu
                inspección gratuita. Un agente o asistente virtual te llamará dentro de <strong>1 día hábil</strong>
                desde el número:
            </p>

            <p style="text-align: center; font-size: 1.2em; margin: 25px 0;">
                <span class="highlight-blue"><strong>📞
                        @php
                            $phone = \App\Models\CompanyData::first()->phone ?? '(713) 587-6423';
                            // Remove any non-digit characters
                            $digitsOnly = preg_replace('/[^0-9]/', '', $phone);
                            // Format the number based on length
                            if (strlen($digitsOnly) == 10) {
                                $formattedPhone =
                                    '(' .
                                    substr($digitsOnly, 0, 3) .
                                    ') ' .
                                    substr($digitsOnly, 3, 3) .
                                    '-' .
                                    substr($digitsOnly, 6);
                            } elseif (strlen($digitsOnly) == 11 && substr($digitsOnly, 0, 1) == '1') {
                                // US number with country code
                                $formattedPhone =
                                    '(' .
                                    substr($digitsOnly, 1, 3) .
                                    ') ' .
                                    substr($digitsOnly, 4, 3) .
                                    '-' .
                                    substr($digitsOnly, 7);
                            } else {
                                // Fallback to original
                                $formattedPhone = $phone;
                            }
                            echo $formattedPhone;
                        @endphp
                    </strong></span>
            </p>

            <p style="margin-bottom: 25px;">Tu información es confidencial y será utilizada exclusivamente para este
                propósito. Por favor mantén tu teléfono disponible para recibir nuestra llamada.</p>

            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                <p style="margin: 0; font-size: 0.9em;">📌 <strong>Recordatorio:</strong><br>
                    Si no podemos contactarte, dejaremos un mensaje de voz con instrucciones para reprogramar.</p>
            </div>
        </div>

        <!-- Redes Sociales -->
        <div class="social-icons">
            @if (isset($companyData) && $companyData && $companyData->facebook_link)
                <a href="{{ $companyData->facebook_link }}" target="_blank">
                    <img src="https://cdn-icons-png.flaticon.com/512/124/124010.png" width="30" alt="Facebook">
                </a>
            @endif
            @if (isset($companyData) && $companyData && $companyData->instagram_link)
                <a href="{{ $companyData->instagram_link }}" target="_blank" style="margin-left: 10px;">
                    <img src="https://cdn-icons-png.flaticon.com/512/174/174855.png" width="30" alt="Instagram">
                </a>
            @endif
            @if (isset($companyData) && $companyData && $companyData->linkedin_link)
                <a href="{{ $companyData->linkedin_link }}" target="_blank" style="margin-left: 10px;">
                    <img src="https://cdn-icons-png.flaticon.com/512/174/174857.png" width="30" alt="LinkedIn">
                </a>
            @endif
            @if (isset($companyData) && $companyData && $companyData->twitter_link)
                <a href="{{ $companyData->twitter_link }}" target="_blank" style="margin-left: 10px;">
                    <img src="https://cdn-icons-png.flaticon.com/512/124/124021.png" width="30" alt="Twitter">
                </a>
            @endif
        </div>

        <!-- Pie de Página -->
        <div class="footer">
            <p>Horario de atención:<br>
                Lunes a Viernes: 9:00 AM - 5:00 PM</p>
            <p style="margin-top: 10px; font-size: 12px;">© {{ date('Y') }} V General Contractors. Todos los
                derechos reservados.</p>
            <p style="font-size: 10px; color: #999;">{{ \App\Models\CompanyData::first()->address ?? '' }}</p>

            <div style="margin-top: 5px; font-size: 12px; color: #777;">
                <p style="margin: 3px 0;">
                    @php
                        $companyData = \App\Models\CompanyData::first();
                    @endphp

                    @if ($companyData && $companyData->phone)
                        <span>
                            @php
                                $phone = $companyData->phone ?? '';
                                $digitsOnly = preg_replace('/[^0-9]/', '', $phone);
                                if (strlen($digitsOnly) == 10) {
                                    $formattedPhone =
                                        '(' .
                                        substr($digitsOnly, 0, 3) .
                                        ') ' .
                                        substr($digitsOnly, 3, 3) .
                                        '-' .
                                        substr($digitsOnly, 6);
                                } elseif (strlen($digitsOnly) == 11 && substr($digitsOnly, 0, 1) == '1') {
                                    $formattedPhone =
                                        '(' .
                                        substr($digitsOnly, 1, 3) .
                                        ') ' .
                                        substr($digitsOnly, 4, 3) .
                                        '-' .
                                        substr($digitsOnly, 7);
                                } else {
                                    $formattedPhone = $phone;
                                }
                                echo $formattedPhone;
                            @endphp
                        </span>

                        @if ($companyData && $companyData->email)
                            <span style="margin: 0 5px;">|</span>
                        @endif
                    @endif

                    @if ($companyData && $companyData->email)
                        <a href="mailto:{{ $companyData->email }}"
                            style="color: #666; text-decoration: none;">{{ $companyData->email }}</a>
                    @endif
                </p>
            </div>
        </div>
    </div>
</body>

</html>
